// scratch/test-final-route.mjs
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

const supabaseAdmin = createClient(url, key);

async function mockGetStock(userId, includeOutOfStock, supplierLike) {
  // 1. Get assigned location(s) for this user
  const { data: assignments, error: assignError } = await supabaseAdmin
    .from("location_assignments")
    .select("location_id")
    .eq("user_id", userId);

  if (assignError) throw assignError;
  if (!assignments || assignments.length === 0) return [];

  const locationIds = assignments.map((a) => a.location_id);

  if (includeOutOfStock) {
    let query = supabaseAdmin
      .from("products")
      .select(
        `
        id,
        sku,
        name,
        selling_price,
        cost_price,
        retail_price,
        mrp,
        unit_of_measure,
        category,
        sub_category,
        brand,
        is_active,
        supplier_name,
        company_code,
        retail_only,
        product_stocks (
          quantity,
          location_id
        )
      `
      )
      .eq("is_active", true)
      .in("product_stocks.location_id", locationIds);

    if (supplierLike) {
      query = query.ilike("supplier_name", `%${supplierLike}%`);
    }

    const { data: productsData, error: productsError } = await query;
    if (productsError) throw productsError;

    const productList = productsData?.map((p) => {
      let stock_quantity = 0;
      if (p.product_stocks) {
        p.product_stocks.forEach((item) => {
          stock_quantity += item.quantity;
        });
      }
      return {
        id: p.id,
        sku: p.sku,
        name: p.name,
        selling_price: p.selling_price,
        retail_price: p.retail_price ?? null,
        retail_only: p.retail_only ?? false,
        mrp: p.mrp,
        stock_quantity,
        unit_of_measure: p.unit_of_measure || "unit",
        category: p.category,
        subCategory: p.sub_category,
        supplier: p.supplier_name,
        company_code: p.company_code,
      };
    });

    return productList || [];
  } else {
    let query = supabaseAdmin
      .from("product_stocks")
      .select(
        `
        quantity,
        location_id,
        products!inner (
          id,
          sku,
          name,
          selling_price,
          cost_price,
          retail_price,
          mrp,
          unit_of_measure,
          category,
          sub_category,
          brand,
          is_active,
          supplier_name,
          company_code,
          retail_only
        )
      `
      )
      .in("location_id", locationIds)
      .gt("quantity", 0);

    if (supplierLike) {
      query = query.ilike("products.supplier_name", `%${supplierLike}%`);
    }

    const { data: stocks, error: stockError } = await query;
    if (stockError) throw stockError;

    const productMap = new Map();
    stocks?.forEach((item) => {
      const p = item.products;
      if (!p) return;
      if (p.is_active === false) return;

      if (productMap.has(p.id)) {
        const existing = productMap.get(p.id);
        existing.stock_quantity += item.quantity;
      } else {
        productMap.set(p.id, {
          id: p.id,
          sku: p.sku,
          name: p.name,
          selling_price: p.selling_price,
          retail_price: p.retail_price ?? null,
          retail_only: p.retail_only ?? false,
          mrp: p.mrp,
          stock_quantity: item.quantity,
          unit_of_measure: p.unit_of_measure || "unit",
          category: p.category,
          subCategory: p.sub_category,
          supplier: p.supplier_name,
          company_code: p.company_code,
        });
      }
    });

    return Array.from(productMap.values());
  }
}

async function main() {
  const { data: assignments } = await supabaseAdmin
    .from("location_assignments")
    .select("user_id")
    .limit(1);

  if (!assignments || assignments.length === 0) {
    console.log("No assignments");
    return;
  }
  const userId = assignments[0].user_id;
  console.log(`Using rep user_id: ${userId}`);

  console.log("\n--- TEST A: includeOutOfStock = true (Override ON) ---");
  const listOverride = await mockGetStock(userId, true, "China");
  console.log(`Found ${listOverride.length} products with override ON`);
  listOverride.forEach(p => {
    if (p.name.includes("Connector Bars")) {
      console.log(`- ${p.name}: Stock = ${p.stock_quantity}, Supplier = ${p.supplier}`);
    }
  });

  console.log("\n--- TEST B: includeOutOfStock = false (Override OFF) ---");
  const listNormal = await mockGetStock(userId, false, "China");
  console.log(`Found ${listNormal.length} products with override OFF`);
  listNormal.forEach(p => {
    if (p.name.includes("Connector Bars")) {
      console.log(`- ${p.name}: Stock = ${p.stock_quantity}, Supplier = ${p.supplier}`);
    }
  });
}

main().catch(err => console.error(err));
