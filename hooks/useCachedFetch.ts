/**
 * useCachedFetch — module-level cache so data survives navigation between tabs.
 *
 * - First visit: fetches from API and caches the result.
 * - Navigate away and back: returns cached data immediately (no spinner).
 * - `refetch()` (used by refresh buttons & post-mutation calls): always clears
 *   the cache entry and fetches fresh data.
 */

import React, { useState, useEffect, useCallback } from "react";

// Module-level store — lives for the lifetime of the browser session.
const _store = new Map<string, unknown>();

export function useCachedFetch<T>(
  url: string,
  fallback: T,
  onError?: (err: Error) => void
): {
  data: T;
  loading: boolean;
  error: string | null;
  refetch: () => void;
  setData: React.Dispatch<React.SetStateAction<T>>;
} {
  const [data, setData] = useState<T>(() =>
    _store.has(url) ? (_store.get(url) as T) : fallback
  );
  const [loading, setLoading] = useState(!!url && !_store.has(url));
  const [error, setError] = useState<string | null>(null);

  // Internal load — bypasses cache only when `force` is true
  const load = useCallback(
    async (force: boolean) => {
      if (!url) { setLoading(false); return; } // skip when url not yet known
      if (!force && _store.has(url)) {
        setData(_store.get(url) as T);
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Request failed: ${res.status}`);
        const json = (await res.json()) as T;
        _store.set(url, json);
        setData(json);
      } catch (err: unknown) {
        const errObj = err instanceof Error ? err : new Error(String(err));
        setError(errObj.message);
        if (onError) onError(errObj);
      } finally {
        setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [url]
  );

  // Initial mount — use cache when available
  useEffect(() => {
    load(false);
  }, [load]);

  // Exposed refetch — always fetches fresh (used by refresh buttons & post-mutation)
  const refetch = useCallback(() => {
    _store.delete(url);
    load(true);
  }, [url, load]);

  return { data, loading, error, refetch, setData };
}

/**
 * Manually remove cache entries whose key contains `pattern`.
 * Call after a mutation to ensure the next navigation triggers a fresh fetch.
 */
export function invalidateCache(pattern: string): void {
  for (const key of _store.keys()) {
    if (key.includes(pattern)) _store.delete(key);
  }
}

/**
 * Invalidates all caches affected by a payment or invoice mutation, then
 * broadcasts a window event so any currently-mounted components (e.g. the
 * cheque calendar, which uses plain fetch) can immediately re-fetch.
 */
export function invalidatePaymentCaches(): void {
  const patterns = [
    "/api/payments",
    "/api/invoices",
    "/api/orders",
    "/api/admin/calendar",
    "/api/finance/cheques",
  ];
  for (const pattern of patterns) invalidateCache(pattern);

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("b2b:payment-mutated"));
  }
}
