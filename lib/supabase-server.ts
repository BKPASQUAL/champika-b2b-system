import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Supabase client bound to the request cookies (anon key + user session).
 * Use in server components, route handlers and server actions to know
 * WHO is calling. For privileged DB work, still use supabaseAdmin after
 * the caller has been checked.
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a server component: cookies are read-only there.
            // Session refresh happens in route handlers instead.
          }
        },
      },
    },
  );
}
