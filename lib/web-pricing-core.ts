// Pure price logic — safe to import in browser code.

export type PriceTier = "normal" | "trade";

export type WebPriceRule = {
  id: string;
  scope: "brand" | "category" | "web_category" | "web_brand";
  scope_value: string;
  tier: PriceTier;
  method: "mrp_discount_pct" | "cost_markup_pct";
  value: number;
  priority: number;
  is_active: boolean;
};

/** Fields needed from web_products. */
export type WebProductPriceInput = {
  mrp: number | null;
  web_price: number | null;
  trade_price: number | null;
  web_category_id: string | null;
  web_brand_id?: string | null;
  qty_multiplier?: number | null;
};

/** Fields needed from the linked main `products` row. */
export type MainProductPriceInput = {
  mrp: number | null;
  cost_price: number | null;
  brand: string | null;
  category: string | null;
};

export type ResolvedPrice = {
  mrp: number;              // shown crossed-out
  price: number;            // what the customer pays
  discountPct: number;      // % off MRP, for the badge (0 when none)
  source: "override" | "web_category" | "web_brand" | "category" | "brand" | "mrp";
  ruleId?: string;
  /** Staff-only: price was pushed up to cost because a rule went below it. */
  clampedToCost: boolean;
};

const SCOPE_ORDER: WebPriceRule["scope"][] = ["web_category", "web_brand", "category", "brand"];

const norm = (s: string | null | undefined) => (s || "").trim().toLowerCase();
const round = (n: number) => Math.round(n);

function findRule(
  rules: WebPriceRule[],
  tier: PriceTier,
  web: WebProductPriceInput,
  main: MainProductPriceInput,
): WebPriceRule | undefined {
  for (const scope of SCOPE_ORDER) {
    const key =
      scope === "web_category" ? web.web_category_id
      : scope === "web_brand" ? web.web_brand_id ?? null
      : scope === "category" ? main.category
      : main.brand;
    if (!key) continue;
    const match = rules
      .filter(
        (r) =>
          r.is_active &&
          r.tier === tier &&
          r.scope === scope &&
          (scope === "web_category" || scope === "web_brand" ? r.scope_value === key : norm(r.scope_value) === norm(key)),
      )
      .sort((a, b) => b.priority - a.priority)[0];
    if (match) return match;
  }
  return undefined;
}

/**
 * Website price for ONE web unit.
 * Order: item override → web category rule → website brand rule → main category rule → main brand rule → MRP.
 * Trade customers with no trade-specific price fall back to the normal price.
 * The price never goes below cost.
 */
export function resolveWebPrice(
  web: WebProductPriceInput,
  main: MainProductPriceInput,
  tier: PriceTier,
  rules: WebPriceRule[],
): ResolvedPrice {
  const mult = Number(web.qty_multiplier) > 0 ? Number(web.qty_multiplier) : 1;
  const mrp = round(Number(web.mrp ?? (main.mrp != null ? Number(main.mrp) * mult : 0)) || 0);
  const cost = (Number(main.cost_price) || 0) * mult;

  const pick = (t: PriceTier): Omit<ResolvedPrice, "discountPct" | "clampedToCost" | "mrp"> | null => {
    const override = t === "trade" ? web.trade_price : web.web_price;
    if (override != null && Number(override) > 0) return { price: Number(override), source: "override" };

    const rule = findRule(rules, t, web, main);
    if (rule) {
      const v = Number(rule.value) || 0;
      const price =
        rule.method === "mrp_discount_pct" ? mrp * (1 - v / 100) : cost > 0 ? cost * (1 + v / 100) : mrp;
      return { price, source: rule.scope, ruleId: rule.id };
    }
    return null;
  };

  const chosen = (tier === "trade" ? pick("trade") : null) ?? pick("normal") ?? { price: mrp, source: "mrp" as const };

  let price = round(chosen.price);
  let clampedToCost = false;
  if (cost > 0 && price < cost) {
    price = Math.ceil(cost);
    clampedToCost = true;
  }
  if (mrp > 0 && price > mrp && chosen.source !== "override") price = mrp;

  const discountPct = mrp > 0 && price < mrp ? Math.round(((mrp - price) / mrp) * 100) : 0;
  return { mrp, price, discountPct, source: chosen.source, ruleId: chosen.ruleId, clampedToCost };
}

