import Link from "next/link";
import { SearchX } from "lucide-react";
import { getShopBase } from "@/lib/shop-data";

export default async function ShopNotFound() {
  const base = await getShopBase();
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-24 text-center">
      <SearchX className="h-14 w-14 text-neutral-300" />
      <h1 className="mt-4 text-xl font-bold text-(--s-ink)">Page not found</h1>
      <p className="mt-1 text-(--s-muted)">This item may have been removed. Try searching for it instead.</p>
      <Link href={`${base}/search`} className="mt-6 rounded-full bg-(--s-btn) px-6 py-3 font-semibold text-(--s-btn-ink) hover:opacity-85">
        Browse all products
      </Link>
    </div>
  );
}
