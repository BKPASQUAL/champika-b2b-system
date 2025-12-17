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
      invoice_no, // Ensure this is read
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

    // 4. Update Product Stocks
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

    // 5. Update Master Product Total & Invoice
    const { data: product } = await supabase
      .from("products")
      .select("stock_quantity, damaged_quantity, selling_price")
      .eq("id", product_id)
      .single();

    if (product) {
      // Update Product
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

      // --- 6. UPDATE INVOICE TOTALS ---
      if (invoice_no) {
        const { data: invoice } = await supabase
          .from("invoices")
          .select("id, order_id, total_amount, due_amount")
          .eq("invoice_no", invoice_no)
          .single();

        if (invoice) {
          // Determine Price to Refund
          let refundUnitPrice = product.selling_price;

          if (invoice.order_id) {
            // Try to find exact price paid
            const { data: orderItem } = await supabase
              .from("order_items")
              .select("unit_price")
              .eq("order_id", invoice.order_id)
              .eq("product_id", product_id)
              .single();

            if (orderItem && orderItem.unit_price) {
              refundUnitPrice = Number(orderItem.unit_price);
            }
          }

          const refundTotal = Number(quantity) * refundUnitPrice;
          const newTotal = Math.max(
            0,
            Number(invoice.total_amount) - refundTotal
          );
          const newDue = Number(invoice.due_amount) - refundTotal; // Can be negative (credit)

          await supabase
            .from("invoices")
            .update({
              total_amount: newTotal,
              due_amount: newDue,
            })
            .eq("id", invoice.id);
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
