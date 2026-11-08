import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { ensureWebCustomer, type WebCustomer } from "@/lib/web-auth";
import { addressSchema, phoneSchema } from "@/lib/shop-address";

/** Only what the customer may see about themselves. */
function publicProfile(c: WebCustomer) {
  return {
    id: c.id,
    fullName: c.full_name,
    email: c.email,
    phone: c.phone,
    address: c.default_address ?? null,
    tier: c.tier,
    tradeStatus: c.trade_status,
  };
}

/** Logged-in customer (creates the customer record on first call). 401 when logged out. */
export async function GET() {
  try {
    const c = await ensureWebCustomer();
    if (!c) return NextResponse.json({ error: "Not logged in" }, { status: 401 });
    return NextResponse.json(publicProfile(c));
  } catch {
    return NextResponse.json({ error: "Could not load your account" }, { status: 500 });
  }
}

const updateSchema = z.object({
  fullName: z.string().trim().min(2, "Enter your name").max(120),
  phone: phoneSchema,
  address: addressSchema.nullable().optional(),
});

/** Update name, phone and saved delivery address. */
export async function PATCH(request: NextRequest) {
  const c = await ensureWebCustomer().catch(() => null);
  if (!c) return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  const parsed = updateSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Check your details" }, { status: 400 });
  const v = parsed.data;
  const { error } = await supabaseAdmin
    .from("web_customers")
    .update({
      full_name: v.fullName,
      phone: v.phone,
      ...(v.address !== undefined ? { default_address: v.address } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq("id", c.id);
  if (error) return NextResponse.json({ error: "Could not save your details" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
