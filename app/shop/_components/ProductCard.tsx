import Link from "next/link";
import { Package } from "lucide-react";
import type { ShopProductCard } from "@/lib/shop-data";
import { AddToCartButton } from "./AddToCart";
import { rs } from "./format";
import { Tr } from "./Tr";
import { ItemKindTag } from "./ItemKindNote";

/**
 * Product card, read top to bottom: picture → brand → name → price & saving → button.
 * Left-aligned with fixed-height rows so cards in a grid line up.
 * Stock is never shown; switched-off items get a "Call to order" button.
 */
export function ProductCard({ p, base }: { p: ShopProductCard; base: string }) {
  const href = `${base}/p/${p.slug}`;
  const off = p.discountPct > 0 && p.mrp > p.price;
  return (
    <div className="group relative flex flex-col overflow-hidden rounded-2xl border border-(--s-line) bg-(--s-surface) transition duration-300 hover:-translate-y-0.5 hover:border-(--s-accent)/50 hover:shadow-[0_16px_36px_-18px_rgba(15,23,42,0.28)]">
      {/* Picture */}
      <Link href={href} className={`relative block aspect-square ${p.image ? "bg-white" : "bg-(--s-soft)"}`} tabIndex={-1} aria-hidden="true">
        {p.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={p.image}
            alt={p.name}
            loading="lazy"
            className="h-full w-full object-contain p-4 transition duration-500 ease-out group-hover:scale-[1.04]"
          />
        ) : (
          // No photo yet: calm placeholder instead of a "broken image" icon.
          <div className="flex h-full flex-col items-center justify-center gap-2 text-(--s-muted)">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-(--s-surface) ring-1 ring-(--s-line)">
              <Package className="h-6 w-6 opacity-70" />
            </span>
            {p.brand && <span className="text-[12px] font-bold uppercase tracking-wider opacity-80">{p.brand}</span>}
          </div>
        )}
        {off && (
          <span className="absolute left-2.5 top-2.5 rounded-md bg-rose-600 px-1.5 py-0.5 text-[12.5px] font-bold leading-none text-white shadow-sm">
            -{p.discountPct}%
          </span>
        )}
      </Link>

      {/* Details */}
      <div className="flex flex-1 flex-col border-t border-(--s-line) p-3.5">
        <span className="h-4 truncate text-[12.5px] font-semibold uppercase tracking-wider text-(--s-muted)">{p.brand || ""}</span>
        <Link
          href={href}
          title={p.name}
          className="mt-1 line-clamp-2 min-h-10 text-[14.5px] font-medium leading-5 text-(--s-ink) transition-colors group-hover:text-(--s-accent)"
        >
          {p.name}
        </Link>
        {p.kind !== "normal" && (
          <div className="mt-1.5">
            <ItemKindTag kind={p.kind} leadTime={p.leadTime} />
          </div>
        )}

        <div className="mt-3">
          {p.price ? (
            <div className="flex flex-wrap items-baseline gap-x-2">
              <span className="text-[17px] font-bold tracking-tight text-(--s-ink)">{rs(p.price)}</span>
              {off && <span className="text-xs text-(--s-muted) line-through">{rs(p.mrp)}</span>}
            </div>
          ) : (
            <span className="text-sm font-medium text-(--s-muted)"><Tr k="Ask for price" /></span>
          )}
          {/* Reserved line keeps every card the same height. */}
          <div className="h-4 text-[13px] font-medium text-emerald-600">{off ? <Tr k="Save {amount}" vars={{ amount: rs(p.mrp - p.price) }} /> : ""}</div>
        </div>

        <div className="mt-auto pt-3">
          <AddToCartButton id={p.id} name={p.name} available={p.available} withQty />
        </div>
      </div>
    </div>
  );
}

export function ProductGrid({ products, base, wide = false }: { products: ShopProductCard[]; base: string; wide?: boolean }) {
  return (
    <div
      className={`grid grid-cols-2 gap-3 sm:gap-4 ${
        wide ? "sm:grid-cols-[repeat(auto-fill,minmax(190px,1fr))]" : "sm:grid-cols-[repeat(auto-fill,minmax(210px,1fr))]"
      }`}
    >
      {products.map((p) => (
        <ProductCard key={p.id} p={p} base={base} />
      ))}
    </div>
  );
}
