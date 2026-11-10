import { NextRequest, after } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { BUSINESS_IDS } from "@/app/config/business-constants";
import { triggerAgencyBillsForInvoice } from "@/app/lib/inter-branch-billing";
import { getMainWarehouseStock } from "@/lib/web-utils";
import { formatAddress } from "@/lib/shop-address";
import { POST as createInvoice } from "@/app/api/invoices/route";
import { POST as recordPayment } from "@/app/api/payments/route";
import { POST as cancelInvoice } from "@/app/api/invoices/[id]/cancel/route";

/**
 * Office-side processing of online shop orders.
 *
 * Confirm → creates a normal B2B invoice under the WEBSITE business by calling
 * the same code the office uses (FIFO cost, stock out of the Main Warehouse,
 * invoice number WB-…). Delivered → agency bills (OR-WE / WE / SI-WE) are
 * rebuilt like Distribution's. Payments go through the normal payments code.
 */

export type Staff = { id: string; name: string | null; email: string | null; role: string };

export class WebOrderError extends Error {
  constructor(message: string, public status = 400, public extra?: Record<string, unknown>) {
    super(message);
  }
}

/** Website status → B2B order status. */
const B2B_STATUS: Record<string, string> = {
  Confirmed: "Processing",
  Packed: "Loading",
  Dispatched: "In Transit",
  Delivered: "Delivered",
  Cancelled: "Cancelled",
};

const NEXT_STATUS: Record<string, string[]> = {
  New: ["Confirmed", "Cancelled"],
  Confirmed: ["Packed", "Dispatched", "Delivered", "Cancelled"],
  Packed: ["Dispatched", "Delivered", "Cancelled"],
  Dispatched: ["Delivered", "Cancelled"],
  Delivered: [],
  Cancelled: [],
};
export const allowedNextStatuses = (status: string) => NEXT_STATUS[status] || [];

/** Call one of the app's own API handlers directly (no HTTP), returning its JSON. */
async function callHandler(handler: (req: NextRequest, ctx?: any) => Promise<Response>, url: string, body: unknown, ctx?: unknown) {
  const req = new NextRequest(`http://internal${url}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const res = await (ctx ? handler(req, ctx) : handler(req));
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new WebOrderError(json.error || `Request failed (${res.status})`, res.status);
  return json;
}

async function loadOrder(id: string) {
  const { data, error } = await supabaseAdmin
    .from("web_orders")
    .select("*, web_customers(id, full_name, email, phone, customer_id), web_order_items(product_id, name, qty, unit_price, mrp, line_total)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new WebOrderError("Order not found", 404);
  return data as any;
}

async function logNote(orderId: string, staff: Staff, text: string) {
  const { data } = await supabaseAdmin.from("web_orders").select("staff_note").eq("id", orderId).single();
  const stamp = new Date().toLocaleString("en-LK", { dateStyle: "medium", timeStyle: "short" });
  const line = `[${stamp}] ${staff.name || staff.email || "Staff"}: ${text}`;
  await supabaseAdmin
    .from("web_orders")
    .update({ staff_note: data?.staff_note ? `${data.staff_note}\n${line}` : line })
    .eq("id", orderId);
}

/** The B2B customer (WEBSITE business) for a web customer, created on first confirmed order. */
async function ensureB2BCustomer(order: any): Promise<string> {
  const wc = order.web_customers;
  if (wc?.customer_id) {
    const { data } = await supabaseAdmin.from("customers").select("id").eq("id", wc.customer_id).maybeSingle();
    if (data) return data.id;
  }
  const name = (wc?.full_name || order.delivery_name || "Website customer").trim();
  const { data: created, error } = await supabaseAdmin
    .from("customers")
    .insert({
      shop_name: `${name} (Web)`,
      owner_name: name,
      phone: wc?.phone || order.delivery_phone || "",
      email: wc?.email || null,
      address: formatAddress(order.delivery_address),
      route: "Website",
      status: "Active",
      credit_limit: 0,
      outstanding_balance: 0,
      business_id: BUSINESS_IDS.WEBSITE,
    })
    .select("id")
    .single();
  if (error) throw new WebOrderError(`Could not create the customer record: ${error.message}`, 500);
  await supabaseAdmin.from("web_customers").update({ customer_id: created.id }).eq("id", order.web_customer_id);
  return created.id;
}

/** Main Warehouse stock check for the order's items. */
export async function stockCheck(order: any) {
  const items = order.web_order_items as any[];
  const need = new Map<string, number>();
  for (const i of items) need.set(i.product_id, (need.get(i.product_id) || 0) + Number(i.qty));
  const have = await getMainWarehouseStock([...need.keys()]);
  return items.map((i) => ({
    productId: i.product_id,
    name: i.name,
    need: need.get(i.product_id) || 0,
    inStock: have[i.product_id] ?? 0,
    short: (have[i.product_id] ?? 0) < (need.get(i.product_id) || 0),
  }));
}

/** New → Confirmed: create the invoice (stock out, FIFO cost) and link it. */
export async function confirmOrder(orderId: string, staff: Staff, opts: { force?: boolean; skipAdvance?: boolean } = {}) {
  const order = await loadOrder(orderId);
  if (order.status !== "New") throw new WebOrderError(`This order is already ${order.status}.`);
  if (order.order_id) throw new WebOrderError("This order already has an invoice.");
  const advanceWaiting = order.advance_status === "requested" || order.advance_status === "slip_uploaded";
  if (advanceWaiting && !opts.skipAdvance) {
    throw new WebOrderError(
      `The advance of Rs ${Number(order.advance_amount).toLocaleString("en-LK")} is not received yet.`,
      409,
      { advance: true },
    );
  }

  const stock = await stockCheck(order);
  const short = stock.filter((s) => s.short);
  if (short.length && !opts.force) {
    throw new WebOrderError(
      `Not enough stock in the Main Warehouse for ${short.map((s) => `${s.name} (need ${s.need}, have ${s.inStock})`).join(", ")}.`,
      409,
      { short },
    );
  }

  const customerId = await ensureB2BCustomer(order);
  const productIds = [...new Set((order.web_order_items as any[]).map((i) => i.product_id))];
  const { data: products } = await supabaseAdmin.from("products").select("id, sku, name, unit, mrp").in("id", productIds);
  const byId = new Map((products || []).map((p: any) => [p.id, p]));

  const items = (order.web_order_items as any[]).map((i) => {
    const p: any = byId.get(i.product_id) || {};
    const qty = Number(i.qty);
    const price = Number(i.unit_price);
    return {
      productId: i.product_id,
      sku: p.sku ?? null,
      productName: p.name ?? i.name,
      customName: i.name,
      quantity: qty,
      freeQuantity: 0,
      unit: p.unit ?? null,
      mrp: Number(i.mrp ?? p.mrp ?? price) || price,
      unitPrice: price,
      discountPercent: 0,
      discountAmount: 0,
      total: Math.round(qty * price * 100) / 100,
    };
  });
  const subTotal = items.reduce((s, i) => s + i.total, 0);
  const discount = Number(order.discount_amount) || 0;
  const fee = Number(order.delivery_fee) || 0;
  const paidAlready = order.payment_method === "BANK" && order.payment_status === "verified";

  const result = await callHandler(createInvoice, "/api/invoices", {
    customerId,
    businessId: BUSINESS_IDS.WEBSITE,
    salesRepId: null,
    userId: staff.id,
    items,
    subTotal,
    extraDiscountPercent: 0,
    extraDiscountAmount: discount,
    grandTotal: subTotal - discount,
    notes: `Website order ${order.web_order_no}${fee ? ` · Delivery fee Rs ${fee.toLocaleString("en-LK")} (not on invoice)` : ""}${
      order.customer_note ? ` · Customer note: ${order.customer_note}` : ""
    }`,
    printFormat: "MRP",
    orderStatus: "Processing",
    paymentType: paidAlready ? "Bank" : "Cash",
    paymentMethod: order.payment_method === "BANK" ? "Bank Transfer" : "Cash on Delivery",
    paymentStatus: "Unpaid",
    paidAmount: 0,
    performedByName: staff.name,
    performedByEmail: staff.email,
  });

  const b2bOrderId: string | undefined = result?.data?.order_id;
  if (!b2bOrderId) throw new WebOrderError("Invoice was created but could not be linked. Please check Invoices.", 500);

  await supabaseAdmin
    .from("web_orders")
    .update({ status: "Confirmed", order_id: b2bOrderId, updated_at: new Date().toISOString() })
    .eq("id", orderId);
  await logNote(orderId, staff, `Confirmed · invoice ${result.invoiceNo}${short.length ? " (confirmed with low stock)" : ""}`);

  // A slip that was already checked counts as paid on the new invoice.
  if (paidAlready) await payInvoice(orderId, staff, "bank");
  // An advance taken before the invoice existed goes on the invoice now.
  else if (order.advance_status === "paid" && Number(order.advance_amount) > 0)
    await payInvoice(orderId, staff, order.advance_method === "cash" ? "cash" : "bank", Number(order.advance_amount), "advance");

  return { invoiceNo: result.invoiceNo as string };
}

/** Record the money on the invoice (once), via the normal payments code. */
async function payInvoice(orderId: string, staff: Staff, method: "cash" | "bank", amount?: number, label?: string) {
  const order = await loadOrder(orderId);
  if (!order.order_id) return;
  const { data: inv } = await supabaseAdmin
    .from("invoices")
    .select("id, total_amount, paid_amount, status")
    .eq("order_id", order.order_id)
    .maybeSingle();
  if (!inv) return;
  const due = Number(inv.total_amount) - Number(inv.paid_amount || 0);
  if (due <= 0.009) return;
  const pay = amount == null ? due : Math.min(amount, due);
  if (pay <= 0.009) return;
  await callHandler(recordPayment, "/api/payments", {
    orderId: order.order_id,
    amount: Math.round(pay * 100) / 100,
    method,
    date: new Date().toISOString().split("T")[0],
    notes: `Website order ${order.web_order_no}${label ? ` (${label})` : ""}`,
    performedById: staff.id,
    performedByName: staff.name,
    performedByEmail: staff.email,
  });
}

/** Confirmed → Packed → Dispatched → Delivered. Delivered rebuilds agency bills and takes COD cash. */
export async function setStatus(orderId: string, staff: Staff, next: string) {
  const order = await loadOrder(orderId);
  if (next === "Cancelled") return cancelOrder(orderId, staff, "");
  if (next === "Confirmed") return confirmOrder(orderId, staff);
  if (!allowedNextStatuses(order.status).includes(next)) throw new WebOrderError(`Can't change ${order.status} to ${next}.`);
  if (!order.order_id) throw new WebOrderError("Confirm the order first (this creates the invoice).");

  await supabaseAdmin.from("web_orders").update({ status: next, updated_at: new Date().toISOString() }).eq("id", orderId);
  await supabaseAdmin.from("orders").update({ status: B2B_STATUS[next], updated_at: new Date().toISOString() }).eq("id", order.order_id);
  await logNote(orderId, staff, `Status → ${next}`);

  if (next === "Delivered") {
    // Cash on delivery: the driver collected the money.
    if (order.payment_method === "COD") {
      await payInvoice(orderId, staff, "cash");
      await supabaseAdmin.from("web_orders").update({ payment_status: "verified" }).eq("id", orderId);
    }
    const productIds = [...new Set((order.web_order_items as any[]).map((i) => i.product_id))];
    after(async () => {
      try {
        await triggerAgencyBillsForInvoice(BUSINESS_IDS.WEBSITE, productIds);
      } catch (e) {
        console.error("[Website] agency bill update failed (non-critical)", e);
      }
    });
  }
  return { status: next };
}

/** Bank slip checked → payment confirmed (and recorded on the invoice if there is one). */
export async function verifyPayment(orderId: string, staff: Staff, ok: boolean) {
  const order = await loadOrder(orderId);
  if (order.payment_method !== "BANK") throw new WebOrderError("Only bank transfer orders need checking.");
  if (order.payment_status === "verified") throw new WebOrderError("Payment is already confirmed.");
  await supabaseAdmin
    .from("web_orders")
    .update({ payment_status: ok ? "verified" : "failed", updated_at: new Date().toISOString() })
    .eq("id", orderId);
  await logNote(orderId, staff, ok ? "Bank payment confirmed" : "Bank slip rejected");
  if (ok) await payInvoice(orderId, staff, "bank");
  return { paymentStatus: ok ? "verified" : "failed" };
}

/**
 * Special orders: after talking to the customer, staff set the advance they
 * agreed. The customer then sees it on their order page (bank details + slip).
 * Amount 0 clears it.
 */
export async function requestAdvance(orderId: string, staff: Staff, amount: number, note: string) {
  const order = await loadOrder(orderId);
  if (order.status === "Cancelled" || order.status === "Delivered") throw new WebOrderError(`This order is ${order.status}.`);
  if (order.advance_status === "paid") throw new WebOrderError("The advance is already received.");
  const amt = Math.round(Math.max(0, amount) * 100) / 100;
  if (amt > Number(order.total)) throw new WebOrderError("The advance can't be more than the order total.");
  const { error } = await supabaseAdmin
    .from("web_orders")
    .update({
      advance_amount: amt,
      advance_status: amt > 0 ? "requested" : "none",
      advance_note: note || null,
      advance_method: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", orderId);
  if (error) throw new WebOrderError(/advance_/.test(error.message) ? "Run the latest website_shop.sql in Supabase first (advance columns)." : error.message, 500);
  await logNote(orderId, staff, amt > 0 ? `Advance asked: Rs ${amt.toLocaleString("en-LK")}${note ? ` (${note})` : ""}` : "Advance removed");
  return { advanceStatus: amt > 0 ? "requested" : "none" };
}

/** Advance received: by bank (slip checked) or cash at the shop. Goes on the invoice if there is one. */
export async function markAdvancePaid(orderId: string, staff: Staff, method: "bank" | "cash") {
  const order = await loadOrder(orderId);
  if (!(Number(order.advance_amount) > 0) || order.advance_status === "none") throw new WebOrderError("No advance was asked for this order.");
  if (order.advance_status === "paid") throw new WebOrderError("The advance is already received.");
  await supabaseAdmin
    .from("web_orders")
    .update({ advance_status: "paid", advance_method: method, updated_at: new Date().toISOString() })
    .eq("id", orderId);
  await logNote(orderId, staff, `Advance received (${method === "cash" ? "cash at shop" : "bank"}): Rs ${Number(order.advance_amount).toLocaleString("en-LK")}`);
  if (order.order_id) await payInvoice(orderId, staff, method, Number(order.advance_amount), "advance");
  return { advanceStatus: "paid" };
}

/** Advance slip was wrong: ask again (the customer can upload a new one). */
export async function rejectAdvanceSlip(orderId: string, staff: Staff) {
  const order = await loadOrder(orderId);
  if (order.advance_status !== "slip_uploaded") throw new WebOrderError("There is no advance slip to reject.");
  await supabaseAdmin.from("web_orders").update({ advance_status: "requested", updated_at: new Date().toISOString() }).eq("id", orderId);
  await logNote(orderId, staff, "Advance slip rejected");
  return { advanceStatus: "requested" };
}

/**
 * Cancel. Before confirmation it is just a status change. After confirmation
 * the invoice is cancelled with the normal (admin-only) cancel, and the
 * stock goes back into the Main Warehouse.
 */
export async function cancelOrder(orderId: string, staff: Staff, reason: string) {
  const order = await loadOrder(orderId);
  if (order.status === "Cancelled") throw new WebOrderError("Already cancelled.");
  if (order.status === "Delivered") throw new WebOrderError("Delivered orders can't be cancelled here. Use a return instead.");

  if (order.order_id) {
    if (staff.role !== "admin" && staff.role !== "super_admin")
      throw new WebOrderError("This order already has an invoice. Only an admin can cancel it.", 403);
    const { data: inv } = await supabaseAdmin.from("invoices").select("id").eq("order_id", order.order_id).maybeSingle();
    if (inv) {
      await callHandler(cancelInvoice as any, `/api/invoices/${inv.id}/cancel`, { userId: staff.id, reason: reason || `Website order ${order.web_order_no} cancelled` }, {
        params: Promise.resolve({ id: inv.id }),
      });
      // The normal cancel puts stock back on the rep's van; website stock came from the Main Warehouse.
      await returnToMainWarehouse(order.web_order_items);
    }
  }

  await supabaseAdmin.from("web_orders").update({ status: "Cancelled", updated_at: new Date().toISOString() }).eq("id", orderId);
  await logNote(orderId, staff, `Cancelled${reason ? `: ${reason}` : ""}`);
  return { status: "Cancelled" };
}

async function returnToMainWarehouse(items: any[]) {
  const { data: main } = await supabaseAdmin.from("locations").select("id").is("business_id", null).eq("name", "Main Warehouse").maybeSingle();
  if (!main) return;
  const qty = new Map<string, number>();
  for (const i of items) qty.set(i.product_id, (qty.get(i.product_id) || 0) + Number(i.qty));
  for (const [productId, q] of qty) {
    const { data: row } = await supabaseAdmin
      .from("product_stocks")
      .select("id, quantity")
      .eq("product_id", productId)
      .eq("location_id", main.id)
      .maybeSingle();
    if (row) {
      await supabaseAdmin
        .from("product_stocks")
        .update({ quantity: Number(row.quantity) + q, last_updated: new Date().toISOString() })
        .eq("id", row.id);
    } else {
      await supabaseAdmin.from("product_stocks").insert({ product_id: productId, location_id: main.id, quantity: q });
    }
  }
}

/** Short-lived private link for staff to view a payment slip. */
export async function slipUrl(path: string | null) {
  if (!path) return null;
  const { data } = await supabaseAdmin.storage.from("web-private").createSignedUrl(path, 60 * 10);
  return data?.signedUrl ?? null;
}
