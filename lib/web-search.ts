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
