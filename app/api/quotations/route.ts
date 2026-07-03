import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { BUSINESS_IDS } from "@/app/config/business-constants";

// GET: list quotations for a business
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get("businessId") || BUSINESS_IDS.CHAMPIKA_RETAIL;

    const { data, error } = await supabaseAdmin
      .from("quotations")
      .select(`
        id,
        quotation_no,
        invoice_date,
        sub_total,
        extra_discount_percent,
        extra_discount_amount,
        grand_total,
        payment_type,
        status,
        notes,
        converted_invoice_id,
        converted_at,
        created_at,
        items,
        customers (
          id,
          shop_name,
          owner_name
        )
      `)
      .eq("business_id", businessId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    const quotations = (data || []).map((q: any) => ({
      id: q.id,
      quotationNo: q.quotation_no,
      date: q.invoice_date,
      subTotal: q.sub_total,
      extraDiscountPercent: q.extra_discount_percent,
      extraDiscountAmount: q.extra_discount_amount,
      grandTotal: q.grand_total,
      paymentType: q.payment_type,
      status: q.status,
      notes: q.notes,
      convertedInvoiceId: q.converted_invoice_id,
      convertedAt: q.converted_at,
      createdAt: q.created_at,
      itemCount: Array.isArray(q.items) ? q.items.length : 0,
      customerId: q.customers?.id,
      customerName: q.customers?.shop_name || "Unknown Customer",
      customerOwner: q.customers?.owner_name,
    }));

    return NextResponse.json(quotations);
  } catch (error: any) {
    console.error("Quotations GET error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST: create quotation (no stock reduction)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      customerId,
      businessId = BUSINESS_IDS.CHAMPIKA_RETAIL,
      salesRepId,
      items,
      invoiceDate,
      subTotal,
      extraDiscountPercent = 0,
      extraDiscountAmount = 0,
      grandTotal,
      paymentType = "Cash",
      notes,
    } = body;

    if (!customerId) return NextResponse.json({ error: "Customer is required" }, { status: 400 });
    if (!items || items.length === 0) return NextResponse.json({ error: "At least one item is required" }, { status: 400 });

    // Generate quotation number (QUO-0001 format)
    const { data: existing } = await supabaseAdmin
      .from("quotations")
      .select("quotation_no")
      .ilike("quotation_no", "QUO-%");

    const maxSeq = Math.max(
      0,
      ...(existing ?? []).map((q: any) => {
        const parts = (q.quotation_no as string).split("-");
        const n = parseInt(parts[parts.length - 1], 10);
        return isNaN(n) ? 0 : n;
      })
    );
    const quotationNo = `QUO-${String(maxSeq + 1).padStart(4, "0")}`;

    const { data, error } = await supabaseAdmin
      .from("quotations")
      .insert({
        quotation_no: quotationNo,
        customer_id: customerId,
        business_id: businessId,
        sales_rep_id: salesRepId || null,
        items: items,
        invoice_date: invoiceDate || new Date().toISOString().split("T")[0],
        sub_total: subTotal,
        extra_discount_percent: extraDiscountPercent,
        extra_discount_amount: extraDiscountAmount,
        grand_total: grandTotal,
        payment_type: paymentType,
        status: "Active",
        notes: notes || null,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ data }, { status: 201 });
  } catch (error: any) {
    console.error("Quotations POST error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
