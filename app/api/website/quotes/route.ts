import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireWebsiteStaff } from "@/lib/web-auth";
import { apiError } from "@/lib/web-utils";
import { isExpired } from "@/lib/web-quotes";

/** Staff: quotation list. ?status=open|Requested|Priced|Sent|Accepted|Rejected|all */
export async function GET(request: NextRequest) {
  const auth = await requireWebsiteStaff();
  if (auth.error) return auth.error;
  try {
    const status = request.nextUrl.searchParams.get("status") || "open";
    let q = supabaseAdmin
      .from("web_quote_requests")
      .select("id, quote_no, type, status, house_type, total, valid_until, created_at, web_customers(full_name, phone, tier), web_quote_items(id)")
      .order("created_at", { ascending: false })
      .limit(300);
    if (status === "open") q = q.in("status", ["Requested", "Priced"]);
    else if (status !== "all") q = q.eq("status", status);
    const [{ data, error }, { data: all }] = await Promise.all([q, supabaseAdmin.from("web_quote_requests").select("status")]);
    if (error) throw error;
    const counts: Record<string, number> = {};
    for (const r of all || []) counts[r.status] = (counts[r.status] || 0) + 1;
    return NextResponse.json({
      counts,
      quotes: (data || []).map((r: any) => ({
        id: r.id,
        no: r.quote_no,
        type: r.type,
        status: isExpired(r) ? "Expired" : r.status,
        title: r.type === "job" ? r.house_type || "House job" : "Cart",
        items: (r.web_quote_items || []).length,
        total: Number(r.total),
        validUntil: r.valid_until,
        createdAt: r.created_at,
        customer: r.web_customers?.full_name || "—",
        phone: r.web_customers?.phone || "",
        tier: r.web_customers?.tier || "normal",
      })),
    });
  } catch (e) {
    return apiError(e);
  }
}
