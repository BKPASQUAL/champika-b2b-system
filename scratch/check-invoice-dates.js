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
  const { data: invoices, error } = await supabaseAdmin
    .from("invoices")
    .select(`
      id, invoice_no, manual_invoice_no, total_amount, created_at,
      order:orders (
        order_id, status, created_at, order_date
      )
    `)
    .in("manual_invoice_no", ["8558", "8569", "8570", "8567", "8535", "8536"]);

  if (error) {
    console.error(error);
    return;
  }

  console.log("Invoices retrieved:");
  console.log(JSON.stringify(invoices, null, 2));
}

main();
