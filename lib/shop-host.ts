import type { WebSite } from "@/app/config/business-constants";
import { CHAMPIKA_TEST_PREFIX, siteForHost } from "@/lib/web-site-core";

/** BK Wiring public shop address. */
export const SHOP_URL = "https://bkwiringbadukade.lk";

/**
 * Public address of each shop. Champika's domain is set with
 * NEXT_PUBLIC_CHAMPIKA_SHOP_URL once it is known (e.g. https://champika.lk);
 * until then links use the B2B domain + /champika (see getShopUrl).
 */
export const SITE_URLS: Record<WebSite, string> = {
  bk: SHOP_URL,
  champika: (process.env.NEXT_PUBLIC_CHAMPIKA_SHOP_URL || "").replace(/\/$/, ""),
};

/** True when the request came in on a shop domain (not the B2B system). */
export function isShopHost(host: string | null | undefined): boolean {
  return siteForHost(host) !== null;
}

/**
 * Link prefix for shop pages: "" on the shop's own domain (bkwiringbadukade.lk/p/x),
 * "/shop" (BK) or "/champika" (Champika) when testing from the B2B domain.
 */
export function shopBaseFor(host: string | null | undefined, site: WebSite = "bk"): string {
  if (isShopHost(host)) return "";
  return site === "champika" ? CHAMPIKA_TEST_PREFIX : "/shop";
}

/**
 * Absolute address of a shop for links, sitemap and SEO.
 * Uses the configured domain; otherwise the current host + link prefix.
 */
export function shopUrlFor(site: WebSite, host: string | null | undefined): string {
  if (SITE_URLS[site]) return SITE_URLS[site];
  if (!host) return "";
  const proto = host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https";
  return `${proto}://${host}${shopBaseFor(host, site)}`;
}
