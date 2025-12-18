import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

// GET: Fetch Damage History (Internal Returns where customer_id is NULL)
export async function GET(request: NextRequest) {
  try {
    const { data, error } = await supabaseAdmin
      .from("inventory_returns")
      .select(
        `
        id, 
        return_number, 
        quantity, 
        reason, 
        created_at, 
        products (name, sku),
        locations (name),
        profiles (full_name)
      `
      )
      .is("customer_id", null) // Filter for internal damages only
      .eq("return_type", "Damage")
      .order("created_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST: Create New Damage Report
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { locationId, items, reason } = body;

    if (!locationId || !items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "Invalid payload: Missing location or items" },
        { status: 400 }
      );
    }

    const {
      data: { user },
    } = await supabaseAdmin.auth.getUser();

    // --- FIX: Fetch the Business ID from the Location ---
    const { data: locationData, error: locError } = await supabaseAdmin
      .from("locations")
      .select("business_id")
      .eq("id", locationId)
      .single();

    if (locError || !locationData || !locationData.business_id) {
      return NextResponse.json(
        {
          error:
            "Invalid Location: Could not determine Business ID associated with this location.",
        },
        { status: 400 }
      );
    }

    const businessId = locationData.business_id;
    // ----------------------------------------------------

    const results = [];
    const errors = [];

    // Process each item
    for (const item of items) {
      const { productId, quantity, damageType } = item;

      if (!productId || quantity <= 0) {
        errors.push(`Invalid data for product ID ${productId}`);
        continue;
      }

      // 1. Get Current Stock
      const { data: stock, error: stockError } = await supabaseAdmin
        .from("product_stocks")
        .select("id, quantity, damaged_quantity")
        .eq("location_id", locationId)
        .eq("product_id", productId)
        .single();

      if (stockError || !stock) {
        errors.push(`Stock record not found for product ${productId}`);
        continue;
      }

      if (Number(stock.quantity) < Number(quantity)) {
        errors.push(
          `Insufficient good stock for product ${productId}. Available: ${stock.quantity}`
        );
        continue;
      }

      // 2. Generate Report ID
      const returnNumber = `DMG-${Date.now().toString().slice(-6)}-${Math.floor(
        Math.random() * 1000
      )}`;

      // 3. Insert into inventory_returns (The Damage Report Table)
      const { error: insertError } = await supabaseAdmin
        .from("inventory_returns")
        .insert({
          return_number: returnNumber,
          product_id: productId,
          location_id: locationId,
          business_id: businessId, // <--- Fixed: Using actual business_id from location
          customer_id: null, // INTERNAL DAMAGE
          quantity: quantity,
          return_type: "Damage",
          reason: `[${damageType}] ${reason || ""}`.trim(),
          returned_by: user?.id,
          status: "Completed",
        });

      if (insertError) {
        console.error("Insert Error for Product:", productId, insertError);
        errors.push(
          `Failed to record damage for product ${productId}: ${insertError.message}`
        );
        continue;
      }

      // 4. Update Location Stock (Move Good -> Damaged)
      const newGoodQty = Number(stock.quantity) - Number(quantity);
      const newDamageQty =
        Number(stock.damaged_quantity || 0) + Number(quantity);

      await supabaseAdmin
        .from("product_stocks")
        .update({
          quantity: newGoodQty,
          damaged_quantity: newDamageQty,
          last_updated: new Date().toISOString(),
        })
        .eq("id", stock.id);

      // 5. Update Master Product Catalog
      const { data: product } = await supabaseAdmin
        .from("products")
        .select("stock_quantity, damaged_quantity, name")
        .eq("id", productId)
        .single();

      if (product) {
        const masterGood = Math.max(
          0,
          Number(product.stock_quantity || 0) - Number(quantity)
        );
        const masterBad =
          Number(product.damaged_quantity || 0) + Number(quantity);

        await supabaseAdmin
          .from("products")
          .update({
            stock_quantity: masterGood,
            damaged_quantity: masterBad,
          })
          .eq("id", productId);

        // 6. Log Transaction
        await supabaseAdmin.from("account_transactions").insert({
          transaction_type: "INVENTORY_DAMAGE",
          transaction_no: returnNumber,
          description: `Internal Damage (${damageType}): ${quantity} units of ${
            product.name
          }. ${reason || ""}`,
          amount: 0,
          transaction_date: new Date().toISOString(),
          business_id: businessId, // Included here as well
          metadata: {
            location_id: locationId,
            product_id: productId,
            quantity: quantity,
            damage_type: damageType,
            reported_by: user?.id || "admin",
          },
        });
      }

      results.push(productId);
    }

    if (errors.length > 0 && results.length === 0) {
      return NextResponse.json({ error: errors.join(", ") }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      processed: results.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error: any) {
    console.error("Damage API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
