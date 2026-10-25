"use client";

/**
 * useCachedFetch — Stale-While-Revalidate (SWR) caching with in-flight deduplication
 * and instant cross-page navigation.
 *
 * Performance features:
 * 1. Instant 0ms Render: Previously fetched data renders immediately from memory without spinners.
 * 2. Background Revalidation (SWR): Silently updates data in the background if older than 15s.
 * 3. In-flight Deduplication: Multiple components mounting simultaneously share the same network request.
 * 4. Zero Data Loss / Mutation Aware: Cache invalidation events immediately refresh data when
 *    invoices, payments, or finance transactions are created/updated.
 */

import React, { useState, useEffect, useCallback, useRef } from "react";

interface CacheEntry<T = unknown> {
  data: T;
  timestamp: number;
}

// Module-level in-memory cache and in-flight promise map (persists across Next.js client navigations)
const _cache = new Map<string, CacheEntry<unknown>>();
const _inflight = new Map<string, Promise<unknown>>();

// Cache timing thresholds (in milliseconds)
const FRESH_WINDOW_MS = 15_000;         // 15 seconds: completely fresh, return instantly without network
const MAX_CACHE_AGE_MS = 5 * 60_000;    // 5 minutes: serve cached instantly, revalidate in background

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
  const cached = url ? _cache.get(url) : undefined;
  const isUsable = cached && Date.now() - cached.timestamp < MAX_CACHE_AGE_MS;

  const [data, setDataState] = useState<T>(() => {
    if (isUsable) return cached.data as T;
    return fallback;
  });

  // If we already have a usable cached copy, do NOT block the screen with a spinner!
  const [loading, setLoading] = useState<boolean>(() => {
    if (!url) return false;
    return !isUsable;
  });

  const [error, setError] = useState<string | null>(null);
  const isMountedRef = useRef(true);

  // Sync state if url changes and we already have a cached copy
  useEffect(() => {
    if (url && _cache.has(url)) {
      const entry = _cache.get(url)!;
      if (Date.now() - entry.timestamp < MAX_CACHE_AGE_MS) {
        setDataState(entry.data as T);
        setLoading(false);
      }
    }
  }, [url]);

  const load = useCallback(
    async (force = false) => {
      if (!url) {
        if (isMountedRef.current) setLoading(false);
        return;
      }

      const existing = _cache.get(url);
      const now = Date.now();

      // If data is freshly cached and not forced, return immediately without network
      if (!force && existing && now - existing.timestamp < FRESH_WINDOW_MS) {
        if (isMountedRef.current) {
          setDataState(existing.data as T);
          setLoading(false);
        }
        return;
      }

      // If we don't have usable cache, show loading spinner.
      // If we have cached data, keep displaying it and revalidate silently in the background (SWR).
      if (!existing || now - existing.timestamp >= MAX_CACHE_AGE_MS || force) {
        if (isMountedRef.current && !existing) {
          setLoading(true);
        }
      }
      if (isMountedRef.current) setError(null);

      try {
        let fetchPromise = _inflight.get(url);

        if (!fetchPromise || force) {
          fetchPromise = fetch(url, {
            cache: force ? "no-store" : "default",
          }).then(async (res) => {
            if (!res.ok) throw new Error(`Request failed with status ${res.status}`);
            return (await res.json()) as T;
          });

          _inflight.set(url, fetchPromise);
        }

        const json = (await fetchPromise) as T;
        _cache.set(url, { data: json, timestamp: Date.now() });

        if (isMountedRef.current) {
          setDataState(json);
          setError(null);
        }
      } catch (err: unknown) {
        const errObj = err instanceof Error ? err : new Error(String(err));
        if (isMountedRef.current) {
          setError(errObj.message);
          // Only report error to caller if there was no cached data to show
          if (!existing && onError) onError(errObj);
        }
      } finally {
        _inflight.delete(url);
        if (isMountedRef.current) {
          setLoading(false);
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [url]
  );

  useEffect(() => {
    isMountedRef.current = true;
    load(false);
    return () => {
      isMountedRef.current = false;
    };
  }, [load]);

  const refetch = useCallback(() => {
    if (url) _cache.delete(url);
    load(true);
  }, [url, load]);

  // Wrapper for setData so local optimistic updates persist in the cache
  const setData: React.Dispatch<React.SetStateAction<T>> = useCallback(
    (action) => {
      setDataState((prev) => {
        const next = typeof action === "function" ? (action as (prevState: T) => T)(prev) : action;
        if (url) {
          _cache.set(url, { data: next, timestamp: Date.now() });
        }
        return next;
      });
    },
    [url]
  );

  // Automatic revalidation on mutation events
  useEffect(() => {
    if (typeof window === "undefined" || !url) return;

    const handleCacheInvalidation = (e: Event) => {
      const customEvent = e as CustomEvent<{ pattern?: string }>;
      const pattern = customEvent.detail?.pattern;
      if (!pattern || url.includes(pattern)) {
        load(true);
      }
    };

    const handlePaymentMutation = () => {
      const paymentPatterns = [
        "/api/payments",
        "/api/invoices",
        "/api/orders",
        "/api/admin/calendar",
        "/api/finance/cheques",
        "/api/cheques",
        "/api/customers",
        "/api/targets",
      ];
      if (paymentPatterns.some((p) => url.includes(p))) {
        load(true);
      }
    };

    const handleFinanceMutation = () => {
      const financePatterns = [
        "/api/finance",
        "/api/bank-statements",
        "/api/salaries",
        "/api/expenses",
      ];
      if (financePatterns.some((p) => url.includes(p))) {
        load(true);
      }
    };

    window.addEventListener("b2b:cache-invalidated", handleCacheInvalidation);
    window.addEventListener("b2b:payment-mutated", handlePaymentMutation);
    window.addEventListener("b2b:finance-mutated", handleFinanceMutation);

    return () => {
      window.removeEventListener("b2b:cache-invalidated", handleCacheInvalidation);
      window.removeEventListener("b2b:payment-mutated", handlePaymentMutation);
      window.removeEventListener("b2b:finance-mutated", handleFinanceMutation);
    };
  }, [url, load]);

  return { data, loading, error, refetch, setData };
}

/**
 * Manually removes cache entries matching `pattern`.
 * Broadcasts an event so any currently mounted components immediately refresh.
 */
export function invalidateCache(pattern?: string): void {
  if (pattern) {
    for (const key of _cache.keys()) {
      if (key.includes(pattern)) _cache.delete(key);
    }
  } else {
    _cache.clear();
  }

  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("b2b:cache-invalidated", { detail: { pattern } })
    );
  }
}

/**
 * Broadcasts an invalidation event for all payment & invoice related caches.
 */
export function invalidatePaymentCaches(): void {
  const patterns = [
    "/api/payments",
    "/api/invoices",
    "/api/orders",
    "/api/admin/calendar",
    "/api/finance/cheques",
    "/api/cheques",
    "/api/customers",
    "/api/targets",
  ];
  for (const pattern of patterns) {
    for (const key of _cache.keys()) {
      if (key.includes(pattern)) _cache.delete(key);
    }
  }

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("b2b:payment-mutated"));
    window.dispatchEvent(new CustomEvent("b2b:cache-invalidated", { detail: { pattern: "/api/invoices" } }));
    window.dispatchEvent(new CustomEvent("b2b:cache-invalidated", { detail: { pattern: "/api/payments" } }));
  }
}

/**
 * Broadcasts an invalidation event for all finance & banking related caches.
 */
export function invalidateFinanceCaches(): void {
  const patterns = [
    "/api/finance",
    "/api/bank-statements",
    "/api/salaries",
    "/api/expenses",
  ];
  for (const pattern of patterns) {
    for (const key of _cache.keys()) {
      if (key.includes(pattern)) _cache.delete(key);
    }
  }

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("b2b:finance-mutated"));
    window.dispatchEvent(new CustomEvent("b2b:cache-invalidated", { detail: { pattern: "/api/finance" } }));
  }
}
