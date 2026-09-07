import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

const envPath = path.join(process.cwd(), ".env.local");
const envContent = fs.readFileSync(envPath, "utf-8");
const env: Record<string, string> = {};
envContent.split("\n").forEach((line) => {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith("#")) {
    const idx = trimmed.indexOf("=");
    if (idx !== -1) {
      env[trimmed.substring(0, idx).trim()] = trimmed.substring(idx + 1).trim();
    }
  }
});

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function main() {
  const { count } = await supabase.from("vehicle_locations").select("*", { count: "exact", head: true });
  console.log("Total vehicle_locations rows:", count);

  const { data: first } = await supabase.from("vehicle_locations").select("updated_at").order("updated_at", { ascending: true }).limit(1);
  const { data: last } = await supabase.from("vehicle_locations").select("updated_at").order("updated_at", { ascending: false }).limit(1);
  console.log("Earliest record:", first?.[0]?.updated_at);
  console.log("Latest record:", last?.[0]?.updated_at);
}

main().catch(console.error);
