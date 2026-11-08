// Pure helper — safe in browser and server code.

/**
 * Website brand from a main product name. The B2B `brand` field is not
 * reliable (e.g. Ruhunu / Wireman items are stored as "Orange"), so the
 * words BEFORE the first size code are used:
 *   "ACL Fire Guard 1/113 Blue 100M" → "ACL"
 *   "Ruhunu 1/113mm Brown 50m Coil"  → "Ruhunu"
 *   "Wireman 1 Gang 1 Way"           → "Wireman"
 *   "1/113 Blue 1m" (brand Orange)   → "Orange" (falls back to brand field)
 * Only the FIRST word is used, so product lines ("Fire Guard", "Super PVC")
 * stay in the product name, not the brand.
 */
export function detectBrand(name: string, brandField?: string | null): string | null {
  const words = (name || "").trim().split(/\s+/);
  const first = words[0] || "";
  const looksLikeWord = first && !/\d/.test(first) && /^[A-Za-z][A-Za-z&.'-]*$/.test(first);
  if (looksLikeWord && first.length >= 2 && !GENERIC.has(first.toLowerCase().replace(/[^a-z]/g, ""))) {
    return normaliseBrand(first);
  }
  return brandField?.trim() ? normaliseBrand(brandField.trim()) : null;
}

/** First words that describe the item, not the maker. */
const GENERIC = new Set([
  "wire", "wires", "cable", "cables", "cord", "speaker", "tv", "condenser", "condensers", "pvc", "led", "bulb", "bulbs",
  "tube", "flood", "light", "lights", "switch", "socket", "plug", "extension", "ceiling", "fan", "holder", "tape",
  "insulation", "electrical", "mcb", "rccb", "isolator", "db", "box", "conduit", "trunking", "junction", "bend",
  "saddle", "clip", "clips", "screw", "screws", "nail", "brush", "measuring", "padlock", "pliers", "cutter", "hammer",
  "multi", "single", "double", "twin", "main", "earth", "flexible", "auto", "submersible", "pipe", "tap", "valve",
]);

/** "acl" → "ACL", "orange" → "Orange", "SIERRA" → "Sierra" (short all-caps kept). */
export function normaliseBrand(b: string): string {
  return b
    .split(/\s+/)
    .map((w) => (w.length <= 3 ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()))
    .join(" ");
}
