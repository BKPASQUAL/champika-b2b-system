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
  console.log("Checking fields for CHD-0095 order items...");
  const { data: invoices, error } = await supabaseAdmin
    .from("invoices")
    .select(`
      order:orders!inner (
        id, order_id,
        items:order_items (
          id, quantity, free_quantity, unit_price, actual_unit_cost, total_price,
          commission_earned, actual_unit_price, discount_percent, discount_amount,
          product:products (name)
        )
      )
    `)
    .eq("invoice_no", "CHD-0095")
    .single();

  if (error) {
    console.error("Error:", error);
    return;
  }

  invoices.order.items.forEach(item => {
    console.log({
      product: item.product?.name,
      qty: item.quantity,
      unitPrice: item.unit_price,
      actualUnitPrice: item.actual_unit_price,
      actualUnitCost: item.actual_unit_cost,
      totalPrice: item.total_price,
      commission: item.commission_earned,
      discountPercent: item.discount_percent,
      discountAmount: item.discount_amount
    });
  });
}

main();
