"use client";

import { useEffect, useRef, useCallback } from "react";

const DRAFT_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

export function useFormDraft<T extends object>(
  key: string,
  data: T,
  enabled: boolean
) {
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-save: fires on every render when enabled, debounce throttles actual writes
  useEffect(() => {
    if (!enabled) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      try {
        localStorage.setItem(key, JSON.stringify({ ...data, _savedAt: Date.now() }));
      } catch {
        // localStorage quota exceeded or unavailable — silently skip
      }
    }, 1500);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  });

  const clearDraft = useCallback(() => {
    try {
      localStorage.removeItem(key);
    } catch {}
  }, [key]);

  const loadDraft = useCallback((): (T & { _savedAt: number }) | null => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed._savedAt) return null;
      if (Date.now() - parsed._savedAt > DRAFT_EXPIRY_MS) {
        localStorage.removeItem(key);
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  }, [key]);

  return { clearDraft, loadDraft };
}
