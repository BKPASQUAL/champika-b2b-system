import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { triggerAgencyBillsForInvoice } from "@/app/lib/inter-branch-billing";
import { BUSINESS_IDS } from "@/app/config/business-constants";

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
    if ((!invoice_no || invoice_no === "all") && customer_id && product_id) {
      const { data: latestOrder } = await supabaseAdmin
        .from("orders")
        .select("invoice_no, id, created_at, order_items!inner(product_id)")
        .eq("customer_id", customer_id)
        .eq("order_items.product_id", product_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latestOrder && (latestOrder as any).invoice_no) {
        invoice_no = (latestOrder as any).invoice_no;
        const tag = `[${invoice_no}]`;
        if (!reason?.includes(tag)) {
          reason = `${tag} ${reason || ""}`.trim();
        }
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
    // full original bill amount, so invoice/order totals and the customer's
    // outstanding balance must NOT be reduced for this return type.
    if ((invoice_no || invoice_id) && return_type !== "Exchange") {
      let invoiceQuery = supabaseAdmin
        .from("invoices")
        .select(
          "id, invoice_no, order_id, total_amount, due_amount, customer_id, paid_amount"
        );

      if (invoice_id) invoiceQuery = invoiceQuery.eq("id", invoice_id);
      else if (invoice_no)
        invoiceQuery = invoiceQuery.eq("invoice_no", invoice_no);

      const { data: invoice } = await invoiceQuery.maybeSingle();

      if (invoice && invoice.order_id) {
        const { data: orderItem } = await supabaseAdmin
          .from("order_items")
          .select("*")
          .eq("order_id", invoice.order_id)
          .eq("product_id", product_id)
          .maybeSingle();

        if (orderItem) {
          // Adjust Order Item
          const oldQty = Number(orderItem.quantity);
          const returnQty = Number(quantity);
          const newQty = Math.max(0, oldQty - returnQty);
          const unitPrice = Number(orderItem.unit_price);
          const newTotalItemPrice = newQty * unitPrice;

          const oldComm = Number(orderItem.commission_earned || 0);
          const newComm = newQty * (oldQty > 0 ? oldComm / oldQty : 0);

          await supabaseAdmin
            .from("order_items")
            .update({
              quantity: newQty,
              total_price: newTotalItemPrice,
              commission_earned: newComm,
            })
            .eq("id", orderItem.id);

          // Recalculate Totals
          const { data: allItems } = await supabaseAdmin
            .from("order_items")
            .select("total_price, commission_earned")
            .eq("order_id", invoice.order_id);

          let newGrandTotal = 0;
          let newCommissionTotal = 0;

          if (allItems) {
            newGrandTotal = allItems.reduce(
              (sum, item) => sum + Number(item.total_price),
              0
            );
            newCommissionTotal = allItems.reduce(
              (sum, item) => sum + Number(item.commission_earned || 0),
              0
            );
          }

          // Mark that this return already reduced the invoice & commission,
          // so rep sales reports don't deduct it a second time
          await supabaseAdmin
            .from("inventory_returns")
            .update({ reason: `${returnRecord.reason || ""} [INVOICE_ADJUSTED]`.trim() })
            .eq("id", returnRecord.id);

          await supabaseAdmin
            .from("invoices")
            .update({ total_amount: newGrandTotal })
            .eq("id", invoice.id);
          await supabaseAdmin
            .from("orders")
            .update({ total_amount: newGrandTotal })
            .eq("id", invoice.order_id);

          // Update Customer Balance
          const diff = Number(invoice.total_amount) - newGrandTotal;
          if (invoice.customer_id && diff !== 0) {
            const { data: customer } = await supabaseAdmin
              .from("customers")
              .select("outstanding_balance")
              .eq("id", invoice.customer_id)
              .maybeSingle();

            if (customer) {
              const newBal = Number(customer.outstanding_balance || 0) - diff;
              await supabaseAdmin
                .from("customers")
                .update({ outstanding_balance: newBal })
                .eq("id", invoice.customer_id);
            }
          }

          // Update Rep Commission
          const { data: repComm } = await supabaseAdmin
            .from("rep_commissions")
            .select("id")
            .eq("order_id", invoice.order_id)
            .maybeSingle();

          if (repComm) {
            await supabaseAdmin
              .from("rep_commissions")
              .update({ total_commission_amount: newCommissionTotal })
              .eq("id", repComm.id);
          }
        }
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

// Keep only return notes whose pickup order has been dispatched / finalized.
async function filterDispatchedReturns(rows: any[]): Promise<any[]> {
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
  return rows.filter((r) => dispatched.has(r.return_number));
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
      query = query.not("reason", "ilike", "%[SETTLED_IN_PAYMENT:%");
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
        data,
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
      const data = dispatchedOnly ? await filterDispatchedReturns(rawData || []) : rawData;
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
