import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const url = new URL(request.url);
  const businessId = url.searchParams.get("businessId"); // ✅ Get Filter

  try {
    // --- 0. PRE-FETCH: Locations & Current Stocks ---
    let locQuery = supabaseAdmin
      .from("locations")
      .select("id, name, business_id");

    // If filtering by business, only get relevant locations + Main Warehouse (null)
    if (businessId) {
      locQuery = locQuery.or(
        `business_id.eq.${businessId},business_id.is.null`,
      );
    }

    const { data: locationsData } = await locQuery;

    const { data: currentStocks } = await supabaseAdmin
      .from("product_stocks")
      .select("location_id, quantity")
      .eq("product_id", id);

    // Map: Location ID -> Name
    const locationIdToName: Record<string, string> = {};
    const mainWarehouseIds: string[] = [];

    locationsData?.forEach((loc) => {
      locationIdToName[loc.id] = loc.name;
      if (!loc.business_id) mainWarehouseIds.push(loc.id);
    });

    const stockMap: Record<string, number> = {};
    currentStocks?.forEach((stock) => {
      const name = locationIdToName[stock.location_id];
      if (name) stockMap[name] = Number(stock.quantity);
      if (mainWarehouseIds.includes(stock.location_id)) {
        stockMap["MAIN_WAREHOUSE_KEY"] = Number(stock.quantity);
      }
    });

    // --- 1. Fetch SALES (Orders) ---
    let orderQuery = supabaseAdmin
      .from("order_items")
      .select(
        `
        id, quantity, unit_price, total_price, created_at, commission_earned,
        order:orders!inner (
          order_id, status, created_at, business_id,
          customer:customers (shop_name),
          rep:profiles!orders_sales_rep_id_fkey (full_name),
          load:loading_sheets (lorry_number)
        ),
        product:products (cost_price)
      `,
      )
      .eq("product_id", id)
      .neq("order.status", "Cancelled")
      .order("created_at", { ascending: false });

    // ✅ Filter Sales by Business
    if (businessId) {
      orderQuery = orderQuery.eq("order.business_id", businessId);
    }

    const { data: orderItems, error: orderError } = await orderQuery;
    if (orderError) throw orderError;

    // --- 2. Fetch PURCHASES ---
    let purchaseQuery = supabaseAdmin
      .from("purchase_items")
      .select(
        `
        id, quantity, unit_cost, total_cost, created_at,
        purchase:purchases!inner (
          purchase_id, invoice_no, status, purchase_date, business_id,
          supplier:suppliers (name)
        )
      `,
      )
      .eq("product_id", id)
      .order("created_at", { ascending: false });

    // ✅ Filter Purchases by Business
    if (businessId) {
      purchaseQuery = purchaseQuery.eq("purchase.business_id", businessId);
    }

    const { data: purchaseItems, error: purchaseError } = await purchaseQuery;
    if (purchaseError) throw purchaseError;

    // --- 3. Fetch RETURNS & DAMAGES ---
    let returnQuery = supabaseAdmin
      .from("inventory_returns")
      .select(
        `
        id, quantity, return_type, reason, created_at, business_id,
        customer:customers (shop_name),
        location:locations (name)
      `,
      )
      .eq("product_id", id)
      .order("created_at", { ascending: false });

    // ✅ Filter Returns by Business
    if (businessId) {
      returnQuery = returnQuery.eq("business_id", businessId);
    }

    const { data: returnItems, error: returnError } = await returnQuery;
    if (returnError) throw returnError;

    // --- 4. Fetch AUDIT LOGS (Stock Adjustments) ---
    // ✅ Updated: Search by record_id = id (Product ID) to find adjustments
    const { data: auditLogs, error: auditError } = await supabaseAdmin
      .from("audit_logs")
      .select("*")
      .eq("table_name", "product_stocks")
      .eq("record_id", id) // Matches the Product ID used in the Adjust Page
      .order("changed_at", { ascending: false })
      .limit(50);

    let safeAuditLogs = auditError ? [] : auditLogs || [];

    // ✅ Filter Adjustments by Business (check new_data metadata)
    if (businessId) {
      safeAuditLogs = safeAuditLogs.filter(
        (log: any) => log.new_data?.businessId === businessId,
      );
    }

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
      const date = new Date(item.created_at);
      const monthKey = `${date.getFullYear()}-${String(
        date.getMonth() + 1,
      ).padStart(2, "0")}`;

      // Since we filtered by businessId, usually this is just "Wireman"
      const businessName = "Wireman Agency";
      const repName = item.order.rep?.full_name || "Direct Sales";
      let locationName = item.order.load?.lorry_number || "Direct / Main";

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
        reference: item.order.order_id,
        location: locationName,
        status: item.order.status,
        notes: "-",
      });

      // Stats
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
    const purchaseHistory = (purchaseItems || []).map((item: any) => {
      const unitCost = Number(item.unit_cost) || 0;
      const isFree = unitCost === 0;
      const billId =
        item.purchase?.invoice_no || item.purchase?.purchase_id || "-";

      return {
        id: item.id,
        date: item.purchase?.purchase_date || item.created_at.split("T")[0],
        timestamp: new Date(item.created_at).getTime(),
        type: isFree ? "FREE ISSUE" : "PURCHASE",
        quantity: Number(item.quantity),
        customer: `${item.purchase?.supplier?.name || "Unknown"}`,
        reference: billId,
        location: "Main Warehouse",
        status: item.purchase?.status || "Completed",
        notes: isFree ? "Free Issue" : "-",
      };
    });

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
      reference: item.reason || "-",
      location: item.location?.name || "Unknown",
      notes: item.reason || "-",
    }));

    // D. Adjustments (Logic to parse Audit Logs)
    const adjustmentHistory = safeAuditLogs
      .map((log: any) => {
        const oldQty = Number(log.old_data?.quantity) || 0;
        const newQty = Number(log.new_data?.quantity) || 0;
        const diff = newQty - oldQty;

        // Find location name (Supports both key styles)
        const locId = log.new_data?.locationId || log.new_data?.location_id;
        const locName = locationIdToName[locId] || "Unknown Location";

        // Skip if no net change
        if (diff === 0) return null;

        return {
          id: log.id,
          date: log.changed_at.split("T")[0],
          timestamp: new Date(log.changed_at).getTime(),
          type: "ADJUSTMENT",
          quantity: diff,
          customer: "Stock Update",
          reference: "Manual",
          location: locName,
          notes: log.new_data?.reason || "Stock Correction",
        };
      })
      .filter(Boolean);

    // --- 6. Unified Sort & Response ---
    const allTransactions = [
      ...history,
      ...purchaseHistory,
      ...returnHistory,
      ...adjustmentHistory,
    ].sort((a, b) => b.timestamp - a.timestamp);

    return NextResponse.json({
      allTransactions,
      monthly: Object.values(monthlyStats).sort((a: any, b: any) =>
        a.dateStr.localeCompare(b.dateStr),
      ),
      business: Object.values(businessStats),
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
