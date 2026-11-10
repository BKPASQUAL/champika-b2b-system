import { cache } from "react";
import { headers } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getVisitorTier } from "@/lib/web-auth";
import { loadPriceRules, resolveVariantPrice, type PriceTier } from "@/lib/web-pricing";
import { searchGroups } from "@/lib/web-search";
import { shopBaseFor } from "@/lib/shop-host";

/**
 * Data for the public shop pages.
 *
 * Everything returned here is safe to show to the public: no cost, supplier,
 * margin or stock numbers. Prices are worked out on the server for the
 * visitor's tier (normal / approved trade customer).
 */

// ---------------------------------------------------------------- types

export type ShopCategory = {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  imageUrl: string | null;
  description: string | null;
  productCount: number;
  children: ShopCategory[];
  /** Product families inside this (sub) category, e.g. "Single core wire". */
  families: { id: string; name: string; imageUrl: string | null; productCount: number }[];
};

export type ShopBrand = { id: string; name: string; slug: string; logoUrl: string | null; parentId: string | null; productCount?: number };

export type ShopProductCard = {
  id: string;
  slug: string;
  name: string;
  image: string | null;
  brand: string | null;
  mrp: number;
  price: number;
  discountPct: number;
  available: boolean;
  isFeatured: boolean;
  createdAt: string;
  sortOrder: number;
  // ids used for filters
  categoryIds: string[];
  brandId: string | null;
  subBrandId: string | null;
  familyId: string | null;
};

export type ShopProduct = ShopProductCard & {
  shortDescription: string | null;
  description: string | null;
  specs: { label: string; value: string }[];
  images: string[];
  category: { name: string; slug: string } | null;
  subCategory: { name: string; slug: string } | null;
  family: { id: string; name: string } | null;
  brandInfo: { name: string; slug: string } | null;
  subBrandInfo: { name: string; slug: string } | null;
};

export type StoreInfo = {
  name: string;
  phone: string;
  whatsapp: string;
  address: string;
  email: string;
  /** Opening hours, e.g. "Mon–Sat 8.00am – 7.00pm". */
  hours: string;
  /** Google Maps link to the shop (optional; the address is used when empty). */
  mapUrl: string;
};
export type DeliveryInfo = { flatFee: number; freeOver: number; /** Areas we deliver to, e.g. "Galle, Matara, Hikkaduwa". */ areas: string };

// ---------------------------------------------------------------- helpers

/** Link prefix for this request: "" on the shop domain, "/shop" elsewhere. */
export const getShopBase = cache(async () => shopBaseFor((await headers()).get("host")));

const getTier = cache(async (): Promise<PriceTier> => {
  try {
    return await getVisitorTier();
  } catch {
    return "normal";
  }
});

const getRules = cache(() => loadPriceRules().catch(() => []));

const CARD_SELECT =
  "id, slug, name, images, is_featured, sort_order, created_at, web_category_id, web_sub_category_id, extra_category_ids, web_family_id, web_brand_id, web_sub_brand_id, brand_text, " +
  "brand:web_brands!web_products_web_brand_id_fkey(name), " +
  "web_product_variants(id, mrp, web_price, trade_price, qty_multiplier, image_url, is_available, sort_order, products(mrp, cost_price, brand, category))";

async function toCards(rows: any[], tierOverride?: PriceTier): Promise<ShopProductCard[]> {
  const [tier, rules] = await Promise.all([tierOverride ? Promise.resolve(tierOverride) : getTier(), getRules()]);
  const out: ShopProductCard[] = [];
  for (const p of rows) {
    const v = [...(p.web_product_variants || [])].sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0))[0];
    if (!v) continue; // not linked to a main product yet → not for sale
    const price = resolveVariantPrice(v, p, tier, rules);
    out.push({
      id: p.id,
      slug: p.slug,
      name: p.name,
      image: p.images?.[0] || v.image_url || null,
      brand: p.brand?.name || p.brand_text || null,
      mrp: price.mrp,
      price: price.price,
      discountPct: price.discountPct,
      available: v.is_available !== false,
      isFeatured: !!p.is_featured,
      createdAt: p.created_at,
      sortOrder: p.sort_order ?? 0,
      categoryIds: [p.web_category_id, p.web_sub_category_id, ...(p.extra_category_ids || [])].filter(Boolean),
      brandId: p.web_brand_id,
      subBrandId: p.web_sub_brand_id,
      familyId: p.web_family_id,
    });
  }
  return out;
}

// ---------------------------------------------------------------- settings

async function getSetting<T>(key: string): Promise<T | null> {
  const { data } = await supabaseAdmin.from("web_settings").select("value").eq("key", key).maybeSingle();
  return (data?.value as T) ?? null;
}

export const getStoreInfo = cache(async (): Promise<StoreInfo> => {
  const s = (await getSetting<any>("store")) || {};
  return {
    name: s.name || "BK Wiring",
    phone: s.phone || "",
    whatsapp: s.whatsapp || "",
    address: s.address || "",
    email: s.email || "",
    hours: s.hours || "",
    mapUrl: s.map_url || "",
  };
});

export type BankInfo = { bank: string; branch: string; accountName: string; accountNo: string };

/** Bank account shown to customers who pay by bank transfer (Settings → Bank). */
export const getBankInfo = cache(async (): Promise<BankInfo> => {
  const s = (await getSetting<any>("bank")) || {};
  return { bank: s.bank || "", branch: s.branch || "", accountName: s.account_name || "", accountNo: s.account_no || "" };
});

export const getDeliveryInfo = cache(async (): Promise<DeliveryInfo> => {
  const s = (await getSetting<any>("delivery")) || {};
  return { flatFee: Number(s.flat_fee) || 0, freeOver: Number(s.free_over) || 0, areas: String(s.areas || "") };
});

export function deliveryFee(subtotal: number, d: DeliveryInfo): number {
  if (subtotal <= 0) return 0;
  if (d.freeOver > 0 && subtotal >= d.freeOver) return 0;
  return d.flatFee;
}

// ---------------------------------------------------------------- categories & brands

/** Active categories as a tree (main → sub), with published product counts. */
export const getCategoryTree = cache(async (): Promise<ShopCategory[]> => {
  const [{ data: cats }, { data: prods }, { data: fams }] = await Promise.all([
    supabaseAdmin
      .from("web_categories")
      .select("id, name, slug, parent_id, image_url, description, sort_order")
      .eq("is_active", true)
      .order("sort_order")
      .order("name"),
    supabaseAdmin
      .from("web_products")
      .select("web_category_id, web_sub_category_id, extra_category_ids, web_family_id")
      .eq("is_published", true),
    supabaseAdmin.from("web_product_families").select("*").eq("is_active", true).order("sort_order").order("name"),
  ]);
  const famCount: Record<string, number> = {};
  for (const p of prods || []) if (p.web_family_id) famCount[p.web_family_id] = (famCount[p.web_family_id] || 0) + 1;
  const count: Record<string, number> = {};
  for (const p of prods || []) {
    const ids = new Set([p.web_category_id, p.web_sub_category_id, ...(p.extra_category_ids || [])].filter(Boolean));
    for (const id of ids) count[id as string] = (count[id as string] || 0) + 1;
  }
  const all: ShopCategory[] = (cats || []).map((c: any) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    parentId: c.parent_id,
    imageUrl: c.image_url,
    description: c.description,
    productCount: count[c.id] || 0,
    children: [],
    families: (fams || [])
      .filter((f: any) => f.web_category_id === c.id && famCount[f.id])
      .map((f: any) => ({ id: f.id, name: f.name, imageUrl: f.image_url ?? null, productCount: famCount[f.id] })),
  }));
  const byId = new Map(all.map((c) => [c.id, c]));
  const roots: ShopCategory[] = [];
  for (const c of all) {
    const parent = c.parentId ? byId.get(c.parentId) : undefined;
    if (parent) parent.children.push(c);
    else roots.push(c);
  }
  return roots;
});

export async function getCategoryBySlug(slug: string) {
  const tree = await getCategoryTree();
  for (const main of tree) {
    if (main.slug === slug) return { category: main, parent: null as ShopCategory | null };
    const sub = main.children.find((c) => c.slug === slug);
    if (sub) return { category: sub, parent: main };
  }
  return null;
}

export const getBrands = cache(async (): Promise<ShopBrand[]> => {
  const { data } = await supabaseAdmin
    .from("web_brands")
    .select("id, name, slug, logo_url, parent_id, sort_order")
    .eq("is_active", true)
    .order("sort_order")
    .order("name");
  return (data || []).map((b: any) => ({ id: b.id, name: b.name, slug: b.slug, logoUrl: b.logo_url, parentId: b.parent_id }));
});

/** Main brands for "Shop by brand" on the home page. */
export async function getFeaturedBrands(): Promise<ShopBrand[]> {
  const [{ data: brands }, { data: prods }] = await Promise.all([
    supabaseAdmin
      .from("web_brands")
      .select("id, name, slug, logo_url, parent_id, is_featured, sort_order")
      .eq("is_active", true)
      .is("parent_id", null)
      .order("sort_order")
      .order("name"),
    supabaseAdmin.from("web_products").select("web_brand_id, web_sub_brand_id").eq("is_published", true),
  ]);
  const counts: Record<string, number> = {};
  for (const p of prods || []) {
    if (p.web_brand_id) counts[p.web_brand_id] = (counts[p.web_brand_id] || 0) + 1;
  }
  const all = (brands || []).map((b: any) => ({
    id: b.id,
    name: b.name,
    slug: b.slug,
    logoUrl: b.logo_url,
    parentId: b.parent_id,
    isFeatured: Boolean(b.is_featured),
    productCount: counts[b.id] || 0,
  }));
  const featured = all.filter((b) => b.isFeatured);
  return featured.length > 0 ? featured : all;
}

export async function getBanners() {
  const { data } = await supabaseAdmin
    .from("web_banners")
    .select("id, title, image_url, link")
    .eq("is_active", true)
    .order("sort_order");
  return (data || []).map((b: any) => ({ id: b.id as string, title: b.title as string | null, imageUrl: b.image_url as string, link: b.link as string | null }));
}

// ---------------------------------------------------------------- products

export type ProductQuery = {
  categoryId?: string;
  brandId?: string; // brand or sub brand
  search?: string;
  featured?: boolean;
  ids?: string[];
  limit?: number;
  /** Price for this tier instead of the visitor's (staff pricing a quote for a customer). */
  tier?: PriceTier;
};

/** Published products as cards. Filters run in the database; prices on the server. */
export async function getProducts(q: ProductQuery = {}): Promise<ShopProductCard[]> {
  const build = (useSearchKey: boolean) => {
    let query = supabaseAdmin.from("web_products").select(CARD_SELECT).eq("is_published", true);
    if (q.categoryId)
      query = query.or(
        `web_category_id.eq.${q.categoryId},web_sub_category_id.eq.${q.categoryId},extra_category_ids.cs.{${q.categoryId}}`,
      );
    if (q.brandId) query = query.or(`web_brand_id.eq.${q.brandId},web_sub_brand_id.eq.${q.brandId}`);
    if (q.featured) query = query.eq("is_featured", true);
    if (q.ids) query = query.in("id", q.ids.length ? q.ids : ["00000000-0000-0000-0000-000000000000"]);
    // Every typed word must match; each word also matches its Singlish / Sinhala / misspelt forms.
    for (const alts of searchGroups(q.search || ""))
      query = query.or(alts.flatMap((w) => (useSearchKey ? [`name.ilike.%${w}%`, `search_key.ilike.%${w}%`] : [`name.ilike.%${w}%`])).join(","));
    query = query.order("sort_order").order("name");
    if (q.limit) query = query.limit(q.limit);
    return query;
  };
  let { data, error } = await build(true);
  // search_key column not added yet → search names only.
  if (error && /search_key/.test(error.message || "")) ({ data, error } = await build(false));
  if (error) throw new Error(error.message);
  return toCards(data || [], q.tier);
}

export async function getNewestProducts(limit = 8) {
  const all = await getProducts();
  return all.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit);
}

export async function getProductBySlug(slug: string): Promise<ShopProduct | null> {
  const { data: p } = await supabaseAdmin
    .from("web_products")
    .select(
      CARD_SELECT +
        ", short_description, description, specs, " +
        "category:web_categories!web_products_web_category_id_fkey(name, slug), " +
        "sub_category:web_categories!web_products_web_sub_category_id_fkey(name, slug), " +
        "family:web_product_families(id, name), " +
        "brand_info:web_brands!web_products_web_brand_id_fkey(name, slug), " +
        "sub_brand_info:web_brands!web_products_web_sub_brand_id_fkey(name, slug)",
    )
    .eq("slug", slug)
    .eq("is_published", true)
    .maybeSingle();
  if (!p) return null;
  const [card] = await toCards([p]);
  if (!card) return null;
  const row: any = p;
  const v = row.web_product_variants?.[0];
  const images = (row.images?.length ? row.images : v?.image_url ? [v.image_url] : []) as string[];
  return {
    ...card,
    shortDescription: row.short_description,
    description: row.description,
    specs: (Array.isArray(row.specs) ? row.specs : []).filter((s: any) => s?.label && s?.value),
    images,
    category: row.category,
    subCategory: row.sub_category,
    family: row.family,
    brandInfo: row.brand_info,
    subBrandInfo: row.sub_brand_info,
  };
}

/** Same family first, then same sub category. */
export async function getRelatedProducts(p: ShopProduct, limit = 8) {
  const catId = p.categoryIds[1] || p.categoryIds[0];
  if (!catId) return [];
  const list = (await getProducts({ categoryId: catId })).filter((x) => x.id !== p.id);
  list.sort((a, b) => Number(b.familyId === p.familyId) - Number(a.familyId === p.familyId));
  return list.slice(0, limit);
}

/** All published product slugs (sitemap). */
export async function getAllProductSlugs() {
  const { data } = await supabaseAdmin.from("web_products").select("slug, updated_at").eq("is_published", true);
  return (data || []) as { slug: string; updated_at: string }[];
}

// ---------------------------------------------------------------- listing filters

export type SortKey = "popular" | "price-asc" | "price-desc" | "newest" | "name";

export const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "popular", label: "Recommended" },
  { key: "price-asc", label: "Price: low to high" },
  { key: "price-desc", label: "Price: high to low" },
  { key: "newest", label: "Newest" },
  { key: "name", label: "Name A–Z" },
];

export function sortProducts(list: ShopProductCard[], sort: SortKey) {
  const l = [...list];
  switch (sort) {
    case "price-asc": return l.sort((a, b) => a.price - b.price);
    case "price-desc": return l.sort((a, b) => b.price - a.price);
    case "newest": return l.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    case "name": return l.sort((a, b) => a.name.localeCompare(b.name));
    default:
      // In stock first, featured next, then the order set by the office.
      return l.sort(
        (a, b) =>
          Number(b.available) - Number(a.available) ||
          Number(b.isFeatured) - Number(a.isFeatured) ||
          a.sortOrder - b.sortOrder ||
          a.name.localeCompare(b.name),
      );
  }
}

/** Brand / family counts for the filter sidebar (from the unfiltered list). */
export async function getFacets(list: ShopProductCard[]) {
  const brandCount: Record<string, number> = {};
  const familyCount: Record<string, number> = {};
  for (const p of list) {
    if (p.brandId) brandCount[p.brandId] = (brandCount[p.brandId] || 0) + 1;
    if (p.familyId) familyCount[p.familyId] = (familyCount[p.familyId] || 0) + 1;
  }
  const familyIds = Object.keys(familyCount);
  const [brands, { data: fams }] = await Promise.all([
    getBrands(),
    familyIds.length
      ? supabaseAdmin.from("web_product_families").select("id, name, sort_order").in("id", familyIds).eq("is_active", true).order("sort_order").order("name")
      : Promise.resolve({ data: [] as any[] }),
  ]);
  return {
    brands: brands
      .filter((b) => brandCount[b.id])
      .map((b) => ({ id: b.id, name: b.name, slug: b.slug, logoUrl: b.logoUrl, count: brandCount[b.id] })),
    families: (fams || []).map((f: any) => ({ id: f.id as string, name: f.name as string, count: familyCount[f.id] })),
  };
}

/** Apply the filters chosen in the URL (?brand=slug&family=id&stock=1&sort=…). */
export function applyListingFilters(
  list: ShopProductCard[],
  facets: Awaited<ReturnType<typeof getFacets>>,
  sp: { brand?: string | string[]; family?: string | string[]; stock?: string; sort?: string },
) {
  const asArr = (v?: string | string[]) => (Array.isArray(v) ? v : v ? v.split(",") : []).filter(Boolean);
  const brandSlugs = asArr(sp.brand);
  const familyIds = asArr(sp.family);
  const brandIds = new Set(facets.brands.filter((b) => brandSlugs.includes(b.slug)).map((b) => b.id));
  let out = list;
  if (brandIds.size) out = out.filter((p) => p.brandId && brandIds.has(p.brandId));
  if (familyIds.length) out = out.filter((p) => p.familyId && familyIds.includes(p.familyId));
  if (sp.stock === "1") out = out.filter((p) => p.available);
  const sort = (SORT_OPTIONS.find((o) => o.key === sp.sort)?.key || "popular") as SortKey;
  return { products: sortProducts(out, sort), sort, brandSlugs, familyIds, inStockOnly: sp.stock === "1" };
}

// ---------------------------------------------------------------- promo strip

export type PromoStripItem = {
  id: string;
  title: string;
  /** "/c/slug", "/b/slug", "/p/slug" or a full URL (shop base not added yet). */
  link: string;
  imageUrl: string | null;
  linkType: "category" | "brand" | "product" | "url";
  /** web_categories / web_brands id for "category" / "brand", product slug for "product". */
  targetId: string | null;
  badgeMode: "none" | "auto" | "text";
  badgeText: string | null;
  badgeColor: "red" | "orange" | "green" | "blue";
};

/**
 * Active items for the black promotion strip on the home page, in order.
 * Items past their end date are left out. Returns [] when the table is not there yet.
 */
export async function getPromoStrip(): Promise<PromoStripItem[]> {
  const { data, error } = await supabaseAdmin
    .from("web_promo_strip")
    .select("id, title, image_url, link_type, link_value, badge_mode, badge_text, badge_color, ends_at")
    .eq("is_active", true)
    .order("sort_order");
  if (error || !data?.length) return [];
  const now = Date.now();
  const rows = data.filter((r: any) => !r.ends_at || new Date(r.ends_at).getTime() >= now);

  const slugsOf = (t: string) => rows.filter((r: any) => r.link_type === t && r.link_value).map((r: any) => r.link_value as string);
  const [cats, brands] = await Promise.all([
    slugsOf("category").length
      ? supabaseAdmin.from("web_categories").select("id, slug, image_url").in("slug", slugsOf("category"))
      : Promise.resolve({ data: [] as any[] }),
    slugsOf("brand").length
      ? supabaseAdmin.from("web_brands").select("id, slug, logo_url").in("slug", slugsOf("brand"))
      : Promise.resolve({ data: [] as any[] }),
  ]);
  const catBy = new Map((cats.data || []).map((c: any) => [c.slug, c]));
  const brandBy = new Map((brands.data || []).map((b: any) => [b.slug, b]));

  return rows.map((r: any) => {
    const v = (r.link_value || "") as string;
    let link = v;
    let targetId: string | null = null;
    let fallbackImage: string | null = null;
    if (r.link_type === "category") {
      link = `/c/${v}`;
      targetId = catBy.get(v)?.id ?? null;
      fallbackImage = catBy.get(v)?.image_url ?? null;
    } else if (r.link_type === "brand") {
      link = `/b/${v}`;
      targetId = brandBy.get(v)?.id ?? null;
      fallbackImage = brandBy.get(v)?.logo_url ?? null;
    } else if (r.link_type === "product") {
      link = `/p/${v}`;
      targetId = v;
    }
    return {
      id: r.id,
      title: r.title,
      link: link || "/products",
      imageUrl: r.image_url || fallbackImage,
      linkType: r.link_type,
      targetId,
      badgeMode: r.badge_mode || "none",
      badgeText: r.badge_text,
      badgeColor: r.badge_color || "red",
    };
  });
}
