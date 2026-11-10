/**
 * Website search helpers.
 *
 * Customers type sizes many ways: "1/113", "1/1.13", "1/.044", "1mm", "1.0mm²".
 * We store one simplified "search key" per product (lower case, no spaces,
 * dots, dashes; ² → 2) and simplify the typed words the same way, so all of
 * those spellings find the same items across every brand.
 */

/** Lower case, ² → 2, and drop spaces, dots, dashes, underscores. */
export function searchKey(s: string): string {
  return (s || "")
    .toLowerCase()
    .replace(/²/g, "2")
    .replace(/[\s.\-_]+/g, "");
}

/** Typed search → one simplified word per space-separated word. */
export function searchWords(query: string): string[] {
  return (query || "")
    .split(/\s+/)
    .map((w) => searchKey(w).replace(/[%,()*]/g, ""))
    .filter(Boolean);
}

/**
 * How Sri Lankan customers type things: Singlish, common misspellings and Sinhala.
 * Each group lists words that mean the same; typing any of them finds all of them.
 * (Words are simplified with searchKey, so "plug base" = "plugbase".)
 */
const SYNONYMS: string[][] = [
  ["wire", "wires", "wayar", "wayer", "wyre", "kambi", "kamba", "වයර්", "වයර", "කම්බි"],
  ["cable", "cables", "kebal", "kebala", "kebalaya", "cabel", "කේබල්", "කේබල"],
  ["switch", "swich", "swicth", "swith", "switc", "switchu", "සුවිච්", "ස්විච්", "ස්විච"],
  ["socket", "sockets", "soket", "sokat", "plugbase", "plagbase", "plugpoint", "සොකට්", "ප්ලග්"],
  ["plug", "plag", "plugtop", "ප්ලග්"],
  ["bulb", "bulbs", "balb", "bulbu", "lamp", "බල්බ්", "බල්බ"],
  ["light", "lights", "lite", "lait", "lamp", "ලයිට්", "ලයිට"],
  ["holder", "holdar", "holda", "හෝල්ඩර්"],
  ["breaker", "breakers", "braker", "brekar", "mcb", "trip", "බ්රේකර්", "බ්‍රේකර්"],
  ["rccb", "rcb", "elcb", "trip"],
  ["board", "dbbox", "db", "distributionboard", "බෝඩ්"],
  ["fan", "fans", "fanu", "ෆෑන්", "ෆෑන"],
  ["conduit", "pipe", "pvcpipe", "conduct", "පයිප්"],
  ["tape", "insulationtape", "ටේප්"],
  ["casablanca", "casablanka", "casablank"],
  ["orange", "orenge", "oranj", "oraange"],
  ["sierra", "siera", "sirra"],
];
const SYN_INDEX = new Map<string, string[]>();
for (const group of SYNONYMS) {
  const keys = group.map(searchKey);
  for (const k of keys) SYN_INDEX.set(k, Array.from(new Set([...(SYN_INDEX.get(k) || []), ...keys])));
}
/** Singlish filler words that are not part of an item name ("switch eka", "wire ekak ona"). */
const FILLER = new Set(["eka", "ekak", "ek", "ona", "oni", "onae", "ganna", "denna", "එක", "එකක්", "ඕන", "ඕනේ"]);

/**
 * Typed search → one group of alternatives per word (match any word in a group,
 * every group must match). Used by the shop search; staff search uses searchWords.
 */
export function searchGroups(query: string): string[][] {
  const words = searchWords(query);
  const kept = words.length > 1 ? words.filter((w) => !FILLER.has(w)) : words;
  return kept.map((w) => {
    // "switcheka" → "switch"
    const base = w.length > 5 && w.endsWith("eka") ? w.slice(0, -3) : w;
    return Array.from(new Set([w, base, ...(SYN_INDEX.get(base) || []), ...(SYN_INDEX.get(w) || [])]));
  });
}

/** Text saved in web_products.search_key. */
export function buildSearchKey(parts: (string | null | undefined)[]): string {
  return parts.filter(Boolean).map((p) => searchKey(p as string)).join(" ");
}

/**
 * Common Sri Lankan cable sizes: metric strands, old inch strands, and area.
 * The first alias of each group is how it is usually written on the website.
 */
const WIRE_SIZES: { aliases: string[]; tags: string[] }[] = [
  { aliases: ["1/1.13", "1/.044", "1/044"], tags: ["1/1.13mm", "1/113", "1/.044", "1/044", "1mm", "1.0mm", "1mm²", "1 sq mm"] },
  { aliases: ["7/0.53", "7/053", "3/.029", "3/029"], tags: ["7/0.53mm", "7/053", "3/.029", "3/029", "1.5mm", "1.5mm²", "1.5 sq mm"] },
  { aliases: ["7/0.67", "7/067", "7/.029", "7/029"], tags: ["7/0.67mm", "7/067", "7/.029", "7/029", "2.5mm", "2.5mm²", "2.5 sq mm"] },
  { aliases: ["7/0.85", "7/085", "7/.036", "7/036"], tags: ["7/0.85mm", "7/085", "7/.036", "7/036", "4mm", "4mm²", "4 sq mm"] },
  { aliases: ["7/1.04", "7/104", "7/.044", "7/044"], tags: ["7/1.04mm", "7/104", "7/.044", "7/044", "6mm", "6mm²", "6 sq mm"] },
  { aliases: ["7/1.35", "7/135", "7/.052", "7/052"], tags: ["7/1.35mm", "7/135", "7/.052", "7/052", "10mm", "10mm²", "10 sq mm"] },
  { aliases: ["7/1.70", "7/1.7", "7/170", "7/17", "7/.064", "7/064"], tags: ["7/1.70mm", "7/170", "7/.064", "7/064", "16mm", "16mm²", "16 sq mm"] },
];

/** Size tags found in a product name (e.g. "1/1.13mm" → all 1mm² spellings). */
export function suggestSizeTags(text: string): string[] {
  const key = searchKey(text);
  const out: string[] = [];
  for (const size of WIRE_SIZES) {
    // Match "1/113" but not "11/113" or "1/1130".
    const hit = size.aliases.some((a) => {
      const k = searchKey(a);
      const i = key.indexOf(k);
      if (i < 0) return false;
      const before = key[i - 1];
      const after = key[i + k.length];
      return !(before && /[0-9]/.test(before)) && !(after && /[0-9]/.test(after));
    });
    if (hit) out.push(...size.tags);
  }
  return Array.from(new Set(out));
}
