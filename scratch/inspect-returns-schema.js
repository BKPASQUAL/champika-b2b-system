// scratch/inspect-returns-schema.js
const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

// Manually parse env file
const envPath = path.join(__dirname, "../.env.local");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  envContent.split("\n").forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      const parts = trimmed.split("=");
      if (parts.length >= 2) {
        const key = parts[0].trim();
        const val = parts.slice(1).join("=").trim();
        process.env[key] = val;
      }
    }
  });
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function inspect() {
  console.log("Checking columns of 'inventory_returns'...");
  const { data: cols, error: colsErr } = await supabase.rpc("inspect_table_cols", { table_name: "inventory_returns" });
  
  if (colsErr) {
    // If no RPC, let's query a single row to see its keys
    console.log("RPC inspect_table_cols not available, querying one row of inventory_returns...");
    const { data: row, error: rowErr } = await supabase.from("inventory_returns").select("*").limit(1);
    if (rowErr) {
      console.error("Failed to query row:", rowErr);
    } else {
      console.log("Keys in inventory_returns row:", row && row[0] ? Object.keys(row[0]) : "No rows found");
      console.log("Sample row:", row && row[0] ? row[0] : null);
    }
  } else {
    console.log("Columns:", cols);
  }

  // Also query a single row of orders and invoices to see their fields
  console.log("\nQuerying one row of orders...");
  const { data: orderRow, error: orderErr } = await supabase.from("orders").select("*").limit(1);
  if (orderErr) {
    console.error("Failed to query orders:", orderErr);
  } else {
    console.log("Sample order row:", orderRow && orderRow[0] ? orderRow[0] : null);
  }

  console.log("\nQuerying one row of invoices...");
  const { data: invRow, error: invErr } = await supabase.from("invoices").select("*").limit(1);
  if (invErr) {
    console.error("Failed to query invoices:", invErr);
  } else {
    console.log("Sample invoice row:", invRow && invRow[0] ? invRow[0] : null);
  }
}

inspect();
