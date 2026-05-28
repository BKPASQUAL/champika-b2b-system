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
    .gte("order.order_date", fromDate)
    .lte("order.order_date", toDate);

  if (error) {
    console.error("Error fetching invoices:", error);
    return;
  }

  console.log(`Found ${invoices?.length || 0} total invoices`);
  
  const matches = invoices.filter(inv => {
    const shopName = (inv.order?.customer?.shop_name || "").toLowerCase();
    return shopName.includes("champika") || shopName.includes("direct");
  });

  console.log(`Found ${matches.length} matching invoices:`);
  matches.forEach(m => {
    console.log({
      invoiceNo: m.manual_invoice_no || m.invoice_no,
      shopName: m.order?.customer?.shop_name,
      businessId: m.order?.business_id,
      amount: m.total_amount,
      status: m.status
    });
  });
}

main();
