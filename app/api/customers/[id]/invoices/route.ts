import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Fetch directly from 'invoices' table instead of 'orders'
    const { data, error } = await supabaseAdmin
      .from("invoices")
      .select("id, invoice_no, created_at, total_amount")
      .eq("customer_id", id)
      .order("created_at", { ascending: false });

    if (error) throw error;

    const invoices = data.map((inv) => ({
      id: inv.id,
      invoiceNo: inv.invoice_no,
      date: inv.created_at,
      amount: inv.total_amount,
    }));

    return NextResponse.json(invoices);
  } catch (error: any) {
    console.error("Error fetching customer invoices:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
