// One-off: merge the 6 split pickup orders RET-278549-1..6 (LOAD-2026-1330) into one order RET-278549.
// Run: npx tsx scripts-tmp/ret-merge.ts
// A JSON backup of the 6 orders + items is written to scripts-tmp/ret-278549-backup.json first.
import fs from "fs";
for (const l of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const i = l.indexOf("=");
  if (i > 0) process.env[l.slice(0, i).trim()] = l.slice(i + 1).trim().replace(/^"|"$/g, "");
}
const BACKUP = "scripts-tmp/ret-278549-backup.json";

(async () => {
  const { supabaseAdmin: sb } = await import("../lib/supabase-admin");
  const { data: orders, error } = await sb.from("orders").select("*, order_items(*)").ilike("order_id", "RET-278549-%");
  if (error || !orders || orders.length !== 6) throw new Error("Expected 6 orders, got: " + (error?.message || orders?.length));
  const ids = orders.map((o: any) => o.id);
  const adj = await sb.from("supplier_claim_cost_adjustments").select("id").in("order_id", ids);
  if ((adj.data || []).length) throw new Error("Claim adjustments reference these orders, aborting");

  fs.writeFileSync(BACKUP, JSON.stringify(orders, null, 2));
  console.log("Backup written:", BACKUP);

  orders.sort((a: any, b: any) => a.order_id.localeCompare(b.order_id, undefined, { numeric: true }));
  const main = orders[0];
  if (main.order_id !== "RET-278549-1") throw new Error("First order is not RET-278549-1");
  const others = orders.slice(1);

  // Keep each item number tagged so return credits still match their pickup order
  const itemTags = others.map((o: any) => `[RETURN_ITEM: ${o.order_id}]`).join(" ");
  // Every original bill number, so the printed note lists them all
  const invTags = [...new Set(orders.map((o: any) => (o.notes || "").match(/\[INV:([^\]]+)\]/)?.[1]?.trim()).filter(Boolean))]
    .map((b) => `[INV:${b}]`)
    .join(" ");
  const notes = `[RETURN_NOTE: RET-278549-1] [NOTE:278549] Good Return Note RET-278549. Reason: Customer return. Collect items from customer. ${itemTags} ${invTags}`;

  // 1. Move the other item lines onto the main order
  const otherItemIds = others.flatMap((o: any) => o.order_items.map((i: any) => i.id));
  const mv = await sb.from("order_items").update({ order_id: main.id }).in("id", otherItemIds).select("id");
  if (mv.error || mv.data?.length !== otherItemIds.length) throw new Error("Moving items failed: " + mv.error?.message);
  console.log("Moved item lines:", mv.data.length);

  // 2. Rename the main order to the note number
  const up = await sb.from("orders").update({ order_id: "RET-278549", invoice_no: "RET-278549", notes }).eq("id", main.id);
  if (up.error) throw up.error;
  console.log("Main order renamed to RET-278549");

  // 3. Delete the now-empty orders
  const del = await sb.from("orders").delete().in("id", others.map((o: any) => o.id)).select("id");
  if (del.error) throw del.error;
  console.log("Deleted empty orders:", del.data?.length);

  const { data: check } = await sb
    .from("orders")
    .select("order_id, status, order_items(quantity, unit_price)")
    .eq("load_id", main.load_id);
  console.log(JSON.stringify(check, null, 1));
})().catch((e) => {
  console.error("FAILED", e);
  process.exit(1);
});
