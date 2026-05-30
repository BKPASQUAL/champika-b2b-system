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
  // Find customer ID for Safe Electricals
  const { data: customerData } = await supabaseAdmin
    .from("customers")
    .select("id, shop_name")
    .ilike("shop_name", "%Safe Electrical%")
    .limit(1);

  if (!customerData || customerData.length === 0) {
    console.log("Safe Electricals not found");
    return;
  }
  const cid = customerData[0].id;
  console.log(`Checking all invoices and order items for Customer ID: ${cid} (${customerData[0].shop_name})`);

  const { data: invoices, error } = await supabaseAdmin
    .from("invoices")
    .select(`
      id, invoice_no, total_amount, status,
      order:orders (
        id, order_id, order_date,
        items:order_items (
          id, quantity, free_quantity, unit_price, actual_unit_cost, total_price, claim_status,
          product:products (name, supplier_name)
        )
      )
    `)
    .eq("order.customer_id", cid);

  if (error) {
    console.error("Error:", error);
    return;
  }

  console.log(`Found ${invoices?.length || 0} invoices:`);
  invoices.forEach(inv => {
    let totalFree = 0;
    let itemsCount = 0;
    inv.order?.items?.forEach(item => {
      totalFree += Number(item.free_quantity) || 0;
      itemsCount++;
    });

    console.log({
      invoiceNo: inv.invoice_no,
      orderId: inv.order?.order_id,
      amount: inv.total_amount,
      items: itemsCount,
      totalFreeIssues: totalFree,
      status: inv.status
    });
  });
}

main();
