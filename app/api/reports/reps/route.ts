import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();
    const fromDate = searchParams.get("from") || firstDay;
    const toDate = searchParams.get("to") || lastDay;
    const fromDateOnly = fromDate.split("T")[0];
    const toDateOnly = toDate.split("T")[0];

    // 1. All reps
    const { data: reps, error: repsError } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, email")
      .eq("role", "rep")
      .order("full_name");
    if (repsError) throw repsError;

    // 2. Delivered orders in period assigned to a rep
    const { data: orders, error: ordersError } = await supabaseAdmin
      .from("orders")
      .select(`
        id, order_id, total_amount, status, created_at, order_date, sales_rep_id,
        customers (id, shop_name),
        invoices (id, invoice_no, manual_invoice_no, total_amount, paid_amount, status),
        rep_commissions (total_commission_amount, status)
      `)
      .eq("status", "Delivered")
      .gte("created_at", fromDate)
      .lte("created_at", toDate)
      .not("sales_rep_id", "is", null);
    if (ordersError) throw ordersError;

    // Build lookup maps from orders
    const allInvoiceIds: string[] = [];
    const invoiceRepMap: Record<string, string> = {};
    const allOrderIds: string[] = [];
    const orderRepIdMap: Record<string, string> = {};

    (orders || []).forEach((o: any) => {
      const inv = Array.isArray(o.invoices) ? o.invoices[0] : o.invoices;
      if (inv?.id) {
        allInvoiceIds.push(inv.id);
        if (o.sales_rep_id) invoiceRepMap[inv.id] = o.sales_rep_id;
      }
      if (o.id) {
        allOrderIds.push(o.id);
        if (o.sales_rep_id) orderRepIdMap[o.id] = o.sales_rep_id;
      }
    });

    // 3. Payments in period for those invoices
    type PaymentEntry = { amount: number; date: string };
    const repPaymentsMap: Record<string, PaymentEntry[]> = {};

    if (allInvoiceIds.length > 0) {
      const { data: payments } = await supabaseAdmin
        .from("payments")
        .select("invoice_id, amount, payment_date")
        .in("invoice_id", allInvoiceIds)
        .gte("payment_date", fromDateOnly)
        .lte("payment_date", toDateOnly);

      (payments || []).forEach((p: any) => {
        const repId = invoiceRepMap[p.invoice_id];
        if (!repId) return;
        if (!repPaymentsMap[repId]) repPaymentsMap[repId] = [];
        repPaymentsMap[repId].push({ amount: Number(p.amount) || 0, date: p.payment_date });
      });
    }

    // 4. Order items for per-supplier commission breakdown (fetch only, aggregate later)
    let rawOrderItems: any[] = [];
    if (allOrderIds.length > 0) {
      const { data: orderItems } = await supabaseAdmin
        .from("order_items")
        .select(`
          order_id, quantity, unit_price, commission_earned,
          product:products (supplier_name)
        `)
        .in("order_id", allOrderIds);
      rawOrderItems = orderItems || [];
    }

    // 5. Pending orders (current state — no date filter)
    const { data: pendingOrders, error: pendingError } = await supabaseAdmin
      .from("orders")
      .select("id, total_amount, sales_rep_id, status")
      .not("status", "in", `("Delivered","Cancelled")`)
      .not("sales_rep_id", "is", null);
    if (pendingError) throw pendingError;

    // 6. Commission rules (global reference)
    const { data: commissionRules } = await supabaseAdmin
      .from("commission_rules")
      .select("id, supplier_name, category, sub_category, rate")
      .order("supplier_name");

    // 7. Build per-rep aggregation
    const today = new Date(); today.setHours(0, 0, 0, 0);

    type MonthEntry = { month: string; monthKey: string; sales: number; collections: number };
    type InvoiceEntry = {
      orderId: string; invoiceNo: string; customer: string; date: string;
      total: number; paid: number; due: number;
      commission: number; commissionEarned: number; commissionPending: number;
      isPaid: boolean; invStatus: string;
    };
    type RepEntry = {
      id: string; name: string; email: string;
      totalSales: number; totalCollections: number;
      pendingCount: number; pendingAmount: number;
      commissionEarned: number; commissionPending: number;
      monthlyMap: Record<string, MonthEntry>;
      invoices: InvoiceEntry[];
    };

    // Initialize repMap FIRST — all other aggregations reference it
    const repMap: Record<string, RepEntry> = {};
    (reps || []).forEach((rep: any) => {
      repMap[rep.id] = {
        id: rep.id,
        name: rep.full_name || rep.email || "Unknown Rep",
        email: rep.email || "",
        totalSales: 0,
        totalCollections: 0,
        pendingCount: 0,
        pendingAmount: 0,
        commissionEarned: 0,
        commissionPending: 0,
        monthlyMap: {},
        invoices: [],
      };
    });

    // Aggregate delivered orders
    (orders || []).forEach((order: any) => {
      const repId = order.sales_rep_id;
      if (!repMap[repId]) return;

      // Exclude inter-branch by customer name
      const shopName = (order.customers?.shop_name || "").toLowerCase();
      if (shopName.includes("champika hardware")) return;

      const inv = Array.isArray(order.invoices) ? order.invoices[0] : order.invoices;
      const repCom = Array.isArray(order.rep_commissions)
        ? order.rep_commissions[0]
        : order.rep_commissions;

      const total = Number(inv?.total_amount || order.total_amount || 0);
      const paid = Number(inv?.paid_amount || 0);
      const due = Math.max(0, total - paid);
      const commissionAmount = Number(repCom?.total_commission_amount || 0);

      const invoiceDate = new Date(order.order_date || order.created_at);
      invoiceDate.setHours(0, 0, 0, 0);
      const daysSince = Math.floor((today.getTime() - invoiceDate.getTime()) / 86400000);
      const isPaid = due === 0 && paid > 0;

      const commissionEarned = isPaid ? commissionAmount : 0;
      const commissionPending = !isPaid && daysSince <= 60 ? commissionAmount : 0;

      repMap[repId].totalSales += total;
      repMap[repId].commissionEarned += commissionEarned;
      repMap[repId].commissionPending += commissionPending;

      // Monthly sales
      const d = new Date(order.order_date || order.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (!repMap[repId].monthlyMap[key]) {
        repMap[repId].monthlyMap[key] = {
          month: d.toLocaleString("default", { month: "short", year: "2-digit" }),
          monthKey: key,
          sales: 0,
          collections: 0,
        };
      }
      repMap[repId].monthlyMap[key].sales += total;

      const invoiceNo = inv?.manual_invoice_no || inv?.invoice_no || order.order_id;
      repMap[repId].invoices.push({
        orderId: order.order_id,
        invoiceNo,
        customer: order.customers?.shop_name || "Unknown",
        date: (order.order_date || order.created_at || "").split("T")[0],
        total,
        paid,
        due,
        commission: commissionAmount,
        commissionEarned,
        commissionPending,
        isPaid,
        invStatus: inv?.status || "Unpaid",
      });
    });

    // Aggregate collections
    Object.entries(repPaymentsMap).forEach(([repId, payments]) => {
      if (!repMap[repId]) return;
      payments.forEach((p) => {
        repMap[repId].totalCollections += p.amount;
        const d = new Date(p.date);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        if (!repMap[repId].monthlyMap[key]) {
          repMap[repId].monthlyMap[key] = {
            month: d.toLocaleString("default", { month: "short", year: "2-digit" }),
            monthKey: key,
            sales: 0,
            collections: 0,
          };
        }
        repMap[repId].monthlyMap[key].collections += p.amount;
      });
    });

    // Aggregate pending orders
    (pendingOrders || []).forEach((o: any) => {
      const repId = o.sales_rep_id;
      if (!repMap[repId]) return;
      repMap[repId].pendingCount += 1;
      repMap[repId].pendingAmount += Number(o.total_amount || 0);
    });

    // Aggregate per-supplier commission (NOW repMap is initialized)
    type SupplierCommEntry = { name: string; sales: number; commission: number };
    const repSupplierMap: Record<string, Record<string, SupplierCommEntry>> = {};

    rawOrderItems.forEach((item: any) => {
      const repId = orderRepIdMap[item.order_id];
      if (!repId || !repMap[repId]) return;
      const supplier = item.product?.supplier_name || "Unknown Supplier";
      const sales = (Number(item.quantity) || 0) * (Number(item.unit_price) || 0);
      const commission = Number(item.commission_earned) || 0;
      if (!repSupplierMap[repId]) repSupplierMap[repId] = {};
      if (!repSupplierMap[repId][supplier]) {
        repSupplierMap[repId][supplier] = { name: supplier, sales: 0, commission: 0 };
      }
      repSupplierMap[repId][supplier].sales += sales;
      repSupplierMap[repId][supplier].commission += commission;
    });

    // Build final results
    const repsResult = Object.values(repMap).map((rep) => {
      const monthly = Object.values(rep.monthlyMap).sort((a, b) =>
        a.monthKey.localeCompare(b.monthKey)
      );
      rep.invoices.sort((a, b) => b.date.localeCompare(a.date));

      const commissionBySupplier = Object.values(repSupplierMap[rep.id] || {})
        .filter((s) => s.sales > 0 || s.commission > 0)
        .map((s) => ({
          ...s,
          rate: s.sales > 0 ? (s.commission / s.sales) * 100 : 0,
        }))
        .sort((a, b) => b.commission - a.commission);

      return {
        id: rep.id,
        name: rep.name,
        email: rep.email,
        totalSales: rep.totalSales,
        totalCollections: rep.totalCollections,
        pendingCount: rep.pendingCount,
        pendingAmount: rep.pendingAmount,
        commissionEarned: rep.commissionEarned,
        commissionPending: rep.commissionPending,
        invoiceCount: rep.invoices.length,
        monthly,
        invoices: rep.invoices,
        commissionBySupplier,
      };
    }).sort((a, b) => b.totalSales - a.totalSales);

    return NextResponse.json({ reps: repsResult, commissionRules: commissionRules || [] });
  } catch (error: any) {
    console.error("Rep analytics error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
