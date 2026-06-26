const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

const envPath = path.join(__dirname, "..", ".env.local");
const envContent = fs.readFileSync(envPath, "utf-8");
const envVars = {};
envContent.split("\n").forEach((line) => {
  const match = line.match(/^\s*([^#\s=]+)\s*=\s*(.*)\s*$/);
  if (match) {
    envVars[match[1]] = match[2].trim().replace(/^['"]|['"]$/g, '');
  }
});

const supabaseUrl = envVars["NEXT_PUBLIC_SUPABASE_URL"];
const supabaseServiceRoleKey = envVars["SUPABASE_SERVICE_ROLE_KEY"];
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

const BUSINESS_IDS = {
  ORANGE_AGENCY: "50a514e1-ee70-4e6d-a698-1630d8ed04e2",
  CHAMPIKA_RETAIL: "a3ca43f3-06d4-4871-852c-3a40cfdbf023",
  CHAMPIKA_DISTRIBUTION: "e770d62c-d4bd-4bbc-ba9e-ccb07d7aa9bb",
  WIREMAN_AGENCY: "094b649e-be59-4e2b-b709-7e36ad1ef280",
  SIERRA_AGENCY: "41b55e39-2edb-43ac-9877-dabd23902335",
};

async function main() {
  const businessId = BUSINESS_IDS.CHAMPIKA_DISTRIBUTION;

  try {
    // 1. Fetch Locations
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

    const locationIds = locations.map((l) => l.id);

    // 2. Fetch Product Stocks (Filter by the relevant locations)
    const stocks = [];
    let stocksPage = 0;
    const pageSize = 1000;
    while (true) {
      let stocksQuery = supabaseAdmin
        .from("product_stocks")
        .select(
          "location_id, quantity, product_id, products!inner(cost_price, actual_cost_price, selling_price, supplier_name)",
        )
        .range(stocksPage * pageSize, (stocksPage + 1) * pageSize - 1);

      if (locationIds.length > 0) {
        stocksQuery = stocksQuery.in("location_id", locationIds);
      } else {
        stocksQuery = stocksQuery.in("location_id", []);
      }

      if (businessId === BUSINESS_IDS.WIREMAN_AGENCY) {
        stocksQuery = stocksQuery.ilike("products.supplier_name", "%Wireman%");
      } else if (businessId === BUSINESS_IDS.SIERRA_AGENCY) {
        stocksQuery = stocksQuery.ilike("products.supplier_name", "%Sierra%");
      } else if (businessId === BUSINESS_IDS.ORANGE_AGENCY) {
        stocksQuery = stocksQuery.ilike("products.supplier_name", "%Orange%");
      }

      const { data, error: stockError } = await stocksQuery;
      if (stockError) throw stockError;
      if (!data || data.length === 0) break;
      stocks.push(...data);
      if (data.length < pageSize) break;
      stocksPage++;
    }

    // 3. Fetch All Products (Master Catalog)
    const products = [];
    let productsPage = 0;
    while (true) {
      let productsQuery = supabaseAdmin
        .from("products")
        .select(
          "id, name, sku, category, stock_quantity, damaged_quantity, min_stock_level, unit_of_measure, supplier_name, images, mrp, selling_price",
        )
        .order("name")
        .range(productsPage * pageSize, (productsPage + 1) * pageSize - 1);

      if (businessId === BUSINESS_IDS.WIREMAN_AGENCY) {
        productsQuery = productsQuery.ilike("supplier_name", "%Wireman%");
      } else if (businessId === BUSINESS_IDS.SIERRA_AGENCY) {
        productsQuery = productsQuery.ilike("supplier_name", "%Sierra%");
      } else if (businessId === BUSINESS_IDS.ORANGE_AGENCY) {
        productsQuery = productsQuery.ilike("supplier_name", "%Orange%");
      }

      const { data: pageProducts, error: prodError } = await productsQuery;
      if (prodError) throw prodError;
      if (!pageProducts || pageProducts.length === 0) break;
      products.push(...pageProducts);
      if (pageProducts.length < pageSize) break;
      productsPage++;
    }

    // Process data
    const productStockMap = new Map();
    if (businessId) {
      stocks.forEach((stock) => {
        const current = productStockMap.get(stock.product_id) || 0;
        productStockMap.set(stock.product_id, current + Number(stock.quantity));
      });
    }

    const processedProducts = products.map((p) => {
      if (businessId) {
        const businessStock = productStockMap.get(p.id) || 0;
        return {
          ...p,
          stock_quantity: businessStock,
        };
      }
      return p;
    });

    console.log("Total processed products:", processedProducts.length);
    const yakiProducts = processedProducts.filter(p => p.name.toLowerCase().includes("yaki"));
    console.log("Yaki products returned in processedProducts:", yakiProducts.length);
    console.log(JSON.stringify(yakiProducts, null, 2));

  } catch (err) {
    console.error("Error:", err);
  }
}

main();
