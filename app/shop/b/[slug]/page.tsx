import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getBrands, getProducts, getShopBase } from "@/lib/shop-data";
import { Listing, type ListingParams } from "../../_components/Listing";

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
  const found = await findBrand((await params).slug);
  if (!found) return { title: "Brand not found" };
  return {
    title: `${found.brand.name} products`,
    description: `Shop genuine ${found.brand.name} wiring accessories online — discount prices and fast delivery in the Galle area.`,
    alternates: { canonical: `/b/${found.brand.slug}` },
  };
}

export default async function BrandPage({ params, searchParams }: Props) {
  const [{ slug }, sp, base] = await Promise.all([params, searchParams, getShopBase()]);
  const found = await findBrand(slug);
  if (!found) notFound();
  const { brand, parent, subs } = found;
  const products = await getProducts({ brandId: brand.id });

  const top = subs.length ? (
    <div className="mb-6 flex flex-wrap gap-2">
      {subs.map((s) => (
        <Link key={s.id} href={`${base}/b/${s.slug}`} className="rounded-full border border-(--s-line) bg-(--s-surface) px-3 py-1 text-sm font-medium text-(--s-ink-2) hover:border-(--s-ink) hover:text-(--s-ink)">
          {s.name}
        </Link>
      ))}
    </div>
  ) : null;

  return (
    <Listing
      base={base}
      path={`/b/${brand.slug}`}
      title={brand.name}
      crumbs={[{ label: "Brands" }, ...(parent ? [{ label: parent.name, href: `${base}/b/${parent.slug}` }] : []), { label: brand.name }]}
      products={products}
      params={sp}
      hideBrandFilter
      top={top}
    />
  );
}
