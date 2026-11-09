// "Same item, other brand" matching for the shop.
//
// Brands name the same item differently, e.g.
//   "Orange 1/113 100m Blue Roll"  ≈  "Sierra 1/113mm Blue 100m Coil"
//   "Orange Casablanca 13A S/Socket Outlet (Plug Base)"  ≈  "ACL Elegance 13A Switched Socket Black"
// So we build a "compare key" from the name: brand / range names and filler words
// are removed, wire sizes become one standard size (1/1.13 = 1/113 = 1/.044),
// "plug base" = "socket", "2 gang 1 way" stays together, and what is left is sorted.
//
// Colour:
//   • Wires: colour is part of the item (brown and blue wires are not the same).
//   • Switches, sockets and other fittings: colour is a style choice, so it is
//     not part of the key. It becomes part of the option name instead, e.g.
//     "Akoya Black", "Akoya White", "Elegance Grey".

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
  "the", "and", "with", "of", "for", "type", "new", "pcs", "pc", "nos", "no", "unit", "outlet", "switched", "s",
  "range", "series", "colour", "color",
]);

/** Colour words. "gray" is shown as "Grey". */
const COLOURS = ["black", "white", "grey", "gray", "silver", "gold", "brown", "blue", "red", "green", "yellow", "cream", "ivory", "beige", "champagne", "bronze"];
const COLOUR_RE = new RegExp(`(^|[^a-z])(${COLOURS.join("|")})(?=[^a-z]|$)`, "g");

export type BrandWords = string[];

/** Brand + sub brand (range) names, lower case, longest first. */
export async function getBrandWords(): Promise<BrandWords> {
  const { data } = await supabaseAdmin.from("web_brands").select("name");
  const words = new Set<string>();
  for (const b of data || []) {
    const n = String(b.name || "").toLowerCase().trim();
    if (!n) continue;
    words.add(n);
    for (const w of n.split(/\s+/)) if (w.length > 2) words.add(w);
  }
  // Common spellings of ranges that are not always entered as brands.
  ["casablanka", "casablanca"].forEach((w) => words.add(w));
  return [...words].sort((a, b) => b.length - a.length);
}

const escapeRe = (w: string) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const wordRe = (w: string, flags: string) => new RegExp(`(^|[^a-z0-9])${escapeRe(w)}(?=[^a-z0-9]|$)`, flags);

type Parsed = { key: string | null; colour: string | null; isWire: boolean };

/** Compare key + colour for a product name. */
export function parseItem(name: string, brandWords: BrandWords): Parsed {
  let s = ` ${name.toLowerCase()} `;
  const tokens: string[] = [];

  // Wire sizes → standard token. "1/1.13mm", "1/113", "(1/044)", "7/0.53mm²"…
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
  const isWire = tokens.length > 0 || /\b(wire|cable|coil|flexible|twin|earth)\b/.test(s);

  // Same item, different words.
  s = s
    .replace(/plug\s*base/g, " socket ")
    .replace(/plug\s*top/g, " plugtop ")
    .replace(/s\s*\/\s*socket/g, " socket ")
    .replace(/sockets?/g, " socket ")
    .replace(/(\d+)\s*(gang|way|pole|core|amp|a)(?![a-z])/g, " $1$2 ");

  // Colour: part of the item for wires, an option for fittings.
  let colour: string | null = null;
  if (!isWire) {
    s = s.replace(COLOUR_RE, (_m, pre: string, c: string) => {
      colour ??= c === "gray" ? "grey" : c;
      return `${pre} `;
    });
  }

  for (const w of brandWords) s = s.replace(wordRe(w, "g"), "$1 ");
  for (const raw of s.split(/[^a-z0-9.]+/)) {
    const t = raw.replace(/^\.+|\.+$/g, "");
    if (!t || FILLER.has(t)) continue;
    tokens.push(t === "metres" || t === "meters" ? "m" : t);
  }
  const uniq = [...new Set(tokens)].sort();
  // Need at least two things to match on (e.g. size + length), so we never group everything.
  return { key: uniq.length < 2 ? null : uniq.join(" "), colour, isWire };
}

/** Compare key only (kept for older callers). */
export function compareKey(name: string, brandWords: BrandWords): string | null {
  return parseItem(name, brandWords).key;
}

type BrandInfo = {
  name: string;
  parentId: string | null;
  logoUrl: string | null;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
};
async function brandInfo(): Promise<Map<string, BrandInfo>> {
  const { data } = await supabaseAdmin
    .from("web_brands")
    .select("id, name, parent_id, logo_url, description, sort_order, is_active")
    .order("sort_order")
    .order("name");
  return new Map(
    (data || []).map((b: any) => [
      b.id as string,
      {
        name: b.name as string,
        parentId: (b.parent_id as string | null) ?? null,
        logoUrl: (b.logo_url as string | null) ?? null,
        description: (b.description as string | null) ?? null,
        sortOrder: Number(b.sort_order ?? 0),
        isActive: b.is_active !== false,
      },
    ]),
  );
}

const title = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * How one option is named in comparisons:
 *   label = range (sub brand) or brand, plus colour for fittings → "Akoya Black"
 *   maker = the main brand → "Orange"
 */
function optionOf(p: ShopProductCard, brands: Map<string, BrandInfo>, parsed: Parsed) {
  const sub = p.subBrandId ? brands.get(p.subBrandId) : undefined;
  const main = p.brandId ? brands.get(p.brandId) : undefined;
  const maker = main?.name || (sub?.parentId ? brands.get(sub.parentId)?.name : undefined) || p.brand || p.name.split(" ")[0];
  const base = sub?.name || maker;
  const label = parsed.colour ? `${base} ${title(parsed.colour)}` : base;
  return { label, maker };
}

export type Alternative = {
  id: string;
  slug: string;
  name: string;
  /** Option name, e.g. "Sierra" or "Akoya Black". */
  brand: string;
  /** Main brand, e.g. "Orange". */
  maker: string;
  image: string | null;
  mrp: number;
  price: number;
  discountPct: number;
  available: boolean;
};

type Ctx = { all: ShopProductCard[]; words: BrandWords; brands: Map<string, BrandInfo> };
async function loadCtx(pool?: ShopProductCard[]): Promise<Ctx> {
  const [all, words, brands] = await Promise.all([pool ? Promise.resolve(pool) : getProducts(), getBrandWords(), brandInfo()]);
  return { all, words, brands };
}

function alternativesWith(ctx: Ctx, ids: string[]): Record<string, Alternative[]> {
  const parsed = new Map<string, Parsed>();
  const groups = new Map<string, ShopProductCard[]>();
  for (const p of ctx.all) {
    const it = parseItem(p.name, ctx.words);
    parsed.set(p.id, it);
    if (!it.key) continue;
    groups.set(it.key, [...(groups.get(it.key) || []), p]);
  }
  const out: Record<string, Alternative[]> = {};
  for (const id of ids) {
    const me = ctx.all.find((p) => p.id === id);
    const key = me && parsed.get(id)?.key;
    if (!me || !key) continue;
    const mine = optionOf(me, ctx.brands, parsed.get(id)!).label.toLowerCase();
    const seen = new Set<string>();
    const others = (groups.get(key) || [])
      .filter((p) => p.id !== id)
      .map((p) => ({ p, opt: optionOf(p, ctx.brands, parsed.get(p.id)!) }))
      .filter(({ opt }) => opt.label.toLowerCase() !== mine)
      .sort((a, b) => Number(b.p.available) - Number(a.p.available) || a.p.price - b.p.price)
      .filter(({ opt }) => {
        // One product per option (its cheapest).
        const k = opt.label.toLowerCase();
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
    if (others.length)
      out[id] = others.map(({ p, opt }) => ({
        id: p.id,
        slug: p.slug,
        name: p.name,
        brand: opt.label,
        maker: opt.maker,
        image: p.image,
        mrp: p.mrp,
        price: p.price,
        discountPct: p.discountPct,
        available: p.available,
      }));
  }
  return out;
}

/**
 * For each of `ids`, the same item from other brands / ranges / colours
 * (cheapest first). Prices are the visitor's prices (normal or trade).
 */
export async function getAlternatives(ids: string[], pool?: ShopProductCard[]): Promise<Record<string, Alternative[]>> {
  if (!ids.length) return {};
  return alternativesWith(await loadCtx(pool), ids);
}

/** Option name for one product (shown as "This item" in the product page table). */
export async function brandLabelFor(p: ShopProductCard) {
  const [words, brands] = await Promise.all([getBrandWords(), brandInfo()]);
  return optionOf(p, brands, parseItem(p.name, words)).label;
}

// ---------------------------------------------------------------- brand table

export type CompareCell = {
  id: string;
  slug: string;
  name: string;
  maker: string;
  image: string | null;
  price: number;
  mrp: number;
  available: boolean;
};
export type CompareRow = {
  /** Cart item this row is for. */
  cartId: string;
  /** Item name without the brand, e.g. "1/113 Blue 100m Coil". */
  label: string;
  /** Picture of the cart item. */
  image: string | null;
  qty: number;
  /** Type of item (the sub category), e.g. "Cables & Wires" or "Switches & Sockets". */
  group: string;
  cartBrand: string;
  /** Option name → that option's version of this item (missing = it does not have it). */
  cells: Record<string, CompareCell>;
};
export type CompareBrandLogo = {
  id: string;
  name: string;
  parentId?: string | null;
  /** The brand or sub-brand's own uploaded image (`web_brands.logo_url`). */
  imageUrl?: string | null;
  /** Effective logo URL (own `logo_url`, or parent brand's `logo_url` for sub-brands). */
  logoUrl: string | null;
  /** Description entered on the Brands / Sub-brands admin page (`web_brands.description`). */
  description?: string | null;
};
export type CompareTable = { brands: string[]; rows: CompareRow[]; brandLogos: CompareBrandLogo[] };

/** Remove brand names from a product name and tidy it. */
function withoutBrand(name: string, words: BrandWords) {
  let s = ` ${name} `;
  for (const w of words) s = s.replace(wordRe(w, "gi"), "$1 ");
  s = s.replace(/\s+/g, " ").replace(/^[\s\-–]+|[\s\-–]+$/g, "").trim();
  return s || name;
}

/**
 * Cart items as rows and options (brand / range / colour) as columns: each cell
 * is that option's price for the same item.
 */
export async function getCompareTable(items: { id: string; qty: number }[]): Promise<CompareTable> {
  const [ctx, cats] = await Promise.all([loadCtx(), supabaseAdmin.from("web_categories").select("id, name")]);
  const catName = new Map((cats.data || []).map((c: any) => [c.id as string, c.name as string]));
  const byId = new Map(ctx.all.map((p) => [p.id, p]));
  const cartItems = items.filter((i) => byId.has(i.id));
  const alts = alternativesWith(ctx, cartItems.map((i) => i.id));

  const rows: CompareRow[] = cartItems.map((i) => {
    const p = byId.get(i.id)!;
    const mine = optionOf(p, ctx.brands, parseItem(p.name, ctx.words));
    const cells: Record<string, CompareCell> = {
      [mine.label]: {
        id: p.id,
        slug: p.slug,
        name: p.name,
        maker: mine.maker,
        image: p.image,
        price: p.price,
        mrp: p.mrp,
        available: p.available,
      },
    };
    for (const o of alts[p.id] || [])
      cells[o.brand] ??= {
        id: o.id,
        slug: o.slug,
        name: o.name,
        maker: o.maker,
        image: o.image,
        price: o.price,
        mrp: o.mrp,
        available: o.available,
      };
    const group = catName.get(p.categoryIds[1] || "") || catName.get(p.categoryIds[0] || "") || "Other items";
    return { cartId: p.id, label: withoutBrand(p.name, ctx.words), image: p.image, qty: i.qty, group, cartBrand: mine.label, cells };
  });

  const count = new Map<string, number>();
  const total = new Map<string, number>();
  for (const r of rows)
    for (const [b, c] of Object.entries(r.cells)) {
      count.set(b, (count.get(b) || 0) + 1);
      total.set(b, (total.get(b) || 0) + c.price * r.qty);
    }
  const brands = [...count.keys()].sort(
    (a, b) => count.get(b)! - count.get(a)! || total.get(a)! - total.get(b)! || a.localeCompare(b),
  );
  const brandLogos: CompareBrandLogo[] = [];
  for (const [id, b] of ctx.brands.entries()) {
    if (!b.isActive) continue;
    const parent = b.parentId ? ctx.brands.get(b.parentId) : undefined;
    const logoUrl = b.logoUrl || parent?.logoUrl || null;
    brandLogos.push({
      id,
      name: b.name,
      parentId: b.parentId,
      imageUrl: b.logoUrl,
      logoUrl,
      description: b.description || null,
    });
  }
  return { brands, rows, brandLogos };
}
