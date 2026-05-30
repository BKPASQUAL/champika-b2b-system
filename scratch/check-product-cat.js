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
  console.log("Checking product details for 'f634d83f-4b58-4d16-bee5-35edf5034af9'...");
  const { data: product, error } = await supabaseAdmin
    .from("products")
    .select("id, name, category, sub_category, cost_price, selling_price")
    .eq("id", "f634d83f-4b58-4d16-bee5-35edf5034af9")
    .single();

  if (error) {
    console.error("Error:", error);
    return;
  }

  console.log("Product Details:", product);
}

main();
