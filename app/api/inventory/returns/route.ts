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
    console.log("--- RETURN API CALLED (Direct Item Update) ---");
    console.log("Payload:", JSON.stringify(body, null, 2));

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

    // --- Auto-detect Invoice ---
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

    // --- Create Return ---
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

    // --- Update Stock ---
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

    // --- Update Product Master ---
    const { data: product } = await supabase
      .from("products")
      .select("stock_quantity, damaged_quantity")
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
    }

    // --- FINANCIAL UPDATE (Modify Order Items Directly) ---
    console.log("--- START FINANCIAL UPDATE ---");
    let debugInfo = {};

    if (invoice_no || invoice_id) {
      let invoiceQuery = supabase
        .from("invoices")
        .select(
          "id, invoice_no, order_id, total_amount, due_amount, customer_id, paid_amount"
        );

      if (invoice_id) invoiceQuery = invoiceQuery.eq("id", invoice_id);
      else if (invoice_no)
        invoiceQuery = invoiceQuery.eq("invoice_no", invoice_no);

      const { data: invoice } = await invoiceQuery.single();

      if (invoice && invoice.order_id) {
        // 1. Find the specific Order Item
        const { data: orderItem } = await supabase
          .from("order_items")
          .select("*")
          .eq("order_id", invoice.order_id)
          .eq("product_id", product_id)
          .single();

        if (orderItem) {
          console.log(`Updating Order Item: ${orderItem.id}`);

          // Calculate New Values for the Item
          const oldQty = Number(orderItem.quantity);
          const returnQty = Number(quantity);
          const newQty = Math.max(0, oldQty - returnQty);

          const unitPrice = Number(orderItem.unit_price);
          const newTotalItemPrice = newQty * unitPrice;

          // Pro-rate commission
          const oldComm = Number(orderItem.commission_earned || 0);
          const commPerUnit = oldQty > 0 ? oldComm / oldQty : 0;
          const newComm = newQty * commPerUnit;

          // Update the Item in DB
          await supabase
            .from("order_items")
            .update({
              quantity: newQty,
              total_price: newTotalItemPrice,
              commission_earned: newComm,
            })
            .eq("id", orderItem.id);

          // 2. Recalculate Grand Total (Sum of Available Products)
          const { data: allItems } = await supabase
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

          console.log(`New Grand Total (Sum of Items): ${newGrandTotal}`);

          // 3. Update Invoice & Order
          // We do NOT subtract returns again, because the items themselves are reduced.
          await supabase
            .from("invoices")
            .update({ total_amount: newGrandTotal })
            .eq("id", invoice.id);

          await supabase
            .from("orders")
            .update({ total_amount: newGrandTotal })
            .eq("id", invoice.order_id);

          // 4. Update Customer Balance
          const diff = Number(invoice.total_amount) - newGrandTotal;
          console.log(`Adjusting Customer Balance by diff: ${diff}`);

          if (invoice.customer_id && diff !== 0) {
            const { data: customer } = await supabase
              .from("customers")
              .select("outstanding_balance")
              .eq("id", invoice.customer_id)
              .single();

            if (customer) {
              const oldBal = Number(customer.outstanding_balance || 0);
              const newBal = oldBal - diff;
              await supabase
                .from("customers")
                .update({ outstanding_balance: newBal })
                .eq("id", invoice.customer_id);
            }
          }

          // 5. Update Commission
          const { data: repComm } = await supabase
            .from("rep_commissions")
            .select("id")
            .eq("order_id", invoice.order_id)
            .single();

          if (repComm) {
            await supabase
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

  const { searchParams } = new URL(req.url);
  const businessId = searchParams.get("businessId");

  let query = supabase
    .from("inventory_returns")
    .select(
      `
      *,
      products (name, sku),
      locations (name),
      profiles (full_name)
    `
    )
    .order("created_at", { ascending: false });

  if (businessId) {
    query = query.eq("business_id", businessId);
  }

  const { data, error } = await query;

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
