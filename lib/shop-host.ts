import { SHOP_HOSTS } from "@/app/config/business-constants";

/** Public shop address used in the sitemap, SEO tags and shared links. */
export const SHOP_URL = "https://bkwiringbadukade.lk";

/** Extra shop hosts for local testing, e.g. SHOP_EXTRA_HOSTS=shop.localhost */
const extraHosts = (process.env.SHOP_EXTRA_HOSTS || "")
  .split(",")
  .map((h) => h.trim().toLowerCase())
  .filter(Boolean);

/** True when the request came in on the shop domain (not the B2B system). */
export function isShopHost(host: string | null | undefined): boolean {
  if (!host) return false;
  const name = host.split(":")[0].toLowerCase();
  return SHOP_HOSTS.includes(name) || extraHosts.includes(name);
}

/**
 * Link prefix for shop pages: "" on the shop domain (bkwiringbadukade.lk/p/x),
 * "/shop" when testing from the B2B domain (b2b.example/shop/p/x).
 */
export function shopBaseFor(host: string | null | undefined): string {
  return isShopHost(host) ? "" : "/shop";
}
