import { supabaseAdmin } from "@/lib/supabase-admin";
import { getProducts } from "@/lib/shop-data";
import { nextRunningNo } from "@/lib/web-utils";
import { insertWebOrder, saleRowsFor } from "@/lib/web-order-create";
import type { PriceTier } from "@/lib/web-pricing";
import type { ShopAddress } from "@/lib/shop-address";

/**
 * Quotations (WQ-000001…):
 *  - "cart": customer sends their cart; prices are filled from the price rules.
 *  - "job":  customer describes the house; the office adds the items.
 * Office adjusts prices → Send → customer Accepts → a normal web order is made
 * at the quoted prices (then it follows the usual confirm → invoice flow).
 */

export class QuoteError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

export type QuoteJob = {
  houseType: string;
  rooms: number | null;
  floors: number | null;
  points: Record<string, number>;
};

export const QUOTE_VALID_DAYS = 14;

/** Today as YYYY-MM-DD in Sri Lanka time. */
const todayLK = () => new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);

export function isExpired(q: { status: string; valid_until: string | null }) {
  return q.status === "Sent" && !!q.valid_until && q.valid_until < todayLK();
}

/** Priced lines for web products at a customer's tier. Unknown / unpriced products are left out. */
export async function priceItems(items: { webProductId: string; qty: number; finalPrice?: number | null }[], tier: PriceTier) {
  const ids = [...new Set(items.map((i) => i.webProductId))];
  const [products, sales] = await Promise.all([getProducts({ ids, tier }), saleRowsFor(ids)]);
  const byId = new Map(products.map((p) => [p.id, p]));
  return items
    .map((i) => {
      const p = byId.get(i.webProductId);
      const sale = sales.get(i.webProductId);
      if (!p || !sale) return null;
      const finalPrice = i.finalPrice != null && i.finalPrice >= 0 ? Math.round(i.finalPrice * 100) / 100 : p.price;
      return {
        web_product_id: p.id,
        web_variant_id: sale.id,
        product_id: sale.product_id,
        name: p.name,
        qty: i.qty,
        mrp: p.mrp || null,
        auto_price: p.price,
        final_price: finalPrice,
        line_total: Math.round(finalPrice * i.qty * 100) / 100,
      };
    })
    .filter(Boolean) as {
    web_product_id: string;
    web_variant_id: string;
    product_id: string;
    name: string;
    qty: number;
    mrp: number | null;
    auto_price: number;
    final_price: number;
    line_total: number;
  }[];
}

/** New quotation request from a customer. */
export async function createQuote(input: {
  customerId: string;
  tier: PriceTier;
  type: "cart" | "job";
  items?: { webProductId: string; qty: number }[];
  job?: QuoteJob;
  note?: string;
  attachmentPaths?: string[];
}) {
  const lines = input.type === "cart" && input.items?.length ? await priceItems(input.items, input.tier) : [];
  if (input.type === "cart" && !lines.length) throw new QuoteError("Your cart has no items we can quote.");
  const subtotal = lines.reduce((s, l) => s + l.line_total, 0);

  let quote: { id: string; quote_no: string } | null = null;
  for (let attempt = 0; attempt < 4 && !quote; attempt++) {
    const no = await nextRunningNo("web_quote_requests", "quote_no", "WQ");
    const { data, error } = await supabaseAdmin
      .from("web_quote_requests")
      .insert({
        quote_no: no,
        web_customer_id: input.customerId,
        type: input.type,
        status: "Requested",
        house_type: input.job?.houseType || null,
        rooms: input.job?.rooms ?? null,
        points: input.job ? { ...input.job.points, floors: input.job.floors ?? undefined } : null,
        attachment_paths: input.attachmentPaths || [],
        customer_note: input.note || null,
        subtotal,
        discount_amount: 0,
        total: subtotal,
      })
      .select("id, quote_no")
      .single();
    if (!error) quote = data;
    else if (error.code !== "23505") throw error;
  }
  if (!quote) throw new QuoteError("Could not create the quotation. Please try again.", 503);

  if (lines.length) {
    const { error } = await supabaseAdmin.from("web_quote_items").insert(lines.map((l) => ({ ...l, quote_id: quote!.id })));
    if (error) {
      await supabaseAdmin.from("web_quote_requests").delete().eq("id", quote.id);
      throw error;
    }
  }
  return { id: quote.id, no: quote.quote_no };
}

/** Office saves the price list (and optionally sends it to the customer). */
export async function saveQuote(
  quoteId: string,
  input: {
    items: { webProductId: string; qty: number; finalPrice: number | null }[];
    discount: number;
    validDays: number;
    staffNote: string | null;
    send: boolean;
  },
) {
  const { data: q } = await supabaseAdmin
    .from("web_quote_requests")
    .select("id, status, web_customers(tier, trade_status)")
    .eq("id", quoteId)
    .maybeSingle();
  if (!q) throw new QuoteError("Quotation not found", 404);
  if (["Accepted", "Rejected"].includes(q.status)) throw new QuoteError(`This quotation is already ${q.status.toLowerCase()}.`);

  const c: any = Array.isArray(q.web_customers) ? q.web_customers[0] : q.web_customers;
  const tier: PriceTier = c?.tier === "trade" && c?.trade_status === "approved" ? "trade" : "normal";
  const lines = await priceItems(input.items, tier);
  if (input.send && !lines.length) throw new QuoteError("Add at least one item before sending.");
  const subtotal = lines.reduce((s, l) => s + l.line_total, 0);
  const discount = Math.min(subtotal, Math.max(0, input.discount));

  const { error: delErr } = await supabaseAdmin.from("web_quote_items").delete().eq("quote_id", quoteId);
  if (delErr) throw delErr;
  if (lines.length) {
    const { error } = await supabaseAdmin.from("web_quote_items").insert(lines.map((l) => ({ ...l, quote_id: quoteId })));
    if (error) throw error;
  }

  const validUntil = new Date(Date.now() + 5.5 * 3600 * 1000 + Math.max(1, input.validDays) * 86400 * 1000).toISOString().slice(0, 10);
  const { error } = await supabaseAdmin
    .from("web_quote_requests")
    .update({
      subtotal,
      discount_amount: discount,
      total: subtotal - discount,
      staff_note: input.staffNote,
      status: input.send ? "Sent" : "Priced",
      ...(input.send ? { sent_at: new Date().toISOString(), valid_until: validUntil } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq("id", quoteId);
  if (error) throw error;
  return { status: input.send ? "Sent" : "Priced", total: subtotal - discount };
}

/** Customer accepts a sent quotation → web order at the quoted prices. */
export async function acceptQuote(
  customerId: string,
  quoteNo: string,
  input: { delivery: { name: string; phone: string } & ShopAddress; paymentMethod: "COD" | "BANK"; deliveryFee: number },
) {
  const { data: q } = await supabaseAdmin
    .from("web_quote_requests")
    .select("*, web_quote_items(*)")
    .eq("quote_no", quoteNo)
    .eq("web_customer_id", customerId)
    .maybeSingle();
  if (!q) throw new QuoteError("Quotation not found", 404);
  if (q.status !== "Sent") throw new QuoteError(q.status === "Accepted" ? "You already accepted this quotation." : "This quotation can't be accepted.");
  if (isExpired(q)) throw new QuoteError("This quotation has expired. Please ask us for a new one.");
  const items = (q.web_quote_items || []) as any[];
  if (!items.length) throw new QuoteError("This quotation has no items.");

  // Claim the quote first so a double click can't create two orders.
  const { data: claimed } = await supabaseAdmin
    .from("web_quote_requests")
    .update({ status: "Accepted", updated_at: new Date().toISOString() })
    .eq("id", q.id)
    .eq("status", "Sent")
    .select("id")
    .maybeSingle();
  if (!claimed) throw new QuoteError("This quotation was already accepted.");

  try {
    const order = await insertWebOrder({
      customerId,
      delivery: input.delivery,
      paymentMethod: input.paymentMethod,
      note: `From quotation ${q.quote_no}`,
      lines: items.map((i) => ({
        webProductId: i.web_product_id,
        saleId: i.web_variant_id,
        productId: i.product_id,
        name: i.name,
        qty: Number(i.qty),
        mrp: i.mrp == null ? null : Number(i.mrp),
        unitPrice: Number(i.final_price),
      })),
      discount: Number(q.discount_amount) || 0,
      deliveryFee: input.deliveryFee,
      sourceQuoteId: q.id,
    });
    await supabaseAdmin.from("web_quote_requests").update({ web_order_id: order.id }).eq("id", q.id);
    return order;
  } catch (e) {
    await supabaseAdmin.from("web_quote_requests").update({ status: "Sent" }).eq("id", q.id);
    throw e;
  }
}

export async function rejectQuote(customerId: string, quoteNo: string) {
  const { data } = await supabaseAdmin
    .from("web_quote_requests")
    .update({ status: "Rejected", updated_at: new Date().toISOString() })
    .eq("quote_no", quoteNo)
    .eq("web_customer_id", customerId)
    .in("status", ["Requested", "Priced", "Sent"])
    .select("id")
    .maybeSingle();
  if (!data) throw new QuoteError("This quotation can't be cancelled.");
}

/** Private link for the office to see a plan photo. */
export async function signedUrls(paths: string[]) {
  if (!paths?.length) return [];
  const { data } = await supabaseAdmin.storage.from("web-private").createSignedUrls(paths, 60 * 10);
  return (data || []).map((d) => ({ path: d.path, url: d.signedUrl }));
}
