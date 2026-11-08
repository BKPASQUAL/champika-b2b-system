import Link from "next/link";
import { ImageOff } from "lucide-react";
import type { ShopProductCard } from "@/lib/shop-data";
import { Price } from "./Price";
import { AddToCartButton } from "./AddToCart";

/** Centered product card. Stock is never shown; switched-off items get a "Call to order" button. */
export function ProductCard({ p, base }: { p: ShopProductCard; base: string }) {
  return (
    <div className="group relative flex flex-col items-center overflow-hidden rounded-3xl border border-(--s-line) bg-(--s-surface) p-3.5 text-center shadow-[0_4px_20px_-6px_rgba(15,23,42,0.06)] transition duration-300 hover:-translate-y-1 hover:border-blue-500/60 hover:shadow-[0_20px_40px_-16px_rgba(37,99,235,0.16)]">
      <Link
        href={`${base}/p/${p.slug}`}
        className="relative block aspect-square w-full overflow-hidden rounded-2xl bg-(--s-img) ring-1 ring-inset ring-(--s-line)"
      >
        {p.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={p.image}
            alt={p.name}
            loading="lazy"
            className="h-full w-full object-contain transition duration-500 ease-out group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-slate-300">
            <ImageOff className="h-10 w-10" />
          </div>
        )}
        {p.discountPct > 0 && (
          <span className="absolute left-2.5 top-2.5 rounded-full bg-gradient-to-r from-rose-600 to-red-500 px-2.5 py-0.5 text-[11px] font-extrabold tracking-tight text-white shadow-sm ring-1 ring-white/20">
            -{p.discountPct}%
          </span>
        )}
      </Link>

      <Link
        href={`${base}/p/${p.slug}`}
        className="mt-3.5 line-clamp-2 min-h-[2.5rem] px-1.5 text-[13.5px] font-semibold leading-5 text-(--s-ink) transition group-hover:text-blue-600 dark:group-hover:text-blue-400 sm:text-sm"
      >
        {p.name}
      </Link>
      {p.brand && (
        <span className="mt-1 inline-flex items-center rounded-md bg-(--s-soft) px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wider text-(--s-muted)">
          {p.brand}
        </span>
      )}

      <div className="mb-3.5 mt-2.5 flex justify-center">
        <Price price={p.price} mrp={p.mrp} discountPct={p.discountPct} />
      </div>
      <div className="mt-auto w-full">
        <AddToCartButton id={p.id} name={p.name} available={p.available} />
      </div>
    </div>
  );
}

export function ProductGrid({ products, base, wide = false }: { products: ShopProductCard[]; base: string; wide?: boolean }) {
  return (
    <div
      className={`grid grid-cols-2 gap-3 sm:gap-4 ${
        wide ? "sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6" : "sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5"
      }`}
    >
      {products.map((p) => (
        <ProductCard key={p.id} p={p} base={base} />
      ))}
    </div>
  );
}
