import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { BUSINESS_IDS } from "@/app/config/business-constants";

export async function POST(request: NextRequest) {
  try {
    const { customerId, customerName } = await request.json();

    let targetBusinessId: string | null = null;
    let invoicePrefix = "WM";

    if (customerName.includes("Retail")) {
      targetBusinessId = BUSINESS_IDS.CHAMPIKA_RETAIL;
      invoicePrefix = "RE";
    } else if (customerName.includes("Distribution")) {
      targetBusinessId = BUSINESS_IDS.CHAMPIKA_DISTRIBUTION;
      invoicePrefix = "DI";
    }

    if (!targetBusinessId) {
      return NextResponse.json({ error: "Invalid customer" }, { status: 400 });
    }

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const year = now.getFullYear();
    const monthStr = String(now.getMonth() + 1).padStart(2, "0");
    const fixedInvoiceNo = `${invoicePrefix}-${year}-${monthStr}`;

    // 1. Fetch Sales (Added product_id and name for aggregation)
    const { data: sales, error } = await supabaseAdmin
      .from("order_items")
      .select(
        `
        quantity,
        total_price,
        product_id,
        orders!inner (
          order_date,
          business_id,
          status
        ),
        products!inner (
          id,
          name,
          supplier_name,
          cost_price
        )
      `,
      )
      .eq("orders.business_id", targetBusinessId)
      .neq("orders.status", "Cancelled")
      .ilike("products.supplier_name", "%Wireman%")
      .gte("orders.order_date", startOfMonth.toISOString())
      .lte("orders.order_date", endOfMonth.toISOString());

    if (error) throw error;

    if (!sales || sales.length === 0) {
      return NextResponse.json({ message: "No sales found" }, { status: 200 });
    }

    // 2. AGGREGATE SALES BY PRODUCT
    // We group multiple sales of the same item into one line item for the bill
    const productMap = new Map<
      string,
      {
        productId: string;
        quantity: number;
        unitPrice: number; // This acts as the billing price (Cost Price)
        totalPrice: number;
      }
    >();

    sales.forEach((sale: any) => {
      const pId = sale.product_id;
      const cost = sale.products?.cost_price || 0;
      const qty = Number(sale.quantity) || 0;
      const lineTotal = qty * cost;

      if (productMap.has(pId)) {
        const existing = productMap.get(pId)!;
        existing.quantity += qty;
        existing.totalPrice += lineTotal;
      } else {
        productMap.set(pId, {
          productId: pId,
          quantity: qty,
          unitPrice: cost,
          totalPrice: lineTotal,
        });
      }
    });

    // Calculate Grand Total
    let totalBillAmount = 0;
    const orderItemsToInsert: any[] = [];

    productMap.forEach((item) => {
      totalBillAmount += item.totalPrice;
      orderItemsToInsert.push({
        // order_id will be added later
        product_id: item.productId,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        total_price: item.totalPrice,
        free_quantity: 0,
        commission_earned: 0,
      });
    });

    if (totalBillAmount === 0) {
      return NextResponse.json({ message: "Bill is 0" }, { status: 200 });
    }

    // 3. CHECK FOR EXISTING INVOICE
    const { data: existingInvoice } = await supabaseAdmin
      .from("invoices")
      .select("id, total_amount, order_id")
      .eq("invoice_no", fixedInvoiceNo)
      .maybeSingle();

    if (existingInvoice) {
      // --- UPDATE EXISTING ---
      const previousAmount = existingInvoice.total_amount || 0;
      const difference = totalBillAmount - previousAmount;

      if (difference !== 0 || orderItemsToInsert.length > 0) {
        // A. Update Invoice Total
        await supabaseAdmin
          .from("invoices")
          .update({ total_amount: totalBillAmount })
          .eq("id", existingInvoice.id);

        if (existingInvoice.order_id) {
          // B. Update Order Total
          await supabaseAdmin
            .from("orders")
            .update({
              total_amount: totalBillAmount,
              updated_at: new Date(),
            })
            .eq("id", existingInvoice.order_id);

          // C. REPLACE ORDER ITEMS (Delete old, Insert new aggregated)
          // This ensures the item list matches the current month's sales exactly
          await supabaseAdmin
            .from("order_items")
            .delete()
            .eq("order_id", existingInvoice.order_id);

          const itemsWithOrderId = orderItemsToInsert.map((item) => ({
            ...item,
            order_id: existingInvoice.order_id,
          }));

          if (itemsWithOrderId.length > 0) {
            await supabaseAdmin.from("order_items").insert(itemsWithOrderId);
          }
        }

        // D. Update Customer Balance
        const { data: customer } = await supabaseAdmin
          .from("customers")
          .select("outstanding_balance")
          .eq("id", customerId)
          .single();

        if (customer) {
          await supabaseAdmin
            .from("customers")
            .update({
              outstanding_balance:
                (customer.outstanding_balance || 0) + difference,
            })
            .eq("id", customerId);
        }
      }

      return NextResponse.json({
        message: "Bill Updated",
        invoiceNo: fixedInvoiceNo,
        amount: totalBillAmount,
        status: "Updated",
      });
    } else {
      // --- CREATE NEW ---
      const notePattern = `Auto-generated monthly bill for ${customerName} - ${now.toLocaleString("default", { month: "long" })}`;

      // Create Order
      const { data: orderData, error: orderError } = await supabaseAdmin
        .from("orders")
        .insert({
          order_id: `ORD-AUTO-${Date.now()}`,
          customer_id: customerId,
          business_id: BUSINESS_IDS.WIREMAN_AGENCY,
          total_amount: totalBillAmount,
          status: "Completed",
          notes: notePattern,
          order_date: now.toISOString(),
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // Create Invoice
      const { error: invoiceError } = await supabaseAdmin
        .from("invoices")
        .insert({
          invoice_no: fixedInvoiceNo,
          order_id: orderData.id,
          customer_id: customerId,
          total_amount: totalBillAmount,
          status: "Unpaid",
          due_date: endOfMonth.toISOString(),
        });

      if (invoiceError) throw invoiceError;

      // ✅ INSERT ITEMS
      const itemsWithOrderId = orderItemsToInsert.map((item) => ({
        ...item,
        order_id: orderData.id,
      }));

      if (itemsWithOrderId.length > 0) {
        await supabaseAdmin.from("order_items").insert(itemsWithOrderId);
      }

      // Update Customer Balance
      const { data: customer } = await supabaseAdmin
        .from("customers")
        .select("outstanding_balance")
        .eq("id", customerId)
        .single();

      if (customer) {
        await supabaseAdmin
          .from("customers")
          .update({
            outstanding_balance:
              (customer.outstanding_balance || 0) + totalBillAmount,
          })
          .eq("id", customerId);
      }

      return NextResponse.json({
        message: "Bill Created",
        invoiceNo: fixedInvoiceNo,
        amount: totalBillAmount,
        status: "Created",
      });
    }
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
