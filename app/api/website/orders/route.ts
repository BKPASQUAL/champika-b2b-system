import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireWebsiteStaff } from "@/lib/web-auth";
import { apiError } from "@/lib/web-utils";

/**
 * Staff: website orders list.
 * GET ?status=New|Confirmed|…|open|all &payment=slip &q=WEB-00001 / name / phone
 */
export async function GET(request: NextRequest) {
  const auth = await requireWebsiteStaff();
  if (auth.error) return auth.error;
  try {
    const sp = request.nextUrl.searchParams;
    const status = sp.get("status") || "open";
    const q = (sp.get("q") || "").trim().replace(/[%,()]/g, " ");

    let query = supabaseAdmin
      .from("web_orders")
      .select(
        "id, web_order_no, created_at, status, payment_method, payment_status, total, delivery_name, delivery_phone, delivery_address, order_id, web_order_items(qty)",
      )
      .order("created_at", { ascending: false })
      .limit(300);
    if (status === "open") query = query.not("status", "in", "(Delivered,Cancelled)");
    else if (status !== "all") query = query.eq("status", status);
    if (sp.get("payment") === "slip") query = query.eq("payment_status", "slip_uploaded");
    if (q) query = query.or(`web_order_no.ilike.%${q}%,delivery_name.ilike.%${q}%,delivery_phone.ilike.%${q}%`);

    const [{ data, error }, { data: counts }] = await Promise.all([
      query,
      supabaseAdmin.from("web_orders").select("status, payment_status"),
    ]);
    if (error) throw error;

    const tally: Record<string, number> = { slips: 0 };
    for (const r of counts || []) {
      tally[r.status] = (tally[r.status] || 0) + 1;
      if (r.payment_status === "slip_uploaded") tally.slips++;
    }

    return NextResponse.json({
      counts: tally,
      orders: (data || []).map((o: any) => ({
        id: o.id,
        no: o.web_order_no,
        createdAt: o.created_at,
        status: o.status,
        paymentMethod: o.payment_method,
        paymentStatus: o.payment_status,
        total: Number(o.total),
        name: o.delivery_name,
        phone: o.delivery_phone,
        city: o.delivery_address?.city || "",
        district: o.delivery_address?.district || "",
        items: (o.web_order_items || []).reduce((s: number, i: any) => s + Number(i.qty), 0),
        hasInvoice: !!o.order_id,
      })),
    });
  } catch (e) {
    return apiError(e);
  }
}
