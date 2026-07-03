import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { BUSINESS_IDS } from "@/app/config/business-constants";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const url = new URL(request.url);
    const businessId = url.searchParams.get("businessId");

    // 1. Fetch Location Details
    const { data: location, error: locError } = await supabaseAdmin
      .from("locations")
      .select("*, businesses(name)")
      .eq("id", id)
      .single();

    if (locError) throw new Error("Location not found");

    // 2. Fetch Stocks for this Location
    const includeAll = url.searchParams.get("includeAll") === "true";

    // ✅ Updated: Use !inner join to allow filtering on product fields
    const stocks: any[] = [];
    let page = 0;
    const pageSize = 1000;
    while (true) {
      let query = supabaseAdmin
        .from("product_stocks")
        .select(
          `
          quantity,
          damaged_quantity,
          last_updated,
          products!inner (
            id,
            sku,
            name,
            category,
            unit_of_measure,
            selling_price,
            cost_price,
            actual_cost_price,
            supplier_name,
            retail_only
          )
        `,
        )
        .eq("location_id", id)
        .range(page * pageSize, (page + 1) * pageSize - 1);

      // When includeAll=true (e.g. damage reporting), show all products with a stock record
      // Otherwise only show products that have stock > 0
      if (!includeAll) {
        query = query.or("quantity.gt.0,damaged_quantity.gt.0");
      }

      // ✅ Apply agency supplier filter if requested
      if (businessId === BUSINESS_IDS.WIREMAN_AGENCY) {
        query = query.ilike("products.supplier_name", "%Wireman%");
      } else if (businessId === BUSINESS_IDS.SIERRA_AGENCY) {
        query = query.ilike("products.supplier_name", "%Sierra%");
      } else if (businessId === BUSINESS_IDS.ORANGE_AGENCY) {
        query = query.ilike("products.supplier_name", "%Orange%");
      }

      const { data: pageStocks, error: stockError } = await query;
      if (stockError) throw stockError;
      if (!pageStocks || pageStocks.length === 0) break;
      stocks.push(...pageStocks);
      if (pageStocks.length < pageSize) break;
      page++;
    }

    // 3. Calculate Stats
    const safeStocks = stocks || [];

    // Total Items = Good + Damaged
    const totalItems = safeStocks.reduce(
      (sum, item) => sum + Number(item.quantity),
      0,
    );
    const totalDamaged = safeStocks.reduce(
      (sum, item) => sum + Number(item.damaged_quantity || 0),
      0,
    );

    const totalValue = safeStocks.reduce(
      (sum, item: any) =>
        sum + Number(item.quantity) * (item.products?.actual_cost_price || item.products?.cost_price || 0),
      0,
    );

    return NextResponse.json({
      location: {
        ...location,
        businessName: location.businesses?.name || "Main Warehouse",
      },
      stocks: safeStocks.map((stockItem: any) => ({
        ...stockItem.products, // Spread product details
        quantity: stockItem.quantity,
        damagedQuantity: stockItem.damaged_quantity || 0, // Map damage qty
        lastUpdated: stockItem.last_updated,
        value:
          Number(stockItem.quantity) * (stockItem.products?.actual_cost_price || stockItem.products?.cost_price || 0),
      })),
      stats: {
        totalItems,
        totalDamaged,
        totalValue,
      },
    });
  } catch (error: any) {
    console.error("Inventory API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
