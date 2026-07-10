import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

function getMonthsInRange(fromStr: string, toStr: string) {
  const start = new Date(fromStr);
  const end = new Date(toStr);
  const months = [];
  const curr = new Date(start.getFullYear(), start.getMonth(), 1);
  while (curr <= end) {
    const year = curr.getFullYear();
    const month = String(curr.getMonth() + 1).padStart(2, '0');
    months.push(`${year}-${month}`);
    curr.setMonth(curr.getMonth() + 1);
  }
  return months;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const now = new Date();
    
    // Default to the last 6 months
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1).toISOString().split("T")[0];
    const todayStr = now.toISOString().split("T")[0];

    const fromDate = searchParams.get("from") || sixMonthsAgo;
    const toDate = searchParams.get("to") || todayStr;
    const supplierName = searchParams.get("supplier") || "China";

    // 1. Get supplier records so we can find the supplier ID
    const { data: supplierInfo, error: supErr } = await supabaseAdmin
      .from("suppliers")
      .select("id, name, supplier_id")
      .eq("name", supplierName)
      .maybeSingle();

    if (supErr) throw supErr;

    // 2. Fetch products belonging to this supplier
    const supplierProducts: any[] = [];
    
    // Primary query by supplier_name
    const { data: primaryProducts, error: primaryError } = await supabaseAdmin
      .from("products")
      .select(`
        id, name, sku, supplier_name, cost_price, selling_price, category, min_stock_level,
        product_stocks (quantity)
      `)
      .eq("supplier_name", supplierName);
    
    if (primaryError) throw primaryError;
    if (primaryProducts) {
      supplierProducts.push(...primaryProducts);
    }

    // Secondary query via product_suppliers join table
    let linkedProductIds: string[] = [];
    if (supplierInfo) {
      const { data: joinRecords, error: joinError } = await supabaseAdmin
        .from("product_suppliers")
        .select("product_id")
        .eq("supplier_id", supplierInfo.id);
      
      if (!joinError && joinRecords && joinRecords.length > 0) {
        linkedProductIds = joinRecords.map((r: any) => r.product_id);
        const existingIds = new Set(supplierProducts.map(p => p.id));
        const missingIds = linkedProductIds.filter(id => !existingIds.has(id));
        
        if (missingIds.length > 0) {
          const { data: secondaryProducts } = await supabaseAdmin
            .from("products")
            .select(`
              id, name, sku, supplier_name, cost_price, selling_price, category, min_stock_level,
              product_stocks (quantity)
            `)
            .in("id", missingIds);
          
          if (secondaryProducts) {
            supplierProducts.push(...secondaryProducts);
          }
        }
      }
    }

    const productIds = supplierProducts.map(p => p.id);

    // 3. Fetch order items for these products in the date range
    const orderItems: any[] = [];
    
    const primaryProductIds = new Set(primaryProducts ? primaryProducts.map(p => p.id) : []);
    const secondaryProductIds = linkedProductIds.filter(id => !primaryProductIds.has(id));

    // Fetch primary products order items via product.supplier_name join filter to prevent URL/Header overflow
    if (primaryProducts && primaryProducts.length > 0) {
      let itemsStart = 0;
      const itemsLimit = 1000;
      while (true) {
        const { data: batch, error: itemsError } = await supabaseAdmin
          .from("order_items")
          .select(`
            id, quantity, free_quantity, unit_price, actual_unit_cost, total_price,
            product_id,
            product:products!inner (id, name, sku, supplier_name, category),
            order:orders!inner (
              id, order_id, status, is_inter_branch, created_at, order_date,
              customer:customers (shop_name)
            )
          `)
          .eq("product.supplier_name", supplierName)
          .gte("order.order_date", `${fromDate}T00:00:00.000Z`)
          .lte("order.order_date", `${toDate}T23:59:59.999Z`)
          .range(itemsStart, itemsStart + itemsLimit - 1);

        if (itemsError) throw itemsError;
        if (!batch || batch.length === 0) break;
        orderItems.push(...batch);
        if (batch.length < itemsLimit) break;
        itemsStart += itemsLimit;
      }
    }

    // Fetch secondary products order items via product_id in filter (safe since it's a small list)
    if (secondaryProductIds.length > 0) {
      let itemsStart = 0;
      const itemsLimit = 1000;
      while (true) {
        const { data: batch, error: itemsError } = await supabaseAdmin
          .from("order_items")
          .select(`
            id, quantity, free_quantity, unit_price, actual_unit_cost, total_price,
            product_id,
            product:products!inner (id, name, sku, supplier_name, category),
            order:orders!inner (
              id, order_id, status, is_inter_branch, created_at, order_date,
              customer:customers (shop_name)
            )
          `)
          .in("product_id", secondaryProductIds)
          .gte("order.order_date", `${fromDate}T00:00:00.000Z`)
          .lte("order.order_date", `${toDate}T23:59:59.999Z`)
          .range(itemsStart, itemsStart + itemsLimit - 1);

        if (itemsError) throw itemsError;
        if (!batch || batch.length === 0) break;
        orderItems.push(...batch);
        if (batch.length < itemsLimit) break;
        itemsStart += itemsLimit;
      }
    }

    // 4. Fetch pending/incoming stock for this supplier
    const pendingPurchases: Record<string, number> = {};
    if (supplierInfo) {
      const { data: pendingItems, error: pendingError } = await supabaseAdmin
        .from("purchase_items")
        .select(`
          product_id, quantity,
          purchase:purchases!inner (status, supplier_id)
        `)
        .eq("purchase.status", "Ordered")
        .eq("purchase.supplier_id", supplierInfo.id);
      
      if (!pendingError && pendingItems) {
        pendingItems.forEach((item: any) => {
          const pid = item.product_id;
          const qty = Number(item.quantity) || 0;
          pendingPurchases[pid] = (pendingPurchases[pid] || 0) + qty;
        });
      }
    }

    // 5. Generate list of months in the range
    const monthKeys = getMonthsInRange(fromDate, toDate);
    const numberOfMonths = Math.max(1, monthKeys.length);

    // 6. Aggregate data per product
    const productAggregation: Record<string, any> = {};

    supplierProducts.forEach((p: any) => {
      const stockQty = (p.product_stocks || []).reduce(
        (s: number, st: any) => s + (Number(st.quantity) || 0), 0
      );
      const costPrice = Number(p.cost_price) || 0;
      const sellingPrice = Number(p.selling_price) || 0;
      const minStockLevel = Number(p.min_stock_level) || 0;

      // Initialize monthly sales trend
      const monthlySales: Record<string, number> = {};
      monthKeys.forEach(m => {
        monthlySales[m] = 0;
      });

      productAggregation[p.id] = {
        id: p.id,
        name: p.name,
        sku: p.sku || "",
        category: p.category || "",
        costPrice,
        sellingPrice,
        minStockLevel,
        stockQty,
        pendingOrderQty: pendingPurchases[p.id] || 0,
        totalUnitsSold: 0,
        monthlySales,
        monthlyTrend: []
      };
    });

    // Populate actual sales from orderItems
    const isInterBranch = (order: any) => {
      if (order?.is_inter_branch === true) return true;
      const name = (order?.customer?.shop_name || "").toLowerCase();
      return name.includes("champika hardware");
    };

    orderItems.forEach((item: any) => {
      const order = item.order;
      if (!order) return;
      if (order.status !== "Delivered" && order.status !== "Completed") return;
      if (isInterBranch(order)) return;

      const pid = item.product_id;
      const qty = Number(item.quantity) || 0;
      const orderDate = order.order_date || order.created_at;
      if (!orderDate || !productAggregation[pid]) return;

      const dateObj = new Date(orderDate);
      const year = dateObj.getFullYear();
      const month = String(dateObj.getMonth() + 1).padStart(2, '0');
      const monthKey = `${year}-${month}`;

      const agg = productAggregation[pid];
      agg.totalUnitsSold += qty;
      if (agg.monthlySales[monthKey] !== undefined) {
        agg.monthlySales[monthKey] += qty;
      }
    });

    // Convert monthly sales maps to trend arrays
    const formattedProducts = Object.values(productAggregation).map((agg: any) => {
      agg.monthlyTrend = monthKeys.map(m => {
        // Formatted label, e.g. "Jan 2026"
        const [year, month] = m.split("-");
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const label = `${monthNames[parseInt(month) - 1]} ${year}`;
        return {
          monthKey: m,
          monthLabel: label,
          sales: agg.monthlySales[m]
        };
      });

      agg.monthlyAverage = agg.totalUnitsSold / numberOfMonths;
      delete agg.monthlySales; // Clean up map
      return agg;
    }).sort((a, b) => b.totalUnitsSold - a.totalUnitsSold);

    // Fetch list of active suppliers for frontend selector
    const { data: allSuppliers } = await supabaseAdmin
      .from("suppliers")
      .select("id, name")
      .eq("status", "Active")
      .order("name", { ascending: true });

    return NextResponse.json({
      supplier: supplierInfo,
      products: formattedProducts,
      months: monthKeys,
      numberOfMonths,
      suppliersList: allSuppliers || []
    });
  } catch (error: any) {
    console.error("Prediction API error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
