// scratch/test-query.mjs
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
  // Let's find location_assignments for a rep first
  const { data: assignments } = await supabase
    .from("location_assignments")
    .select("location_id, user_id")
    .limit(5);
  
  if (!assignments || assignments.length === 0) {
    console.log("No location assignments found");
    return;
  }
  
  const userId = assignments[0].user_id;
  const locationIds = assignments.filter(a => a.user_id === userId).map(a => a.location_id);
  console.log(`Testing for user ${userId} and locations:`, locationIds);

  console.log("\n--- TEST 1: Using PostgREST filter on nested table with .in() ---");
  try {
    const { data: res1, error: err1 } = await supabase
      .from("products")
      .select(`
        id,
        name,
        product_stocks (
          quantity,
          location_id
        )
      `)
      .eq("is_active", true)
      .ilike("name", "%Connector Bars%")
      .in("product_stocks.location_id", locationIds);

    console.log("Error 1:", err1?.message);
    console.log("Results 1 count:", res1?.length);
    console.log("Results 1 sample:", JSON.stringify(res1, null, 2));
  } catch (e) {
    console.error("Test 1 threw:", e);
  }

  console.log("\n--- TEST 2: Without PostgREST filter on nested table, filtering in JS ---");
  try {
    const { data: res2, error: err2 } = await supabase
      .from("products")
      .select(`
        id,
        name,
        product_stocks (
          quantity,
          location_id
        )
      `)
      .eq("is_active", true)
      .ilike("name", "%Connector Bars%");

    console.log("Error 2:", err2?.message);
    console.log("Results 2 count:", res2?.length);
    
    // JS filtering
    const locationSet = new Set(locationIds);
    const filteredRes2 = res2?.map(p => {
      let stock = 0;
      if (p.product_stocks) {
        p.product_stocks.forEach(ps => {
          if (locationSet.has(ps.location_id)) {
            stock += ps.quantity;
          }
        });
      }
      return { id: p.id, name: p.name, stock };
    });
    console.log("JS Filtered Results 2 sample:", JSON.stringify(filteredRes2, null, 2));
  } catch (e) {
    console.error("Test 2 threw:", e);
  }
}
main();
