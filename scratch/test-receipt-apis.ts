import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

const envPath = path.join(process.cwd(), ".env.local");
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
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function testReceiptBookFlow() {
  console.log("Checking DB tables for receipt_books...");
  const { data: books, error: bErr } = await supabase.from("receipt_books").select("*").limit(5);
  if (bErr) {
    console.error("Receipt books query notice:", bErr.message);
  } else {
    console.log("Receipt books table exists! Total sample rows:", books?.length);
  }

  console.log("Checking DB tables for receipt_book_audits...");
  const { data: audits, error: aErr } = await supabase.from("receipt_book_audits").select("*").limit(5);
  if (aErr) {
    console.error("Receipt book audits query notice:", aErr.message);
  } else {
    console.log("Receipt book audits table exists! Total sample rows:", audits?.length);
  }

  console.log("Checking payments table for receipt_number column...");
  const { data: payments, error: pErr } = await supabase.from("payments").select("id, receipt_number, receipt_book_id").limit(1);
  if (pErr) {
    console.error("Payments receipt_number check notice:", pErr.message);
  } else {
    console.log("Payments receipt_number column check success! Sample:", payments);
  }
}

testReceiptBookFlow();
