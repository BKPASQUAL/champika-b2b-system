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
  // Test if we can run raw SQL using some RPC or see what RPCs exist
  const { data, error } = await supabaseAdmin.rpc("execute_sql", { sql: "SELECT 1" });
  console.log("execute_sql result:", { data, error });

  const { data: data2, error: error2 } = await supabaseAdmin.rpc("exec_sql", { sql: "SELECT 1" });
  console.log("exec_sql result:", { data2, error2 });

  const { data: data3, error: error3 } = await supabaseAdmin.rpc("run_sql", { sql: "SELECT 1" });
  console.log("run_sql result:", { data3, error3 });
}

main();
