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
            images,
            selling_price
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
      salesRepId: order.sales_rep_id,
      customerId: order.customer_id,

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
        sellingPrice: item.products?.selling_price ?? item.unit_price,
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

// ── Stock helpers ──────────────────────────────────────────────────────────

/** Restore qty back to global + location stocks for a rep */
async function restoreStock(
  productId: string,
  qty: number,
  locationIds: string[]
) {
  // 1. Global stock
  const { data: prod } = await supabaseAdmin
    .from("products")
    .select("stock_quantity")
    .eq("id", productId)
    .single();

  if (prod) {
    await supabaseAdmin
      .from("products")
      .update({ stock_quantity: prod.stock_quantity + qty })
      .eq("id", productId);
  }

  // 2. Location stock – add back to the location that currently has the most
  if (locationIds.length > 0) {
    const { data: locStocks } = await supabaseAdmin
      .from("product_stocks")
      .select("id, quantity")
      .eq("product_id", productId)
      .in("location_id", locationIds)
      .order("quantity", { ascending: false });

    if (locStocks && locStocks.length > 0) {
      await supabaseAdmin
        .from("product_stocks")
        .update({ quantity: locStocks[0].quantity + qty })
        .eq("id", locStocks[0].id);
    }
  }
}

/** Deduct qty from global + location stocks for a rep (highest-stock-first) */
async function deductStock(
  productId: string,
  qty: number,
  locationIds: string[]
) {
  // 1. Global stock
  const { data: prod } = await supabaseAdmin
    .from("products")
    .select("stock_quantity")
    .eq("id", productId)
    .single();

  if (prod) {
    await supabaseAdmin
      .from("products")
      .update({ stock_quantity: Math.max(0, prod.stock_quantity - qty) })
      .eq("id", productId);
  }

  // 2. Location stock – waterfall from highest to lowest
  if (locationIds.length > 0) {
    let remaining = qty;

    const { data: locStocks } = await supabaseAdmin
      .from("product_stocks")
      .select("id, quantity")
      .eq("product_id", productId)
      .in("location_id", locationIds)
      .gt("quantity", 0)
      .order("quantity", { ascending: false });

    if (locStocks) {
      for (const ls of locStocks) {
        if (remaining <= 0) break;
        const deduct = Math.min(ls.quantity, remaining);
        await supabaseAdmin
          .from("product_stocks")
          .update({ quantity: ls.quantity - deduct })
          .eq("id", ls.id);
        remaining -= deduct;
      }
    }
  }
}

/** Get assigned location IDs for a sales rep */
async function getRepLocationIds(repId: string): Promise<string[]> {
  if (!repId) return [];
  const { data } = await supabaseAdmin
    .from("location_assignments")
    .select("location_id")
    .eq("user_id", repId);
  return data?.map((a: any) => a.location_id) ?? [];
}

// ── PATCH: Approve, Reject, or EDIT Order Items ─────────────────────────────
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
      const { newItems = [], deletedItemIds = [], orderDate } = body;

      // 1. Fetch current order (need sales_rep_id + customer_id + old total)
      const { data: currentOrder } = await supabaseAdmin
        .from("orders")
        .select("total_amount, customer_id, sales_rep_id")
        .eq("id", id)
        .single();

      if (!currentOrder) throw new Error("Order data validation failed");

      const locationIds = await getRepLocationIds(currentOrder.sales_rep_id);

      // 2. Delete removed items → restore global + location stock
      for (const deletedId of deletedItemIds) {
        const { data: deletedItem } = await supabaseAdmin
          .from("order_items")
          .select("product_id, quantity, free_quantity")
          .eq("id", deletedId)
          .single();

        if (deletedItem) {
          const restoreQty =
            deletedItem.quantity + (deletedItem.free_quantity || 0);
          await restoreStock(deletedItem.product_id, restoreQty, locationIds);
          await supabaseAdmin
            .from("order_items")
            .delete()
            .eq("id", deletedId);
        }
      }

      // 3. Update existing items → adjust stock by diff
      for (const updItem of items) {
        const { data: oldItem } = await supabaseAdmin
          .from("order_items")
          .select("product_id, quantity, free_quantity")
          .eq("id", updItem.id)
          .single();

        if (oldItem) {
          const oldQty = oldItem.quantity + (oldItem.free_quantity || 0);
          const newQty = Number(updItem.qty) + Number(updItem.free || 0);
          const diff = newQty - oldQty; // positive = more stock needed, negative = stock freed

          if (diff > 0) {
            await deductStock(oldItem.product_id, diff, locationIds);
          } else if (diff < 0) {
            await restoreStock(oldItem.product_id, Math.abs(diff), locationIds);
          }

          await supabaseAdmin
            .from("order_items")
            .update({
              quantity: updItem.qty,
              free_quantity: updItem.free || 0,
              unit_price: updItem.price,
              total_price: updItem.total,
              discount_percent: updItem.discountPercent || 0,
              discount_amount: updItem.discountAmount || 0,
            })
            .eq("id", updItem.id);
        }
      }

      // 4. Insert new items → deduct global + location stock
      for (const ni of newItems) {
        await supabaseAdmin.from("order_items").insert({
          order_id: id,
          product_id: ni.productId,
          quantity: ni.qty,
          free_quantity: ni.free || 0,
          unit_price: ni.price,
          total_price: ni.total,
          discount_percent: ni.discountPercent || 0,
          discount_amount: ni.discountAmount || 0,
        });

        await deductStock(ni.productId, ni.qty + (ni.free || 0), locationIds);
      }

      // 5. Update order total + date
      await supabaseAdmin
        .from("orders")
        .update({
          total_amount: totalAmount,
          ...(orderDate ? { order_date: orderDate } : {}),
        })
        .eq("id", id);

      // 6. Update invoice total
      await supabaseAdmin
        .from("invoices")
        .update({ total_amount: totalAmount })
        .eq("order_id", id);

      // 7. Update customer outstanding balance
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

    // --- SCENARIO 2: STATUS UPDATE (APPROVE/REJECT/CANCEL) ---
    if (status) {
      const { data: currentOrder, error: fetchError } = await supabaseAdmin
        .from("orders")
        .select("status, sales_rep_id")
        .eq("id", id)
        .single();

      if (fetchError) throw fetchError;

      if (status === "Cancelled" && currentOrder.status !== "Cancelled") {
        const locationIds = await getRepLocationIds(currentOrder.sales_rep_id);

        const { data: orderItems, error: itemsError } = await supabaseAdmin
          .from("order_items")
          .select("product_id, quantity, free_quantity")
          .eq("order_id", id);

        if (itemsError) throw itemsError;

        if (orderItems) {
          for (const item of orderItems) {
            const restoreQty =
              (Number(item.quantity) || 0) + (Number(item.free_quantity) || 0);
            await restoreStock(item.product_id, restoreQty, locationIds);
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
