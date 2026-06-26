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
  console.log("--- Fetching all Locations ---");
  const { data: locations, error: locError } = await supabaseAdmin
    .from("locations")
    .select("id, name, business_id, is_active");
  
  if (locError) {
    console.error("Loc error:", locError);
  } else {
    console.log(JSON.stringify(locations, null, 2));
  }

  console.log("\n--- Fetching Product Stocks for Yaki products ---");
  // Yaki product IDs:
  // '37866675-7a14-49e8-bd8e-5ecbef2e338e'
  // '4979db1f-f8f5-4ade-98b8-3a643e404080'
  // 'fbbfe165-a259-4eee-981c-0f1a5334a24b'
  // '1ce40da3-ee56-4db8-9dc3-d0a86e5c51da'
  // 'e97591b0-2c32-4ab8-afb8-e6b86eb5353e'
  
  const { data: stocks, error: stockError } = await supabaseAdmin
    .from("product_stocks")
    .select("id, product_id, location_id, quantity, products(name)")
    .in("product_id", [
      '37866675-7a14-49e8-bd8e-5ecbef2e338e',
      '4979db1f-f8f5-4ade-98b8-3a643e404080',
      'fbbfe165-a259-4eee-981c-0f1a5334a24b',
      '1ce40da3-ee56-4db8-9dc3-d0a86e5c51da',
      'e97591b0-2c32-4ab8-afb8-e6b86eb5353e'
    ]);

  if (stockError) {
    console.error("Stock error:", stockError);
  } else {
    console.log(JSON.stringify(stocks, null, 2));
  }
}

main();
