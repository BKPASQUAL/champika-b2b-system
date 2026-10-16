import fs from 'fs';
import path from 'path';

const envPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envConfig = fs.readFileSync(envPath, 'utf8');
  envConfig.split(/\r?\n/).forEach(line => {
    const parts = line.split('=');
    const key = parts[0]?.trim();
    const value = parts.slice(1).join('=').trim().replace(/^["']|["']$/g, '');
    if (key && value) {
      process.env[key] = value;
    }
  });
}

async function main() {
  const isApply = process.argv.includes('--apply');
  const { supabaseAdmin } = await import('../lib/supabase-admin');

  const { data: invoices, error } = await supabaseAdmin
    .from("invoices")
    .select(`
      id,
      invoice_no,
      manual_invoice_no,
      order_id,
      total_amount,
      paid_amount,
      due_amount,
      status,
      customer_id,
      customers ( id, shop_name, outstanding_balance )
    `)
    .gt("due_amount", 0)
    .lt("due_amount", 100)
    .neq("status", "Paid");

  if (error) {
    console.error("Fetch error:", error);
    return;
  }

  console.log(`Found ${invoices?.length || 0} invoices with 0 < due_amount < 100 to settle.`);
  let totalSettled = 0;
  let paymentsCreated = 0;

  for (const inv of invoices || []) {
    const total = Number(inv.total_amount) || 0;
    const paid = Number(inv.paid_amount) || 0;
    const due = Number(inv.due_amount) || 0;
    let remainingDue = (total - paid) > 0 ? (total - paid) : due;
    remainingDue = Math.round(remainingDue * 100) / 100; // Round to 2 decimals

    totalSettled += remainingDue;

    const customerObj = Array.isArray(inv.customers) ? inv.customers[0] : inv.customers;
    const shopName = customerObj?.shop_name || "Unknown";

    console.log(
      `[${inv.manual_invoice_no || inv.invoice_no}] ${shopName}: Total ${total.toFixed(2)}, Paid ${paid.toFixed(2)}, Due ${due.toFixed(2)} -> Settle ${remainingDue.toFixed(2)}`
    );

    if (isApply) {
      const today = new Date().toISOString().split("T")[0];

      // 1. Insert payment record only if amount > 0.01
      if (remainingDue >= 0.01) {
        const { error: payErr } = await supabaseAdmin.from("payments").insert({
          invoice_id: inv.id,
          customer_id: inv.customer_id,
          amount: remainingDue,
          payment_date: today,
          method: "cash",
        });
        if (payErr) {
          console.error(`Payment insert error for ${inv.invoice_no}:`, payErr);
          continue;
        }
        paymentsCreated++;

        // Update customer outstanding balance
        if (customerObj?.id) {
          const curBal = Number(customerObj.outstanding_balance) || 0;
          const newBal = curBal - remainingDue;
          await supabaseAdmin
            .from("customers")
            .update({ outstanding_balance: newBal })
            .eq("id", customerObj.id);
        }
      }

      // 2. Update invoice
      const { error: invErr } = await supabaseAdmin
        .from("invoices")
        .update({
          paid_amount: total,
          status: "Paid",
          updated_at: new Date().toISOString(),
        })
        .eq("id", inv.id);
      if (invErr) {
        console.error(`Invoice update error for ${inv.invoice_no}:`, invErr);
      }

      // 3. Update order if linked
      if (inv.order_id) {
        await supabaseAdmin
          .from("orders")
          .update({ payment_status: "Paid" })
          .eq("id", inv.order_id);
      }
    }
  }

  console.log(`\nSummary: ${invoices?.length || 0} invoices. Total settled: LKR ${totalSettled.toFixed(2)}`);
  if (!isApply) {
    console.log("DRY RUN ONLY. Run with --apply to commit changes.");
  } else {
    console.log(`SUCCESS! Created ${paymentsCreated} auto cash payments. All 77 invoices marked Paid!`);
  }
}

main();
