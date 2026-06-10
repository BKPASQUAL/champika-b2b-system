import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { BUSINESS_NAMES } from "@/app/config/business-constants";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const { reason, performedByName, performedByEmail } = body;

    // 1. Fetch full payment record
    const { data: payment, error: fetchError } = await supabaseAdmin
      .from("payments")
      .select(
        "id, amount, method, cheque_status, invoice_id, customer_id, deposit_account_id, is_cancelled"
      )
      .eq("id", id)
      .single();

    if (fetchError || !payment) {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    }

    if (payment.is_cancelled) {
      return NextResponse.json(
        { error: "Payment is already cancelled" },
        { status: 400 }
      );
    }

    const amount = Number(payment.amount);

    // 2. Mark payment as cancelled
    const { error: cancelError } = await supabaseAdmin
      .from("payments")
      .update({
        is_cancelled: true,
        cancelled_at: new Date().toISOString(),
        cancelled_reason: reason ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (cancelError) throw cancelError;

    // 3. Restore customer outstanding balance
    if (payment.customer_id) {
      const { data: customer } = await supabaseAdmin
        .from("customers")
        .select("outstanding_balance, shop_name")
        .eq("id", payment.customer_id)
        .single();

      if (customer) {
        await supabaseAdmin
          .from("customers")
          .update({
            outstanding_balance:
              Number(customer.outstanding_balance || 0) + amount,
            updated_at: new Date().toISOString(),
          })
          .eq("id", payment.customer_id);
      }
    }

    // 4. Reverse invoice paid_amount and recalculate status
    let invoiceNo: string | null = null;
    let businessId: string | null = null;
    let customerName: string | null = null;

    if (payment.invoice_id) {
      const { data: invoice } = await supabaseAdmin
        .from("invoices")
        .select(
          "paid_amount, total_amount, invoice_no, orders(business_id)"
        )
        .eq("id", payment.invoice_id)
        .single();

      if (invoice) {
        invoiceNo = invoice.invoice_no ?? null;

        const orderObj = Array.isArray(invoice.orders)
          ? invoice.orders[0]
          : invoice.orders;
        businessId = orderObj?.business_id ?? null;

        const newPaidAmount = Math.max(
          0,
          Number(invoice.paid_amount || 0) - amount
        );
        const total = Number(invoice.total_amount || 0);
        const isFullyPaid = (total - newPaidAmount) < 10;
        const finalPaidAmount = isFullyPaid ? total : newPaidAmount;
        const newStatus =
          finalPaidAmount <= 0
            ? "Unpaid"
            : isFullyPaid
            ? "Paid"
            : "Partial";

        await supabaseAdmin
          .from("invoices")
          .update({
            paid_amount: finalPaidAmount,
            status: newStatus,
            updated_at: new Date().toISOString(),
          })
          .eq("id", payment.invoice_id);
      }
    }

    // Fetch customer name for activity record
    if (payment.customer_id) {
      const { data: cust } = await supabaseAdmin
        .from("customers")
        .select("shop_name")
        .eq("id", payment.customer_id)
        .single();
      customerName = cust?.shop_name ?? null;
    }

    // 5. Reverse bank account balance for cash/bank payments
    //    Also reverse for cheques that were already Cleared
    const shouldReverseBank =
      payment.method === "cash" ||
      payment.method === "bank" ||
      (payment.method === "cheque" && payment.cheque_status === "Cleared");

    if (shouldReverseBank && payment.deposit_account_id) {
      const { data: accountData } = await supabaseAdmin
        .from("bank_accounts")
        .select("current_balance")
        .eq("id", payment.deposit_account_id)
        .single();

      if (accountData) {
        const newBalance = Number(accountData.current_balance || 0) - amount;
        await supabaseAdmin
          .from("bank_accounts")
          .update({
            current_balance: newBalance,
            updated_at: new Date().toISOString(),
          })
          .eq("id", payment.deposit_account_id);

        // Record reversal transaction
        await supabaseAdmin.from("account_transactions").insert({
          transaction_no: `PAY-CANCEL-${id.substring(0, 8).toUpperCase()}-${Date.now()}`,
          transaction_type: "Withdrawal",
          from_account_id: payment.deposit_account_id,
          to_account_id: null,
          amount,
          transaction_date: new Date().toISOString().split("T")[0],
          description: `Payment cancelled — ref ${id.substring(0, 8).toUpperCase()}${reason ? ` (${reason})` : ""}`,
          payment_id: id,
        });
      }
    }

    // 6. If cheque was Deposited (not yet Cleared), mark cheque_status as Returned
    if (
      payment.method === "cheque" &&
      (payment.cheque_status === "Pending" ||
        payment.cheque_status === "Deposited")
    ) {
      await supabaseAdmin
        .from("payments")
        .update({ cheque_status: "Returned" })
        .eq("id", id);
    }

    // 7. Activity record for audit trail
    try {
      const businessName =
        businessId
          ? (BUSINESS_NAMES as Record<string, string>)[businessId] ??
            "Unknown Business"
          : null;

      await supabaseAdmin.from("activity_records").insert({
        portal: "office",
        business_id: businessId,
        business_name: businessName,
        action_type: "payment_cancelled",
        record_type: "Payment Cancelled",
        entity_type: "payment",
        entity_id: id,
        entity_no: invoiceNo,
        customer_id: payment.customer_id,
        customer_name: customerName,
        amount,
        performed_by_name: performedByName ?? null,
        performed_by_email: performedByEmail ?? null,
        metadata: {
          paymentMethod: payment.method,
          invoiceId: payment.invoice_id,
          invoiceNo,
          cancelledAmount: amount,
          reason: reason ?? null,
        },
      });
    } catch {
      // non-critical
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("POST /api/payments/[id]/cancel error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
