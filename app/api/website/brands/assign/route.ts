import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireWebsiteStaff } from "@/lib/web-auth";
import { apiError } from "@/lib/web-utils";
import { detectBrand, normaliseBrand } from "@/lib/web-brand-detect";
import { ensureBrands } from "@/lib/web-brands";
import { refreshShop } from "@/lib/shop-cache";

/**
 * GET: suggested brand for every website product (from the linked main
 * product's name). ?onlyMissing=1 limits to products with no brand yet.
 */
export async function GET(request: NextRequest) {
  const auth = await requireWebsiteStaff();
  if (auth.error) return auth.error;
  try {
    const onlyMissing = request.nextUrl.searchParams.get("onlyMissing") === "1";
    let q = supabaseAdmin
      .from("web_products")
      .select("id, name, web_brand_id, brand:web_brands!web_products_web_brand_id_fkey(name), web_product_variants(products(name, brand))")
      .order("name");
    if (onlyMissing) q = q.is("web_brand_id", null);
    const { data, error } = await q;
    if (error) throw error;

    return NextResponse.json(
      (data || []).map((p: any) => {
        const main = p.web_product_variants?.[0]?.products;
        return {
          id: p.id,
          name: p.name,
          mainName: main?.name ?? null,
          currentBrand: p.brand?.name ?? null,
          suggested: main?.brand?.trim() ? normaliseBrand(main.brand.trim()) : detectBrand(main?.name || p.name, null),
        };
      }),
    );
  } catch (e) {
    return apiError(e);
  }
}

/** POST { assignments: [{ webProductId, brandName|null }] } — creates missing brands. */
export async function POST(request: NextRequest) {
  const auth = await requireWebsiteStaff();
  if (auth.error) return auth.error;
  try {
    const { assignments } = z
      .object({
        assignments: z.array(z.object({ webProductId: z.string().uuid(), brandName: z.string().trim().nullable() })).min(1),
      })
      .parse(await request.json());

    const ids = await ensureBrands(assignments.map((a) => a.brandName || ""));
    // Group by brand so it is one update per brand.
    const groups = new Map<string, string[]>();
    for (const a of assignments) {
      const key = a.brandName?.trim() || "";
      groups.set(key, [...(groups.get(key) || []), a.webProductId]);
    }
    for (const [name, productIds] of groups) {
      const { error } = await supabaseAdmin
        .from("web_products")
        .update({ web_brand_id: name ? ids.get(name) : null, brand_text: name || null, updated_at: new Date().toISOString() })
        .in("id", productIds);
      if (error) throw error;
    }
    refreshShop();
    return NextResponse.json({ updated: assignments.length });
  } catch (e) {
    return apiError(e);
  }
}
