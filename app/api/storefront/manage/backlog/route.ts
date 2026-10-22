import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

// GET /api/storefront/manage/backlog
// Aggregates out-of-stock items with active online demand or zero warehouse inventory
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const supplier = searchParams.get("supplier");

    // 1. Fetch active products with current stocks
    const { data: products, error: pError } = await supabaseAdmin
      .from("products")
      .select(`
        id,
        sku,
        name,
        category,
        brand,
        supplier_name,
        cost_price,
        selling_price,
        mrp,
        min_stock_level,
        stock_quantity,
        product_stocks (
          quantity
        )
      `)
      .eq("is_active", true);

    if (pError) throw pError;

    // 2. Fetch pending online orders to calculate online demand
    const { data: pendingOrders } = await supabaseAdmin
      .from("storefront_orders")
      .select("items")
      .in("order_status", ["Pending", "Confirmed", "Processing"]);

    const onlineDemandMap = new Map<string, number>();
    if (pendingOrders) {
      pendingOrders.forEach((o: any) => {
        const items = Array.isArray(o.items) ? o.items : [];
        items.forEach((item: any) => {
          const pid = item.productId || item.id;
          if (pid) {
            const current = onlineDemandMap.get(pid) || 0;
            onlineDemandMap.set(pid, current + Number(item.quantity || 1));
          }
        });
      });
    }

    // 3. Filter for products where stock is 0 or less than min_stock_level or has online demand
    const backlogItems: any[] = [];
    (products || []).forEach((p: any) => {
      const realStock = p.product_stocks && p.product_stocks.length > 0
        ? p.product_stocks.reduce((sum: number, s: any) => sum + (Number(s.quantity) || 0), 0)
        : Number(p.stock_quantity || 0);

      const minStock = Number(p.min_stock_level || 10);
      const onlineDemand = onlineDemandMap.get(p.id) || 0;

      // Condition: Out of stock (0), or below minimum stock, or online demand exceeds stock
      if (realStock <= 0 || realStock < minStock || onlineDemand > realStock) {
        const suggestedReorder = Math.max(minStock * 2, (minStock - realStock) + onlineDemand);
        backlogItems.push({
          id: p.id,
          sku: p.sku || "-",
          name: p.name,
          category: p.category || "General",
          brand: p.brand || p.supplier_name || "Generic",
          supplier: p.supplier_name || "",
          currentStock: realStock,
          minStock: minStock,
          onlineDemand: onlineDemand,
          suggestedReorder: suggestedReorder,
          costPrice: Number(p.cost_price || 0),
          sellingPrice: Number(p.selling_price || 0),
          estimatedCost: suggestedReorder * Number(p.cost_price || 0),
        });
      }
    });

    let result = backlogItems;
    if (supplier && supplier !== "all") {
      result = result.filter(item => 
        item.supplier.toLowerCase() === supplier.toLowerCase() || 
        item.brand.toLowerCase() === supplier.toLowerCase()
      );
    }

    // Sort by highest online demand first, then lowest stock
    result.sort((a, b) => b.onlineDemand - a.onlineDemand || a.currentStock - b.currentStock);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Backlog GET error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
