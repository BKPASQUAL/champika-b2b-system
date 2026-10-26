import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { BUSINESS_IDS } from "@/app/config/business-constants";
import { getStandardInvoiceReturns } from "./standard";
import { autoApplyPendingReturns } from "@/lib/return-invoice-adjust";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // 1. Get Invoice Number and order_id first
    const { data: invoice, error: invError } = await supabaseAdmin
      .from("invoices")
      .select("invoice_no, order_id, customer_id")
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

    // 3. Standard Invoice: returns tagged with this bill (plus, on request,
    // unlinked Good returns of this customer that belong to this bill)
    if (!request.nextUrl.searchParams.get("includeUnlinked")) {
      const all = await getStandardInvoiceReturns(id, { ...invoice, customer_id: null });
      return NextResponse.json(all);
    }
    let returns = await getStandardInvoiceReturns(id, invoice);
    // Office good returns that belong to this bill but were never deducted:
    // take them off the bill now, then reload so the page shows the result
    const applied = await autoApplyPendingReturns(id, returns);
    if (applied > 0) {
      returns = await getStandardInvoiceReturns(id, invoice);
      return NextResponse.json(returns, { headers: { "X-Returns-Applied": String(applied) } });
    }
    return NextResponse.json(returns);
  } catch (error: any) {
    console.error("Error fetching invoice returns:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
