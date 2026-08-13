const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

const envFile = fs.readFileSync(path.join(__dirname, "../.env.local"), "utf8");
const env = {};
envFile.split("\n").forEach((line) => {
  const [key, ...vals] = line.split("=");
  if (key && vals.length > 0) {
    env[key.trim()] = vals.join("=").trim().replace(/^"(.*)"$/, "$1");
  }
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

const ORANGE_AGENCY = "50a514e1-ee70-4e6d-a698-1630d8ed04e2";

async function fetchInvoices({ businessId, repId, customerId }) {
  let rawInvoices = [];
  let page = 0;
  const pageSize = 1000;
  let hasMore = true;

  while (hasMore) {
    let query = supabaseAdmin
      .from("invoices")
      .select(
        `
        *,
        customers!inner (
          shop_name,
          owner_name,
          business_id
        ),
        orders!inner (
          status,
          order_date,
          business_id,
          sales_rep_id,
          profiles!orders_sales_rep_id_fkey (
            full_name
          ),
          order_items (
            quantity,
            free_quantity,
            actual_unit_cost,
            total_price
          )
        )
      `
      )
      .order("created_at", { ascending: false })
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (customerId) {
      query = query.eq("customer_id", customerId);
    } else if (businessId) {
      query = query.eq("customers.business_id", businessId);
    }

    if (repId) {
      query = query.eq("orders.sales_rep_id", repId);
    }

    const { data, error } = await query;
    if (error) throw error;

    if (data && data.length > 0) {
      rawInvoices.push(...data);
      if (data.length < pageSize) {
        hasMore = false;
      } else {
        page++;
      }
    } else {
      hasMore = false;
    }
  }

  return rawInvoices;
}

async function runTests() {
  try {
    console.log("1. Fetching Orange Agency invoices...");
    const orangeInvoices = await fetchInvoices({ businessId: ORANGE_AGENCY });
    console.log(`PASS: Orange Agency invoices fetched: ${orangeInvoices.length}`);

    console.log("2. Fetching with businessId + repId...");
    const sampleRepId = orangeInvoices[0]?.orders?.sales_rep_id;
    if (sampleRepId) {
      const repInvoices = await fetchInvoices({ businessId: ORANGE_AGENCY, repId: sampleRepId });
      console.log(`PASS: Business + Rep invoices fetched: ${repInvoices.length}`);
    }

    console.log("3. Fetching with customerId...");
    const sampleCustId = orangeInvoices[0]?.customer_id;
    if (sampleCustId) {
      const custInvoices = await fetchInvoices({ customerId: sampleCustId });
      console.log(`PASS: Customer invoices fetched: ${custInvoices.length}`);
    }

    console.log("4. Fetching all invoices (no params)...");
    const allInvoices = await fetchInvoices({});
    console.log(`PASS: All invoices fetched: ${allInvoices.length}`);

    console.log("\nALL TESTS PASSED SUCCESSFULLY!");
  } catch (err) {
    console.error("FAIL:", err);
  }
}

runTests();
