"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  ImageOff,
  LayoutGrid,
  ListChecks,
  Loader2,
  Lock,
  MapPin,
  Minus,
  Plus,
  Search,
  Tag,
  ClipboardList,
  Trash2,
  X,
  ZoomIn,
} from "lucide-react";
import { toast } from "sonner";
import { searchWords } from "@/lib/web-search";
import { MAX_QTY, useShop } from "../_components/ShopContext";
import { QuoteFromCart } from "../_components/QuoteFromCart";
import { rs } from "../_components/format";
import { BrandCompare, type CompareOther } from "../_components/BrandCompare";

export type QuickOrderItem = {
  id: string;
  slug: string;
  name: string;
  image: string | null;
  brand: string | null;
  brandId: string | null;
  categoryIds: string[];
  mrp: number;
  price: number;
  discountPct: number;
  available: boolean;
  sortOrder: number;
  createdAt: string;
  searchKey: string;
};

export type QuickOrderBrand = {
  id: string;
  name: string;
  logoUrl: string | null;
  count: number;
};

type Line = {
  id: string;
  slug: string;
  name: string;
  image: string | null;
  brand: string | null;
  price: number;
  qty: number;
  lineTotal: number;
  available: boolean;
  /** Same item from other brands (cheapest first). */
  others?: CompareOther[];
};

type SortKey = "popular" | "name_asc" | "name_desc" | "brand_asc" | "price_asc" | "price_desc" | "discount_desc";

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "popular", label: "Recommended" },
  { key: "name_asc", label: "Item Name: A → Z" },
  { key: "name_desc", label: "Item Name: Z → A" },
  { key: "brand_asc", label: "Brand: A → Z" },
  { key: "price_asc", label: "Price: Low → High" },
  { key: "price_desc", label: "Price: High → Low" },
  { key: "discount_desc", label: "Biggest Discount" },
];

const clamp = (n: number) => Math.max(1, Math.min(MAX_QTY, Math.floor(n) || 1));
const EMPTY_ITEMS: QuickOrderItem[] = [];
const EMPTY_BRANDS: QuickOrderBrand[] = [];

/**
 * Quick Order: full items table with product photos, instant search,
 * category + brand filters, column sorting, and live order list on the right.
 */
export function QuickOrder({
  categories,
  brands = EMPTY_BRANDS,
  items = EMPTY_ITEMS,
}: {
  categories: { id: string; name: string; count?: number }[];
  brands?: QuickOrderBrand[];
  items?: QuickOrderItem[];
}) {
  const { cart, ready, add, setQty, remove, clear, replace, href } = useShop();
  const input = useRef<HTMLInputElement>(null);

  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string | null>(null);
  const [brandId, setBrandId] = useState<string | null>(null);
  const [sort, setSort] = useState<SortKey>("popular");
  const [qtys, setQtys] = useState<Record<string, number>>({});
  const [preview, setPreview] = useState<QuickOrderItem | null>(null);
  // Phones: show items as a list (default) or a 2-column grid. Remembered on this device.
  // Phones: switch between the items and "My list" (items shown by default).
  const [tab, setTab] = useState<"items" | "list">("items");
  const tabsBox = useRef<HTMLDivElement>(null);
  const showTab = (t: "items" | "list") => {
    setTab(t);
    const top = tabsBox.current?.getBoundingClientRect().top ?? 0;
    if (top < 0) tabsBox.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  };
  const [list, setList] = useState<{ lines: Line[]; total: number; deliveryFee: number; subtotal: number; savings?: number } | null>(null);

  // Instant client-side filter + sort across all items.
  const filtered = useMemo(() => {
    const words = searchWords(q);
    let out = items;

    if (cat) {
      out = out.filter((p) => p.categoryIds.includes(cat));
    }
    if (brandId) {
      out = out.filter((p) => p.brandId === brandId);
    }
    if (words.length > 0) {
      out = out.filter((p) => words.every((w) => p.searchKey.includes(w)));
    }

    const copy = [...out];
    switch (sort) {
      case "name_asc":
        copy.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case "name_desc":
        copy.sort((a, b) => b.name.localeCompare(a.name));
        break;
      case "brand_asc":
        copy.sort((a, b) => (a.brand || "zzz").localeCompare(b.brand || "zzz") || a.name.localeCompare(b.name));
        break;
      case "price_asc":
        copy.sort((a, b) => (a.price || Infinity) - (b.price || Infinity));
        break;
      case "price_desc":
        copy.sort((a, b) => (b.price || 0) - (a.price || 0));
        break;
      case "discount_desc":
        copy.sort((a, b) => (b.discountPct || 0) - (a.discountPct || 0) || (a.price || 0) - (b.price || 0));
        break;
      default:
        // Keep server popular ordering (available first, sortOrder, newest).
        break;
    }
    return copy;
  }, [items, q, cat, brandId, sort]);

  // ---- Pages: 12 items at a time (customer can pick 24 / 48).
  const [perPage, setPerPage] = useState(12);
  const [page, setPage] = useState(1);
  const tableBox = useRef<HTMLDivElement>(null);
  const pages = Math.max(1, Math.ceil(filtered.length / perPage));
  const current = Math.min(page, pages);
  const pageItems = filtered.slice((current - 1) * perPage, current * perPage);
  const from = filtered.length ? (current - 1) * perPage + 1 : 0;
  const to = Math.min(current * perPage, filtered.length);
  // New search / filter / sort → back to page 1.
  useEffect(() => setPage(1), [q, cat, brandId, sort, perPage]);
  const goTo = (p: number) => {
    setPage(Math.min(Math.max(1, p), pages));
    // Bring the top of the table into view.
    tableBox.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  };

  // Price the list from the server whenever it changes.
  useEffect(() => {
    if (!ready) return;
    if (!cart.length) {
      setList({ lines: [], total: 0, deliveryFee: 0, subtotal: 0, savings: 0 });
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch("/api/storefront/cart", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items: cart }),
          signal: ctrl.signal,
        });
        const json = await res.json();
        if (res.ok) setList(json);
      } catch {
        /* keep the last list */
      }
    }, 250);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [cart, ready]);

  // Close image preview on Escape.
  useEffect(() => {
    if (!preview) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPreview(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [preview]);

  const inList = (id: string) => cart.find((c) => c.id === id)?.qty || 0;
  const qtyFor = (id: string) => qtys[id] ?? 1;

  const addHit = (h: QuickOrderItem) => {
    const n = qtyFor(h.id);
    add(h.id, n);
    toast.success(`${n} × added to your list`, { description: h.name });
    setQtys((x) => ({ ...x, [h.id]: 1 }));
  };

  const toggleHeaderSort = (col: "name" | "brand" | "price") => {
    if (col === "name") setSort((s) => (s === "name_asc" ? "name_desc" : "name_asc"));
    if (col === "brand") setSort((s) => (s === "brand_asc" ? "popular" : "brand_asc"));
    if (col === "price") setSort((s) => (s === "price_asc" ? "price_desc" : "price_asc"));
  };

  const hasFilters = Boolean(q.trim() || cat || brandId || sort !== "popular");
  const count = cart.reduce((s, l) => s + l.qty, 0);
  const hasList = ready && count > 0;
  const lines = list?.lines || [];

  return (
    <div className="mx-auto px-3 pt-4 pb-32 sm:px-4 md:px-6 md:py-8 lg:pb-8 xl:px-10">
      {/* Header banner */}
      <div className="mb-4 flex flex-col justify-between gap-2 rounded-2xl border border-(--s-line) bg-(--s-surface) p-4 shadow-[0_4px_20px_-6px_rgba(15,23,42,0.05)] sm:flex-row sm:items-center sm:gap-4 md:mb-6 md:rounded-3xl md:p-5 md:px-6">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-xl font-extrabold tracking-tight text-(--s-ink) md:text-2xl">Quick order</h1>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[12.5px] font-bold text-emerald-600 dark:text-emerald-400">
              <MapPin className="h-3 w-3" /> Galle area delivery
            </span>
          </div>
          <ol className="mt-2.5 hidden flex-wrap sm:flex gap-2 text-xs font-medium text-(--s-ink-2)">
            {["Search or filter items", "Set quantity", "Press Add to build your list"].map((s, i) => (
              <li key={s} className="inline-flex items-center gap-1.5 rounded-full bg-(--s-soft) py-1 pl-1.5 pr-3">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-r from-blue-600 to-blue-500 text-[12.5px] font-bold text-white shadow-xs">
                  {i + 1}
                </span>
                {s}
              </li>
            ))}
          </ol>
        </div>
        <div className="text-xs font-medium text-(--s-muted) sm:text-right">
          <span className="sm:hidden">Search, set quantity, press Add · </span>
          Showing <strong className="font-extrabold text-(--s-ink)">{filtered.length}</strong> of{" "}
          <strong className="font-bold text-(--s-ink-2)">{items.length}</strong> {items.length === 1 ? "item" : "items"}
        </div>
      </div>

      {/* Phones & tablets: switch between the items and My list */}
      <div ref={tabsBox} className="mb-4 scroll-mt-28 lg:hidden">
        <div role="tablist" aria-label="Show" className="grid grid-cols-2 gap-1 rounded-2xl bg-(--s-soft) p-1 ring-1 ring-(--s-line)">
          {(
            [
              ["items", "Items", LayoutGrid, filtered.length],
              ["list", "My list", ListChecks, count],
            ] as const
          ).map(([key, lbl, Icon, n]) => {
            const on = tab === key;
            return (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => showTab(key)}
                className={`flex h-11 cursor-pointer items-center justify-center gap-2 rounded-xl text-[14px] font-bold transition ${
                  on ? "bg-(--s-surface) text-blue-600 shadow-[0_2px_8px_-2px_rgba(15,23,42,0.15)]" : "text-(--s-muted) hover:text-(--s-ink)"
                }`}
              >
                <Icon className="h-4 w-4" /> {lbl}
                <span
                  className={`rounded-full px-2 text-[12px] font-extrabold ${
                    on ? "bg-blue-600 text-white" : "bg-(--s-surface) text-(--s-muted) ring-1 ring-(--s-line)"
                  }`}
                >
                  {n}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* The list column only appears once something has been added. */}
      <div className={`grid gap-6 xl:gap-8 ${hasList ? "lg:grid-cols-[minmax(0,1fr)_370px] xl:grid-cols-[minmax(0,1fr)_400px]" : ""}`}>
        {/* ---------- Left: search, filters, sort & items table ---------- */}
        <div className={`min-w-0 space-y-4 ${tab === "list" ? "hidden lg:block" : ""}`}>
          {/* Controls card */}
          <div className="space-y-3 rounded-2xl border border-(--s-line) bg-(--s-surface) p-3 sm:p-4 md:space-y-3.5 md:rounded-3xl shadow-[0_4px_20px_-6px_rgba(15,23,42,0.05)]">
            {/* Search + Sort row */}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-blue-600" />
                <input
                  ref={input}
                  autoFocus
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  type="text"
                  placeholder="Search name, brand or size… e.g. 1/113"
                  className="h-11 w-full rounded-2xl border border-(--s-line) bg-(--s-bg) pl-11 pr-10 text-sm font-medium text-(--s-ink) outline-none transition placeholder:font-normal placeholder:text-(--s-muted) focus:border-blue-600 focus:bg-(--s-surface) focus:ring-4 focus:ring-blue-500/15"
                />
                {q && (
                  <button
                    type="button"
                    aria-label="Clear search"
                    onClick={() => {
                      setQ("");
                      input.current?.focus();
                    }}
                    className="absolute right-2.5 top-1/2 flex h-7 w-7 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-(--s-soft) text-(--s-muted) transition hover:bg-rose-500/10 hover:text-(--s-bad)"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2 sm:shrink-0">
                <SortMenu value={sort} onChange={setSort} />

                {hasFilters && (
                  <button
                    type="button"
                    onClick={() => {
                      setQ("");
                      setCat(null);
                      setBrandId(null);
                      setSort("popular");
                    }}
                    className="h-11 shrink-0 cursor-pointer rounded-2xl bg-rose-500/10 px-3.5 text-xs font-bold text-(--s-bad) transition hover:bg-rose-500/20"
                  >
                    Reset
                  </button>
                )}
              </div>
            </div>

            {/* Phones: category & brand as two dropdowns side by side */}
            {(categories.length > 0 || brands.length > 0) && (
              <div className="grid grid-cols-2 gap-2 sm:hidden">
                {categories.length > 0 && (
                  <PickMenu
                    label="Category"
                    icon={<LayoutGrid className="h-3.5 w-3.5 shrink-0 text-blue-600" />}
                    value={cat ?? ""}
                    options={[
                      { key: "", label: "All categories", count: items.length },
                      ...categories.map((c) => ({ key: c.id, label: c.name, count: c.count })),
                    ]}
                    onChange={(k) => setCat(k || null)}
                    className={brands.length ? "" : "col-span-2"}
                    menuClass={brands.length ? "right-auto w-[calc(200%+0.5rem)]" : ""}
                  />
                )}
                {brands.length > 0 && (
                  <PickMenu
                    label="Brand"
                    icon={<Tag className="h-3.5 w-3.5 shrink-0 text-blue-600" />}
                    value={brandId ?? ""}
                    options={[
                      { key: "", label: "All brands" },
                      ...brands.map((b) => ({ key: b.id, label: b.name, count: b.count, logo: b.logoUrl })),
                    ]}
                    onChange={(k) => setBrandId(k || null)}
                    className={categories.length ? "" : "col-span-2"}
                    menuClass={categories.length ? "left-auto w-[calc(200%+0.5rem)]" : ""}
                  />
                )}
              </div>
            )}

            {/* Category filter chips (tablet & desktop) */}
            {categories.length > 0 && (
              <div className="hidden flex-wrap items-center gap-1.5 sm:flex">
                <span className="mr-1 text-[12.5px] font-bold uppercase tracking-wider text-(--s-muted)">Category:</span>
                <button
                  type="button"
                  onClick={() => setCat(null)}
                  className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition ${
                    !cat
                      ? "bg-(--s-ink) text-(--s-bg) shadow-xs"
                      : "bg-(--s-bg) text-(--s-ink-2) ring-1 ring-(--s-line) hover:text-(--s-ink)"
                  }`}
                >
                  All
                  <span className={`rounded-full px-1.5 text-[12px] font-bold ${!cat ? "bg-blue-500 text-white" : "bg-(--s-surface) text-(--s-muted)"}`}>
                    {items.length}
                  </span>
                </button>
                {categories.map((c) => {
                  const on = cat === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setCat(on ? null : c.id)}
                      className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition ${
                        on
                          ? "bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-xs"
                          : "bg-(--s-bg) text-(--s-ink-2) ring-1 ring-(--s-line) hover:ring-blue-500/40 hover:text-(--s-ink)"
                      }`}
                    >
                      {c.name}
                      {c.count !== undefined && (
                        <span className={`rounded-full px-1.5 text-[12px] font-bold ${on ? "bg-white/20 text-white" : "bg-(--s-surface) text-(--s-muted)"}`}>
                          {c.count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Brand filter chips (tablet & desktop) */}
            {brands.length > 0 && (
              <div className="hidden flex-wrap items-center gap-1.5 border-t border-(--s-line) pt-3 sm:flex">
                <span className="mr-1 text-[12.5px] font-bold uppercase tracking-wider text-(--s-muted)">Brand:</span>
                <button
                  type="button"
                  onClick={() => setBrandId(null)}
                  className={`inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-xl px-3 text-xs font-semibold transition ${
                    !brandId
                      ? "bg-gradient-to-r from-blue-600 to-blue-500 font-bold text-white shadow-xs"
                      : "bg-(--s-bg) text-(--s-ink-2) ring-1 ring-(--s-line) hover:text-(--s-ink)"
                  }`}
                >
                  All brands
                </button>
                {brands.map((b) => {
                  const on = brandId === b.id;
                  return (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => setBrandId(on ? null : b.id)}
                      className={`inline-flex h-8 cursor-pointer items-center gap-2 rounded-xl px-3 text-xs font-semibold transition ${
                        on
                          ? "bg-gradient-to-r from-blue-600 to-blue-500 font-bold text-white shadow-xs"
                          : "bg-(--s-bg) text-(--s-ink-2) ring-1 ring-(--s-line) hover:ring-blue-500/40 hover:text-(--s-ink)"
                      }`}
                    >
                      {b.logoUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={b.logoUrl} alt="" className="h-4 max-w-12 rounded-xs bg-white px-0.5 object-contain" />
                      )}
                      <span>{b.name}</span>
                      <span className={`rounded-full px-1.5 text-[12px] font-bold ${on ? "bg-white/20 text-white" : "bg-(--s-surface) text-(--s-muted)"}`}>
                        {b.count}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Items Table */}
          <div className="overflow-hidden rounded-2xl border border-(--s-line) bg-(--s-surface) shadow-[0_4px_20px_-6px_rgba(15,23,42,0.06)] md:rounded-3xl">
            {filtered.length > 0 ? (
              <div ref={tableBox} className="scroll-mt-32 overflow-x-auto">
                <table className="w-full border-collapse text-left">
                  <thead className="hidden border-b border-(--s-line) bg-(--s-soft)/60 text-[12.5px] font-extrabold uppercase tracking-wider text-(--s-muted) md:table-header-group">
                    <tr>
                      <th className="w-20 py-3.5 pl-5 pr-2">Image</th>
                      <th className="px-3 py-3.5">
                        <button
                          type="button"
                          onClick={() => toggleHeaderSort("name")}
                          className="inline-flex cursor-pointer items-center gap-1 transition hover:text-(--s-ink)"
                        >
                          Item Description
                          <SortIcon active={sort === "name_asc" || sort === "name_desc"} asc={sort === "name_asc"} />
                        </button>
                      </th>
                      <th className="w-32 px-3 py-3.5">
                        <button
                          type="button"
                          onClick={() => toggleHeaderSort("brand")}
                          className="inline-flex cursor-pointer items-center gap-1 transition hover:text-(--s-ink)"
                        >
                          Brand
                          <SortIcon active={sort === "brand_asc"} asc />
                        </button>
                      </th>
                      <th className="w-40 px-3 py-3.5 text-right">
                        <button
                          type="button"
                          onClick={() => toggleHeaderSort("price")}
                          className="ml-auto inline-flex cursor-pointer items-center gap-1 transition hover:text-(--s-ink)"
                        >
                          Unit Price
                          <SortIcon active={sort === "price_asc" || sort === "price_desc"} asc={sort === "price_asc"} />
                        </button>
                      </th>
                      <th className="w-36 px-3 py-3.5 text-center">Quantity</th>
                      <th className="w-36 py-3.5 pl-2 pr-5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-(--s-line)">
                    {pageItems.map((h) => {
                      const have = inList(h.id);
                      return (
                        <tr
                          key={h.id}
                          className={`grid grid-cols-[1fr_auto] items-center transition md:table-row ${
                            have > 0 ? "bg-blue-500/[0.04]" : "hover:bg-(--s-soft)/40"
                          }`}
                        >
                          {/* Image cell (click to zoom full photo easily) */}
                          <td className="hidden py-3 pl-5 pr-2 align-middle md:table-cell">
                            <button
                              type="button"
                              onClick={() => h.image && setPreview(h)}
                              title={h.image ? "Click to enlarge image" : h.name}
                              className={`group relative flex h-15 w-15 items-center justify-center overflow-hidden rounded-2xl border border-(--s-line) bg-(--s-img) ${
                                h.image ? "cursor-zoom-in" : ""
                              }`}
                            >
                              {h.image ? (
                                <>
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img src={h.image} alt={h.name} loading="lazy" className="h-full w-full object-cover transition group-hover:scale-105" />
                                  <span className="absolute inset-0 flex items-center justify-center bg-slate-950/40 text-white opacity-0 transition group-hover:opacity-100">
                                    <ZoomIn className="h-4 w-4" />
                                  </span>
                                </>
                              ) : (
                                <ImageOff className="h-5 w-5 text-slate-300" />
                              )}
                              {h.discountPct > 0 && (
                                <span className="absolute left-1 top-1 rounded-full bg-rose-600 px-1.5 py-0.2 text-[11px] font-extrabold text-white shadow-xs">
                                  -{h.discountPct}%
                                </span>
                              )}
                            </button>
                          </td>

                          {/* Item Description (plus mobile compact header) */}
                          <td className="col-span-2 block px-3 pt-3 pb-2 align-middle sm:px-4 md:table-cell md:px-3 md:py-3.5">
                            <div className="flex items-center gap-3 md:block">
                              {/* Mobile thumbnail */}
                              <button
                                type="button"
                                onClick={() => h.image && setPreview(h)}
                                className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-(--s-line) bg-(--s-img) md:hidden"
                              >
                                {h.image ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={h.image} alt={h.name} loading="lazy" className="h-full w-full object-cover" />
                                ) : (
                                  <ImageOff className="h-5 w-5 text-slate-300" />
                                )}
                                {h.discountPct > 0 && (
                                  <span className="absolute left-1 top-1 rounded-full bg-rose-600 px-1.5 text-[11px] font-extrabold text-white">
                                    -{h.discountPct}%
                                  </span>
                                )}
                              </button>

                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-1.5 md:mb-0.5">
                                  {h.brand && (
                                    <span className="rounded-md bg-(--s-soft) px-1.5 py-0.5 text-[12px] font-bold uppercase tracking-wider text-(--s-muted) md:hidden">
                                      {h.brand}
                                    </span>
                                  )}
                                  {have > 0 && (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[12.5px] font-bold text-emerald-600 dark:text-emerald-400">
                                      <Check className="h-3 w-3 stroke-[2.5]" /> {have} in your list
                                    </span>
                                  )}
                                </div>
                                <Link
                                  href={href(`/p/${h.slug}`)}
                                  target="_blank"
                                  className="line-clamp-2 text-sm font-bold leading-snug text-(--s-ink) transition hover:text-blue-600"
                                >
                                  {h.name}
                                </Link>
                                {/* Mobile price */}
                                <div className="mt-1 flex items-baseline gap-2 md:hidden">
                                  <span className="text-sm font-extrabold text-(--s-ink)">
                                    {h.price ? rs(h.price) : "Ask for price"}
                                  </span>
                                  {h.discountPct > 0 && h.mrp > h.price && (
                                    <span className="text-xs text-(--s-muted) line-through">{rs(h.mrp)}</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Brand cell (desktop) */}
                          <td className="hidden px-3 py-3.5 align-middle md:table-cell">
                            {h.brand ? (
                              <button
                                type="button"
                                onClick={() => h.brandId && setBrandId(brandId === h.brandId ? null : h.brandId)}
                                className="inline-flex cursor-pointer items-center rounded-lg bg-(--s-soft) px-2.5 py-1 text-[12.5px] font-bold uppercase tracking-wider text-(--s-ink-2) transition hover:bg-blue-600 hover:text-white"
                              >
                                {h.brand}
                              </button>
                            ) : (
                              <span className="text-xs text-(--s-muted)">—</span>
                            )}
                          </td>

                          {/* Price cell (desktop) */}
                          <td className="hidden px-3 py-3.5 text-right align-middle md:table-cell">
                            <div className="font-extrabold text-(--s-ink)">{h.price ? rs(h.price) : "Ask for price"}</div>
                            {h.discountPct > 0 && h.mrp > h.price && (
                              <div className="text-xs font-medium text-(--s-muted) line-through">{rs(h.mrp)}</div>
                            )}
                          </td>

                          {/* Quantity cell */}
                          <td className="block pb-3 pl-[80px] align-middle sm:pl-[84px] md:table-cell md:px-3 md:py-3.5 md:text-center">
                            {h.available && h.price ? (
                              <div className="inline-flex h-10 items-center rounded-xl border border-(--s-line) bg-(--s-bg) md:h-9">
                                <button
                                  type="button"
                                  aria-label="Less"
                                  onClick={() => setQtys((x) => ({ ...x, [h.id]: clamp(qtyFor(h.id) - 1) }))}
                                  className="flex h-full w-9 cursor-pointer items-center justify-center rounded-l-xl md:w-8 text-(--s-ink-2) transition hover:bg-(--s-soft) hover:text-(--s-ink)"
                                >
                                  <Minus className="h-3.5 w-3.5" />
                                </button>
                                <input
                                  aria-label="How many"
                                  inputMode="numeric"
                                  value={qtyFor(h.id)}
                                  onChange={(e) => setQtys((x) => ({ ...x, [h.id]: clamp(Number(e.target.value.replace(/\D/g, ""))) }))}
                                  className="h-full w-10 bg-transparent text-center text-sm font-bold text-(--s-ink) outline-none"
                                />
                                <button
                                  type="button"
                                  aria-label="More"
                                  onClick={() => setQtys((x) => ({ ...x, [h.id]: clamp(qtyFor(h.id) + 1) }))}
                                  className="flex h-full w-9 cursor-pointer items-center justify-center rounded-r-xl md:w-8 text-(--s-ink-2) transition hover:bg-(--s-soft) hover:text-(--s-ink)"
                                >
                                  <Plus className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            ) : null}
                          </td>

                          {/* Action cell */}
                          <td className="block pb-3 pl-2 pr-3 text-right sm:pr-4 align-middle md:table-cell md:py-3.5 md:pl-2 md:pr-5">
                            {h.available && h.price ? (
                              <button
                                type="button"
                                onClick={() => addHit(h)}
                                className="inline-flex h-10 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 px-4 text-[13px] md:h-9 font-bold text-white shadow-[0_3px_10px_-2px_rgba(37,99,235,0.4)] transition hover:brightness-110 active:scale-[0.98] md:min-w-[108px] md:text-[14px]"
                              >
                                <Plus className="h-3.5 w-3.5 stroke-[2.5]" /> {have ? "Add more" : "Add"}
                              </button>
                            ) : (
                              <span className="inline-block rounded-full bg-(--s-soft) px-3 py-1 text-xs font-semibold text-(--s-muted)">
                                Call us
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="px-6 py-14 text-center">
                <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-(--s-soft) text-(--s-muted)">
                  <Search className="h-5 w-5" />
                </span>
                <p className="mt-3 font-bold text-(--s-ink)">No items match your filters</p>
                <p className="mt-1 text-sm text-(--s-muted)">Try clearing the search word or choosing another brand/category.</p>
                {hasFilters && (
                  <button
                    type="button"
                    onClick={() => {
                      setQ("");
                      setCat(null);
                      setBrandId(null);
                      setSort("popular");
                    }}
                    className="mt-4 cursor-pointer rounded-full bg-blue-600 px-5 py-2 text-xs font-bold text-white hover:bg-blue-700"
                  >
                    Show all items
                  </button>
                )}
              </div>
            )}

            {/* Pager */}
            {filtered.length > 0 && (
              <div className="flex flex-col items-center gap-3 border-t border-(--s-line) bg-(--s-soft)/50 px-4 py-3 sm:flex-row sm:justify-between md:px-5">
                <div className="text-xs text-(--s-ink-2)">
                  Showing <strong className="text-(--s-ink)">{from}–{to}</strong> of <strong className="text-(--s-ink)">{filtered.length}</strong>{" "}
                  {filtered.length === 1 ? "item" : "items"}
                </div>

                {pages > 1 && (
                  <nav aria-label="Pages" className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => goTo(current - 1)}
                      disabled={current === 1}
                      className="inline-flex h-9 cursor-pointer items-center gap-1 rounded-lg border border-(--s-line) bg-(--s-surface) px-3 text-xs font-semibold text-(--s-ink) transition hover:border-(--s-accent) disabled:cursor-default disabled:opacity-40"
                    >
                      <ChevronLeft className="h-4 w-4" /> Prev
                    </button>
                    {pageNumbers(current, pages).map((p, i) =>
                      p === 0 ? (
                        <span key={`gap${i}`} className="px-1 text-xs text-(--s-muted)">
                          …
                        </span>
                      ) : (
                        <button
                          key={p}
                          type="button"
                          onClick={() => goTo(p)}
                          aria-current={p === current ? "page" : undefined}
                          className={`h-9 min-w-9 cursor-pointer rounded-lg px-2 text-xs font-bold transition ${
                            p === current
                              ? "bg-blue-600 text-white shadow-[0_2px_8px_-2px_rgba(37,99,235,0.6)]"
                              : "border border-(--s-line) bg-(--s-surface) text-(--s-ink) hover:border-(--s-accent)"
                          }`}
                        >
                          {p}
                        </button>
                      ),
                    )}
                    <button
                      type="button"
                      onClick={() => goTo(current + 1)}
                      disabled={current === pages}
                      className="inline-flex h-9 cursor-pointer items-center gap-1 rounded-lg border border-(--s-line) bg-(--s-surface) px-3 text-xs font-semibold text-(--s-ink) transition hover:border-(--s-accent) disabled:cursor-default disabled:opacity-40"
                    >
                      Next <ChevronRight className="h-4 w-4" />
                    </button>
                  </nav>
                )}

                <label className="flex items-center gap-2 text-xs text-(--s-ink-2)">
                  Items per page
                  <select
                    value={perPage}
                    onChange={(e) => setPerPage(Number(e.target.value))}
                    className="h-9 cursor-pointer rounded-lg border border-(--s-line) bg-(--s-surface) px-2 text-xs font-semibold text-(--s-ink) outline-none focus:border-(--s-accent)"
                  >
                    {[12, 24, 48].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            )}
          </div>
        </div>

        {/* ---------- Right: my list (desktop: hidden while empty; phones: its own tab) ---------- */}
        {(hasList || tab === "list") && (
        <aside
          id="my-list"
          className={`h-fit scroll-mt-24 lg:sticky lg:top-32 ${tab === "list" ? "" : "hidden"} ${hasList ? "lg:block" : "lg:hidden"}`}
        >
          <div className="overflow-hidden rounded-3xl border border-(--s-line) bg-(--s-surface) shadow-[0_8px_30px_-10px_rgba(15,23,42,0.08)]">
            <div className="flex items-center justify-between border-b border-(--s-line) bg-(--s-soft)/50 px-5 py-4">
              <h2 className="flex items-center gap-2 text-base font-extrabold text-(--s-ink)">
                <ListChecks className="h-4 w-4 text-blue-600" /> My list
                {count > 0 && (
                  <span className="rounded-full bg-blue-600 px-2.5 py-0.5 text-xs font-bold text-white shadow-xs">
                    {count}
                  </span>
                )}
              </h2>
              {count > 0 && (
                <button
                  type="button"
                  onClick={() => confirm("Remove everything from your list?") && clear()}
                  className="cursor-pointer rounded-full px-2.5 py-1 text-xs font-bold text-(--s-muted) transition hover:bg-rose-500/10 hover:text-(--s-bad)"
                >
                  Clear all
                </button>
              )}
            </div>

            {!ready || !list ? (
              <div className="flex justify-center py-12 text-(--s-muted)">
                <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
              </div>
            ) : !lines.length ? (
              <div className="px-6 py-12 text-center">
                <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-(--s-soft) text-(--s-muted)">
                  <ClipboardList className="h-5 w-5" />
                </span>
                <p className="mt-3 text-sm font-semibold text-(--s-ink)">Your list is empty</p>
                <p className="mt-1 text-xs text-(--s-muted)">Pick items from the table and press Add.</p>
                <button
                  type="button"
                  onClick={() => showTab("items")}
                  className="mt-4 cursor-pointer rounded-full bg-blue-600 px-5 py-2 text-xs font-bold text-white hover:bg-blue-700 lg:hidden"
                >
                  Browse items
                </button>
              </div>
            ) : (
              <ul className="max-h-[48vh] divide-y divide-(--s-line) overflow-y-auto">
                {lines.map((l) => {
                  const qty = cart.find((c) => c.id === l.id)?.qty ?? l.qty;
                  return (
                    <li key={l.id} className={`p-4 transition hover:bg-(--s-soft)/30 ${l.available ? "" : "opacity-60"}`}>
                      <div className="flex items-start gap-3">
                        <Link
                          href={href(`/p/${l.slug}`)}
                          target="_blank"
                          className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-(--s-line) bg-(--s-img)"
                        >
                          {l.image ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={l.image} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <ImageOff className="h-4 w-4 text-slate-300" />
                          )}
                        </Link>
                        <div className="min-w-0 flex-1">
                          <p className="line-clamp-2 text-[14px] font-bold leading-snug text-(--s-ink)">{l.name}</p>
                          {l.price > 0 && <p className="mt-0.5 text-[12.5px] font-medium text-(--s-muted)">{rs(l.price)} each</p>}
                        </div>
                        <button
                          type="button"
                          aria-label={`Remove ${l.name}`}
                          onClick={() => remove(l.id)}
                          className="cursor-pointer rounded-lg p-1 text-(--s-muted) transition hover:bg-rose-500/10 hover:text-(--s-bad)"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="mt-2.5 flex items-center justify-between gap-3 pl-14">
                        <div className="flex h-8 items-center rounded-lg border border-(--s-line) bg-(--s-bg)">
                          <button
                            type="button"
                            aria-label="Less"
                            onClick={() => setQty(l.id, qty - 1)}
                            className="flex h-full w-8 cursor-pointer items-center justify-center rounded-l-lg text-(--s-ink-2) hover:bg-(--s-soft)"
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </button>
                          <input
                            aria-label="Quantity"
                            inputMode="numeric"
                            value={qty}
                            onChange={(e) => setQty(l.id, Number(e.target.value.replace(/\D/g, "")))}
                            className="h-full w-10 bg-transparent text-center text-xs font-bold text-(--s-ink) outline-none"
                          />
                          <button
                            type="button"
                            aria-label="More"
                            onClick={() => setQty(l.id, qty + 1)}
                            className="flex h-full w-8 cursor-pointer items-center justify-center rounded-r-lg text-(--s-ink-2) hover:bg-(--s-soft)"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <span className="text-sm font-extrabold text-(--s-ink)">{l.available ? rs(l.lineTotal) : "Call us"}</span>
                      </div>
                      {(l.others?.length ?? 0) > 0 && (
                        <div className="mt-3">
                          <BrandCompare
                            line={{ brand: l.brand, price: l.price, others: l.others! }}
                            qty={qty}
                            onSwitch={(id) => replace(l.id, id)}
                            href={href}
                            where="In your list"
                          />
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}

            <div className="space-y-3 border-t border-(--s-line) bg-(--s-soft)/30 p-5">
              {!!list?.savings && list.savings > 0 && (
                <div className="flex items-center justify-between text-xs font-bold text-(--s-good)">
                  <span>Total savings</span>
                  <span>− {rs(list.savings)}</span>
                </div>
              )}
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-semibold text-(--s-ink-2)">Total</span>
                <span className="text-2xl font-extrabold tracking-tight text-(--s-ink)">{rs(list?.subtotal || 0)}</span>
              </div>
              {!!list?.deliveryFee && (
                <p className="-mt-2 text-right text-xs font-medium text-(--s-muted)">+ Galle area delivery {rs(list.deliveryFee)}</p>
              )}
              <Link
                href={href("/checkout")}
                aria-disabled={!lines.length}
                className={`flex h-12 w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-blue-600 to-blue-500 text-[15px] font-bold text-white shadow-[0_4px_16px_-2px_rgba(37,99,235,0.45)] transition hover:brightness-110 ${
                  lines.length ? "" : "pointer-events-none opacity-50"
                }`}
              >
                <Lock className="h-4 w-4" /> Order now
              </Link>
              <QuoteFromCart disabled={!lines.length} />
              <p className="text-center text-xs leading-relaxed text-(--s-muted)">
                Buying for a whole house? Ask for a quotation and we&apos;ll give our best price.
              </p>
            </div>
          </div>
        </aside>
        )}
      </div>

      {/* Phones: list summary always visible above the bottom bar */}
      {count > 0 && tab === "items" && (
        <button
          type="button"
          onClick={() => showTab("list")}
          className="fixed cursor-pointer inset-x-3 bottom-[4.5rem] z-30 flex items-center justify-between rounded-2xl bg-gradient-to-r from-blue-600 to-blue-500 px-4 py-3 text-sm text-white shadow-xl lg:hidden"
        >
          <span className="flex items-center gap-2 font-bold">
            <ListChecks className="h-4 w-4" /> My list · {count} item{count === 1 ? "" : "s"}
          </span>
          <span className="font-extrabold">{rs(list?.subtotal || 0)} →</span>
        </button>
      )}

      {/* Easy Full-Image Lightbox Preview when clicking any item photo */}
      {preview && preview.image && (
        <div
          onClick={() => setPreview(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-xs"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-md overflow-hidden rounded-3xl border border-(--s-line) bg-(--s-surface) p-4 shadow-2xl"
          >
            <button
              type="button"
              aria-label="Close preview"
              onClick={() => setPreview(null)}
              className="absolute right-3 top-3 z-10 flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-black/60 text-white transition hover:bg-black"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="aspect-square overflow-hidden rounded-2xl bg-(--s-img)">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={preview.image} alt={preview.name} className="h-full w-full object-cover" />
            </div>
            <div className="mt-3.5 flex items-center justify-between gap-3 px-1">
              <div className="min-w-0">
                {preview.brand && <span className="text-[12.5px] font-bold uppercase tracking-wider text-blue-600">{preview.brand}</span>}
                <p className="truncate text-sm font-bold text-(--s-ink)">{preview.name}</p>
                <p className="text-sm font-extrabold text-(--s-ink)">{preview.price ? rs(preview.price) : "Ask for price"}</p>
              </div>
              <Link
                href={href(`/p/${preview.slug}`)}
                target="_blank"
                className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-(--s-soft) px-3.5 py-2 text-xs font-bold text-(--s-ink) transition hover:bg-blue-600 hover:text-white"
              >
                Details <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

type PickOption = { key: string; label: string; count?: number; logo?: string | null };

/** Sort picker: a styled menu instead of the browser's plain dropdown (full width on phones). */
function SortMenu({ value, onChange }: { value: SortKey; onChange: (k: SortKey) => void }) {
  return (
    <PickMenu
      label="Sort items"
      icon={<ArrowUpDown className="h-3.5 w-3.5 shrink-0 text-blue-600" />}
      value={value}
      options={SORT_OPTIONS}
      onChange={(k) => onChange(k as SortKey)}
      className="flex-1 sm:flex-none"
      buttonClass="sm:w-auto sm:min-w-[200px]"
      menuClass="sm:left-auto sm:right-0 sm:w-60"
      highlightActive={false}
    />
  );
}

/** A styled pick-one menu (used for sort, and for category / brand on phones). */
function PickMenu({
  label,
  icon,
  value,
  options,
  onChange,
  className = "",
  buttonClass = "",
  menuClass = "",
  highlightActive = true,
}: {
  label: string;
  icon?: React.ReactNode;
  value: string;
  options: PickOption[];
  onChange: (key: string) => void;
  className?: string;
  buttonClass?: string;
  menuClass?: string;
  highlightActive?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const current = options.find((o) => o.key === value) ?? options[0];

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | TouchEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("touchstart", close);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("touchstart", close);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // A filter that is set (not "All") shows in blue so people see it is on.
  const active = highlightActive && value !== options[0]?.key;

  return (
    <div ref={box} className={`relative min-w-0 ${className}`}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
        onClick={() => setOpen((o) => !o)}
        className={`flex h-11 w-full cursor-pointer items-center gap-2 rounded-2xl border pl-3.5 pr-3 text-[14px] font-bold outline-none transition ${
          open
            ? "border-blue-600 bg-(--s-bg) text-(--s-ink) ring-4 ring-blue-500/15"
            : active
              ? "border-blue-500/40 bg-blue-500/10 text-blue-600"
              : "border-(--s-line) bg-(--s-bg) text-(--s-ink) hover:border-blue-500/40"
        } ${buttonClass}`}
      >
        {icon}
        <span className="truncate">{current?.label}</span>
        <ChevronDown className={`ml-auto h-4 w-4 shrink-0 text-(--s-muted) transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <ul
          role="listbox"
          className={`absolute inset-x-0 top-full z-40 mt-1.5 max-h-[60vh] overflow-y-auto rounded-2xl border border-(--s-line) bg-(--s-surface) p-1.5 shadow-[0_12px_40px_-8px_rgba(15,23,42,0.25)] ${menuClass}`}
        >
          {options.map((o) => {
            const on = o.key === value;
            return (
              <li key={o.key}>
                <button
                  type="button"
                  role="option"
                  aria-selected={on}
                  onClick={() => {
                    onChange(o.key);
                    setOpen(false);
                  }}
                  className={`flex w-full cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[14px] transition ${
                    on ? "bg-blue-500/10 font-bold text-blue-600" : "font-medium text-(--s-ink-2) hover:bg-(--s-soft) hover:text-(--s-ink)"
                  }`}
                >
                  {o.logo && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={o.logo} alt="" className="h-4 max-w-12 shrink-0 rounded-xs bg-white px-0.5 object-contain" />
                  )}
                  <span className="min-w-0 flex-1 truncate">{o.label}</span>
                  {o.count !== undefined && (
                    <span className={`shrink-0 rounded-full px-1.5 text-[12px] font-bold ${on ? "bg-blue-600 text-white" : "bg-(--s-soft) text-(--s-muted)"}`}>
                      {o.count}
                    </span>
                  )}
                  {on && <Check className="h-4 w-4 shrink-0 stroke-[2.5]" />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function SortIcon({ active, asc }: { active: boolean; asc: boolean }) {
  if (!active) return <ArrowUpDown className="h-3 w-3 opacity-45" />;
  return asc ? <ArrowUp className="h-3 w-3 text-blue-600" /> : <ArrowDown className="h-3 w-3 text-blue-600" />;
}

/** Page buttons to show: first, last and the ones around the current page (0 = "…"). */
function pageNumbers(current: number, pages: number): number[] {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
  const set = new Set([1, pages, current - 1, current, current + 1].filter((p) => p >= 1 && p <= pages));
  const sorted = [...set].sort((a, b) => a - b);
  const out: number[] = [];
  sorted.forEach((p, i) => {
    if (i && p - sorted[i - 1] > 1) out.push(0);
    out.push(p);
  });
  return out;
}
