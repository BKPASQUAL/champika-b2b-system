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
  console.log("Checking products in catalog for supplier 'Orange (Orel Corporation)'...");
  const { data: products, error } = await supabaseAdmin
    .from("products")
    .select("id, name, sku, cost_price, selling_price, supplier_name")
    .eq("supplier_name", "Orange (Orel Corporation)");

  if (error) {
    console.error("Error:", error);
    return;
  }

  console.log(`Found ${products?.length || 0} products:`);
  products.forEach(p => {
    if (p.name.includes("MCB") || p.name.includes("RCD")) {
      console.log({
        name: p.name,
        cost: p.cost_price,
        sell: p.selling_price,
        ratio: (p.selling_price / p.cost_price - 1) * 100
      });
    }
  });
}

main();
