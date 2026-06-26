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
  console.log("Querying all columns of Yaki products...");
  const { data: products, error } = await supabaseAdmin
    .from("products")
    .select("*")
    .ilike("name", "%yaki%");
  
  if (error) {
    console.error(error);
  } else {
    console.log(JSON.stringify(products.map(p => ({
      id: p.id,
      name: p.name,
      sku: p.sku,
      retail_only: p.retail_only,
      is_active: p.is_active,
      supplier_name: p.supplier_name
    })), null, 2));
  }
}

main();
