import { createClient } from "@supabase/supabase-js";

// This client uses the SERVICE_ROLE_KEY.
// WARNING: Never use this client on the frontend (client-side components).
// Only use it in Server Actions or API Routes.
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);
