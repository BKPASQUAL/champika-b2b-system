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

    // 2. Determine Business Context
    const effectiveBusinessId = businessId || location.business_id;

    // 3. Fetch Stocks for this Location
    const includeAll = url.searchParams.get("includeAll") === "true";

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
        .order("id")
        .range(page * pageSize, (page + 1) * pageSize - 1);

      // When includeAll=true (e.g. damage reporting), show all products with a stock record
      // Otherwise show products that have non-zero stock or damaged stock
      if (!includeAll) {
        query = query.or("quantity.neq.0,damaged_quantity.gt.0");
      }

      // Apply agency supplier filter if requested or if location belongs to an agency
      if (effectiveBusinessId === BUSINESS_IDS.WIREMAN_AGENCY) {
        query = query.ilike("products.supplier_name", "%Wireman%");
      } else if (effectiveBusinessId === BUSINESS_IDS.SIERRA_AGENCY) {
        query = query.ilike("products.supplier_name", "%Sierra%");
      } else if (effectiveBusinessId === BUSINESS_IDS.ORANGE_AGENCY) {
        query = query.ilike("products.supplier_name", "%Orange%");
      }

      const { data: pageStocks, error: stockError } = await query;
      if (stockError) throw stockError;
      if (!pageStocks || pageStocks.length === 0) break;
      stocks.push(...pageStocks);
      if (pageStocks.length < pageSize) break;
      page++;
    }

    // When includeAll=true, if some catalog products don't have stock rows yet, merge them
    let safeStocks = stocks;
    if (includeAll) {
      const existingProductIds = new Set(stocks.map((s) => s.products?.id).filter(Boolean));
      let prodPage = 0;
      const allProducts: any[] = [];

      while (true) {
        let prodQuery = supabaseAdmin
          .from("products")
          .select(
            `
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
          `
          )
          .order("name")
          .range(prodPage * pageSize, (prodPage + 1) * pageSize - 1);

        if (effectiveBusinessId === BUSINESS_IDS.WIREMAN_AGENCY) {
          prodQuery = prodQuery.ilike("supplier_name", "%Wireman%");
        } else if (effectiveBusinessId === BUSINESS_IDS.SIERRA_AGENCY) {
          prodQuery = prodQuery.ilike("supplier_name", "%Sierra%");
        } else if (effectiveBusinessId === BUSINESS_IDS.ORANGE_AGENCY) {
          prodQuery = prodQuery.ilike("supplier_name", "%Orange%");
        }

        const { data: prods, error: prodErr } = await prodQuery;
        if (prodErr || !prods || prods.length === 0) break;
        allProducts.push(...prods);
        if (prods.length < pageSize) break;
        prodPage++;
      }

      for (const prod of allProducts) {
        if (!existingProductIds.has(prod.id)) {
          safeStocks.push({
            quantity: 0,
            damaged_quantity: 0,
            last_updated: null,
            products: prod,
          });
        }
      }
    }

    // 4. Calculate Stats
    const rawItems = safeStocks.reduce(
      (sum, item) => sum + Number(item.quantity || 0),
      0,
    );
    const rawDamaged = safeStocks.reduce(
      (sum, item) => sum + Number(item.damaged_quantity || 0),
      0,
    );

    const rawValue = safeStocks.reduce(
      (sum, item: any) =>
        sum + Number(item.quantity || 0) * (item.products?.actual_cost_price || item.products?.cost_price || 0),
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
          Math.round(
            Number(stockItem.quantity || 0) *
              (stockItem.products?.actual_cost_price || stockItem.products?.cost_price || 0) *
              100,
          ) / 100,
      })),
      stats: {
        totalItems: Math.round(rawItems * 100) / 100,
        totalDamaged: Math.round(rawDamaged * 100) / 100,
        totalValue: Math.round(rawValue * 100) / 100,
      },
    });
  } catch (error: any) {
    console.error("Inventory API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
