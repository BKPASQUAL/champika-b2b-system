// READ-ONLY analysis script.
// Finds distribution invoices whose total_amount was wrongly reduced by
// "Exchange" type returns (a bug fixed in the Edit Invoice pages / inventory
// returns API — Exchange returns are a stock swap only and must not reduce
// the amount the customer owes).
//
// For every invoice tagged in an Exchange return's reason, recomputes the
// correct total from order_items - extra_discount - cash_discount - (non-
// exchange returns only), and reports any invoice where the stored
// total_amount is lower than that correct total.

const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

const envPath = path.join(__dirname, "..", ".env.local");
const envContent = fs.readFileSync(envPath, "utf-8");
const envVars = {};
envContent.split("\n").forEach((line) => {
  const match = line.match(/^\s*([^#\s=]+)\s*=\s*(.*)\s*$/);
  if (match) envVars[match[1]] = match[2].trim();
});

const supabaseAdmin = createClient(
  envVars["NEXT_PUBLIC_SUPABASE_URL"],
  envVars["SUPABASE_SERVICE_ROLE_KEY"]
);

async function main() {
  console.log("Scanning for invoices affected by the Exchange-return bill-reduction bug...\n");

  // 1. All Exchange-type returns (this return type is only ever used by the
  //    distribution portal), pull the invoice number out of the reason tag.
  const { data: exchangeReturns, error: exErr } = await supabaseAdmin
    .from("inventory_returns")
    .select("id, reason, quantity, return_type, product_id, products(selling_price, name)")
    .eq("return_type", "Exchange");

  if (exErr) throw exErr;

  const invoiceNoSet = new Set();
  for (const r of exchangeReturns || []) {
    const m = (r.reason || "").match(/CHD-\d+/);
    if (m) invoiceNoSet.add(m[0]);
  }

  console.log(`Found ${exchangeReturns.length} Exchange-type return records, referencing ${invoiceNoSet.size} distinct invoices.\n`);

  const affected = [];

  for (const invoiceNo of invoiceNoSet) {
    const { data: invoice } = await supabaseAdmin
      .from("invoices")
      .select("id, invoice_no, total_amount, paid_amount, customer_id, order_id, customers(shop_name), orders(id, notes, extra_discount_amount, business_id)")
      .eq("invoice_no", invoiceNo)
      .maybeSingle();

    if (!invoice || !invoice.order_id) continue;

    const { data: items } = await supabaseAdmin
      .from("order_items")
      .select("total_price")
      .eq("order_id", invoice.order_id);

    const itemsSubtotal = (items || []).reduce((s, i) => s + (Number(i.total_price) || 0), 0);
    const extraDiscountAmount = Number(invoice.orders?.extra_discount_amount || 0);

    const notes = invoice.orders?.notes || "";
    const cdaMatch = notes.match(/\[CASH_DISCOUNT_AMOUNT:([\d.]+)\]/);
    const cashDiscountAmount = cdaMatch ? parseFloat(cdaMatch[1]) : 0;

    const { data: allReturns } = await supabaseAdmin
      .from("inventory_returns")
      .select("quantity, return_type, products(selling_price)")
      .ilike("reason", `%${invoiceNo}%`);

    const nonExchangeDeduction = (allReturns || []).reduce((sum, r) => {
      if ((r.return_type || "Exchange") === "Exchange") return sum;
      return sum + (Number(r.quantity) || 0) * (Number(r.products?.selling_price) || 0);
    }, 0);

    const exchangeValue = (allReturns || []).reduce((sum, r) => {
      if ((r.return_type || "Exchange") !== "Exchange") return sum;
      return sum + (Number(r.quantity) || 0) * (Number(r.products?.selling_price) || 0);
    }, 0);

    const correctTotal = Math.max(0, itemsSubtotal - extraDiscountAmount - cashDiscountAmount - nonExchangeDeduction);
    const storedTotal = Number(invoice.total_amount) || 0;
    const diff = correctTotal - storedTotal;

    if (diff > 1) {
      affected.push({
        invoiceNo,
        shop: invoice.customers?.shop_name,
        storedTotal,
        correctTotal,
        diff,
        exchangeValue,
        paidAmount: Number(invoice.paid_amount) || 0,
        customerId: invoice.customer_id,
        invoiceId: invoice.id,
      });
    }
  }

  affected.sort((a, b) => b.diff - a.diff);

  console.log(`--- Affected invoices: ${affected.length} ---\n`);
  let totalDiff = 0;
  for (const a of affected) {
    totalDiff += a.diff;
    console.log(
      `${a.invoiceNo}  ${String(a.shop).padEnd(30)}  stored=${a.storedTotal.toFixed(2).padStart(12)}  correct=${a.correctTotal.toFixed(2).padStart(12)}  diff=+${a.diff.toFixed(2)}  (exchangeValue=${a.exchangeValue.toFixed(2)})`
    );
  }
  console.log(`\nTotal understatement across all affected invoices: LKR ${totalDiff.toFixed(2)}`);

  fs.writeFileSync(
    path.join(__dirname, "exchange-return-bug-report.json"),
    JSON.stringify(affected, null, 2)
  );
  console.log("\nFull details written to scripts/exchange-return-bug-report.json (no data was modified).");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
