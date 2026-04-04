import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const unpaidOnly = searchParams.get("unpaid") === "true";

    if (unpaidOnly) {
      // Single query: join invoices with orders using !inner so only invoices
      // that have a matching order are returned, then filter on both tables.
      const { data, error } = await supabaseAdmin
        .from("invoices")
        .select(
          "id, invoice_no, created_at, total_amount, due_amount, due_date, status, orders!inner(status)"
        )
        .eq("customer_id", id)
        .in("status", ["Unpaid", "Partial", "Overdue"])
        .filter("orders.status", "in", "(Delivered)");

      if (error) {
        console.error("Unpaid invoices query error:", error);
        throw error;
      }

      const invoices = (data ?? []).map((inv: any) => ({
        id: inv.id,
        invoiceNo: inv.invoice_no,
        date: inv.created_at,
        amount: inv.total_amount,
        dueAmount: inv.due_amount,
        dueDate: inv.due_date,
        status: inv.status,
      }));

      return NextResponse.json(invoices);
    }

    // Default: return all invoices for this customer
    const { data, error } = await supabaseAdmin
      .from("invoices")
      .select("id, invoice_no, created_at, total_amount, due_amount, due_date, status")
      .eq("customer_id", id)
      .order("created_at", { ascending: false });

    if (error) throw error;

    const invoices = (data ?? []).map((inv: any) => ({
      id: inv.id,
      invoiceNo: inv.invoice_no,
      date: inv.created_at,
      amount: inv.total_amount,
      dueAmount: inv.due_amount,
      dueDate: inv.due_date,
      status: inv.status,
    }));

    return NextResponse.json(invoices);
  } catch (error: any) {
    console.error("Error fetching customer invoices:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
