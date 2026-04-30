/**
 * useCachedFetch — always fetches fresh data on mount so pages are up-to-date
 * whenever the user navigates to them.
 *
 * - Every page mount: fetches fresh data from the API.
 * - `refetch()` (used by refresh buttons & post-mutation calls): re-fetches fresh data.
 */

import React, { useState, useEffect, useCallback } from "react";

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
  const [data, setData] = useState<T>(fallback);
  const [loading, setLoading] = useState(!!url);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!url) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Request failed: ${res.status}`);
      const json = (await res.json()) as T;
      setData(json);
    } catch (err: unknown) {
      const errObj = err instanceof Error ? err : new Error(String(err));
      setError(errObj.message);
      if (onError) onError(errObj);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  // Always fetch fresh on mount and whenever the URL changes
  useEffect(() => {
    load();
  }, [load]);

  const refetch = useCallback(() => {
    load();
  }, [load]);

  return { data, loading, error, refetch, setData };
}

// No-op kept for call-site compatibility — no cache to invalidate anymore.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function invalidateCache(_pattern: string): void {}

/**
 * Broadcasts a window event so currently-mounted components that use plain
 * fetch (e.g. the cheque calendar) can immediately re-fetch after a mutation.
 */
export function invalidatePaymentCaches(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("b2b:payment-mutated"));
  }
}
