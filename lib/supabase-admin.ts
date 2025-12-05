import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Log an error if keys are missing so you can see it in your terminal
if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error("❌ CRITICAL ERROR: Missing Supabase Environment Variables.");
  console.error("Check your .env.local file or server environment.");
}

// Create the client safely
export const supabaseAdmin = createClient(
  supabaseUrl || "https://placeholder.supabase.co",
  supabaseServiceRoleKey || "placeholder-key",
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);
