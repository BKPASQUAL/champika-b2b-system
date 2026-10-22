import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

// POST /api/storefront/public/checkout
// Creates an authenticated online customer order on BK Wiring Kade
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      userId,
      customerName,
      customerPhone,
      customerEmail,
      deliveryAddress,
      items,
      subTotal,
      discountAmount = 0,
      deliveryFee = 0,
      grandTotal,
      paymentMethod = "COD",
      bankSlipUrl,
      notes,
    } = body;

    if (!customerName || !customerPhone || !deliveryAddress) {
      return NextResponse.json({ error: "Customer name, phone number, and delivery address are required." }, { status: 400 });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "Order must contain at least one item." }, { status: 400 });
    }

    // Generate Order Number: STO-XXXX format
    const prefix = "STO";
    const { data: latestOrder } = await supabaseAdmin
      .from("storefront_orders")
      .select("order_no")
      .ilike("order_no", `${prefix}-%`)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let seq = 1;
    if (latestOrder && latestOrder.order_no) {
      const parts = latestOrder.order_no.split("-");
      const num = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(num)) seq = num + 1;
    }
    const orderNo = `${prefix}-${String(seq).padStart(4, "0")}`;

    const initialHistory = [
      {
        status: "Pending",
        timestamp: new Date().toISOString(),
        note: `Order placed online via ${paymentMethod === "COD" ? "Cash on Delivery" : "Bank Transfer"}`,
      },
    ];

    const payload = {
      order_no: orderNo,
      user_id: userId || null,
      customer_name: customerName.trim(),
      customer_phone: customerPhone.trim(),
      customer_email: customerEmail ? customerEmail.trim() : "",
      delivery_address: deliveryAddress.trim(),
      items: items,
      sub_total: Number(subTotal || grandTotal),
      discount_amount: Number(discountAmount || 0),
      delivery_fee: Number(deliveryFee || 0),
      grand_total: Number(grandTotal),
      payment_method: paymentMethod,
      payment_status: "Pending",
      bank_slip_url: bankSlipUrl || null,
      order_status: "Pending",
      status_history: initialHistory,
      notes: notes || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data: createdOrder, error } = await supabaseAdmin
      .from("storefront_orders")
      .insert(payload)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      orderNo: orderNo,
      orderId: createdOrder.id,
      trackingUrl: `/track/${orderNo}`,
    });
  } catch (error: any) {
    console.error("Public checkout error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
