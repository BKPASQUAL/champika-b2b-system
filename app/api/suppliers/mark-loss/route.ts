import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { itemIds, reason } = body;

    if (!itemIds || itemIds.length === 0) {
      return NextResponse.json({ error: "No items selected" }, { status: 400 });
    }

    // 1. Fetch Items to validate
    const { data: items, error: fetchError } = await supabaseAdmin
      .from("inventory_returns")
      .select("id, product_id, location_id, quantity, status")
      .in("id", itemIds);

    if (fetchError) throw fetchError;

    // 2. Reduce Stock (Remove from Damaged Quantity)
    // Since this is a business loss, the item is physically destroyed/removed.
    for (const item of items) {
      // Skip if already processed
      if (item.status === "Returned" || item.status === "Business Loss")
        continue;

      // Update Product Master
      const { data: prod } = await supabaseAdmin
        .from("products")
        .select("damaged_quantity")
        .eq("id", item.product_id)
        .single();

      if (prod) {
        await supabaseAdmin
          .from("products")
          .update({
            damaged_quantity: Math.max(
              0,
              (prod.damaged_quantity || 0) - item.quantity
            ),
          })
          .eq("id", item.product_id);
      }

      // Update Location Stock
      if (item.location_id) {
        const { data: stock } = await supabaseAdmin
          .from("product_stocks")
          .select("id, damaged_quantity")
          .eq("product_id", item.product_id)
          .eq("location_id", item.location_id)
          .single();

        if (stock) {
          await supabaseAdmin
            .from("product_stocks")
            .update({
              damaged_quantity: Math.max(
                0,
                (stock.damaged_quantity || 0) - item.quantity
              ),
            })
            .eq("id", stock.id);
        }
      }
    }

    // 3. Update Status to 'Business Loss'
    // We append the reason if one is provided, otherwise just mark the status.
    const updatePayload: any = {
      status: "Business Loss",
    };

    if (reason && reason.trim() !== "") {
      updatePayload.reason = reason; // Or `[Business Loss] ${reason}` if you prefer to keep history
    }

    const { error: updateError } = await supabaseAdmin
      .from("inventory_returns")
      .update(updatePayload)
      .in("id", itemIds);

    if (updateError) throw updateError;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Mark Loss API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
