// app/api/inventory/route.ts

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { BUSINESS_IDS } from "@/app/config/business-constants";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const businessId = url.searchParams.get("businessId");

    // 1. Fetch Locations
    // Logic: If businessId is provided, fetch locations for that business OR locations with no business_id (Main Warehouse)
    let locationQuery = supabaseAdmin
      .from("locations")
      .select("id, name, is_active, business_id, businesses(name)")
      .order("name");

    if (businessId) {
      locationQuery = locationQuery.or(
        `business_id.eq.${businessId},business_id.is.null`,
      );
    }

    const { data: locations, error: locError } = await locationQuery;
    if (locError) throw locError;

    // Get list of relevant location IDs to filter stocks
    const locationIds = locations.map((l) => l.id);

    // 2. Fetch Product Stocks (Filter by the relevant locations)
    // ✅ Updated: Use inner join on products to allow filtering by supplier_name
    let stocksQuery = supabaseAdmin
      .from("product_stocks")
      .select(
        "location_id, quantity, product_id, products!inner(cost_price, selling_price, supplier_name)",
      );

    if (locationIds.length > 0) {
      stocksQuery = stocksQuery.in("location_id", locationIds);
    } else {
      // Fallback if no locations found
      stocksQuery = stocksQuery.in("location_id", []);
    }

    // ✅ Apply Wireman Filter to Stocks
    // This ensures calculated stats (Total Value, etc.) only count Wireman items
    if (businessId === BUSINESS_IDS.WIREMAN_AGENCY) {
      stocksQuery = stocksQuery.ilike("products.supplier_name", "%Wireman%");
    }

    const { data: stocks, error: stockError } = await stocksQuery;
    if (stockError) throw stockError;

    // 3. Fetch All Products (Master Catalog)
    let productsQuery = supabaseAdmin
      .from("products")
      .select(
        "id, name, sku, category, stock_quantity, damaged_quantity, min_stock_level, unit_of_measure, supplier_name",
      )
      .order("name");

    // ✅ Apply Wireman Filter to Master Product List
    // This ensures the main inventory table only shows Wireman items
    if (businessId === BUSINESS_IDS.WIREMAN_AGENCY) {
      productsQuery = productsQuery.ilike("supplier_name", "%Wireman%");
    }

    const { data: products, error: prodError } = await productsQuery;

    if (prodError) throw prodError;

    // --- Process Data ---

    // Map stocks to products for recalculation
    const productStockMap = new Map<string, number>();
    if (businessId) {
      stocks.forEach((stock: any) => {
        const current = productStockMap.get(stock.product_id) || 0;
        productStockMap.set(stock.product_id, current + Number(stock.quantity));
      });
    }

    // A. Calculate Stats Per Location
    const locationStats = locations.map((loc: any) => {
      const locStocks = stocks.filter((s: any) => s.location_id === loc.id);

      const totalItems = locStocks.reduce(
        (sum: number, s: any) => sum + Number(s.quantity),
        0,
      );
      const totalValue = locStocks.reduce(
        (sum: number, s: any) =>
          sum + Number(s.quantity) * (s.products?.selling_price || 0),
        0,
      );

      return {
        id: loc.id,
        name: loc.name,
        // If business is null, it's the Main Warehouse
        business: loc.businesses?.name || "Main Warehouse",
        totalItems,
        totalValue,
        status: loc.is_active ? "Active" : "Inactive",
      };
    });

    // B. Process Products (Overwrite global stock with filtered stock)
    const processedProducts = products.map((p: any) => {
      if (businessId) {
        const businessStock = productStockMap.get(p.id) || 0;
        return {
          ...p,
          stock_quantity: businessStock,
        };
      }
      return p;
    });

    // C. Calculate Global Stats
    const totalInventoryValue = locationStats.reduce(
      (sum: number, l: any) => sum + l.totalValue,
      0,
    );
    const lowStockCount = processedProducts.filter(
      (p: any) => (p.stock_quantity || 0) <= (p.min_stock_level || 0),
    ).length;
    const outOfStockCount = processedProducts.filter(
      (p: any) => (p.stock_quantity || 0) === 0,
    ).length;

    return NextResponse.json({
      locations: locationStats,
      products: processedProducts,
      stats: {
        totalValue: totalInventoryValue,
        lowStock: lowStockCount,
        outOfStock: outOfStockCount,
        totalProducts: processedProducts.length,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
