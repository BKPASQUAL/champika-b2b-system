import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireWebsiteStaff } from "@/lib/web-auth";
import { apiError, getAllowedMainCategories, uniqueSlug } from "@/lib/web-utils";
import { detectBrand, normaliseBrand } from "@/lib/web-brand-detect";
import { ensureBrands, ensureSuppliers } from "@/lib/web-brands";
import { refreshShop } from "@/lib/shop-cache";

/**
 * Create website products from main products (as drafts).
 *
 * Each picked main product becomes its own website product page.
 */
export async function POST(request: NextRequest) {
  const auth = await requireWebsiteStaff();
  if (auth.error) return auth.error;
  try {
    const v = z
      .object({
        productIds: z.array(z.string().uuid()).min(1).max(500),
        webCategoryId: z.string().uuid().nullable().optional(),
        publish: z.boolean().default(false),
      })
      .parse(await request.json());

    const { data: rows, error } = await supabaseAdmin
      .from("products")
      .select("id, name, category, brand, sub_brand, supplier_name, mrp, images")
      .in("id", v.productIds);
    if (error) throw error;
    // Keep the order the user picked them in.
    const allowed = await getAllowedMainCategories();
    const products = v.productIds
      .map((id) => (rows || []).find((p: any) => p.id === id))
      .filter((p: any) => p && (!allowed.length || allowed.includes(p.category))) as any[];
    if (!products.length) throw new Error(`Only ${allowed.join(", ")} items can be added to the website (see Shop Settings)`);

    // Brand → sub brand → supplier copied from the main item (created on the website if missing).
    // Brand falls back to the first word of the name when the B2B brand is empty.
    const brandOf = new Map(
      products.map((p) => [p.id, p.brand?.trim() ? normaliseBrand(p.brand.trim()) : detectBrand(p.name, null)]),
    );
    const brandIds = await ensureBrands([...brandOf.values()].filter((b): b is string => !!b));

    const subBrandIdOf = new Map<string, string>();
    for (const [brand, brandId] of brandIds) {
      const subs = products
        .filter((p) => brandOf.get(p.id) === brand && p.sub_brand?.trim())
        .map((p) => p.sub_brand.trim() as string);
      if (!subs.length) continue;
      const subIds = await ensureBrands(subs, brandId);
      for (const p of products) {
        if (brandOf.get(p.id) === brand && p.sub_brand?.trim()) subBrandIdOf.set(p.id, subIds.get(p.sub_brand.trim())!);
      }
    }

    const supplierIds = await ensureSuppliers(products.map((p) => p.supplier_name || ""));

    const createProduct = async (p: any) => {
      const brand = brandOf.get(p.id) ?? null;
      const { data, error: e } = await supabaseAdmin
        .from("web_products")
        .insert({
          name: p.name,
          slug: await uniqueSlug("web_products", p.name),
          brand_text: brand,
          web_brand_id: brand ? brandIds.get(brand) ?? null : null,
          web_sub_brand_id: subBrandIdOf.get(p.id) ?? null,
          web_supplier_id: p.supplier_name?.trim() ? supplierIds.get(p.supplier_name.trim()) ?? null : null,
          images: p.images || [],
          web_category_id: v.webCategoryId ?? null,
          is_published: v.publish,
        })
        .select("id")
        .single();
      if (e) throw e;
      return data.id as string;
    };

    let created = 0;
    for (const p of products) {
      const webId = await createProduct(p);
      const { error: vErr } = await supabaseAdmin
        .from("web_product_variants")
        .insert({ web_product_id: webId, options: {}, product_id: p.id, mrp: p.mrp, sort_order: 0 });
      if (vErr) throw vErr;
      created++;
    }
    refreshShop();
    return NextResponse.json({ created });
  } catch (e) {
    return apiError(e);
  }
}
