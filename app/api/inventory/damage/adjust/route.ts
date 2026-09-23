import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { locationId, items, reason, businessId } = body;

    // Validation
    if (!locationId || !items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "Invalid data format: Missing location or items list" },
        { status: 400 }
      );
    }

    const {
      data: { user },
    } = await supabaseAdmin.auth.getUser();

    // Fetch Location for Business ID resolution
    const { data: locationData } = await supabaseAdmin
      .from("locations")
      .select("id, name, business_id")
      .eq("id", locationId)
      .single();

    const finalBusinessId = locationData?.business_id || businessId;

    const results = [];
    const errors = [];

    for (const item of items) {
      const { productId, newDamagedQuantity, itemReason } = item;
      const targetQty = Math.max(0, Number(newDamagedQuantity));

      // 1. Get current stock
      let { data: stock } = await supabaseAdmin
        .from("product_stocks")
        .select("id, quantity, damaged_quantity")
        .eq("location_id", locationId)
        .eq("product_id", productId)
        .maybeSingle();

      if (!stock) {
        const { data: newStock, error: stockCreateErr } = await supabaseAdmin
          .from("product_stocks")
          .insert({
            location_id: locationId,
            product_id: productId,
            quantity: 0,
            damaged_quantity: 0,
          })
          .select("id, quantity, damaged_quantity")
          .single();

        if (stockCreateErr || !newStock) {
          errors.push(`Stock record not found for product ${productId}`);
          continue;
        }
        stock = newStock;
      }

      const previousDamagedQty = Number(stock.damaged_quantity || 0);
      const diff = targetQty - previousDamagedQty;

      // 2. Update Location Damaged Stock
      const { error: updateError } = await supabaseAdmin
        .from("product_stocks")
        .update({
          damaged_quantity: targetQty,
          last_updated: new Date().toISOString(),
        })
        .eq("id", stock.id);

      if (updateError) {
        console.error(`Error updating damaged stock for product ${productId}:`, updateError);
        errors.push(`Failed to update damaged stock for product ${productId}`);
        continue;
      }

      // 3. Update Master Catalog Damaged Stock
      const { data: product } = await supabaseAdmin
        .from("products")
        .select("id, name, damaged_quantity")
        .eq("id", productId)
        .single();

      if (product) {
        const masterDamaged = Math.max(
          0,
          Number(product.damaged_quantity || 0) + diff
        );
        await supabaseAdmin
          .from("products")
          .update({ damaged_quantity: masterDamaged })
          .eq("id", productId);
      }

      // 4. Generate Adjustment Log Entry in inventory_returns
      const adjNumber = `ADJ-DMG-${Date.now().toString().slice(-6)}-${Math.floor(
        Math.random() * 1000
      )}`;

      const noteText = itemReason || reason || "Damaged Stock Adjustment / Re-adjustment";
      const diffText = diff >= 0 ? `+${diff}` : `${diff}`;

      await supabaseAdmin.from("inventory_returns").insert({
        return_number: adjNumber,
        product_id: productId,
        location_id: locationId,
        business_id: finalBusinessId || null,
        customer_id: null,
        quantity: targetQty,
        return_type: "Damage",
        reason: `[Adjustment (${diffText} units)] ${noteText}`.trim(),
        returned_by: user?.id || null,
        status: "Completed",
      });

      // 5. Audit Log Entry
      await supabaseAdmin.from("audit_logs").insert({
        table_name: "product_stocks",
        record_id: productId,
        action: "DAMAGED_STOCK_ADJUSTMENT",
        old_data: { damaged_quantity: previousDamagedQty },
        new_data: {
          damaged_quantity: targetQty,
          difference: diff,
          locationId,
          reason: noteText,
          businessId: finalBusinessId,
        },
        changed_at: new Date().toISOString(),
      });

      // 6. Transaction Log
      if (product) {
        await supabaseAdmin.from("account_transactions").insert({
          transaction_type: "INVENTORY_DAMAGE_ADJUST",
          transaction_no: adjNumber,
          description: `Damaged Stock Adjustment for ${product.name}: was ${previousDamagedQty}, now ${targetQty} (${diffText}). ${noteText}`,
          amount: 0,
          transaction_date: new Date().toISOString(),
          business_id: finalBusinessId || null,
          metadata: {
            location_id: locationId,
            product_id: productId,
            previous_damaged_quantity: previousDamagedQty,
            new_damaged_quantity: targetQty,
            difference: diff,
            reason: noteText,
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
      message: "Damaged stock adjusted successfully",
    });
  } catch (error: any) {
    console.error("Damaged Stock Adjustment Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
