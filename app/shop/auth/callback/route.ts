import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { createWebCustomerFor } from "@/lib/web-auth";
import { shopBaseFor } from "@/lib/shop-host";

/** Only same-site paths like "/checkout" (never "//evil.com" or full URLs). */
function safeNext(raw: string | null): string {
  return raw && raw.startsWith("/") && !raw.startsWith("//") && !raw.includes("\\") ? raw : "/account";
}

/**
 * Google sign-in, email confirmation and password-reset links all land here.
 * Swaps the one-time code for a login session, creates the customer record,
 * then sends the visitor on to where they were going.
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const base = shopBaseFor(request.headers.get("host"));
  const next = safeNext(url.searchParams.get("next"));
  const go = (path: string) => NextResponse.redirect(new URL(`${base}${path}`, url.origin));

  const code = url.searchParams.get("code");
  if (!code) return go(`/login?error=${encodeURIComponent(url.searchParams.get("error_description") || "Login link is not valid")}`);

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) return go(`/login?error=${encodeURIComponent("This login link has expired. Please try again.")}`);

  try {
    if (!(await createWebCustomerFor(data.user))) {
      await supabase.auth.signOut();
      return go(`/login?error=${encodeURIComponent("This account is blocked. Please contact us.")}`);
    }
  } catch {
    return go(`/login?error=${encodeURIComponent("Could not set up your account. Please try again.")}`);
  }
  return go(next);
}
