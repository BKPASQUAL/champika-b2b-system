import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { BUSINESS_IDS } from "@/app/config/business-constants";

// POST: convert quotation to a retail invoice
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { paymentType, userId } = body;

    // 1. Load quotation
    const { data: q, error: qErr } = await supabaseAdmin
      .from("quotations")
      .select("*")
      .eq("id", id)
      .single();

    if (qErr || !q) return NextResponse.json({ error: "Quotation not found" }, { status: 404 });
    if (q.status === "Converted") {
      return NextResponse.json({ error: "Quotation already converted", invoiceId: q.converted_invoice_id }, { status: 409 });
    }

    const items: any[] = q.items || [];
    const businessId = q.business_id || BUSINESS_IDS.CHAMPIKA_RETAIL;
    const finalPaymentType = paymentType || q.payment_type || "Cash";

    // 2. Generate CHR-XXXX invoice number
    const prefix = "CHR";
    const { data: existingInvs } = await supabaseAdmin
      .from("invoices")
      .select("invoice_no")
      .ilike("invoice_no", `${prefix}-%`);
    const maxSeq = Math.max(
      0,
      ...(existingInvs ?? []).map((inv: any) => {
        const parts = (inv.invoice_no as string).split("-");
        const n = parseInt(parts[parts.length - 1], 10);
        return isNaN(n) ? 0 : n;
      })
    );
    const invoiceNo = `${prefix}-${String(maxSeq + 1).padStart(4, "0")}`;

    const invoiceDate = q.invoice_date || new Date().toISOString().split("T")[0];
    const dueDate = (() => {
      const d = new Date(invoiceDate);
      d.setDate(d.getDate() + 30);
      return d.toISOString().split("T")[0];
    })();

    // 3. Create Order
    const orderId = `ORD-${Date.now()}`;
    const { data: orderData, error: orderError } = await supabaseAdmin
      .from("orders")
      .insert({
        order_id: orderId,
        customer_id: q.customer_id,
        sales_rep_id: q.sales_rep_id || userId,
        order_date: invoiceDate,
        status: "Delivered",
        total_amount: q.grand_total,
        notes: q.notes || `Converted from quotation ${q.quotation_no}`,
        created_by: userId || q.sales_rep_id,
        business_id: businessId,
        extra_discount_percent: q.extra_discount_percent || 0,
        extra_discount_amount: q.extra_discount_amount || 0,
      })
      .select()
      .single();

    if (orderError) throw orderError;

    // 4. FIFO cost calculation (same logic as /api/invoices)
    const productIds = [...new Set(items.map((i: any) => i.productId))];

    const [productsRes, costLayersRes] = await Promise.all([
      supabaseAdmin
        .from("products")
        .select("id, commission_type, commission_value, cost_price, actual_cost_price, supplier_name, category, sub_category")
        .in("id", productIds),
      supabaseAdmin
        .from("product_cost_layers")
        .select("id, product_id, cost_price, remaining_quantity")
        .in("product_id", productIds)
        .gt("remaining_quantity", 0)
        .order("created_at", { ascending: true }),
    ]);

    const products = productsRes.data || [];
    const layerMap: Record<string, any[]> = {};
    (costLayersRes.data || []).forEach((layer: any) => {
      if (!layerMap[layer.product_id]) layerMap[layer.product_id] = [];
      layerMap[layer.product_id].push({
        id: layer.id,
        cost_price: Number(layer.cost_price),
        remaining_quantity: Number(layer.remaining_quantity),
      });
    });
    const layerFinalQty: Map<string, number> = new Map();

    const grossSubtotal = items.reduce((s: number, i: any) => s + (i.total || 0), 0);
    const globalDiscountAmount = q.extra_discount_amount || 0;

    const orderItems = items.map((item: any) => {
      const product = products.find((p: any) => p.id === item.productId);
      const totalQty = (item.quantity || 0) + (item.freeQuantity || 0);

      const discountShare = grossSubtotal > 0
        ? (item.total / grossSubtotal) * globalDiscountAmount
        : 0;
      const netLineTotal = item.total - discountShare;
      const actualUnitPrice = totalQty > 0 ? netLineTotal / totalQty : 0;

      const layers = layerMap[item.productId] || [];
      let fifoCost = Number(product?.actual_cost_price || product?.cost_price || 0);

      if (layers.length > 0) {
        let needed = totalQty;
        let totalCost = 0;
        for (const layer of layers) {
          if (needed <= 0) break;
          const consume = Math.min(needed, layer.remaining_quantity);
          totalCost += consume * layer.cost_price;
          layer.remaining_quantity -= consume;
          layerFinalQty.set(layer.id, layer.remaining_quantity);
          needed -= consume;
        }
        if (needed > 0 && layers.length > 0) {
          totalCost += needed * layers[layers.length - 1].cost_price;
        }
        fifoCost = totalQty > 0 ? totalCost / totalQty : fifoCost;
      }

      return {
        order_id: orderData.id,
        product_id: item.productId,
        quantity: item.quantity || 0,
        free_quantity: item.freeQuantity || 0,
        unit_price: item.unitPrice || 0,
        actual_unit_price: actualUnitPrice,
        actual_unit_cost: fifoCost,
        total_price: item.total || 0,
        commission_earned: 0,
        discount_percent: item.discountPercent || 0,
        discount_amount: item.discountAmount || 0,
      };
    });

    const { error: itemsError } = await supabaseAdmin.from("order_items").insert(orderItems);
    if (itemsError) throw itemsError;

    // Update FIFO layers
    if (layerFinalQty.size > 0) {
      await Promise.all(
        Array.from(layerFinalQty.entries()).map(([layerId, newQty]) =>
          supabaseAdmin
            .from("product_cost_layers")
            .update({ remaining_quantity: Math.max(0, newQty) })
            .eq("id", layerId)
        )
      );
    }

    // 5. Create Invoice
    const isFullyCash = finalPaymentType === "Cash";
    const paidAmount = isFullyCash ? q.grand_total : 0;
    const paymentStatus = isFullyCash ? "Paid" : "Unpaid";

    const { data: invoiceData, error: invoiceError } = await supabaseAdmin
      .from("invoices")
      .insert({
        invoice_no: invoiceNo,
        order_id: orderData.id,
        customer_id: q.customer_id,
        total_amount: q.grand_total,
        paid_amount: paidAmount,
        status: paymentStatus,
        due_date: dueDate,
        created_at: new Date(),
        is_incorrect: false,
      })
      .select()
      .single();

    if (invoiceError) throw invoiceError;

    // 6. Log invoice history
    await supabaseAdmin.from("invoice_history").insert({
      invoice_id: invoiceData.id,
      previous_data: { status: null, new_status: "Delivered" },
      changed_by: userId || q.sales_rep_id || null,
      change_reason: `Converted from Quotation ${q.quotation_no}`,
      changed_at: new Date().toISOString(),
    });

    // 7. Record payment if cash
    if (isFullyCash && paidAmount > 0) {
      await supabaseAdmin.from("payments").insert({
        invoice_id: invoiceData.id,
        customer_id: q.customer_id,
        amount: paidAmount,
        payment_date: invoiceDate,
        method: "Cash",
        collected_by: q.sales_rep_id || userId,
        cheque_status: "Cleared",
      });

      const { data: retailCash } = await supabaseAdmin
        .from("bank_accounts")
        .select("id, current_balance")
        .eq("account_name", "Retail Cash")
        .single();

      if (retailCash) {
        await supabaseAdmin.from("account_transactions").insert({
          transaction_no: `TXN-${Date.now()}`,
          transaction_type: "Sales",
          from_account_id: null,
          to_account_id: retailCash.id,
          amount: paidAmount,
          description: `Quotation Converted - ${invoiceNo}`,
          transaction_date: invoiceDate,
        });
        await supabaseAdmin
          .from("bank_accounts")
          .update({ current_balance: (retailCash.current_balance || 0) + paidAmount })
          .eq("id", retailCash.id);
      }
    }

    // 8. Update customer outstanding balance if credit
    if (!isFullyCash) {
      const { data: customer } = await supabaseAdmin
        .from("customers")
        .select("outstanding_balance")
        .eq("id", q.customer_id)
        .single();
      if (customer) {
        await supabaseAdmin
          .from("customers")
          .update({ outstanding_balance: (customer.outstanding_balance || 0) + q.grand_total })
          .eq("id", q.customer_id);
      }
    }

    // 9. Deduct stock — Retail: retail locations first, then Main Warehouse
    const { data: retailLocs } = await supabaseAdmin
      .from("locations")
      .select("id")
      .eq("business_id", BUSINESS_IDS.CHAMPIKA_RETAIL);
    const retailLocationIds = (retailLocs ?? []).map((l: any) => l.id);

    const { data: mainLoc } = await supabaseAdmin
      .from("locations")
      .select("id")
      .is("business_id", null)
      .eq("name", "Main Warehouse")
      .maybeSingle();
    const mainWarehouseId = mainLoc?.id || null;

    for (const item of items) {
      const totalQty = (item.quantity || 0) + (item.freeQuantity || 0);

      // Deduct global product stock
      const { data: prod } = await supabaseAdmin
        .from("products")
        .select("stock_quantity")
        .eq("id", item.productId)
        .single();
      if (prod) {
        await supabaseAdmin
          .from("products")
          .update({ stock_quantity: (prod.stock_quantity || 0) - totalQty })
          .eq("id", item.productId);
      }

      let remaining = totalQty;

      // Deduct retail location stocks
      if (retailLocationIds.length > 0) {
        const { data: retailStocks } = await supabaseAdmin
          .from("product_stocks")
          .select("id, quantity")
          .eq("product_id", item.productId)
          .in("location_id", retailLocationIds)
          .gt("quantity", 0)
          .order("quantity", { ascending: false });

        for (const s of retailStocks ?? []) {
          if (remaining <= 0) break;
          const deduct = Math.min(s.quantity, remaining);
          await supabaseAdmin
            .from("product_stocks")
            .update({ quantity: s.quantity - deduct, last_updated: new Date().toISOString() })
            .eq("id", s.id);
          remaining -= deduct;
        }
      }

      // Overflow to Main Warehouse
      if (remaining > 0 && mainWarehouseId) {
        const { data: mainStock } = await supabaseAdmin
          .from("product_stocks")
          .select("id, quantity")
          .eq("product_id", item.productId)
          .eq("location_id", mainWarehouseId)
          .maybeSingle();

        if (mainStock) {
          await supabaseAdmin
            .from("product_stocks")
            .update({ quantity: Number(mainStock.quantity) - remaining, last_updated: new Date().toISOString() })
            .eq("id", mainStock.id);
        } else {
          await supabaseAdmin
            .from("product_stocks")
            .insert({ product_id: item.productId, location_id: mainWarehouseId, quantity: -remaining });
        }
      }
    }

    // 10. Mark quotation as converted
    await supabaseAdmin
      .from("quotations")
      .update({
        status: "Converted",
        converted_invoice_id: invoiceData.id,
        converted_at: new Date().toISOString(),
      })
      .eq("id", id);

    return NextResponse.json({ invoiceId: invoiceData.id, invoiceNo }, { status: 201 });
  } catch (error: any) {
    console.error("Quotation convert error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
