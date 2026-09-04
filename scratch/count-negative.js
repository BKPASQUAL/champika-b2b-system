const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const envFile = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const [k, v] = line.split('=');
  if (k && v) env[k.trim()] = v.trim().replace(/^["']|["']$/g, '');
});

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  const { data, count, error } = await supabase
    .from('product_stocks')
    .select('id, location_id, product_id, quantity', { count: 'exact' })
    .lt('quantity', 0);

  if (error) {
    console.error(error);
    return;
  }

  console.log(`Total negative stock records in DB: ${count}`);
  if (data && data.length > 0) {
    console.log('Sample negative records:', data.slice(0, 5));
  }
}

main();
