import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { itemIds, supplierId } = body; // Added supplierId requirement

    if (!itemIds || itemIds.length === 0 || !supplierId) {
      return NextResponse.json(
        { error: "Missing items or supplier ID" },
        { status: 400 }
      );
    }

    // 1. Fetch Items to calculate total value & validate
    const { data: items, error: fetchError } = await supabaseAdmin
      .from("inventory_returns")
      .select(
        "id, product_id, location_id, quantity, status, products(cost_price)"
      )
      .in("id", itemIds);

    if (fetchError) throw fetchError;

    // Calculate Batch Totals
    let totalValue = 0;
    const totalQty = items.reduce(
      (sum, item) => sum + Number(item.quantity),
      0
    );

    for (const item of items) {
      // @ts-ignore
      const cost = Number(item.products?.cost_price) || 0;
      totalValue += cost * Number(item.quantity);
    }

    // 2. Generate Return Note Number (e.g., GP-20231201-01)
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const { count } = await supabaseAdmin
      .from("supplier_return_batches")
      .select("*", { count: "exact", head: true });

    const batchNumber = `GP-${dateStr}-${(count || 0) + 1}`;

    // 3. Create the Batch Record
    const { data: batch, error: batchError } = await supabaseAdmin
      .from("supplier_return_batches")
      .insert({
        batch_number: batchNumber,
        supplier_id: supplierId,
        total_items: items.length,
        total_value: totalValue,
        status: "Pending Credit",
      })
      .select()
      .single();

    if (batchError) throw batchError;

    // 4. Update Items: Link to Batch & Reduce Stock
    // We physically reduce stock NOW when sending
    for (const item of items) {
      if (item.status === "Returned" || item.status === "Completed") continue;

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

    // Update Status & Link Batch ID
    const { error: updateError } = await supabaseAdmin
      .from("inventory_returns")
      .update({
        status: "Returned",
        return_batch_id: batch.id,
      })
      .in("id", itemIds);

    if (updateError) throw updateError;

    return NextResponse.json({ success: true, batchNumber });
  } catch (error: any) {
    console.error("Return Stock API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
