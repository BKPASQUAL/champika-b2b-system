const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

const envPath = path.join(__dirname, "..", ".env.local");
const envContent = fs.readFileSync(envPath, "utf-8");
const envVars = {};
envContent.split("\n").forEach((line) => {
  const match = line.match(/^\s*([^#\s=]+)\s*=\s*(.*)\s*$/);
  if (match) {
    envVars[match[1]] = match[2].trim();
  }
});

const supabaseUrl = envVars["NEXT_PUBLIC_SUPABASE_URL"];
const supabaseServiceRoleKey = envVars["SUPABASE_SERVICE_ROLE_KEY"];
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

async function main() {
  console.log("Starting reconciliation of small due balances (< 10 LKR)...");

  // 1. Fetch all invoices
  const { data: invoices, error } = await supabaseAdmin
    .from("invoices")
    .select("id, invoice_no, total_amount, paid_amount, status, customer_id, customers(shop_name)");

  if (error) {
    console.error("Error fetching invoices:", error);
    return;
  }

  // Filter invoices where total_amount > 0 and (total_amount - paid_amount) is > -0.01 and < 10
  const matching = invoices.filter(inv => {
    if (inv.status === "Paid") return false;
    const total = Number(inv.total_amount) || 0;
    if (total <= 0) return false; // Skip empty/draft invoices
    const due = total - Number(inv.paid_amount || 0);
    return due > -0.01 && due < 10;
  });

  console.log(`Found ${matching.length} invoices to reconcile.`);

  for (const inv of matching) {
    const total = Number(inv.total_amount);
    const paid = Number(inv.paid_amount || 0);
    const diff = total - paid;

    console.log(`\nReconciling Invoice: ${inv.invoice_no}`);
    console.log(`- Shop Name: ${inv.customers?.shop_name}`);
    console.log(`- Total Amount: ${total}`);
    console.log(`- Original Paid Amount: ${paid}`);
    console.log(`- Remaining Difference (auto-paid): ${diff}`);

    // Update Invoice to Paid and paid_amount to equal total_amount
    const { error: invoiceErr } = await supabaseAdmin
      .from("invoices")
      .update({
        paid_amount: total,
        status: "Paid",
        updated_at: new Date().toISOString()
      })
      .eq("id", inv.id);

    if (invoiceErr) {
      console.error(`- Error updating invoice ${inv.invoice_no}:`, invoiceErr);
      continue;
    }

    // Update Customer outstanding_balance
    if (inv.customer_id) {
      const { data: customer, error: custFetchErr } = await supabaseAdmin
        .from("customers")
        .select("outstanding_balance, shop_name")
        .eq("id", inv.customer_id)
        .single();

      if (custFetchErr || !customer) {
        console.error(`- Error fetching customer outstanding balance for ${inv.customer_id}:`, custFetchErr);
        continue;
      }

      const currentBalance = Number(customer.outstanding_balance) || 0;
      const newBalance = currentBalance - diff;

      const { error: custUpdateErr } = await supabaseAdmin
        .from("customers")
        .update({
          outstanding_balance: newBalance,
          updated_at: new Date().toISOString()
        })
        .eq("id", inv.customer_id);

      if (custUpdateErr) {
        console.error(`- Error updating outstanding balance for customer ${customer.shop_name}:`, custUpdateErr);
      } else {
        console.log(`- Updated Customer Outstanding Balance: ${currentBalance} -> ${newBalance}`);
      }
    }
  }

  console.log("\nReconciliation completed successfully.");
}

main();
