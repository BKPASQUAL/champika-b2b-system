import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { z } from "zod";
import { BUSINESS_NAMES } from "@/app/config/business-constants";

// --- Validation Schema ---
const paymentSchema = z.object({
  orderId: z.string().optional().nullable(),
  customerId: z.string().optional().nullable(),
  payment_number: z.string().optional().nullable(),
  order_id: z.string().optional().nullable(),
  customer_id: z.string().optional().nullable(),
  payment_date: z.string().optional().nullable(),
  payment_method: z.string().optional().nullable(),
  amount: z.number().min(0.001, "Amount must be greater than 0"),
  date: z.string().optional().nullable(),
  method: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  // Cheque specific
  chequeNo: z.string().optional().nullable(),
  chequeDate: z.string().optional().nullable(),
  bankId: z.string().optional().nullable(),
  branchCode: z.string().optional().nullable(),
  // Deposit specific
  depositAccountId: z.string().optional().nullable(),
  // Receipt details
  receiptNumber: z.string().optional().nullable(),
  receiptBookId: z.string().optional().nullable(),
  // Performer info (logged-in user)
  performedByName: z.string().optional().nullable(),
  performedByEmail: z.string().optional().nullable(),
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get("businessId");

    let rawPayments: any[] = [];
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const selectClause = businessId
        ? `
          *,
          customers (
            id,
            shop_name
          ),
          invoices!inner (
            id,
            invoice_no,
            orders!inner (
              id,
              order_id,
              business_id,
              businesses (
                id,
                name
              )
            )
          ),
          bank_codes (
            id,
            bank_name,
            bank_code
          ),
          bank_accounts (
            id,
            account_name,
            account_type
          )
        `
        : `
          *,
          customers (
            id,
            shop_name
          ),
          invoices (
            id,
            invoice_no,
            orders (
              id,
              order_id,
              business_id,
              businesses (
                id,
                name
              )
            )
          ),
          bank_codes (
            id,
            bank_name,
            bank_code
          ),
          bank_accounts (
            id,
            account_name,
            account_type
          )
        `;

      let query = supabaseAdmin
        .from("payments")
        .select(selectClause)
        .order("payment_date", { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (businessId) {
        query = query.eq("invoices.orders.business_id", businessId);
      }

      const { data, error } = await query;
      if (error) throw error;

      if (data && data.length > 0) {
        rawPayments = rawPayments.concat(data);
        if (data.length < pageSize) hasMore = false;
        else page++;
      } else {
        hasMore = false;
      }
    }

    const formattedPayments = rawPayments.map((p: any) => {
      const customerObj = Array.isArray(p.customers)
        ? p.customers[0]
        : p.customers;
      const invoiceObj = Array.isArray(p.invoices) ? p.invoices[0] : p.invoices;
      const orderObj = Array.isArray(invoiceObj?.orders)
        ? invoiceObj.orders[0]
        : invoiceObj?.orders;
      const businessObj = Array.isArray(orderObj?.businesses)
        ? orderObj.businesses[0]
        : orderObj?.businesses;
      const bankObj = Array.isArray(p.bank_codes)
        ? p.bank_codes[0]
        : p.bank_codes;
      const accountObj = Array.isArray(p.bank_accounts)
        ? p.bank_accounts[0]
        : p.bank_accounts;

      const businessName = businessObj?.name || "Unknown Business";
      const orderNumber = invoiceObj?.invoice_no || orderObj?.order_id || "N/A";
      const totalAmount = p.amount;

      const paymentObj = {
        id: p.id,
        payment_number: p.id ? p.id.substring(0, 8).toUpperCase() : "",
        payment_date: p.payment_date,
        order_id: orderObj?.id ?? null,
        invoice_id: invoiceObj?.id ?? null,
        customer_id: p.customer_id,
        amount: p.amount,
        payment_method: p.method,
        reference_number: null,
        notes: p.notes || null,
        cheque_number: p.cheque_no || null,
        cheque_date: p.cheque_date || null,
        cheque_status: p.cheque_status || null,
        receipt_number: p.receipt_number || null,
        receipt_book_id: p.receipt_book_id || null,
        is_cancelled: Boolean(p.is_cancelled),
        cancelled_at: p.cancelled_at || null,
        cancelled_reason: p.cancelled_reason || null,
        customers: {
          name: customerObj?.shop_name || "Unknown",
        },
        orders: {
          order_number: orderNumber,
          total_amount: totalAmount,
          business_name: businessName,
          business_id: orderObj?.business_id || null,
        },
        invoices: {
          invoice_no: invoiceObj?.invoice_no || "",
        },
        banks: bankObj
          ? {
              bank_code: bankObj.bank_code,
              bank_name: bankObj.bank_name,
            }
          : null,
        company_accounts: accountObj
          ? {
              account_name: accountObj.account_name,
              account_type: accountObj.account_type,
            }
          : null,
      };

      return paymentObj;
    });

    const finalPayments = businessId
      ? formattedPayments.filter((p: any) => p.orders?.business_id === businessId)
      : formattedPayments;

    return NextResponse.json(finalPayments);
  } catch (error: any) {
    console.error("Error fetching payments:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const val = paymentSchema.parse(body);

    const targetOrderId = val.orderId || val.order_id;
    const targetCustomerId = val.customerId || val.customer_id;

    // Handle Unassigned Customer Payment (No Invoice Linked)
    if (!targetOrderId) {
      if (!targetCustomerId) {
        return NextResponse.json(
          { error: "Customer ID or Order ID is required" },
          { status: 400 }
        );
      }

      const paymentDate = val.date || val.payment_date || new Date().toISOString().split("T")[0];
      const paymentMethod = (val.method || val.payment_method || "cash") as any;

      const { data: payment, error: paymentError } = await supabaseAdmin
        .from("payments")
        .insert({
          invoice_id: null,
          customer_id: targetCustomerId,
          amount: val.amount,
          payment_date: paymentDate,
          method: paymentMethod,
          cheque_no: paymentMethod === "cheque" ? (val.branchCode ? `${val.chequeNo} (Branch: ${val.branchCode})` : val.chequeNo) : null,
          cheque_date: paymentMethod === "cheque" ? val.chequeDate : null,
          cheque_status: paymentMethod === "cheque" ? "Pending" : null,
          bank_id: paymentMethod === "cheque" ? val.bankId : null,
          deposit_account_id: (paymentMethod === "cash" || paymentMethod === "bank") ? val.depositAccountId : null,
          receipt_number: val.receiptNumber || null,
          receipt_book_id: val.receiptBookId || null,
        })
        .select()
        .single();

      if (paymentError) throw paymentError;

      // Update customer outstanding balance
      const { data: custData } = await supabaseAdmin
        .from("customers")
        .select("outstanding_balance")
        .eq("id", targetCustomerId)
        .single();

      if (custData) {
        const newBal = (custData.outstanding_balance || 0) - val.amount;
        await supabaseAdmin
          .from("customers")
          .update({ outstanding_balance: newBal })
          .eq("id", targetCustomerId);
      }

      return NextResponse.json({ message: "Customer payment recorded successfully", data: payment }, { status: 201 });
    }

    // Fetch Order, Invoice, and Customer Details
    const { data: orderData, error: orderError } = await supabaseAdmin
      .from("orders")
      .select(
        `
        id,
        business_id, 
        total_amount,
        invoices (
          id,
          invoice_no,
          paid_amount,
          total_amount,
          status
        ),
        customers (
          id,
          shop_name,
          outstanding_balance
        )
      `
      )
      .eq("id", targetOrderId)
      .single();

    if (orderError || !orderData) {
      return NextResponse.json(
        { error: "Order/Invoice not found" },
        { status: 404 }
      );
    }

    const invoice = Array.isArray(orderData.invoices)
      ? orderData.invoices[0]
      : orderData.invoices;
    const customer = Array.isArray(orderData.customers)
      ? orderData.customers[0]
      : orderData.customers;

    if (!invoice) {
      return NextResponse.json(
        { error: "No invoice associated with this order" },
        { status: 400 }
      );
    }

    if (!customer) {
      return NextResponse.json(
        { error: "No customer associated with this order" },
        { status: 400 }
      );
    }

    const paymentDate = val.date || val.payment_date || new Date().toISOString().split("T")[0];
    const paymentMethod = (val.method || val.payment_method || "cash") as any;

    // Insert into Payments Table
    const { data: payment, error: paymentError } = await supabaseAdmin
      .from("payments")
      .insert({
        invoice_id: invoice.id,
        customer_id: customer.id,
        amount: val.amount,
        payment_date: paymentDate,
        method: paymentMethod,
        cheque_no: paymentMethod === "cheque" ? (val.branchCode ? `${val.chequeNo} (Branch: ${val.branchCode})` : val.chequeNo) : null,
        cheque_date: paymentMethod === "cheque" ? val.chequeDate : null,
        cheque_status: paymentMethod === "cheque" ? "Pending" : null,
        bank_id: paymentMethod === "cheque" ? val.bankId : null,
        deposit_account_id:
          paymentMethod === "cash" || paymentMethod === "bank"
            ? val.depositAccountId
            : null,
        receipt_number: val.receiptNumber || null,
        receipt_book_id: val.receiptBookId || null,
      })
      .select()
      .single();

    if (paymentError) throw paymentError;

    // Advance Receipt Book current_number & Audit Log if receipt book is assigned
    if (val.receiptNumber) {
      try {
        let bookIdToUpdate = val.receiptBookId;
        
        if (!bookIdToUpdate) {
          const numericReceipt = parseInt(val.receiptNumber, 10);
          if (!isNaN(numericReceipt)) {
            const { data: foundBooks } = await supabaseAdmin
              .from("receipt_books")
              .select("id, book_number, current_number, end_number, assigned_to_user_name")
              .eq("status", "Active")
              .lte("start_number", numericReceipt)
              .gte("end_number", numericReceipt)
              .limit(1);
            if (foundBooks && foundBooks.length > 0) {
              bookIdToUpdate = foundBooks[0].id;
            }
          }
        }

        if (bookIdToUpdate) {
          const { data: rbData } = await supabaseAdmin
            .from("receipt_books")
            .select("id, book_number, current_number, start_number, end_number, assigned_to_user_id, assigned_to_user_name")
            .eq("id", bookIdToUpdate)
            .single();

          if (rbData) {
            const numericReceipt = parseInt(val.receiptNumber, 10);
            let nextNum = rbData.current_number + 1;
            if (!isNaN(numericReceipt) && numericReceipt >= rbData.start_number && numericReceipt <= rbData.end_number) {
              nextNum = Math.max(rbData.current_number, numericReceipt + 1);
            }
            const isCompleted = nextNum > rbData.end_number;

            await supabaseAdmin
              .from("receipt_books")
              .update({
                current_number: Math.min(nextNum, rbData.end_number + 1),
                status: isCompleted ? "Completed" : "Active",
                updated_at: new Date().toISOString(),
              })
              .eq("id", rbData.id);

            await supabaseAdmin.from("receipt_book_audits").insert({
              receipt_book_id: rbData.id,
              action_type: "RECEIPT_ISSUED",
              book_number: rbData.book_number,
              receipt_number: val.receiptNumber,
              assigned_to_new_id: rbData.assigned_to_user_id,
              assigned_to_new_name: rbData.assigned_to_user_name,
              performed_by_name: val.performedByName || null,
              performed_by_email: val.performedByEmail || null,
              notes: `Issued Receipt #${val.receiptNumber} for Invoice ${invoice.invoice_no} (${customer.shop_name})`,
            });
          }
        }
      } catch (rbErr) {
        console.error("Receipt book update warning:", rbErr);
      }
    }

    // Update Invoice status & paid_amount
    const newPaidAmount = (Number(invoice.paid_amount) || 0) + val.amount;
    const finalPaidAmount = Math.min(newPaidAmount, Number(invoice.total_amount));
    const isFullyPaid = finalPaidAmount >= Number(invoice.total_amount);
    const newStatus = isFullyPaid ? "Paid" : "Partial";

    const { error: invoiceUpdateError } = await supabaseAdmin
      .from("invoices")
      .update({
        paid_amount: finalPaidAmount,
        status: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", invoice.id);

    if (invoiceUpdateError) throw invoiceUpdateError;

    // Update order payment status
    const newOrderStatus = isFullyPaid
      ? "Paid"
      : finalPaidAmount > 0
      ? "Partial"
      : "Unpaid";

    await supabaseAdmin
      .from("orders")
      .update({ payment_status: newOrderStatus })
      .eq("id", orderData.id);

    // Update customer outstanding balance
    const currentBalance = Number(customer.outstanding_balance) || 0;
    const creditAmount = isFullyPaid ? (Number(invoice.total_amount) - (Number(invoice.paid_amount) || 0)) : val.amount;
    const newBalance = currentBalance - creditAmount;

    const { error: customerUpdateError } = await supabaseAdmin
      .from("customers")
      .update({
        outstanding_balance: newBalance,
      })
      .eq("id", customer.id);

    if (customerUpdateError) throw customerUpdateError;

    // Account transaction for cash/bank
    if (
      (paymentMethod === "cash" || paymentMethod === "bank") &&
      val.depositAccountId
    ) {
      const { error: transactionError } = await supabaseAdmin
        .from("account_transactions")
        .insert({
          transaction_no: `TXN-${Date.now()}-${Math.floor(
            Math.random() * 1000
          )}`,
          transaction_type: "Deposit",
          to_account_id: val.depositAccountId,
          from_account_id: null,
          amount: val.amount,
          description: `Payment from ${customer.shop_name} - ${invoice.invoice_no}`,
          transaction_date: paymentDate,
          reference_no: invoice.invoice_no,
          payment_id: payment.id,
        });

      if (transactionError) {
        console.error("Error creating account transaction:", transactionError);
      }

      const { data: accountData, error: fetchError } = await supabaseAdmin
        .from("bank_accounts")
        .select("current_balance")
        .eq("id", val.depositAccountId)
        .single();

      if (fetchError || !accountData) {
        console.error("Error fetching account balance:", fetchError);
      } else {
        const updatedBalance =
          Number(accountData.current_balance || 0) + val.amount;

        const { error: balanceError } = await supabaseAdmin
          .from("bank_accounts")
          .update({
            current_balance: updatedBalance,
            updated_at: new Date().toISOString(),
          })
          .eq("id", val.depositAccountId);

        if (balanceError) {
          console.error("Error updating account balance:", balanceError);
        }
      }
    }

    let activityRecordId: string | null = null;
    try {
      const businessId = orderData.business_id ?? null;
      const businessName = businessId
        ? (BUSINESS_NAMES as Record<string, string>)[businessId] ?? "Unknown Business"
        : null;

      const { data: actRec, error: actRecError } = await supabaseAdmin.from("activity_records").insert({
        portal: "office",
        business_id: businessId,
        business_name: businessName,
        action_type: "payment_made",
        record_type: "Payment Made",
        entity_type: "payment",
        entity_id: payment.id,
        entity_no: invoice.invoice_no,
        customer_id: customer.id,
        customer_name: customer.shop_name,
        amount: val.amount,
        performed_by_name: val.performedByName ?? null,
        performed_by_email: val.performedByEmail ?? null,
        metadata: {
          paymentMethod: paymentMethod,
          invoiceId: invoice.id,
          invoiceNo: invoice.invoice_no,
          previousPaidAmount: Number(invoice.paid_amount) || 0,
          newPaidAmount: finalPaidAmount,
          newStatus,
          isFullyPaid,
        },
      }).select("id").single();

      if (actRecError) {
        console.error("Activity record (payment) DB error:", actRecError.message, actRecError.code);
      }
      activityRecordId = actRec?.id ?? null;
    } catch (actErr) {
      console.error("Activity record (payment) failed (non-critical):", actErr);
    }

    return NextResponse.json(
      { message: "Payment recorded successfully", data: payment, activityRecordId },
      { status: 201 }
    );
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }
    console.error("Payment API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
