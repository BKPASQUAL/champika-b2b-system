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
  console.log("Fetching products with range(0, 2000)...");
  const { data, error } = await supabaseAdmin
    .from("products")
    .select("id, name")
    .order("name")
    .range(0, 2000);
  
  if (error) {
    console.error(error);
  } else {
    console.log("Total products fetched with range:", data.length);
    const yakiProducts = data.filter(p => p.name.toLowerCase().includes("yaki"));
    console.log("Yaki products found:", yakiProducts.length);
    console.log(yakiProducts);
  }
}

main();
