import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { BUSINESS_IDS } from "@/app/config/business-constants";

// POST /api/storefront/public/quotations
// Generates an official BK WIRING KADE project quotation/estimate (no login required)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      customerName,
      customerPhone,
      projectTitle,
      deliveryAddress,
      items,
      subTotal,
      extraDiscountPercent = 0,
      extraDiscountAmount = 0,
      grandTotal,
      notes,
    } = body;

    if (!customerName || !customerPhone) {
      return NextResponse.json({ error: "Customer name and phone number are required." }, { status: 400 });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "Quotation must have at least one item." }, { status: 400 });
    }

    // 1. Look up or create customer record
    let customerId = null;
    const { data: existingCust } = await supabaseAdmin
      .from("customers")
      .select("id")
      .eq("phone", customerPhone.trim())
      .maybeSingle();

    if (existingCust) {
      customerId = existingCust.id;
    } else {
      const { data: newCust } = await supabaseAdmin
        .from("customers")
        .insert({
          shop_name: customerName.trim(),
          owner_name: customerName.trim(),
          phone: customerPhone.trim(),
          address: deliveryAddress || "",
          business_id: BUSINESS_IDS.CHAMPIKA_ONLINE,
        })
        .select("id")
        .maybeSingle();

      if (newCust) customerId = newCust.id;
    }

    // 2. Generate quotation number (QUO-XXXX format)
    const prefix = "QUO";
    const [createdRes, noRes] = await Promise.all([
      supabaseAdmin
        .from("quotations")
        .select("quotation_no")
        .ilike("quotation_no", `${prefix}-%`)
        .order("created_at", { ascending: false })
        .limit(500),
      supabaseAdmin
        .from("quotations")
        .select("quotation_no")
        .ilike("quotation_no", `${prefix}-%`)
        .order("quotation_no", { ascending: false })
        .limit(500),
    ]);
    const combined = [...(createdRes.data ?? []), ...(noRes.data ?? [])];
    const maxSeq = Math.max(
      0,
      ...combined.map((q: any) => {
        const parts = ((q.quotation_no as string) || "").split("-");
        const n = parseInt(parts[parts.length - 1], 10);
        return isNaN(n) ? 0 : n;
      })
    );
    const quotationNo = `${prefix}-${String(maxSeq + 1).padStart(4, "0")}`;
    const todayStr = new Date().toISOString().split("T")[0];

    const quotationToken = `token_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    const { data: quotation, error } = await supabaseAdmin
      .from("quotations")
      .insert({
        quotation_no: quotationNo,
        customer_id: customerId,
        business_id: BUSINESS_IDS.CHAMPIKA_ONLINE,
        items: items,
        sub_total: Number(subTotal || grandTotal),
        extra_discount_percent: Number(extraDiscountPercent || 0),
        extra_discount_amount: Number(extraDiscountAmount || 0),
        grand_total: Number(grandTotal),
        payment_type: "Cash / Direct Bank Transfer",
        invoice_date: todayStr,
        status: "Active",
        source: "ONLINE_STORE",
        customer_phone: customerPhone.trim(),
        customer_name: customerName.trim(),
        project_title: projectTitle || "Home Wiring Estimate",
        delivery_address: deliveryAddress || "",
        quotation_token: quotationToken,
        notes: notes || `Self-service quote generated on BK Wiring Kade for ${projectTitle || "electrical supplies"}`,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      quotationId: quotation.id,
      quotationNo: quotationNo,
      quotationToken: quotationToken,
      downloadUrl: `/quotation/${quotation.id}?division=online`,
    });
  } catch (error: any) {
    console.error("Public quotation creation error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
