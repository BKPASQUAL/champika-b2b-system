import { supabaseAdmin } from "@/lib/supabase-admin";

export interface ReturnValue {
  returnNumber: string;
  invoiceNo: string | null;
  date: string; // date the return was made (return month, not invoice month)
  monthKey: string; // YYYY-MM
  value: number; // sales value to deduct
  cost: number; // cost of the returned goods (from the original invoice line)
  commission: number; // commission to deduct
  quantity: number;
  ownerId: string | null; // rep the return is charged to
  businessId: string | null;
  productId: string;
  productName: string;
  sku: string;
  customerId: string | null;
  customer: string;
  supplier: string;
  category: string;
  subCategory: string | null;
}

export type RepReturnValue = ReturnValue & { ownerId: string };

/**
 * True for the LKR 0 pickup / exchange orders created when a return note is approved.
 * They are not sales and must be left out of every sales report.
 */
export function isReturnPickupOrder(notes?: string | null): boolean {
  return /\[(?:RETURN_NOTE|DAMAGE_EXCHANGE|DAMAGE_RETURN):/.test(notes || "");
}

// Unit price saved on the return note ([PRICE:x] tag), else product selling price
function returnUnitPrice(r: any, prod: any): number {
  const m = (r.reason || "").match(/\[PRICE:([\d.]+)\]/);
  const tagged = m ? parseFloat(m[1]) || 0 : 0;
  return tagged || Number(prod?.selling_price) || 0;
}

function returnInvoiceNo(r: any): string | null {
  const m = (r.reason || "").match(/\[INV:([^\]]+)\]/);
  return m ? m[1].trim() : null;
}

/**
 * Office-approved Good/Damage return notes made in a date range, valued at the bill price.
 *
 * - Sales, cost and commission drop in the month the return was made; the
 *   original invoice month stays as it was.
 * - The return is charged to the rep who made the original invoice
 *   (falls back to whoever raised the return when no invoice is linked).
 * - Exchange returns are a stock swap and are skipped.
 * - Returns tagged [INVOICE_ADJUSTED] already reduced the invoice directly,
 *   so they are skipped to avoid deducting twice.
 */
export async function getApprovedReturns(from?: string, to?: string): Promise<ReturnValue[]> {
  let q = supabaseAdmin
    .from("inventory_returns")
    .select(
      "return_number, product_id, quantity, reason, return_type, returned_by, business_id, customer_id, created_at, return_date, products(name, sku, selling_price, supplier_name, category, sub_category), customers(shop_name)"
    )
    // Only return notes that went through office approval. "Completed" records are either
    // goods taken in a payment ([PAY:...]) or old direct returns that already cut the
    // invoice — counting them would deduct the same goods twice.
    .eq("status", "Approved")
    .neq("return_type", "Exchange")
    .not("reason", "ilike", "%[INVOICE_ADJUSTED]%")
    .not("reason", "ilike", "%[PAY:%");
  // created_at can be a little later than return_date, so look back a bit further
  if (from) q = q.gte("created_at", new Date(new Date(from).getTime() - 62 * 86400000).toISOString());
  const { data: rows } = await q;
  if (!rows || rows.length === 0) return [];

  const fromMs = from ? new Date(from).getTime() : -Infinity;
  const toMs = to ? new Date(to).getTime() : Infinity;
  const inRange = rows.filter((r: any) => {
    const ms = new Date(r.return_date || r.created_at).getTime();
    return ms >= fromMs && ms <= toMs;
  });
  if (inRange.length === 0) return [];

  // Map invoice number -> original order (rep + business)
  const invoiceNos = [...new Set(inRange.map(returnInvoiceNo).filter(Boolean))] as string[];
  const invMap = new Map<string, { orderId: string; repId: string | null; businessId: string | null }>();
  if (invoiceNos.length > 0) {
    const list = invoiceNos.map((n) => `"${n.replace(/"/g, "")}"`).join(",");
    const { data: invs } = await supabaseAdmin
      .from("invoices")
      .select("invoice_no, manual_invoice_no, order_id, orders(sales_rep_id, business_id)")
      .or(`invoice_no.in.(${list}),manual_invoice_no.in.(${list})`);
    (invs || []).forEach((inv: any) => {
      const ord = Array.isArray(inv.orders) ? inv.orders[0] : inv.orders;
      const entry = {
        orderId: inv.order_id,
        repId: ord?.sales_rep_id || null,
        businessId: ord?.business_id || null,
      };
      if (inv.invoice_no) invMap.set(inv.invoice_no, entry);
      if (inv.manual_invoice_no && !invMap.has(inv.manual_invoice_no)) invMap.set(inv.manual_invoice_no, entry);
    });
  }

  // Per-unit commission and cost from the original invoice line
  const orderIds = [...new Set([...invMap.values()].map((v) => v.orderId).filter(Boolean))];
  const lineMap = new Map<string, { comm: number; cost: number }>();
  for (let i = 0; i < orderIds.length; i += 100) {
    const { data: items } = await supabaseAdmin
      .from("order_items")
      .select("order_id, product_id, quantity, commission_earned, actual_unit_cost")
      .in("order_id", orderIds.slice(i, i + 100));
    (items || []).forEach((it: any) => {
      const qty = Number(it.quantity) || 0;
      lineMap.set(`${it.order_id}|${it.product_id}`, {
        comm: qty > 0 ? (Number(it.commission_earned) || 0) / qty : 0,
        cost: Number(it.actual_unit_cost) || 0,
      });
    });
  }

  return inRange
    .map((r: any) => {
      const invoiceNo = returnInvoiceNo(r);
      const inv = invoiceNo ? invMap.get(invoiceNo) : undefined;
      const line = inv ? lineMap.get(`${inv.orderId}|${r.product_id}`) : undefined;
      const date = r.return_date || r.created_at;
      const d = new Date(date);
      const qty = Number(r.quantity) || 0;
      const cust = Array.isArray(r.customers) ? r.customers[0] : r.customers;
      const prod = Array.isArray(r.products) ? r.products[0] : r.products;
      return {
        returnNumber: r.return_number,
        invoiceNo,
        date,
        monthKey: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
        value: Math.round(qty * returnUnitPrice(r, prod) * 100) / 100,
        cost: Math.round(qty * (line?.cost || 0) * 100) / 100,
        commission: Math.round(qty * (line?.comm || 0) * 100) / 100,
        quantity: qty,
        ownerId: inv?.repId || r.returned_by || null,
        businessId: inv?.businessId || r.business_id || null,
        productId: r.product_id,
        productName: prod?.name || "Unknown Product",
        sku: prod?.sku || "",
        customerId: r.customer_id || null,
        customer: cust?.shop_name || "Unknown",
        supplier: prod?.supplier_name || "Unknown Supplier",
        category: prod?.category || "Uncategorised",
        subCategory: prod?.sub_category || null,
      };
    })
    .filter((r) => r.value > 0);
}

/** Approved returns for every rep at once (each row has ownerId). */
export async function getAllRepReturns(from?: string, to?: string): Promise<RepReturnValue[]> {
  return (await getApprovedReturns(from, to)).filter((r): r is RepReturnValue => !!r.ownerId);
}

/** Approved returns charged to one rep. */
export async function getRepReturns(repId: string, from?: string, to?: string): Promise<RepReturnValue[]> {
  return (await getAllRepReturns(from, to)).filter((r) => r.ownerId === repId);
}

type BreakdownSupplier = { name: string; sales: number; commission: number; itemsCount: number };
type BreakdownCategory = {
  supplier: string; category: string; subCategory: string | null;
  sales: number; commission: number; itemsCount: number;
};

/** Subtract a return from the supplier and supplier+category breakdown maps. */
export function deductReturnFromBreakdown(
  supplierMap: Record<string, BreakdownSupplier>,
  categoryMap: Record<string, BreakdownCategory>,
  r: ReturnValue
) {
  const { supplier, category, subCategory } = r;
  if (!supplierMap[supplier]) supplierMap[supplier] = { name: supplier, sales: 0, commission: 0, itemsCount: 0 };
  supplierMap[supplier].sales -= r.value;
  supplierMap[supplier].commission -= r.commission;
  supplierMap[supplier].itemsCount -= r.quantity;

  const key = `${supplier}||${category}||${subCategory ?? ""}`;
  if (!categoryMap[key]) categoryMap[key] = { supplier, category, subCategory, sales: 0, commission: 0, itemsCount: 0 };
  categoryMap[key].sales -= r.value;
  categoryMap[key].commission -= r.commission;
  categoryMap[key].itemsCount -= r.quantity;
}
