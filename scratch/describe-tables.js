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
  const tables = ["products", "suppliers", "product_stocks", "commission_rules", "purchases", "purchase_items"];
  for (const table of tables) {
    console.log(`\n--- Structure of table: ${table} ---`);
    const { data, error } = await supabaseAdmin
      .from(table)
      .select("*")
      .limit(1);
    if (error) {
      console.error(`Error fetching from ${table}:`, error.message);
    } else if (data && data.length > 0) {
      console.log(Object.keys(data[0]));
    } else {
      console.log(`No records in ${table} to inspect columns.`);
    }
  }
}

main();
