import fs from "fs";
import path from "path";

const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  const envConfig = fs.readFileSync(envPath, "utf8");
  for (let line of envConfig.split("\n")) {
    line = line.trim();
    if (!line || line.startsWith("#")) continue;
    const idx = line.indexOf("=");
    if (idx > 0) {
      const key = line.substring(0, idx).trim();
      let val = line.substring(idx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      process.env[key] = val;
    }
  }
}

async function checkDuplicates() {
  const { supabaseAdmin } = await import("../lib/supabase-admin");

  const { data: allCustomers, error } = await supabaseAdmin
    .from("customers")
    .select("id, shop_name, owner_name, route, business_id, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error:", error);
    return;
  }

  console.log(`Total customers in DB: ${allCustomers?.length}`);

  // Group by shop_name and business_id
  const map: Record<string, any[]> = {};
  for (const c of allCustomers || []) {
    const key = `${c.business_id} :: ${c.shop_name}`;
    if (!map[key]) map[key] = [];
    map[key].push(c);
  }

  for (const [key, list] of Object.entries(map)) {
    if (list.length > 1) {
      console.log(`DUPLICATE FOUND for [${key}]: ${list.length} records!`);
      list.forEach((item, index) => {
        console.log(`  [${index + 1}] ID: ${item.id}, CreatedAt: ${item.created_at}, Route: ${item.route}`);
      });
    }
  }
}

checkDuplicates();
