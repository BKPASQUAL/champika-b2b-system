// One-off correction for the Exchange-return bill-reduction bug.
// Only touches the two invoices verified by scripts/analyze-exchange-return-bug.js
// (cross-checked against invoice_history to confirm the diff is purely the
// wrongly-applied Exchange return deduction, not a legitimate item change).

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

const CORRECTIONS = [
  { invoiceNo: "CHD-1038", correctTotal: 159936, newStatus: null },
  { invoiceNo: "CHD-1041", correctTotal: 37670, newStatus: "Partial" },
];

async function main() {
  const { data: adminProfile } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .limit(1)
    .maybeSingle();
  const systemUserId = adminProfile?.id || null;

  for (const c of CORRECTIONS) {
    const { data: invoice, error } = await supabaseAdmin
      .from("invoices")
      .select("id, invoice_no, order_id, total_amount, paid_amount, status, customer_id")
      .eq("invoice_no", c.invoiceNo)
      .maybeSingle();

    if (error || !invoice) {
      console.error(`Could not load ${c.invoiceNo}:`, error);
      continue;
    }

    const oldTotal = Number(invoice.total_amount);
    const diff = c.correctTotal - oldTotal;

    console.log(`\n${c.invoiceNo}: total ${oldTotal} -> ${c.correctTotal} (diff +${diff})`);

    const invoiceUpdate = { total_amount: c.correctTotal };
    if (c.newStatus) invoiceUpdate.status = c.newStatus;

    const { error: invErr } = await supabaseAdmin
      .from("invoices")
      .update(invoiceUpdate)
      .eq("id", invoice.id);
    if (invErr) { console.error("  invoice update failed:", invErr); continue; }
    console.log(`  invoices.total_amount -> ${c.correctTotal}` + (c.newStatus ? `, status -> ${c.newStatus}` : ""));

    const { error: ordErr } = await supabaseAdmin
      .from("orders")
      .update({ total_amount: c.correctTotal })
      .eq("id", invoice.order_id);
    if (ordErr) { console.error("  order update failed:", ordErr); continue; }
    console.log(`  orders.total_amount -> ${c.correctTotal}`);

    const { data: customer, error: custFetchErr } = await supabaseAdmin
      .from("customers")
      .select("outstanding_balance, shop_name")
      .eq("id", invoice.customer_id)
      .single();
    if (custFetchErr || !customer) { console.error("  customer fetch failed:", custFetchErr); continue; }

    const newBalance = Number(customer.outstanding_balance || 0) + diff;
    const { error: custErr } = await supabaseAdmin
      .from("customers")
      .update({ outstanding_balance: newBalance })
      .eq("id", invoice.customer_id);
    if (custErr) { console.error("  customer balance update failed:", custErr); continue; }
    console.log(`  ${customer.shop_name}: outstanding_balance ${customer.outstanding_balance} -> ${newBalance}`);

    await supabaseAdmin.from("invoice_history").insert({
      invoice_id: invoice.id,
      previous_data: { total_amount: oldTotal, status: invoice.status },
      changed_by: systemUserId,
      change_reason: `Corrected: Exchange returns were wrongly reducing the bill total (bug fix). +${diff}`,
    });
  }

  console.log("\nDone. Re-run scripts/analyze-exchange-return-bug.js to verify no invoices remain flagged.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
