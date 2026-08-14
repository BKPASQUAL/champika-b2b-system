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

async function inspectPayments() {
  const { supabaseAdmin } = await import("../lib/supabase-admin");
  const { data: samplePayments, error } = await supabaseAdmin
    .from("payments")
    .select(`
      *,
      invoices (
        id,
        invoice_no,
        order_id,
        orders (
          id,
          order_id,
          business_id,
          businesses (
            id,
            name
          )
        )
      )
    `)
    .limit(5);

  console.log("Error:", error);
  if (samplePayments && samplePayments.length > 0) {
    console.log("Keys on payment row:", Object.keys(samplePayments[0]));
    console.log("Sample Payment 0:", JSON.stringify(samplePayments[0], null, 2));
  }
}

inspectPayments();
