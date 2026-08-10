// app/api/customers/[id]/purchased-products/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const invoiceNo = searchParams.get("invoiceNo");

    // 1. Fetch Orders directly for this customer (only Delivered or Completed)
    const { data: ordersData } = await supabaseAdmin
      .from("orders")
      .select("id")
      .eq("customer_id", id);
    const orderIdsFromOrders = (ordersData || []).map((o: any) => o.id).filter(Boolean);

    // 2. Fetch Invoices directly for this customer
    const { data: invoicesData } = await supabaseAdmin
      .from("invoices")
      .select("id, invoice_no, order_id, created_at, status")
      .eq("customer_id", id)
      .neq("status", "Cancelled");
    const orderIdsFromInvoices = (invoicesData || []).map((inv: any) => inv.order_id).filter(Boolean);

    // 3. Fetch Payments directly for this customer to find invoice IDs
    const { data: paymentsData } = await supabaseAdmin
      .from("payments")
      .select("invoice_id")
      .eq("customer_id", id);
    const paymentInvoiceIds = (paymentsData || []).map((p: any) => p.invoice_id).filter(Boolean);

    let orderIdsFromPayments: string[] = [];
    if (paymentInvoiceIds.length > 0) {
      const { data: payInvoices } = await supabaseAdmin
        .from("invoices")
        .select("order_id")
        .in("id", paymentInvoiceIds)
        .neq("status", "Cancelled");
      orderIdsFromPayments = (payInvoices || []).map((inv: any) => inv.order_id).filter(Boolean);
    }

    // Combine all order IDs
    const allOrderIds = Array.from(
      new Set([...orderIdsFromOrders, ...orderIdsFromInvoices, ...orderIdsFromPayments])
    );

    if (allOrderIds.length === 0) {
      return NextResponse.json([]);
    }

    // 4. Fetch all linked invoices for mapping invoice numbers
    const { data: allLinkedInvoices = [] } = await supabaseAdmin
      .from("invoices")
      .select("id, invoice_no, order_id, created_at, status")
      .in("order_id", allOrderIds);

    const orderInvoiceMap: Record<string, { id: string; invoiceNo: string; createdAt: string; status: string }> = {};
    (allLinkedInvoices || []).forEach((inv: any) => {
      if (inv.order_id) {
        orderInvoiceMap[inv.order_id] = {
          id: inv.id,
          invoiceNo: inv.invoice_no,
          createdAt: inv.created_at,
          status: inv.status,
        };
      }
    });

    // 5. Filter by specific invoice number if provided
    let targetOrderIds = allOrderIds;
    if (invoiceNo && invoiceNo !== "all") {
      const matched = (allLinkedInvoices || []).find((inv: any) => inv.invoice_no === invoiceNo);
      if (matched && matched.order_id) {
        targetOrderIds = [matched.order_id];
      }
    }

    // 6. Fetch Order Items
    const { data: rawItems = [], error: itemsError } = await supabaseAdmin
      .from("order_items")
      .select(`
        id,
        order_id,
        quantity,
        free_quantity,
        unit_price,
        total_price,
        product_id,
        created_at,
        products (
          id,
          sku,
          name,
          unit_of_measure,
          stock_quantity,
          selling_price
        ),
        orders (
          id,
          order_id,
          order_date,
          status
        )
      `)
      .in("order_id", targetOrderIds)
      .order("created_at", { ascending: false });

    if (itemsError) {
      console.error("Error fetching order items:", itemsError);
      throw itemsError;
    }

    // 7. Aggregate Products & Build Detailed Purchase History (Filtering for Delivered/Completed invoices only)
    const productsMap = new Map();

    (rawItems || []).forEach((item: any) => {
      if (!item.products) return;

      const orderData = Array.isArray(item.orders) ? item.orders[0] : item.orders;
      const invInfo = orderInvoiceMap[item.order_id];

      // Order/Invoice status validation: ONLY Delivered or Completed orders (or non-cancelled valid invoices)
      const rawStatus = orderData?.status || invInfo?.status || "Completed";
      const statusLower = String(rawStatus).toLowerCase();

      // Exclude non-delivered/non-completed orders (e.g. Cancelled, Pending, Processing, Loading, In Transit)
      if (
        statusLower === "cancelled" ||
        statusLower === "pending" ||
        statusLower === "processing" ||
        statusLower === "loading" ||
        statusLower === "in transit"
      ) {
        return;
      }

      const pId = item.products.id;
      const billedQty = Number(item.quantity) || 0;
      const freeQty = Number(item.free_quantity) || 0;
      const totalItemQty = billedQty + freeQty;
      const itemPrice = Number(item.unit_price) || item.products.selling_price || 0;
      const itemTotalVal = Number(item.total_price) || billedQty * itemPrice;

      const historyEntry = {
        orderItemId: item.id,
        orderId: item.order_id,
        invoiceId: invInfo?.id || null,
        invoiceNo: invInfo?.invoiceNo || orderData?.order_id || "N/A",
        date: invInfo?.createdAt || orderData?.order_date || item.created_at,
        quantity: billedQty,
        freeQuantity: freeQty,
        totalQuantity: totalItemQty,
        unitPrice: itemPrice,
        totalPrice: itemTotalVal,
        orderStatus: rawStatus,
      };

      const productUnit = item.products.unit_of_measure || "Pcs";

      if (productsMap.has(pId)) {
        const existing = productsMap.get(pId);
        existing.totalPurchasedQty += totalItemQty;
        existing.totalSpent += itemTotalVal;
        existing.purchaseCount += 1;
        existing.history.push(historyEntry);

        if (new Date(historyEntry.date) > new Date(existing.lastPurchasedDate)) {
          existing.lastPurchasedDate = historyEntry.date;
          existing.latestUnitPrice = itemPrice;
        }
      } else {
        productsMap.set(pId, {
          id: item.products.id,
          sku: item.products.sku || "",
          name: item.products.name,
          unit: productUnit,
          currentStock: item.products.stock_quantity || 0,
          latestUnitPrice: itemPrice,
          totalPurchasedQty: totalItemQty,
          totalSpent: itemTotalVal,
          purchaseCount: 1,
          lastPurchasedDate: historyEntry.date,
          history: [historyEntry],
        });
      }
    });

    const result = Array.from(productsMap.values());
    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Error fetching purchased products:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
