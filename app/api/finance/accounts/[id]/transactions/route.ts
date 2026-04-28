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

    // For transactions with no payment_id (supplier cheque payments), look up
    // cheque details from supplier_payments using reference_no as the cheque number.
    const orphanRefs = (data || [])
      .filter((tx: any) => !tx.payment_id && tx.reference_no)
      .map((tx: any) => tx.reference_no as string);

    let supplierChequeMap: Record<string, any> = {};
    if (orphanRefs.length > 0) {
      const { data: spRows } = await supabaseAdmin
        .from("supplier_payments")
        .select("cheque_number, cheque_date, cheque_status, notes, suppliers ( name )")
        .in("cheque_number", orphanRefs);

      for (const sp of spRows ?? []) {
        supplierChequeMap[sp.cheque_number] = sp;
      }
    }

    // Flatten nested payment data for convenience
    const enriched = (data || []).map((tx: any) => {
      const payment = tx.payment ?? null;
      const customer = payment?.customers ?? null;
      const invoice = Array.isArray(payment?.invoices) ? payment.invoices[0] : payment?.invoices ?? null;
      const order = Array.isArray(invoice?.orders) ? invoice.orders[0] : invoice?.orders ?? null;
      const business = Array.isArray(order?.businesses) ? order.businesses[0] : order?.businesses ?? null;
      const bankCode = payment?.bank_codes ?? null;

      // Supplier cheque fallback (when no payment_id link exists)
      const sp = !payment && tx.reference_no ? (supplierChequeMap[tx.reference_no] ?? null) : null;

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
        // Customer / supplier name
        customer_name: customer?.shop_name || customer?.owner_name || sp?.suppliers?.name || null,
        // Business
        business_name: business?.name || null,
        // Cheque details — customer payment first, then supplier cheque fallback
        payment_method: payment?.method || (sp ? "cheque" : null),
        cheque_no:      payment?.cheque_no   || sp?.cheque_number || null,
        cheque_date:    payment?.cheque_date  || sp?.cheque_date   || null,
        cheque_status:  payment?.cheque_status || sp?.cheque_status || null,
        cheque_bank_code: bankCode?.bank_code || null,
        cheque_bank_name: bankCode?.bank_name || null,
        // Invoice
        invoice_no: invoice?.invoice_no || null,
        // Notes — from supplier payment (customer payments don't carry notes here)
        notes: sp?.notes || null,
      };
    });

    return NextResponse.json(enriched);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
