import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { getCategoryTree, getShopBase } from "@/lib/shop-data";
import { AllCategories } from "../_components/AllCategories";

export const metadata: Metadata = {
  title: "All categories",
  description: "Browse every wiring category — cables & wires, switches & sockets, breakers, boards and more.",
  alternates: { canonical: "/categories" },
};

export default async function CategoriesPage() {
  const [tree, base] = await Promise.all([getCategoryTree(), getShopBase()]);
  return (
    <div className="mx-auto px-4 md:px-6 xl:px-10 py-8">
      <nav className="mb-3 flex items-center gap-1 text-xs text-(--s-muted)">
        <Link href={base || "/"} className="hover:text-(--s-ink)">Home</Link>
        <ChevronRight className="h-3 w-3" />
        <span className="text-(--s-ink)">Categories</span>
      </nav>
      <h1 className="mb-6 text-2xl font-bold md:text-[28px]">All categories</h1>
      {tree.length ? <AllCategories tree={tree} base={base} /> : <p className="text-(--s-muted)">Categories coming soon.</p>}
    </div>
  );
}
