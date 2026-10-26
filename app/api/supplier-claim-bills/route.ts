// Supplier monthly claim bills (Orange "Document Discount" bills)
// Discount only — no stock movement, no supplier payment.
//   GET  ?businessId=…            → list claim bills
//   POST                          → create a claim bill with items

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { z } from "zod";
import { applyClaimCosts, revertClaimCosts } from "@/lib/supplier-claim-costs";

export const dynamic = "force-dynamic";

const itemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().positive(),
  unitPrice: z.number().min(0),
  costBefore: z.number().optional().nullable(),
});

const claimSchema = z.object({
  businessId: z.string().min(1, "Business is required"),
  supplierId: z.string().min(1, "Supplier is required"),
  claimNo: z.string().min(1, "Claim bill number is required"),
  claimDate: z.string().min(1),
  periodFrom: z.string().min(1, "Period is required"),
  periodTo: z.string().min(1, "Period is required"),
  discountPercent: z.number().min(0).max(100),
  // Exact discount amount printed on the claim bill (overrides % × gross if given)
  discountAmount: z.number().min(0).optional().nullable(),
  notes: z.string().optional().nullable(),
  items: z.array(itemSchema).min(1, "Add at least one item"),
});

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

    const lines = val.items.map((i) => ({ ...i, gross: i.quantity * i.unitPrice }));
    const grossTotal = lines.reduce((s, l) => s + l.gross, 0);
    const discountAmount =
      val.discountAmount != null && val.discountAmount > 0
        ? val.discountAmount
        : (grossTotal * val.discountPercent) / 100;

    const { data: bill, error: billErr } = await supabaseAdmin
      .from("supplier_claim_bills")
      .insert({
        claim_no: val.claimNo,
        business_id: val.businessId,
        supplier_id: val.supplierId,
        claim_date: val.claimDate,
        period_from: val.periodFrom,
        period_to: val.periodTo,
        gross_total: grossTotal,
        discount_percent: val.discountPercent,
        discount_amount: discountAmount,
        notes: val.notes || null,
      })
      .select()
      .single();
    if (billErr) throw billErr;

    // Spread the document discount over the lines by value
    const rows = lines.map((l) => {
      const share = grossTotal > 0 ? (l.gross / grossTotal) * discountAmount : 0;
      return {
        claim_bill_id: bill.id,
        product_id: l.productId,
        quantity: l.quantity,
        unit_price: l.unitPrice,
        gross_value: l.gross,
        discount_amount: share,
        discount_per_unit: l.quantity > 0 ? share / l.quantity : 0,
        cost_before: l.costBefore ?? null,
      };
    });

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

    return NextResponse.json({ id: bill.id, discountAmount, ...applied }, { status: 201 });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
