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
  console.log("Checking all invoices for customer 'Safe Electricals'...");
  const { data: invoices, error } = await supabaseAdmin
    .from("invoices")
    .select(`
      id, invoice_no, total_amount, status,
      order:orders (
        order_date, business_id,
        items:order_items (
          quantity, free_quantity, unit_price, actual_unit_cost, total_price,
          product:products (name, supplier_name)
        )
      )
    `)
    .eq("order.customer_id", "4a356ae1-db1e-4df4-9eae-9051ab6bcd03") // Safe Electricals (from check-free-issues)
    .order("invoice_no");

  if (error) {
    console.error("Error:", error);
    // Let's try selecting by shop_name instead
    return;
  }

  console.log("Invoices count:", invoices?.length);
}

// Let's search customer first to get correct ID
async function searchCustomer() {
  const { data } = await supabaseAdmin
    .from("customers")
    .select("id, shop_name")
    .ilike("shop_name", "%Safe Electricals%")
    .limit(5);
  console.log("Safe Electricals customer profile:", data);
  if (data && data.length > 0) {
    const cid = data[0].id;
    const { data: invoices } = await supabaseAdmin
      .from("invoices")
      .select(`
        id, invoice_no, total_amount, status,
        order:orders (
          order_date, business_id,
          items:order_items (
            quantity, free_quantity, unit_price, actual_unit_cost, total_price,
            product:products (name, supplier_name)
          )
        )
      `)
      .eq("order.customer_id", cid);

    console.log(`Found ${invoices?.length || 0} invoices for ${data[0].shop_name}:`);
    invoices.forEach(inv => {
      let totalCost = 0;
      inv.order?.items.forEach(item => {
        totalCost += (Number(item.quantity) || 0) * (Number(item.actual_unit_cost) || 0);
      });
      console.log({
        invoiceNo: inv.invoice_no,
        date: inv.order?.order_date,
        amount: inv.total_amount,
        cost: totalCost,
        profit: inv.total_amount - totalCost,
        status: inv.status
      });
    });
  }
}

searchCustomer();
