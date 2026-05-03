import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

/**
 * POST /api/admin/fix-item-costs
 * Backfills actual_unit_cost for all order_items where it is NULL or 0.
 * Uses the product's current actual_cost_price → cost_price as the best
 * available approximation for invoices that were edited before the fix.
 */
export async function POST() {
  try {
    // 1. Fetch all affected order_items (NULL or 0 cost)
    const { data: items, error: itemsError } = await supabaseAdmin
      .from("order_items")
      .select("id, product_id, actual_unit_cost")
      .or("actual_unit_cost.is.null,actual_unit_cost.eq.0");

    if (itemsError) throw itemsError;
    if (!items || items.length === 0) {
      return NextResponse.json({ message: "No items need fixing.", fixed: 0 });
    }

    // 2. Collect unique product IDs
    const productIds = [...new Set(items.map((i: any) => i.product_id))];

    // 3. Fetch costs for those products
    const { data: products, error: prodError } = await supabaseAdmin
      .from("products")
      .select("id, actual_cost_price, cost_price")
      .in("id", productIds);

    if (prodError) throw prodError;

    const costMap: Record<string, number> = {};
    for (const p of products ?? []) {
      costMap[p.id] = Number(p.actual_cost_price) || Number(p.cost_price) || 0;
    }

    // 4. Update each affected item in batches of 100
    let fixed = 0;
    let skipped = 0;
    const BATCH = 100;

    for (let i = 0; i < items.length; i += BATCH) {
      const batch = items.slice(i, i + BATCH);

      for (const item of batch) {
        const cost = costMap[item.product_id] ?? 0;
        if (cost === 0) {
          skipped++;
          continue;
        }
        const { error: updateError } = await supabaseAdmin
          .from("order_items")
          .update({ actual_unit_cost: cost })
          .eq("id", item.id);

        if (updateError) {
          console.error(`Failed to update item ${item.id}:`, updateError);
        } else {
          fixed++;
        }
      }
    }

    return NextResponse.json({
      message: `Done. Fixed ${fixed} items. Skipped ${skipped} (product cost also 0).`,
      total: items.length,
      fixed,
      skipped,
    });
  } catch (error: any) {
    console.error("fix-item-costs error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
