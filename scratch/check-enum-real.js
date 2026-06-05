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
  console.log("Checking if we can update an invoice status to 'Cancel Requested'...");
  const { data: testInvoice } = await supabaseAdmin.from("invoices").select("id, status").limit(1).single();
  if (!testInvoice) {
    console.log("No invoices to test");
    return;
  }
  console.log("Original status of test invoice:", testInvoice.status);
  
  const { error } = await supabaseAdmin
    .from("invoices")
    .update({ status: "Cancel Requested" })
    .eq("id", testInvoice.id);
    
  if (error) {
    console.log("Update to 'Cancel Requested' failed:", error.message);
  } else {
    console.log("Update to 'Cancel Requested' succeeded!");
    // Revert it
    await supabaseAdmin
      .from("invoices")
      .update({ status: testInvoice.status })
      .eq("id", testInvoice.id);
  }
}

main();
