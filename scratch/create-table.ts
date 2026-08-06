import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

const envPath = path.join(__dirname, "..", ".env.local");
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
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function main() {
  console.log("Checking invoice_unlock_requests table...");
  const { data, error } = await supabase.from("invoice_unlock_requests").select("id").limit(1);
  if (error) {
    console.log("Table does not exist or error:", error.message);
    console.log("Attempting SQL execute via rpc or raw query...");
    // Create via RPC exec_sql if available, else warn
    const { error: rpcErr } = await supabase.rpc("exec_sql", {
      sql_query: `
        CREATE TABLE IF NOT EXISTS public.invoice_unlock_requests (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
            requested_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
            requested_by_name TEXT,
            reason TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending',
            approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
            approved_by_name TEXT,
            approved_at TIMESTAMPTZ,
            expires_at TIMESTAMPTZ,
            unlock_token TEXT UNIQUE,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        );
      `
    });
    if (rpcErr) {
      console.log("RPC exec_sql failed (expected if not configured):", rpcErr.message);
    } else {
      console.log("Table created via RPC!");
    }
  } else {
    console.log("invoice_unlock_requests table is ready!");
  }
}

main();
