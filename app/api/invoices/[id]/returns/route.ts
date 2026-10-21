import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { BUSINESS_IDS } from "@/app/config/business-constants";

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

    const invoiceNo = invoice.invoice_no || "";

    // 2. Check if this is an inter-branch monthly bill (e.g. SI-DI-2026-10, OR-DI-2026-10, DI-2026-10)
    const ibMatch = invoiceNo.match(/^(OR-RE|OR-DI|RE|DI|SI-RE|SI-DI)-(\d{4})-(\d{2})$/i);
    if (ibMatch) {
      const prefix = ibMatch[1].toUpperCase();
      const year = parseInt(ibMatch[2], 10);
      const month = parseInt(ibMatch[3], 10);
      const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
      const nextMonthYear = month === 12 ? year + 1 : year;
      const nextMonthNum = month === 12 ? 1 : month + 1;
      const nextMonthStart = `${nextMonthYear}-${String(nextMonthNum).padStart(2, "0")}-01`;

      const isDistribution = prefix.endsWith("-DI") || prefix === "DI";
      const targetBusinessId = isDistribution
        ? BUSINESS_IDS.CHAMPIKA_DISTRIBUTION
        : BUSINESS_IDS.CHAMPIKA_RETAIL;

      let agencyName = "Wireman";
      if (prefix.startsWith("SI")) agencyName = "Sierra";
      else if (prefix.startsWith("OR")) agencyName = "Orange";

      const { data: ibReturns, error: ibError } = await supabaseAdmin
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
          products!inner (
            name,
            sku,
            selling_price,
            cost_price,
            supplier_name
          ),
          profiles (
            full_name
          )
        `
        )
        .eq("business_id", targetBusinessId)
        .ilike("products.supplier_name", `%${agencyName}%`)
        .gte("created_at", startDate)
        .lt("created_at", nextMonthStart)
        .order("created_at", { ascending: false });

      if (ibError) throw ibError;
      return NextResponse.json(ibReturns || []);
    }

    // 3. Standard Invoice: Fetch Returns containing this invoice number or order ID in the reason
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
          selling_price,
          cost_price
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
