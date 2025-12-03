import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    // Fetch Order with all relations
    // UPDATED: Selecting 'invoice_no' from 'invoices' table as well
    const { data: order, error } = await supabaseAdmin
      .from("orders")
      .select(
        `
        *,
        customers (
          shop_name,
          owner_name,
          phone,
          route,
          address
        ),
        profiles!orders_sales_rep_id_fkey (
          full_name
        ),
        invoices (
          invoice_no,
          status
        ),
        order_items (
          id,
          product_id,
          quantity,
          free_quantity,
          unit_price,
          total_price,
          products (
            sku,
            name,
            unit_of_measure,
            images
          )
        )
      `
      )
      .eq("id", id)
      .single();

    if (error) throw error;

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Determine Invoice Number (Check order record first, then invoices table)
    const invoiceNumber =
      order.invoice_no || order.invoices?.[0]?.invoice_no || null;

    // Map DB structure to Frontend structure
    const response = {
      id: order.id,
      orderId: order.order_id,
      invoiceNo: invoiceNumber, // <--- Using the resolved invoice number
      date: order.order_date,
      status: order.status,
      paymentStatus: order.invoices?.[0]?.status || "Unpaid",
      salesRep: order.profiles?.full_name || "Unknown",

      // Customer Details
      customer: {
        name: order.customers?.owner_name,
        shopName: order.customers?.shop_name,
        phone: order.customers?.phone,
        route: order.customers?.route,
        address: order.customers?.address,
      },

      // Items
      items: order.order_items.map((item: any) => ({
        id: item.id,
        productId: item.product_id,
        sku: item.products?.sku,
        name: item.products?.name,
        unit: item.products?.unit_of_measure || "unit",
        image: item.products?.images?.[0] || null,
        price: item.unit_price,
        qty: item.quantity,
        free: item.free_quantity,
        disc: 0,
        total: item.total_price,
      })),

      // Total
      totalAmount: order.total_amount,
    };

    return NextResponse.json(response);
  } catch (error: any) {
    console.error("Error fetching order:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PATCH: Approve, Reject, or EDIT Order Items
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const body = await request.json();
    const { status, action, items, totalAmount } = body;

    // --- SCENARIO 1: UPDATE ORDER ITEMS (EDIT MODE) ---
    if (action === "update_items" && items) {
      // 1. Fetch current order data
      const { data: currentOrder } = await supabaseAdmin
        .from("orders")
        .select("total_amount, customer_id")
        .eq("id", id)
        .single();

      // 2. Fetch existing items
      const { data: existingItems } = await supabaseAdmin
        .from("order_items")
        .select("id, product_id, quantity, free_quantity")
        .eq("order_id", id);

      if (!existingItems || !currentOrder) {
        throw new Error("Order data validation failed");
      }

      // 3. Process each item update
      for (const newItem of items) {
        const oldItem = existingItems.find((i) => i.id === newItem.id);

        if (oldItem) {
          const oldTotalQty = oldItem.quantity + oldItem.free_quantity;
          const newTotalQty = Number(newItem.qty) + Number(newItem.free);
          const diff = newTotalQty - oldTotalQty;

          if (diff !== 0) {
            const { data: product } = await supabaseAdmin
              .from("products")
              .select("stock_quantity")
              .eq("id", oldItem.product_id)
              .single();

            if (product) {
              await supabaseAdmin
                .from("products")
                .update({ stock_quantity: product.stock_quantity - diff })
                .eq("id", oldItem.product_id);
            }
          }

          await supabaseAdmin
            .from("order_items")
            .update({
              quantity: newItem.qty,
              free_quantity: newItem.free,
              unit_price: newItem.price,
              total_price: newItem.total,
            })
            .eq("id", newItem.id);
        }
      }

      // 4. Update Order Total
      await supabaseAdmin
        .from("orders")
        .update({ total_amount: totalAmount })
        .eq("id", id);

      // 5. Update Invoice Total (if exists)
      await supabaseAdmin
        .from("invoices")
        .update({ total_amount: totalAmount })
        .eq("order_id", id);

      // 6. Update Customer Balance
      const totalDiff = totalAmount - currentOrder.total_amount;
      if (totalDiff !== 0) {
        const { data: customer } = await supabaseAdmin
          .from("customers")
          .select("outstanding_balance")
          .eq("id", currentOrder.customer_id)
          .single();

        if (customer) {
          await supabaseAdmin
            .from("customers")
            .update({
              outstanding_balance: customer.outstanding_balance + totalDiff,
            })
            .eq("id", currentOrder.customer_id);
        }
      }

      return NextResponse.json({
        message: "Order items and stock updated successfully",
      });
    }

    // --- SCENARIO 2: STATUS UPDATE (APPROVE/REJECT) ---
    if (status) {
      const { data: currentOrder, error: fetchError } = await supabaseAdmin
        .from("orders")
        .select("status")
        .eq("id", id)
        .single();

      if (fetchError) throw fetchError;

      if (status === "Cancelled" && currentOrder.status !== "Cancelled") {
        const { data: orderItems, error: itemsError } = await supabaseAdmin
          .from("order_items")
          .select("product_id, quantity, free_quantity")
          .eq("order_id", id);

        if (itemsError) throw itemsError;

        if (orderItems) {
          for (const item of orderItems) {
            const { data: product, error: prodError } = await supabaseAdmin
              .from("products")
              .select("stock_quantity")
              .eq("id", item.product_id)
              .single();

            if (!prodError && product) {
              const currentStock = Number(product.stock_quantity) || 0;
              const restoreQty =
                (Number(item.quantity) || 0) +
                (Number(item.free_quantity) || 0);

              await supabaseAdmin
                .from("products")
                .update({ stock_quantity: currentStock + restoreQty })
                .eq("id", item.product_id);
            }
          }
        }
      }

      const { error } = await supabaseAdmin
        .from("orders")
        .update({ status })
        .eq("id", id);

      if (error) throw error;

      return NextResponse.json({ message: "Order updated successfully" });
    }

    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  } catch (error: any) {
    console.error("Order update error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
