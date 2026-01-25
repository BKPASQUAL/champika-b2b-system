import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const url = new URL(request.url);
  const businessId = url.searchParams.get("businessId");

  try {
    // --- 0. PRE-FETCH: Locations & Current Stocks ---
    // We need the TOTAL current stock to calculate history backwards correctly
    const { data: currentStocks } = await supabaseAdmin
      .from("product_stocks")
      .select("quantity")
      .eq("product_id", id);

    // Calculate Total Global Stock (Start Point for Reverse Calculation)
    const totalCurrentStock = (currentStocks || []).reduce(
      (sum, item) => sum + (Number(item.quantity) || 0),
      0,
    );

    // --- 1. Fetch SALES (Orders) - Fetch ALL to ensure accurate stock calc ---
    const { data: orderItems, error: orderError } = await supabaseAdmin
      .from("order_items")
      .select(
        `
        id, quantity, free_quantity, unit_price, total_price, created_at, commission_earned, actual_unit_cost,
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

    if (orderError) throw orderError;

    // --- 2. Fetch PURCHASES ---
    const { data: purchaseItems, error: purchaseError } = await supabaseAdmin
      .from("purchase_items")
      .select(
        `
        id, quantity, free_quantity, unit_cost, total_cost, created_at, selling_price,
        purchase:purchases!inner (
          purchase_id, invoice_no, status, purchase_date, business_id,
          supplier:suppliers (name)
        )
      `,
      )
      .eq("product_id", id)
      .order("created_at", { ascending: false });

    if (purchaseError) throw purchaseError;

    // --- 3. Fetch RETURNS & DAMAGES ---
    const { data: returnItems, error: returnError } = await supabaseAdmin
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

    if (returnError) throw returnError;

    // --- 4. Fetch AUDIT LOGS (Stock Adjustments) ---
    const { data: auditLogs, error: auditError } = await supabaseAdmin
      .from("audit_logs")
      .select("*")
      .eq("table_name", "product_stocks")
      .eq("record_id", id)
      .order("changed_at", { ascending: false })
      .limit(200); // Increased limit for better historical accuracy

    const safeAuditLogs = auditError ? [] : auditLogs || [];

    // --- 5. Process Transactions (Global List) ---
    let history: any[] = [];

    // A. Sales
    (orderItems || []).forEach((item: any) => {
      const qty = Number(item.quantity) || 0;
      const freeQty = Number(item.free_quantity) || 0;
      const realChange = -(qty + freeQty); // Sales reduce stock

      history.push({
        id: item.id,
        date: item.created_at.split("T")[0],
        timestamp: new Date(item.created_at).getTime(),
        type: "SALE",
        quantity: -qty,
        freeQuantity: freeQty,
        realChange: realChange, // For calculation
        customer: item.order.customer?.shop_name || "Unknown",
        reference: item.order.order_id,
        location: item.order.load?.lorry_number || "Direct / Main",
        status: item.order.status,
        notes: "-",
        buyingPrice: Number(item.actual_unit_cost) || 0,
        sellingPrice: Number(item.unit_price) || 0,
        businessId: item.order.business_id,
      });
    });

    // B. Purchases
    (purchaseItems || []).forEach((item: any) => {
      const unitCost = Number(item.unit_cost) || 0;
      const isFree = unitCost === 0;
      const qty = Number(item.quantity);
      const freeQty = Number(item.free_quantity) || 0;
      const realChange = qty + freeQty; // Purchases add to stock

      history.push({
        id: item.id,
        date: item.purchase?.purchase_date || item.created_at.split("T")[0],
        timestamp: new Date(item.created_at).getTime(),
        type: isFree ? "FREE ISSUE" : "PURCHASE",
        quantity: qty,
        freeQuantity: freeQty,
        realChange: realChange, // For calculation
        customer: `${item.purchase?.supplier?.name || "Unknown"}`,
        reference:
          item.purchase?.invoice_no || item.purchase?.purchase_id || "-",
        location: "Main Warehouse",
        status: item.purchase?.status || "Completed",
        notes: isFree ? "Free Issue" : "-",
        buyingPrice: Number(item.unit_cost) || 0,
        sellingPrice: Number(item.selling_price) || 0,
        businessId: item.purchase.business_id,
      });
    });

    // C. Returns
    (returnItems || []).forEach((item: any) => {
      const isDamage = item.return_type === "Damage";
      const qty = Number(item.quantity);
      // Assumption: Good returns add to stock. Damage returns don't count towards "Good Stock"
      // or track them separately. For this view, we'll assume only Good returns increase the main balance.
      const realChange = isDamage ? 0 : qty;

      history.push({
        id: item.id,
        date: item.created_at.split("T")[0],
        timestamp: new Date(item.created_at).getTime(),
        type: isDamage ? "DAMAGE" : "RETURN",
        quantity: isDamage ? -qty : qty,
        freeQuantity: 0,
        realChange: realChange,
        customer: item.customer?.shop_name || "N/A",
        reference: item.reason || "-",
        location: item.location?.name || "Unknown",
        notes: item.reason || "-",
        buyingPrice: 0,
        sellingPrice: 0,
        businessId: item.business_id,
      });
    });

    // D. Adjustments
    safeAuditLogs.forEach((log: any) => {
      const oldQty = Number(log.old_data?.quantity) || 0;
      const newQty = Number(log.new_data?.quantity) || 0;
      const diff = newQty - oldQty;

      if (diff !== 0) {
        history.push({
          id: log.id,
          date: log.changed_at.split("T")[0],
          timestamp: new Date(log.changed_at).getTime(),
          type: "ADJUSTMENT",
          quantity: diff,
          freeQuantity: 0,
          realChange: diff,
          customer: "Stock Update",
          reference: "Manual",
          location: "Warehouse",
          notes: log.new_data?.reason || "Stock Correction",
          buyingPrice: 0,
          sellingPrice: 0,
          businessId: log.new_data?.businessId,
        });
      }
    });

    // --- 6. Sort & Calculate Running Balance ---
    // Sort Newest -> Oldest
    history.sort((a, b) => b.timestamp - a.timestamp);

    let runningBalance = totalCurrentStock;

    // Map to add "Current Stock" column
    const historyWithStock = history.map((tx) => {
      const stockAfterTx = runningBalance;

      // Calculate stock BEFORE this transaction for the next iteration
      // Current = Previous + Change  => Previous = Current - Change
      runningBalance = runningBalance - tx.realChange;

      return {
        ...tx,
        currentStock: stockAfterTx, // ✅ This is what we show in the table
      };
    });

    // --- 7. Filter (After Calculation) ---
    let finalTransactions = historyWithStock;
    if (businessId) {
      finalTransactions = historyWithStock.filter(
        (tx) => !tx.businessId || tx.businessId === businessId,
      );
    }

    // --- 8. Stats Calculation ---
    const monthlyStats: Record<string, any> = {};
    const businessStats: Record<string, any> = {};
    const repStats: Record<string, any> = {};
    let totalRevenue = 0;
    let totalProfit = 0;
    let totalUnitsSold = 0;

    finalTransactions.forEach((tx: any) => {
      if (tx.type === "SALE") {
        const date = new Date(tx.timestamp);
        const monthKey = `${date.getFullYear()}-${String(
          date.getMonth() + 1,
        ).padStart(2, "0")}`;

        const businessName = "Wireman Agency"; // Or map appropriately
        const repName = "Direct Sales"; // Or map from tx

        // Revenue based on what was actually sold (excluding free qty from revenue calculation usually, depends on business logic)
        const soldQty = Math.abs(tx.quantity);
        const revenue = soldQty * tx.sellingPrice;
        const cost = soldQty * tx.buyingPrice;
        const profit = revenue - cost;

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
        monthlyStats[monthKey].units += soldQty;

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
        repStats[repName].units += soldQty;

        totalRevenue += revenue;
        totalProfit += profit;
        totalUnitsSold += soldQty;
      }
    });

    return NextResponse.json({
      allTransactions: finalTransactions,
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
