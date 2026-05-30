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
  console.log("Fetching all database table names...");
  const { data, error } = await supabaseAdmin.rpc("get_tables"); // Check if RPC exists
  if (error) {
    // If no RPC, let's query a known view or check schemas
    console.log("No get_tables RPC, trying query...");
    const { data: queryData, error: queryError } = await supabaseAdmin
      .from("products")
      .select("id")
      .limit(1);
    if (queryError) {
      console.error("Query Error:", queryError);
    } else {
      console.log("Supabase connection is active!");
    }
    return;
  }
  console.log("Tables:", data);
}

main();
