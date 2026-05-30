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
  console.log("Checking order-level and invoice-level fields for CHD-0095...");
  const { data: invoices, error } = await supabaseAdmin
    .from("invoices")
    .select(`
      id, invoice_no, total_amount, due_amount, status,
      order:orders!inner (
        id, order_id, status, created_at, order_date,
        extra_discount_percent, extra_discount_amount, total_amount,
        customer:customers (id, shop_name)
      )
    `)
    .eq("invoice_no", "CHD-0095")
    .single();

  if (error) {
    console.error("Error:", error);
    return;
  }

  console.log("Invoice Level details:");
  console.log({
    id: invoices.id,
    invoiceNo: invoices.invoice_no,
    totalAmount: invoices.total_amount,
    dueAmount: invoices.due_amount,
    status: invoices.status
  });

  const o = invoices.order;
  console.log("Order Level details:");
  console.log({
    id: o.id,
    orderId: o.order_id,
    status: o.status,
    date: o.order_date,
    extraDiscountPercent: o.extra_discount_percent,
    extraDiscountAmount: o.extra_discount_amount,
    totalAmount: o.total_amount,
    customer: o.customer?.shop_name
  });
}

main();
