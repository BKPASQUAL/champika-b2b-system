import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireWebsiteStaff } from "@/lib/web-auth";
import { apiError } from "@/lib/web-utils";

/** Staff: website customers with order totals. ?q= name/email/phone, ?trade=pending */
export async function GET(request: NextRequest) {
  const auth = await requireWebsiteStaff();
  if (auth.error) return auth.error;
  try {
    const sp = request.nextUrl.searchParams;
    const q = (sp.get("q") || "").trim().replace(/[%,()]/g, " ");
    let query = supabaseAdmin
      .from("web_customers")
      .select("id, full_name, email, phone, tier, trade_status, business_name, nic_or_reg_no, is_blocked, auth_provider, created_at, default_address")
      .order("created_at", { ascending: false })
      .limit(500);
    if (q) query = query.or(`full_name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%`);
    if (sp.get("trade") === "pending") query = query.eq("trade_status", "pending");
    const [{ data, error }, { data: orders }] = await Promise.all([
      query,
      supabaseAdmin.from("web_orders").select("web_customer_id, total, status"),
    ]);
    if (error) throw error;
    const stats: Record<string, { count: number; spent: number }> = {};
    for (const o of orders || []) {
      if (o.status === "Cancelled") continue;
      const s = (stats[o.web_customer_id] ||= { count: 0, spent: 0 });
      s.count++;
      s.spent += Number(o.total) || 0;
    }
    return NextResponse.json(
      (data || []).map((c: any) => ({
        id: c.id,
        name: c.full_name,
        email: c.email,
        phone: c.phone,
        tier: c.tier,
        tradeStatus: c.trade_status,
        businessName: c.business_name,
        regNo: c.nic_or_reg_no,
        blocked: c.is_blocked,
        provider: c.auth_provider,
        createdAt: c.created_at,
        city: c.default_address?.city || "",
        orders: stats[c.id]?.count || 0,
        spent: stats[c.id]?.spent || 0,
      })),
    );
  } catch (e) {
    return apiError(e);
  }
}

const patchSchema = z.object({
  id: z.string().uuid(),
  action: z.enum(["approve_trade", "reject_trade", "make_normal", "block", "unblock"]),
});

/** Staff: approve/reject trade (electrician) pricing, block/unblock. */
export async function PATCH(request: NextRequest) {
  const auth = await requireWebsiteStaff();
  if (auth.error) return auth.error;
  const parsed = patchSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const { id, action } = parsed.data;
  const update: Record<string, unknown> =
    action === "approve_trade"
      ? { tier: "trade", trade_status: "approved" }
      : action === "reject_trade"
        ? { tier: "normal", trade_status: "rejected" }
        : action === "make_normal"
          ? { tier: "normal", trade_status: "none" }
          : { is_blocked: action === "block" };
  const { error } = await supabaseAdmin.from("web_customers").update({ ...update, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) return apiError(error);
  return NextResponse.json({ ok: true });
}
