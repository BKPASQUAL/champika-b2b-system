import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { triggerAgencyBillsForInvoice } from "@/app/lib/inter-branch-billing";
import { BUSINESS_IDS } from "@/app/config/business-constants";
import { applyReturnToInvoice } from "@/lib/return-invoice-adjust";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {}
        },
      },
    }
  );

  try {
    const body = await req.json();
    console.log("--- RETURN API CALLED ---");

    let {
      product_id,
      location_id,
      quantity,
      return_type,
      reason,
      business_id,
      customer_id,
      invoice_no,
      invoice_id,
    } = body;

    // Resolve user ID for returned_by tracking
    let activeUserId: string | null = null;
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) activeUserId = user.id;
    } catch (e) {
      // Ignore auth errors, fallback to body or default profile
    }

    if (!activeUserId) {
      activeUserId =
        body.returned_by ||
        body.user_id ||
        body.userId ||
        body.performed_by ||
        null;
    }

    if (!activeUserId) {
      const { data: firstProfile } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .limit(1)
        .maybeSingle();
      activeUserId = firstProfile?.id || null;
    }

    // --- 1. Auto-detect Invoice Context ---
    // No bill picked ("All Purchased Items"): use the customer's latest bill that
    // still has this product on it, so the return reduces that bill.
    // The bill number lives on the invoices table (orders.invoice_no is often empty).
    if ((!invoice_no || invoice_no === "all") && !invoice_id && customer_id && product_id) {
      invoice_no = null;
      const { data: lines } = await supabaseAdmin
        .from("order_items")
        .select(
          "quantity, free_quantity, orders!inner(id, customer_id, created_at, status, invoices(id, invoice_no, status))"
        )
        .eq("product_id", product_id)
        .eq("orders.customer_id", customer_id);

      const candidates = (lines || [])
        .map((l: any) => {
          const inv = Array.isArray(l.orders?.invoices) ? l.orders.invoices[0] : l.orders?.invoices;
          return {
            invoiceId: inv?.id as string | undefined,
            invoiceNo: inv?.invoice_no as string | undefined,
            invoiceStatus: inv?.status as string | undefined,
            orderStatus: l.orders?.status as string | undefined,
            time: new Date(l.orders?.created_at).getTime(),
            qtyLeft: Number(l.quantity || 0) + Number(l.free_quantity || 0),
          };
        })
        .filter(
          (c) =>
            c.invoiceId &&
            c.invoiceNo &&
            !c.invoiceNo.startsWith("RET-") &&
            c.invoiceStatus !== "Cancelled" &&
            c.orderStatus !== "Cancelled" &&
            c.qtyLeft > 0
        )
        .sort((a, b) => b.time - a.time);

      if (candidates.length > 0) {
        invoice_id = candidates[0].invoiceId;
        invoice_no = candidates[0].invoiceNo;
      }
    }

    const return_number =
      body.return_number || `RET-${Date.now().toString().slice(-6)}`;
    const status = body.status || "Completed";

    // Validate return_batch_id: Postgres column is UUID, so only assign if valid UUID, otherwise append to reason
    const isValidUuid = (val: any) =>
      typeof val === "string" &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(val);

    let return_batch_id: string | null = null;
    if (body.return_batch_id) {
      if (isValidUuid(body.return_batch_id)) {
        return_batch_id = body.return_batch_id;
      } else {
        const batchTag = `[BATCH:${body.return_batch_id}]`;
        if (!reason?.includes(batchTag)) {
          reason = `${batchTag} ${reason || ""}`.trim();
        }
      }
    }

    const return_date = body.return_date || new Date().toISOString();

    // --- 2. Create Return Record ---
    const { data: returnRecord, error: returnError } = await supabaseAdmin
      .from("inventory_returns")
      .insert({
        return_number,
        product_id,
        location_id,
        business_id: business_id || BUSINESS_IDS.CHAMPIKA_DISTRIBUTION,
        customer_id: customer_id || null,
        quantity: Number(quantity),
        return_type,
        reason: reason || null,
        returned_by: activeUserId,
        status,
        return_batch_id,
        return_date,
      })
      .select()
      .single();

    if (returnError) throw returnError;

    // If status is Pending (e.g. submitted by Rep awaiting office approval), do not alter warehouse stock or balances yet
    if (status === "Pending") {
      return NextResponse.json(returnRecord);
    }

    // Trigger inter-branch bill recalculation if returned to Distribution or Retail
    if (
      business_id === BUSINESS_IDS.CHAMPIKA_DISTRIBUTION ||
      business_id === BUSINESS_IDS.CHAMPIKA_RETAIL
    ) {
      triggerAgencyBillsForInvoice(business_id, [product_id]).catch((err) =>
        console.error("[InterBranch] Inventory return trigger error:", err)
      );
    }

    // --- 3. Update Damage Control Stock if return is Damaged ---
    const { data: existingStock } = await supabaseAdmin
      .from("product_stocks")
      .select("id, quantity, damaged_quantity")
      .eq("product_id", product_id)
      .eq("location_id", location_id)
      .maybeSingle();

    if (return_type === "Damage") {
      if (existingStock) {
        await supabaseAdmin
          .from("product_stocks")
          .update({
            damaged_quantity: (existingStock.damaged_quantity || 0) + Number(quantity),
            last_updated: new Date().toISOString(),
          })
          .eq("id", existingStock.id);
      } else {
        await supabaseAdmin.from("product_stocks").insert({
          product_id,
          location_id,
          quantity: 0,
          damaged_quantity: Number(quantity),
          last_updated: new Date().toISOString(),
        });
      }
    } else if (return_type === "Good") {
      // Good stock return: increase available location stock
      if (existingStock) {
        await supabaseAdmin
          .from("product_stocks")
          .update({
            quantity: (existingStock.quantity || 0) + Number(quantity),
            last_updated: new Date().toISOString(),
          })
          .eq("id", existingStock.id);
      } else {
        await supabaseAdmin.from("product_stocks").insert({
          product_id,
          location_id,
          quantity: Number(quantity),
          damaged_quantity: 0,
          last_updated: new Date().toISOString(),
        });
      }
    }

    const { data: product } = await supabaseAdmin
      .from("products")
      .select("name, stock_quantity, damaged_quantity")
      .eq("id", product_id)
      .maybeSingle();

    if (product) {
      if (return_type === "Damage") {
        await supabaseAdmin
          .from("products")
          .update({ damaged_quantity: (product.damaged_quantity || 0) + Number(quantity) })
          .eq("id", product_id);
      } else if (return_type === "Good") {
        await supabaseAdmin
          .from("products")
          .update({ stock_quantity: (product.stock_quantity || 0) + Number(quantity) })
          .eq("id", product_id);
      }

      // --- 5. Record in Transaction History ---
      await supabaseAdmin.from("account_transactions").insert({
        transaction_type: "INVENTORY_RETURN",
        description: `Return (${return_type}): ${quantity} units of ${product.name}. Reason: ${reason || "N/A"}`,
        amount: 0,
        transaction_date: new Date().toISOString(),
        business_id: business_id || null,
        metadata: {
          return_id: returnRecord.id,
          product_id,
          quantity,
          type: return_type,
          invoice_no,
        },
      });
    }

    // --- 6. Financial Updates (Invoice, Order, Customer Balance) ---
    // "Exchange" returns are a stock swap only — the customer still owes the
    // full original bill amount, so they never reduce the bill.
    if ((invoice_no || invoice_id) && return_type !== "Exchange") {
      const applied = await applyReturnToInvoice(returnRecord.id, {
        invoiceId: invoice_id,
        invoiceNo: invoice_no,
      });
      // Good return linked to a bill that doesn't contain this product: the bill
      // wasn't reduced, so keep its value available as a payment credit.
      if (!applied.ok && return_type === "Good") {
        const { data: fresh } = await supabaseAdmin
          .from("inventory_returns")
          .select("reason")
          .eq("id", returnRecord.id)
          .maybeSingle();
        await supabaseAdmin
          .from("inventory_returns")
          .update({ reason: `${fresh?.reason || ""} [RETURN_CREDIT]`.trim() })
          .eq("id", returnRecord.id);
      }
    }

    return NextResponse.json(returnRecord);
  } catch (error: any) {
    console.error("Return API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Statuses meaning the lorry has left with the return pickup (or it is finished)
// (must match the order_status enum — "Dispatched"/"Completed" are not valid values)
const DISPATCHED_STATUSES = ["In Transit", "Delivered"];

// A Good return created directly in the office (status "Completed") whose value
// never reduced any bill. These have no lorry pickup, so they are usable as a
// payment credit right away. Returns linked to an invoice are skipped unless
// tagged [RETURN_CREDIT], because older ones may already have reduced that bill.
function isOfficeReturnCredit(r: any): boolean {
  if (r.status !== "Completed" || r.return_type !== "Good" || !r.customer_id) return false;
  const reason: string = r.reason || "";
  if (reason.includes("[RETURN_CREDIT]")) return true;
  if (
    reason.includes("[PAY:") ||
    reason.includes("[INVOICE_ADJUSTED]") ||
    reason.includes("[ORD-") ||
    reason.includes("Return from invoice creation")
  ) {
    return false;
  }
  // Has an invoice tag like [CHD-1202] -> may already be deducted from that bill
  return !/\[[A-Z]{1,6}-\d+\]/.test(reason);
}

// For customer returns with no bill tag, find the bill the customer bought the
// product on (latest invoice before the return). Adds `purchase_invoice_no`,
// `settled_invoice_no` (bill a return credit was deducted from) and
// `invoice_ids` (bill number -> invoice id, for links).
async function attachBillInfo(rows: any[]): Promise<any[]> {
  if (!rows || rows.length === 0) return rows || [];

  const tagBill = (reason: string) => {
    const inv = reason.match(/\[INV:([^\]\s]+)\]/);
    if (inv) return inv[1];
    const b = reason.match(/\[([A-Z]{1,6}-\d+)\]/);
    return b ? b[1] : null;
  };

  const needLookup = rows.filter(
    (r) => r.customer_id && r.product_id && !tagBill(r.reason || "")
  );

  const purchases = new Map<string, { invoice_no: string; date: string }[]>();
  if (needLookup.length > 0) {
    const customerIds = [...new Set(needLookup.map((r) => r.customer_id))];
    const productIds = [...new Set(needLookup.map((r) => r.product_id))];
    const { data: items } = await supabaseAdmin
      .from("order_items")
      .select("product_id, orders!inner(customer_id, created_at, invoices(invoice_no))")
      .in("product_id", productIds)
      .in("orders.customer_id", customerIds);

    (items || []).forEach((it: any) => {
      const ord = it.orders;
      const inv = Array.isArray(ord?.invoices) ? ord.invoices[0] : ord?.invoices;
      const invoiceNo = inv?.invoice_no;
      // Skip return pickup bills (RET-...) which are LKR 0 notes, not purchases
      if (!invoiceNo || invoiceNo.startsWith("RET-")) return;
      const key = `${ord.customer_id}|${it.product_id}`;
      if (!purchases.has(key)) purchases.set(key, []);
      purchases.get(key)!.push({ invoice_no: invoiceNo, date: ord.created_at });
    });
  }

  const enriched = rows.map((r) => {
    const reason: string = r.reason || "";
    const settled = reason.match(/\[SETTLED_INVOICE:([^\]]*)\]/);
    let purchase_invoice_no: string | null = null;
    const list = purchases.get(`${r.customer_id}|${r.product_id}`);
    if (list && list.length > 0) {
      const returnTime = new Date(r.return_date || r.created_at).getTime();
      const before = list.filter((p) => new Date(p.date).getTime() <= returnTime);
      const pick = (before.length > 0 ? before : list).sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      )[0];
      purchase_invoice_no = pick.invoice_no;
    }
    return {
      ...r,
      purchase_invoice_no,
      settled_invoice_no: settled?.[1]?.trim() || null,
    };
  });

  // Resolve bill numbers to invoice ids so the page can link to them
  const billNos = new Set<string>();
  enriched.forEach((r: any) => {
    const t = tagBill(r.reason || "");
    if (t) billNos.add(t);
    if (r.purchase_invoice_no) billNos.add(r.purchase_invoice_no);
    (r.settled_invoice_no || "").split(",").forEach((s: string) => s.trim() && billNos.add(s.trim()));
  });
  const idMap: Record<string, string> = {};
  if (billNos.size > 0) {
    const { data: invs } = await supabaseAdmin
      .from("invoices")
      .select("id, invoice_no")
      .in("invoice_no", [...billNos]);
    (invs || []).forEach((i: any) => (idMap[i.invoice_no] = i.id));
  }
  return enriched.map((r: any) => ({ ...r, invoice_ids: idMap }));
}

// Keep only return notes whose pickup order has been dispatched / finalized,
// plus office-completed returns that are still available as a bill credit.
async function filterDispatchedReturns(rows: any[]): Promise<any[]> {
  const officeCredits = new Set(rows.filter(isOfficeReturnCredit).map((r) => r.id));
  rows = rows.filter((r) => r.status !== "Completed" || officeCredits.has(r.id));
  const numbers = rows.map((r) => r.return_number).filter(Boolean);
  if (numbers.length === 0) return [];
  const customerIds = [...new Set(rows.map((r) => r.customer_id).filter(Boolean))];

  let q = supabaseAdmin
    .from("orders")
    .select("order_id, notes, status")
    .in("status", DISPATCHED_STATUSES)
    .ilike("notes", "%RETURN_NOTE:%");
  if (customerIds.length > 0) q = q.in("customer_id", customerIds);
  const { data: orders } = await q;

  const dispatched = new Set<string>();
  (orders || []).forEach((o: any) => {
    const m = (o.notes || "").match(/\[RETURN_NOTE:\s*([^\]]+)\]/);
    if (m) dispatched.add(m[1].trim());
    if (o.order_id) dispatched.add(o.order_id);
  });
  return rows.filter((r) => officeCredits.has(r.id) || dispatched.has(r.return_number));
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const businessId = searchParams.get("businessId");
    const pageParam = searchParams.get("page");
    const limitParam = searchParams.get("limit");
    const status = searchParams.get("status");
    const salesRepId = searchParams.get("salesRepId");
    const customerId = searchParams.get("customerId");
    const unsettled = searchParams.get("unsettled");
    const dispatchedOnly = searchParams.get("dispatchedOnly") === "true";
    const returnBatchId = searchParams.get("returnBatchId") || searchParams.get("return_batch_id");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const search = (searchParams.get("search") || "").trim();
    const withBills = searchParams.get("withBills") === "true";

    let query = supabaseAdmin
      .from("inventory_returns")
      .select(
        `*, products (id, name, sku, unit_of_measure, selling_price), locations (id, name), profiles:returned_by (id, full_name), customers (id, shop_name, owner_name, route)`,
        { count: "exact" }
      );

    if (businessId) query = query.eq("business_id", businessId);
    if (salesRepId) query = query.eq("returned_by", salesRepId);
    if (customerId) query = query.eq("customer_id", customerId);
    if (returnBatchId) query = query.eq("return_batch_id", returnBatchId);

    // All items saved under one return note share a [NOTE:code] tag
    const noteCode = (searchParams.get("noteCode") || "").replace(/[^A-Za-z0-9-]/g, "");
    if (noteCode) query = query.ilike("reason", `%[NOTE:${noteCode}]%`);

    if (status) {
      if (status.includes(",")) {
        const statuses = status.split(",").map((s) => s.trim());
        query = query.in("status", statuses);
      } else {
        query = query.eq("status", status);
      }
    }

    const returnType = searchParams.get("returnType") || searchParams.get("return_type");
    if (returnType) query = query.eq("return_type", returnType);

    if (unsettled === "true") {
      // Include returns with no reason — NOT ILIKE alone drops NULL rows
      query = query.or("reason.is.null,reason.not.ilike.%[SETTLED_IN_PAYMENT:%");
    }

    // Date Filtering
    if (startDate) query = query.gte("created_at", startDate);
    if (endDate) {
      const endDateTime = new Date(endDate);
      endDateTime.setHours(23, 59, 59, 999);
      query = query.lte("created_at", endDateTime.toISOString());
    }

    // Search Filtering across return_number and reason
    if (search) {
      query = query.or(
        `return_number.ilike.%${search}%,reason.ilike.%${search}%`
      );
    }

    query = query.order("created_at", { ascending: false });

    if (limitParam && limitParam !== "all" && parseInt(limitParam) > 0) {
      const page = parseInt(pageParam || "1");
      const limit = parseInt(limitParam);
      const start = (page - 1) * limit;
      const end = start + limit - 1;
      query = query.range(start, end);

      const { data, count, error } = await query;
      if (error) {
        console.error("GET Returns Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({
        data: withBills ? await attachBillInfo(data || []) : data,
        total: count || 0,
        page,
        totalPages: Math.ceil((count || 0) / limit),
      });
    } else {
      const { data: rawData, count, error } = await query;
      if (error) {
        console.error("GET Returns Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      let data = dispatchedOnly ? await filterDispatchedReturns(rawData || []) : rawData;
      if (withBills) data = await attachBillInfo(data || []);
      return NextResponse.json({
        data,
        total: dispatchedOnly ? data?.length || 0 : count || (data?.length || 0),
        page: 1,
        totalPages: 1,
      });
    }
  } catch (err: any) {
    console.error("GET Returns Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
