"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import type { ShopCategory } from "@/lib/shop-data";
import { AllCategories } from "../../_components/AllCategories";

/** Search box + filter pills over the category cards. */
export function CategoriesBrowser({ tree, base }: { tree: ShopCategory[]; base: string }) {
  const [picked, setPicked] = useState<string>("all");
  const [query, setQuery] = useState("");

  // The cards are the sub categories; a main category with no subs is its own card group.
  const cards = useMemo(() => tree.flatMap((m) => (m.children.length ? m.children : [m])), [tree]);
  const total = useMemo(() => tree.reduce((n, m) => n + m.productCount, 0), [tree]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const keep = (s: ShopCategory) =>
      (picked === "all" || s.id === picked) &&
      (!q || s.name.toLowerCase().includes(q) || s.families.some((f) => f.name.toLowerCase().includes(q)));
    return tree
      .map((m) => (m.children.length ? { ...m, children: m.children.filter(keep) } : keep(m) ? m : null))
      .filter((m): m is ShopCategory => !!m && (m.children.length > 0 || !tree.some((t) => t.id === m.id && t.children.length)));
  }, [tree, picked, query]);

  const pill = (id: string, label: string, count: number) => {
    const on = picked === id;
    return (
      <button
        key={id}
        type="button"
        onClick={() => setPicked(id)}
        aria-pressed={on}
        className={`inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-bold transition ${
          on
            ? "border-(--s-btn) bg-(--s-btn) text-(--s-btn-ink)"
            : "border-(--s-line) bg-(--s-surface) text-(--s-ink-2) hover:border-slate-400"
        }`}
      >
        {label}
        <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${on ? "bg-white/15" : "bg-(--s-soft) text-(--s-muted)"}`}>{count}</span>
      </button>
    );
  };

  return (
    <>
      <div className="mb-[22px] flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="shop-display">All categories</h1>
          <p className="mt-2.5 max-w-xl text-[15px] text-(--s-ink-2)">
            Browse every wiring category — cables &amp; wires, protection, enclosures, switches &amp; sockets.
          </p>
        </div>
        <label className="flex h-12 w-full items-center gap-2.5 rounded-[14px] border border-(--s-line) bg-(--s-surface) px-4 text-(--s-muted) focus-within:border-blue-500 sm:w-[340px]">
          <Search className="h-[18px] w-[18px] shrink-0" />
          <span className="sr-only">Search categories</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search categories or brands"
            className="min-w-0 flex-1 bg-transparent text-sm text-(--s-ink) outline-none placeholder:text-(--s-muted)"
          />
        </label>
      </div>

      {cards.length > 1 && (
        <div className="mb-[26px] flex flex-wrap gap-2">
          {pill("all", "All", total)}
          {cards.map((c) => pill(c.id, c.name, c.productCount))}
        </div>
      )}

      {filtered.length ? (
        <AllCategories tree={filtered} base={base} />
      ) : (
        <p className="rounded-2xl border border-dashed border-(--s-line) p-10 text-center text-sm text-(--s-muted)">
          No categories match “{query}”.
        </p>
      )}
    </>
  );
}
