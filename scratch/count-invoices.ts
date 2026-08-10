import fs from 'fs';
import path from 'path';
import { BUSINESS_IDS } from '../app/config/business-constants';

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
  const distributionBusinessId = BUSINESS_IDS.CHAMPIKA_DISTRIBUTION;

  // Step 1: customer IDs
  const { data: customers } = await supabaseAdmin
    .from("customers")
    .select("id")
    .eq("business_id", distributionBusinessId);
  const customerIds = (customers ?? []).map((c: any) => c.id);

  // Unchunked count vs Chunked count
  const { data: unchunked } = await supabaseAdmin
    .from("invoices")
    .select("id, invoice_no, created_at")
    .in("customer_id", customerIds)
    .order("created_at", { ascending: false });

  console.log('Distribution Invoices fetched without chunking (capped):', unchunked?.length);
  if (unchunked && unchunked.length > 0) {
    console.log('Unchunked latest:', unchunked[0].invoice_no);
    console.log('Unchunked oldest returned:', unchunked[unchunked.length - 1].invoice_no);
  }

  // Chunked loop
  let allDistInvoices: any[] = [];
  let page = 0;
  const pageSize = 1000;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabaseAdmin
      .from('invoices')
      .select('id, invoice_no, created_at')
      .in('customer_id', customerIds)
      .order('created_at', { ascending: false })
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (error) throw error;
    if (data && data.length > 0) {
      allDistInvoices.push(...data);
      if (data.length < pageSize) {
        hasMore = false;
      } else {
        page++;
      }
    } else {
      hasMore = false;
    }
  }

  console.log('Distribution Invoices fetched with chunking (ALL):', allDistInvoices.length);
  if (allDistInvoices.length > 0) {
    console.log('Chunked latest:', allDistInvoices[0].invoice_no);
    console.log('Chunked oldest (1st bill!):', allDistInvoices[allDistInvoices.length - 1].invoice_no);
  }
}

main().catch(console.error);
