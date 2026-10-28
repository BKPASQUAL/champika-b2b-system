// app/api/reports/actual-profit/route.ts
//
// Book profit vs Actual profit.
//
// Book (what the bill/rate sheet shows):
//   book profit = paid qty × (selling rate − known cost)
//   known cost  = supplier bill rate per paid unit (no extra discount, no free issue)
//
// Actual (what really happened):
//   actual sales = line total − share of invoice extra discount − share of cash discount
//   actual cost  = (paid + free qty) × FIFO actual unit cost
//                  (FIFO cost already includes supplier extra discount + supplier free issue)
//   actual selling rate = actual sales ÷ (paid + free qty)
//   actual profit = actual sales − actual cost

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { BUSINESS_NAMES } from "@/app/config/business-constants";

export const dynamic = "force-dynamic";

const PAGE = 1000;

async function fetchAll<T = any>(build: (from: number, to: number) => any): Promise<T[]> {
  const out: T[] = [];
  let start = 0;
  while (true) {
    const { data, error } = await build(start, start + PAGE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    out.push(...data);
    if (data.length < PAGE) break;
    start += PAGE;
  }
  return out;
}

const num = (v: any) => (v === null || v === undefined || v === "" ? 0 : Number(v) || 0);

function parseCashDiscount(notes: string | null | undefined): number {
  if (!notes) return 0;
  const m = notes.match(/\[CASH_DISCOUNT_AMOUNT:([\d.]+)\]/);
  return m ? Number(m[1]) || 0 : 0;
}

type Totals = {
  paidQty: number;
  freeQty: number;
  grossSales: number; // paid qty × selling rate
  lineDiscount: number;
  extraDiscount: number;
  cashDiscount: number;
  actualSales: number;
  bookCost: number; // paid qty × known cost
  supplierExtraDiscount: number; // supplier bill extra discount share on paid qty
  supplierFreeBenefit: number; // saving from supplier free items spread over paid qty
  batchDifference: number; // FIFO batch cost vs matched purchase (older/newer stock)
  freeClaimQty: number; // free stock received from supplier on free-claim (zero-cost) purchases
  supplierFreeClaims: number; // value of that free stock at actual cost — reduces cost
  supplierMonthlyClaims: number; // after-month claim discount bills (e.g. Orange document discount) — reduces cost
  actualCostPaid: number; // paid qty × actual cost
  freeIssueCost: number; // free qty × actual cost
  actualCost: number; // (paid + free) × actual cost
  bookProfit: number;
  actualProfit: number;
};

const emptyTotals = (): Totals => ({
  paidQty: 0,
  freeQty: 0,
  grossSales: 0,
  lineDiscount: 0,
  extraDiscount: 0,
  cashDiscount: 0,
  actualSales: 0,
  bookCost: 0,
  supplierExtraDiscount: 0,
  supplierFreeBenefit: 0,
  batchDifference: 0,
  freeClaimQty: 0,
  supplierFreeClaims: 0,
  supplierMonthlyClaims: 0,
  actualCostPaid: 0,
  freeIssueCost: 0,
  actualCost: 0,
  bookProfit: 0,
  actualProfit: 0,
});

function addTotals(a: Totals, b: Totals) {
  (Object.keys(a) as (keyof Totals)[]).forEach((k) => {
    a[k] += b[k];
  });
}

function withRates(t: Totals) {
  const totalQty = t.paidQty + t.freeQty;
  return {
    ...t,
    sellingRate: t.paidQty > 0 ? t.grossSales / t.paidQty : 0,
    actualSellingRate: totalQty > 0 ? t.actualSales / totalQty : 0,
    knownCostRate: t.paidQty > 0 ? t.bookCost / t.paidQty : 0,
    actualCostRate: totalQty > 0 ? t.actualCost / totalQty : 0,
    bookMargin: t.grossSales > 0 ? (t.bookProfit / t.grossSales) * 100 : 0,
    actualMargin: t.actualSales > 0 ? (t.actualProfit / t.actualSales) * 100 : 0,
    profitGap: t.bookProfit - t.actualProfit,
  };
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const now = new Date();
    const defFrom = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
    const defTo = now.toISOString().split("T")[0];

    const from = searchParams.get("from") || defFrom;
    const to = searchParams.get("to") || defTo;
    const businessId = searchParams.get("businessId");
    const excludeInternal = searchParams.get("excludeInternal") !== "false";

    const fromTs = `${from}T00:00:00`;
    const toTs = `${to}T23:59:59.999`;

    // 1. Sold lines (Delivered orders in range)
    const items = await fetchAll((s, e) => {
      let q = supabaseAdmin
        .from("order_items")
        .select(
          `
          id, quantity, free_quantity, unit_price, actual_unit_cost, total_price,
          product:products (id, name, sku, category, supplier_name, cost_price, actual_cost_price),
          order:orders!inner (
            id, order_id, order_date, status, business_id, notes, total_amount, extra_discount_amount,
            customer:customers (id, shop_name),
            invoices (invoice_no, manual_invoice_no)
          )
        `,
        )
        .gte("order.order_date", fromTs)
        .lte("order.order_date", toTs)
        .eq("order.status", "Delivered")
        .order("id", { ascending: true })
        .range(s, e);
      if (businessId && businessId !== "all") q = q.eq("order.business_id", businessId);
      return q;
    });

    // 2. Purchase history → known (bill) cost per product at the time of sale
    const purchaseLines = await fetchAll((s, e) =>
      supabaseAdmin
        .from("purchase_items")
        .select(
          `
          id, product_id, quantity, free_quantity, unit_cost, actual_unit_cost, total_cost,
          discount_percent, discount_amount,
          purchase:purchases!inner (id, purchase_id, invoice_no, purchase_date, business_id, extra_discount,
            supplier:suppliers (name))
        `,
        )
        .order("id", { ascending: true })
        .range(s, e),
    );

    // Purchase cost history per product, sorted by date.
    //   known      = bill value ÷ paid qty                (rate on supplier bill)
    //   afterExtra = (bill value − extra discount) ÷ paid  (after supplier extra discount)
    //   actual     = (bill value − extra discount) ÷ (paid + free)  (after supplier free issue)
    type CostStep = { date: string; known: number; afterExtra: number; actual: number };
    const billHistory: Record<string, CostStep[]> = {};
    purchaseLines.forEach((pl: any) => {
      const paidQ = num(pl.quantity);
      const freeQ = num(pl.free_quantity);
      if (!pl.product_id || paidQ <= 0) return;
      const lineTotal = num(pl.total_cost);
      const known = lineTotal > 0 ? lineTotal / paidQ : num(pl.unit_cost);
      if (known <= 0) return; // free-only purchases carry no bill rate
      const storedActual = num(pl.actual_unit_cost);
      const netValue = storedActual > 0 ? storedActual * (paidQ + freeQ) : known * paidQ;
      const afterExtra = Math.min(known, netValue / paidQ);
      const actual = netValue / (paidQ + freeQ);
      (billHistory[pl.product_id] ||= []).push({
        date: String(pl.purchase?.purchase_date || "").slice(0, 10),
        known,
        afterExtra,
        actual,
      });
    });
    Object.values(billHistory).forEach((h) => h.sort((a, b) => a.date.localeCompare(b.date)));

    // Latest purchase on/before the sale date (or earliest if sold before any purchase)
    const costStepFor = (productId: string, orderDate: string, fallback: number): CostStep => {
      const h = billHistory[productId];
      if (!h || h.length === 0) return { date: "", known: fallback, afterExtra: fallback, actual: fallback };
      let pick = h[0];
      for (const p of h) {
        if (p.date <= orderDate) pick = p;
        else break;
      }
      return pick;
    };

    // Monthly claim discounts already lowered order_items.actual_unit_cost.
    // Read how much per line so the report can show it as its own cost step.
    const claimCutByKey: Record<string, Record<string, number>> = {};
    const claimIdsUsed = new Set<string>(); // claim bills that touched lines in this report
    {
      let start = 0;
      while (true) {
        const { data, error } = await supabaseAdmin
          .from("supplier_claim_cost_adjustments")
          .select("order_id, product_id, claim_bill_id, reduction_per_unit")
          .eq("target_type", "order_item")
          .order("id", { ascending: true })
          .range(start, start + PAGE - 1);
        if (error) break; // table not created yet — report works without it
        if (!data || data.length === 0) break;
        // Keyed by invoice + product + claim (an invoice edit replaces line ids)
        data.forEach((a: any) => {
          const k = `${a.order_id}|${a.product_id}`;
          const perClaim = (claimCutByKey[k] ||= {});
          perClaim[a.claim_bill_id] = Math.max(perClaim[a.claim_bill_id] || 0, num(a.reduction_per_unit));
        });
        if (data.length < PAGE) break;
        start += PAGE;
      }
    }

    // 3. Group lines by order so invoice-level discounts can be spread over lines
    const byOrder: Record<string, any[]> = {};
    items.forEach((it: any) => {
      if (!it.order) return;
      // Only real sales: skip orders without an invoice (e.g. internal stock conversions "SC-…")
      const invs = it.order.invoices;
      if (!invs || (Array.isArray(invs) && invs.length === 0)) return;
      // Skip dummy test products ("Test Item 1", "Test Item 2") — they distort totals
      if (/^test item\b/i.test(String(it.product?.name || "").trim())) return;
      if (excludeInternal) {
        const shop = String(it.order.customer?.shop_name || "").toLowerCase();
        if (shop.includes("champika hardware")) return;
      }
      (byOrder[it.order.id] ||= []).push(it);
    });

    const overall = emptyTotals();
    const productMap: Record<string, { info: any; t: Totals; lossLines: number }> = {};
    const supplierMap: Record<string, Totals> = {};
    const businessMap: Record<string, { t: Totals; invoices: number; lossLines: number }> = {};
    const invoices: any[] = [];
    let lossLines = 0;
    let hiddenLossLines = 0; // book says profit, actual says loss

    Object.values(byOrder).forEach((lines) => {
      const order = lines[0].order;
      const orderDate = String(order.order_date || "").slice(0, 10);
      const subtotal = lines.reduce((s, l) => s + num(l.total_price), 0);
      const extra = num(order.extra_discount_amount);
      const cash = parseCashDiscount(order.notes);
      const inv = Array.isArray(order.invoices) ? order.invoices[0] : order.invoices;

      const ot = emptyTotals();
      let orderLossLines = 0;

      lines.forEach((l: any) => {
        const paid = num(l.quantity);
        const free = num(l.free_quantity);
        const rate = num(l.unit_price);
        const lineTotal = num(l.total_price);
        const share = subtotal > 0 ? lineTotal / subtotal : 0;

        const product = l.product || {};
        const fallbackActual = num(product.actual_cost_price) || num(product.cost_price);
        const actualUnitCost =
          l.actual_unit_cost !== null && l.actual_unit_cost !== undefined
            ? num(l.actual_unit_cost)
            : fallbackActual;
        const step = costStepFor(product.id, orderDate, num(product.cost_price) || actualUnitCost);
        const knownCost = step.known;
        // Cost before the monthly claim discount was taken off this line
        const cuts = claimCutByKey[`${order.id}|${product.id}`] || {};
        const claimCut = Object.values(cuts).reduce((s, v) => s + v, 0);
        const preClaimCost = actualUnitCost + claimCut;
        Object.keys(cuts).forEach((cid) => claimIdsUsed.add(cid));

        const t = emptyTotals();
        t.paidQty = paid;
        t.freeQty = free;
        t.grossSales = paid * rate;
        t.lineDiscount = Math.max(0, t.grossSales - lineTotal);
        t.extraDiscount = share * extra;
        t.cashDiscount = share * cash;
        t.actualSales = lineTotal - t.extraDiscount - t.cashDiscount;
        t.bookCost = paid * knownCost;
        t.supplierExtraDiscount = paid * (step.known - step.afterExtra);
        t.supplierFreeBenefit = paid * (step.afterExtra - step.actual);
        t.actualCostPaid = paid * preClaimCost;
        // Whatever is left: the FIFO batch actually sold cost more/less than the matched purchase
        t.batchDifference =
          t.actualCostPaid - (t.bookCost - t.supplierExtraDiscount - t.supplierFreeBenefit);
        t.freeIssueCost = free * preClaimCost;
        t.supplierMonthlyClaims = (paid + free) * claimCut;
        t.actualCost = t.actualCostPaid + t.freeIssueCost - t.supplierMonthlyClaims;
        t.bookProfit = t.grossSales - t.bookCost;
        t.actualProfit = t.actualSales - t.actualCost;

        if (t.actualProfit < 0) {
          lossLines++;
          orderLossLines++;
          if (t.bookProfit > 0) hiddenLossLines++;
        }

        addTotals(ot, t);

        const pid = product.id || "unknown";
        if (!productMap[pid]) {
          productMap[pid] = {
            info: {
              id: pid,
              name: product.name || "Unknown product",
              sku: product.sku || "",
              category: product.category || "",
              supplier: product.supplier_name || "",
            },
            t: emptyTotals(),
            lossLines: 0,
          };
        }
        addTotals(productMap[pid].t, t);
        if (t.actualProfit < 0) productMap[pid].lossLines++;

        const sup = product.supplier_name || "Unassigned";
        addTotals((supplierMap[sup] ||= emptyTotals()), t);
      });

      addTotals(overall, ot);

      const bKey = order.business_id || "none";
      const b = (businessMap[bKey] ||= { t: emptyTotals(), invoices: 0, lossLines: 0 });
      addTotals(b.t, ot);
      b.invoices += 1;
      b.lossLines += orderLossLines;

      invoices.push({
        business: (BUSINESS_NAMES as Record<string, string>)[order.business_id] || "Unassigned",
        orderId: order.order_id,
        invoiceNo: inv?.manual_invoice_no || inv?.invoice_no || order.order_id,
        date: orderDate,
        customer: order.customer?.shop_name || "Unknown",
        lines: lines.length,
        ...withRates(ot),
      });
    });

    // 4. Purchases in range → known vs actual cost rate (supplier discounts + free issue)
    const purchaseProductNames: Record<string, string> = {};
    Object.values(productMap).forEach((p) => (purchaseProductNames[p.info.id] = p.info.name));

    const purchaseRows: any[] = [];
    const purchaseTotals = { billValue: 0, extraDiscount: 0, netValue: 0, paidQty: 0, freeQty: 0, freeValue: 0 };
    const purchaseInRange = purchaseLines.filter((pl: any) => {
      const d = String(pl.purchase?.purchase_date || "").slice(0, 10);
      if (d < from || d > to) return false;
      if (businessId && businessId !== "all" && pl.purchase?.business_id !== businessId) return false;
      return true;
    });

    const purchaseProductIds = [
      ...new Set(purchaseInRange.map((pl: any) => pl.product_id).filter((id: string) => !!id)),
    ] as string[];
    const productInfo: Record<string, any> = {};
    for (let i = 0; i < purchaseProductIds.length; i += 200) {
      const { data } = await supabaseAdmin
        .from("products")
        .select("id, name, sku, category, supplier_name, cost_price, actual_cost_price")
        .in("id", purchaseProductIds.slice(i, i + 200));
      data?.forEach((p: any) => {
        productInfo[p.id] = p;
        if (!purchaseProductNames[p.id]) purchaseProductNames[p.id] = p.name;
      });
    }

    // Supplier free claims: zero-cost purchase lines (free stock sent by supplier).
    // That stock has no cost layer, so its benefit never shows in FIFO cost —
    // count it here as a cost reduction, valued at the product's actual cost on that date.
    const claimTotals = { qty: 0, value: 0, lines: 0 };
    const applyClaim = (target: Totals, q: number, v: number) => {
      target.freeClaimQty += q;
      target.supplierFreeClaims += v;
      target.actualCost -= v;
      target.actualProfit += v;
    };

    purchaseInRange.forEach((pl: any) => {
      const paid = num(pl.quantity);
      const free = num(pl.free_quantity);
      const totalQty = paid + free;

      const isFreeClaim = num(pl.total_cost) === 0 && num(pl.unit_cost) === 0 && totalQty > 0;
      if (isFreeClaim) {
        const prod = productInfo[pl.product_id] || {};
        const date = String(pl.purchase?.purchase_date || "").slice(0, 10);
        const fallback = num(prod.actual_cost_price) || num(prod.cost_price);
        const rate = billHistory[pl.product_id] ? costStepFor(pl.product_id, date, fallback).actual : fallback;
        const value = totalQty * rate;

        claimTotals.qty += totalQty;
        claimTotals.value += value;
        claimTotals.lines += 1;

        applyClaim(overall, totalQty, value);

        const bKey = pl.purchase?.business_id || "none";
        const b = (businessMap[bKey] ||= { t: emptyTotals(), invoices: 0, lossLines: 0 });
        applyClaim(b.t, totalQty, value);

        const pid = pl.product_id;
        if (!productMap[pid]) {
          productMap[pid] = {
            info: {
              id: pid,
              name: prod.name || "Unknown product",
              sku: prod.sku || "",
              category: prod.category || "",
              supplier: prod.supplier_name || "",
            },
            t: emptyTotals(),
            lossLines: 0,
          };
        }
        applyClaim(productMap[pid].t, totalQty, value);

        const sup = prod.supplier_name || "Unassigned";
        applyClaim((supplierMap[sup] ||= emptyTotals()), totalQty, value);

        purchaseRows.push({
          id: pl.id,
          purchaseId: pl.purchase?.purchase_id,
          invoiceNo: pl.purchase?.invoice_no,
          date,
          supplier: pl.purchase?.supplier?.name || prod.supplier_name || "Unknown",
          productId: pl.product_id,
          product: purchaseProductNames[pl.product_id] || "Unknown product",
          isFreeClaim: true,
          paidQty: 0,
          freeQty: totalQty,
          billRate: 0,
          lineDiscountPercent: 0,
          knownRate: 0,
          billValue: 0,
          extraDiscount: 0,
          netValue: 0,
          actualRate: rate,
          claimValue: value,
          saving: rate,
          savingPercent: 100,
        });
        return;
      }
      // Bill value = line total after line discount, before the bill's extra discount.
      // Stored actual rate = (bill value − extra discount share) ÷ (paid + free).
      const billValue = num(pl.total_cost);
      const actualRate = num(pl.actual_unit_cost);
      const netValue = actualRate * totalQty;
      const knownRate = paid > 0 ? billValue / paid : num(pl.unit_cost);
      const extraOnly = Math.max(0, billValue - netValue);

      purchaseTotals.billValue += billValue;
      purchaseTotals.extraDiscount += extraOnly;
      purchaseTotals.netValue += netValue;
      purchaseTotals.paidQty += paid;
      purchaseTotals.freeQty += free;
      purchaseTotals.freeValue += free * actualRate;

      purchaseRows.push({
        id: pl.id,
        purchaseId: pl.purchase?.purchase_id,
        invoiceNo: pl.purchase?.invoice_no,
        date: String(pl.purchase?.purchase_date || "").slice(0, 10),
        supplier: pl.purchase?.supplier?.name || "Unknown",
        productId: pl.product_id,
        product: purchaseProductNames[pl.product_id] || "Unknown product",
        paidQty: paid,
        freeQty: free,
        billRate: num(pl.unit_cost),
        lineDiscountPercent: num(pl.discount_percent),
        knownRate,
        billValue,
        extraDiscount: extraOnly,
        netValue,
        actualRate,
        saving: knownRate - actualRate,
        savingPercent: knownRate > 0 ? ((knownRate - actualRate) / knownRate) * 100 : 0,
      });
    });
    purchaseRows.sort((a, b) => b.date.localeCompare(a.date));


    const products = Object.values(productMap)
      .map((p) => ({ ...p.info, lossLines: p.lossLines, ...withRates(p.t) }))
      .sort((a, b) => b.actualSales - a.actualSales);

    const suppliers = Object.entries(supplierMap)
      .map(([name, t]) => ({ name, ...withRates(t) }))
      .sort((a, b) => b.actualSales - a.actualSales);

    invoices.sort((a, b) => b.date.localeCompare(a.date));

    const businesses = Object.entries(businessMap)
      .map(([id, b]) => ({
        id,
        name: (BUSINESS_NAMES as Record<string, string>)[id] || "Unassigned",
        invoiceCount: b.invoices,
        lossLines: b.lossLines,
        ...withRates(b.t),
      }))
      .sort((a, b) => b.actualSales - a.actualSales);

    return NextResponse.json({
      from,
      to,
      summary: {
        ...withRates(overall),
        invoiceCount: invoices.length,
        lossLines,
        hiddenLossLines,
        monthlyClaimCount: claimIdsUsed.size,
      },
      businesses,
      products,
      suppliers,
      invoices,
      purchases: {
        totals: {
          ...purchaseTotals,
          freeClaimQty: claimTotals.qty,
          freeClaimValue: claimTotals.value,
          freeClaimLines: claimTotals.lines,
          knownRateAvg: purchaseTotals.paidQty > 0 ? purchaseTotals.billValue / purchaseTotals.paidQty : 0,
          actualRateAvg:
            purchaseTotals.paidQty + purchaseTotals.freeQty > 0
              ? purchaseTotals.netValue / (purchaseTotals.paidQty + purchaseTotals.freeQty)
              : 0,
        },
        rows: purchaseRows,
      },
    });
  } catch (error: any) {
    console.error("Actual profit report error:", error);
    return NextResponse.json({ error: error.message || "Failed to build report" }, { status: 500 });
  }
}
