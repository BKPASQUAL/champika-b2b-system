import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { BUSINESS_IDS } from "@/app/config/business-constants";

// POST /api/storefront/manage/orders/[id]/convert
// 1-Click converts an online storefront order into an official CHO-XXXX invoice and deducts inventory
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const { userId } = body;

    // 1. Fetch the online order
    const { data: order, error: orderErr } = await supabaseAdmin
      .from("storefront_orders")
      .select("*")
      .eq("id", id)
      .single();

    if (orderErr || !order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    if (order.invoice_id) {
      return NextResponse.json({
        error: "Order already invoiced",
        invoiceId: order.invoice_id,
      }, { status: 409 });
    }

    const items: any[] = order.items || [];
    if (items.length === 0) {
      return NextResponse.json({ error: "Order has no items" }, { status: 400 });
    }

    // 2. Generate next CHO-XXXX invoice number safely
    const prefix = "CHO";
    const [createdRes, noRes] = await Promise.all([
      supabaseAdmin
        .from("invoices")
        .select("invoice_no")
        .ilike("invoice_no", `${prefix}-%`)
        .order("created_at", { ascending: false })
        .limit(500),
      supabaseAdmin
        .from("invoices")
        .select("invoice_no")
        .ilike("invoice_no", `${prefix}-%`)
        .order("invoice_no", { ascending: false })
        .limit(500),
    ]);

    const combined = [...(createdRes.data ?? []), ...(noRes.data ?? [])];
    const maxSeq = Math.max(
      0,
      ...combined.map((inv: any) => {
        const parts = ((inv.invoice_no as string) || "").split("-");
        const n = parseInt(parts[parts.length - 1], 10);
        return isNaN(n) ? 0 : n;
      })
    );
    const invoiceNo = `${prefix}-${String(maxSeq + 1).padStart(4, "0")}`;

    const todayStr = new Date().toISOString().split("T")[0];

    // 3. Create or link customer record
    // Look up customer by phone, or create customer for BK Wiring Kade Online
    let customerId = null;
    const { data: existingCust } = await supabaseAdmin
      .from("customers")
      .select("id")
      .eq("phone", order.customer_phone)
      .maybeSingle();

    if (existingCust) {
      customerId = existingCust.id;
    } else {
      const { data: newCust, error: custErr } = await supabaseAdmin
        .from("customers")
        .insert({
          shop_name: order.customer_name || "Online Customer",
          owner_name: order.customer_name,
          phone: order.customer_phone,
          address: order.delivery_address,
          business_id: BUSINESS_IDS.CHAMPIKA_ONLINE,
        })
        .select("id")
        .single();

      if (!custErr && newCust) {
        customerId = newCust.id;
      }
    }

    // 4. Create Order in core orders table
    const coreOrderId = `ORD-${Date.now()}`;
    const { data: coreOrder, error: coreOrderErr } = await supabaseAdmin
      .from("orders")
      .insert({
        order_id: coreOrderId,
        customer_id: customerId,
        order_date: todayStr,
        status: "Delivered",
        total_amount: order.grand_total,
        notes: `BK Wiring Kade Online Order ${order.order_no}. Delivery: ${order.delivery_address}`,
        created_by: userId || null,
        business_id: BUSINESS_IDS.CHAMPIKA_ONLINE,
      })
      .select()
      .single();

    if (coreOrderErr) throw coreOrderErr;

    // 5. Insert order items & deduct warehouse stock
    for (const item of items) {
      const productId = item.productId || item.id;
      const qty = Number(item.quantity || 1);
      const unitPrice = Number(item.price || item.onlinePrice || 0);

      if (productId) {
        // Insert into order_items
        await supabaseAdmin.from("order_items").insert({
          order_id: coreOrder.id,
          product_id: productId,
          quantity: qty,
          unit_price: unitPrice,
          total_price: qty * unitPrice,
          discount_percent: 0,
        });

        // Deduct from product_stocks
        const { data: stocks } = await supabaseAdmin
          .from("product_stocks")
          .select("id, quantity")
          .eq("product_id", productId)
          .gt("quantity", 0)
          .order("created_at", { ascending: true });

        if (stocks && stocks.length > 0) {
          let remainingToDeduct = qty;
          for (const s of stocks) {
            if (remainingToDeduct <= 0) break;
            const currentQty = Number(s.quantity);
            const deduct = Math.min(currentQty, remainingToDeduct);
            await supabaseAdmin
              .from("product_stocks")
              .update({ quantity: currentQty - deduct })
              .eq("id", s.id);
            remainingToDeduct -= deduct;
          }
        }
      }
    }

    // 6. Create Invoice in core invoices table
    const { data: newInvoice, error: invErr } = await supabaseAdmin
      .from("invoices")
      .insert({
        invoice_no: invoiceNo,
        order_id: coreOrder.id,
        customer_id: customerId,
        total_amount: order.grand_total,
        paid_amount: order.payment_status === "Paid" ? order.grand_total : 0,
        balance_amount: order.payment_status === "Paid" ? 0 : order.grand_total,
        status: order.payment_status === "Paid" ? "Paid" : "Pending",
        business_id: BUSINESS_IDS.CHAMPIKA_ONLINE,
      })
      .select()
      .single();

    if (invErr) throw invErr;

    // 7. Update storefront_orders with invoice link & progress status to Processing
    const history = Array.isArray(order.status_history) ? [...order.status_history] : [];
    history.push({
      status: "Processing",
      timestamp: new Date().toISOString(),
      note: `Invoiced as ${invoiceNo} (BK WIRING KADE)`,
    });

    await supabaseAdmin
      .from("storefront_orders")
      .update({
        invoice_id: newInvoice.id,
        order_status: "Processing",
        status_history: history,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    return NextResponse.json({
      success: true,
      invoiceId: newInvoice.id,
      invoiceNo: invoiceNo,
      orderStatus: "Processing",
    });
  } catch (error: any) {
    console.error("Convert order to invoice error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
