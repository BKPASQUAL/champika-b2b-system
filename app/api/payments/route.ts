import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { z } from "zod";
import { BUSINESS_NAMES } from "@/app/config/business-constants";

// --- Validation Schema ---
// ✅ Updated: Added .nullable() to optional fields to allow null values from frontend
const paymentSchema = z.object({
  orderId: z.string().min(1, "Order ID is required"),
  amount: z.number().min(0.01, "Amount must be greater than 0"),
  date: z.string(),
  method: z.enum(["cash", "bank", "cheque", "credit"]),
  notes: z.string().optional().nullable(),
  // Cheque specific
  chequeNo: z.string().optional().nullable(),
  chequeDate: z.string().optional().nullable(),
  bankId: z.string().optional().nullable(),
  branchCode: z.string().optional().nullable(), // Added branch string
  // Deposit specific
  depositAccountId: z.string().optional().nullable(),
  // Performer info (logged-in user)
  performedByName: z.string().optional().nullable(),
  performedByEmail: z.string().optional().nullable(),
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get("businessId");

    // Build query with nested joins to get Customer, Order, and Business details
    let query = supabaseAdmin
      .from("payments")
      .select(
        `
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
      )
      .order("payment_date", { ascending: false });

    // Filter by Business ID if provided (via the nested orders relation)
    if (businessId) {
      query = query.eq("invoices.orders.business_id", businessId);
    }

    const { data, error } = await query;

    if (error) throw error;

    // Map database results to the frontend 'Payment' interface
    const formattedPayments = data.map((p: any) => {
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

      return {
        id: p.id,
        payment_number: p.id.substring(0, 8).toUpperCase(),
        payment_date: p.payment_date,
        order_id: orderObj?.id,
        invoice_id: invoiceObj?.id, // Added for frontend links
        customer_id: p.customer_id,
        amount: p.amount,
        payment_method: p.method,
        reference_number: null,
        notes: null,
        cheque_number: p.cheque_no,
        cheque_date: p.cheque_date,
        cheque_status: p.cheque_status,

        customers: {
          name: customerObj?.shop_name || "Unknown",
        },
        orders: {
          order_number: orderNumber,
          total_amount: totalAmount,
          business_name: businessName,
        },
        invoices: {
          invoice_no: invoiceObj?.invoice_no,
        },
        // Mapped for Cheque Bank Display
        banks: bankObj
          ? {
              bank_code: bankObj.bank_code,
              bank_name: bankObj.bank_name,
            }
          : null,
        // Mapped for Deposit Account Display
        company_accounts: accountObj
          ? {
              account_name: accountObj.account_name,
              account_type: accountObj.account_type,
            }
          : null,
      };
    });

    return NextResponse.json(formattedPayments);
  } catch (error: any) {
    console.error("Error fetching payments:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    // Parse validates the body against the schema
    const val = paymentSchema.parse(body);

    // 1. Fetch Order, Invoice, and Customer Details
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
      .eq("id", val.orderId)
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

    // 2. Insert into Payments Table
    const { data: payment, error: paymentError } = await supabaseAdmin
      .from("payments")
      .insert({
        invoice_id: invoice.id,
        customer_id: customer.id,
        amount: val.amount,
        payment_date: val.date,
        method: val.method,
        // Cheque Details
        cheque_no: val.method === "cheque" ? (val.branchCode ? `${val.chequeNo} (Branch: ${val.branchCode})` : val.chequeNo) : null,
        cheque_date: val.method === "cheque" ? val.chequeDate : null,
        cheque_status: val.method === "cheque" ? "Pending" : null,
        bank_id: val.method === "cheque" ? val.bankId : null, // Store Customer Bank
        // Deposit Details
        deposit_account_id:
          val.method === "cash" || val.method === "bank"
            ? val.depositAccountId
            : null,
      })
      .select()
      .single();

    if (paymentError) throw paymentError;

    // 3. Update Invoice Status and Paid Amount
    const newPaidAmount = (Number(invoice.paid_amount) || 0) + val.amount;
    const isFullyPaid = newPaidAmount >= Number(invoice.total_amount);
    const newStatus = isFullyPaid ? "Paid" : "Partial";

    const { error: invoiceUpdateError } = await supabaseAdmin
      .from("invoices")
      .update({
        paid_amount: newPaidAmount,
        status: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", invoice.id);

    if (invoiceUpdateError) throw invoiceUpdateError;

    // 4. Update Customer Outstanding Balance
    const currentBalance = Number(customer.outstanding_balance) || 0;
    const newBalance = currentBalance - val.amount;

    const { error: customerUpdateError } = await supabaseAdmin
      .from("customers")
      .update({
        outstanding_balance: newBalance,
      })
      .eq("id", customer.id);

    if (customerUpdateError) throw customerUpdateError;

    // 5. Create Account Transaction + Update Balance (For Cash & Bank only)
    if (
      (val.method === "cash" || val.method === "bank") &&
      val.depositAccountId
    ) {
      // 5a. Insert the account transaction record
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
          transaction_date: val.date,
          reference_no: invoice.invoice_no,
          payment_id: payment.id,
        });

      if (transactionError) {
        console.error("Error creating account transaction:", transactionError);
      }

      // 5b. Fetch current account balance
      const { data: accountData, error: fetchError } = await supabaseAdmin
        .from("bank_accounts")
        .select("current_balance")
        .eq("id", val.depositAccountId)
        .single();

      if (fetchError || !accountData) {
        console.error("Error fetching account balance:", fetchError);
      } else {
        // 5c. Add payment amount to current balance
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

    // Collect activityRecordId to return to the client for classification modal
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
          paymentMethod: val.method,
          invoiceId: invoice.id,
          invoiceNo: invoice.invoice_no,
          previousPaidAmount: Number(invoice.paid_amount) || 0,
          newPaidAmount,
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
      // Return validation errors clearly
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }
    console.error("Payment API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
