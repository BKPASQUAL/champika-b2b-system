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
  const { data: ordersData, error: ordersError } = await supabaseAdmin
    .from("orders")
    .select("*")
    .limit(1);

  if (ordersError) {
    console.error("Orders Error:", ordersError);
  } else if (ordersData && ordersData.length > 0) {
    console.log("Orders schema fields:", Object.keys(ordersData[0]));
  } else {
    console.log("No orders found");
  }

  const { data: invoicesData, error: invoicesError } = await supabaseAdmin
    .from("invoices")
    .select("*")
    .limit(1);

  if (invoicesError) {
    console.error("Invoices Error:", invoicesError);
  } else if (invoicesData && invoicesData.length > 0) {
    console.log("Invoices schema fields:", Object.keys(invoicesData[0]));
  } else {
    console.log("No invoices found");
  }
}

main();
