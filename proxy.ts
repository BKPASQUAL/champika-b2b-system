import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { isShopHost } from "@/lib/shop-host";

/**
 * One project, two domains.
 *
 * - Shop domain (bkwiringbadukade.lk): every page is served from app/shop/**.
 *   "/p/abc" is rewritten to "/shop/p/abc". Staff pages and staff APIs are
 *   not reachable from this domain.
 * - Any other domain (the B2B system): untouched. /shop/** still works there,
 *   which is handy for testing before DNS is live.
 *
 * Shop requests also refresh the customer's login, so they stay signed in.
 *
 * Extra shop hosts for local testing can be added with SHOP_EXTRA_HOSTS,
 * e.g. SHOP_EXTRA_HOSTS=shop.localhost
 */
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (!isShopHost(request.headers.get("host"))) {
    // B2B domain: only shop test pages / shop APIs get the customer session refresh.
    if (pathname === "/shop" || pathname.startsWith("/shop/") || pathname.startsWith("/api/storefront/")) {
      return refreshSession(request, NextResponse.next({ request }));
    }
    return NextResponse.next();
  }

  // Public shop APIs only.
  if (pathname.startsWith("/api/")) {
    if (pathname.startsWith("/api/storefront/")) return refreshSession(request, NextResponse.next({ request }));
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Keep one canonical URL: bkwiringbadukade.lk/shop/x → /x
  if (pathname === "/shop" || pathname.startsWith("/shop/")) {
    const url = request.nextUrl.clone();
    url.pathname = pathname.slice(5) || "/";
    return NextResponse.redirect(url, 308);
  }

  const url = request.nextUrl.clone();
  url.pathname = `/shop${pathname === "/" ? "" : pathname}`;
  url.search = search;
  return refreshSession(request, NextResponse.rewrite(url, { request }));
}

/**
 * Supabase login tokens expire after about an hour. Pages can't write cookies,
 * so the new tokens are saved here, on the way in. Guests (no login cookie)
 * skip this entirely.
 */
async function refreshSession(request: NextRequest, response: NextResponse) {
  const hasSession = request.cookies.getAll().some((c) => c.name.startsWith("sb-") && c.name.includes("-auth-token"));
  if (!hasSession) return response;
  try {
    const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (list) => {
          for (const { name, value } of list) request.cookies.set(name, value);
          for (const { name, value, options } of list) response.cookies.set(name, value, options);
        },
      },
    });
    await supabase.auth.getUser();
  } catch {
    // Never block the page because of a login refresh problem.
  }
  return response;
}

export const config = {
  // Skip Next internals and static files (anything with a file extension),
  // except the shop's sitemap and robots file.
  matcher: ["/((?!_next/|.*\\.[\\w]+$).*)", "/sitemap.xml", "/robots.txt"],
};
