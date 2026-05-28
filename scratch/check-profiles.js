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
  console.log("Fetching profiles with role 'rep'...");
  const { data: profiles, error } = await supabaseAdmin
    .from("profiles")
    .select("id, full_name, email, role");

  if (error) {
    console.error("Error fetching profiles:", error);
    return;
  }

  console.log("Rep profiles:");
  console.log(profiles);
}

main();
