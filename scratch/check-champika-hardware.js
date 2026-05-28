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
  console.log("Checking invoices for customer 'Champika Hardware' (id: '07e1ab95-a096-4141-9403-a69d54fcc4a6')...");
  const { data: invoices, error } = await supabaseAdmin
    .from("invoices")
    .select(`
      id, invoice_no, manual_invoice_no, total_amount, due_amount, status,
      order:orders!inner (
        order_id, status, created_at, order_date, business_id,
        customer:customers (id, shop_name)
      )
    `)
    .eq("order.customer_id", "07e1ab95-a096-4141-9403-a69d54fcc4a6");

  if (error) {
    console.error("Error fetching invoices:", error);
    return;
  }

  console.log(`Found ${invoices?.length || 0} invoices for 'Champika Hardware'`);
  if (invoices && invoices.length > 0) {
    invoices.forEach(m => {
      console.log({
        invoiceNo: m.manual_invoice_no || m.invoice_no,
        date: m.order?.order_date || m.order?.created_at,
        businessId: m.order?.business_id,
        amount: m.total_amount,
        status: m.status
      });
    });
  }
}

main();
