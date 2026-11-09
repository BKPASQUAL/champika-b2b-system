// "Same item, other brand" matching for the shop.
//
// Brands name the same item differently, e.g.
//   "Orange 1/113 100m Blue Roll"  ≈  "Sierra 1/113mm Blue 100m Coil"
//   "Orange 1/1.13mm Cu/PVC/PVC Wire – Brown (1/044) - 100m Coil"  ≈  "Sierra 1/113mm Brown 100m Coil"
// So we build a "compare key" from the name: brand names and filler words are
// removed, wire sizes are turned into one standard size (1/1.13 = 1/113 = 1/.044),
// and what is left (size, colour, length, amps, gangs…) is sorted.
// Products with the same key and a different brand are alternatives.

import { supabaseAdmin } from "@/lib/supabase-admin";
import { getProducts, type ShopProductCard } from "@/lib/shop-data";
import { searchKey } from "@/lib/web-search";

// Same sizes as lib/web-search.ts (WIRE_SIZES), first spelling = standard.
const SIZE_GROUPS: string[][] = [
  ["1/1.13", "1/.044", "1/044"],
  ["7/0.53", "3/.029", "3/029"],
  ["7/0.67", "7/.029", "7/029"],
  ["7/0.85", "7/.036", "7/036"],
  ["7/1.04", "7/.044", "7/044"],
  ["7/1.35", "7/.052", "7/052"],
  ["7/1.70", "7/1.7", "7/.064", "7/064"],
];
const SIZE_OF = new Map<string, string>();
SIZE_GROUPS.forEach((g, i) => g.forEach((a) => SIZE_OF.set(searchKey(a), `size${i}`)));

/** Words that do not change what the item is. */
const FILLER = new Set([
  "wire", "wires", "cable", "cables", "coil", "coils", "roll", "rolls", "cu", "pvc", "breaker", "mm", "sq",
  "the", "and", "with", "of", "for", "type", "new", "pcs", "pc", "nos", "no", "unit",
]);

export type BrandWords = string[];

/** Brand + sub brand names, lower case, longest first (so "Orange Casablanca" goes before "Orange"). */
export async function getBrandWords(): Promise<BrandWords> {
  const { data } = await supabaseAdmin.from("web_brands").select("name");
  const words = new Set<string>();
  for (const b of data || []) {
    const n = String(b.name || "").toLowerCase().trim();
    if (!n) continue;
    words.add(n);
    for (const w of n.split(/\s+/)) if (w.length > 2) words.add(w);
  }
  // Common spellings of sub brands that are not always entered as brands.
  ["casablanka", "casablanca"].forEach((w) => words.add(w));
  return [...words].sort((a, b) => b.length - a.length);
}

/** Compare key for a product name, or null when there is too little to match on. */
export function compareKey(name: string, brandWords: BrandWords): string | null {
  let s = ` ${name.toLowerCase()} `;
  // Wire sizes → standard token. "1/1.13mm", "1/113", "(1/044)", "7/0.53mm²"…
  const tokens: string[] = [];
  s = s.replace(/(\d+)\s*\/\s*(\.?\d+(?:\.\d+)?)\s*(?:mm²|mm2|mm)?/g, (_m, a: string, b: string) => {
    const k = searchKey(`${a}/${b}`);
    tokens.push(SIZE_OF.get(k) || `size:${k}`);
    return " ";
  });
  // "1.5mm", "2.5 mm²" style sizes.
  s = s.replace(/(\d+(?:\.\d+)?)\s*(?:mm²|mm2|sq\.?\s*mm|mm)(?![a-z])/g, (_m, a: string) => {
    tokens.push(`mm:${a}`);
    return " ";
  });
  for (const w of brandWords) s = s.replace(new RegExp(`(^|[^a-z0-9])${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?=[^a-z0-9]|$)`, "g"), "$1 ");
  for (const raw of s.split(/[^a-z0-9.]+/)) {
    const t = raw.replace(/^\.+|\.+$/g, "");
    if (!t || FILLER.has(t)) continue;
    tokens.push(t === "metres" || t === "meters" ? "m" : t);
  }
  const uniq = [...new Set(tokens)].sort();
  // Need at least two things to match on (e.g. size + length), so we never group everything.
  if (uniq.length < 2) return null;
  return uniq.join(" ");
}

/** Name to show for a product's brand: the sub brand (Ruhunu, Wireman…) when it has one. */
async function brandLabels(): Promise<Map<string, string>> {
  const { data } = await supabaseAdmin.from("web_brands").select("id, name");
  return new Map((data || []).map((b: any) => [b.id as string, b.name as string]));
}

export type Alternative = {
  id: string;
  slug: string;
  name: string;
  brand: string;
  image: string | null;
  mrp: number;
  price: number;
  discountPct: number;
  available: boolean;
};

const brandOf = (p: ShopProductCard, labels: Map<string, string>) =>
  (p.subBrandId && labels.get(p.subBrandId)) || (p.brandId && labels.get(p.brandId)) || p.brand || p.name.split(" ")[0];

/**
 * For each of `ids`, the same item from other brands (cheapest first).
 * Prices are the visitor's prices (normal or trade).
 */
export async function getAlternatives(ids: string[], pool?: ShopProductCard[]): Promise<Record<string, Alternative[]>> {
  if (!ids.length) return {};
  const [all, words, labels] = await Promise.all([pool ? Promise.resolve(pool) : getProducts(), getBrandWords(), brandLabels()]);
  const groups = new Map<string, ShopProductCard[]>();
  const keyOf = new Map<string, string>();
  for (const p of all) {
    const k = compareKey(p.name, words);
    if (!k) continue;
    keyOf.set(p.id, k);
    groups.set(k, [...(groups.get(k) || []), p]);
  }
  const out: Record<string, Alternative[]> = {};
  for (const id of ids) {
    const k = keyOf.get(id);
    const me = all.find((p) => p.id === id);
    if (!k || !me) continue;
    const myBrand = brandOf(me, labels).toLowerCase();
    const seen = new Set<string>();
    const others = (groups.get(k) || [])
      .filter((p) => p.id !== id && brandOf(p, labels).toLowerCase() !== myBrand)
      .sort((a, b) => Number(b.available) - Number(a.available) || a.price - b.price)
      .filter((p) => {
        // One option per brand (its cheapest).
        const b = brandOf(p, labels).toLowerCase();
        if (seen.has(b)) return false;
        seen.add(b);
        return true;
      });
    if (others.length)
      out[id] = others.map((p) => ({
        id: p.id,
        slug: p.slug,
        name: p.name,
        brand: brandOf(p, labels),
        image: p.image,
        mrp: p.mrp,
        price: p.price,
        discountPct: p.discountPct,
        available: p.available,
      }));
  }
  return out;
}

/** Brand label for one product (used to show "This item" in the compare table). */
export async function brandLabelFor(p: ShopProductCard) {
  return brandOf(p, await brandLabels());
}

// ---------------------------------------------------------------- brand table

export type CompareCell = { id: string; name: string; price: number; mrp: number; available: boolean };
export type CompareRow = {
  /** Cart item this row is for. */
  cartId: string;
  /** Item name without the brand, e.g. "1/113 Blue 100m Coil". */
  label: string;
  /** Picture of the cart item. */
  image: string | null;
  qty: number;
  cartBrand: string;
  /** Brand name → that brand's version of this item (missing = brand does not have it). */
  cells: Record<string, CompareCell>;
};
export type CompareTable = { brands: string[]; rows: CompareRow[] };

/** Remove brand names from a product name and tidy it. */
function withoutBrand(name: string, words: BrandWords) {
  let s = ` ${name} `;
  for (const w of words) s = s.replace(new RegExp(`(^|[^a-z0-9])${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?=[^a-z0-9]|$)`, "gi"), "$1 ");
  s = s.replace(/\s+/g, " ").replace(/^[\s\-–]+|[\s\-–]+$/g, "").trim();
  return s || name;
}

/**
 * Cart items as rows and brands as columns: each cell is that brand's price for
 * the same item. Brands with the most items come first.
 */
export async function getCompareTable(items: { id: string; qty: number }[]): Promise<CompareTable> {
  const [all, words, labels] = await Promise.all([getProducts(), getBrandWords(), brandLabels()]);
  const byId = new Map(all.map((p) => [p.id, p]));
  const cartItems = items.filter((i) => byId.has(i.id));
  const alts = await getAlternatives(cartItems.map((i) => i.id), all);

  const rows: CompareRow[] = cartItems.map((i) => {
    const p = byId.get(i.id)!;
    const myBrand = brandOf(p, labels);
    const cells: Record<string, CompareCell> = {
      [myBrand]: { id: p.id, name: p.name, price: p.price, mrp: p.mrp, available: p.available },
    };
    for (const o of alts[p.id] || []) cells[o.brand] ??= { id: o.id, name: o.name, price: o.price, mrp: o.mrp, available: o.available };
    return { cartId: p.id, label: withoutBrand(p.name, words), image: p.image, qty: i.qty, cartBrand: myBrand, cells };
  });

  const count = new Map<string, number>();
  const total = new Map<string, number>();
  for (const r of rows)
    for (const [b, c] of Object.entries(r.cells)) {
      count.set(b, (count.get(b) || 0) + 1);
      total.set(b, (total.get(b) || 0) + c.price * r.qty);
    }
  const brands = [...count.keys()].sort((a, b) => count.get(b)! - count.get(a)! || total.get(a)! - total.get(b)!);
  return { brands, rows };
}
