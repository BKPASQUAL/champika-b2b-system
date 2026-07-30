// app/api/orders/loading/summary/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const orderIdsParam = searchParams.get("orderIds");

    if (!orderIdsParam) {
      return NextResponse.json({ error: "orderIds is required" }, { status: 400 });
    }

    const orderIds = orderIdsParam.split(",").filter(Boolean);

    if (orderIds.length === 0) {
      return NextResponse.json({ error: "No valid order IDs provided" }, { status: 400 });
    }

    // Fetch orders with invoice info + all order items with product details
    const { data: orders, error } = await supabaseAdmin
      .from("orders")
      .select(
        `
        id,
        order_id,
        invoice_no,
        total_amount,
        order_date,
        customers (
          shop_name,
          route
        ),
        invoices (
          invoice_no
        ),
        order_items (
          quantity,
          free_quantity,
          unit_price,
          total_price,
          products (
            id,
            name,
            sku
          )
        )
      `
      )
      .in("id", orderIds)
      .order("created_at", { ascending: true });

    if (error) throw error;

    // Build per-invoice data
    const invoices = (orders ?? []).map((order: any) => ({
      orderId: order.order_id,
      invoiceNo:
        order.invoices?.[0]?.invoice_no || order.invoice_no || order.order_id,
      shopName: order.customers?.shop_name || "Unknown",
      route: order.customers?.route || "-",
      totalAmount: order.total_amount,
      items: (order.order_items ?? []).map((item: any) => ({
        productId: item.products?.id || "",
        productName: item.products?.name || "Unknown Product",
        sku: item.products?.sku || "-",
        quantity: Number(item.quantity) || 0,
        freeQuantity: Number(item.free_quantity) || 0,
        unitPrice: Number(item.unit_price) || 0,
      })),
    }));

    // Fetch Customer Returns associated with these invoices
    const invoiceNos = invoices.map((inv) => inv.invoiceNo).filter(Boolean);
    let returnsList: any[] = [];

    if (invoiceNos.length > 0) {
      const orConditions = invoiceNos.map((invNo) => `reason.ilike.%${invNo}%`).join(",");
      const { data: returnsData, error: returnsErr } = await supabaseAdmin
        .from("inventory_returns")
        .select(`
          id,
          quantity,
          return_type,
          reason,
          created_at,
          products (
            id,
            name,
            sku
          ),
          customers (
            shop_name
          )
        `)
        .or(orConditions);

      if (!returnsErr && returnsData) {
        returnsList = returnsData;
      }
    }

    // Format returns list
    const returns = returnsList.map((ret: any) => {
      const match = ret.reason?.match(/\[(.*?)\]/);
      const matchedInvNo = match ? match[1] : "";
      return {
        id: ret.id,
        invoiceNo: matchedInvNo,
        shopName: ret.customers?.shop_name || "Unknown Shop",
        productId: ret.products?.id || "",
        productName: ret.products?.name || "Unknown Product",
        sku: ret.products?.sku || "-",
        returnType: ret.return_type || "Exchange",
        quantity: Number(ret.quantity) || 0,
      };
    });

    // Build unified aggregated summary across all invoices & returns
    const summaryMap: Record<
      string,
      {
        productId: string;
        productName: string;
        sku: string;
        totalQuantity: number;
        totalFreeQuantity: number;
        totalReturnQuantity: number;
      }
    > = {};

    invoices.forEach((inv) => {
      inv.items.forEach((item: any) => {
        const key = item.productId || item.productName;
        if (!summaryMap[key]) {
          summaryMap[key] = {
            productId: item.productId,
            productName: item.productName,
            sku: item.sku,
            totalQuantity: 0,
            totalFreeQuantity: 0,
            totalReturnQuantity: 0,
          };
        }
        summaryMap[key].totalQuantity += item.quantity;
        summaryMap[key].totalFreeQuantity += item.freeQuantity;
      });
    });

    returns.forEach((ret: any) => {
      const key = ret.productId || ret.productName;
      if (!summaryMap[key]) {
        summaryMap[key] = {
          productId: ret.productId || "",
          productName: ret.productName,
          sku: ret.sku || "-",
          totalQuantity: 0,
          totalFreeQuantity: 0,
          totalReturnQuantity: 0,
        };
      }
      summaryMap[key].totalReturnQuantity += ret.quantity;
    });

    const summary = Object.values(summaryMap).sort((a, b) =>
      a.productName.localeCompare(b.productName)
    );

    return NextResponse.json({
      reportDate: new Date().toISOString(),
      invoiceCount: invoices.length,
      invoices,
      summary,
      returns,
    });
  } catch (error: any) {
    console.error("GET /api/orders/loading/summary error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
