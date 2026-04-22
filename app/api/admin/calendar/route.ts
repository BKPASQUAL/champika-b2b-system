import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const year = searchParams.get("year") || new Date().getFullYear().toString();
    const month = searchParams.get("month"); // optional: 1-12
    const businessId = searchParams.get("businessId"); // optional: filter by portal

    // Build date range
    let from: string;
    let to: string;
    if (month) {
      const m = parseInt(month);
      const y = parseInt(year);
      from = `${y}-${String(m).padStart(2, "0")}-01`;
      const lastDay = new Date(y, m, 0).getDate();
      to = `${y}-${String(m).padStart(2, "0")}-${lastDay}`;
    } else {
      from = `${year}-01-01`;
      to = `${year}-12-31`;
    }

    // Fetch customer cheques
    let custQuery = supabaseAdmin
      .from("payments")
      .select(`
        id,
        cheque_no,
        cheque_date,
        amount,
        cheque_status,
        customers ( shop_name ),
        invoices!inner (
          invoice_no,
          orders!inner ( business_id )
        )
      `)
      .eq("method", "cheque")
      .gte("cheque_date", from)
      .lte("cheque_date", to)
      .order("cheque_date", { ascending: true });

    if (businessId) {
      custQuery = custQuery.eq("invoices.orders.business_id", businessId);
    }

    const { data: customerCheques, error: custErr } = await custQuery;
    if (custErr) throw custErr;

    // Fetch supplier cheques
    let supQuery = supabaseAdmin
      .from("supplier_payments")
      .select(`
        id,
        cheque_number,
        cheque_date,
        amount,
        cheque_status,
        payment_date,
        suppliers ( name ),
        purchases!inner ( business_id )
      `)
      .eq("payment_method", "cheque")
      .not("cheque_date", "is", null)
      .gte("cheque_date", from)
      .lte("cheque_date", to)
      .order("cheque_date", { ascending: true });

    if (businessId) {
      supQuery = supQuery.eq("purchases.business_id", businessId);
    }

    const { data: supplierCheques, error: supErr } = await supQuery;
    if (supErr) throw supErr;

    const events = [
      ...(customerCheques || []).map((p: any) => {
        const customer = Array.isArray(p.customers) ? p.customers[0] : p.customers;
        const invoice = Array.isArray(p.invoices) ? p.invoices[0] : p.invoices;
        return {
          id: p.id,
          type: "customer" as const,
          date: p.cheque_date,
          cheque_number: p.cheque_no,
          amount: p.amount,
          status: p.cheque_status,
          name: customer?.shop_name || "Unknown",
          reference: invoice?.invoice_no || "N/A",
        };
      }),
      ...(supplierCheques || []).map((p: any) => {
        const supplier = Array.isArray(p.suppliers) ? p.suppliers[0] : p.suppliers;
        return {
          id: p.id,
          type: "supplier" as const,
          date: p.cheque_date,
          cheque_number: p.cheque_number,
          amount: p.amount,
          status: p.cheque_status,
          name: supplier?.name || "Unknown Supplier",
          reference: p.payment_date || "N/A",
        };
      }),
    ];

    return NextResponse.json(events);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
