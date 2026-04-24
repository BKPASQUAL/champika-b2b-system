// app/api/finance/accounts/[id]/transactions/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const { data, error } = await supabaseAdmin
      .from("account_transactions")
      .select(
        `
        *,
        from_account:from_account_id ( account_name ),
        to_account:to_account_id ( account_name ),
        payment:payment_id (
          id,
          method,
          cheque_no,
          cheque_date,
          cheque_status,
          customers ( id, shop_name, owner_name ),
          bank_codes:bank_id ( bank_code, bank_name ),
          invoices (
            invoice_no,
            orders (
              business_id,
              businesses ( name )
            )
          )
        )
      `
      )
      .or(`from_account_id.eq.${id},to_account_id.eq.${id}`)
      .order("transaction_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) throw error;

    // Flatten nested payment data for convenience
    const enriched = (data || []).map((tx: any) => {
      const payment = tx.payment ?? null;
      const customer = payment?.customers ?? null;
      const invoice = Array.isArray(payment?.invoices) ? payment.invoices[0] : payment?.invoices ?? null;
      const order = Array.isArray(invoice?.orders) ? invoice.orders[0] : invoice?.orders ?? null;
      const business = Array.isArray(order?.businesses) ? order.businesses[0] : order?.businesses ?? null;
      const bankCode = payment?.bank_codes ?? null;

      return {
        id: tx.id,
        transaction_no: tx.transaction_no,
        transaction_type: tx.transaction_type,
        transaction_date: tx.transaction_date,
        amount: tx.amount,
        description: tx.description,
        reference_no: tx.reference_no,
        from_account_id: tx.from_account_id,
        to_account_id: tx.to_account_id,
        from_account: tx.from_account,
        to_account: tx.to_account,
        created_at: tx.created_at,
        // Customer / supplier
        customer_name: customer?.shop_name || customer?.owner_name || null,
        // Business
        business_name: business?.name || null,
        // Cheque details
        payment_method: payment?.method || null,
        cheque_no: payment?.cheque_no || null,
        cheque_date: payment?.cheque_date || null,
        cheque_status: payment?.cheque_status || null,
        cheque_bank_code: bankCode?.bank_code || null,
        cheque_bank_name: bankCode?.bank_name || null,
        // Invoice
        invoice_no: invoice?.invoice_no || tx.reference_no || null,
      };
    });

    return NextResponse.json(enriched);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
