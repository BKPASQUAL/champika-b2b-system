import { suggestSizeTags } from "./web-search";
import { detectBrand } from "./web-brand-detect";

export type Spec = { label: string; value: string };

const COLOURS = ["Green/Yellow", "Brown", "Red", "Black", "Blue", "Green", "Yellow", "Grey", "Gray", "White", "Orange", "Purple"];

/**
 * Specification rows that can be read straight from the product name and the
 * linked main item — only facts that are written there, nothing guessed.
 */
export function suggestSpecs(
  name: string,
  main?: { brand?: string | null; subCategory?: string | null; productFamily?: string | null } | null,
): Spec[] {
  const out: Spec[] = [];
  const add = (label: string, value: string | null | undefined) => {
    if (value && !out.some((s) => s.label === label)) out.push({ label, value });
  };

  add("Brand", main?.brand || detectBrand(name, null));
  add("Type", main?.productFamily || main?.subCategory);

  // Wire size: "1/1.13mm" + "1mm²".
  const sizes = suggestSizeTags(name);
  const strand = sizes.find((t) => t.includes("/") && /\d\.\d+mm$/.test(t));
  const area = sizes.find((t) => t.endsWith("mm²"));
  if (strand || area) add("Size", [strand, area && `(${area})`].filter(Boolean).join(" "));

  if (/\bcu\b|copper/i.test(name)) add("Conductor", "Copper");
  else if (/\bal\b|alumin/i.test(name)) add("Conductor", "Aluminium");

  const ins = name.match(/\b(?:cu|al)\/((?:pvc|xlpe)(?:\/(?:pvc|xlpe|swa))*)/i);
  if (ins) add("Insulation", ins[1].toUpperCase());
  else if (/\bpvc\b/i.test(name)) add("Insulation", "PVC");

  const cores = name.match(/\b(\d+)\s*(?:core|c)\b/i);
  if (cores) add("Cores", `${cores[1]} core`);
  else if (/\btwin\b/i.test(name)) add("Cores", "2 core (twin)");

  // Drop the brand word first so "Orange 13A Socket" is not colour Orange.
  const brand = out.find((s) => s.label === "Brand")?.value;
  const noBrand = brand ? name.replace(new RegExp(`\\b${brand.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi"), " ") : name;
  const colour = COLOURS.find((c) => new RegExp(`\\b${c.replace("/", "\\s*/\\s*")}\\b`, "i").test(noBrand));
  if (colour) add("Colour", colour === "Gray" ? "Grey" : colour);

  const len = name.match(/\b(\d+(?:\.\d+)?)\s*m(?:tr|eters?|etres?)?\b(?!m)(\s*coil)?/i);
  if (len) add("Length", `${len[1]}m${/coil/i.test(name) ? " coil" : ""}`);

  const amp = name.match(/\b(\d+(?:\.\d+)?)\s*a(?:mp)?s?\b/i);
  if (amp) add("Rating", `${amp[1]}A`);

  const watt = name.match(/\b(\d+(?:\.\d+)?)\s*w(?:att)?s?\b/i);
  if (watt) add("Wattage", `${watt[1]}W`);

  const volt = name.match(/\b(\d+(?:\/\d+)?)\s*v\b/i);
  if (volt) add("Voltage", `${volt[1]}V`);

  const gang = name.match(/\b(\d)\s*g(?:ang)?\b/i);
  if (gang) add("Gang", `${gang[1]} gang`);

  const pole = name.match(/\b(sp|dp|tp|tpn|[1-4]\s*p(?:ole)?)\b/i);
  if (pole) add("Poles", pole[1].toUpperCase().replace(/\s+/g, ""));

  return out;
}
