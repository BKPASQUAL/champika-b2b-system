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
  console.log("Searching for payments related to user's uploaded statement cheques...");
  
  const chequeNos = ["446356", "062052", "013037", "747392", "054800", "054801"];
  
  // Search for the exact cheque numbers (allowing for suffix/prefix matching)
  const { data: payments, error } = await supabaseAdmin
    .from("payments")
    .select("id, cheque_no, amount, cheque_date, payment_date, cheque_status, method")
    .eq("method", "cheque");

  if (error) {
    console.error("Error fetching payments:", error);
    return;
  }

  console.log(`Found ${payments.length} cheque payments total in the database.`);
  
  console.log("\nMatching cheques report:");
  chequeNos.forEach((no) => {
    const matches = payments.filter((p) => {
      const cleanNo = (p.cheque_no || "").trim().replace(/^0+/, "");
      return cleanNo.includes(no) || no.includes(cleanNo);
    });

    if (matches.length > 0) {
      console.log(`\nCheque #${no} (Searched):`);
      matches.forEach((m) => {
        console.log(`  - ID: ${m.id}`);
        console.log(`    Cheque No in DB: "${m.cheque_no}"`);
        console.log(`    Amount in DB: ${m.amount}`);
        console.log(`    Status in DB: ${m.cheque_status}`);
        console.log(`    Cheque Date: ${m.cheque_date}`);
        console.log(`    Payment Date: ${m.payment_date}`);
      });
    } else {
      console.log(`\nCheque #${no} (Searched): NO MATCH FOUND IN DATABASE`);
    }
  });

  // Print all pending/deposited cheques to see if there are any that match close to these amounts
  console.log("\nList of all Pending/Deposited cheques in DB:");
  const activeCheques = payments.filter(p => ["Pending", "Deposited"].includes(p.cheque_status));
  if (activeCheques.length === 0) {
    console.log("No pending or deposited cheques found.");
  } else {
    activeCheques.forEach(ac => {
      console.log(`  - DB Cheque No: "${ac.cheque_no}", Amount: ${ac.amount}, Status: ${ac.cheque_status}, Date: ${ac.cheque_date}`);
    });
  }
}

main();
