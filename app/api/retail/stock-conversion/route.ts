import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { BUSINESS_IDS } from "@/app/config/business-constants";
import { triggerAgencyBillsForInvoice } from "@/app/lib/inter-branch-billing";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, sourceProductId, targetProductId, sourceQuantity, targetQuantity, createNewProduct, newProductDetails } = body;

    if (!userId || !sourceProductId || !sourceQuantity || !targetQuantity) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (!createNewProduct && !targetProductId) {
      return NextResponse.json({ error: "Target product is required" }, { status: 400 });
    }

    if (!createNewProduct && sourceProductId === targetProductId) {
      return NextResponse.json({ error: "Source and target products must be different" }, { status: 400 });
    }

    // 1. Get user's assigned location(s)
    const { data: assignments, error: assignError } = await supabaseAdmin
      .from("location_assignments")
      .select("location_id")
      .eq("user_id", userId);

    if (assignError) throw assignError;
    if (!assignments || assignments.length === 0) {
      return NextResponse.json({ error: "User has no assigned locations" }, { status: 403 });
    }

    const locationIds = assignments.map((a) => a.location_id);

    // 2. Find a location where source product has enough stock
    const { data: sourceStock, error: sourceStockError } = await supabaseAdmin
      .from("product_stocks")
      .select("id, quantity, location_id")
      .eq("product_id", sourceProductId)
      .in("location_id", locationIds)
      .gte("quantity", sourceQuantity)
      .limit(1)
      .single();

    if (sourceStockError || !sourceStock) {
      return NextResponse.json({ error: "Insufficient stock for conversion in assigned locations" }, { status: 400 });
    }

    const targetLocationId = sourceStock.location_id;

    // 3. Deduct from source product
    const newSourceQuantity = sourceStock.quantity - sourceQuantity;
    const { error: deductError } = await supabaseAdmin
      .from("product_stocks")
      .update({ quantity: newSourceQuantity })
      .eq("id", sourceStock.id);

    if (deductError) throw deductError;

    let finalTargetProductId = targetProductId;

    if (createNewProduct && newProductDetails) {
      const { data: sourceP, error: sourcePError } = await supabaseAdmin
        .from("products")
        .select("*")
        .eq("id", sourceProductId)
        .single();
        
      if (sourcePError || !sourceP) throw new Error("Failed to load source product for duplication");

      const prefix = (sourceP.supplier_name || "XX").substring(0, 2).toUpperCase();
      const { data: existingSkus } = await supabaseAdmin
        .from("products")
        .select("sku")
        .ilike("sku", `${prefix}-%`);

      let maxNum = 0;
      if (existingSkus && existingSkus.length > 0) {
        existingSkus.forEach((item) => {
          if (item.sku) {
            const parts = item.sku.split("-");
            const numPart = parseInt(parts[parts.length - 1], 10);
            if (!isNaN(numPart) && numPart > maxNum) {
              maxNum = numPart;
            }
          }
        });
      }
      const newSku = `${prefix}-${(maxNum + 1).toString().padStart(4, "0")}`;

      const { id: _, created_at: __, ...sourceProductDataWithoutId } = sourceP;

      const newCostPrice = sourceP.cost_price
        ? parseFloat(((sourceP.cost_price * sourceQuantity) / targetQuantity).toFixed(2))
        : 0;

      const newActualCostPrice = sourceP.actual_cost_price
        ? parseFloat(((sourceP.actual_cost_price * sourceQuantity) / targetQuantity).toFixed(2))
        : newCostPrice;

      const newMrp = sourceP.mrp
        ? parseFloat(((sourceP.mrp * sourceQuantity) / targetQuantity).toFixed(2))
        : newProductDetails.sellingPrice;

      const { data: newTargetProduct, error: newProductError } = await supabaseAdmin
        .from("products")
        .insert({
          ...sourceProductDataWithoutId,
          sku: newSku,
          name: newProductDetails.name.trim(),
          unit_of_measure: newProductDetails.unitOfMeasure,
          selling_price: newProductDetails.sellingPrice,
          retail_price: newProductDetails.retailPrice ?? null,
          retail_only: true,
          company_code: null,
          cost_price: newCostPrice,
          actual_cost_price: newActualCostPrice,
          mrp: newMrp,
          stock_quantity: 0,
        })
        .select("id")
        .single();

      if (newProductError) {
        await supabaseAdmin.from("product_stocks").update({ quantity: sourceStock.quantity }).eq("id", sourceStock.id);
        throw new Error("Failed to create new target product: " + newProductError.message);
      }
      
      finalTargetProductId = newTargetProduct.id;
    }

    // 4. Add to target product
    // Check if target product stock already exists at this location
    const { data: targetStock, error: targetStockSearchError } = await supabaseAdmin
      .from("product_stocks")
      .select("id, quantity")
      .eq("product_id", finalTargetProductId)
      .eq("location_id", targetLocationId)
      .maybeSingle();

    if (targetStockSearchError) throw targetStockSearchError;

    if (targetStock) {
      // Update existing stock
      const { error: updateTargetError } = await supabaseAdmin
        .from("product_stocks")
        .update({ quantity: targetStock.quantity + targetQuantity })
        .eq("id", targetStock.id);
      
      if (updateTargetError) {
        // Rollback attempt
        await supabaseAdmin.from("product_stocks").update({ quantity: sourceStock.quantity }).eq("id", sourceStock.id);
        throw updateTargetError;
      }
    } else {
      // Insert new stock
      const { error: insertTargetError } = await supabaseAdmin
        .from("product_stocks")
        .insert({
          product_id: finalTargetProductId,
          location_id: targetLocationId,
          quantity: targetQuantity,
        });
        
      if (insertTargetError) {
        // Rollback attempt
        await supabaseAdmin.from("product_stocks").update({ quantity: sourceStock.quantity }).eq("id", sourceStock.id);
        throw insertTargetError;
      }
    }

    // Inter-branch billing: record the conversion as an internal order so the
    // agency's monthly bill includes the consumed source stock at cost price.
    try {
      const { data: sourceProduct } = await supabaseAdmin
        .from("products")
        .select("supplier_name, cost_price")
        .eq("id", sourceProductId)
        .single();

      if (sourceProduct?.supplier_name) {
        // Find or auto-create an internal customer in CHAMPIKA_RETAIL for conversions
        const { data: existingCustomer } = await supabaseAdmin
          .from("customers")
          .select("id")
          .eq("business_id", BUSINESS_IDS.CHAMPIKA_RETAIL)
          .ilike("shop_name", "%Internal - Stock Conversion%")
          .maybeSingle();

        let internalCustomerId = existingCustomer?.id;

        if (!internalCustomerId) {
          const { data: created } = await supabaseAdmin
            .from("customers")
            .insert({
              shop_name: "Internal - Stock Conversion",
              owner_name: "Champika Hardware",
              phone: "",
              address: "Internal",
              route: "Internal",
              status: "Active",
              credit_limit: 99999999,
              outstanding_balance: 0,
              business_id: BUSINESS_IDS.CHAMPIKA_RETAIL,
            })
            .select("id")
            .single();
          internalCustomerId = created?.id;
        }

        if (internalCustomerId) {
          const costPrice = Number(sourceProduct.cost_price) || 0;
          const totalCost = costPrice * sourceQuantity;
          const today = new Date().toISOString().split("T")[0];

          const { data: convOrder } = await supabaseAdmin
            .from("orders")
            .insert({
              order_id: `SC-${Date.now()}`,
              customer_id: internalCustomerId,
              business_id: BUSINESS_IDS.CHAMPIKA_RETAIL,
              total_amount: totalCost,
              status: "Delivered",
              notes: `Stock Conversion: ${sourceQuantity}x [${sourceProductId}] → ${targetQuantity}x [${finalTargetProductId}]`,
              order_date: today,
            })
            .select("id")
            .single();

          if (convOrder) {
            await supabaseAdmin.from("order_items").insert({
              order_id: convOrder.id,
              product_id: sourceProductId,
              quantity: sourceQuantity,
              unit_price: costPrice,
              total_price: totalCost,
              free_quantity: 0,
              commission_earned: 0,
            });

            await triggerAgencyBillsForInvoice(BUSINESS_IDS.CHAMPIKA_RETAIL, [sourceProductId]);
          }
        }
      }
    } catch (billingError) {
      console.error("[StockConversion] Inter-branch billing trigger failed:", billingError);
      // Non-critical — don't fail the conversion itself
    }

    // Optional: Log activity
    const { data: userProfile } = await supabaseAdmin
      .from("users")
      .select("full_name")
      .eq("id", userId)
      .single();
      
    await supabaseAdmin.from("activity_records").insert({
      user_id: userId,
      user_name: userProfile?.full_name || "Unknown User",
      role: "RETAIL_OFFICER", // Generic fallback
      action: "STOCK_CONVERSION",
      details: `Converted ${sourceQuantity} unit(s) of [${sourceProductId}] to ${targetQuantity} unit(s) of [${finalTargetProductId}].`,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Stock Conversion RPC Error:", error);
    return NextResponse.json({ error: error.message || "Failed to convert stock" }, { status: 500 });
  }
}
