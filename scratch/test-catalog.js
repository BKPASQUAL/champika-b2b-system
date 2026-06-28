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
  console.log("Checking if we can access pg_proc or information_schema...");
  const { data, error } = await supabaseAdmin
    .from("pg_proc")
    .select("proname")
    .limit(10);
  console.log("pg_proc result:", { data, error });

  const { data: data2, error: error2 } = await supabaseAdmin
    .from("routines")
    .select("*")
    .limit(10);
  console.log("routines result:", { data2, error2 });
}

main();
