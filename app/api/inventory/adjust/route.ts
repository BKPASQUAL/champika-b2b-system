import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { locationId, items, reason, businessId } = body;

    // Validation: Must have location and items array
    if (!locationId || !items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "Invalid data format" },
        { status: 400 },
      );
    }

    // Process each item in the batch
    for (const item of items) {
      const { productId, newQuantity } = item;

      // 1. Get previous quantity for Audit Log
      const { data: oldStock } = await supabaseAdmin
        .from("product_stocks")
        .select("quantity")
        .eq("location_id", locationId)
        .eq("product_id", productId)
        .single();

      const previousQty = oldStock?.quantity || 0;
      const qtyToSave = Math.max(0, Number(newQuantity));

      // 2. Update the Stock
      const { error: updateError } = await supabaseAdmin
        .from("product_stocks")
        .upsert(
          {
            location_id: locationId,
            product_id: productId,
            quantity: qtyToSave,
            last_updated: new Date().toISOString(),
          },
          { onConflict: "location_id,product_id" },
        );

      if (updateError) {
        console.error(`Error updating product ${productId}:`, updateError);
        throw new Error(`Failed to update product ${productId}`);
      }

      // 3. Create Audit Log Entry
      await supabaseAdmin.from("audit_logs").insert({
        table_name: "product_stocks",
        record_id: productId,
        action: "ADJUSTMENT",
        old_data: { quantity: previousQty },
        new_data: {
          quantity: qtyToSave,
          locationId,
          reason,
          businessId,
        },
        changed_at: new Date().toISOString(),
      });
    }

    return NextResponse.json({
      success: true,
      message: "Stock adjusted successfully",
    });
  } catch (error: any) {
    console.error("Adjustment Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
