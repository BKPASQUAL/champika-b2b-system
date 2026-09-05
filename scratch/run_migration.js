const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

const envPath = path.join(__dirname, "..", ".env.local");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  envContent.split("\n").forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      const parts = trimmed.split("=");
      if (parts.length >= 2) {
        const key = parts[0].trim();
        const val = parts.slice(1).join("=").trim().replace(/^["']|["']$/g, '');
        process.env[key] = val;
      }
    }
  });
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  const sql = fs.readFileSync(path.join(__dirname, "..", "create-invoice-books-tables.sql"), "utf-8");
  console.log("Migration SQL loaded.");

  // Test selecting from invoice_books to see if table exists
  const { data, error } = await supabase.from("invoice_books").select("*").limit(1);
  if (error) {
    console.log("Table check error (table might not exist yet):", error.message);
    // Try running raw sql query via rpc or postgres if available
    const { error: rpcErr } = await supabase.rpc("exec_sql", { query: sql });
    if (rpcErr) {
      console.log("RPC exec_sql error:", rpcErr.message);
    } else {
      console.log("Migration executed via exec_sql.");
    }
  } else {
    console.log("Table invoice_books already exists!", data);
  }
}

main().catch(console.error);
