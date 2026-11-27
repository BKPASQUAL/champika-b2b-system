import { revalidateTag, unstable_cache } from "next/cache";
import { getRequestSite, type WebSite } from "@/lib/web-site";

/**
 * Cross-request cache for the public shop's database reads.
 *
 * Shop pages are dynamic (prices depend on who is logged in), so without this
 * every click re-ran ~8 Supabase queries. Raw public rows (categories, brands,
 * settings, product rows, price rules…) are now kept for SHOP_CACHE_SECONDS
 * and shared by all visitors; per-visitor pricing is still worked out on each
 * request from those rows.
 *
 * Two shops share this cache: each cached read gets the shop ("bk" | "champika")
 * of the current request as its first argument, so it is part of the cache key
 * and every query inside must filter by it.
 *
 * Staff edits in the website admin call refreshShop() so changes show at once.
 * Changes made elsewhere (e.g. main product MRP / cost in the B2B system) show
 * within SHOP_CACHE_SECONDS.
 */
export const SHOP_TAG = "shop";
export const SHOP_CACHE_SECONDS = 60;

export function shopCached<A extends unknown[], R>(
  fn: (site: WebSite, ...args: A) => Promise<R>,
  key: string,
): (...args: A) => Promise<R> {
  const cached = unstable_cache(fn, ["shop-data", key], { revalidate: SHOP_CACHE_SECONDS, tags: [SHOP_TAG] });
  return async (...args: A) => cached(await getRequestSite(), ...args);
}

/** Drop every cached shop read (call after a successful staff write). */
export function refreshShop() {
  try {
    revalidateTag(SHOP_TAG, { expire: 0 });
  } catch {
    // Never fail a save because the cache could not be cleared; it expires on its own.
  }
}
