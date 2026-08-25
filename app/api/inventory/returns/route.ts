import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

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

    const return_number = `RET-${Date.now().toString().slice(-6)}`;

    // --- 2. Create Return Record ---
    const { data: returnRecord, error: returnError } = await supabaseAdmin
      .from("inventory_returns")
      .insert({
        return_number,
        product_id,
        location_id,
        business_id: business_id || null,
        customer_id: customer_id || null,
        quantity: Number(quantity),
        return_type,
        reason: reason || null,
        returned_by: activeUserId,
        status: "Completed",
      })
      .select()
      .single();

    if (returnError) throw returnError;

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

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const businessId = searchParams.get("businessId");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const search = (searchParams.get("search") || "").trim();

    // Pagination calculations
    const start = (page - 1) * limit;
    const end = start + limit - 1;

    let query = supabaseAdmin
      .from("inventory_returns")
      .select(
        `*, products (name, sku), locations (name), profiles:returned_by (full_name)`,
        { count: "exact" }
      );

    if (businessId) query = query.eq("business_id", businessId);

    // Date Filtering
    if (startDate) query = query.gte("created_at", startDate);
    if (endDate) {
      // Ensure end date includes the full day (e.g. 23:59:59)
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

    query = query.order("created_at", { ascending: false }).range(start, end);

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
  } catch (err: any) {
    console.error("GET Returns Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
