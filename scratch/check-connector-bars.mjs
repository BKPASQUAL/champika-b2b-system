// scratch/check-connector-bars.mjs
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";

// Read .env.local manually
let envContent = "";
try {
  envContent = readFileSync(resolve(process.cwd(), ".env.local"), "utf-8");
} catch {
  console.log("No .env.local file found");
  process.exit(1);
}

// Parse env
const env = {};
for (const line of envContent.split("\n")) {
  const [k, ...rest] = line.split("=");
  if (k && rest.length) env[k.trim()] = rest.join("=").trim().replace(/^"|"$/g, "");
}

const url = env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  console.log("Searching for products containing 'Connector Bars'...");
  const { data: products, error: pError } = await supabase
    .from("products")
    .select("id, name, is_active, supplier_name")
    .ilike("name", "%Connector Bars%");

  if (pError) {
    console.error("Products error:", pError.message);
    return;
  }

  console.log(`Found ${products.length} products:`);
  console.log(JSON.stringify(products, null, 2));

  if (products.length === 0) return;

  const productIds = products.map(p => p.id);

  console.log("\nChecking product_stocks for these products...");
  const { data: stocks, error: sError } = await supabase
    .from("product_stocks")
    .select("product_id, quantity, location_id")
    .in("product_id", productIds);

  if (sError) {
    console.error("Stocks error:", sError.message);
    return;
  }

  console.log(`Found ${stocks.length} stock entries:`);
  console.log(JSON.stringify(stocks, null, 2));
}

main();
