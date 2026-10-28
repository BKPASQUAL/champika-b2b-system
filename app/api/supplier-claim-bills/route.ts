// Supplier monthly claim bills (Orange "Document Discount" bills)
// Discount only — no stock movement, no supplier payment.
//   GET  ?businessId=…            → list claim bills
//   POST                          → create a claim bill with items

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { z } from "zod";
import { applyClaimCosts, revertClaimCosts } from "@/lib/supplier-claim-costs";
import { rebuildFifoCostsSafe } from "@/lib/fifo-rebuild";
import { buildClaimRows, claimSchema } from "@/lib/supplier-claim-input";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get("businessId");

    let q = supabaseAdmin
      .from("supplier_claim_bills")
      .select(
        `*, supplier:suppliers (id, name),
         items:supplier_claim_bill_items (id, quantity)`,
      )
      .order("period_from", { ascending: false });
    if (businessId) q = q.eq("business_id", businessId);

    const { data, error } = await q;
    if (error) throw error;

    // How much of each claim was really placed on cost
    //   applied = on purchases in the period, sold = on customer invoices, rest = still in stock
    const ids = (data || []).map((c: any) => c.id);
    const applied: Record<string, { applied: number; sold: number }> = {};
    for (let i = 0; i < ids.length; i += 50) {
      let start = 0;
      while (true) {
        const { data: adj, error: ae } = await supabaseAdmin
          .from("supplier_claim_cost_adjustments")
          .select("claim_bill_id, target_type, units, reduction_per_unit")
          .in("claim_bill_id", ids.slice(i, i + 50))
          .in("target_type", ["purchase_item", "order_item"])
          .order("id")
          .range(start, start + 999);
        if (ae) throw ae;
        (adj || []).forEach((a: any) => {
          const v = (Number(a.units) || 0) * (Number(a.reduction_per_unit) || 0);
          const g = (applied[a.claim_bill_id] ||= { applied: 0, sold: 0 });
          if (a.target_type === "purchase_item") g.applied += v;
          else g.sold += v;
        });
        if (!adj || adj.length < 1000) break;
        start += 1000;
      }
    }

    return NextResponse.json(
      (data || []).map((c: any) => ({
        id: c.id,
        claimNo: c.claim_no,
        businessId: c.business_id,
        supplierId: c.supplier_id,
        supplierName: c.supplier?.name || "—",
        claimDate: c.claim_date,
        periodFrom: c.period_from,
        periodTo: c.period_to,
        grossTotal: Number(c.gross_total) || 0,
        discountPercent: Number(c.discount_percent) || 0,
        discountAmount: Number(c.discount_amount) || 0,
        notes: c.notes,
        itemCount: c.items?.length || 0,
        totalQty: (c.items || []).reduce((s: number, i: any) => s + (Number(i.quantity) || 0), 0),
        appliedAmount: applied[c.id]?.applied || 0,
        appliedToSold: Math.min(applied[c.id]?.sold || 0, applied[c.id]?.applied || 0),
        appliedToStock: Math.max(0, (applied[c.id]?.applied || 0) - (applied[c.id]?.sold || 0)),
        notAppliedAmount: Math.max(0, (Number(c.discount_amount) || 0) - (applied[c.id]?.applied || 0)),
      })),
    );
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const val = claimSchema.parse(await request.json());
    if (val.periodTo < val.periodFrom) {
      return NextResponse.json({ error: "Period end is before period start" }, { status: 400 });
    }

    const { data: dup } = await supabaseAdmin
      .from("supplier_claim_bills")
      .select("id")
      .eq("supplier_id", val.supplierId)
      .eq("claim_no", val.claimNo)
      .maybeSingle();
    if (dup) {
      return NextResponse.json({ error: "This claim bill number already exists for this supplier." }, { status: 409 });
    }

    const { header, itemRows, discountAmount } = buildClaimRows(val);

    const { data: bill, error: billErr } = await supabaseAdmin
      .from("supplier_claim_bills")
      .insert(header)
      .select()
      .single();
    if (billErr) throw billErr;

    // Document discount spread over the lines by value
    const rows = itemRows(bill.id);

    const { error: itemsErr } = await supabaseAdmin.from("supplier_claim_bill_items").insert(rows);
    if (itemsErr) {
      await supabaseAdmin.from("supplier_claim_bills").delete().eq("id", bill.id);
      throw itemsErr;
    }

    // Lower the actual cost of the units sold in the claim period
    let applied;
    try {
      applied = await applyClaimCosts(bill.id);
    } catch (e) {
      // Undo everything so a half-applied claim is never left behind
      await revertClaimCosts(bill.id).catch(() => {});
      await supabaseAdmin.from("supplier_claim_bills").delete().eq("id", bill.id);
      throw e;
    }

    // Spread the claim over the invoice lines that really used that stock (FIFO)
    await rebuildFifoCostsSafe(rows.map((r: any) => r.product_id));

    return NextResponse.json({ id: bill.id, discountAmount, ...applied }, { status: 201 });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
