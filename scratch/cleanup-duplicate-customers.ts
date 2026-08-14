import fs from "fs";
import path from "path";

const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  const envConfig = fs.readFileSync(envPath, "utf8");
  for (let line of envConfig.split("\n")) {
    line = line.trim();
    if (!line || line.startsWith("#")) continue;
    const idx = line.indexOf("=");
    if (idx > 0) {
      const key = line.substring(0, idx).trim();
      let val = line.substring(idx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      process.env[key] = val;
    }
  }
}

async function cleanupDuplicates() {
  const { supabaseAdmin } = await import("../lib/supabase-admin");

  console.log("Starting cleanup of duplicate customer records...");

  // Fetch all customers sorted by created_at ascending (oldest first)
  const { data: allCustomers, error } = await supabaseAdmin
    .from("customers")
    .select("id, shop_name, business_id, created_at")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Error fetching customers:", error);
    return;
  }

  console.log(`Total customers found: ${allCustomers?.length}`);

  const primaryMap: Record<string, string> = {}; // key -> primaryId
  const idsToDelete: string[] = [];
  const reassignments: { oldId: string; primaryId: string }[] = [];

  for (const c of allCustomers || []) {
    const key = `${c.business_id} :: ${c.shop_name.trim().toLowerCase()}`;
    if (!primaryMap[key]) {
      primaryMap[key] = c.id; // Keep oldest record as primary
    } else {
      idsToDelete.push(c.id);
      reassignments.push({ oldId: c.id, primaryId: primaryMap[key] });
    }
  }

  console.log(`Primary unique customers to keep: ${Object.keys(primaryMap).length}`);
  console.log(`Duplicate customer records to delete: ${idsToDelete.length}`);

  if (idsToDelete.length === 0) {
    console.log("No duplicates found to delete!");
    return;
  }

  // Reassign orders pointing to duplicate customer IDs
  console.log("Reassigning foreign keys in orders & invoices...");
  for (const item of reassignments) {
    await supabaseAdmin
      .from("orders")
      .update({ customer_id: item.primaryId })
      .eq("customer_id", item.oldId);

    await supabaseAdmin
      .from("invoices")
      .update({ customer_id: item.primaryId })
      .eq("customer_id", item.oldId);

    await supabaseAdmin
      .from("payments")
      .update({ customer_id: item.primaryId })
      .eq("customer_id", item.oldId);
  }

  // Delete duplicates in batches of 500
  console.log("Deleting duplicate customer rows...");
  const batchSize = 500;
  for (let i = 0; i < idsToDelete.length; i += batchSize) {
    const batch = idsToDelete.slice(i, i + batchSize);
    const { error: delErr } = await supabaseAdmin
      .from("customers")
      .delete()
      .in("id", batch);

    if (delErr) {
      console.error(`Error deleting batch ${i}:`, delErr);
    } else {
      console.log(`Deleted batch ${i} to ${i + batch.length}`);
    }
  }

  console.log("Cleanup finished successfully!");

  // Verify remaining count
  const { data: remaining } = await supabaseAdmin
    .from("customers")
    .select("id", { count: "exact" });
  console.log(`Remaining customers count: ${remaining?.length}`);
}

cleanupDuplicates();
