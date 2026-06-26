// Let's implement the route logic directly here to see what Supabase returns.
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

async function checkRoute() {
  const businessId = "e770d62c-d4bd-4bbc-ba9e-ccb07d7aa9bb"; // Champika Distribution

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
  if (locError) {
    console.error("Loc error:", locError);
    return;
  }
  const locationIds = locations.map((l) => l.id);
  console.log("Locations:", locations.map(l => l.name));

  // 2. Fetch Product Stocks
  let stocksQuery = supabaseAdmin
    .from("product_stocks")
    .select(
      "location_id, quantity, product_id, products!inner(cost_price, actual_cost_price, selling_price, supplier_name)",
    );

  if (locationIds.length > 0) {
    stocksQuery = stocksQuery.in("location_id", locationIds);
  }

  const { data: stocks, error: stockError } = await stocksQuery;
  if (stockError) {
    console.error("Stock error:", stockError);
    return;
  }

  // 3. Fetch All Products
  let productsQuery = supabaseAdmin
    .from("products")
    .select(
      "id, name, sku, category, stock_quantity, damaged_quantity, min_stock_level, unit_of_measure, supplier_name, images, mrp, selling_price, is_active",
    )
    .order("name");

  const { data: products, error: prodError } = await productsQuery;
  if (prodError) {
    console.error("Prod error:", prodError);
    return;
  }

  // Filter products by 'yaki' to see what's returned
  const yakiProducts = products.filter(p => p.name.toLowerCase().includes("yaki"));
  console.log("\nAll Yaki products from DB 'products' query:", yakiProducts.map(p => ({ id: p.id, name: p.name, is_active: p.is_active })));
}

checkRoute();
