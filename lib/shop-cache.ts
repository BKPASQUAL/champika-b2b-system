import { revalidateTag, unstable_cache } from "next/cache";

/**
 * Cross-request cache for the public shop's database reads.
 *
 * Shop pages are dynamic (prices depend on who is logged in), so without this
 * every click re-ran ~8 Supabase queries. Raw public rows (categories, brands,
 * settings, product rows, price rules…) are now kept for SHOP_CACHE_SECONDS
 * and shared by all visitors; per-visitor pricing is still worked out on each
 * request from those rows.
 *
 * Staff edits in the website admin call refreshShop() so changes show at once.
 * Changes made elsewhere (e.g. main product MRP / cost in the B2B system) show
 * within SHOP_CACHE_SECONDS.
 */
export const SHOP_TAG = "shop";
export const SHOP_CACHE_SECONDS = 60;

export function shopCached<A extends unknown[], R>(fn: (...args: A) => Promise<R>, key: string): (...args: A) => Promise<R> {
  return unstable_cache(fn, ["shop-data", key], { revalidate: SHOP_CACHE_SECONDS, tags: [SHOP_TAG] });
}

/** Drop every cached shop read (call after a successful staff write). */
export function refreshShop() {
  try {
    revalidateTag(SHOP_TAG, { expire: 0 });
  } catch {
    // Never fail a save because the cache could not be cleared; it expires on its own.
  }
}
