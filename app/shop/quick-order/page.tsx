import type { Metadata } from "next";
import { getBrands, getCategoryTree, getProducts, sortProducts } from "@/lib/shop-data";
import { buildSearchKey, suggestSizeTags } from "@/lib/web-search";
import { QuickOrder, type QuickOrderBrand, type QuickOrderItem } from "./QuickOrder";

export const metadata: Metadata = {
  title: "Quick order — make your list",
  description: "Browse all items in one table, filter by category or brand, sort by price or name, and build your order fast.",
};

export default async function QuickOrderPage() {
  const [tree, all, allBrands] = await Promise.all([getCategoryTree(), getProducts(), getBrands()]);
  const cats = tree
    .flatMap((m) => (tree.length === 1 ? m.children : [m, ...m.children]))
    .filter((c) => c.productCount > 0);

  const sorted = sortProducts(all, "popular");

  // Count products per top-level brand (including sub-brands rolled up to their parent).
  const byBrandId = new Map(allBrands.map((b) => [b.id, b]));
  const brandCounts: Record<string, number> = {};
  for (const p of sorted) {
    const rawId = p.brandId || p.subBrandId;
    if (!rawId) continue;
    const b = byBrandId.get(rawId);
    const rootId = b?.parentId || rawId;
    brandCounts[rootId] = (brandCounts[rootId] || 0) + 1;
  }

  const brands: QuickOrderBrand[] = allBrands
    .filter((b) => !b.parentId && (brandCounts[b.id] || 0) > 0)
    .map((b) => ({
      id: b.id,
      name: b.name,
      logoUrl: b.logoUrl,
      count: brandCounts[b.id] || 0,
    }));

  const items: QuickOrderItem[] = sorted.map((p) => {
    const rawBrandId = p.brandId || p.subBrandId;
    const b = rawBrandId ? byBrandId.get(rawBrandId) : undefined;
    const rootBrandId = b?.parentId || rawBrandId || null;
    return {
      id: p.id,
      slug: p.slug,
      name: p.name,
      image: p.image,
      brand: p.brand,
      brandId: rootBrandId,
      categoryIds: p.categoryIds,
      mrp: p.mrp,
      price: p.price,
      discountPct: p.discountPct,
      available: p.available,
      sortOrder: p.sortOrder,
      createdAt: p.createdAt,
      searchKey: buildSearchKey([p.name, p.brand, ...suggestSizeTags(p.name)]),
    };
  });

  return (
    <QuickOrder
      categories={cats.map((c) => ({ id: c.id, name: c.name, count: c.productCount }))}
      brands={brands}
      items={items}
    />
  );
}
