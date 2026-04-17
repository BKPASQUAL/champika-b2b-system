import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const repId = searchParams.get("repId");

  if (!repId) {
    return NextResponse.json({ error: "Rep ID required" }, { status: 400 });
  }

  try {
    // ── 1. All orders for this rep ────────────────────────────────────────────
    const { data: orders, error: ordersError } = await supabaseAdmin
      .from("orders")
      .select(
        `id, order_id, status, total_amount, order_date, created_at,
         customers ( shop_name ),
         invoices ( id, status, total_amount, paid_amount, due_date )`
      )
      .eq("sales_rep_id", repId)
      .order("created_at", { ascending: false });

    if (ordersError) throw ordersError;

    const allOrders = orders ?? [];

    // ── 2. Order status counts ────────────────────────────────────────────────
    const statusCounts: Record<string, number> = {};
    for (const o of allOrders) {
      statusCounts[o.status] = (statusCounts[o.status] || 0) + 1;
    }

    const pendingCount    = statusCounts["Pending"]    || 0;
    const processingCount = statusCounts["Processing"] || 0;
    const checkingCount   = statusCounts["Checking"]   || 0;
    const loadingCount    = statusCounts["Loading"]    || 0;
    const inTransitCount  = statusCounts["In Transit"] || 0;
    const deliveredCount  = statusCounts["Delivered"]  || 0;
    const activeCount     = pendingCount + processingCount + checkingCount + loadingCount + inTransitCount;

    // ── 3. Monthly sales (current calendar month) ─────────────────────────────
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const monthlySales = allOrders
      .filter((o) => o.created_at >= monthStart && o.status !== "Cancelled")
      .reduce((sum, o) => sum + (o.total_amount || 0), 0);

    // ── 4. Due collections from invoices ──────────────────────────────────────
    let totalDue = 0;
    let dueCustomerSet = new Set<string>();

    for (const order of allOrders) {
      const inv = Array.isArray(order.invoices) ? order.invoices[0] : order.invoices;
      if (!inv) continue;
      const due = (inv.total_amount || 0) - (inv.paid_amount || 0);
      if (due > 0) {
        totalDue += due;
        const shopName = (order.customers as any)?.shop_name;
        if (shopName) dueCustomerSet.add(shopName);
      }
    }

    // ── 5. Pending commission ─────────────────────────────────────────────────
    const { data: commissions } = await supabaseAdmin
      .from("rep_commissions")
      .select("total_commission_amount, status")
      .eq("rep_id", repId)
      .eq("status", "Pending");

    const pendingCommission = (commissions ?? []).reduce(
      (sum, c) => sum + (Number(c.total_commission_amount) || 0),
      0
    );

    // ── 6. Recent orders (last 8) ─────────────────────────────────────────────
    const recentOrders = allOrders.slice(0, 8).map((o) => {
      const inv = Array.isArray(o.invoices) ? o.invoices[0] : o.invoices;
      return {
        id: o.id,
        orderRef: o.order_id || o.id.slice(0, 8).toUpperCase(),
        shopName: (o.customers as any)?.shop_name || "Unknown",
        amount: o.total_amount || 0,
        status: o.status,
        date: o.order_date || o.created_at,
        invoiceStatus: inv?.status || null,
      };
    });

    return NextResponse.json({
      stats: {
        monthlySales,
        activeOrders: activeCount,
        pendingOrders: pendingCount,
        inTransitOrders: inTransitCount,
        deliveredOrders: deliveredCount,
        totalDue,
        dueCustomers: dueCustomerSet.size,
        pendingCommission,
        totalOrders: allOrders.length,
      },
      recentOrders,
    });
  } catch (error: any) {
    console.error("Rep dashboard error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
