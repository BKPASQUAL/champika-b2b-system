import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getBrands, getProducts, getShopBase, getShopSite } from "@/lib/shop-data";
import { siteProfile } from "../../../_components/site-profile";
import { Listing, type ListingParams } from "../../../_components/Listing";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<ListingParams> };

async function findBrand(slug: string) {
  const brands = await getBrands();
  const brand = brands.find((b) => b.slug === slug);
  if (!brand) return null;
  return {
    brand,
    parent: brand.parentId ? brands.find((b) => b.id === brand.parentId) ?? null : null,
    subs: brands.filter((b) => b.parentId === brand.id),
  };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const [found, site] = await Promise.all([findBrand((await params).slug), getShopSite()]);
  if (!found) return { title: "Brand not found" };
  const description =
    site === "champika"
      ? `${found.brand.name} at wholesale prices — carton rates and delivery ${siteProfile(site).deliveryWhere}.`
      : `Shop genuine ${found.brand.name} wiring accessories online — discount prices and fast delivery in the Galle area.`;
  return {
    title: `${found.brand.name} products`,
    description,
    alternates: { canonical: `/b/${found.brand.slug}` },
  };
}

export default async function BrandPage({ params, searchParams }: Props) {
  const [{ slug }, sp, base] = await Promise.all([params, searchParams, getShopBase()]);
  const found = await findBrand(slug);
  if (!found) notFound();
  const { brand, parent } = found;
  const products = await getProducts({ brandId: brand.id });

  return (
    <Listing
      base={base}
      path={`/b/${brand.slug}`}
      title={brand.name}
      crumbs={[{ label: "Brands" }, ...(parent ? [{ label: parent.name, href: `${base}/b/${parent.slug}` }] : []), { label: brand.name }]}
      products={products}
      params={sp}
      hideBrandFilter
    />
  );
}
