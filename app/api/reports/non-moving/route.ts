import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

function isInterBranch(order: any) {
  if (order?.is_inter_branch === true) return true;
  const name = (order?.customer?.shop_name || "").toLowerCase();
  return name.includes("champika hardware");
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const now = new Date();

    // Default to last calendar month
    const defaultFrom = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      .toISOString()
      .split("T")[0];
    const defaultTo = new Date(now.getFullYear(), now.getMonth(), 0)
      .toISOString()
      .split("T")[0];

    const fromDate = searchParams.get("from") || defaultFrom;
    const toDate = searchParams.get("to") || defaultTo;

    // 1. Fetch all products with current stock (paginated to avoid the 1000 row cap)
    const products: any[] = [];
    let pStart = 0;
    const pLimit = 1000;
    while (true) {
      const { data: batch, error } = await supabaseAdmin
        .from("products")
        .select(
          `
          id, name, sku, supplier_name, category, cost_price, selling_price,
          product_stocks (quantity)
        `
        )
        .range(pStart, pStart + pLimit - 1);

      if (error) throw error;
      if (!batch || batch.length === 0) break;
      products.push(...batch);
      if (batch.length < pLimit) break;
      pStart += pLimit;
    }

    // Only products currently in stock can be "non-moving" (zero stock is just out-of-stock)
    const productInfo: Record<string, any> = {};
    products.forEach((p: any) => {
      const stockQty = (p.product_stocks || []).reduce(
        (s: number, st: any) => s + (Number(st.quantity) || 0),
        0
      );
      if (stockQty <= 0) return;
      productInfo[p.id] = {
        id: p.id,
        name: p.name,
        sku: p.sku || "",
        category: p.category || "",
        supplierName: p.supplier_name || "Unknown Supplier",
        costPrice: Number(p.cost_price) || 0,
        sellingPrice: Number(p.selling_price) || 0,
        stockQty,
      };
    });

    const candidateIds = Object.keys(productInfo);

    // 2. Fetch order items within the selected date range to find which products sold
    const orderItems: any[] = [];
    let iStart = 0;
    const iLimit = 1000;
    while (true) {
      const { data: batch, error } = await supabaseAdmin
        .from("order_items")
        .select(
          `
          id, quantity, product_id,
          order:orders!inner (
            id, status, is_inter_branch, order_date, created_at,
            customer:customers (shop_name)
          )
        `
        )
        .gte("order.order_date", `${fromDate}T00:00:00.000Z`)
        .lte("order.order_date", `${toDate}T23:59:59.999Z`)
        .range(iStart, iStart + iLimit - 1);

      if (error) throw error;
      if (!batch || batch.length === 0) break;
      orderItems.push(...batch);
      if (batch.length < iLimit) break;
      iStart += iLimit;
    }

    const soldInRange = new Set<string>();
    orderItems.forEach((item: any) => {
      const order = item.order;
      if (!order) return;
      if (order.status !== "Delivered" && order.status !== "Completed") return;
      if (isInterBranch(order)) return;
      const qty = Number(item.quantity) || 0;
      if (qty > 0) soldInRange.add(item.product_id);
    });

    // Non-moving = still in stock, but nothing qualifying sold in the selected range
    const nonMovingIds = candidateIds.filter((id) => !soldInRange.has(id));

    // 3. Look up the last time each non-moving product sold (all-time), for context
    const lastSoldMap: Record<string, string> = {};
    const CHUNK_SIZE = 200;
    for (let i = 0; i < nonMovingIds.length; i += CHUNK_SIZE) {
      const chunk = nonMovingIds.slice(i, i + CHUNK_SIZE);
      let lStart = 0;
      const lLimit = 1000;
      while (true) {
        const { data: batch, error } = await supabaseAdmin
          .from("order_items")
          .select(
            `
            product_id,
            order:orders!inner (
              status, is_inter_branch, order_date, created_at,
              customer:customers (shop_name)
            )
          `
          )
          .in("product_id", chunk)
          .range(lStart, lStart + lLimit - 1);

        if (error) throw error;
        if (!batch || batch.length === 0) break;

        batch.forEach((item: any) => {
          const order = item.order;
          if (!order) return;
          if (order.status !== "Delivered" && order.status !== "Completed") return;
          if (isInterBranch(order)) return;
          const date = order.order_date || order.created_at;
          if (!date) return;
          const pid = item.product_id;
          if (!lastSoldMap[pid] || date > lastSoldMap[pid]) {
            lastSoldMap[pid] = date;
          }
        });

        if (batch.length < lLimit) break;
        lStart += lLimit;
      }
    }

    // 4. Group non-moving products by supplier
    const msPerDay = 1000 * 60 * 60 * 24;
    const supplierMap: Record<string, { name: string; products: any[] }> = {};

    nonMovingIds.forEach((id) => {
      const p = productInfo[id];
      const supplier = p.supplierName;
      if (!supplierMap[supplier]) {
        supplierMap[supplier] = { name: supplier, products: [] };
      }

      const lastSoldDate = lastSoldMap[id] ? lastSoldMap[id].split("T")[0] : null;
      const daysSinceLastSale = lastSoldDate
        ? Math.floor((now.getTime() - new Date(lastSoldDate).getTime()) / msPerDay)
        : null;

      supplierMap[supplier].products.push({
        id: p.id,
        name: p.name,
        sku: p.sku,
        category: p.category,
        stockQty: p.stockQty,
        costPrice: p.costPrice,
        sellingPrice: p.sellingPrice,
        stockCostValue: p.stockQty * p.costPrice,
        stockSellingValue: p.stockQty * p.sellingPrice,
        lastSoldDate,
        daysSinceLastSale,
      });
    });

    const suppliers = Object.values(supplierMap)
      .map((s) => {
        const productList = s.products.sort(
          (a, b) => b.stockCostValue - a.stockCostValue
        );
        const totalStockQty = productList.reduce((sum, p) => sum + p.stockQty, 0);
        const totalStockCostValue = productList.reduce(
          (sum, p) => sum + p.stockCostValue,
          0
        );
        const totalStockSellingValue = productList.reduce(
          (sum, p) => sum + p.stockSellingValue,
          0
        );
        return {
          name: s.name,
          productCount: productList.length,
          totalStockQty,
          totalStockCostValue,
          totalStockSellingValue,
          products: productList,
        };
      })
      .sort((a, b) => b.totalStockCostValue - a.totalStockCostValue);

    const totals = suppliers.reduce(
      (acc, s) => {
        acc.supplierCount += 1;
        acc.productCount += s.productCount;
        acc.totalStockQty += s.totalStockQty;
        acc.totalStockCostValue += s.totalStockCostValue;
        acc.totalStockSellingValue += s.totalStockSellingValue;
        return acc;
      },
      {
        supplierCount: 0,
        productCount: 0,
        totalStockQty: 0,
        totalStockCostValue: 0,
        totalStockSellingValue: 0,
      }
    );

    return NextResponse.json({ fromDate, toDate, suppliers, totals });
  } catch (error: any) {
    console.error("Non-moving report API error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
