import fs from "fs";
for (const l of fs.readFileSync(".env.local","utf8").split(/\r?\n/)) { const i=l.indexOf("="); if(i>0) process.env[l.slice(0,i).trim()] = l.slice(i+1).trim().replace(/^"|"$/g,""); }
(async () => {
  const { supabaseAdmin: sb } = await import("../lib/supabase-admin");
  const { data: p } = await sb.from("products").select("id,name,cost_price,actual_cost_price,selling_price,mrp").eq("sku","OR-0061").single();
  console.log(p);
  const { data: pis } = await sb.from("purchase_items").select("quantity,free_quantity,unit_cost,discount_percent,total_cost,actual_unit_cost,purchase:purchases(purchase_id,invoice_no,purchase_date,extra_discount,total_amount)").eq("product_id", p!.id);
  pis!.sort((a:any,b:any)=>a.purchase.purchase_date.localeCompare(b.purchase.purchase_date)).forEach((x:any)=>console.log("PUR", x.purchase.purchase_date, x.purchase.purchase_id, "qty", x.quantity, "free", x.free_quantity, "unit", x.unit_cost, "disc%", x.discount_percent, "total", x.total_cost, "actual", Number(x.actual_unit_cost).toFixed(2), "billExtra", x.purchase.extra_discount, "billTotal", x.purchase.total_amount));
  const { data: L } = await sb.from("product_cost_layers").select("cost_price,original_quantity,remaining_quantity,created_at,purchase_id").eq("product_id", p!.id);
  L!.forEach((l:any)=>console.log("LAYER", Number(l.cost_price).toFixed(2), l.original_quantity, l.remaining_quantity, l.created_at.slice(0,10), l.purchase_id?"":"(stock count)"));
  const { data: o } = await sb.from("order_items").select("quantity,free_quantity,unit_price,discount_percent,total_price,actual_unit_cost,order:orders!inner(order_id,order_date,status,is_inter_branch,extra_discount_amount,total_amount,notes,customer:customers(shop_name))").eq("product_id", p!.id).eq("order.status","Delivered").eq("order.is_inter_branch", false);
  o!.sort((a:any,b:any)=>a.order.order_date.localeCompare(b.order.order_date)).forEach((x:any)=>console.log("SALE", x.order.order_date.slice(0,10), x.order.order_id, (x.order.customer?.shop_name||"").slice(0,22).padEnd(22), "qty", x.quantity, "free", x.free_quantity, "price", x.unit_price, "disc%", x.discount_percent, "total", x.total_price, "cost", Number(x.actual_unit_cost).toFixed(2), "invExtra", x.order.extra_discount_amount, (x.order.notes||"").match(/CASH_DISCOUNT_AMOUNT:[\d.]+/)?.[0]||""));
})();
