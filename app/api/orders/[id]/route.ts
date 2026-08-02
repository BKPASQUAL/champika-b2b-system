import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { triggerAgencyBillsForInvoice } from "@/app/lib/inter-branch-billing";
import { BUSINESS_IDS } from "@/app/config/business-constants";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const CHAMPIKA_BUSINESS_IDS = [
  BUSINESS_IDS.CHAMPIKA_RETAIL,
  BUSINESS_IDS.CHAMPIKA_DISTRIBUTION,
];

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
          id,
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
          actual_unit_cost,
          products (
            sku,
            name,
            unit_of_measure,
            images,
            selling_price,
            cost_price
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

    // Fetch Returns linked to this order/invoice (by ORD-id, order_id, or invoice_no)
    let returns: any[] = [];
    const searchConditions = [`reason.ilike.%ORD-${id}%`];
    if (order.order_id) {
      searchConditions.push(`reason.ilike.%${order.order_id}%`);
    }
    if (invoiceNumber) {
      searchConditions.push(`reason.ilike.%${invoiceNumber}%`);
    }

    const { data: returnsRaw } = await supabaseAdmin
      .from("inventory_returns")
      .select(`
        id,
        product_id,
        quantity,
        reason,
        return_type,
        created_at,
        products (
          id,
          name,
          sku,
          unit_of_measure,
          selling_price
        )
      `)
      .or(searchConditions.join(","));

    returns = (returnsRaw || []).map((r: any) => ({
      id: r.id,
      productId: r.product_id,
      productName: r.products?.name || "Unknown",
      sku: r.products?.sku || "",
      unit: r.products?.unit_of_measure || "Unit",
      quantity: r.quantity,
      returnType: r.return_type || "Exchange",
      price: r.products?.selling_price || 0,
      totalValue: (r.quantity || 0) * (r.products?.selling_price || 0),
      createdAt: r.created_at,
    }));

    // Map DB structure to Frontend structure
    const response = {
      id: order.id,
      orderId: order.order_id,
      invoiceNo: invoiceNumber,
      invoiceId: order.invoices?.[0]?.id || null,
      date: order.order_date,
      status: order.status,
      paymentStatus: order.invoices?.[0]?.status || "Unpaid",
      salesRep: order.profiles?.full_name || "Unknown",
      salesRepId: order.sales_rep_id,
      customerId: order.customer_id,
      notes: order.notes,

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
        costPrice: Number(item.actual_unit_cost) > 0
          ? Number(item.actual_unit_cost)
          : Number(item.products?.cost_price) || 0,
        qty: item.quantity,
        free: item.free_quantity,
        disc: 0,
        total: item.total_price,
      })),

      // Returns
      returns,

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

  // 2. Location stock
  let targetLocationIds = [...locationIds];

  if (targetLocationIds.length === 0) {
    const { data: mainLoc } = await supabaseAdmin
      .from("locations")
      .select("id")
      .is("business_id", null)
      .eq("name", "Main Warehouse")
      .maybeSingle();

    if (mainLoc?.id) {
      targetLocationIds = [mainLoc.id];
    } else {
      const { data: anyLoc } = await supabaseAdmin
        .from("locations")
        .select("id")
        .limit(1)
        .maybeSingle();
      if (anyLoc?.id) {
        targetLocationIds = [anyLoc.id];
      }
    }
  }

  if (targetLocationIds.length > 0) {
    const { data: locStocks } = await supabaseAdmin
      .from("product_stocks")
      .select("id, quantity")
      .eq("product_id", productId)
      .in("location_id", targetLocationIds)
      .order("quantity", { ascending: false });

    if (locStocks && locStocks.length > 0) {
      await supabaseAdmin
        .from("product_stocks")
        .update({ quantity: locStocks[0].quantity + qty })
        .eq("id", locStocks[0].id);
    } else {
      await supabaseAdmin
        .from("product_stocks")
        .insert({
          product_id: productId,
          location_id: targetLocationIds[0],
          quantity: qty,
        });
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
      .update({ stock_quantity: prod.stock_quantity - qty })
      .eq("id", productId);
  }

  // 2. Location stock – waterfall from highest to lowest
  let remaining = qty;
  let targetLocationIds = [...locationIds];

  if (targetLocationIds.length === 0) {
    const { data: mainLoc } = await supabaseAdmin
      .from("locations")
      .select("id")
      .is("business_id", null)
      .eq("name", "Main Warehouse")
      .maybeSingle();

    if (mainLoc?.id) {
      targetLocationIds = [mainLoc.id];
    } else {
      const { data: anyLoc } = await supabaseAdmin
        .from("locations")
        .select("id")
        .limit(1)
        .maybeSingle();
      if (anyLoc?.id) {
        targetLocationIds = [anyLoc.id];
      }
    }
  }

  if (targetLocationIds.length > 0) {
    const { data: locStocks } = await supabaseAdmin
      .from("product_stocks")
      .select("id, quantity")
      .eq("product_id", productId)
      .in("location_id", targetLocationIds)
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

    if (remaining > 0) {
      const targetLocationId = targetLocationIds[0];
      const { data: existingStock } = await supabaseAdmin
        .from("product_stocks")
        .select("id, quantity")
        .eq("product_id", productId)
        .eq("location_id", targetLocationId)
        .maybeSingle();

      if (existingStock) {
        await supabaseAdmin
          .from("product_stocks")
          .update({
            quantity: Number(existingStock.quantity) - remaining,
            last_updated: new Date().toISOString(),
          })
          .eq("id", existingStock.id);
      } else {
        await supabaseAdmin
          .from("product_stocks")
          .insert({
            product_id: productId,
            location_id: targetLocationId,
            quantity: -remaining,
          });
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
    const { status, action, items, totalAmount, userId, reason } = body;

    // --- SCENARIO 1: UPDATE ORDER ITEMS (EDIT MODE) ---
    if (action === "update_items" && items) {
      const { newItems = [], deletedItemIds = [], orderDate, returnsList = [], deletedReturnIds = [] } = body;

      // 1. Fetch current order (need sales_rep_id + customer_id + business_id + old total)
      const { data: currentOrder } = await supabaseAdmin
        .from("orders")
        .select("total_amount, customer_id, sales_rep_id, business_id")
        .eq("id", id)
        .single();

      if (!currentOrder) throw new Error("Order data validation failed");

      const locationIds = await getRepLocationIds(currentOrder.sales_rep_id);
      let targetLocationId = locationIds[0] || null;
      if (!targetLocationId) {
        const { data: mainLoc } = await supabaseAdmin
          .from("locations")
          .select("id")
          .eq("name", "Main Warehouse")
          .maybeSingle();
        targetLocationId = mainLoc?.id || null;
      }

      // Handle deleted return items
      for (const delRetId of deletedReturnIds) {
        await supabaseAdmin.from("inventory_returns").delete().eq("id", delRetId);
      }

      // Handle updated & new return items
      let retIdx = 0;
      for (const ret of returnsList) {
        retIdx++;
        if (ret.id && !ret.isNew && !String(ret.id).startsWith("new-")) {
          await supabaseAdmin
            .from("inventory_returns")
            .update({
              quantity: ret.quantity,
              return_type: ret.returnType || ret.return_type || "Exchange",
            })
            .eq("id", ret.id);
        } else if (ret.productId && ret.quantity > 0) {
          const { data: inv } = await supabaseAdmin
            .from("invoices")
            .select("id, invoice_no")
            .eq("order_id", id)
            .maybeSingle();

          const invNo = inv?.invoice_no;
          const reasonText = invNo
            ? `[${invNo}] [ORD-${id}] Order return`
            : `[ORD-${id}] Order return`;

          const returnNumber = `RET-${Date.now().toString().slice(-6)}-${retIdx}`;

          const { error: insertErr } = await supabaseAdmin.from("inventory_returns").insert({
            return_number: returnNumber,
            product_id: ret.productId,
            location_id: targetLocationId,
            business_id: currentOrder.business_id || null,
            quantity: Number(ret.quantity),
            return_type: ret.returnType || ret.return_type || "Exchange",
            customer_id: currentOrder.customer_id,
            reason: reasonText,
            status: "Completed",
            created_at: new Date().toISOString(),
          });

          if (insertErr) {
            console.error("Failed to insert inventory_returns item:", insertErr);
            throw new Error(`Failed to save return item: ${insertErr.message}`);
          }

          // Adjust Stock: Increase Good Stock for 'Good' returns & Increase Damaged Stock for Damage/Exchange returns
          const returnType = ret.returnType || ret.return_type || "Exchange";
          const isGoodReturn = returnType === "Good";
          const isDamageReturn = returnType !== "Good";
          const { data: prod } = await supabaseAdmin
            .from("products")
            .select("stock_quantity, damaged_quantity")
            .eq("id", ret.productId)
            .single();

          if (prod) {
            await supabaseAdmin
              .from("products")
              .update({
                stock_quantity: isGoodReturn
                  ? (prod.stock_quantity || 0) + Number(ret.quantity)
                  : (prod.stock_quantity || 0),
                damaged_quantity: isDamageReturn
                  ? (prod.damaged_quantity || 0) + Number(ret.quantity)
                  : (prod.damaged_quantity || 0),
              })
              .eq("id", ret.productId);
          }
        }
      }

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

    // --- SCENARIO 3: REQUEST INVOICE/ORDER CANCELLATION ---
    if (action === "request_cancel") {
      if (!userId) {
        return NextResponse.json({ error: "Unauthorized: userId is required" }, { status: 401 });
      }
      if (!reason) {
        return NextResponse.json({ error: "Reason is required to request cancellation" }, { status: 400 });
      }

      // Fetch the order status and notes
      const { data: order, error: orderError } = await supabaseAdmin
        .from("orders")
        .select("status, notes")
        .eq("id", id)
        .single();

      if (orderError || !order) {
        return NextResponse.json({ error: "Order not found" }, { status: 404 });
      }

      if (!["Processing", "Checking", "Loading"].includes(order.status)) {
        return NextResponse.json(
          { error: `Cancellation can only be requested during Processing, Checking, or Loading. Current status is: ${order.status}` },
          { status: 400 }
        );
      }

      if (order.notes?.includes("[CANCEL_REQUEST:")) {
        return NextResponse.json({ error: "A cancellation request is already pending for this order" }, { status: 400 });
      }

      // Format notes with the cancel request prefix
      const currentNotes = order.notes || "";
      const cleanNotes = currentNotes.includes("[CANCEL_REQUEST:")
        ? currentNotes.replace(/\[CANCEL_REQUEST:\s*.*?\]\s*/g, "").trim()
        : currentNotes.trim();
      const newNotes = `[CANCEL_REQUEST: ${reason}]${cleanNotes ? "\n" + cleanNotes : ""}`;

      // Update the order notes
      const { error: updateError } = await supabaseAdmin
        .from("orders")
        .update({ notes: newNotes })
        .eq("id", id);

      if (updateError) throw updateError;

      // Find the associated invoice to log history
      const { data: invoice } = await supabaseAdmin
        .from("invoices")
        .select("id")
        .eq("order_id", id)
        .single();

      if (invoice) {
        await supabaseAdmin.from("invoice_history").insert({
          invoice_id: invoice.id,
          previous_data: {
            status: order.status,
            notes: order.notes,
          },
          changed_by: userId,
          change_reason: `Cancel requested: ${reason}`,
          changed_at: new Date().toISOString(),
        });
      }

      return NextResponse.json({ message: "Cancellation requested successfully" });
    }

    // --- SCENARIO 4: REJECT CANCELLATION REQUEST ---
    if (action === "reject_cancel_request") {
      if (!userId) {
        return NextResponse.json({ error: "Unauthorized: userId is required" }, { status: 401 });
      }

      // Fetch the order
      const { data: order, error: orderError } = await supabaseAdmin
        .from("orders")
        .select("status, notes")
        .eq("id", id)
        .single();

      if (orderError || !order) {
        return NextResponse.json({ error: "Order not found" }, { status: 404 });
      }

      if (!order.notes?.includes("[CANCEL_REQUEST:")) {
        return NextResponse.json({ error: "No pending cancellation request found for this order" }, { status: 400 });
      }

      // Strip the cancel request prefix
      const cleanNotes = order.notes.replace(/\[CANCEL_REQUEST:\s*.*?\]\s*/g, "").trim();

      // Update order notes
      const { error: updateError } = await supabaseAdmin
        .from("orders")
        .update({ notes: cleanNotes || null })
        .eq("id", id);

      if (updateError) throw updateError;

      // Log to invoice history
      const { data: invoice } = await supabaseAdmin
        .from("invoices")
        .select("id")
        .eq("order_id", id)
        .single();

      if (invoice) {
        await supabaseAdmin.from("invoice_history").insert({
          invoice_id: invoice.id,
          previous_data: {
            status: order.status,
            notes: order.notes,
          },
          changed_by: userId,
          change_reason: "Cancel request rejected by Admin",
          changed_at: new Date().toISOString(),
        });
      }

      return NextResponse.json({ message: "Cancellation request rejected successfully" });
    }

    // --- SCENARIO 2: STATUS UPDATE (APPROVE/REJECT/CANCEL) ---
    if (status) {
      const { data: currentOrder, error: fetchError } = await supabaseAdmin
        .from("orders")
        .select("status, sales_rep_id, customer_id")
        .eq("id", id)
        .single();

      if (fetchError) throw fetchError;

      // Log status transition to invoice_history
      if (currentOrder && currentOrder.status !== status) {
        const { data: invoice } = await supabaseAdmin
          .from("invoices")
          .select("id")
          .eq("order_id", id)
          .single();

        if (invoice) {
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
                  cookiesToSet.forEach(({ name, value, options }) =>
                    cookieStore.set(name, value, options)
                  );
                },
              },
            }
          );
          const { data: { user } } = await supabase.auth.getUser();
          const activeUserId = user?.id || userId || null;

          await supabaseAdmin.from("invoice_history").insert({
            invoice_id: invoice.id,
            previous_data: {
              status: currentOrder.status,
              new_status: status,
            },
            changed_by: activeUserId,
            change_reason: reason || `Status changed from ${currentOrder.status} to ${status}`,
            changed_at: new Date().toISOString(),
          });
        }
      }

      if ((status === "Cancelled" || status === "Rejected") && currentOrder.status !== "Cancelled" && currentOrder.status !== "Rejected") {
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

        // Reverse Returns attached to this order
        const { data: invData } = await supabaseAdmin
          .from("invoices")
          .select("invoice_no")
          .eq("order_id", id)
          .maybeSingle();

        const invNo = invData?.invoice_no || "";
        const orConditions = [
          `reason.ilike.%ORD-${id}%`,
          invNo ? `reason.ilike.%${invNo}%` : null,
          currentOrder.customer_id ? `customer_id.eq.${currentOrder.customer_id}` : null,
        ].filter(Boolean).join(",");

        const { data: returnItems } = await supabaseAdmin
          .from("inventory_returns")
          .select("id, product_id, quantity, return_type")
          .or(orConditions);

        if (returnItems && returnItems.length > 0) {
          for (const ret of returnItems) {
            const qty = Number(ret.quantity) || 0;
            if (qty <= 0 || !ret.product_id) continue;

            const isDamage = ret.return_type !== "Good";
            const { data: prod } = await supabaseAdmin
              .from("products")
              .select("stock_quantity, damaged_quantity")
              .eq("id", ret.product_id)
              .single();

            if (prod) {
              await supabaseAdmin
                .from("products")
                .update({
                  stock_quantity: (prod.stock_quantity || 0) + qty,
                  damaged_quantity: isDamage
                    ? Math.max(0, (prod.damaged_quantity || 0) - qty)
                    : (prod.damaged_quantity || 0),
                })
                .eq("id", ret.product_id);
            }

            if (locationIds.length > 0) {
              const { data: locStocks } = await supabaseAdmin
                .from("product_stocks")
                .select("id, quantity, damaged_quantity")
                .eq("product_id", ret.product_id)
                .in("location_id", locationIds);

              if (locStocks && locStocks.length > 0) {
                await supabaseAdmin
                  .from("product_stocks")
                  .update({
                    quantity: (locStocks[0].quantity || 0) + qty,
                    damaged_quantity: isDamage
                      ? Math.max(0, (locStocks[0].damaged_quantity || 0) - qty)
                      : (locStocks[0].damaged_quantity || 0),
                  })
                  .eq("id", locStocks[0].id);
              }
            }

            await supabaseAdmin.from("inventory_returns").delete().eq("id", ret.id);
          }
        }
      }

      const updatePayload: Record<string, any> = { status };
      if (status === "Pending") updatePayload.load_id = null;

      const { error } = await supabaseAdmin
        .from("orders")
        .update(updatePayload)
        .eq("id", id);

      if (error) throw error;

      // Trigger inter-branch bill when an order is marked Delivered
      if (status === "Delivered") {
        try {
          const { data: ord } = await supabaseAdmin
            .from("orders")
            .select("business_id")
            .eq("id", id)
            .single();

          if (ord && CHAMPIKA_BUSINESS_IDS.includes(ord.business_id)) {
            const { data: orderItems } = await supabaseAdmin
              .from("order_items")
              .select("product_id")
              .eq("order_id", id);

            const productIds = (orderItems || []).map((i: any) => i.product_id);
            await triggerAgencyBillsForInvoice(ord.business_id, productIds);
          }
        } catch (err) {
          console.error("Inter-branch billing failed (non-critical):", err);
        }
      }

      return NextResponse.json({ message: "Order updated successfully" });
    }

    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  } catch (error: any) {
    console.error("Order update error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
