import fs from "fs";
for (const l of fs.readFileSync(".env.local","utf8").split(/\r?\n/)) { const i=l.indexOf("="); if(i>0) process.env[l.slice(0,i).trim()] = l.slice(i+1).trim().replace(/^"|"$/g,""); }
(async () => {
  const { supabaseAdmin: sb } = await import("../lib/supabase-admin");
  const { data: L } = await sb.from("product_cost_layers").select("id,product_id,cost_price,original_quantity,remaining_quantity,created_at,product:products(sku,name,cost_price,actual_cost_price)").is("purchase_id", null).gt("created_at","2026-05-21");
  const rows:any[] = [];
  for (const l of L!) {
    const { data: pis } = await sb.from("purchase_items").select("unit_cost,total_cost,quantity,actual_unit_cost,purchase:purchases!inner(purchase_date)").eq("product_id", l.product_id).lte("purchase.purchase_date", l.created_at.slice(0,10));
    const real = (pis||[]).filter((p:any)=>Number(p.total_cost)>0).sort((a:any,b:any)=>a.purchase.purchase_date.localeCompare(b.purchase.purchase_date)).pop();
    if (!real) continue;
    const bill = Number(real.total_cost)/Number(real.quantity), act = Number(real.actual_unit_cost);
    if (Number(l.cost_price) - act > 0.5) rows.push([l.product.sku, l.product.name.slice(0,38), l.created_at.slice(0,10), l.original_quantity, Number(l.cost_price).toFixed(2), bill.toFixed(2), act.toFixed(2)]);
  }
  console.log("stock-count layers after seed:", L!.length, " with cost above last bill actual cost:", rows.length);
  rows.forEach(r=>console.log(r.join(" | ")));
})();
