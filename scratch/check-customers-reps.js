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
  console.log("Checking customers with 'Champika' or 'Direct'...");
  const { data: customers, error: custError } = await supabaseAdmin
    .from("customers")
    .select("id, shop_name, owner_name, business_id");

  if (custError) {
    console.error("Cust Error:", custError);
    return;
  }

  console.log("Total customers found:", customers.length);
  const filtered = customers.filter(c => 
    c.shop_name.toLowerCase().includes("champika") || 
    c.shop_name.toLowerCase().includes("direct")
  );
  console.log("Filtered customers:", filtered);

  console.log("\nChecking businesses...");
  const { data: businesses, error: bizError } = await supabaseAdmin
    .from("businesses")
    .select("*");
  console.log("Businesses in db:", businesses);
}

main();
