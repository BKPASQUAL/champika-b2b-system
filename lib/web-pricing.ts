import { supabaseAdmin } from "@/lib/supabase-admin";
import type { WebPriceRule, PriceTier, ResolvedPrice } from "@/lib/web-pricing-core";
import { resolveWebPrice } from "@/lib/web-pricing-core";

export * from "@/lib/web-pricing-core";

/** Load all active price rules (small table — fine to load per request). */
export async function loadPriceRules(): Promise<WebPriceRule[]> {
  const { data, error } = await supabaseAdmin
    .from("web_price_rules")
    .select("id, scope, scope_value, tier, method, value, priority, is_active")
    .eq("is_active", true);
  if (error) throw new Error(`Failed to load price rules: ${error.message}`);
  return (data || []) as WebPriceRule[];
}

/** Select string for web_product_variants joined to its main product's pricing fields. */
export const VARIANT_PRICE_SELECT =
  "id, web_product_id, options, product_id, qty_multiplier, mrp, web_price, trade_price, image_url, is_available, sort_order, products!inner(mrp, cost_price, brand, category)";

/**
 * Price of one variant. The website-category rule uses the PARENT product's
 * category; brand/category rules use the variant's linked main product, so a
 * "Brand" option (ACL vs Orange) can follow different brand rules.
 */
export function resolveVariantPrice(
  variant: any,
  parent: { web_category_id: string | null; web_brand_id?: string | null },
  tier: PriceTier,
  rules: WebPriceRule[],
): ResolvedPrice {
  const main = Array.isArray(variant.products) ? variant.products[0] : variant.products;
  return resolveWebPrice(
    { ...variant, web_category_id: parent.web_category_id, web_brand_id: parent.web_brand_id ?? null },
    main || { mrp: null, cost_price: null, brand: null, category: null },
    tier,
    rules,
  );
}

/** "ACL / 100M Roll / Brown" in option order. */
export function variantLabel(options: Record<string, string> | null | undefined, order?: string[]): string {
  if (!options) return "";
  const keys = order?.length ? order.filter((k) => k in options) : Object.keys(options);
  return keys.map((k) => options[k]).filter(Boolean).join(" / ");
}
