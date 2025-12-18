import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // 1. Fetch all Locations
    const { data: locations, error: locError } = await supabaseAdmin
      .from("locations")
      .select("id, name, is_active, business_id, businesses(name)")
      .order("name");

    if (locError) throw locError;

    // 2. Fetch all Product Stocks (Breakdown)
    const { data: stocks, error: stockError } = await supabaseAdmin
      .from("product_stocks")
      .select("location_id, quantity, products(cost_price, selling_price)");

    if (stockError) throw stockError;

    // 3. Fetch All Products (Master Catalog)
    // FIX: Added 'damaged_quantity' to the select list
    const { data: products, error: prodError } = await supabaseAdmin
      .from("products")
      .select(
        "id, name, sku, category, stock_quantity, damaged_quantity, min_stock_level, unit_of_measure"
      )
      .order("name");

    if (prodError) throw prodError;

    // --- Process Data ---

    // A. Calculate Stats Per Location
    const locationStats = locations.map((loc: any) => {
      const locStocks = stocks.filter((s: any) => s.location_id === loc.id);

      const totalItems = locStocks.reduce(
        (sum: number, s: any) => sum + Number(s.quantity),
        0
      );
      const totalValue = locStocks.reduce(
        (sum: number, s: any) =>
          sum + Number(s.quantity) * (s.products?.selling_price || 0),
        0
      );

      return {
        id: loc.id,
        name: loc.name,
        business: loc.businesses?.name || "Main Warehouse",
        totalItems,
        totalValue,
        status: loc.is_active ? "Active" : "Inactive",
      };
    });

    // B. Calculate Global Stats
    const totalInventoryValue = locationStats.reduce(
      (sum: number, l: any) => sum + l.totalValue,
      0
    );
    const lowStockCount = products.filter(
      (p: any) => (p.stock_quantity || 0) <= (p.min_stock_level || 0)
    ).length;
    const outOfStockCount = products.filter(
      (p: any) => (p.stock_quantity || 0) === 0
    ).length;

    return NextResponse.json({
      locations: locationStats,
      products: products,
      stats: {
        totalValue: totalInventoryValue,
        lowStock: lowStockCount,
        outOfStock: outOfStockCount,
        totalProducts: products.length,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
