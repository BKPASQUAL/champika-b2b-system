import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireWebsiteStaff } from "@/lib/web-auth";
import { apiError } from "@/lib/web-utils";
import { QUOTE_VALID_DAYS, QuoteError, isExpired, saveQuote, signedUrls } from "@/lib/web-quotes";

type Ctx = { params: Promise<{ id: string }> };

/** Staff: one quotation with customer, job details, plans, items (with cost & margin). */
export async function GET(_req: NextRequest, { params }: Ctx) {
  const auth = await requireWebsiteStaff();
  if (auth.error) return auth.error;
  const { id } = await params;
  try {
    const { data: q, error } = await supabaseAdmin
      .from("web_quote_requests")
      .select(
        "*, web_customers(id, full_name, email, phone, tier, trade_status), web_orders(id, web_order_no), web_quote_items(id, web_product_id, product_id, name, qty, mrp, auto_price, final_price, line_total, web_products(images), products(cost_price, actual_cost_price))",
      )
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    if (!q) return NextResponse.json({ error: "Quotation not found" }, { status: 404 });
    const c: any = q.web_customers;
    const order: any = Array.isArray(q.web_orders) ? q.web_orders[0] : q.web_orders;
    return NextResponse.json({
      id: q.id,
      no: q.quote_no,
      type: q.type,
      status: isExpired(q) ? "Expired" : q.status,
      createdAt: q.created_at,
      sentAt: q.sent_at,
      validUntil: q.valid_until,
      houseType: q.house_type,
      rooms: q.rooms,
      points: q.points || {},
      plans: await signedUrls(q.attachment_paths || []),
      customerNote: q.customer_note,
      staffNote: q.staff_note,
      discount: Number(q.discount_amount) || 0,
      total: Number(q.total) || 0,
      order: order ? { id: order.id, no: order.web_order_no } : null,
      customer: c
        ? { id: c.id, name: c.full_name, email: c.email, phone: c.phone, tier: c.tier === "trade" && c.trade_status === "approved" ? "trade" : "normal" }
        : null,
      defaultValidDays: QUOTE_VALID_DAYS,
      items: (q.web_quote_items || []).map((i: any) => ({
        webProductId: i.web_product_id,
        name: i.name,
        image: i.web_products?.images?.[0] ?? null,
        qty: Number(i.qty),
        mrp: i.mrp == null ? null : Number(i.mrp),
        autoPrice: i.auto_price == null ? null : Number(i.auto_price),
        finalPrice: Number(i.final_price),
        cost: Number(i.products?.actual_cost_price || i.products?.cost_price || 0),
      })),
    });
  } catch (e) {
    return apiError(e);
  }
}

const saveSchema = z.object({
  items: z
    .array(z.object({ webProductId: z.string().uuid(), qty: z.coerce.number().positive().max(99999), finalPrice: z.coerce.number().min(0).nullable() }))
    .max(300),
  discount: z.coerce.number().min(0).default(0),
  validDays: z.coerce.number().int().min(1).max(90).default(QUOTE_VALID_DAYS),
  staffNote: z.string().trim().max(2000).nullable().optional(),
  send: z.boolean().default(false),
});

/** Staff: save the price list (Priced) or save & send it to the customer (Sent). */
export async function POST(request: NextRequest, { params }: Ctx) {
  const auth = await requireWebsiteStaff();
  if (auth.error) return auth.error;
  const { id } = await params;
  const parsed = saveSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Check the items" }, { status: 400 });
  try {
    const v = parsed.data;
    return NextResponse.json(await saveQuote(id, { ...v, staffNote: v.staffNote ?? null }));
  } catch (e) {
    if (e instanceof QuoteError) return NextResponse.json({ error: e.message }, { status: e.status });
    return apiError(e);
  }
}
