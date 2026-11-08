import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCategoryBySlug, getProducts, getShopBase } from "@/lib/shop-data";
import { Listing, type ListingParams } from "../../_components/Listing";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<ListingParams> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const found = await getCategoryBySlug((await params).slug);
  if (!found) return { title: "Category not found" };
  const c = found.category;
  return {
    title: c.name,
    description: c.description || `Buy ${c.name} online — genuine brands, discount prices and fast delivery in the Galle area.`,
    alternates: { canonical: `/c/${c.slug}` },
    openGraph: c.imageUrl ? { images: [c.imageUrl] } : undefined,
  };
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const [{ slug }, sp, base] = await Promise.all([params, searchParams, getShopBase()]);
  const found = await getCategoryBySlug(slug);
  if (!found) notFound();
  const { category: c, parent } = found;
  const products = await getProducts({ categoryId: c.id });

  return (
    <Listing
      base={base}
      path={`/c/${c.slug}`}
      title={c.name}
      description={c.description}
      crumbs={parent ? [{ label: parent.name, href: `${base}/c/${parent.slug}` }, { label: c.name }] : [{ label: c.name }]}
      products={products}
      params={sp}
      activeCategory={c.slug}
    />
  );
}
