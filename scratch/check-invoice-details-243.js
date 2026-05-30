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

async function checkInvoice(invoiceNo) {
  console.log(`\n=================== Checking Invoice: ${invoiceNo} ===================`);
  const { data: invoices, error } = await supabaseAdmin
    .from("invoices")
    .select(`
      id, invoice_no, total_amount, status,
      order:orders (
        id, order_id, order_date, customer:customers(shop_name),
        items:order_items (
          id, quantity, free_quantity, unit_price, actual_unit_cost, total_price, claim_status,
          product:products (id, name, sku, supplier_name)
        )
      )
    `)
    .eq("invoice_no", invoiceNo);

  if (error) {
    console.error("Error:", error);
    return;
  }

  invoices.forEach(inv => {
    console.log("Invoice details:", {
      id: inv.id,
      invoice_no: inv.invoice_no,
      total_amount: inv.total_amount,
      status: inv.status,
      customer: inv.order?.customer?.shop_name,
      date: inv.order?.order_date
    });

    if (inv.order && inv.order.items) {
      console.log("\nItems:");
      inv.order.items.forEach((item, index) => {
        console.log(`[Item ${index + 1}]`, {
          product: item.product?.name,
          supplier: item.product?.supplier_name,
          qty: item.quantity,
          free_qty: item.free_quantity,
          unit_price: item.unit_price,
          actual_unit_cost: item.actual_unit_cost,
          total_price: item.total_price,
          claim_status: item.claim_status,
          calculated_cost: item.quantity * item.actual_unit_cost,
          loss: item.total_price - (item.quantity * item.actual_unit_cost)
        });
      });
    }
  });
}

async function main() {
  await checkInvoice("CHD-0243");
}

main();
