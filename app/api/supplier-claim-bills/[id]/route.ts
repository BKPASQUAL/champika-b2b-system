// One supplier claim bill (discount only — no stock, no supplier payment)
//   GET    → bill with items
//   DELETE → remove bill

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { revertClaimCosts } from "@/lib/supplier-claim-costs";
import { rebuildFifoCostsSafe } from "@/lib/fifo-rebuild";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const { data: bill, error } = await supabaseAdmin
      .from("supplier_claim_bills")
      .select(
        `*, supplier:suppliers (id, name),
         items:supplier_claim_bill_items (*, product:products (id, name, sku, selling_price, actual_cost_price, cost_price))`,
      )
      .eq("id", id)
      .single();
    if (error) throw error;

    return NextResponse.json({
      id: bill.id,
      claimNo: bill.claim_no,
      businessId: bill.business_id,
      supplierId: bill.supplier_id,
      supplierName: bill.supplier?.name || "—",
      claimDate: bill.claim_date,
      periodFrom: bill.period_from,
      periodTo: bill.period_to,
      grossTotal: Number(bill.gross_total) || 0,
      discountPercent: Number(bill.discount_percent) || 0,
      discountAmount: Number(bill.discount_amount) || 0,
      notes: bill.notes,
      items: (bill.items || [])
        .map((i: any) => {
          const costBefore =
            i.cost_before != null
              ? Number(i.cost_before)
              : Number(i.product?.actual_cost_price) || Number(i.product?.cost_price) || 0;
          return {
            id: i.id,
            productId: i.product_id,
            name: i.product?.name || "Unknown",
            sku: i.product?.sku || "",
            quantity: Number(i.quantity) || 0,
            unitPrice: Number(i.unit_price) || 0,
            grossValue: Number(i.gross_value) || 0,
            discountAmount: Number(i.discount_amount) || 0,
            discountPerUnit: Number(i.discount_per_unit) || 0,
            costBefore,
            costAfter: costBefore - (Number(i.discount_per_unit) || 0),
          };
        })
        .sort((a: any, b: any) => b.grossValue - a.grossValue),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    // Put the invoice line costs back before removing the claim
    const { data: claimItems } = await supabaseAdmin
      .from("supplier_claim_bill_items")
      .select("product_id")
      .eq("claim_bill_id", id);
    const restored = await revertClaimCosts(id);
    const { error } = await supabaseAdmin.from("supplier_claim_bills").delete().eq("id", id);
    if (error) throw error;
    await rebuildFifoCostsSafe((claimItems || []).map((i: any) => i.product_id));
    return NextResponse.json({ success: true, linesRestored: restored });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
