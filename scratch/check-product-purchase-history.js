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
  console.log("Checking purchase history for product 'f634d83f-4b58-4d16-bee5-35edf5034af9' (Orange Sigma MCB 2 Pole 32A)...");
  
  const { data: purchaseItems, error } = await supabaseAdmin
    .from("purchase_items")
    .select(`
      id, quantity, unit_cost, total_cost, actual_unit_cost, mrp,
      purchase:purchases (invoice_no, purchase_date, total_amount, paid_amount)
    `)
    .eq("product_id", "f634d83f-4b58-4d16-bee5-35edf5034af9")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error:", error);
    return;
  }

  console.log(`Found ${purchaseItems?.length || 0} purchase items:`);
  purchaseItems.forEach(item => {
    console.log({
      invoiceNo: item.purchase?.invoice_no,
      date: item.purchase?.purchase_date,
      qty: item.quantity,
      unitCost: item.unit_cost,
      actualUnitCost: item.actual_unit_cost,
      totalCost: item.total_cost
    });
  });
}

main();
