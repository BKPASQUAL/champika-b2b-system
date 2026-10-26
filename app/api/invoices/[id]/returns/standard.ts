import { supabaseAdmin } from "@/lib/supabase-admin";

const RETURN_SELECT = `
  id,
  return_number,
  created_at,
  return_date,
  quantity,
  return_type,
  reason,
  status,
  customer_id,
  product_id,
  products (
    name,
    sku,
    selling_price,
    cost_price
  ),
  profiles (
    full_name
  )
`;

const hasBillTag = (reason: string) =>
  /\[INV:[^\]\s]+\]/.test(reason) || /\[[A-Z]{1,6}-\d+\]/.test(reason);

const withFlags = (r: any, linked: boolean) => {
  const reason: string = r.reason || "";
  const creditMatch = reason.match(/\[CREDIT:([\d.]+)\]/);
  return {
    ...r,
    linked,
    adjusted: reason.includes("[INVOICE_ADJUSTED]"),
    settled_in_payment: reason.includes("[SETTLED_IN_PAYMENT"),
    credit: creditMatch ? parseFloat(creditMatch[1]) : null,
  };
};

/**
 * Returns for a normal bill:
 * 1. Returns tagged with this bill's number (linked)
 * 2. Good returns of this customer with no bill tag, where this bill is the
 *    customer's latest purchase of that product before the return (unlinked —
 *    they can be applied to this bill from the invoice page)
 */
export async function getStandardInvoiceReturns(
  invoiceId: string,
  invoice: { invoice_no: string | null; order_id: string | null; customer_id?: string | null }
) {
  const searchConditions: string[] = [];
  if (invoice.invoice_no) searchConditions.push(`reason.ilike.%${invoice.invoice_no}%`);
  if (invoice.order_id) searchConditions.push(`reason.ilike.%ORD-${invoice.order_id}%`);

  const { data: tagged, error } = await supabaseAdmin
    .from("inventory_returns")
    .select(RETURN_SELECT)
    .or(searchConditions.length > 0 ? searchConditions.join(",") : `reason.ilike.%${invoiceId}%`)
    .order("created_at", { ascending: false });
  if (error) throw error;

  const result = (tagged || []).map((r) => withFlags(r, true));
  if (!invoice.customer_id || !invoice.order_id) return result;

  // Products on this bill
  const { data: lines } = await supabaseAdmin
    .from("order_items")
    .select("product_id")
    .eq("order_id", invoice.order_id);
  const productIds = [...new Set((lines || []).map((l: any) => l.product_id).filter(Boolean))];
  if (productIds.length === 0) return result;

  const { data: candidates } = await supabaseAdmin
    .from("inventory_returns")
    .select(RETURN_SELECT)
    .eq("customer_id", invoice.customer_id)
    .eq("return_type", "Good")
    // Office returns only — rep returns go through pickup + payment credit
    .eq("status", "Completed")
    .in("product_id", productIds)
    .order("created_at", { ascending: false });

  const unlinked = (candidates || []).filter((r: any) => {
    const reason: string = r.reason || "";
    if (hasBillTag(reason)) return false;
    if (reason.includes("[PAY:") || reason.includes("[SETTLED_IN_PAYMENT")) return false;
    if (reason.includes("[INVOICE_ADJUSTED]")) return false;
    return !result.some((t: any) => t.id === r.id);
  });
  if (unlinked.length === 0) return result;

  // Keep only returns whose latest purchase bill (before the return) is this one
  const { data: purchases } = await supabaseAdmin
    .from("order_items")
    .select("product_id, orders!inner(id, customer_id, created_at, status)")
    .in("product_id", [...new Set(unlinked.map((r: any) => r.product_id))])
    .eq("orders.customer_id", invoice.customer_id)
    .gt("quantity", 0);

  const { data: billOrders } = await supabaseAdmin
    .from("invoices")
    .select("order_id, invoice_no")
    .in(
      "order_id",
      [...new Set((purchases || []).map((p: any) => p.orders?.id).filter(Boolean))]
    );
  const realBillOrders = new Set(
    (billOrders || [])
      .filter((b: any) => b.invoice_no && !b.invoice_no.startsWith("RET-"))
      .map((b: any) => b.order_id)
  );

  unlinked.forEach((r: any) => {
    const returnTime = new Date(r.return_date || r.created_at).getTime();
    const options = (purchases || [])
      .filter(
        (p: any) =>
          p.product_id === r.product_id &&
          realBillOrders.has(p.orders?.id) &&
          p.orders?.status !== "Cancelled"
      )
      .map((p: any) => ({ orderId: p.orders.id, time: new Date(p.orders.created_at).getTime() }));
    const before = options.filter((o) => o.time <= returnTime);
    const pick = (before.length > 0 ? before : options).sort((a, b) => b.time - a.time)[0];
    if (pick && pick.orderId === invoice.order_id) result.push(withFlags(r, false));
  });

  return result;
}
