import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { BUSINESS_IDS } from "@/app/config/business-constants";
import { getReturnNoteCode } from "@/app/lib/return-note-group";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { action, rejection_reason, location_id } = body;

    if (!action || !["approve", "reject"].includes(action)) {
      return NextResponse.json(
        { error: "Invalid action. Must be 'approve' or 'reject'." },
        { status: 400 }
      );
    }

    // Fetch existing return note by UUID or return_number
    const cleanId = decodeURIComponent(id || "").trim();
    const selectQuery = "*, products(id, name, sku, selling_price, stock_quantity, damaged_quantity), customers(id, shop_name, outstanding_balance)";
    let ret = null;

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanId);
    if (isUuid) {
      const { data, error } = await supabaseAdmin
        .from("inventory_returns")
        .select(selectQuery)
        .eq("id", cleanId)
        .maybeSingle();
      if (!error && data) ret = data;
    }

    if (!ret) {
      const { data, error } = await supabaseAdmin
        .from("inventory_returns")
        .select(selectQuery)
        .ilike("return_number", cleanId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!error && data) ret = data;
    }

    if (!ret) {
      const { data, error } = await supabaseAdmin
        .from("inventory_returns")
        .select(selectQuery)
        .eq("return_batch_id", cleanId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!error && data) ret = data;
    }

    if (!ret) {
      return NextResponse.json(
        { error: "Return record not found" },
        { status: 404 }
      );
    }

    if (ret.status === "Approved" || ret.status === "Completed") {
      return NextResponse.json(
        { error: "Return record is already approved" },
        { status: 400 }
      );
    }

    const nowIso = new Date().toISOString();

    // ── 1. REJECT ACTION ────────────────────────────────────────────────────────
    if (action === "reject") {
      const rejectTag = `[REJECTED: ${rejection_reason || "Office rejected"}]`;
      const updatedReason = `${ret.reason || ""} ${rejectTag}`.trim();

      const { data: rejectedRecord, error: rejectErr } = await supabaseAdmin
        .from("inventory_returns")
        .update({
          status: "Rejected",
          reason: updatedReason,
        })
        .eq("id", ret.id)
        .select()
        .single();

      if (rejectErr) throw rejectErr;

      return NextResponse.json({
        success: true,
        status: "Rejected",
        data: rejectedRecord,
      });
    }

    // ── 2. APPROVE ACTION ───────────────────────────────────────────────────────
    const targetLocationId =
      location_id ||
      ret.location_id ||
      "0b68fd7b-6a40-496f-9279-0a003c26b211"; // Fallback to Main Warehouse
    const qty = Number(ret.quantity || 0);

    // Parse unit price
    let unitPrice = 0;
    if (ret.reason) {
      const priceMatch = ret.reason.match(/\[PRICE:([\d.]+)\]/);
      if (priceMatch) unitPrice = parseFloat(priceMatch[1]) || 0;
    }
    if (!unitPrice && ret.products?.selling_price) {
      unitPrice = Number(ret.products.selling_price);
    }
    const totalLineValue = Math.round(qty * unitPrice * 100) / 100;

    // A. Update Warehouse Stock
    const { data: existingStock } = await supabaseAdmin
      .from("product_stocks")
      .select("id, quantity, damaged_quantity")
      .eq("product_id", ret.product_id)
      .eq("location_id", targetLocationId)
      .maybeSingle();

    if (ret.return_type === "Good") {
      // Good return: increases good stock
      if (existingStock) {
        await supabaseAdmin
          .from("product_stocks")
          .update({
            quantity: Number(existingStock.quantity || 0) + qty,
            last_updated: nowIso,
          })
          .eq("id", existingStock.id);
      } else {
        await supabaseAdmin.from("product_stocks").insert({
          product_id: ret.product_id,
          location_id: targetLocationId,
          quantity: qty,
          damaged_quantity: 0,
          last_updated: nowIso,
        });
      }

      if (ret.products) {
        await supabaseAdmin
          .from("products")
          .update({
            stock_quantity: Number(ret.products.stock_quantity || 0) + qty,
          })
          .eq("id", ret.product_id);
      }
    } else {
      // Damage return or Exchange return: damaged item goes into damaged stock
      if (existingStock) {
        await supabaseAdmin
          .from("product_stocks")
          .update({
            damaged_quantity: Number(existingStock.damaged_quantity || 0) + qty,
            last_updated: nowIso,
          })
          .eq("id", existingStock.id);
      } else {
        await supabaseAdmin.from("product_stocks").insert({
          product_id: ret.product_id,
          location_id: targetLocationId,
          quantity: 0,
          damaged_quantity: qty,
          last_updated: nowIso,
        });
      }

      if (ret.products) {
        await supabaseAdmin
          .from("products")
          .update({
            damaged_quantity: Number(ret.products.damaged_quantity || 0) + qty,
          })
          .eq("id", ret.product_id);
      }
    }

    // B. Route approved return notes DIRECTLY to "Loading"
    // Bypasses Approved, Processing, and Checking because lorry driver needs to collect items from customer
    let loadingOrder: any = null;
    // Exchange = item-for-item swap: the replacement good items must be picked and
    // checked like a normal order, so it starts at "Approved". Good/Damage returns are
    // pickups only and go straight to "Loading". Either way the bill is LKR 0 (no payment).
    const targetOrderStatus = ret.return_type === "Exchange" ? "Approved" : "Loading";
    const isExchange = ret.return_type === "Exchange";
    const noteCode = getReturnNoteCode(ret.reason);
    // A multi-item return note gets ONE pickup order + invoice (RET-<code>), not one per item
    const refNo = noteCode
      ? `RET-${noteCode}`
      : ret.return_number || `RET-${Date.now().toString().slice(-6)}`;

    // Another item of the same note already approved? Add this item to that order.
    let noteOrder: any = null;
    if (noteCode && ret.customer_id) {
      const { data: candidates } = await supabaseAdmin
        .from("orders")
        .select("id, status, notes")
        .eq("customer_id", ret.customer_id)
        .in("status", ["Approved", "Loading"])
        .ilike("notes", `%[NOTE:${noteCode}]%`);
      noteOrder =
        (candidates || []).find(
          (o: any) => /\[DAMAGE_EXCHANGE:/.test(o.notes || "") === isExchange
        ) || null;
    }

    if (noteOrder) {
      const itemTag = `[RETURN_ITEM: ${ret.return_number}]`;
      // Items that share the note's number are already covered by the order's tag
      let notes: string = (noteOrder.notes || "").includes(`: ${ret.return_number}]`)
        ? noteOrder.notes || ""
        : `${noteOrder.notes || ""} ${itemTag}`.trim();
      // Keep this item's original bill number so the printed note lists every bill
      const invNo = ret.reason?.match(/\[INV:([^\]]+)\]/)?.[1]?.trim();
      if (invNo && invNo !== "-" && !notes.includes(`[INV:${invNo}]`)) notes = `${notes} [INV:${invNo}]`;
      const { data: updatedOrd } = await supabaseAdmin
        .from("orders")
        .update({ notes })
        .eq("id", noteOrder.id)
        .select()
        .single();
      loadingOrder = updatedOrd || noteOrder;

      await supabaseAdmin.from("order_items").insert({
        order_id: noteOrder.id,
        product_id: ret.product_id,
        quantity: qty,
        free_quantity: 0,
        unit_price: unitPrice,
        total_price: 0,
        commission_earned: 0,
      });
    }

    // Check if an order already exists for this (single-item) return note
    const { data: existingReturnOrder } = noteOrder
      ? { data: null }
      : await supabaseAdmin
          .from("orders")
          .select("id, status")
          .or(`order_id.eq.${refNo},invoice_no.eq.${refNo},notes.ilike.%${ret.return_number || refNo}]%`)
          .limit(1)
          .maybeSingle();

    if (noteOrder) {
      // already handled above
    } else if (existingReturnOrder) {
      // Ensure its status is Loading so it is ready for delivery lorry selection
      const { data: updatedOrd } = await supabaseAdmin
        .from("orders")
        .update({ status: targetOrderStatus })
        .eq("id", existingReturnOrder.id)
        .select()
        .single();
      loadingOrder = updatedOrd;
    } else {
      let finalOrderId = refNo;
      const { data: idCheck } = await supabaseAdmin
        .from("orders")
        .select("id")
        .eq("order_id", finalOrderId)
        .maybeSingle();
      if (idCheck) {
        finalOrderId = `${refNo}-${Date.now().toString().slice(-4)}`;
      }

      let orderNotes = "";
      if (noteCode) {
        // Tag with the item number (used to look the note up) plus [NOTE:code] to group later items
        const label = isExchange ? "Exchange" : ret.return_type === "Good" ? "Good" : "Damage";
        const tag = isExchange ? "DAMAGE_EXCHANGE" : "RETURN_NOTE";
        const reasonText = (ret.reason || "").replace(/\[(?:NOTE|PRICE):[^\]]*\]/g, "").trim();
        const title = isExchange
          ? `Replacement item / Exchange for Return Note ${refNo}.`
          : `${label} Return Note ${refNo}.`;
        orderNotes = `[${tag}: ${ret.return_number}] [NOTE:${noteCode}] ${title} Reason: ${reasonText || `${label} Return`}. Collect items from customer.`;
      } else if (ret.return_type === "Exchange") {
        orderNotes = `[DAMAGE_EXCHANGE: ${ret.return_number}] Replacement item / Exchange for Return Note ${ret.return_number}. Reason: ${ret.reason || "Damage Exchange"}. Collect items from customer.`;
      } else if (ret.return_type === "Good") {
        orderNotes = `[RETURN_NOTE: ${ret.return_number}] Good Return Note ${ret.return_number} (${qty} x ${ret.products?.name || "Product"}). Reason: ${ret.reason || "Good Return"}. Collect items from customer.`;
      } else {
        orderNotes = `[RETURN_NOTE: ${ret.return_number}] Damage Return Note ${ret.return_number} (${qty} x ${ret.products?.name || "Product"}). Reason: ${ret.reason || "Damage Return"}. Collect items from customer.`;
      }

      const { data: newOrder, error: orderErr } = await supabaseAdmin
        .from("orders")
        .insert({
          order_id: finalOrderId,
          invoice_no: finalOrderId,
          customer_id: ret.customer_id,
          sales_rep_id: ret.returned_by || null,
          order_date: nowIso,
          status: targetOrderStatus,
          total_amount: 0,
          notes: orderNotes,
          business_id: ret.business_id || BUSINESS_IDS.CHAMPIKA_DISTRIBUTION,
        })
        .select()
        .single();

      if (orderErr) {
        console.error("Failed to create loading return order:", orderErr);
      } else {
        loadingOrder = newOrder;
        // Insert order_item
        await supabaseAdmin.from("order_items").insert({
          order_id: newOrder.id,
          product_id: ret.product_id,
          quantity: qty,
          free_quantity: 0,
          unit_price: unitPrice,
          total_price: 0,
          commission_earned: 0,
        });

        // Insert invoice so loading boards, lorry sheets and PDFs reference it properly.
        // Exchange is item-for-item (no bill, no payment), so it gets no invoice.
        if (ret.return_type !== "Exchange") {
          let invoiceRef = finalOrderId;
          const { data: invCheck } = await supabaseAdmin
            .from("invoices")
            .select("id")
            .eq("invoice_no", invoiceRef)
            .maybeSingle();
          if (invCheck) {
            invoiceRef = `${invoiceRef}-${Date.now().toString().slice(-4)}`;
          }

          await supabaseAdmin.from("invoices").insert({
            invoice_no: invoiceRef,
            order_id: newOrder.id,
            customer_id: ret.customer_id,
            total_amount: 0,
            paid_amount: 0,
            due_amount: 0,
            status: "Paid",
          });
        }
      }
    }

    // C. Record Account Transaction
    await supabaseAdmin.from("account_transactions").insert({
      transaction_type:
        ret.return_type === "Exchange"
          ? "DAMAGE_EXCHANGE_APPROVED"
          : "INVENTORY_RETURN_APPROVED",
      description: `Approved Return Note ${ret.return_number} (${ret.return_type}): ${qty} x ${ret.products?.name || "Product"} (LKR ${totalLineValue.toLocaleString()})`,
      amount: totalLineValue,
      transaction_date: nowIso,
      business_id: ret.business_id || BUSINESS_IDS.CHAMPIKA_DISTRIBUTION,
      metadata: {
        return_id: ret.id,
        return_number: ret.return_number,
        product_id: ret.product_id,
        quantity: qty,
        unit_price: unitPrice,
        return_type: ret.return_type,
        customer_id: ret.customer_id,
        loading_order_id: loadingOrder?.id || null,
        exchange_order_id: loadingOrder?.id || null,
      },
    });

    // D. Mark Return Note as Approved
    const { data: updatedReturn, error: updateErr } = await supabaseAdmin
      .from("inventory_returns")
      .update({
        status: "Approved",
        location_id: targetLocationId,
      })
      .eq("id", ret.id)
      .select()
      .single();

    if (updateErr) throw updateErr;

    return NextResponse.json({
      success: true,
      status: "Approved",
      data: updatedReturn,
      loadingOrder,
      exchangeOrder: loadingOrder,
    });
  } catch (error: any) {
    console.error("Approve Return Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
