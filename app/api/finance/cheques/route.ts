import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { z } from "zod";

// --- Validation Schema for Actions ---
const actionSchema = z.object({
  paymentId: z.string().min(1, "Payment ID is required"),
  action: z.enum(["deposit", "clear", "return"]),
  date: z.string(),
  depositAccountId: z.string().optional(),
  reversalNote: z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const businessId = searchParams.get("businessId");

    // Note: We are NOT joining 'bank_codes' here to avoid the 500 Error
    // until you run the SQL migration above.
    // If you have run the migration, you can change the select to:
    // select(`*, customers(shop_name), invoices!inner(invoice_no, orders!inner(business_id)), bank_codes(bank_name, bank_code)`)

    let query = supabaseAdmin
      .from("payments")
      .select(
        `
        *,
        customers (
          shop_name
        ),
        invoices!inner (
          invoice_no,
          orders!inner (
            business_id
          )
        )
      `
      )
      .eq("method", "cheque")
      .order("cheque_date", { ascending: true });

    // Apply Status Filters
    if (status) {
      if (status === "history") {
        query = query.in("cheque_status", [
          "Passed",
          "Returned",
          "passed",
          "returned",
        ]);
      } else if (status === "pending") {
        query = query.in("cheque_status", ["Pending", "pending"]);
      } else if (status === "deposited") {
        query = query.in("cheque_status", ["Deposited", "deposited"]);
      } else {
        query = query.ilike("cheque_status", status);
      }
    }

    if (businessId) {
      query = query.eq("invoices.orders.business_id", businessId);
    }

    const { data, error } = await query;

    if (error) throw error;

    // Map the data
    const formattedCheques = data.map((p: any) => {
      // Handle potential join arrays
      const customer = Array.isArray(p.customers)
        ? p.customers[0]
        : p.customers;
      const invoice = Array.isArray(p.invoices) ? p.invoices[0] : p.invoices;

      // Attempt to get bank name if relation existed, else generic
      const bankName = p.bank_codes ? `${p.bank_codes.bank_name}` : "N/A";

      return {
        id: p.id,
        payment_number: p.id.substring(0, 8).toUpperCase(),
        cheque_number: p.cheque_no,
        cheque_date: p.cheque_date,
        amount: p.amount,
        status: p.cheque_status,
        customer_name: customer?.shop_name || "Unknown",
        invoice_no: invoice?.invoice_no || "N/A",
        bank_name: bankName,
        deposit_account_id: p.deposit_account_id,
      };
    });

    return NextResponse.json(formattedCheques);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const val = actionSchema.parse(body);

    const { data: payment, error: fetchError } = await supabaseAdmin
      .from("payments")
      .select("*, customers(shop_name), invoices(invoice_no)")
      .eq("id", val.paymentId)
      .single();

    if (fetchError || !payment) {
      return NextResponse.json(
        { error: "Payment record not found" },
        { status: 404 }
      );
    }

    const customerName = Array.isArray(payment.customers)
      ? payment.customers[0]?.shop_name
      : payment.customers?.shop_name;

    if (val.action === "deposit") {
      if (!val.depositAccountId)
        return NextResponse.json(
          { error: "Deposit Account is required" },
          { status: 400 }
        );

      // Update Payment
      await supabaseAdmin
        .from("payments")
        .update({
          cheque_status: "Deposited",
          deposit_account_id: val.depositAccountId, // Requires SQL update above
          updated_at: new Date().toISOString(),
        })
        .eq("id", val.paymentId);

      // Create Transaction
      await supabaseAdmin.from("account_transactions").insert({
        transaction_no: `DEP-${Date.now()}`,
        transaction_type: "Deposit",
        to_account_id: val.depositAccountId,
        amount: payment.amount,
        description: `Cheque Deposit: ${payment.cheque_no} (${customerName})`,
        transaction_date: val.date,
        reference_no: payment.cheque_no,
        cheque_status: "Deposited",
        cheque_date: payment.cheque_date,
      });
    } else if (val.action === "clear") {
      await supabaseAdmin
        .from("payments")
        .update({
          cheque_status: "Passed",
          updated_at: new Date().toISOString(),
        })
        .eq("id", val.paymentId);
    } else if (val.action === "return") {
      // 1. Mark Payment Returned
      await supabaseAdmin
        .from("payments")
        .update({
          cheque_status: "Returned",
          notes: val.reversalNote
            ? `${payment.notes || ""} | Returned: ${val.reversalNote}`
            : payment.notes,
          updated_at: new Date().toISOString(),
        })
        .eq("id", val.paymentId);

      // 2. Reverse Customer Balance
      const { data: customer } = await supabaseAdmin
        .from("customers")
        .select("outstanding_balance")
        .eq("id", payment.customer_id)
        .single();
      if (customer) {
        await supabaseAdmin
          .from("customers")
          .update({
            outstanding_balance:
              (customer.outstanding_balance || 0) + payment.amount,
          })
          .eq("id", payment.customer_id);
      }

      // 3. Update Invoice to Partial/Unpaid
      const { data: invoice } = await supabaseAdmin
        .from("invoices")
        .select("paid_amount, total_amount")
        .eq("id", payment.invoice_id)
        .single();
      if (invoice) {
        const newPaid = Math.max(
          0,
          (invoice.paid_amount || 0) - payment.amount
        );
        await supabaseAdmin
          .from("invoices")
          .update({
            paid_amount: newPaid,
            status: newPaid === 0 ? "Unpaid" : "Partial",
          })
          .eq("id", payment.invoice_id);
      }

      // 4. Reverse Transaction if it was deposited
      // Note: We check 'deposit_account_id' which requires the SQL update.
      // If column is missing, this part strictly won't run, preventing crash but also preventing logic.
      if (payment.deposit_account_id) {
        await supabaseAdmin.from("account_transactions").insert({
          transaction_no: `RET-${Date.now()}`,
          transaction_type: "Cheque Return",
          from_account_id: payment.deposit_account_id,
          amount: payment.amount,
          description: `Cheque Returned: ${payment.cheque_no} - ${val.reversalNote}`,
          transaction_date: val.date,
          reference_no: payment.cheque_no,
          cheque_status: "Returned",
        });
      }
    }

    return NextResponse.json({ message: "Cheque status updated successfully" });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
