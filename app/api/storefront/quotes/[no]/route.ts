import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { ensureWebCustomer } from "@/lib/web-auth";
import { deliveryFee, getDeliveryInfo } from "@/lib/shop-data";
import { addressSchema, phoneSchema } from "@/lib/shop-address";
import { QuoteError, acceptQuote, rejectQuote } from "@/lib/web-quotes";

const schema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("accept"),
    paymentMethod: z.enum(["COD", "BANK"]),
    delivery: z.object({ name: z.string().trim().min(2, "Enter the receiver's name").max(120), phone: phoneSchema }).merge(addressSchema),
  }),
  z.object({ action: z.literal("reject") }),
]);

/** Customer accepts (→ order) or declines a quotation. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ no: string }> }) {
  const customer = await ensureWebCustomer().catch(() => null);
  if (!customer) return NextResponse.json({ error: "Please log in" }, { status: 401 });
  const { no } = await params;
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Check your details" }, { status: 400 });
  const v = parsed.data;

  try {
    if (v.action === "reject") {
      await rejectQuote(customer.id, no);
      return NextResponse.json({ ok: true });
    }
    const { data: q } = await supabaseAdmin.from("web_quote_requests").select("total").eq("quote_no", no).eq("web_customer_id", customer.id).maybeSingle();
    const fee = deliveryFee(Number(q?.total) || 0, await getDeliveryInfo());
    const order = await acceptQuote(customer.id, no, { delivery: v.delivery, paymentMethod: v.paymentMethod, deliveryFee: fee });
    await supabaseAdmin
      .from("web_customers")
      .update({
        phone: customer.phone || v.delivery.phone,
        default_address: { line1: v.delivery.line1, line2: v.delivery.line2, city: v.delivery.city, district: v.delivery.district },
      })
      .eq("id", customer.id);
    return NextResponse.json({ orderNo: order.no });
  } catch (e) {
    if (e instanceof QuoteError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error("Quote action failed", e);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
