import { supabaseAdmin } from "@/lib/supabase-admin";

/** A customer's own orders, as shown in "My orders". */

export type OrderStatus = "New" | "Confirmed" | "Packed" | "Dispatched" | "Delivered" | "Cancelled";
export type PaymentStatus = "pending" | "slip_uploaded" | "verified" | "failed";

export type MyOrderSummary = {
  no: string;
  createdAt: string;
  status: OrderStatus;
  paymentMethod: "COD" | "BANK" | "CARD";
  paymentStatus: PaymentStatus;
  total: number;
  itemCount: number;
  firstImage: string | null;
};

export type MyOrder = MyOrderSummary & {
  deliveryName: string;
  deliveryPhone: string;
  deliveryAddress: Record<string, string>;
  subtotal: number;
  discount: number;
  deliveryFee: number;
  note: string | null;
  hasSlip: boolean;
  items: { id: string | null; name: string; slug: string | null; image: string | null; qty: number; unitPrice: number; mrp: number | null; lineTotal: number }[];
};

const n = (v: unknown) => Number(v) || 0;

export async function getMyOrders(customerId: string, limit = 50): Promise<MyOrderSummary[]> {
  const { data } = await supabaseAdmin
    .from("web_orders")
    .select("web_order_no, created_at, status, payment_method, payment_status, total, web_order_items(qty, web_products(images))")
    .eq("web_customer_id", customerId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data || []).map((o: any) => ({
    no: o.web_order_no,
    createdAt: o.created_at,
    status: o.status,
    paymentMethod: o.payment_method,
    paymentStatus: o.payment_status,
    total: n(o.total),
    itemCount: (o.web_order_items || []).reduce((s: number, i: any) => s + n(i.qty), 0),
    firstImage: o.web_order_items?.find((i: any) => i.web_products?.images?.[0])?.web_products.images[0] ?? null,
  }));
}

/** One order, only if it belongs to this customer. */
export async function getMyOrder(customerId: string, no: string): Promise<MyOrder | null> {
  const { data: o } = await supabaseAdmin
    .from("web_orders")
    .select("*, web_order_items(web_product_id, name, qty, unit_price, mrp, line_total, web_products(slug, images))")
    .eq("web_order_no", no)
    .eq("web_customer_id", customerId)
    .maybeSingle();
  if (!o) return null;
  const items = (o.web_order_items || []).map((i: any) => ({
    id: (i.web_product_id as string | null) ?? null,
    name: i.name,
    slug: i.web_products?.slug ?? null,
    image: i.web_products?.images?.[0] ?? null,
    qty: n(i.qty),
    unitPrice: n(i.unit_price),
    mrp: i.mrp == null ? null : n(i.mrp),
    lineTotal: n(i.line_total),
  }));
  return {
    no: o.web_order_no,
    createdAt: o.created_at,
    status: o.status,
    paymentMethod: o.payment_method,
    paymentStatus: o.payment_status,
    total: n(o.total),
    itemCount: items.reduce((s: number, i: { qty: number }) => s + i.qty, 0),
    firstImage: items[0]?.image ?? null,
    deliveryName: o.delivery_name,
    deliveryPhone: o.delivery_phone,
    deliveryAddress: o.delivery_address || {},
    subtotal: n(o.subtotal),
    discount: n(o.discount_amount),
    deliveryFee: n(o.delivery_fee),
    note: o.customer_note,
    hasSlip: !!o.slip_path,
    items,
  };
}

/** Customer-friendly words for each status. */
export const STATUS_TEXT: Record<OrderStatus, { label: string; text: string }> = {
  New: { label: "Order placed", text: "We received your order and will call you to confirm it." },
  Confirmed: { label: "Confirmed", text: "Your order is confirmed and being prepared." },
  Packed: { label: "Packed", text: "Your items are packed and ready to go." },
  Dispatched: { label: "On the way", text: "Your order has left our store." },
  Delivered: { label: "Delivered", text: "Your order was delivered. Thank you!" },
  Cancelled: { label: "Cancelled", text: "This order was cancelled." },
};

export const PAYMENT_TEXT: Record<PaymentStatus, string> = {
  pending: "Waiting for payment",
  slip_uploaded: "Slip received, checking",
  verified: "Paid",
  failed: "Payment problem",
};
