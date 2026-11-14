import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { ensureWebCustomer } from "@/lib/web-auth";
import { deliveryFee, getDeliveryInfo, getProducts } from "@/lib/shop-data";
import { addressSchema, phoneSchema } from "@/lib/shop-address";
import { insertWebOrder, saleRowsFor, type OrderLine } from "@/lib/web-order-create";

const orderSchema = z.object({
  items: z
    .array(z.object({ id: z.string().uuid(), qty: z.coerce.number().int().min(1).max(999) }))
    .min(1, "Your cart is empty")
    .max(200),
  delivery: z.object({ name: z.string().trim().min(2, "Enter the receiver's name").max(120), phone: phoneSchema }).merge(addressSchema),
  paymentMethod: z.enum(["COD", "BANK"]),
  note: z.string().trim().max(500).optional().default(""),
  saveAsDefault: z.boolean().optional().default(true),
});

const fail = (error: string, status = 400) => NextResponse.json({ error }, { status });

/**
 * Place an order (logged-in customers only).
 * Prices, availability and the delivery fee are worked out again here from
 * the database — nothing the browser sends about money is trusted.
 */
export async function POST(request: NextRequest) {
  let customer;
  try {
    customer = await ensureWebCustomer();
  } catch {
    return fail("Could not load your account. Please try again.", 500);
  }
  if (!customer) return fail("Please log in to place your order.", 401);

  const parsed = orderSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message || "Check your order details");
  const v = parsed.data;

  // Same item twice → one line.
  const qtyById = new Map<string, number>();
  for (const i of v.items) qtyById.set(i.id, Math.min(999, (qtyById.get(i.id) || 0) + i.qty));
  const ids = [...qtyById.keys()];

  try {
    const [products, delivery, sales] = await Promise.all([getProducts({ ids, fresh: true }), getDeliveryInfo(), saleRowsFor(ids)]);
    const byId = new Map(products.map((p) => [p.id, p]));

    const lines: OrderLine[] = [];
    for (const id of ids) {
      const p = byId.get(id);
      const sale = sales.get(id);
      if (!p || !sale) return fail("An item in your cart is no longer sold online. Please update your cart and try again.", 409);
      if (!p.available || !p.price) return fail(`${p.name} can't be ordered online right now. Please update your cart and try again.`, 409);
      lines.push({ webProductId: id, saleId: sale.id, productId: sale.product_id, name: p.name, qty: qtyById.get(id)!, mrp: p.mrp || null, unitPrice: p.price });
    }

    const subtotal = lines.reduce((s, l) => s + l.unitPrice * l.qty, 0);
    const order = await insertWebOrder({
      customerId: customer.id,
      delivery: v.delivery,
      paymentMethod: v.paymentMethod,
      note: v.note,
      lines,
      deliveryFee: deliveryFee(subtotal, delivery),
    });

    // Remember name, phone and address for next time.
    if (v.saveAsDefault) {
      await supabaseAdmin
        .from("web_customers")
        .update({
          full_name: customer.full_name || v.delivery.name,
          phone: customer.phone || v.delivery.phone,
          default_address: { line1: v.delivery.line1, line2: v.delivery.line2, city: v.delivery.city, district: v.delivery.district },
          updated_at: new Date().toISOString(),
        })
        .eq("id", customer.id);
    }

    return NextResponse.json({ orderNo: order.no, total: order.total }, { status: 201 });
  } catch (e) {
    console.error("Web order failed", e);
    return fail("Could not place the order. Please try again.", 500);
  }
}
