import type { Metadata } from "next";
import { getProducts, getShopBase } from "@/lib/shop-data";
import { Listing, type ListingParams } from "../_components/Listing";

type Props = { searchParams: Promise<ListingParams> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const q = ((await searchParams).q || "").trim();
  return { title: q ? `Search: ${q}` : "All products", robots: { index: false } };
}

export default async function SearchPage({ searchParams }: Props) {
  const [sp, base] = await Promise.all([searchParams, getShopBase()]);
  const q = (sp.q || "").trim().slice(0, 100);
  const products = await getProducts({ search: q });
  return (
    <Listing
      base={base}
      path="/search"
      title={q ? `Results for “${q}”` : "All products"}
      crumbs={[{ label: q ? "Search" : "All products" }]}
      products={products}
      params={sp}
    />
  );
}
