// app/api/inventory/returns/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

const isUuid = (val: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);

async function findReturnRecord(identifier: string, selectFields = "*"): Promise<any> {
  const cleanId = decodeURIComponent(identifier || "").trim();
  if (!cleanId) return null;

  const table = supabaseAdmin.from("inventory_returns") as any;

  // 1. Try by UUID if valid syntax
  if (isUuid(cleanId)) {
    const { data, error } = await table
      .select(selectFields)
      .eq("id", cleanId)
      .maybeSingle();
    if (!error && data) return data;
  }

  // 2. Try by return_number
  const { data: byNum, error: numErr } = await table
    .select(selectFields)
    .ilike("return_number", cleanId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!numErr && byNum) return byNum;

  // 3. Try by return_batch_id
  const { data: byBatch, error: batchErr } = await table
    .select(selectFields)
    .eq("return_batch_id", cleanId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!batchErr && byBatch) return byBatch;

  return null;
}

// Pickup order statuses where the lorry has not left yet (items can still be added/removed)
const PRE_DISPATCH_STATUSES = ["Pending", "Approved", "Processing", "Checking", "Loading"];

/** The LKR 0 pickup order created when this return (or its note) was approved. */
async function findPickupOrder(ret: any): Promise<{ id: string; order_id: string; status: string } | null> {
  if (!ret?.customer_id) return null;
  const noteCode = (ret.reason || "").match(/\[NOTE:([^\]]+)\]/)?.[1]?.trim();
  const filters = [`notes.ilike.%: ${ret.return_number}]%`];
  if (noteCode) filters.push(`notes.ilike.%[NOTE:${noteCode}]%`);
  const { data } = await supabaseAdmin
    .from("orders")
    .select("id, order_id, status, notes")
    .eq("customer_id", ret.customer_id)
    .neq("status", "Cancelled")
    .or(filters.join(","))
    .order("created_at", { ascending: false });
  const isEx = ret.return_type === "Exchange";
  const match = (data || []).find((o: any) => /\[DAMAGE_EXCHANGE:/.test(o.notes || "") === isEx);
  return match ? { id: match.id, order_id: match.order_id, status: match.status } : null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const selectQuery = `*, products (id, name, sku, unit_of_measure, selling_price, stock_quantity, damaged_quantity), locations (id, name), profiles:returned_by (id, full_name, role), customers (id, shop_name, owner_name, route, phone, outstanding_balance)`;
    const data = await findReturnRecord(id, selectQuery);

    if (!data) {
      return NextResponse.json({ error: "Return record not found" }, { status: 404 });
    }

    let sourceInvoice = null;
    if (data.reason) {
      const invMatch = data.reason.match(/\[INV:([^\]]+)\]/);
      if (invMatch && invMatch[1]) {
        const invNo = invMatch[1].trim();
        const { data: inv } = await supabaseAdmin
          .from("invoices")
          .select("id, invoice_no, total_amount, due_amount, status, created_at, payment_method")
          .ilike("invoice_no", invNo)
          .maybeSingle();
        if (inv) {
          sourceInvoice = inv;
        }
      }
    }

    // Where the pickup is, so the page knows if items can still be added/removed
    const pickup = data.status === "Approved" ? await findPickupOrder(data) : null;

    return NextResponse.json({
      ...data,
      source_invoice: sourceInvoice,
      pickup_order: pickup ? { order_id: pickup.order_id, status: pickup.status } : null,
    });
  } catch (error: any) {
    console.error("GET /api/inventory/returns/[id] error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Good returns add to sellable stock; Damage/Exchange add to damaged stock
function stockField(returnType: string) {
  return returnType === "Good" ? "quantity" : "damaged_quantity";
}

async function addStock(productId: string, locationId: string, field: string, delta: number) {
  if (!delta) return;
  const { data: ps } = await supabaseAdmin
    .from("product_stocks")
    .select("id, quantity, damaged_quantity")
    .eq("product_id", productId)
    .eq("location_id", locationId)
    .maybeSingle();
  if (ps) {
    await supabaseAdmin
      .from("product_stocks")
      .update({ [field]: Math.max(0, Number((ps as any)[field] || 0) + delta), last_updated: new Date().toISOString() })
      .eq("id", ps.id);
  } else if (delta > 0) {
    await supabaseAdmin.from("product_stocks").insert({
      product_id: productId,
      location_id: locationId,
      quantity: field === "quantity" ? delta : 0,
      damaged_quantity: field === "damaged_quantity" ? delta : 0,
      last_updated: new Date().toISOString(),
    });
  }

  const productField = field === "quantity" ? "stock_quantity" : "damaged_quantity";
  const { data: prod } = await supabaseAdmin.from("products").select(productField).eq("id", productId).maybeSingle();
  if (prod) {
    await supabaseAdmin
      .from("products")
      .update({ [productField]: Math.max(0, Number((prod as any)[productField] || 0) + delta) })
      .eq("id", productId);
  }
}

// After editing an approved return: reverse the old stock effect, apply the new one,
// and update the pickup order line so the loading sheet shows the right qty/price.
async function syncApprovedReturn(before: any, after: any) {
  const locationId = after.location_id || before.location_id;
  if (locationId && before.product_id) {
    await addStock(before.product_id, locationId, stockField(before.return_type), -Number(before.quantity || 0));
    await addStock(after.product_id, locationId, stockField(after.return_type), Number(after.quantity || 0));
  }

  const { data: order } = await supabaseAdmin
    .from("orders")
    .select("id")
    .ilike("notes", `%: ${after.return_number}]%`)
    .limit(1)
    .maybeSingle();
  if (order) {
    const price = parseFloat((after.reason || "").match(/\[PRICE:([\d.]+)\]/)?.[1] || "0") || 0;
    await supabaseAdmin
      .from("order_items")
      .update({ quantity: Number(after.quantity || 0), unit_price: price })
      .eq("order_id", order.id)
      .eq("product_id", after.product_id);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { return_type, reason_tag, status, reason, quantity, unit_price, location_id } = body;

    const existing = await findReturnRecord(id, "*");

    if (!existing) {
      return NextResponse.json({ error: "Return record not found" }, { status: 404 });
    }

    const updatePayload: Record<string, any> = {};

    if (quantity !== undefined && !isNaN(Number(quantity))) {
      updatePayload.quantity = Number(quantity);
    }

    if (location_id) {
      updatePayload.location_id = location_id;
    }

    if (return_type) {
      if (!["Good", "Damage", "Exchange"].includes(return_type)) {
        return NextResponse.json({ error: "Invalid return_type" }, { status: 400 });
      }
      updatePayload.return_type = return_type;
    }

    if (status) {
      updatePayload.status = status;
    }

    let updatedReason = reason !== undefined ? reason : existing.reason || "";

    if (unit_price !== undefined) {
      const priceTag = `[PRICE:${unit_price}]`;
      if (/\[PRICE:[\d.]+\]/.test(updatedReason)) {
        updatedReason = updatedReason.replace(/\[PRICE:[\d.]+\]/, priceTag);
      } else {
        updatedReason = `${priceTag} ${updatedReason}`.trim();
      }
      updatePayload.reason = updatedReason;
    } else if (reason !== undefined) {
      updatePayload.reason = reason;
    }

    if (reason_tag) {
      const currentReason = updatePayload.reason || existing.reason || "";
      if (!currentReason.includes(reason_tag)) {
        updatePayload.reason = `${currentReason} ${reason_tag}`.trim();
      }
    }

    // Keep system tags when the form replaces the reason text
    if (reason !== undefined && updatePayload.reason !== undefined) {
      const systemTags: string[] =
        (existing.reason || "").match(/\[(?:SETTLED_IN_PAYMENT|SETTLED_INVOICE|INVOICE_ADJUSTED|BATCH|REJECTED)[^\]]*\]/g) || [];
      const missing = systemTags.filter((t) => !updatePayload.reason.includes(t));
      if (missing.length) updatePayload.reason = `${updatePayload.reason} ${missing.join(" ")}`.trim();
    }

    if (Object.keys(updatePayload).length === 0) {
      return NextResponse.json(existing);
    }

    const changesValue =
      updatePayload.quantity !== undefined || updatePayload.return_type !== undefined || unit_price !== undefined;

    // A return already used to settle an invoice can't change its value any more
    if (changesValue && (existing.reason || "").includes("[SETTLED_IN_PAYMENT:")) {
      return NextResponse.json(
        { error: "This return was already deducted in a payment and can't be edited." },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("inventory_returns")
      .update(updatePayload)
      .eq("id", existing.id)
      .select()
      .single();

    if (error) throw error;

    // Approved returns already moved stock and created a pickup order — keep both in line
    if (existing.status === "Approved" && changesValue) {
      await syncApprovedReturn(existing, data);
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error("PATCH /api/inventory/returns/[id] error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // 1. Fetch return record to reverse stock changes
    const retRecord = await findReturnRecord(id, "*");

    if (!retRecord) {
      return NextResponse.json({ error: "Return record not found" }, { status: 404 });
    }

    const { product_id, location_id, quantity, return_type, business_id, return_number } = retRecord;
    const qty = Number(quantity || 0);

    if ((retRecord.reason || "").includes("[SETTLED_IN_PAYMENT:")) {
      return NextResponse.json(
        { error: "This return was already deducted in a payment and can't be deleted." },
        { status: 400 }
      );
    }

    // Approved items sit on a pickup order: take the line off it (only before the lorry leaves)
    if (retRecord.status === "Approved") {
      const pickup = await findPickupOrder(retRecord);
      if (pickup) {
        if (!PRE_DISPATCH_STATUSES.includes(pickup.status)) {
          return NextResponse.json(
            { error: `Pickup order ${pickup.order_id} is already ${pickup.status}. This item can't be removed now.` },
            { status: 400 }
          );
        }
        const { data: lines } = await supabaseAdmin
          .from("order_items")
          .select("id, quantity")
          .eq("order_id", pickup.id)
          .eq("product_id", product_id);
        const line = (lines || []).find((l: any) => Number(l.quantity) === qty) || (lines || [])[0];
        if (line) await supabaseAdmin.from("order_items").delete().eq("id", line.id);

        // Last item gone: remove the empty pickup order and its LKR 0 invoice
        const { count } = await supabaseAdmin
          .from("order_items")
          .select("id", { count: "exact", head: true })
          .eq("order_id", pickup.id);
        if (!count) {
          await supabaseAdmin.from("invoices").delete().eq("order_id", pickup.id);
          await supabaseAdmin.from("orders").delete().eq("id", pickup.id);
        }
      }
    }

    // 2. Reverse Stock Adjustments — only when approval/completion actually added the stock
    const stockWasAdded = retRecord.status === "Approved" || retRecord.status === "Completed";
    if (stockWasAdded && product_id && qty > 0) {
      const isDamage = return_type !== "Good";

      // Reverse in location stock
      if (location_id) {
        const { data: locStock } = await supabaseAdmin
          .from("product_stocks")
          .select("id, quantity, damaged_quantity")
          .eq("product_id", product_id)
          .eq("location_id", location_id)
          .maybeSingle();

        if (locStock) {
          if (isDamage) {
            await supabaseAdmin
              .from("product_stocks")
              .update({
                damaged_quantity: Math.max(0, Number(locStock.damaged_quantity || 0) - qty),
                last_updated: new Date().toISOString(),
              })
              .eq("id", locStock.id);
          } else {
            await supabaseAdmin
              .from("product_stocks")
              .update({
                quantity: Math.max(0, Number(locStock.quantity || 0) - qty),
                last_updated: new Date().toISOString(),
              })
              .eq("id", locStock.id);
          }
        }
      }

      // Reverse in main product table
      const { data: mainProduct } = await supabaseAdmin
        .from("products")
        .select("id, name, stock_quantity, damaged_quantity")
        .eq("id", product_id)
        .maybeSingle();

      if (mainProduct) {
        if (isDamage) {
          await supabaseAdmin
            .from("products")
            .update({
              damaged_quantity: Math.max(0, Number(mainProduct.damaged_quantity || 0) - qty),
            })
            .eq("id", product_id);
        } else {
          await supabaseAdmin
            .from("products")
            .update({
              stock_quantity: Math.max(0, Number(mainProduct.stock_quantity || 0) - qty),
            })
            .eq("id", product_id);
        }

        // Log Reversal Transaction
        await supabaseAdmin.from("account_transactions").insert({
          transaction_type: "INVENTORY_RETURN_REVERSAL",
          description: `Reversed Return ${return_number || ""}: Subtracted ${qty} units (${return_type}) of ${mainProduct.name}`,
          amount: 0,
          transaction_date: new Date().toISOString(),
          business_id: business_id || null,
          metadata: {
            reversed_return_id: retRecord.id,
            product_id,
            quantity: qty,
            type: return_type,
          },
        });
      }
    }

    // 3. Delete Return Record
    const { error: deleteErr } = await supabaseAdmin
      .from("inventory_returns")
      .delete()
      .eq("id", retRecord.id);

    if (deleteErr) throw deleteErr;

    return NextResponse.json({
      success: true,
      message: "Return deleted and stock reversed successfully",
    });
  } catch (error: any) {
    console.error("DELETE /api/inventory/returns/[id] error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
