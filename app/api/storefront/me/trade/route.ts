import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { ensureWebCustomer } from "@/lib/web-auth";

const schema = z.object({
  businessName: z.string().trim().min(2, "Enter your business or trade name").max(120),
  regNo: z.string().trim().min(5, "Enter your NIC or business registration number").max(40),
});

/** Customer asks for trade (electrician / contractor) prices. Office approves it. */
export async function POST(request: NextRequest) {
  const c = await ensureWebCustomer().catch(() => null);
  if (!c) return NextResponse.json({ error: "Please log in" }, { status: 401 });
  if (c.trade_status === "approved") return NextResponse.json({ error: "You already have trade prices." }, { status: 400 });
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
  const { error } = await supabaseAdmin
    .from("web_customers")
    .update({
      trade_status: "pending",
      business_name: parsed.data.businessName,
      nic_or_reg_no: parsed.data.regNo,
      updated_at: new Date().toISOString(),
    })
    .eq("id", c.id);
  if (error) return NextResponse.json({ error: "Could not send your request" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
