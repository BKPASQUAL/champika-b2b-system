import { cache } from "react";
import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getRequestSite, siteBusinessId, type WebSite } from "@/lib/web-site";

export type WebCustomer = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  tier: "normal" | "trade";
  trade_status: string;
  customer_id: string | null;
  default_address: any;
  is_blocked: boolean;
};

/**
 * Logged-in auth user from the request cookies, or null.
 * getUser() is a network call to Supabase Auth, so it is done once per
 * request (React cache) even though layout, header and pricing all need it.
 */
const getAuthUser = cache(async (): Promise<User | null> => {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  return data.user ?? null;
});

/** Logged-in auth user id from the request cookies, or null. */
export async function getSessionUserId(): Promise<string | null> {
  return (await getAuthUser())?.id ?? null;
}

async function loadWebCustomer(userId: string): Promise<WebCustomer | null> {
  const { data } = await supabaseAdmin
    .from("web_customers")
    .select("id, full_name, email, phone, tier, trade_status, customer_id, default_address, is_blocked")
    .eq("id", userId)
    .eq("site", await getRequestSite()) // a login belongs to one shop only
    .maybeSingle();
  if (!data || data.is_blocked) return null;
  return data as WebCustomer;
}

/** The logged-in website customer, or null (not logged in / not a customer). Once per request. */
export const getWebCustomer = cache(async (): Promise<WebCustomer | null> => {
  const userId = await getSessionUserId();
  return userId ? loadWebCustomer(userId) : null;
});

/**
 * Make sure a web_customers row exists for this auth user on THIS shop (first
 * Google, email or phone sign-in). Never changes an existing row. Returns false
 * when blocked, or when the login already belongs to the other shop.
 */
export async function createWebCustomerFor(user: User): Promise<boolean> {
  const site = await getRequestSite();
  const { data: row } = await supabaseAdmin.from("web_customers").select("is_blocked, site").eq("id", user.id).maybeSingle();
  if (row) return !row.is_blocked && (row.site ?? "bk") === site;
  const meta = (user.user_metadata || {}) as Record<string, any>;
  const { error } = await supabaseAdmin.from("web_customers").upsert(
    {
      id: user.id,
      site,
      full_name: String(meta.full_name || meta.name || "").trim() || null,
      email: user.email ?? null,
      phone: String(meta.phone || user.phone || "").trim() || null,
      auth_provider: (user.app_metadata?.provider as string) || (user.phone ? "phone" : "email"),
    },
    { onConflict: "id", ignoreDuplicates: true },
  );
  if (error) throw new Error(`Could not create customer: ${error.message}`);
  return true;
}

/** The logged-in website customer, creating their row on first use. Null when logged out or blocked. */
export async function ensureWebCustomer(): Promise<WebCustomer | null> {
  const user = await getAuthUser();
  if (!user) return null;
  if (!(await createWebCustomerFor(user))) return null;
  // Read fresh: a cached getWebCustomer() from earlier in this request may predate the new row.
  return loadWebCustomer(user.id);
}

/** Pricing tier for the current visitor (guests are "normal"). */
export async function getVisitorTier(): Promise<"normal" | "trade"> {
  const c = await getWebCustomer();
  return c?.tier === "trade" && c.trade_status === "approved" ? "trade" : "normal";
}

/**
 * For /api/website/** (staff portal). The portal says which shop it manages
 * (x-web-site header: "bk" | "champika"). Allows admins, and office users with
 * access to that shop's business. Returns a 401/403 response to send back,
 * or { userId, site } when allowed.
 */
export async function requireWebsiteStaff(): Promise<
  { userId: string; site: WebSite; error?: never } | { error: NextResponse; userId?: never; site?: never }
> {
  const site = await getRequestSite();
  const businessId = siteBusinessId(site);
  const userId = await getSessionUserId();
  if (!userId) {
    return { error: NextResponse.json({ error: "Not logged in" }, { status: 401 }) };
  }

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("role, is_active, business_id")
    .eq("id", userId)
    .maybeSingle();

  if (!profile || !profile.is_active) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  if (profile.role === "admin" || profile.role === "super_admin") return { userId, site };

  if (profile.role === "office") {
    if (profile.business_id === businessId) return { userId, site };
    const { data: access } = await supabaseAdmin
      .from("user_business_access")
      .select("business_id")
      .eq("user_id", userId)
      .eq("business_id", businessId)
      .maybeSingle();
    if (access) return { userId, site };
  }

  return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
}

/** Name, email and role of a staff user (for order notes and permissions). */
export async function getStaff(userId: string): Promise<{ id: string; name: string | null; email: string | null; role: string }> {
  const { data } = await supabaseAdmin.from("profiles").select("full_name, email, role").eq("id", userId).maybeSingle();
  return { id: userId, name: data?.full_name ?? null, email: data?.email ?? null, role: data?.role ?? "office" };
}
