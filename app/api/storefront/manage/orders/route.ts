import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

// GET /api/storefront/manage/orders
// Returns all storefront orders with customer, item, tracking, and invoice details
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const search = searchParams.get("search")?.toLowerCase();

    let query = supabaseAdmin
      .from("storefront_orders")
      .select(`
        *,
        invoices (
          id,
          invoice_no,
          total_amount,
          created_at
        )
      `)
      .order("created_at", { ascending: false });

    if (status && status !== "all") {
      query = query.eq("order_status", status);
    }

    const { data: orders, error } = await query;
    if (error && error.code !== "PGRST116" && !error.message.includes("does not exist") && !error.message.includes("schema cache")) {
      throw error;
    }

    let result = orders || [];
    if (search) {
      result = result.filter((o: any) =>
        o.order_no?.toLowerCase().includes(search) ||
        o.customer_name?.toLowerCase().includes(search) ||
        o.customer_phone?.toLowerCase().includes(search) ||
        o.customer_email?.toLowerCase().includes(search)
      );
    }

    const mapped = result.map((o: any) => ({
      id: o.id,
      orderNo: o.order_no,
      userId: o.user_id,
      customerName: o.customer_name,
      customerPhone: o.customer_phone,
      customerEmail: o.customer_email,
      deliveryAddress: o.delivery_address,
      items: o.items || [],
      subTotal: Number(o.sub_total || 0),
      discountAmount: Number(o.discount_amount || 0),
      deliveryFee: Number(o.delivery_fee || 0),
      grandTotal: Number(o.grand_total || 0),
      paymentMethod: o.payment_method || "COD",
      paymentStatus: o.payment_status || "Pending",
      bankSlipUrl: o.bank_slip_url,
      orderStatus: o.order_status || "Pending",
      invoiceId: o.invoice_id || o.invoices?.id,
      invoiceNo: o.invoices?.invoice_no,
      courierOrLorry: o.courier_or_lorry,
      trackingNumber: o.tracking_number,
      estimatedDelivery: o.estimated_delivery,
      dispatchedAt: o.dispatched_at,
      deliveredAt: o.delivered_at,
      statusHistory: o.status_history || [],
      notes: o.notes,
      createdAt: o.created_at,
    }));

    return NextResponse.json(mapped);
  } catch (error: any) {
    console.error("Storefront orders GET error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PATCH /api/storefront/manage/orders
// Updates order lifecycle status (Pending -> Confirmed -> Processing -> Dispatched -> Delivered)
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      orderId,
      orderStatus,
      paymentStatus,
      courierOrLorry,
      trackingNumber,
      estimatedDelivery,
      notes,
      staffNote,
    } = body;

    if (!orderId) {
      return NextResponse.json({ error: "Order ID is required" }, { status: 400 });
    }

    // 1. Fetch current order to update status history
    const { data: currentOrder, error: fetchErr } = await supabaseAdmin
      .from("storefront_orders")
      .select("order_status, status_history")
      .eq("id", orderId)
      .single();

    if (fetchErr) throw fetchErr;

    const history = Array.isArray(currentOrder.status_history) ? [...currentOrder.status_history] : [];
    if (orderStatus && orderStatus !== currentOrder.order_status) {
      history.push({
        status: orderStatus,
        timestamp: new Date().toISOString(),
        note: staffNote || `Status updated to ${orderStatus}`,
      });
    }

    const updates: any = {
      status_history: history,
      updated_at: new Date().toISOString(),
    };

    if (orderStatus) updates.order_status = orderStatus;
    if (paymentStatus) updates.payment_status = paymentStatus;
    if (courierOrLorry !== undefined) updates.courier_or_lorry = courierOrLorry;
    if (trackingNumber !== undefined) updates.tracking_number = trackingNumber;
    if (estimatedDelivery !== undefined) updates.estimated_delivery = estimatedDelivery;
    if (notes !== undefined) updates.notes = notes;

    if (orderStatus === "Dispatched") {
      updates.dispatched_at = new Date().toISOString();
    } else if (orderStatus === "Delivered") {
      updates.delivered_at = new Date().toISOString();
      if (!updates.payment_status) updates.payment_status = "Paid";
    }

    const { data, error } = await supabaseAdmin
      .from("storefront_orders")
      .update(updates)
      .eq("id", orderId)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error("Storefront orders PATCH error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
