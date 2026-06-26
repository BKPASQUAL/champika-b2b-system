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
  console.log("Searching for 'yaki' in products...");
  const { data: products, error: pError } = await supabaseAdmin
    .from("products")
    .select("id, name, sku, category, supplier_name, is_active")
    .or("name.ilike.%yaki%,supplier_name.ilike.%yaki%,category.ilike.%yaki%");

  if (pError) {
    console.error("Error searching products:", pError.message);
  } else {
    console.log(`Found ${products.length} products:`);
    console.log(JSON.stringify(products, null, 2));
  }

  console.log("\nSearching for 'yaki' in suppliers...");
  const { data: suppliers, error: sError } = await supabaseAdmin
    .from("suppliers")
    .select("id, name, company_name")
    .or("name.ilike.%yaki%,company_name.ilike.%yaki%");

  if (sError) {
    console.error("Error searching suppliers:", sError.message);
  } else {
    console.log(`Found ${suppliers.length} suppliers:`);
    console.log(JSON.stringify(suppliers, null, 2));
  }
}

main();
