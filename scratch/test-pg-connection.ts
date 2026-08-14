import { Client } from "pg";
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

async function testConn() {
  const sql = fs.readFileSync(path.join(process.cwd(), "create-receipt-books-tables.sql"), "utf-8");

  // Let's test Supabase Pooler standard string formats:
  // Supabase pooler host for ap-southeast-1 or global
  const connectionStrings = [
    // 1. Direct DB connection
    `postgresql://postgres:${process.env.SUPABASE_SERVICE_ROLE_KEY}@db.khsileqvitdeudkmvqvo.supabase.co:5432/postgres`,
    // 2. Transaction Pooler (port 6543) with username postgres.khsileqvitdeudkmvqvo
    `postgresql://postgres.khsileqvitdeudkmvqvo:${process.env.SUPABASE_SERVICE_ROLE_KEY}@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?sslmode=require`,
    // 3. Session Pooler (port 5432)
    `postgresql://postgres.khsileqvitdeudkmvqvo:${process.env.SUPABASE_SERVICE_ROLE_KEY}@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres?sslmode=require`,
  ];

  for (const connStr of connectionStrings) {
    console.log("Trying:", connStr.replace(process.env.SUPABASE_SERVICE_ROLE_KEY!, "*****"));
    const client = new Client({ connectionString: connStr, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 4000 });
    try {
      await client.connect();
      console.log("SUCCESSFULLY CONNECTED!");
      await client.query(sql);
      console.log("DDL executed successfully!");
      await client.end();
      return;
    } catch (e: any) {
      console.log("Failed:", e.message);
      try { await client.end(); } catch {}
    }
  }
}

testConn();
