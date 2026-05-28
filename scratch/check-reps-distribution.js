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

  const { data: orders, error } = await supabaseAdmin
    .from("orders")
    .select(`
      id, order_id, total_amount, status, created_at, order_date, sales_rep_id,
      customer:customers (id, shop_name),
      rep:profiles!orders_sales_rep_id_fkey (id, full_name)
    `)
    .eq("business_id", "e770d62c-d4bd-4bbc-ba9e-ccb07d7aa9bb") // Champika Hardware - Distribution
    .eq("status", "Delivered")
    .gte("order_date", fromDate)
    .lte("order_date", toDate);

  if (error) {
    console.error("Error fetching orders:", error);
    return;
  }

  console.log(`Found ${orders?.length || 0} delivered orders for Champika Hardware - Distribution`);
  
  const repBreakdown = {};
  orders.forEach((o) => {
    const repName = o.rep?.full_name || "Direct Sales (No Rep)";
    if (!repBreakdown[repName]) {
      repBreakdown[repName] = { count: 0, total: 0 };
    }
    repBreakdown[repName].count++;
    repBreakdown[repName].total += Number(o.total_amount) || 0;
  });

  console.log("Rep breakdown:");
  console.log(repBreakdown);
}

main();
