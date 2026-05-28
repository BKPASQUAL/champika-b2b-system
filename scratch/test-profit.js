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

console.log("Supabase URL:", supabaseUrl);

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

async function main() {
  const fromDate = "2026-05-01";
  const toDate = "2026-05-31";
  const COUNTED_STATUSES = ["Delivered", "Completed"];

  // 1. All invoices in the period
  const { data: allInvoices, error: allInvError } = await supabaseAdmin
    .from("invoices")
    .select(`
      id, invoice_no, manual_invoice_no, total_amount, due_amount, status,
      order:orders!inner (
        order_id, status, created_at, order_date, business_id,
        customer:customers (id, shop_name)
      )
    `)
    .gte("order.created_at", fromDate)
    .lte("order.created_at", toDate);

  if (allInvError) {
    console.error("allInvoices error:", allInvError);
    return;
  }

  console.log(`Total invoices found in date range: ${allInvoices.length}`);

  const invoicedOrderIds = new Set();
  allInvoices.forEach(inv => {
    if (inv.order && COUNTED_STATUSES.includes(inv.order.status)) {
      invoicedOrderIds.add(inv.order.order_id);
    }
  });

  console.log("Invoiced Order IDs set size:", invoicedOrderIds.size);
  console.log("Is ORD-1779890001939 in set?", invoicedOrderIds.has("ORD-1779890001939"));

  // 2. Order items with pagination
  const orderItems = [];
  let start = 0;
  const limit = 1000;
  while (true) {
    console.log(`Fetching batch starting at ${start}...`);
    const { data: batch, error: itemsError } = await supabaseAdmin
      .from("order_items")
      .select(`
        id, quantity, unit_price, actual_unit_cost, total_price,
        product:products (id, name, sku),
        order:orders!inner (
          id, order_id, status, created_at, order_date, business_id,
          customer:customers (id, shop_name)
        )
      `)
      .gte("order.created_at", fromDate)
      .lte("order.created_at", toDate)
      .range(start, start + limit - 1);

    if (itemsError) {
      console.error("orderItems error:", itemsError);
      return;
    }

    if (!batch || batch.length === 0) break;
    orderItems.push(...batch);
    if (batch.length < limit) break;
    start += limit;
  }

  console.log(`Total order items found in date range: ${orderItems.length}`);

  const matchItems = orderItems.filter(item => item.order?.order_id === "ORD-1779890001939");
  console.log("Items for ORD-1779890001939 in orderItems query:", matchItems.length);
  if (matchItems.length > 0) {
    console.log(JSON.stringify(matchItems, null, 2));
  } else {
    // If not found, let's find that order itself in the database and see its created_at
    const { data: ord } = await supabaseAdmin
      .from("orders")
      .select("order_id, created_at, status")
      .eq("order_id", "ORD-1779890001939")
      .single();
    console.log("Order from DB:", ord);
  }
}

main();
