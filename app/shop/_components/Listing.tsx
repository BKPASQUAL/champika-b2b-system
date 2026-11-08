import Link from "next/link";
import { ArrowUpDown, Check, ChevronRight, LayoutGrid, PackageOpen, SearchX } from "lucide-react";
import {
  applyListingFilters,
  getCategoryTree,
  getFacets,
  SORT_OPTIONS,
  type ShopProductCard,
} from "@/lib/shop-data";
import { ProductGrid } from "./ProductCard";
import { PriceRange } from "./PriceRange";

export type ListingParams = {
  brand?: string;
  family?: string;
  sort?: string;
  q?: string;
  tab?: string;
  min?: string;
  max?: string;
};

type Crumb = { label: string; href?: string };

/**
 * Shop listing:  [categories]  [title · count · sort / type + brand chips · price / grid]
 * Every filter is a plain link (?brand=orange&family=…&min=…&max=…),
 * so pages can be shared and work without JavaScript (except the price slider).
 */
export async function Listing({
  base,
  path,
  title,
  description,
  crumbs,
  products: all,
  params,
  hideBrandFilter,
  activeCategory,
  top,
}: {
  base: string;
  /** Page path without the base, e.g. "/c/switches". */
  path: string;
  title: string;
  description?: string | null;
  crumbs: Crumb[];
  products: ShopProductCard[];
  params: ListingParams;
  hideBrandFilter?: boolean;
  /** Slug of the category being shown (highlighted in the left bar). */
  activeCategory?: string;
  top?: React.ReactNode;
}) {
  const [facets, tree] = await Promise.all([getFacets(all), getCategoryTree()]);
  const { products: filtered, sort, brandSlugs, familyIds } = applyListingFilters(all, facets, params);

  let list = filtered;

  // Price range (slider bounds come from the items before the price filter).
  const prices = list.map((p) => p.price).filter((n) => n > 0);
  const lo = prices.length ? Math.floor(Math.min(...prices)) : 0;
  const hi = prices.length ? Math.ceil(Math.max(...prices)) : 0;
  const min = Number(params.min) || 0;
  const max = Number(params.max) || 0;
  if (min) list = list.filter((p) => p.price >= min);
  if (max) list = list.filter((p) => p.price <= max);
  const products = list;

  /** URL with some params changed (others kept). */
  const url = (change: Partial<Record<keyof ListingParams, string | null>>) => {
    const next: Record<string, string> = {};
    for (const [k, v] of Object.entries({ ...params, ...change })) if (v) next[k] = String(v);
    const qs = new URLSearchParams(next).toString();
    return `${base}${path}${qs ? `?${qs}` : ""}`;
  };
  const toggle = (list: string[], v: string) => {
    const s = new Set(list);
    s.has(v) ? s.delete(v) : s.add(v);
    return [...s].join(",") || null;
  };
  const activeCount = brandSlugs.length + familyIds.length + (min || max ? 1 : 0);

  // ---------- left: categories ----------
  const categoryLinks = tree.flatMap((main) => (tree.length === 1 ? main.children : [main, ...main.children]));
  const categoryBar = (
    <nav className="space-y-1">
      <CategoryTile href={`${base}/products`} label="All products" on={path === "/products"} />
      {categoryLinks.map((c) => (
        <CategoryTile
          key={c.id}
          href={`${base}/c/${c.slug}`}
          label={c.name}
          image={c.imageUrl}
          count={c.productCount}
          on={activeCategory === c.slug}
        />
      ))}
    </nav>
  );

  // ---------- two chip lines: product types, then brands ----------
  const chipLine = (chips: React.ReactNode) => (
    <div className="shop-noscroll -mx-4 flex items-center gap-2 overflow-x-auto px-4 py-0.5 md:mx-0 md:flex-wrap md:overflow-visible md:px-0">{chips}</div>
  );
  const showTypes = facets.families.length > 0;
  const showBrands = !hideBrandFilter && facets.brands.length > 0;
  const sortLabel = SORT_OPTIONS.find((o) => o.key === sort)?.label;

  return (
    <div className="mx-auto max-w-[1800px] px-4 md:px-6 xl:px-10 py-6 lg:py-8">
      <nav aria-label="Breadcrumb" className="mb-5 flex flex-wrap items-center gap-1.5 text-xs font-medium text-(--s-muted)">
        <Link href={base || "/"} className="transition hover:text-(--s-ink)">Home</Link>
        {crumbs.map((c) => (
          <span key={c.label} className="flex items-center gap-1.5">
            <ChevronRight className="h-3.5 w-3.5 opacity-60" />
            {c.href ? (
              <Link href={c.href} className="transition hover:text-(--s-ink)">{c.label}</Link>
            ) : (
              <span className="font-semibold text-(--s-ink)">{c.label}</span>
            )}
          </span>
        ))}
      </nav>

      {/* Phone/tablet: categories as a sideways row */}
      <div className="shop-noscroll -mx-4 mb-5 flex gap-2 overflow-x-auto px-4 lg:hidden">
        <MiniCategory href={`${base}/products`} label="All" on={path === "/products"} />
        {categoryLinks.map((c) => (
          <MiniCategory key={c.id} href={`${base}/c/${c.slug}`} label={c.name} on={activeCategory === c.slug} />
        ))}
      </div>

      <div className="flex gap-6 xl:gap-8">
        {/* Left: categories */}
        <aside className="hidden w-64 shrink-0 lg:block">
          <div className="sticky top-24 flex max-h-[calc(100vh-7rem)] flex-col overflow-hidden rounded-2xl border border-(--s-line) bg-(--s-surface) shadow-[0_4px_20px_-6px_rgba(15,23,42,0.06)]">
            <div className="flex items-center justify-between border-b border-(--s-line) bg-(--s-soft)/50 px-4 py-3.5">
              <span className="text-xs font-bold uppercase tracking-wider text-(--s-ink-2)">Categories</span>
              <span className="rounded-full bg-(--s-surface) px-2 py-0.5 text-[11px] font-bold text-(--s-muted) ring-1 ring-(--s-line)">
                {categoryLinks.length + 1}
              </span>
            </div>
            <div className="shop-noscroll overflow-y-auto p-2.5">{categoryBar}</div>
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <h1 className="sr-only">{title}</h1>
          {all.length > 0 && (
            <div className="flex flex-col gap-3.5 rounded-2xl border border-(--s-line) bg-(--s-surface) p-3.5 shadow-[0_2px_12px_-4px_rgba(15,23,42,0.04)] md:flex-row md:items-start md:justify-between md:gap-6 md:p-4">
              {/* Count · clear · sort (top on phones, right on bigger screens) */}
              <div className="flex items-center justify-between gap-3 md:order-last md:shrink-0 md:justify-end">
                <span className="rounded-full bg-(--s-soft) px-3 py-1 text-xs font-semibold text-(--s-ink-2)">
                  <strong className="font-bold text-(--s-ink)">{products.length}</strong>{" "}
                  {products.length === 1 ? "item" : "items"}
                </span>
                <div className="flex items-center gap-2">
                  {activeCount > 0 && (
                    <Link
                      href={url({ brand: null, family: null, min: null, max: null })}
                      className="rounded-full bg-rose-500/10 px-3 py-1.5 text-xs font-bold text-(--s-bad) transition hover:bg-rose-500/20"
                    >
                      Clear
                    </Link>
                  )}
                  <details className="group relative">
                    <summary className="flex cursor-pointer list-none items-center gap-2 rounded-full border border-(--s-line) bg-(--s-bg) px-4 py-2 text-[13px] font-semibold text-(--s-ink) transition hover:border-blue-500/40 hover:bg-(--s-soft)">
                      <ArrowUpDown className="h-3.5 w-3.5 text-blue-600 transition group-hover:text-(--s-ink)" />
                      <span>{sortLabel}</span>
                    </summary>
                    <div className="absolute right-0 z-30 mt-2 w-56 overflow-hidden rounded-2xl border border-(--s-line) bg-(--s-surface) p-1.5 shadow-2xl">
                      {SORT_OPTIONS.map((o) => (
                        <Link
                          key={o.key}
                          href={url({ sort: o.key === "popular" ? null : o.key })}
                          scroll={false}
                          className={`flex items-center justify-between rounded-xl px-3.5 py-2.5 text-sm transition hover:bg-(--s-soft) ${
                            o.key === sort ? "bg-(--s-soft) font-bold text-(--s-ink)" : "text-(--s-ink-2)"
                          }`}
                        >
                          {o.label}
                          {o.key === sort && <span className="h-2 w-2 rounded-full bg-blue-600 ring-2 ring-blue-500/30" />}
                        </Link>
                      ))}
                    </div>
                  </details>
                </div>
              </div>

              {/* Line 1: product types · Line 2: brands */}
              {(showTypes || showBrands) && (
                <div className="min-w-0 flex-1 space-y-2.5">
                  {showTypes &&
                    chipLine(
                      <>
                        <TypeChip href={url({ family: null })} on={!familyIds.length} label="All" />
                        {facets.families.map((f) => (
                          <TypeChip key={f.id} href={url({ family: toggle(familyIds, f.id) })} on={familyIds.includes(f.id)} label={f.name} count={f.count} />
                        ))}
                      </>,
                    )}
                  {showBrands &&
                    chipLine(
                      <>
                        <BrandChip href={url({ brand: null })} on={!brandSlugs.length} label="All brands" />
                        {facets.brands.map((b) => (
                          <BrandChip key={b.id} href={url({ brand: toggle(brandSlugs, b.slug) })} on={brandSlugs.includes(b.slug)} label={b.name} logo={b.logoUrl} />
                        ))}
                      </>,
                    )}
                </div>
              )}
            </div>
          )}
          {description && <p className="mt-3 max-w-3xl text-sm text-(--s-ink-2)">{description}</p>}
          {all.length > 0 && hi > lo && (
            <div className="mt-4 w-full max-w-xs">
              <PriceRange lo={lo} hi={hi} min={min || lo} max={max || hi} />
            </div>
          )}

          <div className="pt-6">
            {top}
            {products.length ? (
              <ProductGrid products={products} base={base} />
            ) : (
              <div className="flex flex-col items-center rounded-3xl border border-(--s-line) bg-(--s-surface) px-6 py-16 text-center">
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-(--s-soft)">
                  {all.length ? <SearchX className="h-6 w-6 text-(--s-muted)" /> : <PackageOpen className="h-6 w-6 text-(--s-muted)" />}
                </span>
                <p className="mt-4 font-semibold text-(--s-ink)">{all.length ? "No items match these filters" : "Products coming soon"}</p>
                <p className="mt-1 max-w-sm text-sm text-(--s-muted)">
                  {all.length ? "Try removing a filter or choosing another option." : "We are adding items to this category. Meanwhile, have a look at our other products."}
                </p>
                <Link
                  href={all.length ? url({ brand: null, family: null, min: null, max: null, tab: null }) : `${base}/products`}
                  className="mt-5 rounded-full bg-(--s-btn) px-5 py-2.5 text-sm font-semibold text-(--s-btn-ink) hover:opacity-85"
                >
                  {all.length ? "Clear filters" : "Browse all products"}
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Product type chip (line 1): soft pill, slate-900 when chosen. */
function TypeChip({ href, on, label, count }: { href: string; on: boolean; label: string; count?: number }) {
  return (
    <Link
      href={href}
      scroll={false}
      className={`inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-[13px] font-semibold transition ${
        on
          ? "bg-(--s-ink) text-(--s-bg) shadow-[0_3px_10px_-2px_rgba(15,23,42,0.3)]"
          : "bg-(--s-bg) text-(--s-ink-2) ring-1 ring-inset ring-(--s-line) hover:bg-(--s-soft) hover:text-(--s-ink) hover:ring-(--s-ink)/30"
      }`}
    >
      <span>{label}</span>
      {count !== undefined && (
        <span
          className={`inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1.5 text-[11px] font-bold leading-none ${
            on ? "bg-blue-500 text-white" : "bg-(--s-surface) text-(--s-muted) ring-1 ring-(--s-line)"
          }`}
        >
          {count}
        </span>
      )}
    </Link>
  );
}

/** Brand chip (line 2): logo when there is one, electric blue gradient when chosen. */
function BrandChip({ href, on, label, logo }: { href: string; on: boolean; label: string; logo?: string | null }) {
  return (
    <Link
      href={href}
      scroll={false}
      className={`inline-flex h-9 shrink-0 items-center gap-2 rounded-xl px-3.5 text-[13px] font-semibold transition ${
        on
          ? "bg-gradient-to-r from-blue-600 to-blue-500 font-bold text-white shadow-[0_3px_12px_-2px_rgba(37,99,235,0.45)] ring-1 ring-inset ring-blue-400/30"
          : "bg-(--s-bg) text-(--s-ink-2) ring-1 ring-inset ring-(--s-line) hover:bg-(--s-soft) hover:text-(--s-ink) hover:ring-(--s-ink)/30"
      }`}
    >
      {logo && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logo} alt="" className="h-5 max-w-14 object-contain" />
      )}
      <span>{label}</span>
      {on && label !== "All brands" && <Check className="h-3.5 w-3.5 stroke-[2.5]" />}
    </Link>
  );
}

function CategoryTile({
  href,
  label,
  image,
  count,
  on,
}: {
  href: string;
  label: string;
  image?: string | null;
  count?: number;
  on: boolean;
}) {
  return (
    <Link
      href={href}
      className={`group flex min-h-11 items-center gap-3 rounded-xl px-2.5 py-2 transition ${
        on
          ? "bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-[0_3px_12px_-2px_rgba(37,99,235,0.4)] ring-1 ring-inset ring-blue-400/30"
          : "text-(--s-ink-2) hover:bg-(--s-soft) hover:text-(--s-ink)"
      }`}
    >
      <span
        className={`flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg transition ${
          on
            ? "bg-white/20 text-white"
            : "bg-(--s-soft) text-(--s-muted) ring-1 ring-inset ring-(--s-line) group-hover:bg-(--s-surface) group-hover:text-(--s-ink)"
        }`}
      >
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt="" className="h-full w-full object-cover" />
        ) : (
          <LayoutGrid className="h-4 w-4 opacity-75" />
        )}
      </span>
      <span className={`min-w-0 flex-1 text-[13.5px] leading-snug ${on ? "font-bold text-white" : "font-semibold"}`}>{label}</span>
      {count !== undefined && count > 0 && (
        <span
          className={`shrink-0 rounded-full px-1.5 py-0.5 text-[11px] font-bold leading-none ${
            on ? "bg-white/20 text-white" : "bg-(--s-soft) text-(--s-muted) group-hover:bg-(--s-surface)"
          }`}
        >
          {count}
        </span>
      )}
    </Link>
  );
}

function MiniCategory({ href, label, on }: { href: string; label: string; on: boolean }) {
  return (
    <Link
      href={href}
      className={`shrink-0 whitespace-nowrap rounded-full px-4 py-2 text-[13px] font-semibold transition ${
        on
          ? "bg-gradient-to-r from-blue-600 to-blue-500 font-bold text-white shadow-[0_2px_8px_-2px_rgba(37,99,235,0.4)]"
          : "bg-(--s-surface) text-(--s-ink-2) ring-1 ring-(--s-line)"
      }`}
    >
      {label}
    </Link>
  );
}
