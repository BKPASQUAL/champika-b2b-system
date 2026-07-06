import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

// GET: single quotation with stock info per item
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const { data: q, error } = await supabaseAdmin
      .from("quotations")
      .select(`
        *,
        customers (
          id,
          shop_name,
          owner_name,
          phone
        )
      `)
      .eq("id", id)
      .single();

    if (error) throw error;
    if (!q) return NextResponse.json({ error: "Quotation not found" }, { status: 404 });

    // Fetch current stock per product for reference display
    const productIds = (q.items || []).map((i: any) => i.productId).filter(Boolean);
    let stockMap: Record<string, number> = {};

    if (productIds.length > 0) {
      const { data: products } = await supabaseAdmin
        .from("products")
        .select("id, stock_quantity")
        .in("id", productIds);
      (products || []).forEach((p: any) => {
        stockMap[p.id] = p.stock_quantity || 0;
      });
    }

    // If converted, fetch invoice number
    let convertedInvoiceNo: string | null = null;
    if (q.converted_invoice_id) {
      const { data: inv } = await supabaseAdmin
        .from("invoices")
        .select("invoice_no")
        .eq("id", q.converted_invoice_id)
        .single();
      convertedInvoiceNo = inv?.invoice_no || null;
    }

    return NextResponse.json({
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
      convertedInvoiceNo,
      convertedAt: q.converted_at,
      createdAt: q.created_at,
      businessId: q.business_id,
      salesRepId: q.sales_rep_id,
      customerId: q.customers?.id,
      customerName: q.customers?.shop_name || "Unknown",
      customerOwner: q.customers?.owner_name,
      customerPhone: q.customers?.phone,
      items: (q.items || []).map((item: any) => ({
        ...item,
        currentStock: stockMap[item.productId] ?? 0,
      })),
    });
  } catch (error: any) {
    console.error("Quotation GET [id] error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT: full update of an Active quotation (items, totals, customer, date, etc.)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const { data: existing } = await supabaseAdmin
      .from("quotations")
      .select("status")
      .eq("id", id)
      .single();

    if (!existing) return NextResponse.json({ error: "Quotation not found" }, { status: 404 });
    if (existing.status === "Converted") {
      return NextResponse.json({ error: "Cannot edit a converted quotation" }, { status: 400 });
    }

    const body = await request.json();
    const {
      customerId, invoiceDate, paymentType, notes,
      items, subTotal, extraDiscountPercent, extraDiscountAmount, grandTotal,
    } = body;

    const { error } = await supabaseAdmin
      .from("quotations")
      .update({
        customer_id: customerId,
        invoice_date: invoiceDate,
        payment_type: paymentType,
        notes: notes || null,
        items,
        sub_total: subTotal,
        extra_discount_percent: extraDiscountPercent,
        extra_discount_amount: extraDiscountAmount,
        grand_total: grandTotal,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Quotation PUT error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PATCH: update quotation status (e.g. mark as Converted after invoice creation)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { status, converted_invoice_id, converted_at } = body;

    const update: Record<string, any> = { updated_at: new Date().toISOString() };
    if (status) update.status = status;
    if (converted_invoice_id) update.converted_invoice_id = converted_invoice_id;
    if (converted_at) update.converted_at = converted_at;

    const { error } = await supabaseAdmin.from("quotations").update(update).eq("id", id);
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Quotation PATCH error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE: delete quotation (only if Active)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const { data: q } = await supabaseAdmin
      .from("quotations")
      .select("status")
      .eq("id", id)
      .single();

    if (!q) return NextResponse.json({ error: "Quotation not found" }, { status: 404 });
    if (q.status === "Converted") {
      return NextResponse.json({ error: "Cannot delete a converted quotation" }, { status: 400 });
    }

    const { error } = await supabaseAdmin.from("quotations").delete().eq("id", id);
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Quotation DELETE error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
