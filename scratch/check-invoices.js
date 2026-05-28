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
  const fromDate = "2026-05-01";
  const toDate = "2026-05-31";

  const { data: invoices, error } = await supabaseAdmin
    .from("invoices")
    .select(`
      id, invoice_no, manual_invoice_no, total_amount, due_amount, status,
      order:orders!inner (
        order_id, status, created_at, order_date, business_id,
        customer:customers (id, shop_name)
      )
    `)
    .eq("order.business_id", "e770d62c-d4bd-4bbc-ba9e-ccb07d7aa9bb") // Champika Hardware - Distribution
    .gte("order.order_date", fromDate)
    .lte("order.order_date", toDate);

  if (error) {
    console.error("Error fetching invoices:", error);
    return;
  }

  console.log(`Found ${invoices?.length || 0} invoices for Champika Hardware - Distribution`);
  
  const customerBreakdown = {};
  invoices.forEach((inv) => {
    const shopName = inv.order?.customer?.shop_name || "Unknown";
    if (!customerBreakdown[shopName]) {
      customerBreakdown[shopName] = { count: 0, total: 0 };
    }
    customerBreakdown[shopName].count++;
    customerBreakdown[shopName].total += Number(inv.total_amount) || 0;
  });

  console.log("Customer breakdown (before any filtering):");
  console.log(customerBreakdown);
}

main();
