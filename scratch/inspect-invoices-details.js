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
  console.log("Inspecting columns details from information_schema...");
  const { data, error } = await supabaseAdmin.rpc("inspect_invoices_table");
  if (error) {
    // If the RPC doesn't exist, let's run a query using a generic sql function if available, or fetch schema information.
    console.log("RPC inspect_invoices_table failed, trying raw SQL query via postgrest or another way...");
    // Let's try to query information_schema directly using a select on a system view if allowed, or see what else we can do.
    const { data: cols, error: colsErr } = await supabaseAdmin
      .from("invoices")
      .select("total_amount, paid_amount, due_amount")
      .limit(5);
    console.log("Querying invoices data:", colsErr || cols);
  } else {
    console.log("Invoices metadata:", data);
  }
}

main();
