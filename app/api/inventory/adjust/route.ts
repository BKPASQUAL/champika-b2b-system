import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function POST(request: NextRequest) {
  try {
    const { locationId, items } = await request.json();

    if (!locationId || !items || !Array.isArray(items)) {
      return NextResponse.json({ error: "Invalid data" }, { status: 400 });
    }

    // Process adjustments - Stock Take (Overwrite Quantity)
    for (const item of items) {
      const { productId, newQuantity } = item;

      // Ensure we don't save negative numbers
      const qtyToSave = Math.max(0, Number(newQuantity));

      // Update the stock quantity
      const { error } = await supabaseAdmin
        .from("product_stocks")
        .update({
          quantity: qtyToSave,
          last_updated: new Date().toISOString(),
        })
        .eq("location_id", locationId)
        .eq("product_id", productId);

      if (error) {
        console.error(`Error updating product ${productId}:`, error);
        throw error;
      }
    }

    return NextResponse.json({
      success: true,
      message: "Stock adjusted successfully",
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
