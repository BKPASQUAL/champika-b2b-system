import { supabaseAdmin } from "@/lib/supabase-admin";
import { isExpired } from "@/lib/web-quotes";

/** A customer's own quotations ("My quotations"). */

export type QuoteStatus = "Requested" | "Priced" | "Sent" | "Accepted" | "Rejected" | "Expired";

export const QUOTE_STATUS_TEXT: Record<QuoteStatus, { label: string; text: string }> = {
  Requested: { label: "Requested", text: "We received your request and are preparing your price list." },
  Priced: { label: "Being prepared", text: "We are finishing your price list." },
  Sent: { label: "Ready", text: "Your quotation is ready. Accept it to place the order." },
  Accepted: { label: "Accepted", text: "You accepted this quotation and your order was placed." },
  Rejected: { label: "Declined", text: "This quotation was declined." },
  Expired: { label: "Expired", text: "This quotation has expired. Ask us for a new one." },
};

export type QuoteItem = { name: string; slug: string | null; image: string | null; qty: number; mrp: number | null; price: number | null; lineTotal: number | null };

const n = (v: unknown) => Number(v) || 0;
/** Customers only see prices once the office has sent the quotation. */
const showPrices = (status: string) => status === "Sent" || status === "Accepted" || status === "Expired";

function statusOf(q: any): QuoteStatus {
  return isExpired(q) ? "Expired" : q.status;
}

export async function getMyQuotes(customerId: string) {
  const { data } = await supabaseAdmin
    .from("web_quote_requests")
    .select("quote_no, type, status, total, valid_until, house_type, created_at, web_quote_items(qty)")
    .eq("web_customer_id", customerId)
    .order("created_at", { ascending: false })
    .limit(100);
  return (data || []).map((q: any) => {
    const status = statusOf(q);
    return {
      no: q.quote_no as string,
      type: q.type as "cart" | "job",
      status,
      total: showPrices(status) ? n(q.total) : null,
      validUntil: q.valid_until as string | null,
      title: q.type === "job" ? q.house_type || "House job" : `${(q.web_quote_items || []).length} items from my cart`,
      createdAt: q.created_at as string,
    };
  });
}

export async function getMyQuote(customerId: string, no: string) {
  const { data: q } = await supabaseAdmin
    .from("web_quote_requests")
    .select("*, web_quote_items(name, qty, mrp, final_price, line_total, web_products(slug, images)), web_orders(web_order_no)")
    .eq("quote_no", no)
    .eq("web_customer_id", customerId)
    .maybeSingle();
  if (!q) return null;
  const status = statusOf(q);
  const prices = showPrices(status);
  return {
    no: q.quote_no as string,
    type: q.type as "cart" | "job",
    status,
    createdAt: q.created_at as string,
    validUntil: q.valid_until as string | null,
    houseType: q.house_type as string | null,
    rooms: q.rooms as number | null,
    points: (q.points || {}) as Record<string, number>,
    hasPlans: (q.attachment_paths || []).length > 0,
    customerNote: q.customer_note as string | null,
    orderNo: (Array.isArray(q.web_orders) ? q.web_orders[0] : q.web_orders)?.web_order_no ?? null,
    subtotal: prices ? n(q.subtotal) : null,
    discount: prices ? n(q.discount_amount) : null,
    total: prices ? n(q.total) : null,
    items: ((q.web_quote_items || []) as any[]).map((i): QuoteItem => ({
      name: i.name as string,
      slug: i.web_products?.slug ?? null,
      image: i.web_products?.images?.[0] ?? null,
      qty: n(i.qty),
      mrp: prices && i.mrp != null ? n(i.mrp) : null,
      price: prices ? n(i.final_price) : null,
      lineTotal: prices ? n(i.line_total) : null,
    })),
  };
}
