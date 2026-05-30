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
  console.log("Checking detail fields for CHD-0242 order items...");
  const { data: invoices, error } = await supabaseAdmin
    .from("invoices")
    .select(`
      invoice_no,
      order:orders (
        items:order_items (
          id, quantity, free_quantity, unit_price, actual_unit_price, actual_unit_cost, total_price,
          discount_percent, discount_amount, commission_earned, claim_status,
          product:products (name)
        )
      )
    `)
    .eq("invoice_no", "CHD-0242")
    .single();

  if (error) {
    console.error("Error:", error);
    return;
  }

  invoices.order.items.forEach(item => {
    console.log({
      product: item.product?.name,
      qty: item.quantity,
      freeQty: item.free_quantity,
      unitPrice: item.unit_price,
      actualUnitPrice: item.actual_unit_price,
      actualUnitCost: item.actual_unit_cost,
      totalPrice: item.total_price,
      discountPercent: item.discount_percent,
      discountAmount: item.discount_amount,
      commission: item.commission_earned,
      claimStatus: item.claim_status
    });
  });
}

main();
