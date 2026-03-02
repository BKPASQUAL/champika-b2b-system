// Quick script to list all businesses from Supabase
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";

// Read .env.local manually
let envContent = "";
try {
  envContent = readFileSync(resolve(process.cwd(), ".env.local"), "utf-8");
} catch {
  try {
    envContent = readFileSync(resolve(process.cwd(), ".env"), "utf-8");
  } catch {
    console.log("No .env file found, using process.env");
  }
}

// Parse env
const env = {};
for (const line of envContent.split("\n")) {
  const [k, ...rest] = line.split("=");
  if (k && rest.length) env[k.trim()] = rest.join("=").trim().replace(/^"|"$/g, "");
}

const url = env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data, error } = await supabase.from("businesses").select("id, name, description");
if (error) {
  console.error("Error:", error.message);
} else {
  console.log("\n=== ALL BUSINESSES IN DATABASE ===");
  for (const b of data) {
    console.log(`ID: ${b.id}`);
    console.log(`Name: ${b.name}`);
    console.log(`Description: ${b.description || "-"}`);
    console.log("---");
  }
}
