import { supabaseAdmin } from "@/lib/supabase-admin";
import { nextRunningNo } from "@/lib/web-utils";
import type { ShopAddress } from "@/lib/shop-address";

/** One order line with its final price (already checked by the caller). */
export type OrderLine = {
  webProductId: string;
  saleId: string; // web_product_variants.id
  productId: string; // main products.id
  name: string;
  qty: number;
  mrp: number | null;
  unitPrice: number;
};

/**
 * Insert a website order + its lines. Used by checkout and by accepted
 * quotations, so both create orders exactly the same way.
 * Order numbers WEB-000001…; a clash with a simultaneous order is retried.
 */
export async function insertWebOrder(input: {
  customerId: string;
  delivery: { name: string; phone: string } & ShopAddress;
  paymentMethod: "COD" | "BANK";
  note?: string | null;
  lines: OrderLine[];
  discount?: number;
  deliveryFee: number;
  sourceQuoteId?: string | null;
}): Promise<{ id: string; no: string; total: number }> {
  const subtotal = input.lines.reduce((s, l) => s + l.unitPrice * l.qty, 0);
  const discount = Math.min(subtotal, Math.max(0, input.discount || 0));
  const total = subtotal - discount + input.deliveryFee;
  const address = { line1: input.delivery.line1, line2: input.delivery.line2 || "", city: input.delivery.city, district: input.delivery.district };

  let order: { id: string; web_order_no: string } | null = null;
  for (let attempt = 0; attempt < 4 && !order; attempt++) {
    const no = await nextRunningNo("web_orders", "web_order_no", "WEB");
    const { data, error } = await supabaseAdmin
      .from("web_orders")
      .insert({
        web_order_no: no,
        web_customer_id: input.customerId,
        delivery_name: input.delivery.name,
        delivery_phone: input.delivery.phone,
        delivery_address: address,
        payment_method: input.paymentMethod,
        payment_status: "pending",
        status: "New",
        subtotal,
        discount_amount: discount,
        delivery_fee: input.deliveryFee,
        total,
        customer_note: input.note || null,
        source_quote_id: input.sourceQuoteId || null,
      })
      .select("id, web_order_no")
      .single();
    if (!error) order = data;
    else if (error.code !== "23505") throw error; // 23505 = number already taken
  }
  if (!order) throw new Error("Could not get an order number");

  const { error: itemErr } = await supabaseAdmin.from("web_order_items").insert(
    input.lines.map((l) => ({
      web_order_id: order!.id,
      web_product_id: l.webProductId,
      web_variant_id: l.saleId,
      product_id: l.productId,
      name: l.name,
      qty: l.qty,
      mrp: l.mrp,
      unit_price: l.unitPrice,
      line_total: Math.round(l.unitPrice * l.qty * 100) / 100,
    })),
  );
  if (itemErr) {
    await supabaseAdmin.from("web_orders").delete().eq("id", order.id);
    throw itemErr;
  }
  return { id: order.id, no: order.web_order_no, total };
}

/** Sale row (variant id + main product id) for each web product. */
export async function saleRowsFor(webProductIds: string[]) {
  const map = new Map<string, { id: string; product_id: string }>();
  if (!webProductIds.length) return map;
  const { data, error } = await supabaseAdmin
    .from("web_product_variants")
    .select("id, web_product_id, product_id, sort_order")
    .in("web_product_id", webProductIds)
    .order("sort_order");
  if (error) throw error;
  for (const r of data || []) if (!map.has(r.web_product_id)) map.set(r.web_product_id, { id: r.id, product_id: r.product_id });
  return map;
}
