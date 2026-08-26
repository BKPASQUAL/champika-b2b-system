// One-off correction for historical "Exchange" returns that were manually
// flipped to Good/Damage on the Loading Reconcile screen (the only way to
// get stock to move before the Exchange stock-accounting fix existed).
// That workaround left phantom stock in damaged_quantity:
//  - flipped to "Good": creation put +qty in damaged_quantity, and the old
//    Good closeLoad branch never reversed it -> phantom +qty stuck there.
//  - flipped to "Damage": creation put +qty in damaged_quantity, then the
//    old Damage closeLoad branch added +qty again -> double counted.
// Both cases need damaged_quantity -= qty (product + location), and the
// record relabeled back to return_type='Exchange' with actual_condition
// set to whatever it was flipped to, so it keeps its stock disposition but
// displays correctly everywhere again.

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

const RETURN_IDS = [
  "6685f4be-e814-4a52-94ab-3cebae3494fd", // RET-415839-1, Damage, qty 2
  "310fd801-dd31-4796-959f-36e61a84690b", // RET-583202-1, Good, qty 1
  "6a79c1d4-0147-4ee6-bcf7-b9d5ab7e63dd", // RET-586784-1, Good, qty 40
  "127a6825-d92d-4961-9bf8-d9620d6661e1", // RET-972225-1, Good, qty 1
  "2ee3d55d-4ae9-4fe5-93f3-010c1f8b4948", // RET-973917-2, Good, qty 3
  "5f0e062a-6fff-47bf-ac8a-fda082fdc0d0", // RET-975182-3, Good, qty 1
];

async function main() {
  for (const id of RETURN_IDS) {
    const { data: ret, error } = await supabaseAdmin
      .from("inventory_returns")
      .select("id, return_number, return_type, quantity, product_id, location_id, products(name)")
      .eq("id", id)
      .single();

    if (error || !ret) { console.error(`Could not load ${id}:`, error); continue; }

    const qty = Number(ret.quantity) || 0;
    const originalCondition = ret.return_type; // "Good" or "Damage"

    console.log(`\n${ret.return_number} (${ret.products?.name}) qty=${qty} flipped-to=${originalCondition}`);

    // Correct product-level damaged_quantity
    const { data: prod } = await supabaseAdmin
      .from("products")
      .select("damaged_quantity")
      .eq("id", ret.product_id)
      .single();
    if (prod) {
      const newDamaged = Math.max(0, Number(prod.damaged_quantity || 0) - qty);
      await supabaseAdmin.from("products").update({ damaged_quantity: newDamaged }).eq("id", ret.product_id);
      console.log(`  products.damaged_quantity: ${prod.damaged_quantity} -> ${newDamaged}`);
    }

    // Correct location-level damaged_quantity
    if (ret.location_id) {
      const { data: locStock } = await supabaseAdmin
        .from("product_stocks")
        .select("id, damaged_quantity")
        .eq("product_id", ret.product_id)
        .eq("location_id", ret.location_id)
        .maybeSingle();
      if (locStock) {
        const newLocDamaged = Math.max(0, Number(locStock.damaged_quantity || 0) - qty);
        await supabaseAdmin.from("product_stocks").update({ damaged_quantity: newLocDamaged }).eq("id", locStock.id);
        console.log(`  product_stocks.damaged_quantity: ${locStock.damaged_quantity} -> ${newLocDamaged}`);
      }
    }

    // Restore the Exchange label, recording what it was actually found to be
    await supabaseAdmin
      .from("inventory_returns")
      .update({ return_type: "Exchange", actual_condition: originalCondition })
      .eq("id", ret.id);
    console.log(`  return_type: ${originalCondition} -> Exchange (actual_condition=${originalCondition})`);
  }

  console.log("\nDone.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
