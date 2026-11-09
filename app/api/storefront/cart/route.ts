import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { deliveryFee, getDeliveryInfo, getProducts } from "@/lib/shop-data";
import { getAlternatives } from "@/lib/web-compare";

const schema = z.object({
  items: z
    .array(z.object({ id: z.string().uuid(), qty: z.coerce.number().int().min(1).max(999) }))
    .max(200),
});

/**
 * Public: price the visitor's cart from the database (never trusts browser
 * prices). Items that were removed or unpublished come back in `missing`.
 */
export async function POST(request: NextRequest) {
  let body: z.infer<typeof schema>;
  try {
    body = schema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid cart" }, { status: 400 });
  }
  try {
    const ids = [...new Set(body.items.map((i) => i.id))];
    // All products once: prices the cart and finds the same item from other brands.
    const [all, delivery] = await Promise.all([getProducts(), getDeliveryInfo()]);
    const products = all.filter((p) => ids.includes(p.id));
    const byId = new Map(products.map((p) => [p.id, p]));
    const others = await getAlternatives(products.map((p) => p.id), all).catch(() => ({}) as Awaited<ReturnType<typeof getAlternatives>>);

    const lines = body.items
      .filter((i) => byId.has(i.id))
      .map((i) => {
        const p = byId.get(i.id)!;
        return {
          id: p.id,
          slug: p.slug,
          name: p.name,
          image: p.image,
          brand: p.brand,
          mrp: p.mrp,
          price: p.price,
          discountPct: p.discountPct,
          available: p.available,
          qty: i.qty,
          lineTotal: p.available ? p.price * i.qty : 0,
          /** Same item from other brands, cheapest first. */
          others: others[p.id] || [],
        };
      });
    const subtotal = lines.reduce((s, l) => s + l.lineTotal, 0);
    const mrpTotal = lines.filter((l) => l.available).reduce((s, l) => s + Math.max(l.mrp, l.price) * l.qty, 0);
    const fee = deliveryFee(subtotal, delivery);

    return NextResponse.json({
      lines,
      missing: ids.filter((id) => !byId.has(id)),
      subtotal,
      savings: Math.max(0, mrpTotal - subtotal),
      deliveryFee: fee,
      freeDeliveryOver: delivery.freeOver,
      total: subtotal + fee,
    });
  } catch {
    return NextResponse.json({ error: "Could not load the cart. Please try again." }, { status: 500 });
  }
}
