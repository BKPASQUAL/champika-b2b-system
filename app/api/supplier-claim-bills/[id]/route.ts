// One supplier claim bill (discount only — no stock, no supplier payment)
//   GET    → bill with items
//   PUT    → edit bill (undo old discount, apply new one)
//   DELETE → remove bill

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { z } from "zod";
import { applyClaimCosts, revertClaimCosts } from "@/lib/supplier-claim-costs";
import { rebuildFifoCostsSafe } from "@/lib/fifo-rebuild";
import { buildClaimRows, claimSchema } from "@/lib/supplier-claim-input";

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

    // Where the discount went: purchase bills it matched, unsold stock, and the
    // customer invoices (FIFO) that sold that stock.
    const { data: adj } = await supabaseAdmin
      .from("supplier_claim_cost_adjustments")
      .select("target_type, target_id, order_id, product_id, units, reduction_per_unit, cost_before")
      .eq("claim_bill_id", id);
    const adjRows = adj || [];

    const piIds = adjRows.filter((a: any) => a.target_type === "purchase_item").map((a: any) => a.target_id);
    const orderIds = [...new Set(adjRows.filter((a: any) => a.target_type === "order_item").map((a: any) => a.order_id))];

    const piMap: Record<string, any> = {};
    for (let i = 0; i < piIds.length; i += 200) {
      const { data } = await supabaseAdmin
        .from("purchase_items")
        .select("id, purchase:purchases (purchase_id, invoice_no, purchase_date)")
        .in("id", piIds.slice(i, i + 200));
      (data || []).forEach((r: any) => (piMap[r.id] = r.purchase));
    }
    const orderMap: Record<string, any> = {};
    for (let i = 0; i < orderIds.length; i += 200) {
      const { data } = await supabaseAdmin
        .from("orders")
        .select("id, order_id, order_date, customer:customers (shop_name), invoices (invoice_no, manual_invoice_no)")
        .in("id", orderIds.slice(i, i + 200) as string[]);
      (data || []).forEach((o: any) => (orderMap[o.id] = o));
    }

    const matchByProduct: Record<string, { purchases: any[]; sales: any[]; stockUnits: number; stockDiscount: number }> = {};
    adjRows.forEach((a: any) => {
      const m = (matchByProduct[a.product_id] ||= { purchases: [], sales: [], stockUnits: 0, stockDiscount: 0 });
      const units = Number(a.units) || 0;
      const cut = Number(a.reduction_per_unit) || 0;
      if (a.target_type === "purchase_item") {
        const p = piMap[a.target_id];
        m.purchases.push({
          purchaseNo: p?.purchase_id || "—",
          billNo: p?.invoice_no || "",
          date: p?.purchase_date ? String(p.purchase_date).slice(0, 10) : "",
          units,
          cutPerUnit: cut,
          costBefore: Number(a.cost_before) || 0,
        });
      } else if (a.target_type === "cost_layer") {
        m.stockUnits += units;
        m.stockDiscount += units * cut;
      } else if (a.target_type === "order_item") {
        const o = orderMap[a.order_id];
        const inv = Array.isArray(o?.invoices) ? o.invoices[0] : o?.invoices;
        m.sales.push({
          invoiceNo: inv?.manual_invoice_no || inv?.invoice_no || o?.order_id || "—",
          date: o?.order_date ? String(o.order_date).slice(0, 10) : "",
          shop: o?.customer?.shop_name || "",
          units,
          cutPerUnit: cut,
          costBefore: Number(a.cost_before) || 0,
          discount: units * cut,
        });
      }
    });
    Object.values(matchByProduct).forEach((m) => {
      m.purchases.sort((x, y) => x.date.localeCompare(y.date));
      m.sales.sort((x, y) => x.date.localeCompare(y.date));
    });

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
            match: matchByProduct[i.product_id] || { purchases: [], sales: [], stockUnits: 0, stockDiscount: 0 },
          };
        })
        .sort((a: any, b: any) => b.grossValue - a.grossValue),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Edit a claim bill: undo its old cost cuts, save the new header + items,
// apply the new cuts, then re-spread FIFO for every product old or new.
// If applying fails, the old bill and its cuts are put back.
export async function PUT(request: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const val = claimSchema.parse(await request.json());
    if (val.periodTo < val.periodFrom) {
      return NextResponse.json({ error: "Period end is before period start" }, { status: 400 });
    }

    const { data: dup } = await supabaseAdmin
      .from("supplier_claim_bills")
      .select("id")
      .eq("supplier_id", val.supplierId)
      .eq("claim_no", val.claimNo)
      .neq("id", id)
      .maybeSingle();
    if (dup) {
      return NextResponse.json({ error: "This claim bill number already exists for this supplier." }, { status: 409 });
    }

    // Keep the old version so it can be restored on failure
    const { data: oldBill, error: obErr } = await supabaseAdmin
      .from("supplier_claim_bills").select("*").eq("id", id).single();
    if (obErr || !oldBill) return NextResponse.json({ error: "Claim bill not found" }, { status: 404 });
    const { data: oldItems } = await supabaseAdmin
      .from("supplier_claim_bill_items").select("*").eq("claim_bill_id", id);

    const { header, itemRows, discountAmount } = buildClaimRows(val);
    const rows = itemRows(id);
    const productIds = [
      ...new Set([...(oldItems || []).map((i: any) => i.product_id), ...rows.map((r) => r.product_id)]),
    ];

    // 1. Undo the old cuts
    await revertClaimCosts(id);

    // 2. Save the new header + items
    const saveVersion = async (h: any, items: any[]) => {
      const { error: hErr } = await supabaseAdmin.from("supplier_claim_bills").update(h).eq("id", id);
      if (hErr) throw hErr;
      const { error: dErr } = await supabaseAdmin.from("supplier_claim_bill_items").delete().eq("claim_bill_id", id);
      if (dErr) throw dErr;
      const { error: iErr } = await supabaseAdmin.from("supplier_claim_bill_items").insert(items);
      if (iErr) throw iErr;
    };

    let applied;
    try {
      await saveVersion(header, rows);
      // 3. Apply the new cuts
      applied = await applyClaimCosts(id);
    } catch (e) {
      // Put the old bill back exactly as it was
      await revertClaimCosts(id).catch(() => {});
      const { id: _bid, created_at: _bc, ...oldHeader } = oldBill as any;
      const oldRows = (oldItems || []).map(({ id: _i, created_at: _c, ...r }: any) => r);
      await saveVersion(oldHeader, oldRows).catch(() => {});
      await applyClaimCosts(id).catch(() => {});
      await rebuildFifoCostsSafe(productIds);
      throw e;
    }

    // 4. Re-spread over the invoice lines that really used that stock (FIFO)
    await rebuildFifoCostsSafe(productIds);

    return NextResponse.json({ id, discountAmount, ...applied });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
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
