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
  console.log("=== SUPPLIERS ===");
  const { data: suppliers, error: supErr } = await supabaseAdmin
    .from("suppliers")
    .select("id, supplier_id, name, category, status");
  if (supErr) console.error("Suppliers error:", supErr);
  else console.log("Suppliers count:", suppliers.length, "\n", suppliers);

  console.log("\n=== PRODUCT SUPPLIERS TABLE CHECK ===");
  const { data: prodSups, error: prodSupsErr } = await supabaseAdmin
    .from("product_suppliers")
    .select("*")
    .limit(5);
  if (prodSupsErr) {
    console.log("product_suppliers table error/not exists:", prodSupsErr.message);
  } else {
    console.log("product_suppliers sample:", prodSups);
  }

  console.log("\n=== HISTORICAL ORDERS / SALES DATE RANGE ===");
  const { data: dateRange, error: dateErr } = await supabaseAdmin
    .from("orders")
    .select("order_date")
    .order("order_date", { ascending: true });
  
  if (dateErr) {
    console.error("Orders date error:", dateErr);
  } else if (dateRange && dateRange.length > 0) {
    console.log("Total orders count:", dateRange.length);
    console.log("Earliest order date:", dateRange[0].order_date);
    console.log("Latest order date:", dateRange[dateRange.length - 1].order_date);
  } else {
    console.log("No orders found.");
  }

  console.log("\n=== INVOICES STATUS COUNT ===");
  const { data: invoices, error: invErr } = await supabaseAdmin
    .from("invoices")
    .select("status, total_amount");
  if (invErr) {
    console.error("Invoices error:", invErr);
  } else if (invoices) {
    const statuses = {};
    let total = 0;
    invoices.forEach(inv => {
      statuses[inv.status] = (statuses[inv.status] || 0) + 1;
      total += inv.total_amount || 0;
    });
    console.log("Invoices statuses:", statuses);
    console.log("Total invoice amount:", total);
  }

  console.log("\n=== PRODUCTS WITH SUPPLIER NAME ===");
  const { data: sampleProducts, error: prodErr } = await supabaseAdmin
    .from("products")
    .select("id, name, supplier_name, stock_quantity, min_stock_level")
    .limit(10);
  if (prodErr) console.error("Products error:", prodErr);
  else console.log("Sample products:", sampleProducts);
}

main();
