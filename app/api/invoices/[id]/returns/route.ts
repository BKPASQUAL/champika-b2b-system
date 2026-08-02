import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // 1. Get Invoice Number and order_id first
    const { data: invoice, error: invError } = await supabaseAdmin
      .from("invoices")
      .select("invoice_no, order_id")
      .eq("id", id)
      .single();

    if (invError || !invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    // 2. Fetch Returns containing this invoice number or order ID in the reason
    const searchConditions: string[] = [];
    if (invoice.invoice_no) {
      searchConditions.push(`reason.ilike.%${invoice.invoice_no}%`);
    }
    if (invoice.order_id) {
      searchConditions.push(`reason.ilike.%ORD-${invoice.order_id}%`);
    }

    const { data: returns, error: retError } = await supabaseAdmin
      .from("inventory_returns")
      .select(
        `
        id,
        return_number,
        created_at,
        quantity,
        return_type,
        reason,
        product_id,
        products (
          name,
          sku,
          selling_price
        ),
        profiles (
          full_name
        )
      `
      )
      .or(searchConditions.length > 0 ? searchConditions.join(",") : `reason.ilike.%${id}%`)
      .order("created_at", { ascending: false });

    if (retError) throw retError;

    return NextResponse.json(returns);
  } catch (error: any) {
    console.error("Error fetching invoice returns:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
