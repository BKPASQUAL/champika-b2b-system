import Link from "next/link";
import { ArrowUpRight, Box, Cable, Layers, ShieldCheck, ToggleRight } from "lucide-react";
import type { ShopCategory } from "@/lib/shop-data";

function getCategoryIcon(name: string) {
  const n = name.toLowerCase();
  if (n.includes("cable") || n.includes("wire")) return Cable;
  if (n.includes("protect") || n.includes("control") || n.includes("breaker") || n.includes("mcb")) return ShieldCheck;
  if (n.includes("enclos") || n.includes("board") || n.includes("box")) return Box;
  if (n.includes("switch") || n.includes("socket")) return ToggleRight;
  return Layers;
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
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {subs.map((s) => {
                const Icon = getCategoryIcon(s.name);
                return (
                  <div
                    key={s.id}
                    className="group flex flex-col overflow-hidden rounded-3xl border border-(--s-line) bg-(--s-surface) shadow-[0_4px_20px_-6px_rgba(15,23,42,0.06)] transition duration-300 hover:-translate-y-1 hover:border-blue-500/50 hover:shadow-[0_18px_36px_-14px_rgba(37,99,235,0.16)]"
                  >
                    <Link
                      href={`${base}/c/${s.slug}`}
                      className="relative m-2.5 mb-0 flex aspect-[16/10] items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100 ring-1 ring-inset ring-(--s-line) dark:from-slate-800/80 dark:to-slate-900"
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
                          <Icon className="pointer-events-none absolute -bottom-4 -right-4 h-28 w-28 text-blue-500/[0.06] transition duration-500 group-hover:scale-110" />
                          <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-600/10 text-blue-600 ring-1 ring-blue-500/20 transition duration-300 group-hover:scale-105 group-hover:bg-blue-600 group-hover:text-white dark:text-blue-400">
                            <Icon className="h-8 w-8" />
                          </span>
                        </>
                      )}
                      <span className="absolute right-2.5 top-2.5 flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-white opacity-0 shadow-sm transition group-hover:opacity-100">
                        <ArrowUpRight className="h-4 w-4" />
                      </span>
                    </Link>
                    <div className="flex flex-1 flex-col p-4 pt-3.5">
                      <div className="flex items-start justify-between gap-2">
                        <Link href={`${base}/c/${s.slug}`} className="text-[15px] font-bold leading-snug text-(--s-ink) transition group-hover:text-blue-600 dark:group-hover:text-blue-400">
                          {s.name}
                        </Link>
                        <span
                          className={`shrink-0 rounded-full px-2.5 py-0.5 text-[12.5px] font-bold ${
                            s.productCount > 0 ? "bg-blue-500/10 text-blue-600 dark:text-blue-400" : "bg-(--s-soft) text-(--s-muted)"
                          }`}
                        >
                          {s.productCount ? `${s.productCount} ${s.productCount === 1 ? "item" : "items"}` : "Soon"}
                        </span>
                      </div>
                      {s.families.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {s.families.slice(0, 5).map((f) => (
                            <Link
                              key={f.id}
                              href={`${base}/c/${s.slug}?family=${f.id}`}
                              className="rounded-full bg-(--s-soft) px-2.5 py-1 text-[12.5px] font-semibold text-(--s-ink-2) transition hover:bg-blue-600 hover:text-white"
                            >
                              {f.name}
                            </Link>
                          ))}
                          {s.families.length > 5 && (
                            <Link href={`${base}/c/${s.slug}`} className="px-1 py-1 text-[12.5px] font-semibold text-(--s-muted) hover:text-(--s-ink)">
                              +{s.families.length - 5} more
                            </Link>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
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
