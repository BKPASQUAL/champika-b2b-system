import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // 1. Get Invoice Number first
    const { data: invoice, error: invError } = await supabaseAdmin
      .from("invoices")
      .select("invoice_no")
      .eq("id", id)
      .single();

    if (invError || !invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    // 2. Fetch Returns containing this invoice number in the reason
    // Since we store it as "[INV-XXX] Reason", we search using ILIKE
    const searchPattern = `%[${invoice.invoice_no}]%`;

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
      .ilike("reason", searchPattern)
      .order("created_at", { ascending: false });

    if (retError) throw retError;

    return NextResponse.json(returns);
  } catch (error: any) {
    console.error("Error fetching invoice returns:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
