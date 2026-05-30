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
  console.log("Checking if any Orange order items have free_quantity > 0...");
  const { data, error } = await supabaseAdmin
    .from("order_items")
    .select(`
      id, quantity, free_quantity, unit_price, actual_unit_cost, total_price, claim_status,
      product:products!inner (name, supplier_name),
      order:orders!inner (order_id, order_date, customer:customers(shop_name))
    `)
    .eq("product.supplier_name", "Orange (Orel Corporation)")
    .gt("free_quantity", 0);

  if (error) {
    console.error("Error:", error);
    return;
  }

  console.log(`Found ${data?.length || 0} Orange order items with free_quantity > 0:`);
  data.forEach((item, i) => {
    console.log(`[${i + 1}]`, {
      orderId: item.order?.order_id,
      customer: item.order?.customer?.shop_name,
      product: item.product?.name,
      qty: item.quantity,
      freeQty: item.free_quantity,
      unitPrice: item.unit_price,
      cost: item.actual_unit_cost,
      claimStatus: item.claim_status
    });
  });
}

main();
