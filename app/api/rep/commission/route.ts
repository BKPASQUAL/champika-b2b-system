import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

/**
 * Commission rules:
 *  - Only Delivered orders qualify
 *  - Paid within 60 days of invoice date  → commission EARNED
 *  - Paid after  60 days of invoice date  → commission CUT
 *  - Not paid,   within 60 days           → commission PENDING
 *  - Not paid,   over   60 days           → commission CUT
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const repId = searchParams.get("repId");
  if (!repId) return NextResponse.json({ error: "Rep ID required" }, { status: 400 });

  try {
    // 1. Delivered orders for this rep
    const { data: orders, error: ordersError } = await supabaseAdmin
      .from("orders")
      .select(
        `id, order_id, total_amount, status, created_at, order_date,
         customers ( shop_name ),
         order_items ( commission_earned ),
         rep_commissions ( id, total_commission_amount, status ),
         invoices ( id, invoice_no, status, total_amount, paid_amount, due_date, created_at )`
      )
      .eq("sales_rep_id", repId)
      .eq("status", "Delivered")
      .order("created_at", { ascending: false });

    if (ordersError) throw ordersError;
    if (!orders || orders.length === 0) return NextResponse.json([]);

    // 2. Fetch latest payment date per invoice
    const invoiceIds = orders
      .map((o: any) => {
        const inv = Array.isArray(o.invoices) ? o.invoices[0] : o.invoices;
        return inv?.id;
      })
      .filter(Boolean) as string[];

    const paymentsByInvoice: Record<string, string> = {};
    if (invoiceIds.length > 0) {
      const { data: payments } = await supabaseAdmin
        .from("payments")
        .select("invoice_id, payment_date")
        .in("invoice_id", invoiceIds)
        .order("payment_date", { ascending: false });

      for (const p of payments ?? []) {
        if (!paymentsByInvoice[p.invoice_id]) {
          paymentsByInvoice[p.invoice_id] = p.payment_date;
        }
      }
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 3. Build records
    const records = orders.map((order: any) => {
      const inv = Array.isArray(order.invoices) ? order.invoices[0] : order.invoices;
      const repCom = Array.isArray(order.rep_commissions)
        ? order.rep_commissions[0]
        : order.rep_commissions;

      const commissionAmount = repCom
        ? Number(repCom.total_commission_amount) || 0
        : (order.order_items ?? []).reduce(
            (s: number, i: any) => s + (Number(i.commission_earned) || 0), 0
          );

      const invoiceDate = new Date(inv?.created_at || order.created_at);
      invoiceDate.setHours(0, 0, 0, 0);

      const invoiceTotal = Number(inv?.total_amount || order.total_amount || 0);
      const paidAmount   = Number(inv?.paid_amount || 0);
      const dueAmount    = Math.max(0, invoiceTotal - paidAmount);
      const isPaid       = dueAmount === 0 && paidAmount > 0;
      const isPartial    = paidAmount > 0 && dueAmount > 0;

      const paymentDateStr = inv?.id ? paymentsByInvoice[inv.id] : undefined;
      const paymentDate    = paymentDateStr ? new Date(paymentDateStr) : null;

      const daysSinceInvoice = Math.floor(
        (today.getTime() - invoiceDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      const daysToPayment = paymentDate
        ? Math.floor(
            (paymentDate.getTime() - invoiceDate.getTime()) / (1000 * 60 * 60 * 24)
          )
        : null;

      // Determine collection status
      let collectionStatus:
        | "immediate"    // paid same day (≤ 1 day)
        | "on_time"      // paid 2–60 days
        | "late_paid"    // paid after 60 days → cut
        | "pending"      // not paid, ≤ 60 days
        | "overdue_cut"; // not paid, > 60 days → cut

      if (isPaid || isPartial) {
        const d = daysToPayment ?? 0;
        if (d <= 1)       collectionStatus = "immediate";
        else if (d <= 60) collectionStatus = "on_time";
        else              collectionStatus = "late_paid";
      } else {
        collectionStatus = daysSinceInvoice > 60 ? "overdue_cut" : "pending";
      }

      // Effective commission earned
      const commissionEarned =
        collectionStatus === "immediate" || collectionStatus === "on_time"
          ? commissionAmount
          : 0;

      const commissionCut =
        collectionStatus === "late_paid" || collectionStatus === "overdue_cut"
          ? commissionAmount
          : 0;

      const commissionPending =
        collectionStatus === "pending" ? commissionAmount : 0;

      const payoutStatus: "Pending" | "Paid" =
        repCom?.status === "Paid" ? "Paid" : "Pending";

      return {
        id: order.id,
        orderRef: order.order_id || order.id.slice(0, 8).toUpperCase(),
        invoiceNo: inv?.invoice_no || null,
        shopName: order.customers?.shop_name || "Unknown",
        invoiceDate: invoiceDate.toISOString(),
        paymentDate: paymentDateStr || null,
        daysToPayment,
        daysSinceInvoice,
        orderTotal: invoiceTotal,
        paidAmount,
        dueAmount,
        commissionAmount,
        commissionEarned,
        commissionCut,
        commissionPending,
        collectionStatus,
        payoutStatus,
      };
    });

    return NextResponse.json(records);
  } catch (error: any) {
    console.error("Commission API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
