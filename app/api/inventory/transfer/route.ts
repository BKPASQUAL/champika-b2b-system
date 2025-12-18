import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

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

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // --- 1. Auto-detect Invoice ---
    if ((!invoice_no || invoice_no === "all") && customer_id && product_id) {
      const { data: latestOrder } = await supabase
        .from("orders")
        .select("invoice_no, id, created_at, order_items!inner(product_id)")
        .eq("customer_id", customer_id)
        .eq("order_items.product_id", product_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (latestOrder && latestOrder.invoice_no) {
        invoice_no = latestOrder.invoice_no;
        const tag = `[${invoice_no}]`;
        if (!reason?.includes(tag)) {
          reason = `${tag} ${reason || ""}`.trim();
        }
      }
    }

    const return_number = `RET-${Date.now().toString().slice(-6)}`;

    // --- 2. Create Return Record ---
    const { data: returnRecord, error: returnError } = await supabase
      .from("inventory_returns")
      .insert({
        return_number,
        product_id,
        location_id,
        business_id,
        customer_id,
        quantity,
        return_type,
        reason,
        returned_by: user.id,
      })
      .select()
      .single();

    if (returnError) throw returnError;

    // --- 3. Update Specific Location Stock ---
    const { data: existingStock } = await supabase
      .from("product_stocks")
      .select("*")
      .eq("product_id", product_id)
      .eq("location_id", location_id)
      .single();

    if (existingStock) {
      const updateData: any = {};
      if (return_type === "Good") {
        updateData.quantity = Number(existingStock.quantity) + Number(quantity);
      } else {
        updateData.damaged_quantity =
          Number(existingStock.damaged_quantity || 0) + Number(quantity);
      }
      await supabase
        .from("product_stocks")
        .update(updateData)
        .eq("id", existingStock.id);
    } else {
      await supabase.from("product_stocks").insert({
        product_id,
        location_id,
        quantity: return_type === "Good" ? quantity : 0,
        damaged_quantity: return_type === "Damage" ? quantity : 0,
        last_updated: new Date().toISOString(),
      });
    }

    // --- 4. Update Product Catalog (Visible in Products Page) ---
    const { data: product } = await supabase
      .from("products")
      .select("name, stock_quantity, damaged_quantity")
      .eq("id", product_id)
      .single();

    if (product) {
      const updateProdData: any = {};
      if (return_type === "Good") {
        updateProdData.stock_quantity =
          Number(product.stock_quantity || 0) + Number(quantity);
      } else {
        updateProdData.damaged_quantity =
          Number(product.damaged_quantity || 0) + Number(quantity);
      }
      await supabase
        .from("products")
        .update(updateProdData)
        .eq("id", product_id);

      // --- 5. Log to Transaction History Page ---
      await supabase.from("account_transactions").insert({
        transaction_type: "INVENTORY_RETURN",
        description: `Return (${return_type}): ${quantity} units of ${product.name}. Reason: ${reason}`,
        amount: 0,
        transaction_date: new Date().toISOString(),
        business_id: business_id,
        metadata: {
          return_id: returnRecord.id,
          product_id,
          quantity,
          type: return_type,
          invoice_no,
        },
      });
    }

    // --- 6. Recalculate Financials ---
    if (invoice_no || invoice_id) {
      let invoiceQuery = supabase.from("invoices").select("*");
      if (invoice_id) invoiceQuery = invoiceQuery.eq("id", invoice_id);
      else invoiceQuery = invoiceQuery.eq("invoice_no", invoice_no);

      const { data: invoice } = await invoiceQuery.single();
      if (invoice && invoice.order_id) {
        const { data: orderItem } = await supabase
          .from("order_items")
          .select("*")
          .eq("order_id", invoice.order_id)
          .eq("product_id", product_id)
          .single();

        if (orderItem) {
          const oldQty = Number(orderItem.quantity);
          const newQty = Math.max(0, oldQty - Number(quantity));
          const unitPrice = Number(orderItem.unit_price);
          const newTotalItemPrice = newQty * unitPrice;

          const oldComm = Number(orderItem.commission_earned || 0);
          const newComm = newQty * (oldQty > 0 ? oldComm / oldQty : 0);

          await supabase
            .from("order_items")
            .update({
              quantity: newQty,
              total_price: newTotalItemPrice,
              commission_earned: newComm,
            })
            .eq("id", orderItem.id);

          const { data: allItems } = await supabase
            .from("order_items")
            .select("total_price, commission_earned")
            .eq("order_id", invoice.order_id);

          const newTotal =
            allItems?.reduce((sum, i) => sum + Number(i.total_price), 0) || 0;
          const newCommTotal =
            allItems?.reduce(
              (sum, i) => sum + Number(i.commission_earned || 0),
              0
            ) || 0;

          await supabase
            .from("invoices")
            .update({ total_amount: newTotal })
            .eq("id", invoice.id);
          await supabase
            .from("orders")
            .update({ total_amount: newTotal })
            .eq("id", invoice.order_id);

          const diff = Number(invoice.total_amount) - newTotal;
          if (invoice.customer_id && diff !== 0) {
            const { data: cust } = await supabase
              .from("customers")
              .select("outstanding_balance")
              .eq("id", invoice.customer_id)
              .single();
            if (cust) {
              await supabase
                .from("customers")
                .update({
                  outstanding_balance: Number(cust.outstanding_balance) - diff,
                })
                .eq("id", invoice.customer_id);
            }
          }
          await supabase
            .from("rep_commissions")
            .update({ total_commission_amount: newCommTotal })
            .eq("order_id", invoice.order_id);
        }
      }
    }

    return NextResponse.json(returnRecord);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const businessId = searchParams.get("businessId");
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {},
      },
    }
  );

  let query = supabase
    .from("inventory_returns")
    .select("*, products(name, sku), locations(name), profiles(full_name)")
    .order("created_at", { ascending: false });
  if (businessId) query = query.eq("business_id", businessId);
  const { data, error } = await query;
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
