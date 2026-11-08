import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireWebsiteStaff } from "@/lib/web-auth";
import { apiError, getAllowedMainCategories, getMainWarehouseStock } from "@/lib/web-utils";

/**
 * Staff-only search over the main B2B product list, for linking website items.
 * Only items in the allowed B2B categories are returned (phase 1: Wiring Accessories).
 * GET ?search=switch&limit=30&subCategory=Cables%20%26%20Wires
 * GET ?facets=1  → { allowed, subCategories } for the filter dropdown
 */
export async function GET(request: NextRequest) {
  const auth = await requireWebsiteStaff();
  if (auth.error) return auth.error;
  try {
    const sp = request.nextUrl.searchParams;
    const allowed = await getAllowedMainCategories();

    if (sp.get("facets") === "1") {
      const subs = new Set<string>();
      for (let from = 0; ; from += 1000) {
        let fq = supabaseAdmin.from("products").select("sub_category").eq("is_active", true).range(from, from + 999);
        if (allowed.length) fq = fq.in("category", allowed);
        const { data } = await fq;
        for (const r of data || []) if (r.sub_category) subs.add(r.sub_category);
        if (!data || data.length < 1000) break;
      }
      return NextResponse.json({ allowed, subCategories: [...subs].sort() });
    }

    const search = (sp.get("search") || "").trim();
    const subCategory = sp.get("subCategory");
    const limit = Math.min(Number(sp.get("limit")) || 30, 100);

    let q = supabaseAdmin
      .from("products")
      .select("*") // "*" so optional columns (e.g. product_family) never break the search
      .eq("is_active", true)
      .order("name")
      .limit(limit);

    if (allowed.length) q = q.in("category", allowed);
    if (subCategory) q = q.eq("sub_category", subCategory);

    if (search) {
      const s = search.replace(/[%,()]/g, " ");
      q = q.or(`name.ilike.%${s}%,sku.ilike.%${s}%,brand.ilike.%${s}%`);
    }

    const { data, error } = await q;
    if (error) throw error;

    const ids = (data || []).map((p: any) => p.id);
    const [stock, { data: linked }] = await Promise.all([
      getMainWarehouseStock(ids),
      ids.length
        ? supabaseAdmin.from("web_product_variants").select("product_id").in("product_id", ids)
        : Promise.resolve({ data: [] as any[] }),
    ]);
    const linkedSet = new Set((linked || []).map((r: any) => r.product_id));

    return NextResponse.json(
      (data || []).map((p: any) => ({
        id: p.id,
        sku: p.sku,
        name: p.name,
        brand: p.brand,
        category: p.category,
        subCategory: p.sub_category,
        productFamily: p.product_family ?? null,
        subBrand: p.sub_brand,
        modelType: p.model_type,
        subModel: p.sub_model,
        sizeSpec: p.size_spec,
        supplierName: p.supplier_name,
        mrp: Number(p.mrp) || 0,
        sellingPrice: Number(p.selling_price) || 0,
        costPrice: Number(p.cost_price) || 0,
        images: p.images || [],
        unit: p.unit_of_measure,
        mainStock: stock[p.id] || 0,
        alreadyOnWebsite: linkedSet.has(p.id),
      })),
    );
  } catch (e) {
    return apiError(e);
  }
}
