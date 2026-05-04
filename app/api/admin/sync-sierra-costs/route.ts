import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

const SIERRA_SUPPLIER = "Sierra Cables Plc";
const BATCH = 200;

export async function POST() {
  try {
    // Fetch all Sierra products where actual_cost_price differs from cost_price (or is null)
    const { data: products, error } = await supabaseAdmin
      .from("products")
      .select("id, cost_price, actual_cost_price")
      .eq("supplier_name", SIERRA_SUPPLIER);

    if (error) throw error;

    const toUpdate = (products ?? []).filter(
      (p) =>
        p.cost_price != null &&
        (p.actual_cost_price == null || Number(p.actual_cost_price) !== Number(p.cost_price))
    );

    let synced = 0;
    const now = new Date().toISOString();

    for (let i = 0; i < toUpdate.length; i += BATCH) {
      const batch = toUpdate.slice(i, i + BATCH);
      for (const p of batch) {
        const { error: upErr } = await supabaseAdmin
          .from("products")
          .update({ actual_cost_price: p.cost_price, updated_at: now })
          .eq("id", p.id);
        if (!upErr) synced++;
      }
    }

    return NextResponse.json({
      message: `Synced actual cost for ${synced} Sierra product${synced !== 1 ? "s" : ""}`,
      synced,
      total: (products ?? []).length,
      skipped: (products ?? []).length - synced - (toUpdate.length - synced),
      alreadyInSync: (products ?? []).length - toUpdate.length,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
