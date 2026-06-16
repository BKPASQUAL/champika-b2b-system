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
    .select("id, invoice_no, total_amount, paid_amount, status, customer_id, customers(shop_name)");

  if (error) {
    console.error("Error fetching invoices:", error);
    return;
  }

  const matching = invoices.filter(inv => {
    if (inv.status === "Paid") return false;
    const due = Number(inv.total_amount) - Number(inv.paid_amount || 0);
    return due > -0.01 && due < 100;
  });

  console.log(`Found ${matching.length} invoices with due amount < 100 LKR (and status !== 'Paid'):`);
  matching.forEach(inv => {
    const due = Number(inv.total_amount) - Number(inv.paid_amount || 0);
    console.log(`- Invoice: ${inv.invoice_no}, Shop: ${inv.customers?.shop_name}, Total: ${inv.total_amount}, Paid: ${inv.paid_amount}, Due: ${due}, Status: ${inv.status}`);
  });
}

main();
