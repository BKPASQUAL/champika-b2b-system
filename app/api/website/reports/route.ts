import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireWebsiteStaff } from "@/lib/web-auth";
import { apiError } from "@/lib/web-utils";

const SOLD = ["Confirmed", "Packed", "Dispatched", "Delivered"];
const n = (v: unknown) => Number(v) || 0;
/** Date (YYYY-MM-DD) in Sri Lanka time. */
const dayLK = (iso: string) => new Date(new Date(iso).getTime() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);

/**
 * Staff: website sales & profit for a date range (?from=YYYY-MM-DD&to=YYYY-MM-DD).
 * "Sold" = confirmed and later (an invoice exists). Cost is the FIFO cost saved
 * on the invoice lines when the order was confirmed, so profit matches the B2B books.
 */
export async function GET(request: NextRequest) {
  const auth = await requireWebsiteStaff();
  if (auth.error) return auth.error;
  try {
    const sp = request.nextUrl.searchParams;
    const today = dayLK(new Date().toISOString());
    const to = sp.get("to") || today;
    const from = sp.get("from") || dayLK(new Date(Date.now() - 29 * 86400 * 1000).toISOString());
    // Range in UTC for the Sri Lanka days [from, to].
    const startUtc = new Date(`${from}T00:00:00+05:30`).toISOString();
    const endUtc = new Date(new Date(`${to}T00:00:00+05:30`).getTime() + 86400 * 1000).toISOString();

    const { data: orders, error } = await supabaseAdmin
      .from("web_orders")
      .select(
        "id, created_at, status, payment_method, payment_status, subtotal, discount_amount, delivery_fee, total, order_id, source_quote_id, delivery_address, web_order_items(web_product_id, product_id, name, qty, line_total, web_products(name, web_category_id, web_sub_category_id, web_brand_id))",
      )
      .gte("created_at", startUtc)
      .lt("created_at", endUtc)
      .order("created_at");
    if (error) throw error;

    const sold = (orders || []).filter((o: any) => SOLD.includes(o.status));
    const b2bIds = sold.map((o: any) => o.order_id).filter(Boolean);

    // FIFO cost per (B2B order, product) from the invoice lines.
    const costByOrderProduct = new Map<string, number>();
    for (let i = 0; i < b2bIds.length; i += 150) {
      const { data: lines } = await supabaseAdmin
        .from("order_items")
        .select("order_id, product_id, quantity, actual_unit_cost")
        .in("order_id", b2bIds.slice(i, i + 150));
      for (const l of lines || []) {
        const k = `${l.order_id}:${l.product_id}`;
        costByOrderProduct.set(k, (costByOrderProduct.get(k) || 0) + n(l.quantity) * n(l.actual_unit_cost));
      }
    }

    const [{ data: cats }, { data: brands }] = await Promise.all([
      supabaseAdmin.from("web_categories").select("id, name"),
      supabaseAdmin.from("web_brands").select("id, name"),
    ]);
    const catName = new Map((cats || []).map((c: any) => [c.id, c.name]));
    const brandName = new Map((brands || []).map((b: any) => [b.id, b.name]));

    // Totals
    let revenue = 0,
      discount = 0,
      delivery = 0,
      cost = 0;
    const byDay = new Map<string, { revenue: number; profit: number; orders: number }>();
    const byProduct = new Map<string, { name: string; qty: number; revenue: number; cost: number }>();
    const byCategory = new Map<string, { name: string; revenue: number; cost: number }>();
    const byBrand = new Map<string, { name: string; revenue: number; cost: number }>();
    const byPayment: Record<string, { orders: number; amount: number }> = {};
    const byDistrict = new Map<string, { orders: number; amount: number }>();
    let fromQuotes = 0;

    for (const o of sold as any[]) {
      const goods = n(o.subtotal) - n(o.discount_amount);
      revenue += goods;
      discount += n(o.discount_amount);
      delivery += n(o.delivery_fee);
      if (o.source_quote_id) fromQuotes++;
      const pm = o.payment_method === "COD" ? "Cash on delivery" : o.payment_method === "BANK" ? "Bank transfer" : "Card";
      byPayment[pm] = { orders: (byPayment[pm]?.orders || 0) + 1, amount: (byPayment[pm]?.amount || 0) + n(o.total) };
      const dist = o.delivery_address?.district || "—";
      const d = byDistrict.get(dist) || { orders: 0, amount: 0 };
      byDistrict.set(dist, { orders: d.orders + 1, amount: d.amount + n(o.total) });

      // Spread the order discount over its lines by value.
      const linesTotal = (o.web_order_items || []).reduce((s: number, i: any) => s + n(i.line_total), 0) || 1;
      let orderCost = 0;
      for (const i of o.web_order_items || []) {
        const lineRev = n(i.line_total) - (n(o.discount_amount) * n(i.line_total)) / linesTotal;
        const lineCost = o.order_id ? costByOrderProduct.get(`${o.order_id}:${i.product_id}`) || 0 : 0;
        orderCost += lineCost;
        const p = byProduct.get(i.web_product_id || i.product_id) || { name: i.web_products?.name || i.name, qty: 0, revenue: 0, cost: 0 };
        p.qty += n(i.qty);
        p.revenue += lineRev;
        p.cost += lineCost;
        byProduct.set(i.web_product_id || i.product_id, p);
        const catId = i.web_products?.web_sub_category_id || i.web_products?.web_category_id || "none";
        const c = byCategory.get(catId) || { name: catName.get(catId) || "Uncategorised", revenue: 0, cost: 0 };
        c.revenue += lineRev;
        c.cost += lineCost;
        byCategory.set(catId, c);
        const bId = i.web_products?.web_brand_id || "none";
        const b = byBrand.get(bId) || { name: brandName.get(bId) || "No brand", revenue: 0, cost: 0 };
        b.revenue += lineRev;
        b.cost += lineCost;
        byBrand.set(bId, b);
      }
      cost += orderCost;
      const day = dayLK(o.created_at);
      const dd = byDay.get(day) || { revenue: 0, profit: 0, orders: 0 };
      byDay.set(day, { revenue: dd.revenue + goods, profit: dd.profit + goods - orderCost, orders: dd.orders + 1 });
    }

    // Fill every day in the range so the chart has no gaps.
    const days: { date: string; revenue: number; profit: number; orders: number }[] = [];
    for (let t = new Date(`${from}T00:00:00Z`).getTime(); t <= new Date(`${to}T00:00:00Z`).getTime(); t += 86400 * 1000) {
      const d = new Date(t).toISOString().slice(0, 10);
      days.push({ date: d, ...(byDay.get(d) || { revenue: 0, profit: 0, orders: 0 }) });
    }

    const statusCount: Record<string, number> = {};
    for (const o of orders || []) statusCount[o.status] = (statusCount[o.status] || 0) + 1;

    const [{ count: newCustomers }, { data: quotes }] = await Promise.all([
      supabaseAdmin.from("web_customers").select("id", { count: "exact", head: true }).gte("created_at", startUtc).lt("created_at", endUtc),
      supabaseAdmin.from("web_quote_requests").select("status").gte("created_at", startUtc).lt("created_at", endUtc),
    ]);
    const quoteCount: Record<string, number> = {};
    for (const q of quotes || []) quoteCount[q.status] = (quoteCount[q.status] || 0) + 1;

    const sortRev = <T extends { revenue: number }>(m: Map<string, T>) => [...m.values()].sort((a, b) => b.revenue - a.revenue);
    const withProfit = <T extends { revenue: number; cost: number }>(x: T) => ({ ...x, profit: x.revenue - x.cost });

    return NextResponse.json({
      from,
      to,
      totals: {
        orders: sold.length,
        revenue,
        discount,
        deliveryFees: delivery,
        cost,
        profit: revenue - cost,
        marginPct: revenue > 0 ? ((revenue - cost) / revenue) * 100 : 0,
        avgOrder: sold.length ? revenue / sold.length : 0,
        allOrders: (orders || []).length,
        cancelled: statusCount.Cancelled || 0,
        waiting: statusCount.New || 0,
        newCustomers: newCustomers || 0,
        fromQuotes,
      },
      statusCount,
      quoteCount,
      days,
      byPayment,
      topProducts: sortRev(byProduct).slice(0, 15).map(withProfit),
      byCategory: sortRev(byCategory).map(withProfit),
      byBrand: sortRev(byBrand).map(withProfit),
      byDistrict: [...byDistrict.entries()].map(([name, v]) => ({ name, ...v })).sort((a, b) => b.amount - a.amount).slice(0, 10),
    });
  } catch (e) {
    return apiError(e);
  }
}
