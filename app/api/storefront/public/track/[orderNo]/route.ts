import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

// GET /api/storefront/public/track/[orderNo]
// Returns live tracking information for a customer order
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderNo: string }> }
) {
  try {
    const { orderNo } = await params;

    if (!orderNo) {
      return NextResponse.json({ error: "Order number is required." }, { status: 400 });
    }

    const { data: order, error } = await supabaseAdmin
      .from("storefront_orders")
      .select(`
        id,
        order_no,
        customer_name,
        customer_phone,
        delivery_address,
        items,
        sub_total,
        discount_amount,
        delivery_fee,
        grand_total,
        payment_method,
        payment_status,
        order_status,
        invoice_id,
        courier_or_lorry,
        tracking_number,
        estimated_delivery,
        dispatched_at,
        delivered_at,
        status_history,
        created_at,
        invoices (
          id,
          invoice_no
        )
      `)
      .ilike("order_no", orderNo.trim())
      .maybeSingle();

    if (error && error.code !== "PGRST116" && !error.message.includes("does not exist") && !error.message.includes("schema cache")) {
      throw error;
    }

    if (!order) {
      return NextResponse.json({ error: "Order not found. Please check your order number." }, { status: 404 });
    }

    // Determine current stepper stage (1 to 5)
    // 1: Pending (Order Placed)
    // 2: Confirmed
    // 3: Processing / Packing
    // 4: Dispatched
    // 5: Delivered
    let currentStep = 1;
    switch (order.order_status) {
      case "Pending":
        currentStep = 1;
        break;
      case "Confirmed":
        currentStep = 2;
        break;
      case "Processing":
        currentStep = 3;
        break;
      case "Dispatched":
        currentStep = 4;
        break;
      case "Delivered":
        currentStep = 5;
        break;
      case "Cancelled":
        currentStep = 0;
        break;
      default:
        currentStep = 1;
    }

    return NextResponse.json({
      orderNo: order.order_no,
      orderId: order.id,
      customerName: order.customer_name,
      deliveryAddress: order.delivery_address,
      items: order.items || [],
      subTotal: Number(order.sub_total || 0),
      discountAmount: Number(order.discount_amount || 0),
      deliveryFee: Number(order.delivery_fee || 0),
      grandTotal: Number(order.grand_total || 0),
      paymentMethod: order.payment_method,
      paymentStatus: order.payment_status,
      orderStatus: order.order_status,
      currentStep: currentStep,
      invoiceId: order.invoice_id || (order.invoices ? (order.invoices as any).id : null),
      invoiceNo: order.invoices ? (order.invoices as any).invoice_no : null,
      courierOrLorry: order.courier_or_lorry,
      trackingNumber: order.tracking_number,
      estimatedDelivery: order.estimated_delivery,
      dispatchedAt: order.dispatched_at,
      deliveredAt: order.delivered_at,
      statusHistory: order.status_history || [],
      createdAt: order.created_at,
    });
  } catch (error: any) {
    console.error("Order tracking error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
