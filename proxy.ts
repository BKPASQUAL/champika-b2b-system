import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { CHAMPIKA_TEST_PREFIX, parseSite, SITE_COOKIE, SITE_HEADER, siteForHost } from "@/lib/web-site-core";
import type { WebSite } from "@/app/config/business-constants";

/**
 * One project, three domains, two online shops.
 *
 * - A shop domain (bkwiringbadukade.lk = BK Wiring; the Champika domain once it is
 *   set in SHOP_HOST_SITES): every page is served from app/shop/**, e.g. "/p/abc" is
 *   rewritten to "/shop/p/abc". Staff pages and staff APIs are not reachable there.
 * - The B2B system's domain: untouched, except the shop test paths
 *   /shop/** (BK Wiring) and /champika/** (Champika, rewritten to /shop/**).
 *
 * Every shop request carries the x-web-site header ("bk" | "champika") set HERE,
 * so a browser can never choose another shop's data. Shop requests also refresh
 * the customer's login, so they stay signed in.
 *
 * Extra shop hosts for local testing: SHOP_EXTRA_HOSTS=bk.localhost=bk,champika.localhost=champika
 */
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const hostSite = siteForHost(request.headers.get("host"));

  if (!hostSite) {
    // ---- B2B domain ----
    // Champika test shop: /champika/x → /shop/x
    if (pathname === CHAMPIKA_TEST_PREFIX || pathname.startsWith(`${CHAMPIKA_TEST_PREFIX}/`)) {
      const url = request.nextUrl.clone();
      url.pathname = `/shop${pathname.slice(CHAMPIKA_TEST_PREFIX.length)}`;
      url.search = search;
      const res = NextResponse.rewrite(url, { request: { headers: withSite(request, "champika") } });
      rememberTestSite(res, "champika");
      return refreshSession(request, res);
    }
    // BK test shop
    if (pathname === "/shop" || pathname.startsWith("/shop/")) {
      const res = NextResponse.next({ request: { headers: withSite(request, "bk") } });
      rememberTestSite(res, "bk");
      return refreshSession(request, res);
    }
    // Shop APIs called from a test shop page: the shop the visitor last opened.
    if (pathname.startsWith("/api/storefront/")) {
      const site = parseSite(request.cookies.get(SITE_COOKIE)?.value) ?? "bk";
      return refreshSession(request, NextResponse.next({ request: { headers: withSite(request, site) } }));
    }
    return NextResponse.next();
  }

  // ---- A shop domain ----
  // Public shop APIs only.
  if (pathname.startsWith("/api/")) {
    if (pathname.startsWith("/api/storefront/")) {
      return refreshSession(request, NextResponse.next({ request: { headers: withSite(request, hostSite) } }));
    }
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Keep one canonical URL: shop.lk/shop/x → /x
  if (pathname === "/shop" || pathname.startsWith("/shop/")) {
    const url = request.nextUrl.clone();
    url.pathname = pathname.slice(5) || "/";
    return NextResponse.redirect(url, 308);
  }

  const url = request.nextUrl.clone();
  url.pathname = `/shop${pathname === "/" ? "" : pathname}`;
  url.search = search;
  return refreshSession(request, NextResponse.rewrite(url, { request: { headers: withSite(request, hostSite) } }));
}

/** Request headers with x-web-site set by the server (whatever the browser sent is replaced). */
function withSite(request: NextRequest, site: WebSite): Headers {
  const h = new Headers(request.headers);
  h.set(SITE_HEADER, site);
  return h;
}

/** B2B-domain testing only: remember which test shop is open, for /api/storefront calls. */
function rememberTestSite(res: NextResponse, site: WebSite) {
  res.cookies.set(SITE_COOKIE, site, { path: "/", sameSite: "lax", httpOnly: true });
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
  matcher: ["/((?!_next/|.*\\.[\\w]+$).*)", "/sitemap.xml", "/robots.txt", "/champika/sitemap.xml", "/champika/robots.txt"],
};
