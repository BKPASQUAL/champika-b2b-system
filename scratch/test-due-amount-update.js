const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

const envPath = path.join(__dirname, "..", ".env.local");
const envContent = fs.readFileSync(envPath, "utf-8");
const envVars = {};
envContent.split("\n").forEach((line) => {
  const match = line.match(/^\s*([^#\s=]+)\s*=\s*(.*)\s*$/);
  if (match) {
    envVars[match[1]] = match[2].trim().replace(/^['"]|['"]$/g, '');
  }
});

const supabaseUrl = envVars["NEXT_PUBLIC_SUPABASE_URL"];
const supabaseServiceRoleKey = envVars["SUPABASE_SERVICE_ROLE_KEY"];
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

async function main() {
  console.log("Fetching one invoice...");
  const { data: invoice } = await supabaseAdmin.from("invoices").select("*").limit(1).single();
  if (!invoice) {
    console.log("No invoices found.");
    return;
  }
  
  console.log("Attempting to update due_amount to its current value to see if it's generated...", invoice.due_amount);
  const { data, error } = await supabaseAdmin
    .from("invoices")
    .update({ due_amount: invoice.due_amount })
    .eq("id", invoice.id)
    .select();
    
  if (error) {
    console.error("Error updating due_amount directly:", error.message);
  } else {
    console.log("Successfully updated due_amount directly! It is NOT a generated column.");
  }
}

main();
