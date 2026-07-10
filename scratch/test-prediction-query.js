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

async function main() {
  const supplierName = "China";
  console.log("1. Querying supplier by name...");
  const { data: supplierInfo, error: supErr } = await supabaseAdmin
    .from("suppliers")
    .select("id, name, supplier_id")
    .eq("name", supplierName)
    .maybeSingle();

  console.log("Supplier result:", { supplierInfo, error: supErr?.message });

  console.log("2. Querying products by supplier name...");
  const { data: primaryProducts, error: primaryError } = await supabaseAdmin
    .from("products")
    .select(`
      id, name, sku, supplier_name, cost_price, selling_price, category, min_stock_level,
      product_stocks (quantity)
    `)
    .eq("supplier_name", supplierName);

  console.log("Products result count:", primaryProducts?.length, "Error:", primaryError?.message);

  const productIds = primaryProducts ? primaryProducts.map(p => p.id) : [];
  if (productIds.length > 0) {
    console.log("3. Querying order items for products using product.supplier_name...");
    const fromDate = "2026-01-01";
    const toDate = "2026-07-10";
    const { data: orderItems, error: itemsError } = await supabaseAdmin
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
      .limit(10);

    console.log("Order items result count:", orderItems?.length, "Error:", itemsError?.message);
    if (itemsError) {
      console.log("Full error details:", JSON.stringify(itemsError, null, 2));
    }
  }

  console.log("4. Querying active suppliers...");
  const { data: allSuppliers, error: allSupErr } = await supabaseAdmin
    .from("suppliers")
    .select("id, name")
    .eq("status", "Active")
    .order("name", { ascending: true });

  console.log("Active suppliers count:", allSuppliers?.length, "Error:", allSupErr?.message);
}

main();
