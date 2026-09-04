const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const envPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envConfig = fs.readFileSync(envPath, 'utf8');
  envConfig.split('\n').forEach(line => {
    const [key, value] = line.split('=');
    if (key && value) {
      process.env[key.trim()] = value.trim().replace(/^["']|["']$/g, '');
    }
  });
}

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function verifySync() {
  const locationId = "0b68fd7b-6a40-496f-9279-0a003c26b211";

  // Simulate API /api/inventory (Overview) for Main Warehouse:
  const stocksOverview = [];
  let page = 0;
  while(true) {
    const { data } = await supabaseAdmin
      .from("product_stocks")
      .select("location_id, quantity, product_id, products!inner(cost_price, actual_cost_price)")
      .eq("location_id", locationId)
      .order("id")
      .range(page * 1000, (page + 1) * 1000 - 1);
    if (!data || data.length === 0) break;
    stocksOverview.push(...data);
    if (data.length < 1000) break;
    page++;
  }

  const overviewItems = Math.round(stocksOverview.reduce((sum, s) => sum + Number(s.quantity), 0) * 100) / 100;
  const overviewValue = Math.round(stocksOverview.reduce((sum, s) => sum + Number(s.quantity) * (s.products?.actual_cost_price || s.products?.cost_price || 0), 0) * 100) / 100;

  // Simulate API /api/inventory/[id] (Detail) with new condition (.or("quantity.neq.0,damaged_quantity.gt.0")):
  const stocksDetail = [];
  page = 0;
  while(true) {
    const { data } = await supabaseAdmin
      .from("product_stocks")
      .select("quantity, damaged_quantity, products!inner(cost_price, actual_cost_price)")
      .eq("location_id", locationId)
      .or("quantity.neq.0,damaged_quantity.gt.0")
      .order("id")
      .range(page * 1000, (page + 1) * 1000 - 1);
    if (!data || data.length === 0) break;
    stocksDetail.push(...data);
    if (data.length < 1000) break;
    page++;
  }

  const detailItems = Math.round(stocksDetail.reduce((sum, s) => sum + Number(s.quantity), 0) * 100) / 100;
  const detailValue = Math.round(stocksDetail.reduce((sum, s) => sum + Number(s.quantity) * (s.products?.actual_cost_price || s.products?.cost_price || 0), 0) * 100) / 100;
  const detailDamaged = Math.round(stocksDetail.reduce((sum, s) => sum + Number(s.damaged_quantity || 0), 0) * 100) / 100;

  console.log("--- VERIFICATION RESULTS ---");
  console.log("OVERVIEW API Stats for Main Warehouse:", { totalItems: overviewItems, totalValue: overviewValue });
  console.log("DETAIL API Stats for Main Warehouse:", { totalItems: detailItems, totalValue: detailValue, totalDamaged: detailDamaged });
  console.log("Do they match 100%?", overviewItems === detailItems && overviewValue === detailValue);
}

verifySync();
