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
    // Fetch orders with related invoices and payments to determine the "Collection Date"
    const { data: orders, error } = await supabaseAdmin
      .from("orders")
      .select(
        `
        id,
        order_id,
        total_amount,
        status,
        created_at,
        sales_rep_id,
        customers (
          shop_name
        ),
        order_items (
          commission_earned
        ),
        rep_commissions (
          status
        ),
        invoices!inner (
          status,
          total_amount,
          paid_amount,
          payments (
            payment_date
          )
        )
      `
      )
      .eq("sales_rep_id", repId)
      .in("status", ["Delivered", "Completed"])
      .order("created_at", { ascending: false });

    if (error) throw error;

    const formattedData = orders.map((order: any) => {
      // Invoice Details
      const invoice = Array.isArray(order.invoices)
        ? order.invoices[0]
        : order.invoices;

      const invoiceTotal = invoice?.total_amount || 0;
      const invoicePaid = invoice?.paid_amount || 0;
      const orderDue = Math.max(0, invoiceTotal - invoicePaid);
      const isInvoicePaid = invoice?.status === "Paid";

      // --- DATE LOGIC ---
      // Requirement: Show commission in the "Collected Month" (Payment Date), not "Selling Month".
      // 1. If Paid: Use the Latest Payment Date.
      // 2. If Unpaid: Fallback to Order Creation Date (to show it as pending in that month).
      let effectiveDate = order.created_at;

      if (isInvoicePaid && invoice?.payments && invoice.payments.length > 0) {
        // Sort payments by date descending (newest first) to get the final payment date
        const sortedPayments = invoice.payments.sort(
          (a: any, b: any) =>
            new Date(b.payment_date).getTime() -
            new Date(a.payment_date).getTime()
        );
        effectiveDate = sortedPayments[0].payment_date;
      }

      // Commission Calculation
      const totalCommission = order.order_items?.reduce(
        (sum: number, item: any) => sum + (Number(item.commission_earned) || 0),
        0
      );

      // Status Logic
      let finalStatus = "Pending";
      if (!isInvoicePaid) {
        finalStatus = "Unpaid Order";
      } else {
        finalStatus = order.rep_commissions?.[0]?.status || "Pending";
      }

      return {
        id: order.id,
        orderRef: order.order_id || "N/A",
        shopName: order.customers?.shop_name || "Unknown",
        orderTotal: order.total_amount || 0,
        commission: totalCommission,
        status: finalStatus,
        date: effectiveDate, // Use Effective Date for filtering/sorting
        originalDate: order.created_at, // Keep original date if needed
        orderDue: orderDue,
      };
    });

    return NextResponse.json(formattedData);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
