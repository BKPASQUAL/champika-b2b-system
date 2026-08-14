import { Client } from "pg";
import fs from "fs";
import path from "path";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

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

async function runMigration() {
  const sql = fs.readFileSync(path.join(process.cwd(), "create-receipt-books-tables.sql"), "utf-8");
  const dbPass = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const regions = [
    "aws-0-ap-southeast-1.pooler.supabase.com",
    "aws-0-ap-south-1.pooler.supabase.com",
    "aws-0-eu-central-1.pooler.supabase.com",
    "aws-0-us-east-1.pooler.supabase.com",
  ];

  for (const host of regions) {
    const connStr = `postgresql://postgres.khsileqvitdeudkmvqvo:${dbPass}@${host}:6543/postgres`;
    console.log("Trying host:", host);
    const client = new Client({
      connectionString: connStr,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 3000,
    });
    try {
      await client.connect();
      console.log("SUCCESSFULLY CONNECTED TO HOST:", host);
      await client.query(sql);
      console.log("SUCCESS: Migration completed!");
      await client.end();
      return;
    } catch (err: any) {
      console.log("Host", host, "error:", err.message);
      try { await client.end(); } catch {}
    }
  }
}

runMigration();
