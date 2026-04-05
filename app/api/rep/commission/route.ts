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
    // Step 1: Fetch orders with invoices (no nested payments to avoid deep-join issues)
    const { data: orders, error: ordersError } = await supabaseAdmin
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
        invoices (
          id,
          status,
          total_amount,
          paid_amount,
          due_date
        )
      `
      )
      .eq("sales_rep_id", repId)
      .in("status", ["Delivered", "Completed"])
      .order("created_at", { ascending: false });

    if (ordersError) throw ordersError;
    if (!orders || orders.length === 0) return NextResponse.json([]);

    // Step 2: Collect IDs of paid invoices only
    const paidInvoiceIds: string[] = [];
    for (const order of orders) {
      const invoice = Array.isArray(order.invoices)
        ? order.invoices[0]
        : order.invoices;
      if (invoice?.status === "Paid" && invoice.id) {
        paidInvoiceIds.push(invoice.id);
      }
    }

    // Step 3: Fetch payments for paid invoices
    let paymentsByInvoice: Record<string, string> = {};

    if (paidInvoiceIds.length > 0) {
      const { data: payments, error: paymentsError } = await supabaseAdmin
        .from("payments")
        .select("invoice_id, payment_date")
        .in("invoice_id", paidInvoiceIds)
        .order("payment_date", { ascending: false });

      if (paymentsError) throw paymentsError;

      // Keep only the latest payment date per invoice
      for (const p of payments ?? []) {
        if (!paymentsByInvoice[p.invoice_id]) {
          paymentsByInvoice[p.invoice_id] = p.payment_date;
        }
      }
    }

    // Step 4: Build commission records — ONLY for paid invoices
    // Commission is counted only when payment date is AFTER the billing (order creation) date
    const formattedData = orders
      .map((order: any) => {
        const invoice = Array.isArray(order.invoices)
          ? order.invoices[0]
          : order.invoices;

        // Skip unpaid / partial invoices entirely
        if (!invoice || invoice.status !== "Paid") return null;

        const invoiceTotal = invoice.total_amount || 0;
        const invoicePaid = invoice.paid_amount || 0;
        const orderDue = Math.max(0, invoiceTotal - invoicePaid);

        // Use the latest payment date as effective date
        const paymentDate = paymentsByInvoice[invoice.id];
        const billingDate = order.created_at;

        // Only count commission if payment was received AFTER the billing date
        const paymentIsAfterBilling =
          paymentDate && new Date(paymentDate) > new Date(billingDate);

        const totalCommission = paymentIsAfterBilling
          ? order.order_items?.reduce(
              (sum: number, item: any) =>
                sum + (Number(item.commission_earned) || 0),
              0
            ) ?? 0
          : 0;

        const effectiveDate = paymentDate || billingDate;

        const commissionStatus =
          order.rep_commissions?.[0]?.status || "Pending";

        return {
          id: order.id,
          orderRef: order.order_id || "N/A",
          shopName: order.customers?.shop_name || "Unknown",
          orderTotal: order.total_amount || 0,
          commission: totalCommission,
          status: commissionStatus as "Pending" | "Paid",
          date: effectiveDate,
          orderDue: orderDue,
        };
      })
      .filter(Boolean); // Remove null entries (unpaid orders)

    return NextResponse.json(formattedData);
  } catch (error: any) {
    console.error("Commission API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
