import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET() {
  try {
    // Run all queries in parallel for performance
    const [
      invoicesRes,
      ordersRes,
      suppliersRes,
      chequesRes,
      recentInvoicesRes,
    ] = await Promise.all([
      // All invoices — for revenue, due, overdue stats
      supabaseAdmin
        .from("invoices")
        .select("id, total_amount, paid_amount, due_amount, status, created_at"),

      // All orders — for pending order count
      supabaseAdmin
        .from("orders")
        .select(
          "id, order_id, status, total_amount, order_date, customer_id, customers(shop_name)"
        )
        .order("order_date", { ascending: false }),

      // Suppliers — active vs pending counts
      supabaseAdmin.from("suppliers").select("id, name, status"),

      // Pending cheque payments waiting for clearance
      supabaseAdmin
        .from("payments")
        .select(
          `id, amount, payment_date, cheque_no, cheque_status,
           customers(shop_name),
           invoices(invoice_no)`
        )
        .eq("method", "cheque")
        .eq("cheque_status", "Pending")
        .order("payment_date", { ascending: false }),

      // Recent 8 invoices for activity list
      supabaseAdmin
        .from("invoices")
        .select(
          `id, invoice_no, manual_invoice_no, total_amount, paid_amount, due_amount, status, created_at,
           customers(shop_name),
           orders(status, business_id, profiles!orders_sales_rep_id_fkey(full_name))`
        )
        .order("created_at", { ascending: false })
        .limit(8),
    ]);

    // --- KPI Calculations ---
    const invoices = invoicesRes.data ?? [];
    const orders = ordersRes.data ?? [];
    const suppliers = suppliersRes.data ?? [];
    const pendingCheques = chequesRes.data ?? [];
    const recentInvoices = recentInvoicesRes.data ?? [];

    const totalRevenue = invoices.reduce(
      (sum: number, inv: any) => sum + (inv.total_amount ?? 0),
      0
    );
    const totalDue = invoices.reduce(
      (sum: number, inv: any) => sum + (inv.due_amount ?? 0),
      0
    );
    const overdueInvoices = invoices.filter(
      (inv: any) => inv.status === "Overdue"
    );
    const unpaidInvoices = invoices.filter(
      (inv: any) => inv.status === "Unpaid" || inv.status === "Partial"
    );

    // 30-day revenue
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const last30DaysRevenue = invoices
      .filter((inv: any) => new Date(inv.created_at) >= thirtyDaysAgo)
      .reduce((sum: number, inv: any) => sum + (inv.total_amount ?? 0), 0);

    const pendingOrders = orders.filter((o: any) => o.status === "Pending");
    const activeSuppliers = suppliers.filter((s: any) => s.status === "Active");
    const pendingSuppliers = suppliers.filter(
      (s: any) => s.status === "Pending"
    );

    // --- Pending approvals list (orders needing action) ---
    // Top 5 pending orders for the approvals panel
    const pendingOrdersList = pendingOrders.slice(0, 5).map((o: any) => ({
      id: o.id,
      orderId: o.order_id,
      customerName: o.customers?.shop_name ?? "Unknown",
      amount: o.total_amount,
      date: o.order_date,
      status: o.status,
    }));

    // Pending cheques formatted
    const pendingChequesList = pendingCheques.slice(0, 5).map((p: any) => ({
      id: p.id,
      chequeNo: p.cheque_no ?? "—",
      customerName: p.customers?.shop_name ?? "Unknown",
      amount: p.amount,
      date: p.payment_date,
      invoiceNo: p.invoices?.invoice_no ?? "—",
    }));

    // Pending supplier approvals
    const pendingSuppliersList = pendingSuppliers.slice(0, 5).map((s: any) => ({
      id: s.id,
      name: s.name,
      status: s.status,
    }));

    // Recent invoices formatted
    const recentInvoicesList = recentInvoices.map((inv: any) => ({
      id: inv.id,
      invoiceNo: inv.manual_invoice_no || inv.invoice_no,
      customerName: inv.customers?.shop_name ?? "Unknown",
      salesRepName: (inv.orders as any)?.profiles?.full_name ?? "—",
      amount: inv.total_amount,
      dueAmount: inv.due_amount,
      status: inv.status,
      orderStatus: (inv.orders as any)?.status ?? "—",
      date: inv.created_at,
    }));

    return NextResponse.json({
      kpis: {
        totalRevenue,
        last30DaysRevenue,
        totalDue,
        totalInvoices: invoices.length,
        overdueCount: overdueInvoices.length,
        unpaidCount: unpaidInvoices.length,
        pendingOrdersCount: pendingOrders.length,
        activeSuppliersCount: activeSuppliers.length,
        pendingSuppliersCount: pendingSuppliers.length,
        pendingChequesCount: pendingCheques.length,
        pendingChequesAmount: pendingCheques.reduce(
          (sum: number, p: any) => sum + (p.amount ?? 0),
          0
        ),
      },
      pendingOrders: pendingOrdersList,
      pendingCheques: pendingChequesList,
      pendingSuppliers: pendingSuppliersList,
      recentInvoices: recentInvoicesList,
    });
  } catch (error: any) {
    console.error("Admin dashboard API error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
