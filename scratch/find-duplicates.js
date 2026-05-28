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
  const orderIds = ["ORD-1779100361865", "ORD-1779100523718", "ORD-1779100546003", "ORD-1779101702373"];
  
  const { data: orders, error: ordError } = await supabaseAdmin
    .from("orders")
    .select(`
      id, order_id, status, created_at, order_date, total_amount, business_id,
      customer:customers (id, shop_name)
    `)
    .in("order_id", orderIds);

  if (ordError) {
    console.error("Error fetching orders:", ordError);
    return;
  }

  console.log("Orders found:");
  console.log(JSON.stringify(orders, null, 2));

  const { data: invoices, error: invError } = await supabaseAdmin
    .from("invoices")
    .select(`
      id, invoice_no, manual_invoice_no, total_amount, due_amount, status, created_at, order_id
    `)
    .in("order_id", orders.map(o => o.id));

  if (invError) {
    console.error("Error fetching invoices for orders:", invError);
    return;
  }

  console.log("\nInvoices for orders:");
  console.log(JSON.stringify(invoices, null, 2));
}

main();
