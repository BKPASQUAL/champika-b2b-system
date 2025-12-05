import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin"; //

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    // 1. Date Filters
    const now = new Date();
    const firstDay = new Date(
      now.getFullYear(),
      now.getMonth(),
      1
    ).toISOString();
    const lastDay = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0
    ).toISOString();
    const fromDate = searchParams.get("from") || firstDay;
    const toDate = searchParams.get("to") || lastDay;

    // 2. Fetch Data
    const { data: orders, error } = await supabaseAdmin
      .from("orders")
      .select(
        `
        id, order_id, total_amount, status, created_at, sales_rep_id,
        customer:customers (id, shop_name, owner_name, business_id, business:businesses(id, name)),
        rep:profiles!orders_sales_rep_id_fkey (id, full_name),
        items:order_items (
          id, quantity, unit_price, total_price,
          product:products (id, name, cost_price, category)
        )
      `
      )
      .gte("created_at", fromDate)
      .lte("created_at", toDate)
      .neq("status", "Cancelled");

    if (error) throw error;

    // 3. Stats Containers
    let totalRevenue = 0;
    let totalCost = 0;

    const productsMap: Record<string, any> = {};
    const customersMap: Record<string, any> = {};
    const repsMap: Record<string, any> = {}; // <--- We will update this
    const businessMap: Record<string, any> = {};
    const ordersList: any[] = [];

    // 4. Calculation Loop
    orders?.forEach((order: any) => {
      const orderRevenue = Number(order.total_amount) || 0;
      let orderCost = 0;

      // Calculate Order Cost from Items
      if (order.items) {
        order.items.forEach((item: any) => {
          const qty = Number(item.quantity) || 0;
          const costPrice = Number(item.product?.cost_price) || 0;
          const sellingPrice = Number(item.unit_price) || 0;

          const itemCost = qty * costPrice;
          const itemRevenue = Number(item.total_price) || qty * sellingPrice;

          orderCost += itemCost;

          // Product Stats
          const pId = item.product?.id;
          if (pId) {
            if (!productsMap[pId])
              productsMap[pId] = {
                id: pId,
                name: item.product.name,
                category: item.product.category,
                sold: 0,
                revenue: 0,
                cost: 0,
              };
            productsMap[pId].sold += qty;
            productsMap[pId].revenue += itemRevenue;
            productsMap[pId].cost += itemCost;
          }
        });
      }

      const orderProfit = orderRevenue - orderCost;
      totalRevenue += orderRevenue;
      totalCost += orderCost;

      // --- NEW: Rep Aggregation with Profit ---
      const rId = order.sales_rep_id;
      if (rId) {
        if (!repsMap[rId]) {
          repsMap[rId] = {
            id: rId,
            name: order.rep?.full_name || "Unknown Rep",
            sales: 0,
            cost: 0, // Track cost
            profit: 0, // Track profit
            orders: 0,
          };
        }
        repsMap[rId].sales += orderRevenue;
        repsMap[rId].cost += orderCost; // Add cost
        repsMap[rId].profit += orderProfit; // Add profit
        repsMap[rId].orders += 1;
      }
      // ----------------------------------------

      // Customer Stats
      const cId = order.customer?.id;
      if (cId) {
        if (!customersMap[cId])
          customersMap[cId] = {
            id: cId,
            shop: order.customer.shop_name,
            owner: order.customer.owner_name,
            count: 0,
            revenue: 0,
            profit: 0,
          };
        customersMap[cId].count += 1;
        customersMap[cId].revenue += orderRevenue;
        customersMap[cId].profit += orderProfit;
      }

      // Business Stats
      const bId = order.customer?.business_id;
      if (bId) {
        if (!businessMap[bId])
          businessMap[bId] = {
            id: bId,
            name: order.customer?.business?.name,
            revenue: 0,
            profit: 0,
            orders: 0,
          };
        businessMap[bId].revenue += orderRevenue;
        businessMap[bId].profit += orderProfit;
        businessMap[bId].orders += 1;
      }

      // Order List
      ordersList.push({
        id: order.order_id,
        date: order.created_at.split("T")[0],
        customer: order.customer?.shop_name || "Unknown",
        total: orderRevenue,
        cost: orderCost,
        profit: orderProfit,
      });
    });

    const grossProfit = totalRevenue - totalCost;
    const margin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

    return NextResponse.json({
      overview: {
        revenue: totalRevenue,
        cost: totalCost,
        profit: grossProfit,
        margin,
      },
      products: Object.values(productsMap).sort(
        (a: any, b: any) => b.revenue - a.revenue
      ),
      customers: Object.values(customersMap).sort(
        (a: any, b: any) => b.revenue - a.revenue
      ),

      // Sort Reps by Profit instead of Sales if you prefer
      reps: Object.values(repsMap).sort(
        (a: any, b: any) => b.profit - a.profit
      ),

      orders: ordersList.sort(
        (a: any, b: any) =>
          new Date(b.date).getTime() - new Date(a.date).getTime()
      ),
      business: Object.values(businessMap).sort(
        (a: any, b: any) => b.revenue - a.revenue
      ),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
