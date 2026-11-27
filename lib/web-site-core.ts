import {
  SHOP_HOST_SITES,
  WEB_SITE_BUSINESS,
  WEB_SITE_PORTAL,
  WEB_SITES,
  type WebSite,
} from "@/app/config/business-constants";

export type { WebSite };

/**
 * Two online shops run on one system: BK Wiring ("bk") and Champika ("champika").
 * Every web_* row carries its `site`, and every request knows which shop it is for:
 *
 * - Public shop pages and /api/storefront: proxy.ts sets the x-web-site request
 *   header from the domain (or, on the B2B domain, from the /shop or /champika path),
 *   overwriting anything the browser sent.
 * - Staff portal (/api/website): the portal sends x-web-site with each request
 *   (webApi() in app/dashboard/office/website/_site.tsx), and
 *   requireWebsiteStaff() checks the user may manage that shop.
 *
 * This file has no server-only imports, so proxy.ts and browser code can use it.
 * Server code reads the current shop with getRequestSite() from lib/web-site.ts.
 */
export const SITE_HEADER = "x-web-site";

/** Cookie used only on the B2B domain while testing, so /api/storefront knows the shop. */
export const SITE_COOKIE = "web_site";

/** Path prefix that serves the Champika shop on the B2B domain (testing before DNS). */
export const CHAMPIKA_TEST_PREFIX = "/champika";

export function parseSite(value: string | null | undefined): WebSite | null {
  return value && (WEB_SITES as string[]).includes(value) ? (value as WebSite) : null;
}

/** The shop served on this host, or null for the B2B system's own domain. */
export function siteForHost(host: string | null | undefined): WebSite | null {
  if (!host) return null;
  const name = host.split(":")[0].toLowerCase();
  return SHOP_HOST_SITES[name] ?? extraHostSites()[name] ?? null;
}

/**
 * Extra shop hosts for local testing:
 * SHOP_EXTRA_HOSTS=shop.localhost (BK) or SHOP_EXTRA_HOSTS=bk.localhost=bk,champika.localhost=champika
 */
function extraHostSites(): Record<string, WebSite> {
  const out: Record<string, WebSite> = {};
  for (const part of (process.env.SHOP_EXTRA_HOSTS || "").split(",")) {
    const [h, s] = part.trim().toLowerCase().split("=");
    if (h) out[h] = parseSite(s) ?? "bk";
  }
  return out;
}

/** Business that owns the shop's orders and invoices. */
export const siteBusinessId = (site: WebSite) => WEB_SITE_BUSINESS[site];

/** Staff portal path for the shop. */
export const sitePortal = (site: WebSite) => WEB_SITE_PORTAL[site];

/** Web order / quote number prefixes per shop. */
export const SITE_ORDER_PREFIX: Record<WebSite, string> = { bk: "WEB", champika: "CHW" };
export const SITE_QUOTE_PREFIX: Record<WebSite, string> = { bk: "WQ", champika: "CHQ" };

/** Stamp the shop on a row (or rows) before insert / upsert into a web_* table. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function withSite(rows: any, site: WebSite): any {
  return Array.isArray(rows) ? rows.map((r) => ({ ...r, site })) : { ...rows, site };
}
