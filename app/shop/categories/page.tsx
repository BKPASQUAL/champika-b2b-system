import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, ChevronRight } from "lucide-react";
import { getCategoryTree, getShopBase } from "@/lib/shop-data";
import { CategoriesBrowser } from "./_components/CategoriesBrowser";

export const metadata: Metadata = {
  title: "All categories",
  description: "Browse every wiring category — cables & wires, switches & sockets, breakers, boards and more.",
  alternates: { canonical: "/categories" },
};

export default async function CategoriesPage() {
  const [tree, base] = await Promise.all([getCategoryTree(), getShopBase()]);
  return (
    <div className="mx-auto max-w-[1360px] px-4 pb-16 pt-7 md:px-6">
      <nav aria-label="Breadcrumb" className="mb-[18px] flex items-center gap-1.5 text-[13px] text-(--s-muted)">
        <Link href={base || "/"} className="hover:text-(--s-ink)">Home</Link>
        <ChevronRight className="h-3 w-3" />
        <span className="font-semibold text-(--s-ink)">Categories</span>
      </nav>

      {tree.length ? (
        <CategoriesBrowser tree={tree} base={base} />
      ) : (
        <>
          <h1 className="shop-display mb-6">All categories</h1>
          <p className="text-(--s-muted)">Categories coming soon.</p>
        </>
      )}

      <section className="relative mt-10 flex flex-wrap items-center justify-between gap-6 overflow-hidden rounded-3xl bg-(--s-bar) p-8 text-slate-50">
        <div className="shop-stripes pointer-events-none absolute inset-0" />
        <div className="relative max-w-[620px]">
          <h2 className="text-[28px] font-black uppercase italic leading-[1.05] tracking-tight">Wiring a whole job?</h2>
          <p className="mt-2.5 text-[15px] text-slate-300">
            Send us your material list and we will put together one quote for everything.
          </p>
        </div>
        <Link
          href={`${base}/quote`}
          className="relative inline-flex h-[50px] items-center gap-2 rounded-[14px] bg-(--s-accent) px-[22px] text-[15px] font-bold text-white transition hover:bg-(--s-accent-hover)"
        >
          Request a job quote
          <ArrowUpRight className="h-4 w-4" strokeWidth={2.5} />
        </Link>
      </section>
    </div>
  );
}
