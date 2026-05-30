const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

// Manually parse .env.local
const envPath = path.join(__dirname, "..", ".env.local");
const envContent = fs.readFileSync(envPath, "utf-8");
const envVars = {};
envContent.split("\n").forEach((line) => {
  const match = line.match(/^\s*([^#\s=]+)\s*=\s*(.*)\s*$/);
  if (match) {
    envVars[match[1]] = match[2].trim();
  }
});

const supabaseUrl = envVars["NEXT_PUBLIC_SUPABASE_URL"];
const supabaseServiceRoleKey = envVars["SUPABASE_SERVICE_ROLE_KEY"];

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

async function main() {
  console.log("Checking order_items with free_quantity > 0...");
  const { data: items, error } = await supabaseAdmin
    .from("order_items")
    .select(`
      id, quantity, free_quantity, unit_price, actual_unit_cost, total_price, claim_status,
      product:products (name, supplier_name),
      order:orders (order_id, status, order_date, business_id)
    `)
    .gt("free_quantity", 0)
    .limit(10);

  if (error) {
    console.error("Error fetching order items:", error);
    return;
  }

  console.log(`Found ${items?.length || 0} order items with free quantity:`);
  items.forEach(item => {
    console.log({
      id: item.id,
      product: item.product?.name,
      supplier: item.product?.supplier_name,
      qty: item.quantity,
      freeQty: item.free_quantity,
      cost: item.actual_unit_cost,
      claimStatus: item.claim_status || "Unclaimed"
    });
  });
}

main();
