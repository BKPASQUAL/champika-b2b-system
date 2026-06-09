// scratch/count-products.mjs
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";

let envContent = "";
try {
  envContent = readFileSync(resolve(process.cwd(), ".env.local"), "utf-8");
} catch {
  console.log("No .env.local file");
  process.exit(1);
}

const env = {};
for (const line of envContent.split("\n")) {
  const [k, ...rest] = line.split("=");
  if (k && rest.length) env[k.trim()] = rest.join("=").trim().replace(/^"|"$/g, "");
}

const url = env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(url, key);

async function main() {
  const { count, error } = await supabase
    .from("products")
    .select("*", { count: "exact", head: true })
    .eq("is_active", true);

  console.log("Total active products:", count, "Error:", error);
}
main();
