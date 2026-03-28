import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { BUSINESS_IDS } from "@/app/config/business-constants";

export const dynamic = "force-dynamic";

const SIERRA_ID = BUSINESS_IDS.SIERRA_AGENCY;

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const from = url.searchParams.get("from") || new Date(new Date().getFullYear(), 0, 1).toISOString();
  const to = url.searchParams.get("to") || new Date(new Date().getFullYear(), 11, 31).toISOString();

  const fromDate = from.split("T")[0];
  const toDate = to.split("T")[0];

  try {
    // ── 1. Invoices (Sales) ───────────────────────────────────────────────────
    const { data: invoices, error: invErr } = await supabaseAdmin
      .from("invoices")
      .select(
        `id, total_amount, final_amount, due_amount, payment_status, date, invoice_no,
         customers (shop_name),
         orders!inner (order_date, business_id,
           order_items (quantity, unit_price, actual_unit_cost, free_quantity, total_price)
         )`
      )
      .eq("orders.business_id", SIERRA_ID)
      .gte("date", fromDate)
      .lte("date", toDate)
      .order("date", { ascending: false });

    if (invErr) throw invErr;

    // ── 2. Purchases ─────────────────────────────────────────────────────────
    const { data: purchases, error: purErr } = await supabaseAdmin
      .from("purchases")
      .select("id, total_amount, paid_amount, purchase_date, purchase_id, suppliers(name)")
      .eq("business_id", SIERRA_ID)
      .gte("purchase_date", fromDate)
      .lte("purchase_date", toDate);

    if (purErr) throw purErr;

    // ── 3. Expenses ───────────────────────────────────────────────────────────
    const { data: expenses, error: expErr } = await supabaseAdmin
      .from("expenses")
      .select("id, amount, category, expense_date, description, payment_method")
      .eq("business_id", SIERRA_ID)
      .gte("expense_date", fromDate)
      .lte("expense_date", toDate)
      .order("expense_date", { ascending: false });

    if (expErr) throw expErr;

    // ── 4. Order Items for Profit (Sierra products by supplier_name) ──────────
    const { data: orderItems, error: itemErr } = await supabaseAdmin
      .from("order_items")
      .select(
        `id, quantity, free_quantity, unit_price, actual_unit_cost, created_at,
         order:orders!inner (
           order_id, status, created_at, order_date, invoice_no,
           customer:customers (shop_name),
           invoices (invoice_no)
         ),
         product:products!inner (id, name, sku, supplier_name, cost_price)`
      )
      .neq("order.status", "Cancelled")
      .ilike("product.supplier_name", "%Sierra%")
      .gte("order.order_date", fromDate)
      .lte("order.order_date", toDate);

    if (itemErr) throw itemErr;

    // ── Process: Overview KPIs ────────────────────────────────────────────────
    const totalSales = (invoices || []).reduce(
      (s, inv: any) => s + (Number(inv.final_amount) || Number(inv.total_amount) || 0),
      0
    );
    const orderCount = (invoices || []).length;
    const totalExpenses = (expenses || []).reduce((s, e: any) => s + Number(e.amount || 0), 0);
    const expenseCount = (expenses || []).length;

    let totalRevenue = 0;
    let totalCost = 0;
    (orderItems || []).forEach((item: any) => {
      const qty = Number(item.quantity) || 0;
      const unitPrice = Number(item.unit_price) || 0;
      const unitCost = Number(item.actual_unit_cost) || Number(item.product.cost_price) || 0;
      totalRevenue += qty * unitPrice;
      totalCost += qty * unitCost;
    });
    const totalProfit = totalRevenue - totalCost;
    const profitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

    // ── Process: Monthly Distribution ─────────────────────────────────────────
    const monthMap: Record<string, { month: string; monthKey: string; billCount: number; totalSales: number; totalPurchases: number }> = {};

    (invoices || []).forEach((inv: any) => {
      const rawDate = inv.date || inv.orders?.order_date;
      if (!rawDate) return;
      const d = new Date(rawDate);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (!monthMap[key]) {
        monthMap[key] = {
          month: d.toLocaleString("default", { month: "long", year: "numeric" }),
          monthKey: key,
          billCount: 0,
          totalSales: 0,
          totalPurchases: 0,
        };
      }
      monthMap[key].billCount += 1;
      monthMap[key].totalSales += Number(inv.final_amount) || Number(inv.total_amount) || 0;
    });

    (purchases || []).forEach((p: any) => {
      const rawDate = p.purchase_date;
      if (!rawDate) return;
      const d = new Date(rawDate);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (!monthMap[key]) {
        monthMap[key] = {
          month: d.toLocaleString("default", { month: "long", year: "numeric" }),
          monthKey: key,
          billCount: 0,
          totalSales: 0,
          totalPurchases: 0,
        };
      }
      monthMap[key].totalPurchases += Number(p.total_amount) || 0;
    });

    const monthly = Object.values(monthMap)
      .map((m) => ({ ...m, netValue: m.totalSales - m.totalPurchases }))
      .sort((a, b) => b.monthKey.localeCompare(a.monthKey));

    // ── Process: Profit Monthly Chart ─────────────────────────────────────────
    const profitMonthMap: Record<string, any> = {};
    (orderItems || []).forEach((item: any) => {
      const qty = Number(item.quantity) || 0;
      const unitPrice = Number(item.unit_price) || 0;
      const unitCost = Number(item.actual_unit_cost) || Number(item.product.cost_price) || 0;
      const revenue = qty * unitPrice;
      const profit = revenue - qty * unitCost;
      const rawDate = item.order.order_date || item.order.created_at.split("T")[0];
      const d = new Date(rawDate);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (!profitMonthMap[key]) {
        profitMonthMap[key] = {
          name: d.toLocaleString("default", { month: "short", year: "2-digit" }),
          dateStr: key,
          revenue: 0,
          profit: 0,
        };
      }
      profitMonthMap[key].revenue += revenue;
      profitMonthMap[key].profit += profit;
    });
    const profitMonthly = Object.values(profitMonthMap).sort((a, b) =>
      a.dateStr.localeCompare(b.dateStr)
    );

    // ── Process: Products ─────────────────────────────────────────────────────
    const productMap: Record<string, any> = {};
    (orderItems || []).forEach((item: any) => {
      const qty = Number(item.quantity) || 0;
      const unitPrice = Number(item.unit_price) || 0;
      const unitCost = Number(item.actual_unit_cost) || Number(item.product.cost_price) || 0;
      const revenue = qty * unitPrice;
      const cost = qty * unitCost;
      const pid = item.product.id;
      if (!productMap[pid]) {
        productMap[pid] = { id: pid, sku: item.product.sku, name: item.product.name, qtySold: 0, revenue: 0, cost: 0, profit: 0 };
      }
      productMap[pid].qtySold += qty;
      productMap[pid].revenue += revenue;
      productMap[pid].cost += cost;
      productMap[pid].profit += revenue - cost;
    });
    const products = Object.values(productMap)
      .map((p) => ({ ...p, margin: p.revenue > 0 ? (p.profit / p.revenue) * 100 : 0 }))
      .sort((a, b) => b.revenue - a.revenue);

    // ── Process: Customers ────────────────────────────────────────────────────
    const customerMap: Record<string, any> = {};
    (invoices || []).forEach((inv: any) => {
      const name = inv.customers?.shop_name || "Unknown";
      const amount = Number(inv.final_amount) || Number(inv.total_amount) || 0;
      if (!customerMap[name]) {
        customerMap[name] = { name, billCount: 0, totalSales: 0, dueAmount: 0 };
      }
      customerMap[name].billCount += 1;
      customerMap[name].totalSales += amount;
      customerMap[name].dueAmount += Number(inv.due_amount) || 0;
    });
    const customers = Object.values(customerMap).sort((a, b) => b.totalSales - a.totalSales);

    // ── Process: Customer Profits (from order_items) ──────────────────────────
    const customerProfitMap: Record<string, any> = {};
    (orderItems || []).forEach((item: any) => {
      const qty = Number(item.quantity) || 0;
      const unitPrice = Number(item.unit_price) || 0;
      const unitCost = Number(item.actual_unit_cost) || Number(item.product.cost_price) || 0;
      const revenue = qty * unitPrice;
      const profit = revenue - qty * unitCost;
      const name = item.order.customer?.shop_name || "Unknown";
      if (!customerProfitMap[name]) {
        customerProfitMap[name] = { name, revenue: 0, profit: 0 };
      }
      customerProfitMap[name].revenue += revenue;
      customerProfitMap[name].profit += profit;
    });
    const customerProfits = Object.values(customerProfitMap)
      .filter((c: any) => c.profit > 0)
      .sort((a: any, b: any) => b.profit - a.profit)
      .slice(0, 12)
      .map((c: any) => ({
        name: c.name.length > 12 ? c.name.slice(0, 12) + "…" : c.name,
        fullName: c.name,
        value: Math.round(c.profit),
      }));

    // ── Process: Margin Distribution (per order) ──────────────────────────────
    const orderMarginMap: Record<string, { revenue: number; cost: number }> = {};
    (orderItems || []).forEach((item: any) => {
      const qty = Number(item.quantity) || 0;
      const unitPrice = Number(item.unit_price) || 0;
      const unitCost = Number(item.actual_unit_cost) || Number(item.product.cost_price) || 0;
      const oid = item.order.order_id;
      if (!orderMarginMap[oid]) orderMarginMap[oid] = { revenue: 0, cost: 0 };
      orderMarginMap[oid].revenue += qty * unitPrice;
      orderMarginMap[oid].cost += qty * unitCost;
    });
    const marginDistribution = { excellent: 0, good: 0, fair: 0, low: 0 };
    Object.values(orderMarginMap).forEach((o) => {
      const m = o.revenue > 0 ? ((o.revenue - o.cost) / o.revenue) * 100 : 0;
      if (m >= 30) marginDistribution.excellent++;
      else if (m >= 20) marginDistribution.good++;
      else if (m >= 10) marginDistribution.fair++;
      else marginDistribution.low++;
    });

    // ── Process: Orders list ──────────────────────────────────────────────────
    const orders = (invoices || []).map((inv: any) => ({
      id: inv.id,
      invoiceNo: inv.invoice_no,
      date: inv.date,
      customer: inv.customers?.shop_name || "Unknown",
      amount: Number(inv.final_amount) || Number(inv.total_amount) || 0,
      dueAmount: Number(inv.due_amount) || 0,
      paymentStatus: inv.payment_status,
    }));

    // ── Process: Due Invoices ─────────────────────────────────────────────────
    const dueInvoices = orders
      .filter((o) => o.paymentStatus !== "Paid" && o.dueAmount > 0)
      .sort((a, b) => b.dueAmount - a.dueAmount);

    // ── Process: Expenses list ────────────────────────────────────────────────
    const expenseList = (expenses || []).map((e: any) => ({
      id: e.id,
      description: e.description || "-",
      amount: Number(e.amount) || 0,
      category: e.category || "General",
      date: e.expense_date,
      paymentMethod: e.payment_method || "-",
    }));

    return NextResponse.json({
      overview: {
        totalSales,
        orderCount,
        totalProfit,
        totalCost,
        profitMargin,
        totalExpenses,
        expenseCount,
      },
      monthly,
      profitMonthly,
      products,
      customers,
      customerProfits,
      marginDistribution,
      orders,
      dueInvoices,
      expenses: expenseList,
    });
  } catch (error: any) {
    console.error("Sierra report error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
