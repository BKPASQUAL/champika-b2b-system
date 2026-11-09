"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Loader2, Search, X } from "lucide-react";

/**
 * "Search in these products" box for a listing page. Filters as you type by
 * updating ?find= in the address (so the result can be shared or refreshed).
 */
export function ListingSearch({ placeholder = "Search in these products…" }: { placeholder?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [value, setValue] = useState(params.get("find") || "");
  const [pending, startTransition] = useTransition();
  const first = useRef(true);

  // Keep the box in step when the address changes (e.g. "Clear filters").
  useEffect(() => {
    setValue(params.get("find") || "");
  }, [params]);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const t = setTimeout(() => {
      const next = new URLSearchParams(params.toString());
      const v = value.trim();
      if (v === (params.get("find") || "")) return;
      v ? next.set("find", v) : next.delete("find");
      const qs = next.toString();
      startTransition(() => router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false }));
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <div className="relative w-full">
      <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-(--s-muted)" />
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        type="search"
        placeholder={placeholder}
        aria-label="Search in these products"
        className="h-11 w-full rounded-xl border border-(--s-line) bg-(--s-surface) pl-10 pr-10 text-sm text-(--s-ink) outline-none transition placeholder:text-(--s-muted) focus:border-(--s-accent) focus:ring-4 focus:ring-(--s-accent-soft)"
      />
      <span className="absolute right-3 top-1/2 -translate-y-1/2">
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin text-(--s-muted)" />
        ) : value ? (
          <button type="button" aria-label="Clear search" onClick={() => setValue("")} className="flex text-(--s-muted) hover:text-(--s-ink)">
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </span>
    </div>
  );
}
