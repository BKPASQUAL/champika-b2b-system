import type { Metadata } from "next";
import { getProducts, getShopBase } from "@/lib/shop-data";
import { Listing, type ListingParams } from "../_components/Listing";

export const metadata: Metadata = {
  title: "Shop all products",
  description: "All wiring accessories in one place — filter by brand and type, sort by price.",
  alternates: { canonical: "/products" },
};

type Props = { searchParams: Promise<ListingParams> };

export default async function ProductsPage({ searchParams }: Props) {
  const [sp, base, products] = await Promise.all([searchParams, getShopBase(), getProducts()]);
  return <Listing base={base} path="/products" title="Shop" crumbs={[{ label: "Shop" }]} products={products} params={sp} />;
}
