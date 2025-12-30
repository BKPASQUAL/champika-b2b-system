import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    // --- 0. PRE-FETCH: Locations & Current Stocks ---
    const { data: locationsData } = await supabaseAdmin
      .from("locations")
      .select("id, name, business_id");

    const { data: currentStocks } = await supabaseAdmin
      .from("product_stocks")
      .select("location_id, quantity")
      .eq("product_id", id);

    // Map: Location ID -> Name
    const locationIdToName: Record<string, string> = {};
    const mainWarehouseIds: string[] = [];

    locationsData?.forEach((loc) => {
      locationIdToName[loc.id] = loc.name;
      if (!loc.business_id) mainWarehouseIds.push(loc.id); // Identify main warehouse(s)
    });

    // Map: Location Name -> Current Stock Quantity
    // We key by Name because some transactions (like Sales) construct the name dynamically
    const stockMap: Record<string, number> = {};

    currentStocks?.forEach((stock) => {
      const name = locationIdToName[stock.location_id];
      if (name) stockMap[name] = Number(stock.quantity);

      // Also map "Main Warehouse" ID specifically for fallback
      if (mainWarehouseIds.includes(stock.location_id)) {
        stockMap["MAIN_WAREHOUSE_KEY"] = Number(stock.quantity);
      }
    });

    // --- 1. Fetch SALES (Orders) ---
    const { data: orderItems, error: orderError } = await supabaseAdmin
      .from("order_items")
      .select(
        `
        id, quantity, unit_price, total_price, created_at, commission_earned,
        order:orders (
          order_id, status, created_at,
          customer:customers (shop_name, business:businesses(name)),
          rep:profiles!orders_sales_rep_id_fkey (full_name),
          load:loading_sheets (
            lorry_number
          )
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

    // --- 4. Fetch AUDIT LOGS (Stock Adjustments) ---
    const { data: auditLogs, error: auditError } = await supabaseAdmin
      .from("audit_logs")
      .select("*")
      .eq("table_name", "product_stocks")
      .contains("new_data", { product_id: id })
      .order("changed_at", { ascending: false });

    const safeAuditLogs = auditError ? [] : auditLogs || [];

    // --- 5. Process Transactions ---
    const history: any[] = [];
    const monthlyStats: Record<string, any> = {};
    const businessStats: Record<string, any> = {};
    const repStats: Record<string, any> = {};
    let totalRevenue = 0;
    let totalProfit = 0;
    let totalUnitsSold = 0;

    // A. Sales
    orderItems.forEach((item: any) => {
      if (!item.order) return;

      const date = new Date(item.created_at);
      const monthKey = `${date.getFullYear()}-${String(
        date.getMonth() + 1
      ).padStart(2, "0")}`;
      const businessName = item.order.customer?.business?.name || "Unassigned";
      const repName = item.order.rep?.full_name || "Direct Sales";

      // Determine Location Name
      // Use Lorry Number if exists, otherwise fallback to Main Warehouse logic
      let locationName = "Direct / Main";
      if (item.order.load?.lorry_number) {
        locationName = item.order.load.lorry_number; // Assuming Lorry Name matches Location Name
      }

      const revenue = Number(item.total_price) || 0;
      const cost =
        (Number(item.quantity) || 0) * (Number(item.product?.cost_price) || 0);
      const profit = revenue - cost;
      const qty = Number(item.quantity) || 0;

      history.push({
        id: item.id,
        date: item.created_at.split("T")[0],
        timestamp: new Date(item.created_at).getTime(),
        type: "SALE",
        quantity: -qty,
        customer: item.order.customer?.shop_name || "Unknown",
        location: locationName,
        status: item.order.status,
      });

      // Stats Aggregation...
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

    // B. Purchases
    const purchaseHistory = (purchaseItems || []).map((item: any) => ({
      id: item.id,
      date: item.purchase?.purchase_date || item.created_at.split("T")[0],
      timestamp: new Date(item.created_at).getTime(),
      type: "PURCHASE",
      quantity: Number(item.quantity),
      customer: item.purchase?.supplier?.name || "Unknown",
      location: "Main Warehouse", // Default
      status: item.purchase?.status || "Completed",
    }));

    // C. Returns
    const returnHistory = (returnItems || []).map((item: any) => ({
      id: item.id,
      date: item.created_at.split("T")[0],
      timestamp: new Date(item.created_at).getTime(),
      type: item.return_type === "Damage" ? "DAMAGE" : "RETURN",
      quantity:
        item.return_type === "Damage"
          ? -Number(item.quantity)
          : Number(item.quantity),
      customer: item.customer?.shop_name || "N/A",
      location: item.location?.name || "Unknown",
    }));

    // D. Adjustments
    const adjustmentHistory = safeAuditLogs
      .map((log: any) => {
        const oldQty = Number(log.old_data?.quantity) || 0;
        const newQty = Number(log.new_data?.quantity) || 0;
        const diff = newQty - oldQty;

        const locId = log.new_data?.location_id || log.old_data?.location_id;
        const locName = locationIdToName[locId] || "Unknown Location";

        if (diff === 0) return null;

        return {
          id: log.id,
          date: log.changed_at.split("T")[0],
          timestamp: new Date(log.changed_at).getTime(),
          type: "ADJUSTMENT",
          quantity: diff,
          customer: "System",
          location: locName,
        };
      })
      .filter(Boolean);

    // --- 6. Unified Sort & Balance Calculation ---
    const allTransactions = [
      ...history,
      ...purchaseHistory,
      ...returnHistory,
      ...adjustmentHistory,
    ].sort((a, b) => b.timestamp - a.timestamp); // Sort Newest -> Oldest

    // Calculate Running Balance per Location
    // Since we sort Descending (Newest First), we start with Current Stock and subtract/add inversely to go back in time.

    // Create a temporary tracker for calculation
    const tempLocationStock: Record<string, number> = { ...stockMap };

    const processedTransactions = allTransactions.map((tx) => {
      // Normalize Location Key for matching
      let stockKey = tx.location;

      // Handle "Direct / Main" mapping to Main Warehouse
      if (tx.location === "Direct / Main" || tx.location === "Main Warehouse") {
        stockKey = "MAIN_WAREHOUSE_KEY";
      }

      // Fallback: If we can't find exact stock, try to find by name match
      if (stockKey !== "MAIN_WAREHOUSE_KEY" && !tempLocationStock[stockKey]) {
        // Try to find if location name exists in map
        const foundKey = Object.keys(tempLocationStock).find(
          (k) => k === tx.location
        );
        if (foundKey) stockKey = foundKey;
      }

      // Get Stock *After* this transaction (which is the current tracker value)
      const balanceAfter = tempLocationStock[stockKey] ?? 0;

      // Update tracker for the *next* iteration (which is the previous transaction in time)
      // If Tx was +5 (Purchase), then *Before* it was Balance - 5.
      // If Tx was -5 (Sale), then *Before* it was Balance + 5.
      if (tempLocationStock[stockKey] !== undefined) {
        tempLocationStock[stockKey] = balanceAfter - tx.quantity;
      }

      return {
        ...tx,
        stockAfter: balanceAfter, // Add this field
      };
    });

    return NextResponse.json({
      allTransactions: processedTransactions,
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
