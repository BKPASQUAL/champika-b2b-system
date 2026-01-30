import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { BUSINESS_IDS } from "@/app/config/business-constants";

export async function POST(request: NextRequest) {
  try {
    const { customerId, customerName } = await request.json();

    let targetBusinessId: string | null = null;
    let invoicePrefix = "OA"; // Default Orange Agency

    if (customerName.includes("Retail")) {
      targetBusinessId = BUSINESS_IDS.CHAMPIKA_RETAIL;
      invoicePrefix = "OR-RE"; // Orange -> Retail
    } else if (customerName.includes("Distribution")) {
      targetBusinessId = BUSINESS_IDS.CHAMPIKA_DISTRIBUTION;
      invoicePrefix = "OR-DI"; // Orange -> Distribution
    }

    if (!targetBusinessId) {
      return NextResponse.json({ error: "Invalid customer" }, { status: 400 });
    }

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const year = now.getFullYear();
    const monthStr = String(now.getMonth() + 1).padStart(2, "0");
    // Example: OR-RE-2026-01
    const fixedInvoiceNo = `${invoicePrefix}-${year}-${monthStr}`;

    // 1. Fetch Sales (Filter for 'Orange' products)
    // Assumes product supplier name contains "Orange"
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
      .ilike("products.supplier_name", "%Orange%") // ✅ Filter for Orange Agency items
      .gte("orders.order_date", startOfMonth.toISOString())
      .lte("orders.order_date", endOfMonth.toISOString());

    if (error) throw error;

    if (!sales || sales.length === 0) {
      return NextResponse.json(
        { message: "No Orange product sales found" },
        { status: 200 },
      );
    }

    // 2. AGGREGATE SALES
    const productMap = new Map<
      string,
      {
        productId: string;
        quantity: number;
        unitPrice: number;
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

    let totalBillAmount = 0;
    const orderItemsToInsert: any[] = [];

    productMap.forEach((item) => {
      totalBillAmount += item.totalPrice;
      orderItemsToInsert.push({
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

    // 3. CHECK/UPDATE/CREATE INVOICE
    const { data: existingInvoice } = await supabaseAdmin
      .from("invoices")
      .select("id, total_amount, order_id")
      .eq("invoice_no", fixedInvoiceNo)
      .maybeSingle();

    if (existingInvoice) {
      // --- UPDATE ---
      const previousAmount = existingInvoice.total_amount || 0;
      const difference = totalBillAmount - previousAmount;

      if (difference !== 0 || orderItemsToInsert.length > 0) {
        await supabaseAdmin
          .from("invoices")
          .update({ total_amount: totalBillAmount })
          .eq("id", existingInvoice.id);

        if (existingInvoice.order_id) {
          await supabaseAdmin
            .from("orders")
            .update({
              total_amount: totalBillAmount,
              updated_at: new Date(),
            })
            .eq("id", existingInvoice.order_id);

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
      // --- CREATE ---
      const notePattern = `Auto-generated monthly bill for ${customerName} (Orange Items) - ${now.toLocaleString("default", { month: "long" })}`;

      const { data: orderData, error: orderError } = await supabaseAdmin
        .from("orders")
        .insert({
          order_id: `ORD-OA-${Date.now()}`,
          customer_id: customerId,
          business_id: BUSINESS_IDS.ORANGE_AGENCY, // ✅ Orange Agency ID
          total_amount: totalBillAmount,
          status: "Completed",
          notes: notePattern,
          order_date: now.toISOString(),
        })
        .select()
        .single();

      if (orderError) throw orderError;

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

      const itemsWithOrderId = orderItemsToInsert.map((item) => ({
        ...item,
        order_id: orderData.id,
      }));

      if (itemsWithOrderId.length > 0) {
        await supabaseAdmin.from("order_items").insert(itemsWithOrderId);
      }

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
