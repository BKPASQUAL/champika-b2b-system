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
  console.log("=== PURCHASES STATUS COUNT ===");
  const { data: purchases, error: purErr } = await supabaseAdmin
    .from("purchases")
    .select("status, payment_status, id");
  if (purErr) {
    console.error(purErr);
  } else {
    const statuses = {};
    purchases.forEach(p => {
      statuses[p.status] = (statuses[p.status] || 0) + 1;
    });
    console.log("Purchase Statuses:", statuses);
  }

  console.log("\n=== PURCHASES FOR CHINA SUPPLIER ===");
  // China supplier ID: e7d0a9d0-9f29-4c64-8470-4ad8488af771
  const { data: chinaPurchases, error: cpErr } = await supabaseAdmin
    .from("purchases")
    .select(`
      id, purchase_id, invoice_no, purchase_date, arrival_date, total_amount, status, payment_status,
      purchase_items (id, product_id, quantity, unit_cost)
    `)
    .eq("supplier_id", "e7d0a9d0-9f29-4c64-8470-4ad8488af771");

  if (cpErr) {
    console.error(cpErr);
  } else {
    console.log("China purchases count:", chinaPurchases.length);
    chinaPurchases.forEach(p => {
      const itemsCount = p.purchase_items ? p.purchase_items.length : 0;
      console.log(`Purchase ID: ${p.purchase_id} | Status: ${p.status} | Date: ${p.purchase_date} | Arrival: ${p.arrival_date} | Items: ${itemsCount}`);
    });
  }
}

main();
