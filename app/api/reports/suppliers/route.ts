import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), 0, 1).toISOString();
    const lastDay = new Date(now.getFullYear(), 11, 31).toISOString();
    const fromDate = searchParams.get("from") || firstDay;
    const toDate = searchParams.get("to") || lastDay;

    // 1. All products with current stock
    const { data: products, error: productsError } = await supabaseAdmin
      .from("products")
      .select(`
        id, name, sku, supplier_name, cost_price, selling_price, category,
        product_stocks (quantity)
      `);

    if (productsError) throw productsError;

    // 2. Delivered order items in date range
    const { data: orderItems, error: itemsError } = await supabaseAdmin
      .from("order_items")
      .select(`
        id, quantity, free_quantity, unit_price, actual_unit_cost, total_price,
        product:products!inner (id, name, sku, supplier_name, category),
        order:orders!inner (status, created_at)
      `)
      .eq("order.status", "Delivered")
      .gte("order.created_at", fromDate)
      .lte("order.created_at", toDate);

    if (itemsError) throw itemsError;

    // 3. Build supplier → products stock map
    const supplierStockMap: Record<string, {
      products: Record<string, {
        id: string; name: string; sku: string; category: string;
        costPrice: number; sellingPrice: number;
        stockQty: number; stockCostValue: number; stockSellingValue: number;
        unitsSold: number; freeQty: number; revenue: number; cost: number; profit: number;
      }>;
    }> = {};

    (products || []).forEach((p: any) => {
      const supplier = p.supplier_name || "Unknown Supplier";
      const stockQty = (p.product_stocks || []).reduce(
        (s: number, st: any) => s + (Number(st.quantity) || 0), 0
      );
      const costPrice = Number(p.cost_price) || 0;
      const sellingPrice = Number(p.selling_price) || 0;

      if (!supplierStockMap[supplier]) supplierStockMap[supplier] = { products: {} };
      supplierStockMap[supplier].products[p.id] = {
        id: p.id,
        name: p.name,
        sku: p.sku || "",
        category: p.category || "",
        costPrice,
        sellingPrice,
        stockQty,
        stockCostValue: stockQty * costPrice,
        stockSellingValue: stockQty * sellingPrice,
        unitsSold: 0,
        freeQty: 0,
        revenue: 0,
        cost: 0,
        profit: 0,
      };
    });

    // 4. Aggregate sales into supplier/product map
    (orderItems || []).forEach((item: any) => {
      const supplier = item.product?.supplier_name || "Unknown Supplier";
      const pid = item.product?.id;
      if (!pid) return;

      const qty = Number(item.quantity) || 0;
      const freeQty = Number(item.free_quantity) || 0;
      const revenue = Number(item.total_price) || 0;
      const cost = qty * (Number(item.actual_unit_cost) || 0);

      if (!supplierStockMap[supplier]) supplierStockMap[supplier] = { products: {} };
      if (!supplierStockMap[supplier].products[pid]) {
        supplierStockMap[supplier].products[pid] = {
          id: pid,
          name: item.product.name,
          sku: item.product.sku || "",
          category: item.product.category || "",
          costPrice: 0,
          sellingPrice: 0,
          stockQty: 0,
          stockCostValue: 0,
          stockSellingValue: 0,
          unitsSold: 0,
          freeQty: 0,
          revenue: 0,
          cost: 0,
          profit: 0,
        };
      }

      const prod = supplierStockMap[supplier].products[pid];
      prod.unitsSold += qty;
      prod.freeQty += freeQty;
      prod.revenue += revenue;
      prod.cost += cost;
      prod.profit += revenue - cost;
    });

    // 5. Build final supplier summaries
    const suppliers = Object.entries(supplierStockMap).map(([name, data]) => {
      const productList = Object.values(data.products).map((p) => ({
        ...p,
        margin: p.revenue > 0 ? ((p.profit / p.revenue) * 100) : 0,
      })).sort((a, b) => b.revenue - a.revenue);

      const totalStock = productList.reduce((s, p) => s + p.stockQty, 0);
      const totalStockCostValue = productList.reduce((s, p) => s + p.stockCostValue, 0);
      const totalStockSellingValue = productList.reduce((s, p) => s + p.stockSellingValue, 0);
      const totalUnitsSold = productList.reduce((s, p) => s + p.unitsSold, 0);
      const totalRevenue = productList.reduce((s, p) => s + p.revenue, 0);
      const totalCost = productList.reduce((s, p) => s + p.cost, 0);
      const totalProfit = totalRevenue - totalCost;

      return {
        name,
        productCount: productList.length,
        totalStock,
        totalStockCostValue,
        totalStockSellingValue,
        totalUnitsSold,
        totalRevenue,
        totalCost,
        totalProfit,
        margin: totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0,
        products: productList,
      };
    }).sort((a, b) => b.totalRevenue - a.totalRevenue);

    return NextResponse.json({ suppliers });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
