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
  const { supabaseAdmin } = await import('../lib/supabase-admin');

  // Fetch a customer with partial payments
  const { data: payments, error } = await supabaseAdmin
    .from('payments')
    .select(`
      id,
      invoice_id,
      customer_id,
      amount,
      payment_date,
      method,
      cheque_no,
      cheque_date,
      cheque_status,
      is_cancelled,
      invoices (
        id,
        invoice_no,
        total_amount,
        paid_amount,
        due_amount
      )
    `)
    .limit(10);

  console.log('Sample payments:', JSON.stringify(payments, null, 2));
  console.log('Error:', error);
}

main().catch(console.error);
