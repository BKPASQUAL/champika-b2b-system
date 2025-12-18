import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    // --- 1. Fetch SALES (Orders) ---
    const { data: orderItems, error: orderError } = await supabaseAdmin
      .from("order_items")
      .select(
        `
        id, quantity, unit_price, total_price, created_at, commission_earned,
        order:orders (
          order_id, status, created_at,
          customer:customers (
            shop_name,
            business:businesses (name)
          ),
          rep:profiles!orders_sales_rep_id_fkey (full_name)
        ),
        product:products (cost_price)
      `
      )
      .eq("product_id", id)
      .neq("order.status", "Cancelled")
      .order("created_at", { ascending: false });

    if (orderError) throw orderError;

    // --- 2. Fetch PURCHASES ---
    const { data: purchaseItems, error: purchaseError } = await supabaseAdmin
      .from("purchase_items")
      .select(
        `
        id, quantity, unit_cost, total_cost, created_at,
        purchase:purchases (
          purchase_id, status, purchase_date,
          supplier:suppliers (name)
        )
      `
      )
      .eq("product_id", id)
      .order("created_at", { ascending: false });

    if (purchaseError) throw purchaseError;

    // --- 3. Fetch RETURNS & DAMAGES ---
    const { data: returnItems, error: returnError } = await supabaseAdmin
      .from("inventory_returns")
      .select(
        `
        id, quantity, return_type, reason, created_at,
        customer:customers (shop_name),
        location:locations (name)
      `
      )
      .eq("product_id", id)
      .order("created_at", { ascending: false });

    if (returnError) throw returnError;

    // --- 4. Process Sales Data & Charts ---
    const history: any[] = [];
    const monthlyStats: Record<string, any> = {};
    const businessStats: Record<string, any> = {};
    const repStats: Record<string, any> = {};
    let totalRevenue = 0;
    let totalProfit = 0;
    let totalUnitsSold = 0;

    orderItems.forEach((item: any) => {
      if (!item.order) return;

      const date = new Date(item.created_at);
      const monthKey = `${date.getFullYear()}-${String(
        date.getMonth() + 1
      ).padStart(2, "0")}`;
      const businessName = item.order.customer?.business?.name || "Unassigned";
      const repName = item.order.rep?.full_name || "Direct Sales";

      const revenue = Number(item.total_price) || 0;
      const cost =
        (Number(item.quantity) || 0) * (Number(item.product?.cost_price) || 0);
      const profit = revenue - cost;
      const qty = Number(item.quantity) || 0;

      // History Entry (Sales)
      history.push({
        id: item.id,
        orderId: item.order.order_id,
        date: item.created_at.split("T")[0],
        customer: item.order.customer?.shop_name || "Unknown",
        business: businessName,
        rep: repName,
        quantity: -qty, // Negative for stock out
        unitPrice: item.unit_price,
        total: revenue,
        status: item.order.status,
        type: "SALE",
      });

      // Aggregations for Charts
      if (!monthlyStats[monthKey]) {
        monthlyStats[monthKey] = {
          name: date.toLocaleString("default", {
            month: "short",
            year: "2-digit",
          }),
          revenue: 0,
          profit: 0,
          units: 0,
          dateStr: monthKey,
        };
      }
      monthlyStats[monthKey].revenue += revenue;
      monthlyStats[monthKey].profit += profit;
      monthlyStats[monthKey].units += qty;

      if (!businessStats[businessName])
        businessStats[businessName] = {
          name: businessName,
          value: 0,
          profit: 0,
        };
      businessStats[businessName].value += revenue;
      businessStats[businessName].profit += profit;

      if (!repStats[repName])
        repStats[repName] = { name: repName, value: 0, units: 0 };
      repStats[repName].value += revenue;
      repStats[repName].units += qty;

      totalRevenue += revenue;
      totalProfit += profit;
      totalUnitsSold += qty;
    });

    // --- 5. Process Purchase History ---
    const purchaseHistory = (purchaseItems || []).map((item: any) => ({
      id: item.id,
      date: item.purchase?.purchase_date || item.created_at.split("T")[0],
      type: "PURCHASE",
      quantity: Number(item.quantity), // Positive
      customer: item.purchase?.supplier?.name || "Unknown",
      reference: item.purchase?.purchase_id || "N/A",
      notes: "Purchase from Supplier",
      status: item.purchase?.status || "Completed",
    }));

    // --- 6. Process Return History ---
    const returnHistory = (returnItems || []).map((item: any) => ({
      id: item.id,
      date: item.created_at.split("T")[0],
      type: item.return_type === "Damage" ? "DAMAGE" : "RETURN",
      quantity:
        item.return_type === "Damage"
          ? -Number(item.quantity)
          : Number(item.quantity), // Damage is loss (negative), Good return is gain (positive) in context of *usable* stock?
      // Actually, usually in a transaction history:
      // Sale = -qty
      // Purchase = +qty
      // Good Return = +qty (back to stock)
      // Damage Return = often just logged. If we treat it as stock entering "Damage Pile", it's +qty.
      // However, frontend usually renders "Green" for adds, "Red" for subtracts.
      // Let's keep Damage as negative or neutral if it doesn't add to sellable stock.
      // For now, let's mark Good Return as + (Green) and Damage as - (Red) to distinguish visually.

      customer: item.customer?.shop_name || "N/A",
      reference: "RETURN",
      notes: `${item.return_type}: ${item.reason || "No reason"}`,
    }));

    // --- 7. Unified & Sorted List ---
    const allTransactions = [
      ...history,
      ...purchaseHistory,
      ...returnHistory,
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return NextResponse.json({
      allTransactions, // The unified list
      monthly: Object.values(monthlyStats).sort((a: any, b: any) =>
        a.dateStr.localeCompare(b.dateStr)
      ),
      business: Object.values(businessStats).sort(
        (a: any, b: any) => b.value - a.value
      ),
      reps: Object.values(repStats).sort((a: any, b: any) => b.value - a.value),
      summary: {
        totalRevenue,
        totalProfit,
        totalUnitsSold,
        margin: totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
