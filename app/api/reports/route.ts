import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    // 1. Date Filters
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), 0, 1).toISOString();
    const lastDay = new Date(now.getFullYear(), 11, 31).toISOString();

    const fromDate = searchParams.get("from") || firstDay;
    const toDate = searchParams.get("to") || lastDay;

    // 2. Fetch Loading Sheets (Deliveries)
    const { data: loadingSheets, error: loadsError } = await supabaseAdmin
      .from("loading_sheets")
      .select(
        `
        id, load_id, lorry_number, loading_date, status,
        driver:profiles!loading_sheets_driver_id_fkey(full_name)
      `
      )
      .gte("loading_date", fromDate)
      .lte("loading_date", toDate);

    if (loadsError) throw loadsError;

    // 3. Fetch Orders (Revenue & COGS)
    const { data: orders, error: ordersError } = await supabaseAdmin
      .from("orders")
      .select(
        `
        id, order_id, total_amount, status, created_at, sales_rep_id, load_id,
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
      .in("status", ["Delivered", "Completed"]);

    if (ordersError) throw ordersError;

    // 4. Fetch Expenses
    const { data: expenses, error: expensesError } = await supabaseAdmin
      .from("expenses")
      .select("id, amount, category, expense_date, business_id, load_id") // Added load_id
      .gte("expense_date", fromDate)
      .lte("expense_date", toDate);

    if (expensesError) throw expensesError;

    // 5. Stats Containers
    let totalRevenue = 0;
    let totalCostOfGoods = 0;
    let totalExpenses = 0;

    const productsMap: Record<string, any> = {};
    const customersMap: Record<string, any> = {};
    const repsMap: Record<string, any> = {};
    const businessMap: Record<string, any> = {};
    const monthlyMap: Record<string, any> = {};
    const expenseCategoryMap: Record<string, any> = {};
    const deliveriesMap: Record<string, any> = {}; // New Map for Deliveries
    const repCustomers: Record<string, Set<string>> = {};
    const ordersList: any[] = [];

    const initMonth = (dateObj: Date) => {
      const key = `${dateObj.getFullYear()}-${String(
        dateObj.getMonth() + 1
      ).padStart(2, "0")}`;
      if (!monthlyMap[key]) {
        monthlyMap[key] = {
          key,
          name: dateObj.toLocaleString("default", {
            month: "long",
            year: "numeric",
          }),
          revenue: 0,
          cogs: 0,
          grossProfit: 0,
          expenses: 0,
          netProfit: 0,
          orders: 0,
        };
      }
      return key;
    };

    // Initialize Deliveries Map
    loadingSheets?.forEach((load: any) => {
      deliveriesMap[load.id] = {
        id: load.id,
        loadId: load.load_id,
        date: load.loading_date,
        driver: load.driver?.full_name || "Unknown",
        lorry: load.lorry_number,
        status: load.status,
        revenue: 0,
        cogs: 0,
        grossProfit: 0,
        expenses: 0,
        netProfit: 0,
        ordersCount: 0,
      };
    });

    // 6. Process Orders
    orders?.forEach((order: any) => {
      const orderRevenue = Number(order.total_amount) || 0;
      let orderCost = 0;

      const orderDate = new Date(order.created_at);
      const monthKey = initMonth(orderDate);

      if (order.items) {
        order.items.forEach((item: any) => {
          const qty = Number(item.quantity) || 0;
          const costPrice = Number(item.product?.cost_price) || 0;
          const sellingPrice = Number(item.unit_price) || 0;
          const itemRevenue = Number(item.total_price) || qty * sellingPrice;
          const itemCost = qty * costPrice;

          orderCost += itemCost;

          if (item.product?.id) {
            const pId = item.product.id;
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

      const orderGrossProfit = orderRevenue - orderCost;

      totalRevenue += orderRevenue;
      totalCostOfGoods += orderCost;

      // Delivery Aggregation
      if (order.load_id && deliveriesMap[order.load_id]) {
        deliveriesMap[order.load_id].revenue += orderRevenue;
        deliveriesMap[order.load_id].cogs += orderCost;
        deliveriesMap[order.load_id].grossProfit += orderGrossProfit;
        deliveriesMap[order.load_id].ordersCount += 1;
      }

      // Monthly Aggregation
      monthlyMap[monthKey].revenue += orderRevenue;
      monthlyMap[monthKey].cogs += orderCost;
      monthlyMap[monthKey].grossProfit += orderGrossProfit;
      monthlyMap[monthKey].orders += 1;

      // Business Stats
      const bId = order.customer?.business_id;
      if (bId) {
        if (!businessMap[bId])
          businessMap[bId] = {
            id: bId,
            name: order.customer?.business?.name,
            revenue: 0,
            cost: 0,
            profit: 0,
            orders: 0,
          };
        businessMap[bId].revenue += orderRevenue;
        businessMap[bId].cost += orderCost;
        businessMap[bId].profit += orderGrossProfit;
        businessMap[bId].orders += 1;
      }

      // Customer Stats
      const cId = order.customer?.id;
      if (cId) {
        if (!customersMap[cId])
          customersMap[cId] = {
            id: cId,
            name: order.customer.shop_name,
            orders: 0,
            revenue: 0,
            profit: 0,
          };
        customersMap[cId].orders += 1;
        customersMap[cId].revenue += orderRevenue;
        customersMap[cId].profit += orderGrossProfit;
      }

      // Rep Stats
      const rId = order.sales_rep_id;
      if (rId) {
        if (!repsMap[rId]) {
          repsMap[rId] = {
            id: rId,
            name: order.rep?.full_name || "Unknown Rep",
            revenue: 0,
            profit: 0,
            orders: 0,
          };
          repCustomers[rId] = new Set();
        }
        repsMap[rId].revenue += orderRevenue;
        repsMap[rId].profit += orderGrossProfit;
        repsMap[rId].orders += 1;
        if (order.customer?.id) repCustomers[rId].add(order.customer.id);
      }

      ordersList.push({
        id: order.order_id,
        date: order.created_at.split("T")[0],
        customer: order.customer?.shop_name || "Unknown",
        business: order.customer?.business?.name || "-",
        revenue: orderRevenue,
        cost: orderCost,
        profit: orderGrossProfit,
        status: order.status,
      });
    });

    // 7. Process Expenses
    expenses?.forEach((exp: any) => {
      const amount = Number(exp.amount) || 0;
      const date = new Date(exp.expense_date);
      const monthKey = initMonth(date);

      totalExpenses += amount;
      monthlyMap[monthKey].expenses += amount;

      // Delivery Expense Mapping
      if (exp.load_id && deliveriesMap[exp.load_id]) {
        deliveriesMap[exp.load_id].expenses += amount;
      }

      const cat = exp.category || "Other";
      if (!expenseCategoryMap[cat]) expenseCategoryMap[cat] = 0;
      expenseCategoryMap[cat] += amount;
    });

    // 8. Final Calculations
    const grossProfit = totalRevenue - totalCostOfGoods;
    const netProfit = grossProfit - totalExpenses;
    const grossMargin =
      totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;
    const netMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

    // Finalize Deliveries
    const deliveriesArray = Object.values(deliveriesMap)
      .map((d: any) => {
        const net = d.grossProfit - d.expenses;
        return {
          ...d,
          netProfit: net,
          margin: d.revenue > 0 ? (net / d.revenue) * 100 : 0,
        };
      })
      .sort(
        (a: any, b: any) =>
          new Date(b.date).getTime() - new Date(a.date).getTime()
      );

    Object.values(monthlyMap).forEach((m: any) => {
      m.netProfit = m.grossProfit - m.expenses;
      m.margin = m.revenue > 0 ? (m.netProfit / m.revenue) * 100 : 0;
    });

    const monthlyArray = Object.values(monthlyMap).sort((a: any, b: any) =>
      a.key.localeCompare(b.key)
    );
    const expenseCategoryArray = Object.entries(expenseCategoryMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a: any, b: any) => b.value - a.value);

    const repsArray = Object.values(repsMap)
      .map((rep: any) => ({
        ...rep,
        customers: repCustomers[rep.id]?.size || 0,
        margin: rep.revenue > 0 ? (rep.profit / rep.revenue) * 100 : 0,
      }))
      .sort((a: any, b: any) => b.revenue - a.revenue);

    return NextResponse.json({
      overview: {
        revenue: totalRevenue,
        cogs: totalCostOfGoods,
        grossProfit,
        expenses: totalExpenses,
        netProfit,
        grossMargin,
        netMargin,
      },
      monthly: monthlyArray,
      expensesByCategory: expenseCategoryArray,
      products: Object.values(productsMap).sort(
        (a: any, b: any) => b.revenue - a.revenue
      ),
      customers: Object.values(customersMap).sort(
        (a: any, b: any) => b.revenue - a.revenue
      ),
      reps: repsArray,
      orders: ordersList.sort(
        (a: any, b: any) =>
          new Date(b.date).getTime() - new Date(a.date).getTime()
      ),
      business: Object.values(businessMap).sort(
        (a: any, b: any) => b.revenue - a.revenue
      ),
      deliveries: deliveriesArray, // Added Deliveries
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
