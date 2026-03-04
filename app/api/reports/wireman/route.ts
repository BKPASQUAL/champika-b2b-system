import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");

  try {
    let query = supabaseAdmin
      .from("order_items")
      .select(
        `
        id, quantity, free_quantity, unit_price, actual_unit_cost, created_at,
        order:orders!inner (
          order_id, status, created_at, order_date, invoice_no,
          customer:customers (shop_name),
          invoices (invoice_no)
        ),
        product:products!inner (
          id, name, sku, supplier_name, cost_price
        )
      `
      )
      .neq("order.status", "Cancelled")
      .ilike("product.supplier_name", "%Wireman%");

    if (from) {
      // Assuming 'order_date' is typically formatted as YYYY-MM-DD
      // We also check against created_at as a fallback or in tandem, though postgrest 
      // makes 'or' slightly tricky with inner joins. Instead, filter by order.order_date
      query = query.gte("order.order_date", from.split("T")[0]);
    }
    if (to) {
      query = query.lte("order.order_date", to.split("T")[0]);
    }

    const { data: orderItems, error } = await query;

    if (error) throw error;

    let overview = {
      revenue: 0,
      standardCost: 0,
      standardProfit: 0,
      margin: 0
    };

    const monthlyStats: Record<string, any> = {};
    const productStats: Record<string, any> = {};
    const customerStats: Record<string, any> = {};
    const orderStats: Record<string, any> = {};

    (orderItems || []).forEach((item: any) => {
      const qty = Number(item.quantity) || 0;
      const unitPrice = Number(item.unit_price) || 0;
      const standardUnitCost = Number(item.product.cost_price) || 0; // Base cost

      const revenue = qty * unitPrice;
      const standardCost = qty * standardUnitCost;
      const standardProfit = revenue - standardCost;

      // 1. Overview
      overview.revenue += revenue;
      overview.standardCost += standardCost;
      overview.standardProfit += standardProfit;

      // 2. Monthly
      const actualDate = item.order.order_date || item.order.created_at.split("T")[0];
      const date = new Date(actualDate);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      
      if (!monthlyStats[monthKey]) {
        monthlyStats[monthKey] = {
          name: date.toLocaleString("default", { month: "short", year: "2-digit" }),
          dateStr: monthKey,
          revenue: 0,
          standardProfit: 0,
        };
      }
      monthlyStats[monthKey].revenue += revenue;
      monthlyStats[monthKey].standardProfit += standardProfit;

      // 3. Products
      const productId = item.product.id;
      if (!productStats[productId]) {
        productStats[productId] = {
          id: productId,
          sku: item.product.sku,
          name: item.product.name,
          qtySold: 0,
          revenue: 0,
          standardCost: 0,
          standardProfit: 0,
        };
      }
      productStats[productId].qtySold += qty;
      productStats[productId].revenue += revenue;
      productStats[productId].standardCost += standardCost;
      productStats[productId].standardProfit += standardProfit;

      // 4. Customers
      const customerName = item.order.customer?.shop_name || "Unknown";
      if (!customerStats[customerName]) {
        customerStats[customerName] = {
          name: customerName,
          revenue: 0,
          standardCost: 0,
          standardProfit: 0,
        };
      }
      customerStats[customerName].revenue += revenue;
      customerStats[customerName].standardCost += standardCost;
      customerStats[customerName].standardProfit += standardProfit;

      // 5. Orders
      const orderId = item.order.order_id;
      const invoiceNo = item.order.invoices?.[0]?.invoice_no || item.order.invoice_no || "N/A";
      
      if (!orderStats[orderId]) {
        orderStats[orderId] = {
          orderId: orderId,
          invoiceNo: invoiceNo,
          customer: customerName,
          date: item.order.order_date || item.order.created_at.split("T")[0],
          revenue: 0,
          standardCost: 0,
          standardProfit: 0,
        };
      }
      orderStats[orderId].revenue += revenue;
      orderStats[orderId].standardCost += standardCost;
      orderStats[orderId].standardProfit += standardProfit;
    });

    overview.margin = overview.revenue > 0 ? (overview.standardProfit / overview.revenue) * 100 : 0;

    return NextResponse.json({
      overview,
      monthly: Object.values(monthlyStats).sort((a: any, b: any) => a.dateStr.localeCompare(b.dateStr)),
      products: Object.values(productStats).sort((a: any, b: any) => b.revenue - a.revenue),
      customers: Object.values(customerStats).sort((a: any, b: any) => b.revenue - a.revenue),
      orders: Object.values(orderStats).sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
