const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

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
  const { data: invoices, error } = await supabaseAdmin
    .from("invoices")
    .select("*, orders(*, customers(*))")
    .eq("invoice_no", "SI-0052");

  if (error) {
    console.error("Error fetching invoice:", error);
    return;
  }
  console.log("Invoice Details:", JSON.stringify(invoices, null, 2));
}

main();
