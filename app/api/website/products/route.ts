import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireWebsiteStaff } from "@/lib/web-auth";
import { apiError, getMainWarehouseStock, uniqueSlug } from "@/lib/web-utils";
import { loadPriceRules, resolveVariantPrice, variantLabel } from "@/lib/web-pricing";
import { buildSearchKey, searchWords } from "@/lib/web-search";
import { ensureSuppliers } from "@/lib/web-brands";

const numOrNull = z.preprocess(
  (v) => (v === "" || v === undefined || v === null ? null : Number(v)),
  z.number().nonnegative().nullable(),
);

/** One website product = one main product with one price (no variants/dropdowns). */
const productSchema = z.object({
  id: z.string().uuid().optional(),
  variantId: z.string().uuid().optional(),
  name: z.string().trim().min(1, "Name is required"),
  shortDescription: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  specs: z.array(z.object({ label: z.string().trim(), value: z.string().trim() })).default([]),
  webCategoryId: z.string().uuid().nullable().optional(),
  extraCategoryIds: z.array(z.string().uuid()).default([]),
  tags: z.array(z.string().trim().min(1)).default([]),
  brandText: z.string().nullable().optional(),
  webBrandId: z.string().uuid().nullable().optional(),
  webSubCategoryId: z.string().uuid().nullable().optional(),
  webFamilyId: z.string().uuid().nullable().optional(),
  webSubBrandId: z.string().uuid().nullable().optional(),
  webSupplierId: z.string().uuid().nullable().optional(),
  images: z.array(z.string()).max(10).default([]),
  isPublished: z.boolean().default(false),
  isFeatured: z.boolean().default(false),
  sortOrder: z.coerce.number().int().default(0),
  productId: z.string().uuid({ message: "Link a main product" }),
  mrp: numOrNull,
  webPrice: numOrNull,
  tradePrice: numOrNull,
  isAvailable: z.boolean().default(true),
});

const range = (nums: number[]) => (nums.length ? { min: Math.min(...nums), max: Math.max(...nums) } : { min: 0, max: 0 });

async function loadVariants(webProductIds: string[]) {
  if (!webProductIds.length) return [];
  const { data, error } = await supabaseAdmin
    .from("web_product_variants")
    .select(
      "id, web_product_id, options, product_id, qty_multiplier, mrp, web_price, trade_price, image_url, is_available, sort_order, products!inner(*)",
    )
    .in("web_product_id", webProductIds)
    .order("sort_order");
  if (error) throw error;
  return data || [];
}

/**
 * Staff list: GET ?search=&categoryId=&status=published|draft|unavailable
 * Single product with all variants (for the edit form): GET ?id=<uuid>
 */
export async function GET(request: NextRequest) {
  const auth = await requireWebsiteStaff();
  if (auth.error) return auth.error;
  try {
    const sp = request.nextUrl.searchParams;
    const id = sp.get("id");
    const search = (sp.get("search") || "").trim().replace(/[%,()]/g, " ");
    const categoryId = sp.get("categoryId");
    const brandId = sp.get("brandId");
    const status = sp.get("status");

    let q = supabaseAdmin.from("web_products").select(
        "*, web_categories!web_products_web_category_id_fkey(name), sub_category:web_categories!web_products_web_sub_category_id_fkey(name), web_product_families(name), brand:web_brands!web_products_web_brand_id_fkey(name), sub_brand:web_brands!web_products_web_sub_brand_id_fkey(name), web_suppliers(name)",
      ).order("sort_order").order("name");
    if (id) q = q.eq("id", id);
    // Every typed word must match the name or the saved search text (tags, brand, specs).
    // Search text ignores dots/spaces, so "1/113" finds "1/1.13mm".
    for (const w of searchWords(search)) q = q.or(`name.ilike.%${w}%,search_key.ilike.%${w}%`);
    if (categoryId === "none") q = q.is("web_category_id", null);
    else if (categoryId) q = q.or(`web_category_id.eq.${categoryId},web_sub_category_id.eq.${categoryId},extra_category_ids.cs.{${categoryId}}`);
    if (brandId === "none") q = q.is("web_brand_id", null);
    else if (brandId) q = q.or(`web_brand_id.eq.${brandId},web_sub_brand_id.eq.${brandId}`);
    if (status === "published") q = q.eq("is_published", true);
    if (status === "draft") q = q.eq("is_published", false);

    const [{ data: parents, error }, rules] = await Promise.all([q, loadPriceRules()]);
    if (error) throw error;

    const ids = (parents || []).map((p: any) => p.id);
    const [variants, { data: options }] = await Promise.all([
      loadVariants(ids),
      ids.length
        ? supabaseAdmin.from("web_product_options").select("*").in("web_product_id", ids).order("position")
        : Promise.resolve({ data: [] as any[] }),
    ]);
    const stock = await getMainWarehouseStock([...new Set(variants.map((v: any) => v.product_id))]);

    let result = (parents || []).map((p: any) => {
      const opts = (options || []).filter((o: any) => o.web_product_id === p.id);
      const optOrder = opts.map((o: any) => o.name);
      const vs = variants
        .filter((v: any) => v.web_product_id === p.id)
        .map((v: any) => {
          const main = v.products;
          const mult = Number(v.qty_multiplier) || 1;
          const normal = resolveVariantPrice(v, p, "normal", rules);
          const trade = resolveVariantPrice(v, p, "trade", rules);
          return {
            id: v.id,
            options: v.options || {},
            label: variantLabel(v.options, optOrder) || "Default",
            productId: v.product_id,
            qtyMultiplier: mult,
            mrp: v.mrp,
            webPrice: v.web_price,
            tradePrice: v.trade_price,
            imageUrl: v.image_url,
            isAvailable: v.is_available,
            sortOrder: v.sort_order,
            main: {
              sku: main.sku,
              name: main.name,
              brand: main.brand,
              category: main.category,
              supplierName: main.supplier_name,
              subBrand: main.sub_brand,
              subCategory: main.sub_category,
              productFamily: main.product_family ?? null,
              unit: main.unit_of_measure,
              mrp: Number(main.mrp) || 0,
              costPrice: Number(main.cost_price) || 0,
              stock: stock[v.product_id] || 0,
            },
            unitCost: (Number(main.cost_price) || 0) * mult,
            normalPrice: normal,
            tradePriceResolved: trade,
          };
        });
      const normalPrices = vs.map((v) => v.normalPrice.price);
      return {
        id: p.id,
        slug: p.slug,
        name: p.name,
        shortDescription: p.short_description,
        description: p.description,
        specs: p.specs || [],
        webCategoryId: p.web_category_id,
        webCategoryName: p.web_categories?.name ?? null,
        extraCategoryIds: p.extra_category_ids || [],
        tags: p.tags || [],
        brandText: p.brand_text,
        webBrandId: p.web_brand_id,
        webBrandName: p.brand?.name ?? null,
        webSubCategoryId: p.web_sub_category_id,
        webSubCategoryName: p.sub_category?.name ?? null,
        webFamilyId: p.web_family_id,
        webFamilyName: p.web_product_families?.name ?? null,
        webSubBrandId: p.web_sub_brand_id,
        webSubBrandName: p.sub_brand?.name ?? null,
        webSupplierId: p.web_supplier_id,
        webSupplierName: p.web_suppliers?.name ?? null,
        images: p.images || [],
        isPublished: p.is_published,
        isFeatured: p.is_featured,
        sortOrder: p.sort_order,
        options: opts.map((o: any) => ({ name: o.name, values: o.values || [] })),
        variants: vs,
        summary: {
          variantCount: vs.length,
          availableCount: vs.filter((v) => v.isAvailable).length,
          price: range(normalPrices),
          tradePrice: range(vs.map((v) => v.tradePriceResolved.price)),
          minMarginPct: vs.length
            ? Math.min(...vs.map((v) => (v.normalPrice.price > 0 ? ((v.normalPrice.price - v.unitCost) / v.normalPrice.price) * 100 : 0)))
            : 0,
          belowCostWarning: vs.some((v) => v.normalPrice.clampedToCost || v.tradePriceResolved.clampedToCost),
          zeroStockCount: vs.filter((v) => v.main.stock <= 0).length,
        },
      };
    });

    if (status === "unavailable") result = result.filter((p) => p.summary.availableCount < p.summary.variantCount);

    if (id) {
      if (!result[0]) return NextResponse.json({ error: "Not found" }, { status: 404 });
      return NextResponse.json(result[0]);
    }
    return NextResponse.json(result);
  } catch (e) {
    return apiError(e);
  }
}

/** Create (no id) or update (with id) a product and its single sale row. */
export async function POST(request: NextRequest) {
  const auth = await requireWebsiteStaff();
  if (auth.error) return auth.error;
  try {
    const v = productSchema.parse(await request.json());
    const now = new Date().toISOString();

    // Supplier always comes from the linked main product (not chosen on the website page).
    const { data: main } = await supabaseAdmin.from("products").select("supplier_name").eq("id", v.productId).maybeSingle();
    const supplierName = (main?.supplier_name || "").trim();
    const webSupplierId = supplierName ? (await ensureSuppliers([supplierName])).get(supplierName) ?? null : null;

    const row = {
      name: v.name,
      slug: await uniqueSlug("web_products", v.name, v.id),
      short_description: v.shortDescription ?? null,
      description: v.description ?? null,
      specs: v.specs.filter((s) => s.label && s.value),
      web_category_id: v.webCategoryId ?? null,
      extra_category_ids: v.extraCategoryIds.filter((c) => c !== v.webCategoryId),
      tags: v.tags,
      web_brand_id: v.webBrandId ?? null,
      web_sub_category_id: v.webSubCategoryId ?? null,
      web_family_id: v.webFamilyId ?? null,
      web_sub_brand_id: v.webSubBrandId ?? null,
      web_supplier_id: webSupplierId,
      brand_text: v.brandText ?? null,
      images: v.images,
      is_published: v.isPublished,
      is_featured: v.isFeatured,
      sort_order: v.sortOrder,
      updated_at: now,
    };
    // Simplified text for search: name, tags, brand, sub brand and spec values.
    const brandIds = [v.webBrandId, v.webSubBrandId].filter(Boolean) as string[];
    const { data: brandRows } = brandIds.length
      ? await supabaseAdmin.from("web_brands").select("name").in("id", brandIds)
      : { data: [] as { name: string }[] };
    const searchText = buildSearchKey([
      v.name,
      v.brandText,
      ...(brandRows || []).map((b: any) => b.name),
      ...v.tags,
      ...v.specs.map((x) => x.value),
    ]);

    const write = (r: Record<string, unknown>) =>
      (v.id
        ? supabaseAdmin.from("web_products").update(r).eq("id", v.id)
        : supabaseAdmin.from("web_products").insert(r)
      )
        .select()
        .single();
    let { data: saved, error } = await write({ ...row, search_key: searchText });
    // search_key column not added yet (SQL not run) → save without it.
    if (error && /search_key/.test(error.message || "")) ({ data: saved, error } = await write(row));
    if (error) throw error;
    const productId = saved.id as string;

    const sale = {
      web_product_id: productId,
      options: {},
      product_id: v.productId,
      qty_multiplier: 1,
      mrp: v.mrp,
      web_price: v.webPrice,
      trade_price: v.tradePrice,
      is_available: v.isAvailable,
      sort_order: 0,
      updated_at: now,
    };
    const { data: existing } = await supabaseAdmin
      .from("web_product_variants")
      .select("id")
      .eq("web_product_id", productId)
      .order("sort_order")
      .limit(1);
    const saleId = v.variantId || existing?.[0]?.id;
    const { error: sErr } = saleId
      ? await supabaseAdmin.from("web_product_variants").update(sale).eq("id", saleId).eq("web_product_id", productId)
      : await supabaseAdmin.from("web_product_variants").insert(sale);
    if (sErr) throw sErr;

    return NextResponse.json({ id: productId, slug: saved.slug }, { status: v.id ? 200 : 201 });
  } catch (e) {
    return apiError(e);
  }
}

/**
 * Quick toggles from the list.
 * Products: { ids: [], isPublished?, isFeatured?, webCategoryId? }
 * Stock:    { ids: [] (product ids) | variantIds: [], isAvailable }
 */
export async function PATCH(request: NextRequest) {
  const auth = await requireWebsiteStaff();
  if (auth.error) return auth.error;
  try {
    const v = z
      .object({
        ids: z.array(z.string().uuid()).optional(),
        variantIds: z.array(z.string().uuid()).optional(),
        isAvailable: z.boolean().optional(),
        isPublished: z.boolean().optional(),
        isFeatured: z.boolean().optional(),
        webCategoryId: z.string().uuid().nullable().optional(),
      })
      .parse(await request.json());

    if (v.isAvailable !== undefined) {
      let q = supabaseAdmin.from("web_product_variants").update({ is_available: v.isAvailable, updated_at: new Date().toISOString() });
      if (v.variantIds?.length) q = q.in("id", v.variantIds);
      else if (v.ids?.length) q = q.in("web_product_id", v.ids);
      else throw new Error("Nothing selected");
      const { error } = await q;
      if (error) throw error;
    }

    const patch: Record<string, any> = {};
    if (v.isPublished !== undefined) patch.is_published = v.isPublished;
    if (v.isFeatured !== undefined) patch.is_featured = v.isFeatured;
    if (v.webCategoryId !== undefined) patch.web_category_id = v.webCategoryId;
    if (Object.keys(patch).length) {
      if (!v.ids?.length) throw new Error("Nothing selected");
      const { error } = await supabaseAdmin
        .from("web_products")
        .update({ ...patch, updated_at: new Date().toISOString() })
        .in("id", v.ids);
      if (error) throw error;
    }
    return NextResponse.json({ success: true });
  } catch (e) {
    return apiError(e);
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await requireWebsiteStaff();
  if (auth.error) return auth.error;
  const id = request.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });
  try {
    const [{ count: oc }, { count: qc }] = await Promise.all([
      supabaseAdmin.from("web_order_items").select("id", { count: "exact", head: true }).eq("web_product_id", id),
      supabaseAdmin.from("web_quote_items").select("id", { count: "exact", head: true }).eq("web_product_id", id),
    ]);
    if ((oc || 0) + (qc || 0) > 0) {
      return NextResponse.json(
        { error: "This product is used in orders or quotations. Unpublish it instead of deleting." },
        { status: 409 },
      );
    }
    const { error } = await supabaseAdmin.from("web_products").delete().eq("id", id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (e) {
    return apiError(e);
  }
}
