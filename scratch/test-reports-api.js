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

  try {
    console.log("1. Fetching loading sheets...");
    const { data: loadingSheets, error: loadsError } = await supabaseAdmin
      .from("loading_sheets")
      .select(`
        id, load_id, lorry_number, loading_date, status,
        driver:profiles!loading_sheets_driver_id_fkey(full_name)
      `)
      .gte("loading_date", fromDate)
      .lte("loading_date", toDate);

    if (loadsError) {
      console.error("loadsError:", loadsError);
      return;
    }
    console.log(`Loading sheets count: ${loadingSheets?.length}`);

    console.log("2. Fetching orders...");
    let ordersQuery = supabaseAdmin
      .from("orders")
      .select(`
        id, order_id, status, created_at, sales_rep_id, load_id,
        customer:customers (id, shop_name, owner_name, business_id, business:businesses(id, name)),
        rep:profiles!orders_sales_rep_id_fkey (id, full_name),
        items:order_items (
          id, quantity, total_price, actual_unit_cost,
          product:products (id, name, cost_price, selling_price, category)
        )
      `)
      .gte("created_at", fromDate)
      .lte("created_at", toDate)
      .eq("status", "Delivered");

    const { data: orders, error: ordersError } = await ordersQuery;
    if (ordersError) {
      console.error("ordersError:", ordersError);
      return;
    }
    console.log(`Orders count: ${orders?.length}`);

    console.log("3. Fetching expenses...");
    let expensesQuery = supabaseAdmin
      .from("expenses")
      .select("id, amount, category, expense_date, business_id, load_id")
      .gte("expense_date", fromDate)
      .lte("expense_date", toDate);

    const { data: expenses, error: expensesError } = await expensesQuery;
    if (expensesError) {
      console.error("expensesError:", expensesError);
      return;
    }
    console.log(`Expenses count: ${expenses?.length}`);

    console.log("4. Fetching losses...");
    const { data: losses, error: lossesError } = await supabaseAdmin
      .from("inventory_returns")
      .select(`
        id, return_number, quantity, created_at, status, reason,
        product:products (id, name, cost_price, category),
        customer:customers (id, shop_name, assigned_rep_id)
      `)
      .eq("status", "Business Loss")
      .gte("created_at", fromDate)
      .lte("created_at", toDate);

    if (lossesError) {
      console.error("lossesError:", lossesError);
      return;
    }
    console.log(`Losses count: ${losses?.length}`);

    console.log("All queries executed successfully!");

  } catch (err) {
    console.error("Execution error:", err);
  }
}

main();
