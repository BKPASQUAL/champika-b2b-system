import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getStaff, requireWebsiteStaff } from "@/lib/web-auth";
import { apiError } from "@/lib/web-utils";
import { getItemKinds } from "@/lib/shop-data";
import {
  WebOrderError,
  allowedNextStatuses,
  cancelOrder,
  confirmOrder,
  markAdvancePaid,
  rejectAdvanceSlip,
  requestAdvance,
  setStatus,
  slipUrl,
  stockCheck,
  verifyPayment,
} from "@/lib/web-orders";

type Ctx = { params: Promise<{ id: string }> };

/** Staff: one order with items, customer, stock check, invoice and slip link. */
export async function GET(_req: NextRequest, { params }: Ctx) {
  const auth = await requireWebsiteStaff();
  if (auth.error) return auth.error;
  const { id } = await params;
  try {
    const { data: o, error } = await supabaseAdmin
      .from("web_orders")
      .select(
        "*, web_customers(id, full_name, email, phone, tier, trade_status, created_at), web_order_items(id, web_product_id, product_id, name, qty, unit_price, mrp, line_total, web_products(slug, images), products(sku, cost_price, actual_cost_price))",
      )
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    if (!o) return NextResponse.json({ error: "Order not found" }, { status: 404 });

    const [stock, slip, advanceSlip, kinds, invoice, customerOrders] = await Promise.all([
      o.status === "New" ? stockCheck(o) : Promise.resolve(null),
      slipUrl(o.slip_path),
      slipUrl(o.advance_slip_path ?? null),
      getItemKinds(),
      o.order_id
        ? supabaseAdmin.from("invoices").select("id, invoice_no, total_amount, paid_amount, status").eq("order_id", o.order_id).maybeSingle()
        : Promise.resolve({ data: null }),
      supabaseAdmin.from("web_orders").select("id", { count: "exact", head: true }).eq("web_customer_id", o.web_customer_id),
    ]);

    // Profit after invoicing comes from the real FIFO cost saved on the invoice lines.
    let costTotal: number | null = null;
    if (o.order_id) {
      const { data: lines } = await supabaseAdmin.from("order_items").select("quantity, actual_unit_cost").eq("order_id", o.order_id);
      costTotal = (lines || []).reduce((s: number, l: any) => s + Number(l.quantity) * Number(l.actual_unit_cost || 0), 0);
    } else {
      costTotal = (o.web_order_items || []).reduce(
        (s: number, i: any) => s + Number(i.qty) * Number(i.products?.actual_cost_price || i.products?.cost_price || 0),
        0,
      );
    }

    return NextResponse.json({
      id: o.id,
      no: o.web_order_no,
      createdAt: o.created_at,
      updatedAt: o.updated_at,
      status: o.status,
      nextStatuses: allowedNextStatuses(o.status),
      paymentMethod: o.payment_method,
      paymentStatus: o.payment_status,
      slipUrl: slip,
      slipIsPdf: (o.slip_path || "").toLowerCase().endsWith(".pdf"),
      advance: {
        amount: Number(o.advance_amount) || 0,
        status: (o.advance_status as string) || "none",
        method: (o.advance_method as string | null) ?? null,
        note: (o.advance_note as string | null) ?? null,
        slipUrl: advanceSlip,
        slipIsPdf: (o.advance_slip_path || "").toLowerCase().endsWith(".pdf"),
      },
      subtotal: Number(o.subtotal),
      discount: Number(o.discount_amount),
      deliveryFee: Number(o.delivery_fee),
      total: Number(o.total),
      costTotal,
      customerNote: o.customer_note,
      staffNote: o.staff_note,
      delivery: { name: o.delivery_name, phone: o.delivery_phone, address: o.delivery_address },
      customer: o.web_customers
        ? {
            id: o.web_customers.id,
            name: o.web_customers.full_name,
            email: o.web_customers.email,
            phone: o.web_customers.phone,
            tier: o.web_customers.tier,
            since: o.web_customers.created_at,
            orderCount: customerOrders.count ?? 0,
          }
        : null,
      invoice: invoice.data
        ? {
            id: invoice.data.id,
            no: invoice.data.invoice_no,
            total: Number(invoice.data.total_amount),
            paid: Number(invoice.data.paid_amount || 0),
            status: invoice.data.status,
          }
        : null,
      stock,
      items: (o.web_order_items || []).map((i: any) => ({
        id: i.id,
        productId: i.product_id,
        sku: i.products?.sku ?? null,
        name: i.name,
        slug: i.web_products?.slug ?? null,
        image: i.web_products?.images?.[0] ?? null,
        qty: Number(i.qty),
        unitPrice: Number(i.unit_price),
        mrp: i.mrp == null ? null : Number(i.mrp),
        lineTotal: Number(i.line_total),
        kind: kinds.get(i.web_product_id)?.kind ?? "normal",
        leadTime: kinds.get(i.web_product_id)?.leadTime ?? null,
      })),
    });
  } catch (e) {
    return apiError(e);
  }
}

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("confirm"), force: z.boolean().optional(), skipAdvance: z.boolean().optional() }),
  z.object({ action: z.literal("advance"), amount: z.coerce.number().min(0).max(100000000), note: z.string().trim().max(300).optional().default("") }),
  z.object({ action: z.literal("advance-paid"), method: z.enum(["bank", "cash"]) }),
  z.object({ action: z.literal("advance-reject") }),
  z.object({ action: z.literal("status"), status: z.enum(["Packed", "Dispatched", "Delivered"]) }),
  z.object({ action: z.literal("verify"), ok: z.boolean() }),
  z.object({ action: z.literal("cancel"), reason: z.string().trim().max(300).optional().default("") }),
  z.object({ action: z.literal("note"), text: z.string().trim().min(1).max(1000) }),
]);

/** Staff actions: confirm (creates invoice), status, verify bank slip, cancel, add note. */
export async function POST(request: NextRequest, { params }: Ctx) {
  const auth = await requireWebsiteStaff();
  if (auth.error) return auth.error;
  const { id } = await params;
  const parsed = actionSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  const v = parsed.data;
  try {
    const staff = await getStaff(auth.userId);
    switch (v.action) {
      case "confirm":
        return NextResponse.json(await confirmOrder(id, staff, { force: v.force, skipAdvance: v.skipAdvance }));
      case "advance":
        return NextResponse.json(await requestAdvance(id, staff, v.amount, v.note));
      case "advance-paid":
        return NextResponse.json(await markAdvancePaid(id, staff, v.method));
      case "advance-reject":
        return NextResponse.json(await rejectAdvanceSlip(id, staff));
      case "status":
        return NextResponse.json(await setStatus(id, staff, v.status));
      case "verify":
        return NextResponse.json(await verifyPayment(id, staff, v.ok));
      case "cancel":
        return NextResponse.json(await cancelOrder(id, staff, v.reason));
      case "note": {
        const { data } = await supabaseAdmin.from("web_orders").select("staff_note").eq("id", id).single();
        const stamp = new Date().toLocaleString("en-LK", { dateStyle: "medium", timeStyle: "short" });
        const line = `[${stamp}] ${staff.name || staff.email || "Staff"}: ${v.text}`;
        await supabaseAdmin.from("web_orders").update({ staff_note: data?.staff_note ? `${data.staff_note}\n${line}` : line }).eq("id", id);
        return NextResponse.json({ ok: true });
      }
    }
  } catch (e) {
    if (e instanceof WebOrderError) return NextResponse.json({ error: e.message, ...(e.extra || {}) }, { status: e.status });
    return apiError(e);
  }
}
