import Link from "next/link";
import { ArrowUpRight, Box, Cable, ChevronRight, Layers, ShieldCheck, ToggleRight } from "lucide-react";
import type { ShopCategory } from "@/lib/shop-data";

function CategoryIcon({ name, className, strokeWidth }: { name: string; className?: string; strokeWidth?: number }) {
  const n = name.toLowerCase();
  const props = { className, strokeWidth };
  if (n.includes("cable") || n.includes("wire")) return <Cable {...props} />;
  if (n.includes("protect") || n.includes("control") || n.includes("breaker") || n.includes("mcb")) return <ShieldCheck {...props} />;
  if (n.includes("enclos") || n.includes("board") || n.includes("box")) return <Box {...props} />;
  if (n.includes("switch") || n.includes("socket")) return <ToggleRight {...props} />;
  return <Layers {...props} />;
}

/** One sub category as a picture card with its product families as quick links. */
function CategoryCard({ s, base }: { s: ShopCategory; base: string }) {
  const href = `${base}/c/${s.slug}`;
  return (
    <article className="group flex flex-col overflow-hidden rounded-3xl border border-(--s-line) bg-(--s-surface) shadow-[0_4px_20px_-6px_rgba(15,23,42,0.06)] transition duration-300 hover:-translate-y-1 hover:border-blue-500/45 hover:shadow-[0_18px_36px_-14px_rgba(37,99,235,0.22)]">
      <Link
        href={href}
        aria-label={s.name}
        className={`relative m-2.5 mb-0 flex aspect-[16/11] items-center justify-center overflow-hidden rounded-2xl ${
          s.imageUrl ? "bg-(--s-img)" : "shop-stripes bg-slate-100 dark:bg-slate-800/80"
        }`}
      >
        {s.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={s.imageUrl}
            alt={s.name}
            loading="lazy"
            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
          />
        ) : (
          <>
            <CategoryIcon name={s.name} className="pointer-events-none absolute -bottom-5 -right-5 h-36 w-36 text-blue-600/[0.08] transition duration-500 group-hover:scale-110" strokeWidth={1.5} />
            <span className="flex h-[72px] w-[72px] items-center justify-center rounded-[20px] bg-blue-600/10 text-blue-600 ring-1 ring-inset ring-blue-600/20 transition duration-300 group-hover:bg-blue-600 group-hover:text-white dark:text-blue-400">
              <CategoryIcon name={s.name} className="h-[34px] w-[34px]" />
            </span>
          </>
        )}
        <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wider text-slate-900 shadow-sm backdrop-blur">
          {s.productCount > 0 ? `${s.productCount} ${s.productCount === 1 ? "item" : "items"}` : "Soon"}
        </span>
        <span className="absolute right-3 top-3 flex h-[34px] w-[34px] items-center justify-center rounded-full bg-(--s-accent) text-white opacity-0 shadow-sm transition group-hover:opacity-100">
          <ArrowUpRight className="h-4 w-4" strokeWidth={2.5} />
        </span>
      </Link>
      <div className="flex flex-1 flex-col gap-3 px-[18px] pb-[18px] pt-4">
        <Link href={href} className="text-[17px] font-bold leading-snug text-(--s-ink)">
          {s.name}
        </Link>
        {s.families.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {s.families.slice(0, 5).map((f) => (
              <Link
                key={f.id}
                href={`${href}?family=${f.id}`}
                className="rounded-full bg-(--s-soft) px-2 py-0.5 text-[11px] font-medium text-(--s-ink-2) transition hover:bg-blue-600 hover:text-white"
              >
                {f.name}
              </Link>
            ))}
            {s.families.length > 5 && (
              <Link href={href} className="px-1 py-0.5 text-[11px] font-medium text-(--s-muted) hover:text-(--s-ink)">
                +{s.families.length - 5} more
              </Link>
            )}
          </div>
        )}
        {s.families.length === 0 && (
          <p className="text-[13.5px] leading-relaxed text-(--s-muted)">
            {s.description ||
              (s.productCount > 0
                ? `Browse ${s.productCount} ${s.productCount === 1 ? "product" : "products"} in ${s.name.toLowerCase()}.`
                : "New products arriving soon.")}
          </p>
        )}
        <Link
          href={href}
          className="mt-auto flex min-h-11 items-center justify-between border-t border-(--s-line) pt-3.5 text-sm font-semibold text-(--s-ink)"
        >
          Shop now
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-(--s-btn) text-(--s-btn-ink) transition duration-300 group-hover:translate-x-0.5 group-hover:bg-(--s-accent)">
            <ChevronRight className="h-4 w-4" strokeWidth={2.5} />
          </span>
        </Link>
      </div>
    </article>
  );
}

/**
 * Every main category with all of its sub categories as picture cards, and
 * the product families inside each one as quick links.
 */
export function AllCategories({ tree, base, showEmpty = true }: { tree: ShopCategory[]; base: string; showEmpty?: boolean }) {
  return (
    <div className="space-y-12">
      {tree.map((main) => {
        const subs = main.children.filter((s) => showEmpty || s.productCount > 0);
        return (
          <div key={main.id}>
            {tree.length > 1 || subs.length === 0 ? (
              <Link href={`${base}/c/${main.slug}`} className="mb-4 inline-flex items-center gap-2 text-lg font-bold hover:underline">
                {main.name} <span className="text-sm font-medium text-(--s-muted)">({main.productCount})</span>
              </Link>
            ) : null}
            <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-5">
              {subs.map((s) => (
                <CategoryCard key={s.id} s={s} base={base} />
              ))}
              {subs.length === 0 && main.productCount === 0 && (
                <p className="col-span-full text-sm text-(--s-muted)">Products coming soon.</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
