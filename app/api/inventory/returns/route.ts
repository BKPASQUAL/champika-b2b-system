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
    const {
      product_id,
      location_id,
      quantity,
      return_type,
      reason,
      business_id,
      customer_id,
      invoice_no, // Required to link return to invoice
      invoice_id,
    } = body;

    // 1. Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // 2. Generate Return Number
    const return_number = `RET-${Date.now().toString().slice(-6)}`;

    // 3. Create Return Record
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

    // 4. Update Product Stocks (Inventory)
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

    // 5. Update Master Product Totals
    const { data: product } = await supabase
      .from("products")
      .select("stock_quantity, damaged_quantity, selling_price")
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

      // --- 6. AUTO-UPDATE INVOICE FINANCIALS ---
      // This section ensures the invoice grand total is reduced immediately
      if (invoice_no || invoice_id) {
        let invoiceQuery = supabase
          .from("invoices")
          .select(
            "id, order_id, total_amount, due_amount, customer_id, paid_amount"
          );

        if (invoice_id) {
          invoiceQuery = invoiceQuery.eq("id", invoice_id);
        } else if (invoice_no) {
          invoiceQuery = invoiceQuery.eq("invoice_no", invoice_no);
        }

        const { data: invoice } = await invoiceQuery.single();

        if (invoice && invoice.order_id) {
          // A. Update the specific Order Item (Reduce Quantity & Price)
          const { data: orderItem } = await supabase
            .from("order_items")
            .select("*")
            .eq("order_id", invoice.order_id)
            .eq("product_id", product_id)
            .single();

          if (orderItem) {
            const unitPrice = Number(orderItem.unit_price);
            const oldQty = Number(orderItem.quantity);
            const oldCommission = Number(orderItem.commission_earned || 0);

            // Calculate Commission per unit
            const unitCommission = oldQty > 0 ? oldCommission / oldQty : 0;

            const returnQty = Number(quantity);
            const newQuantity = Math.max(0, oldQty - returnQty);
            const newItemTotal = newQuantity * unitPrice;
            const newCommissionTotal = newQuantity * unitCommission;

            // Update Line Item in DB
            await supabase
              .from("order_items")
              .update({
                quantity: newQuantity,
                total_price: newItemTotal,
                commission_earned: newCommissionTotal,
              })
              .eq("id", orderItem.id);

            // B. RECALCULATE Grand Total (Summing all items freshly)
            // This fixes the "Grand Total not changing" issue
            const { data: allItems } = await supabase
              .from("order_items")
              .select("total_price, commission_earned")
              .eq("order_id", invoice.order_id);

            if (allItems) {
              const newGrandTotal = allItems.reduce(
                (sum, item) => sum + Number(item.total_price),
                0
              );

              const newTotalCommission = allItems.reduce(
                (sum, item) => sum + Number(item.commission_earned || 0),
                0
              );

              // Calculate new Due Amount
              const newDue = newGrandTotal - Number(invoice.paid_amount || 0);

              // Update Invoice Total & Due Amount
              await supabase
                .from("invoices")
                .update({
                  total_amount: newGrandTotal,
                  due_amount: newDue,
                })
                .eq("id", invoice.id);

              // Update Order Total
              await supabase
                .from("orders")
                .update({
                  total_amount: newGrandTotal,
                })
                .eq("id", invoice.order_id);

              // Update Rep Commission
              const { data: repComm } = await supabase
                .from("rep_commissions")
                .select("id")
                .eq("order_id", invoice.order_id)
                .single();

              if (repComm) {
                await supabase
                  .from("rep_commissions")
                  .update({
                    total_commission_amount: newTotalCommission,
                  })
                  .eq("id", repComm.id);
              }

              // C. Update Customer Outstanding Balance
              const diff = Number(invoice.total_amount) - newGrandTotal;

              if (invoice.customer_id && diff !== 0) {
                const { data: customer } = await supabase
                  .from("customers")
                  .select("outstanding_balance")
                  .eq("id", invoice.customer_id)
                  .single();

                if (customer) {
                  const currentBalance = Number(
                    customer.outstanding_balance || 0
                  );
                  await supabase
                    .from("customers")
                    .update({ outstanding_balance: currentBalance - diff })
                    .eq("id", invoice.customer_id);
                }
              }
            }
          }
        }
      }
    }

    return NextResponse.json(returnRecord);
  } catch (error: any) {
    console.error("Return error:", error);
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
