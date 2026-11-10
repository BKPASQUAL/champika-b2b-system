"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, BadgeCheck, Check, Download, ExternalLink, Eye, FileText, Info, Loader2, Lock, Share2, ShoppingBag, X, ZoomIn } from "lucide-react";
import { useShop } from "./ShopContext";
import { rs } from "./format";
import { QuoteFromCart } from "./QuoteFromCart";

type Cell = {
  id: string;
  slug?: string;
  name: string;
  maker: string;
  image?: string | null;
  price: number;
  mrp: number;
  available: boolean;
};
type Row = { cartId: string; label: string; image: string | null; qty: number; group: string; cartBrand: string; cells: Record<string, Cell> };
type BrandLogoItem = {
  id: string;
  name: string;
  slug?: string;
  parentId?: string | null;
  imageUrl?: string | null;
  logoUrl: string | null;
  description?: string | null;
};
type Table = { brands: string[]; rows: Row[]; brandLogos?: BrandLogoItem[] };

type BrandSum = {
  /** Option name, e.g. "Sierra" or "Akoya Black". */
  name: string;
  /** Main brand, e.g. "Orange". */
  maker: string;
  /** Sample product images from this option's items. */
  images: string[];
  /** These items: this option where it has the item, the cart's choice for the rest. */
  total: number;
  covered: number;
  /** The cart already uses this option wherever it can. */
  isCart: boolean;
};

type ColourSwatch = { label: string; bg: string; ring: string; text: string };
const COLOUR_MAP: Record<string, ColourSwatch> = {
  black: { label: "Black", bg: "#18181b", ring: "#3f3f46", text: "Matte / Gloss Black" },
  grey: { label: "Grey", bg: "#64748b", ring: "#475569", text: "Metallic / Slate Grey" },
  gray: { label: "Grey", bg: "#64748b", ring: "#475569", text: "Metallic / Slate Grey" },
  white: { label: "White", bg: "#ffffff", ring: "#cbd5e1", text: "Classic White" },
  silver: { label: "Silver", bg: "#cbd5e1", ring: "#94a3b8", text: "Brushed Silver" },
  gold: { label: "Gold", bg: "#f59e0b", ring: "#d97706", text: "Champagne / Gold" },
  champagne: { label: "Champagne", bg: "#fcd34d", ring: "#d97706", text: "Champagne Gold" },
  bronze: { label: "Bronze", bg: "#92400e", ring: "#78350f", text: "Antique Bronze" },
  ivory: { label: "Ivory", bg: "#fef3c7", ring: "#fcd34d", text: "Warm Ivory" },
  cream: { label: "Cream", bg: "#fef9c3", ring: "#fde047", text: "Soft Cream" },
  brown: { label: "Brown", bg: "#78350f", ring: "#451a03", text: "Brown" },
  blue: { label: "Blue", bg: "#2563eb", ring: "#1d4ed8", text: "Blue" },
  red: { label: "Red", bg: "#dc2626", ring: "#b91c1c", text: "Red" },
  green: { label: "Green", bg: "#16a34a", ring: "#15803d", text: "Green" },
  yellow: { label: "Yellow", bg: "#eab308", ring: "#ca8a04", text: "Yellow" },
};

/** Extracts sub-brand/range name and colour swatch from an option name like "Elegance Black" or "Akoya White". */
function parseOptionMeta(optionName: string, maker: string) {
  const words = optionName.trim().split(/\s+/);
  const lastWord = words[words.length - 1]?.toLowerCase() || "";
  const swatch = words.length > 1 ? COLOUR_MAP[lastWord] : undefined;
  const subBrand = swatch ? words.slice(0, -1).join(" ") : optionName;
  const isSubBrand = subBrand.toLowerCase() !== maker.trim().toLowerCase();
  return { subBrand, isSubBrand, swatch };
}

/** Resolves the main brand's logo/description and the sub-brand's own uploaded image/description from `web_brands`. */
function resolveBrandAndRangeInfo(optionName: string, maker: string, brandLogos: BrandLogoItem[]) {
  const meta = parseOptionMeta(optionName, maker);
  const makerLower = maker.trim().toLowerCase();
  const subLower = meta.subBrand.trim().toLowerCase();
  const optLower = optionName.trim().toLowerCase();

  const mainEntry =
    brandLogos.find((b) => !b.parentId && b.name.trim().toLowerCase() === makerLower) ||
    brandLogos.find((b) => b.name.trim().toLowerCase() === makerLower);

  const subEntry = meta.isSubBrand
    ? brandLogos.find(
        (b) =>
          b.id !== mainEntry?.id &&
          (b.name.trim().toLowerCase() === subLower || b.name.trim().toLowerCase() === optLower),
      )
    : undefined;

  return {
    ...meta,
    mainSlug: mainEntry?.slug || null,
    subSlug: subEntry?.slug || null,
    mainLogoUrl: mainEntry?.imageUrl || mainEntry?.logoUrl || null,
    rangeImageUrl: subEntry?.imageUrl || null,
    rangeDescription: subEntry?.description?.trim() || null,
    brandDescription: mainEntry?.description?.trim() || null,
    summaryDescription: subEntry?.description?.trim() || mainEntry?.description?.trim() || null,
  };
}
type Summary = { rows: Row[]; brands: BrandSum[]; bestTotal: number; cartTotal: number; winner: string | null };
type Section = { name: string; sum: Summary };
type View = { sections: Section[]; others: Row[]; othersTotal: number; cartTotal: number; bestTotal: number };

const BEST = "Best price mix";
/** Most options shown side by side in a table. */
const MAX_COLS = 4;
const available = (c?: Cell) => (c && c.available ? c : undefined);
const cartPrice = (r: Row) => available(r.cells[r.cartBrand])?.price ?? 0;
const bestOf = (r: Row) =>
  Object.entries(r.cells)
    .filter(([, c]) => c.available)
    .sort((a, b) => a[1].price - b[1].price)[0];
/** Anchor id for a section, so "Change" in the final list can jump to it. */
const sectionId = (name: string) => `sec-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
const itemsWord = (k: number) => `${k} ${k === 1 ? "item" : "items"}`;

function summarise(rows: Row[], order: string[], lockedOrder?: string[]): Summary {
  const names = order.filter((b) => rows.some((r) => r.cells[b]));
  const brands: BrandSum[] = names.map((b) => ({
    name: b,
    maker: rows.find((r) => r.cells[b])!.cells[b].maker || b,
    images: Array.from(new Set(rows.map((r) => r.cells[b]?.image).filter((x): x is string => Boolean(x)))).slice(0, 3),
    total: rows.reduce((s, r) => s + (available(r.cells[b])?.price ?? cartPrice(r)) * r.qty, 0),
    covered: rows.filter((r) => available(r.cells[b])).length,
    isCart: rows.every((r) => !available(r.cells[b]) || r.cartBrand === b),
  }));
  // Cheapest first (with alphabetical tie-break so equal-priced ranges like Elegance Black & Grey never swap).
  brands.sort((a, b) => a.total - b.total || b.covered - a.covered || a.name.localeCompare(b.name));
  const winner = brands.length > 1 ? brands[0].name : null;

  // Keep the initial card/column order locked while the customer switches between options in this section.
  if (lockedOrder && lockedOrder.length === brands.length && brands.every((b) => lockedOrder.includes(b.name))) {
    const pos = new Map(lockedOrder.map((nm, i) => [nm, i]));
    brands.sort((a, b) => (pos.get(a.name) ?? 0) - (pos.get(b.name) ?? 0));
  }

  return {
    rows,
    brands,
    bestTotal: rows.reduce((s, r) => s + (bestOf(r)?.[1].price ?? cartPrice(r)) * r.qty, 0),
    cartTotal: rows.reduce((s, r) => s + cartPrice(r) * r.qty, 0),
    winner,
  };
}

/** Options shown in a section's table by default: first MAX_COLS options in stable order. */
function defaultPick(sum: Summary) {
  return sum.brands.slice(0, MAX_COLS).map((b) => b.name);
}

/**
 * The customer's list priced in each brand / range / colour. Items are grouped
 * by type (wires, switches & sockets…) because each type is its own choice —
 * e.g. Sierra wire with Akoya Black switches.
 */
export function CompareBrands() {
  const { cart, ready, href, replaceMany, store, customer } = useShop();
  const [data, setData] = useState<Table | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);
  /** Section name → options picked for its table. */
  const [picks, setPicks] = useState<Record<string, string[]>>({});
  /** Section name → initial card order, so switching options never jumps or swaps cards. */
  const lockedOrderRef = useRef<Record<string, string[]>>({});
  const [pdfOpen, setPdfOpen] = useState(false);
  const [quoteBusy, setQuoteBusy] = useState<"download" | "share" | null>(null);
  const [detailTarget, setDetailTarget] = useState<{ secName: string; optionName: string } | null>(null);

  useEffect(() => {
    if (!ready) return;
    if (!cart.length) {
      setData({ brands: [], rows: [] });
      return;
    }
    const ctrl = new AbortController();
    fetch("/api/storefront/compare", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: cart }),
      signal: ctrl.signal,
    })
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Could not compare brands");
        setData(json);
        setError(null);
      })
      .catch((e) => e.name !== "AbortError" && setError(e.message));
    return () => ctrl.abort();
  }, [cart, ready]);

  const view = useMemo<View | null>(() => {
    if (!data) return null;
    const comp = data.rows.filter((r) => Object.keys(r.cells).length > 1);
    const others = data.rows.filter((r) => Object.keys(r.cells).length <= 1);
    const groups = [...new Set(comp.map((r) => r.group))];
    const sections = groups.map((g) => {
      const sum = summarise(comp.filter((r) => r.group === g), data.brands, lockedOrderRef.current[g]);
      lockedOrderRef.current[g] = sum.brands.map((b) => b.name);
      return { name: g, sum };
    });
    const othersTotal = others.reduce((s, r) => s + cartPrice(r) * r.qty, 0);
    return {
      sections,
      others,
      othersTotal,
      cartTotal: sections.reduce((s, x) => s + x.sum.cartTotal, 0) + othersTotal,
      bestTotal: sections.reduce((s, x) => s + x.sum.bestTotal, 0) + othersTotal,
    };
  }, [data]);

  const shownFor = (sec: Section) => (picks[sec.name] ?? defaultPick(sec.sum)).filter((nm) => sec.sum.brands.some((b) => b.name === nm));

  const togglePick = (sec: Section, nm: string) => {
    const shown = shownFor(sec);
    if (shown.includes(nm)) {
      if (shown.length > 1) setPicks((p) => ({ ...p, [sec.name]: shown.filter((x) => x !== nm) }));
    } else if (shown.length < MAX_COLS) setPicks((p) => ({ ...p, [sec.name]: [...shown, nm] }));
    else toast.info(`You can compare up to ${MAX_COLS} at a time`, { description: "Untick one first, then pick another." });
  };

  /** Switch a section's items to one option (or the cheapest for each item). */
  const switchTo = (sec: Section, option: string) => {
    const pairs: [string, string][] = [];
    const nextByOldId = new Map<string, { id: string; brand: string }>();
    for (const r of sec.sum.rows) {
      const best = option === BEST ? bestOf(r) : undefined;
      const targetBrand = option === BEST ? best?.[0] : option;
      const target = option === BEST ? best?.[1] : r.cells[option];
      if (target?.available && targetBrand && target.id !== r.cartId) {
        pairs.push([r.cartId, target.id]);
        nextByOldId.set(r.cartId, { id: target.id, brand: targetBrand });
      }
    }
    if (!pairs.length) return toast.info("Your cart already uses these items");
    setData((prev) =>
      prev
        ? {
            ...prev,
            rows: prev.rows.map((r) => {
              const hit = nextByOldId.get(r.cartId);
              return hit ? { ...r, cartId: hit.id, cartBrand: hit.brand } : r;
            }),
          }
        : prev,
    );
    replaceMany(pairs);
    toast.success(option === BEST ? `${sec.name}: switched to the best price for each item` : `${sec.name}: switched to ${option}`, {
      description: `${itemsWord(pairs.length)} changed`,
    });
  };

  /** Quotation PDF of the final list: download it, or share it (WhatsApp, email…) where the phone allows. */
  const quotePdf = async (mode: "download" | "share") => {
    if (!view) return;
    setQuoteBusy(mode);
    try {
      const q = await makeQuotationPdf(allRows(view), store, customer?.name || "", data?.brandLogos || []);
      if (!q.count) return toast.error("No items to put in the quotation");
      const file = new File([q.blob], q.fileName, { type: "application/pdf" });
      const text = `Quotation ${q.ref} from ${store.name || "BK Wiring"}: ${itemsWord(q.count)}, total ${rs(q.total)}. bkwiringbadukade.lk`;
      if (mode === "share" && typeof navigator !== "undefined" && navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: `Quotation ${q.ref}`, text });
        } catch (e: any) {
          if (e?.name !== "AbortError") throw e;
        }
        return;
      }
      // Download (and on computers, "Share" also opens WhatsApp with a short message to attach it to).
      const url = URL.createObjectURL(q.blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = q.fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      if (mode === "share") {
        window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener");
        toast.success("Quotation PDF saved", { description: "Attach the downloaded PDF in WhatsApp or email to share it." });
      } else toast.success("Quotation PDF saved");
    } catch {
      toast.error("Could not make the quotation. Please try again.");
    } finally {
      setQuoteBusy(null);
    }
  };

  const downloadPdf = async (choice: PdfChoice) => {
    if (!view) return;
    setPdfBusy(true);
    try {
      const rows = allRows(view).filter((r) => choice.groups.includes(r.group));
      await makePdf(rows, choice.makers, store, choice.name.trim(), data?.brandLogos || []);
      setPdfOpen(false);
    } catch {
      toast.error("Could not make the PDF. Please try again.");
    } finally {
      setPdfBusy(false);
    }
  };

  if (!ready || (!data && !error))
    return (
      <div className="flex justify-center py-24 text-(--s-muted)">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );

  if (data && !data.rows.length)
    return (
      <div className="mx-auto flex max-w-md flex-col items-center px-4 py-20 text-center">
        <ShoppingBag className="h-14 w-14 text-neutral-300" />
        <h1 className="mt-4 text-xl font-bold">Nothing to compare yet</h1>
        <p className="mt-1 text-(--s-muted)">Add items to your cart, then compare their prices in each brand here.</p>
        <Link href={href("/products")} className="mt-6 rounded-full bg-(--s-btn) px-6 py-3 font-semibold text-(--s-btn-ink) hover:opacity-85">
          Start shopping
        </Link>
      </div>
    );

  const n = data?.rows.length || 0;

  return (
    <div className="mx-auto px-4 py-8 md:px-6 xl:px-10">
      {/* Title row */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href={href("/cart")} className="inline-flex items-center gap-1.5 text-sm font-semibold text-(--s-ink-2) hover:text-(--s-ink)">
            <ArrowLeft className="h-4 w-4" /> Back to cart
          </Link>
          <h1 className="mt-2 text-2xl font-bold md:text-[30px]">Compare brands</h1>
          <p className="mt-1 max-w-2xl text-sm text-(--s-ink-2)">
            Your list of {itemsWord(n)}, priced in each brand, range and colour. Each type of item is a separate choice — for example one brand for wires
            and another range for switches.
          </p>
        </div>
        <button
          onClick={() => setPdfOpen(true)}
          disabled={pdfBusy || !n}
          className="inline-flex items-center gap-2 rounded-full bg-(--s-accent) px-6 py-3 text-sm font-bold text-(--s-accent-ink) shadow-[0_6px_18px_-6px_rgba(37,99,235,0.6)] transition hover:bg-(--s-accent-hover) disabled:opacity-50"
        >
          {pdfBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Download PDF
        </button>
      </div>

      {error && <div className="mt-4 rounded-lg border border-(--s-bad) px-4 py-3 text-sm text-(--s-bad)">{error}</div>}

      {view && !view.sections.length && (
        <div className="mt-5 rounded-xl border border-(--s-line) bg-(--s-soft) px-4 py-3 text-sm text-(--s-ink-2)">
          We could not find these items in other brands yet. You can still download your list as a PDF.
        </div>
      )}

      {/* One section per type of item */}
      {view?.sections.map((sec, i) => (
        <SectionBlock
          key={sec.name}
          index={view.sections.length > 1 ? i + 1 : null}
          sec={sec}
          shown={shownFor(sec)}
          brandLogos={data?.brandLogos || []}
          onToggle={(nm) => togglePick(sec, nm)}
          onSwitch={(opt) => switchTo(sec, opt)}
          onViewDetails={(optName) => setDetailTarget({ secName: sec.name, optionName: optName })}
        />
      ))}

      {/* Final list: everything as it is in the cart now */}
      {view && n > 0 && (
        <section id="final-list" className="mt-12 scroll-mt-28">
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-(--s-line) pb-3">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-600 text-white">
                <Check className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-xl font-bold md:text-2xl">Your final list</h2>
                <p className="text-sm text-(--s-muted)">The items in your cart now, with the brand and range you picked.</p>
              </div>
            </div>
          </div>

          <div className="mt-4 overflow-x-auto rounded-2xl border border-(--s-line) bg-(--s-surface) shadow-[0_8px_30px_-18px_rgba(15,23,42,0.25)]">
            <table className="w-full min-w-[640px] border-collapse text-sm [&_td:not(:first-child)]:whitespace-nowrap">
              <thead>
                <tr className="bg-(--s-bar) text-white">
                  <th className="px-5 py-3 text-left font-semibold">Item</th>
                  <th className="px-4 py-3 text-left font-semibold">Brand / range</th>
                  <th className="w-16 px-3 py-3 text-center font-semibold">Qty</th>
                  <th className="px-4 py-3 text-right font-semibold">Price each</th>
                  <th className="px-5 py-3 text-right font-semibold">Total</th>
                </tr>
              </thead>
              <tbody>
                {allRows(view).map((r, i, list) => {
                  const c = r.cells[r.cartBrand];
                  const ok = c?.available;
                  const hasChoice = Object.keys(r.cells).length > 1;
                  return (
                    <Fragment key={r.cartId}>
                      {r.group !== list[i - 1]?.group && (
                        <tr className="border-b border-(--s-line) bg-(--s-soft)">
                          <td colSpan={5} className="px-5 py-2 text-[12.5px] font-bold uppercase tracking-wide text-(--s-muted)">
                            {r.group}
                          </td>
                        </tr>
                      )}
                      <tr className="border-b border-(--s-line)">
                        <ItemCell r={r} />
                        <td className="px-4 py-3">
                          {c?.maker && c.maker !== r.cartBrand && (
                            <div className="text-[12px] font-bold uppercase tracking-wider text-(--s-muted)">{c.maker}</div>
                          )}
                          <div className="font-semibold">{r.cartBrand}</div>
                          {hasChoice ? (
                            <a href={`#${sectionId(r.group)}`} className="text-[12.5px] font-semibold text-(--s-accent) hover:underline">
                              Change
                            </a>
                          ) : (
                            <div className="text-[12.5px] text-(--s-muted)">Only brand</div>
                          )}
                        </td>
                        <td className="px-3 py-3 text-center font-semibold">{r.qty}</td>
                        <td className="px-4 py-3 text-right text-(--s-ink-2)">{ok ? rs(c.price) : "—"}</td>
                        <td className="px-5 py-3 text-right font-bold">{ok ? rs(c.price * r.qty) : <span className="text-xs font-normal text-(--s-muted)">Out of stock</span>}</td>
                      </tr>
                    </Fragment>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-(--s-soft)">
                  <td colSpan={4} className="px-5 py-4">
                    <div className="text-base font-extrabold">Total</div>
                    <div className="text-[12.5px] text-(--s-muted)">{itemsWord(n)} · delivery not included</div>
                  </td>
                  <td className="px-5 py-4 text-right text-xl font-extrabold">{rs(view.cartTotal)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Next steps */}
          {/* Phones: text, then the buttons one under another. Tablets: 3 buttons in a row. Laptops: all on one line. */}
          <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-(--s-line) bg-(--s-surface) p-4 lg:flex-row lg:items-center">
            <div className="min-w-0 flex-1">
              <div className="font-bold">Happy with this list?</div>
              <div className="text-sm text-(--s-muted)">Order now, ask us for a quotation, or save and share this list as a quotation PDF.</div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:flex lg:items-center">
              <Link
                href={href("/checkout")}
                className="inline-flex h-11 items-center justify-center gap-2 whitespace-nowrap rounded-full bg-(--s-accent) px-6 text-sm font-bold text-(--s-accent-ink) transition hover:bg-(--s-accent-hover)"
              >
                <Lock className="h-4 w-4 shrink-0" /> Checkout · {rs(view.cartTotal)}
              </Link>
              <div className="lg:w-auto">
                <QuoteFromCart compact disabled={!view.cartTotal} />
              </div>
              <button
                onClick={() => quotePdf("download")}
                disabled={quoteBusy !== null}
                className="inline-flex h-11 items-center justify-center gap-2 whitespace-nowrap rounded-full border border-(--s-line) px-5 text-sm font-semibold text-(--s-ink) transition hover:bg-(--s-soft) disabled:opacity-60"
              >
                {quoteBusy === "download" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />} Quotation PDF
              </button>
              <button
                onClick={() => quotePdf("share")}
                disabled={quoteBusy !== null}
                className="inline-flex h-11 items-center justify-center gap-2 whitespace-nowrap rounded-full border border-(--s-line) px-5 text-sm font-semibold text-(--s-ink) transition hover:bg-(--s-soft) disabled:opacity-60"
              >
                {quoteBusy === "share" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />} Share
              </button>
            </div>
          </div>
        </section>
      )}

      <div className="mt-6 flex flex-wrap gap-x-5 gap-y-1 text-xs text-(--s-muted)">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-sm bg-emerald-500/25 ring-1 ring-emerald-500/40" /> Lowest price for that item
        </span>
        <span>Where an option does not have an item, its total uses the item in your cart.</span>
        <span>Prices include taxes. Delivery not included. Prices are for today.</span>
      </div>

      {pdfOpen && view && (
        <PdfDialog view={view} busy={pdfBusy} onClose={() => setPdfOpen(false)} onDownload={downloadPdf} />
      )}

      {detailTarget && view && (() => {
        const sec = view.sections.find((s) => s.name === detailTarget.secName);
        const opt = sec?.sum.brands.find((b) => b.name === detailTarget.optionName);
        if (!sec || !opt) return null;
        return (
          <OptionDetailModal
            sec={sec}
            option={opt}
            brandLogos={data?.brandLogos || []}
            href={href}
            onClose={() => setDetailTarget(null)}
            onSwitch={(optName) => switchTo(sec, optName)}
          />
        );
      })()}
    </div>
  );
}

/** One type of item (e.g. Switches & Sockets): option cards + price table. */
function SectionBlock({
  index,
  sec,
  shown,
  brandLogos,
  onToggle,
  onSwitch,
  onViewDetails,
}: {
  index: number | null;
  sec: Section;
  shown: string[];
  brandLogos: BrandLogoItem[];
  onToggle: (option: string) => void;
  onSwitch: (option: string) => void;
  onViewDetails: (option: string) => void;
}) {
  const { sum } = sec;
  const m = sum.rows.length;
  const tableBrands = sum.brands.filter((b) => shown.includes(b.name));

  return (
    <section id={sectionId(sec.name)} className="mt-10 scroll-mt-28">
      {/* Section title */}
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-(--s-line) pb-3">
        <div className="flex items-center gap-3">
          {index && (
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-(--s-bar) text-sm font-bold text-white">{index}</span>
          )}
          <div>
            <h2 className="text-xl font-bold md:text-2xl">{sec.name}</h2>
            <p className="text-sm text-(--s-muted)">
              {itemsWord(m)} · {sum.brands.length} options to choose from
            </p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs text-(--s-muted)">In your cart now</div>
          <div className="text-lg font-bold">{rs(sum.cartTotal)}</div>
        </div>
      </div>

      {/* Option cards: brand, sub-brand/range, colour swatch, item thumbnails & View Details */}
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {sum.brands.map((b) => {
          const info = resolveBrandAndRangeInfo(b.name, b.maker, brandLogos);
          return (
            <div
              key={b.name}
              className={`group/card flex flex-col justify-between rounded-xl border p-3 transition ${
                b.isCart
                  ? "border-(--s-accent) bg-(--s-accent-soft) shadow-[0_8px_22px_-10px_rgba(37,99,235,0.55)] ring-1 ring-(--s-accent)"
                  : "border-(--s-line) bg-(--s-surface) hover:border-blue-500/40 hover:shadow-md"
              }`}
            >
              <div>
                <OptionName b={b} m={m} brandLogos={brandLogos} onViewDetails={() => onViewDetails(b.name)} />

                {/* Range & colour pills, with the Details button on the right */}
                <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[12.5px]">
                  {info.isSubBrand && (
                    <span className="rounded bg-(--s-soft) px-1.5 py-0.5 font-semibold text-(--s-ink-2)">
                      Range: <strong className="text-(--s-ink)">{info.subBrand}</strong>
                    </span>
                  )}
                  {info.swatch && (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-(--s-line) bg-(--s-surface) px-2 py-0.5 font-semibold text-(--s-ink)">
                      <span
                        className="h-2.5 w-2.5 rounded-full shadow-xs"
                        style={{ backgroundColor: info.swatch.bg, boxShadow: `0 0 0 1px ${info.swatch.ring}` }}
                      />
                      {info.swatch.label}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => onViewDetails(b.name)}
                    title={`View ${b.name} items and prices`}
                    className="ml-auto inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[12px] font-bold text-slate-700 transition hover:bg-blue-600 hover:text-white"
                  >
                    <Eye className="h-3 w-3" /> Details
                  </button>
                </div>

                {/* Brand / Sub-brand description snippet from Admin panel */}
                {info.summaryDescription && (
                  <p className="mt-1.5 line-clamp-2 text-[12.5px] leading-snug text-(--s-muted)">
                    {info.summaryDescription}
                  </p>
                )}
              </div>

              <div className="mt-3 pt-2 border-t border-(--s-line)/60">
                <div className="flex flex-wrap items-center justify-between gap-x-1.5 gap-y-1">
                  <span className="text-[16px] font-extrabold leading-none">{rs(b.total)}</span>
                  {!b.isCart && <DiffChip diff={b.total - sum.cartTotal} />}
                </div>
                {b.isCart ? (
                  <span className="mt-2.5 inline-flex h-8 w-full items-center justify-center gap-1 rounded-lg bg-(--s-accent) text-[12.5px] font-bold text-(--s-accent-ink)">
                    <Check className="h-3.5 w-3.5" /> Selected · in your cart
                  </span>
                ) : (
                  <button
                    onClick={() => onSwitch(b.name)}
                    title={`Switch to ${b.name}`}
                    className="mt-2.5 h-8 w-full truncate rounded-lg bg-(--s-btn) px-2.5 text-[12.5px] font-semibold text-(--s-btn-ink) transition hover:bg-(--s-accent) hover:text-(--s-accent-ink)"
                  >
                    Switch to {b.name}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Option picker for the table */}
      {sum.brands.length > 2 && (
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <span className="mr-1 text-xs font-semibold text-(--s-ink-2)">
            Show in table{sum.brands.length > MAX_COLS ? ` (up to ${MAX_COLS})` : ""}:
          </span>
          {sum.brands.map((b) => {
            const on = shown.includes(b.name);
            return (
              <button
                key={b.name}
                onClick={() => onToggle(b.name)}
                aria-pressed={on}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ring-1 transition ${
                  on ? "bg-(--s-btn) text-(--s-btn-ink) ring-(--s-btn)" : "bg-(--s-surface) text-(--s-ink-2) ring-(--s-line) hover:ring-(--s-ink-2)"
                }`}
              >
                {on && <Check className="h-3.5 w-3.5" />}
                {b.name}
                <span className={on ? "opacity-70" : "text-(--s-muted)"}>{rs(b.total)}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Price table */}
      <div className="mt-3 overflow-x-auto rounded-2xl border border-(--s-line) bg-(--s-surface) shadow-[0_8px_30px_-18px_rgba(15,23,42,0.25)]">
        <table className="w-full min-w-[640px] border-collapse text-sm [&_td:not(:first-child)]:whitespace-nowrap [&_th:not(:first-child)]:whitespace-nowrap">
          <thead>
            <tr className="bg-(--s-bar) text-white">
              <th className="sticky left-0 z-10 bg-(--s-bar) px-5 py-3.5 text-left font-semibold">Item</th>
              <th className="w-16 px-3 py-3.5 text-center font-semibold">Qty</th>
              {tableBrands.map((b) => {
                const meta = parseOptionMeta(b.name, b.maker);
                return (
                  <th key={b.name} className="w-[190px] px-5 py-3.5 text-right">
                    {b.maker !== b.name && <div className="text-[12px] font-semibold uppercase tracking-wider text-slate-400">{b.maker}</div>}
                    <div className="flex items-center justify-end gap-1.5 text-[15px] font-bold">
                      {meta.swatch && (
                        <span
                          className="inline-block h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: meta.swatch.bg, boxShadow: `0 0 0 1px ${meta.swatch.ring}` }}
                        />
                      )}
                      {b.name}
                    </div>
                    <div className="mt-0.5 flex items-center justify-end gap-2 text-[12.5px] font-medium text-slate-400">
                      <span>{b.covered} of {itemsWord(m)}</span>
                      <button
                        type="button"
                        onClick={() => onViewDetails(b.name)}
                        className="inline-flex items-center gap-1 text-sky-300 underline-offset-2 hover:text-white hover:underline"
                      >
                        <Eye className="h-3 w-3" /> View
                      </button>
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {sum.rows.map((r) => {
              const best = bestOf(r)?.[0];
              return (
                <tr key={r.cartId} className="border-b border-(--s-line)">
                  <ItemCell r={r} />
                  <td className="px-3 py-3 text-center font-semibold">{r.qty}</td>
                  {tableBrands.map((b) => {
                    const cell = r.cells[b.name];
                    if (!cell || !cell.available)
                      return (
                        <td key={b.name} className="px-5 py-3 text-right text-xs text-(--s-muted)">
                          {cell ? "Out of stock" : "Not available"}
                        </td>
                      );
                    const cheapest = best === b.name;
                    return (
                      <td key={b.name} className={`px-5 py-3 text-right ${cheapest ? "bg-emerald-500/10" : ""}`}>
                        <div className="flex items-center justify-end gap-1.5 text-[15px] font-bold">
                          {cheapest && <Check className="h-4 w-4 text-emerald-600" />}
                          {rs(cell.price * r.qty)}
                        </div>
                        <div className="mt-0.5 flex items-center justify-end gap-1.5 text-[12.5px] text-(--s-muted)">
                          {r.qty > 1 && <span>{rs(cell.price)} each</span>}
                          {r.cartBrand === b.name && <span className="rounded bg-(--s-accent-soft) px-1.5 py-px font-semibold text-(--s-accent)">in cart</span>}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-(--s-soft)">
              <td className="sticky left-0 z-10 bg-(--s-soft) px-5 py-4">
                <div className="text-base font-extrabold">Total</div>
                <div className="text-[12.5px] text-(--s-muted)">{m === 1 ? "This item" : `These ${itemsWord(m)}`}</div>
              </td>
              <td />
              {tableBrands.map((b) => (
                <td key={b.name} className="px-5 py-4 text-right">
                  <div className="text-lg font-extrabold">{rs(b.total)}</div>
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}

/** Brand badge + option name + coverage status. */
function OptionName({
  b,
  m,
  brandLogos,
  onViewDetails,
}: {
  b: BrandSum;
  m: number;
  brandLogos: BrandLogoItem[];
  onViewDetails: () => void;
}) {
  const logoItem = brandLogos.find((x) => x.name.trim().toLowerCase() === b.maker.trim().toLowerCase() && x.logoUrl);
  const [brandOpen, setBrandOpen] = useState(false);
  return (
    <div className="min-w-0">
      <div className="flex items-center justify-between gap-1.5">
        <button
          type="button"
          onClick={() => setBrandOpen(true)}
          title={`About ${b.maker}`}
          className="inline-flex min-w-0 items-center gap-1.5 rounded-md py-0.5 pr-1 text-[12px] font-extrabold uppercase tracking-wider text-(--s-accent) hover:bg-blue-500/10"
        >
          {logoItem?.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoItem.logoUrl} alt={b.maker} className="h-3.5 w-auto max-w-[44px] rounded-xs bg-white object-contain px-0.5" />
          )}
          <span className="truncate">{b.maker}</span>
          <Info className="h-3 w-3 shrink-0" />
        </button>
        {brandOpen &&
          createPortal(
            <BrandInfoPopup b={b} brandLogos={brandLogos} onClose={() => setBrandOpen(false)} />,
            // Inside the shop root so the shop colours apply.
            document.querySelector(".shop-root") ?? document.body,
          )}
        <span className="shrink-0 text-[12px] font-medium text-(--s-muted)">
          {b.covered === m ? (m === 1 ? "1/1 item" : `All ${m} items`) : `${b.covered}/${m} items`}
        </span>
      </div>
      <button
        type="button"
        onClick={onViewDetails}
        className="mt-0.5 block w-full truncate text-left text-[15px] font-extrabold leading-tight text-(--s-ink) hover:text-(--s-accent)"
        title={`View ${b.name} details`}
      >
        {b.name}
      </button>
    </div>
  );
}

/** Small popup with only the brand: logo, name, range / colour, about text and a link to its products. */
function BrandInfoPopup({ b, brandLogos, onClose }: { b: BrandSum; brandLogos: BrandLogoItem[]; onClose: () => void }) {
  const { href } = useShop();
  const info = resolveBrandAndRangeInfo(b.name, b.maker, brandLogos);
  const about = info.rangeDescription || info.brandDescription;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs" onClick={onClose}>
      <div
        className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-(--s-line) bg-(--s-surface) shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 rounded-full p-1.5 text-(--s-muted) transition hover:bg-(--s-line) hover:text-(--s-ink)"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="flex flex-col items-center px-6 pt-7 pb-5 text-center">
          <div className="flex h-24 w-44 items-center justify-center overflow-hidden rounded-2xl border border-(--s-line) bg-white p-1.5 shadow-xs">
            {info.mainLogoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={info.mainLogoUrl} alt={`${b.maker} logo`} className="h-full w-full object-contain" />
            ) : (
              <span className="text-2xl font-black tracking-tight text-slate-800">{b.maker}</span>
            )}
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-lg font-extrabold text-(--s-ink)">
            {b.maker}
            <BadgeCheck className="h-5 w-5 text-(--s-accent)" aria-label="Genuine brand" />
          </div>
          <div className="mt-1 flex flex-wrap justify-center gap-1.5">
            {info.isSubBrand && (
              <span className="rounded-full bg-(--s-soft) px-2.5 py-0.5 text-[12.5px] font-bold text-(--s-ink-2) ring-1 ring-(--s-line)">
                {info.subBrand} range
              </span>
            )}
            {info.swatch && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-(--s-soft) px-2.5 py-0.5 text-[12.5px] font-bold text-(--s-ink-2) ring-1 ring-(--s-line)">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: info.swatch.bg, boxShadow: `0 0 0 1px ${info.swatch.ring}` }} />
                {info.swatch.label}
              </span>
            )}
          </div>
          <p className="mt-3 text-sm leading-relaxed text-(--s-ink-2)">
            {about || `Genuine ${b.maker} ${info.isSubBrand ? `${info.subBrand} range ` : ""}products.`}
          </p>
        </div>
        {(info.mainSlug || info.subSlug) && (
          <div className="flex flex-col gap-2 border-t border-(--s-line) bg-(--s-soft) px-5 py-3.5">
            {info.isSubBrand && info.subSlug && (
              <Link
                href={href(`/b/${info.subSlug}`)}
                className="inline-flex h-9 items-center justify-center gap-1 rounded-full bg-(--s-accent) text-xs font-bold text-white transition hover:brightness-110"
              >
                See all {info.subBrand} items <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            )}
            {info.mainSlug && (
              <Link
                href={href(`/b/${info.mainSlug}`)}
                className={`inline-flex h-9 items-center justify-center gap-1 rounded-full text-xs font-bold transition ${
                  info.isSubBrand && info.subSlug
                    ? "border border-(--s-line) bg-(--s-surface) text-(--s-ink-2) hover:border-(--s-accent) hover:text-(--s-accent)"
                    : "bg-(--s-accent) text-white hover:brightness-110"
                }`}
              >
                See all {b.maker} products <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Modal dialog showing full details of a Brand / Sub-brand (Range) & Colour option:
 * - Main brand logo & name, sub-brand/range name, and colour swatch
 * - Every item in this section with large product image (click-to-zoom), MRP, discount, unit price & line total
 * - Direct button to switch the section to this option
 */
function OptionDetailModal({
  sec,
  option,
  brandLogos,
  href,
  onClose,
  onSwitch,
}: {
  sec: Section;
  option: BrandSum;
  brandLogos: BrandLogoItem[];
  href: (p: string) => string;
  onClose: () => void;
  onSwitch: (optName: string) => void;
}) {
  const [zoomImg, setZoomImg] = useState<{ url: string; title: string } | null>(null);
  const info = resolveBrandAndRangeInfo(option.name, option.maker, brandLogos);
  const m = sec.sum.rows.length;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (zoomImg) setZoomImg(null);
        else onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, zoomImg]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-(--s-line) bg-(--s-surface) shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-start justify-between gap-4 border-b border-(--s-line) bg-(--s-soft) px-5 py-4 sm:px-6">
          <div className="flex items-center gap-3.5">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-md bg-blue-600/10 px-2 py-0.5 text-[12.5px] font-extrabold uppercase tracking-wider text-(--s-accent)">
                  Brand: {option.maker}
                </span>
                {info.isSubBrand && (
                  <span className="rounded-md bg-(--s-surface) px-2 py-0.5 text-[12.5px] font-bold text-(--s-ink-2) ring-1 ring-(--s-line)">
                    Sub-brand / Range: <strong className="text-(--s-ink)">{info.subBrand}</strong>
                  </span>
                )}
                {info.swatch && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-(--s-surface) px-2.5 py-0.5 text-[12.5px] font-bold text-(--s-ink) ring-1 ring-(--s-line)">
                    <span
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: info.swatch.bg, boxShadow: `0 0 0 1px ${info.swatch.ring}` }}
                    />
                    Colour: {info.swatch.label}
                  </span>
                )}
              </div>
              <h3 className="mt-1 text-lg font-extrabold text-(--s-ink) sm:text-xl">
                {option.name} <span className="text-sm font-medium text-(--s-muted)">— {sec.name}</span>
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-(--s-muted) transition hover:bg-(--s-line) hover:text-(--s-ink)"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Selected Brand / Sub-brand Image & Description Showcase */}
        {/* Brand details: big logo, range / colour, about text and links to the brand's products */}
        <div className="shrink-0 border-b border-(--s-line) bg-blue-500/[0.04] px-5 py-4 sm:px-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            <div className="flex shrink-0 gap-2.5">
              <button
                type="button"
                disabled={!info.mainLogoUrl}
                onClick={() => info.mainLogoUrl && setZoomImg({ url: info.mainLogoUrl, title: option.maker })}
                title={info.mainLogoUrl ? "Enlarge logo" : undefined}
                className="group relative flex h-28 w-40 items-center justify-center overflow-hidden rounded-2xl border border-(--s-line) bg-white p-1.5 shadow-xs transition enabled:hover:border-(--s-accent) sm:w-44"
              >
                {info.mainLogoUrl ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={info.mainLogoUrl} alt={`${option.maker} logo`} className="h-full w-full object-contain" />
                    <span className="absolute right-1.5 bottom-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-slate-900/75 text-white opacity-0 transition group-hover:opacity-100">
                      <ZoomIn className="h-3.5 w-3.5" />
                    </span>
                  </>
                ) : (
                  <span className="text-3xl font-black tracking-tight text-slate-800">{option.maker}</span>
                )}
              </button>
              {info.rangeImageUrl && info.rangeImageUrl !== info.mainLogoUrl && (
                <button
                  type="button"
                  onClick={() => setZoomImg({ url: info.rangeImageUrl!, title: `${option.maker} — ${info.subBrand}` })}
                  title="Enlarge"
                  className="group relative flex h-28 w-28 items-center justify-center overflow-hidden rounded-2xl border border-(--s-line) bg-white p-2 shadow-xs transition hover:border-(--s-accent)"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={info.rangeImageUrl} alt={info.subBrand} className="h-full w-full object-contain" />
                </button>
              )}
            </div>
            <div className="min-w-0 flex-1 space-y-2">
              <div>
                <div className="flex items-center gap-1.5 text-lg font-extrabold text-(--s-ink)">
                  {option.maker}
                  <BadgeCheck className="h-5 w-5 text-(--s-accent)" aria-label="Genuine brand" />
                </div>
                <div className="text-xs text-(--s-muted)">
                  {info.isSubBrand ? `${info.subBrand} range` : "Genuine brand"}
                  {info.swatch ? ` · ${info.swatch.label} colour` : ""} · {sec.name}
                </div>
              </div>
              {!info.rangeDescription && !info.brandDescription && (
                <p className="text-sm leading-relaxed text-(--s-ink-2)">
                  Genuine {option.maker} {info.isSubBrand ? `${info.subBrand} range ` : ""}products. See the items below for prices, or open the brand page to see everything we sell from {option.maker}.
                </p>
              )}
                {info.rangeDescription && (
                  <div>
                    <div className="text-[12.5px] font-extrabold uppercase tracking-wider text-(--s-accent)">
                      About {info.subBrand} Range
                    </div>
                    <p className="mt-0.5 text-sm leading-relaxed text-(--s-ink)">
                      {info.rangeDescription}
                    </p>
                  </div>
                )}
                {info.brandDescription && info.brandDescription !== info.rangeDescription && (
                  <div>
                    <div className="text-[12.5px] font-bold uppercase tracking-wider text-(--s-muted)">
                      About {option.maker}
                    </div>
                    <p className="mt-0.5 text-xs leading-relaxed text-(--s-ink-2)">
                      {info.brandDescription}
                    </p>
                  </div>
                )}
              {(info.mainSlug || info.subSlug) && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {info.isSubBrand && info.subSlug && (
                    <Link
                      href={href(`/b/${info.subSlug}`)}
                      className="inline-flex h-8 items-center gap-1 rounded-full bg-(--s-accent) px-3.5 text-xs font-bold text-white transition hover:brightness-110"
                    >
                      See all {info.subBrand} items <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  )}
                  {info.mainSlug && (
                    <Link
                      href={href(`/b/${info.mainSlug}`)}
                      className={`inline-flex h-8 items-center gap-1 rounded-full px-3.5 text-xs font-bold transition ${
                        info.isSubBrand && info.subSlug
                          ? "border border-(--s-line) bg-(--s-surface) text-(--s-ink-2) hover:border-(--s-accent) hover:text-(--s-accent)"
                          : "bg-(--s-accent) text-white hover:brightness-110"
                      }`}
                    >
                      See all {option.maker} products <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Items list in this range */}
        <div className="flex-1 overflow-y-auto divide-y divide-(--s-line) px-5 py-3 sm:px-6">
          {sec.sum.rows.map((r) => {
            const cell = r.cells[option.name];
            const ok = cell?.available;
            const imgUrl = cell?.image || r.image;
            const mrpVal = cell ? Math.max(cell.mrp || 0, cell.price) : 0;
            const discPct = cell && mrpVal > cell.price ? Math.round(((mrpVal - cell.price) / mrpVal) * 100) : 0;

            return (
              <div key={r.cartId} className="flex flex-col gap-3 py-3.5 sm:flex-row sm:items-center">
                {/* Product image (click to zoom) */}
                <button
                  type="button"
                  disabled={!imgUrl}
                  onClick={() => imgUrl && setZoomImg({ url: imgUrl, title: cell?.name || r.label })}
                  className="group relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-(--s-line) bg-white p-1.5 shadow-xs transition hover:border-(--s-accent)"
                >
                  {imgUrl ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={imgUrl} alt={cell?.name || r.label} className="h-full w-full object-contain" />
                      <span className="absolute right-1 bottom-1 flex h-5 w-5 items-center justify-center rounded-full bg-slate-900/75 text-white opacity-0 transition group-hover:opacity-100">
                        <ZoomIn className="h-3 w-3" />
                      </span>
                    </>
                  ) : (
                    <ShoppingBag className="h-6 w-6 text-slate-300" />
                  )}
                </button>

                {/* Item details */}
                <div className="min-w-0 flex-1">
                  <div className="text-[12.5px] font-semibold uppercase tracking-wide text-(--s-muted)">
                    Requirement: {r.label} × {r.qty}
                  </div>
                  {cell ? (
                    <>
                      <div className="mt-0.5 font-bold text-(--s-ink)">{cell.name}</div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                        {discPct > 0 && (
                          <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[12.5px] font-bold text-emerald-700 dark:text-emerald-300">
                            -{discPct}% OFF
                          </span>
                        )}
                        {mrpVal > cell.price && (
                          <span className="text-(--s-muted) line-through">MRP {rs(mrpVal)}</span>
                        )}
                        <span className="font-semibold text-(--s-ink-2)">{rs(cell.price)} each</span>
                        {cell.slug && (
                          <Link
                            href={href(`/p/${cell.slug}`)}
                            className="inline-flex items-center gap-1 font-semibold text-(--s-accent) hover:underline"
                          >
                            Product page <ExternalLink className="h-3 w-3" />
                          </Link>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="mt-0.5 text-sm font-semibold text-amber-600">
                      This range does not have this item (keeps your cart choice: {r.cartBrand})
                    </div>
                  )}
                </div>

                {/* Line Total */}
                <div className="text-right sm:shrink-0">
                  {ok ? (
                    <>
                      <div className="text-base font-extrabold text-(--s-ink)">{rs(cell.price * r.qty)}</div>
                      <div className="text-xs text-(--s-muted)">Qty: {r.qty}</div>
                    </>
                  ) : (
                    <span className="rounded-full bg-amber-500/15 px-2.5 py-1 text-xs font-bold text-amber-700">
                      {cell ? "Out of stock" : "Not in range"}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Modal Footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-(--s-line) bg-(--s-soft) px-5 py-4 sm:px-6">
          <div>
            <div className="text-xs text-(--s-muted)">
              Total for {itemsWord(m)} ({option.covered} of {m} in {option.name})
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-extrabold text-(--s-ink)">{rs(option.total)}</span>
              {!option.isCart && <DiffChip diff={option.total - sec.sum.cartTotal} />}
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="h-10 rounded-full border border-(--s-line) bg-(--s-surface) px-4 text-xs font-bold text-(--s-ink-2) transition hover:bg-(--s-line)"
            >
              Close
            </button>
            {option.isCart ? (
              <span className="inline-flex h-10 items-center gap-1.5 rounded-full bg-(--s-accent) px-5 text-xs font-bold text-white">
                <Check className="h-4 w-4" /> Selected in your cart
              </span>
            ) : (
              <button
                type="button"
                onClick={() => {
                  onSwitch(option.name);
                  onClose();
                }}
                className="inline-flex h-10 items-center gap-1.5 rounded-full bg-(--s-accent) px-5 text-xs font-bold text-white shadow-md transition hover:bg-(--s-accent-hover)"
              >
                Switch to {option.name}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Fullscreen Image Lightbox when clicking an item photo inside the modal */}
      {zoomImg && (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center bg-black/85 p-4"
          onClick={() => setZoomImg(null)}
        >
          <div
            className="relative max-h-[88vh] max-w-xl overflow-hidden rounded-2xl bg-white p-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setZoomImg(null)}
              className="absolute top-3 right-3 rounded-full bg-slate-900/80 p-1.5 text-white hover:bg-slate-900"
            >
              <X className="h-5 w-5" />
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={zoomImg.url} alt={zoomImg.title} className="mx-auto max-h-[72vh] w-auto object-contain" />
            <div className="mt-3 text-center text-sm font-bold text-slate-900">{zoomImg.title}</div>
          </div>
        </div>
      )}
    </div>
  );
}


/** "Save Rs 36" / "+Rs 36" / "Same as cart" compared with the cart. */
function DiffChip({ diff }: { diff: number }) {
  if (Math.round(diff) === 0)
    return <span className="rounded-full bg-(--s-soft) px-2 py-0.5 text-[12px] font-semibold text-(--s-muted)">Same as cart</span>;
  return diff < 0 ? (
    <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[12px] font-bold text-emerald-700 dark:text-emerald-300">Save {rs(-diff)}</span>
  ) : (
    <span className="rounded-full bg-(--s-soft) px-2 py-0.5 text-[12px] font-semibold text-(--s-ink-2)">+{rs(diff)}</span>
  );
}

/** First column: small picture + item name (+ the only brand, for one-brand items). */
function ItemCell({ r, brand }: { r: Row; brand?: string }) {
  return (
    <td className="sticky left-0 z-10 min-w-[150px] bg-(--s-surface) px-3 py-3 shadow-[1px_0_0_var(--s-line)] sm:min-w-[220px] sm:px-5">
      <div className="flex items-center gap-3">
        <span className="hidden h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white ring-1 ring-(--s-line) sm:flex">
          {r.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={r.image} alt="" className="h-full w-full object-contain p-0.5" />
          ) : (
            <ShoppingBag className="h-4 w-4 text-slate-300" />
          )}
        </span>
        <span className="min-w-0">
          <span className="line-clamp-2 font-medium leading-snug">{r.label}</span>
          {brand && <span className="text-xs text-(--s-muted)">{brand}</span>}
        </span>
      </div>
    </td>
  );
}

type PdfChoice = { name: string; groups: string[]; makers: string[] };
/** Most brand columns in the PDF table. */
const MAX_PDF_BRANDS = 6;

/** Every brand (main brand: Orange, Sierra, ACL…) in these rows, the one with the most items first. */
function makersOf(rows: Row[]) {
  const count = new Map<string, number>();
  for (const r of rows) for (const mk of new Set(Object.values(r.cells).map((c) => c.maker).filter(Boolean))) count.set(mk, (count.get(mk) || 0) + 1);
  return [...count.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([mk]) => mk);
}

/** A brand's version of an item: its cheapest available range / colour, else any (out of stock). */
function makerCell(r: Row, maker: string) {
  const list = Object.entries(r.cells)
    .filter(([, c]) => c.maker === maker)
    .sort((a, b) => Number(b[1].available) - Number(a[1].available) || a[1].price - b[1].price);
  return list[0] ? { option: list[0][0], cell: list[0][1] } : null;
}

/** All rows, grouped by type of item, in the order they appear on the page. */
function allRows(view: View) {
  const rows = [...view.sections.flatMap((s) => s.sum.rows), ...view.others];
  const groups = [...new Set(rows.map((r) => r.group))];
  return groups.flatMap((g) => rows.filter((r) => r.group === g));
}

/** "Download PDF" window: choose what goes in the PDF before it is made. */
function PdfDialog({ view, busy, onClose, onDownload }: { view: View; busy: boolean; onClose: () => void; onDownload: (choice: PdfChoice) => void }) {
  const rows = useMemo(() => allRows(view), [view]);
  const groupList = useMemo(() => [...new Set(rows.map((r) => r.group))], [rows]);
  const [name, setName] = useState("");
  const [groups, setGroups] = useState<string[]>(groupList);
  const picked = rows.filter((r) => groups.includes(r.group));
  const makerList = makersOf(picked);
  const [makers, setMakers] = useState<string[]>(() => makersOf(rows).slice(0, MAX_PDF_BRANDS));
  const shownMakers = makers.filter((mk) => makerList.includes(mk));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const toggleGroup = (g: string) => setGroups((cur) => (cur.includes(g) ? cur.filter((x) => x !== g) : groupList.filter((x) => x === g || cur.includes(x))));
  const toggleMaker = (mk: string) =>
    setMakers((cur) => {
      if (cur.includes(mk)) return cur.filter((x) => x !== mk);
      if (cur.filter((x) => makerList.includes(x)).length >= MAX_PDF_BRANDS) {
        toast.info(`Up to ${MAX_PDF_BRANDS} brands in one table`, { description: "Untick one first, then pick another." });
        return cur;
      }
      return [...cur, mk];
    });

  const nothing = !picked.length;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 p-0 backdrop-blur-[2px] sm:items-center sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Download PDF"
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-t-3xl bg-(--s-surface) shadow-2xl sm:rounded-3xl"
      >
        <div className="flex items-start gap-3 border-b border-(--s-line) px-5 py-4 sm:px-6">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-(--s-accent-soft) text-(--s-accent)">
            <FileText className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-bold">Download PDF</h2>
            <p className="text-sm text-(--s-muted)">One table: your items in rows, each brand in its own column.</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded-full p-2 text-(--s-muted) hover:bg-(--s-soft) hover:text-(--s-ink)">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5 sm:px-6">
          <label className="block">
            <span className="text-sm font-semibold">
              Your name <span className="font-normal text-(--s-muted)">(optional)</span>
            </span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, 60))}
              placeholder="Shown on the PDF as “Prepared for”"
              className="mt-1.5 h-11 w-full rounded-xl border border-(--s-line) bg-(--s-surface) px-3.5 text-sm outline-none focus:border-(--s-accent) focus:ring-4 focus:ring-(--s-accent-soft)"
            />
          </label>

          <div>
            <div className="text-sm font-semibold">Items to include</div>
            <div className="mt-2 space-y-2">
              {groupList.map((g) => {
                const k = rows.filter((r) => r.group === g).length;
                return <CheckRow key={g} checked={groups.includes(g)} onChange={() => toggleGroup(g)} title={g} note={itemsWord(k)} />;
              })}
            </div>
          </div>

          <div>
            <div className="text-sm font-semibold">
              Brands to compare <span className="font-normal text-(--s-muted)">(columns{makerList.length > MAX_PDF_BRANDS ? `, up to ${MAX_PDF_BRANDS}` : ""})</span>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {makerList.map((mk) => {
                const on = shownMakers.includes(mk);
                const has = picked.filter((r) => makerCell(r, mk)).length;
                return (
                  <button
                    key={mk}
                    type="button"
                    onClick={() => toggleMaker(mk)}
                    aria-pressed={on}
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ring-1 transition ${
                      on ? "bg-(--s-btn) text-(--s-btn-ink) ring-(--s-btn)" : "bg-(--s-surface) text-(--s-ink-2) ring-(--s-line) hover:ring-(--s-ink-2)"
                    }`}
                  >
                    {on && <Check className="h-3.5 w-3.5" />}
                    {mk}
                    <span className={on ? "opacity-70" : "text-(--s-muted)"}>
                      {has} of {picked.length}
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-(--s-muted)">Where a brand does not have an item, the table shows “–”.</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t border-(--s-line) bg-(--s-soft) px-5 py-4 sm:px-6">
          <span className="mr-auto text-xs text-(--s-ink-2)">
            {nothing ? "Tick at least one item type" : `${itemsWord(picked.length)} · ${shownMakers.length} ${shownMakers.length === 1 ? "brand" : "brands"}`}
          </span>
          <button onClick={onClose} className="h-11 rounded-full px-5 text-sm font-semibold text-(--s-ink-2) hover:bg-(--s-line)/60">
            Cancel
          </button>
          <button
            onClick={() => onDownload({ name, groups, makers: shownMakers })}
            disabled={busy || nothing}
            className="inline-flex h-11 items-center gap-2 rounded-full bg-(--s-accent) px-6 text-sm font-bold text-(--s-accent-ink) transition hover:bg-(--s-accent-hover) disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Download PDF
          </button>
        </div>
      </div>
    </div>
  );
}

/** Tick box row used in the PDF window. */
function CheckRow({ checked, onChange, title, note }: { checked: boolean; onChange: () => void; title: string; note: string }) {
  return (
    <button
      type="button"
      onClick={onChange}
      aria-pressed={checked}
      className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left ${
        checked ? "border-(--s-accent)/50 bg-(--s-accent-soft)/40" : "border-(--s-line)"
      }`}
    >
      <span
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition ${
          checked ? "border-(--s-accent) bg-(--s-accent) text-white" : "border-(--s-line) bg-(--s-surface)"
        }`}
      >
        {checked && <Check className="h-3.5 w-3.5 stroke-[3]" />}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold">{title}</span>
        <span className="block text-xs text-(--s-muted)">{note}</span>
      </span>
    </button>
  );
}

/**
 * A4 PDF with ONE table:
 *   rows    = every item (grouped by type: Cables & Wires, Switches & Sockets…)
 *   columns = Your cart, then one column per brand (Orange, Sierra, ACL…)
 *   "–"     = that brand does not have the item
 * Under it: each brand's total and how many of the items it has.
 */
async function makePdf(
  rows: Row[],
  makers: string[],
  store: { name: string; phone: string; whatsapp: string },
  customer: string,
  brandLogos: BrandLogoItem[] = [],
) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const doc = new jsPDF({ orientation: makers.length > 3 ? "landscape" : "portrait", unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 14;
  const today = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

  type RGB = [number, number, number];
  const INK: RGB = [15, 23, 42];
  const MUTED: RGB = [100, 116, 139];
  const LINE: RGB = [226, 232, 240];
  const SOFT: RGB = [241, 245, 249];
  const BLUE: RGB = [37, 99, 235];
  const NAVY: RGB = [11, 17, 32];
  const GREEN: RGB = [22, 163, 74];
  const GREEN_SOFT: RGB = [220, 252, 231];
  const GREEN_INK: RGB = [21, 128, 61];

  // ---- Header
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, W, 30, "F");
  doc.setFillColor(...BLUE);
  doc.rect(0, 30, W, 1.4, "F");
  const logoDark = await shopLogo(store.name || "BK Wiring", true);
  if (logoDark) doc.addImage(logoDark.data, "PNG", M, 14.5 - 12 * logoDark.baseline, 12 * logoDark.ratio, 12, "shop-logo-dark", "FAST");
  else {
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(19);
    doc.text(store.name || "BK Wiring", M, 14);
  }
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(147, 197, 253);
  doc.text(["bkwiringbadukade.lk", "Galle area delivery", store.phone ? `Tel: ${store.phone}` : ""].filter(Boolean).join("   |   "), M, 23);
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("Brand Price Comparison", W - M, 14, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`${today}  |  ${itemsWord(rows.length)}`, W - M, 21, { align: "right" });
  if (customer) {
    doc.setTextColor(147, 197, 253);
    doc.text(`Prepared for: ${customer}`, W - M, 26, { align: "right" });
  }

  // ---- How to read
  doc.setTextColor(...MUTED);
  doc.setFontSize(9);
  doc.text(
    'Each brand has its own column.  "-" = that brand does not have the item.  Green = cheapest for that item.  (in cart) = what you picked.',
    M,
    39,
  );

  // ---- Table data
  const cols = makers.length;
  type Line = { kind: "group"; name: string } | { kind: "item"; r: Row };
  const lines: Line[] = [];
  let last = "";
  for (const r of rows) {
    if (r.group !== last) {
      lines.push({ kind: "group", name: r.group });
      last = r.group;
    }
    lines.push({ kind: "item", r });
  }
  const cheapestMaker = (r: Row) => {
    let best: { mk: string; price: number } | null = null;
    for (const mk of makers) {
      const c = makerCell(r, mk);
      if (c?.cell.available && (!best || c.cell.price < best.price)) best = { mk, price: c.cell.price };
    }
    return best?.mk ?? null;
  };
  const money = (price: number, qty: number) => `${rs(price * qty)}${qty > 1 ? `\n${rs(price)} each` : ""}`;

  const body: any[] = lines.map((ln) => {
    if (ln.kind === "group")
      return [{ content: ln.name.toUpperCase(), colSpan: 3 + cols, styles: { fillColor: SOFT, textColor: MUTED, fontStyle: "bold", fontSize: 8, cellPadding: { top: 2.2, bottom: 2.2, left: 3, right: 3 } } }];
    const r = ln.r;
    const mine = available(r.cells[r.cartBrand]);
    return [
      r.label,
      String(r.qty),
      mine ? `${money(mine.price, r.qty)}\n${r.cartBrand}` : "Out of stock",
      ...makers.map((mk) => {
        const m = makerCell(r, mk);
        if (!m) return "-";
        if (!m.cell.available) return "Out of stock";
        const range = m.option !== mk ? `\n${m.option}` : "";
        return `${money(m.cell.price, r.qty)}${range}${m.option === r.cartBrand ? "\n(in cart)" : ""}`;
      }),
    ];
  });

  // Brand totals (only the items each brand has) + how many items it has.
  const totals = makers.map((mk) => {
    let total = 0;
    let has = 0;
    for (const r of rows) {
      const m = makerCell(r, mk);
      if (m?.cell.available) {
        total += m.cell.price * r.qty;
        has++;
      }
    }
    return { total, has };
  });
  const cartTotal = rows.reduce((s, r) => s + cartPrice(r) * r.qty, 0);
  const full = totals.map((t, i) => ({ ...t, i })).filter((t) => t.has === rows.length);
  const fullWinner = full.length > 1 ? full.sort((a, b) => a.total - b.total)[0].i : -1;

  const optW = Math.min(36, (W - 2 * M - 62) / (cols + 1));
  autoTable(doc, {
    theme: "grid",
    margin: { left: M, right: M, bottom: 34 },
    startY: 43,
    head: [["Item", "Qty", "Your cart", ...makers]],
    body,
    foot: [
      ["Total", "", rs(cartTotal), ...totals.map((t) => rs(t.total))],
      ["Items this brand has", "", `${rows.length} of ${rows.length}`, ...totals.map((t) => `${t.has} of ${rows.length}`)],
    ],
    showFoot: "lastPage",
    styles: { font: "helvetica", fontSize: 9, cellPadding: 2.3, lineColor: LINE, lineWidth: 0.2, textColor: INK, valign: "middle" },
    headStyles: { fillColor: NAVY, textColor: 255, fontStyle: "bold", fontSize: 10, halign: "right" },
    footStyles: { fillColor: SOFT, textColor: INK, fontStyle: "bold", halign: "right" },
    columnStyles: {
      1: { cellWidth: 11 },
      2: { cellWidth: optW },
      ...Object.fromEntries(makers.map((_, i) => [i + 3, { cellWidth: optW }])),
    },
    didParseCell: (h) => {
      const col = h.column.index;
      if (col === 0) h.cell.styles.halign = "left";
      else if (col === 1) h.cell.styles.halign = "center";
      else h.cell.styles.halign = "right";
      if (h.section === "head" && col === 2) h.cell.styles.fillColor = BLUE;
      if (h.section === "body") {
        const ln = lines[h.row.index];
        if (ln?.kind !== "item") return;
        if (col === 2) h.cell.styles.fillColor = [239, 246, 255];
        if (col >= 3 && cheapestMaker(ln.r) === makers[col - 3]) {
          h.cell.styles.fillColor = GREEN_SOFT;
          h.cell.styles.textColor = GREEN_INK;
          h.cell.styles.fontStyle = "bold";
        }
        if (col >= 3 && h.cell.raw === "-") h.cell.styles.textColor = MUTED;
      }
      if (h.section === "foot") {
        if (h.row.index === 1) {
          h.cell.styles.fontStyle = "normal";
          h.cell.styles.fontSize = 8.5;
          h.cell.styles.textColor = MUTED;
          if (col >= 3 && totals[col - 3].has < rows.length) h.cell.styles.textColor = [180, 83, 9];
        }
        if (h.row.index === 0) {
          h.cell.styles.fontSize = 10.5;
          if (fullWinner >= 0 && col === 3 + fullWinner) {
            h.cell.styles.fillColor = GREEN;
            h.cell.styles.textColor = 255;
          }
        }
      }
    },
  });

  // ---- Notes under the table
  let y = ((doc as any).lastAutoTable?.finalY ?? 60) + 6;
  if (y > H - 46) {
    doc.addPage();
    y = 18;
  }
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...MUTED);
  const notes = [
    "A brand's total adds only the items that brand has. Check \"Items this brand has\" before comparing totals.",
    "Where a brand has more than one range or colour, the cheapest one is shown (its name is under the price).",
    "Prices include taxes. Galle area delivery charges are calculated at dispatch.",
  ];
  doc.text(notes, M, y);

  // ---- Brand strip + Footer on every page
  const selectedMakers = Array.from(
    new Set([...makers, ...rows.map((r) => r.cells[r.cartBrand]?.maker || r.cartBrand)].filter(Boolean)),
  );
  const brandCards = await prepareBrandStripCards(brandLogos, selectedMakers);
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    drawBottomBrandsStrip(doc, brandCards, M, W, H - 30);
    doc.setDrawColor(...LINE);
    doc.line(M, H - 12, W - M, H - 12);
    doc.setFontSize(7.5);
    doc.setTextColor(...MUTED);
    doc.text(`Prices valid on ${today} and may change.  To order: bkwiringbadukade.lk${store.phone ? `  |  ${store.phone}` : ""}`, M, H - 7.5);
    doc.text(`Page ${p} of ${pages}`, W - M, H - 7.5, { align: "right" });
  }

  doc.save(`brand-comparison-${new Date().toISOString().slice(0, 10)}.pdf`);
}

/**
 * Invoice-style quotation PDF of the final list: only the items as they are in
 * the cart now (the brand / range the customer picked). Returns the PDF as a
 * Blob plus a file name, so it can be downloaded or shared.
 */
async function makeQuotationPdf(
  rows: Row[],
  store: { name: string; phone: string; whatsapp: string },
  customer: string,
  brandLogos: BrandLogoItem[] = [],
) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 14;
  const now = new Date();
  const dateText = now.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  const pad = (x: number) => String(x).padStart(2, "0");
  const ref = `Q-${String(now.getFullYear()).slice(2)}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;

  type RGB = [number, number, number];
  const INK: RGB = [15, 23, 42];
  const INK_2: RGB = [51, 65, 85];
  const MUTED: RGB = [100, 116, 139];
  const LINE: RGB = [203, 213, 225];
  const LINE_SOFT: RGB = [226, 232, 240];
  const SOFT: RGB = [248, 250, 252];
  const BLUE: RGB = [37, 99, 235];
  const BLUE_SOFT: RGB = [239, 246, 255];
  const NAVY: RGB = [11, 17, 32];
  const GREEN_INK: RGB = [21, 128, 61];
  const GREEN_SOFT: RGB = [220, 252, 231];

  const items = rows
    .map((r) => ({ r, c: r.cells[r.cartBrand] }))
    .filter((x) => x.c?.available);
  const total = items.reduce((s, { r, c }) => s + c.price * r.qty, 0);
  const mrpTotal = items.reduce((s, { r, c }) => s + Math.max(c.mrp || 0, c.price) * r.qty, 0);
  const saving = Math.max(0, mrpTotal - total);
  const savingPct = mrpTotal > 0 && saving > 0 ? Math.round((saving / mrpTotal) * 100) : 0;
  const totalUnits = items.reduce((s, { r }) => s + r.qty, 0);

  // ---- Top Header Band (Deep Navy + Electric Royal Blue Accent)
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, W, 4.5, "F");
  doc.setFillColor(...BLUE);
  doc.rect(0, 4.5, W, 1.3, "F");

  // Left: Shop Logo + Company Details
  const logo = await shopLogo(store.name || "BK Wiring", false);
  if (logo) {
    doc.addImage(logo.data, "PNG", M, 20.5 - 13 * logo.baseline, 13 * logo.ratio, 13, "shop-logo", "FAST");
  } else {
    doc.setTextColor(...INK);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.text(store.name || "BK Wiring", M, 20.5);
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.8);
  doc.setTextColor(...INK_2);
  doc.text("Genuine House Wiring & Electrical Accessories", M, 27.5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.2);
  doc.setTextColor(...MUTED);
  const contactParts = ["Web: bkwiringbadukade.lk", "Delivery: Galle Area"];
  if (store.phone) contactParts.push(`Tel: ${store.phone}`);
  if (store.whatsapp && store.whatsapp !== store.phone) contactParts.push(`WhatsApp: ${store.whatsapp}`);
  doc.text(contactParts.join("   |   "), M, 32);

  // Right: Executive QUOTATION Header & Reference Details
  doc.setFont("helvetica", "bold");
  doc.setFontSize(19);
  doc.setTextColor(...NAVY);
  doc.text("QUOTATION", W - M, 15.5, { align: "right" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11.5);
  doc.setTextColor(...BLUE);
  doc.text(ref, W - M, 21.2, { align: "right" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.3);
  doc.setTextColor(...INK_2);
  doc.text(`Date: ${dateText}`, W - M, 26.5, { align: "right" });
  doc.setTextColor(...MUTED);
  doc.text("Validity: 7 Days from issue date", W - M, 31.2, { align: "right" });

  // Double horizontal letterhead rule
  let y = 36;
  doc.setDrawColor(...NAVY);
  doc.setLineWidth(0.5);
  doc.line(M, y, W - M, y);
  doc.setDrawColor(...BLUE);
  doc.setLineWidth(0.2);
  doc.line(M, y + 1, W - M, y + 1);
  y += 4.5;

  // ---- Unified 3-Column Client & Terms Strip
  const stripH = 16.5;
  const fullW = W - 2 * M;
  const col1W = fullW * 0.36;
  const col2W = fullW * 0.32;
  doc.setFillColor(...SOFT);
  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.25);
  doc.rect(M, y, fullW, stripH, "FD");
  // Left Royal Blue accent bar
  doc.setFillColor(...BLUE);
  doc.rect(M, y, 1.5, stripH, "F");
  // Vertical column dividers
  doc.setDrawColor(...LINE_SOFT);
  doc.line(M + col1W, y + 2.5, M + col1W, y + stripH - 2.5);
  doc.line(M + col1W + col2W, y + 2.5, M + col1W + col2W, y + stripH - 2.5);

  // Col 1: Prepared For
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.8);
  doc.setTextColor(...BLUE);
  doc.text("CUSTOMER / PREPARED FOR", M + 4.5, y + 4.5);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.2);
  doc.setTextColor(...INK);
  doc.text(customer || "Valued Customer", M + 4.5, y + 9.8);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.8);
  doc.setTextColor(...MUTED);
  doc.text(`${itemsWord(items.length)}  •  ${totalUnits} ${totalUnits === 1 ? "unit" : "units"} total`, M + 4.5, y + 14.2);

  // Col 2: Delivery Area
  const c2x = M + col1W + 4;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.8);
  doc.setTextColor(...MUTED);
  doc.text("DELIVERY & COVERAGE", c2x, y + 4.5);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.2);
  doc.setTextColor(...INK);
  doc.text("Galle Area Doorstep Delivery", c2x, y + 9.8);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.8);
  doc.setTextColor(...MUTED);
  doc.text("Fast dispatch across Galle & suburbs", c2x, y + 14.2);

  // Col 3: Payment & Warranty
  const c3x = M + col1W + col2W + 4;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.8);
  doc.setTextColor(...MUTED);
  doc.text("PAYMENT & ASSURANCE", c3x, y + 4.5);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.2);
  doc.setTextColor(...INK);
  doc.text("Cash on Delivery / Bank Transfer", c3x, y + 9.8);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.8);
  doc.setTextColor(...MUTED);
  doc.text("100% Genuine Branded Products", c3x, y + 14.2);

  y += stripH + 5;

  // ---- Build Grouped Items Table Rows (grouped by category like "Cables & Wires", "Switches & Sockets")
  type QuoteTableLine = { kind: "group"; title: string } | { kind: "item"; idx: number; r: Row; c: Cell };
  const tableLines: QuoteTableLine[] = [];
  let lastGroup = "";
  items.forEach(({ r, c }, idx) => {
    const grp = (r.group || "").trim();
    if (grp && grp !== lastGroup) {
      tableLines.push({ kind: "group", title: grp });
      lastGroup = grp;
    }
    tableLines.push({ kind: "item", idx: idx + 1, r, c });
  });

  const tableBody: any[] = tableLines.map((ln) => {
    if (ln.kind === "group") {
      return [
        {
          content: ln.title.toUpperCase(),
          colSpan: 7,
          styles: {
            fillColor: BLUE_SOFT,
            textColor: BLUE,
            fontStyle: "bold",
            fontSize: 7.6,
            halign: "left",
            cellPadding: { top: 2, bottom: 2, left: 3.5, right: 3.5 },
          },
        },
      ];
    }
    const { idx, r, c } = ln;
    const mrpVal = Math.max(c.mrp || 0, c.price);
    const discPct = mrpVal > c.price ? Math.round(((mrpVal - c.price) / mrpVal) * 100) : 0;
    const discStr = discPct > 0 ? `-${discPct}%` : "Net";
    return [
      String(idx),
      c.name,
      String(r.qty),
      rs(mrpVal),
      discStr,
      rs(c.price),
      rs(c.price * r.qty),
    ];
  });

  autoTable(doc, {
    theme: "grid",
    margin: { left: M, right: M, bottom: 34 },
    startY: y,
    head: [["#", "Item Description", "Qty", "MRP", "Disc.", "Unit Price", "Line Total"]],
    body: tableBody,
    foot: [
      [
        "",
        `Total (${itemsWord(items.length)}  •  ${totalUnits} ${totalUnits === 1 ? "unit" : "units"})`,
        String(totalUnits),
        mrpTotal > total ? rs(mrpTotal) : "",
        savingPct > 0 ? `-${savingPct}%` : "",
        "",
        rs(total),
      ],
    ],
    showFoot: "lastPage",
    styles: {
      font: "helvetica",
      fontSize: 8.8,
      cellPadding: { top: 3, bottom: 3, left: 2.8, right: 2.8 },
      textColor: INK,
      valign: "middle",
      lineColor: LINE_SOFT,
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: NAVY,
      textColor: 255,
      fontStyle: "bold",
      fontSize: 8.3,
      lineColor: NAVY,
      lineWidth: 0.2,
      cellPadding: { top: 3.2, bottom: 3.2, left: 2.8, right: 2.8 },
    },
    footStyles: {
      fillColor: SOFT,
      textColor: INK,
      fontStyle: "bold",
      fontSize: 8.8,
      lineColor: LINE,
      lineWidth: 0.25,
      cellPadding: { top: 3, bottom: 3, left: 2.8, right: 2.8 },
    },
    columnStyles: {
      0: { cellWidth: 9, halign: "center", textColor: MUTED },
      1: { halign: "left", fontStyle: "bold" },
      2: { cellWidth: 13, halign: "center", fontStyle: "bold" },
      3: { cellWidth: 23, halign: "right", textColor: MUTED, fontSize: 8.3 },
      4: { cellWidth: 14, halign: "center", fontSize: 8 },
      5: { cellWidth: 24, halign: "right", fontStyle: "bold" },
      6: { cellWidth: 27, halign: "right", fontStyle: "bold" },
    },
    didParseCell: (h) => {
      const col = h.column.index;
      if (h.section === "head" || h.section === "foot") {
        if (col === 0 || col === 2 || col === 4) h.cell.styles.halign = "center";
        else if (col >= 3) h.cell.styles.halign = "right";
        else h.cell.styles.halign = "left";
      }
      if (h.section === "body") {
        const ln = tableLines[h.row.index];
        if (!ln || ln.kind === "group") return;
        if (col === 4) {
          if (String(h.cell.raw).startsWith("-")) {
            h.cell.styles.textColor = GREEN_INK;
            h.cell.styles.fillColor = GREEN_SOFT;
            h.cell.styles.fontStyle = "bold";
          } else {
            h.cell.styles.textColor = MUTED;
          }
        }
      }
      if (h.section === "foot" && col === 4 && savingPct > 0) {
        h.cell.styles.textColor = GREEN_INK;
      }
    },
  });
  y = ((doc as any).lastAutoTable?.finalY ?? y) + 6;

  // Ensure enough space for Financial Summary + Signatures + Bottom Brand Icons + Footer
  if (y > H - 84) {
    doc.addPage();
    y = 20;
  }

  // ---- Bottom Section: Terms (Left) & Structured Invoice Summary Table (Right)
  const bx = W - M - 82;
  const bw = 82;
  const rowsT: { label: string; value: string; isDiscount?: boolean }[] =
    saving > 0
      ? [
          { label: "Gross MRP Value", value: rs(mrpTotal) },
          { label: `Discount Saved${savingPct > 0 ? ` (${savingPct}% OFF)` : ""}`, value: `- ${rs(saving)}`, isDiscount: true },
        ]
      : [{ label: "Items Subtotal", value: rs(total) }];
  rowsT.push({ label: "Delivery (Galle Area)", value: "Not included" });

  let ry = y + 4;
  rowsT.forEach((row) => {
    doc.setFont("helvetica", row.isDiscount ? "bold" : "normal");
    doc.setFontSize(8.8);
    doc.setTextColor(...(row.isDiscount ? GREEN_INK : INK_2));
    doc.text(row.label, bx + 2, ry);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...(row.isDiscount ? GREEN_INK : INK));
    doc.text(row.value, W - M - 2, ry, { align: "right" });
    doc.setDrawColor(...LINE_SOFT);
    doc.setLineWidth(0.2);
    doc.line(bx, ry + 2, W - M, ry + 2);
    ry += 6.2;
  });

  // Net Quotation Total Bar
  const ty = ry - 0.5;
  doc.setFillColor(...NAVY);
  doc.roundedRect(bx, ty, bw, 11.5, 1.5, 1.5, "F");
  doc.setFillColor(...BLUE);
  doc.rect(bx, ty, 2.2, 11.5, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.8);
  doc.setTextColor(147, 197, 253);
  doc.text("NET QUOTATION TOTAL", bx + 5, ty + 7.2);
  doc.setFontSize(12);
  doc.setTextColor(255, 255, 255);
  doc.text(rs(total), W - M - 3.5, ty + 7.4, { align: "right" });

  // Left: Terms & Conditions
  const notesW = bx - M - 8;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.2);
  doc.setTextColor(...INK);
  doc.text("TERMS & ORDERING INSTRUCTIONS", M, y + 4);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.8);
  doc.setTextColor(...INK_2);
  const notes = doc.splitTextToSize(
    [
      `1. Prices include applicable taxes and are valid for 7 days from ${dateText} (subject to stock).`,
      "2. Doorstep delivery is available across the Galle area (delivery charges calculated at dispatch).",
      `3. To place this order, visit bkwiringbadukade.lk${store.phone ? ` or call/WhatsApp ${store.phone}` : ""} and quote Ref ${ref}.`,
    ].join("\n"),
    notesW,
  );
  doc.text(notes, M, y + 8.8);

  // ---- Managed Bottom Brand Logos Strip + Footer on every page
  const itemMakers = Array.from(
    new Set(items.flatMap(({ r, c }) => [c.maker, r.cartBrand]).filter(Boolean)),
  );
  const brandCards = await prepareBrandStripCards(brandLogos, itemMakers);
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    drawBottomBrandsStrip(doc, brandCards, M, W, H - 30);
    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.25);
    doc.line(M, H - 12, W - M, H - 12);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...MUTED);
    doc.text(
      `${store.name || "BK Wiring"}  •  bkwiringbadukade.lk  •  Galle Area Delivery${store.phone ? `  •  ${store.phone}` : ""}`,
      M,
      H - 7.5,
    );
    doc.text(`${ref}  |  Page ${p} of ${pages}`, W - M, H - 7.5, { align: "right" });
  }

  const fileName = `quotation-${ref}.pdf`;
  return { blob: doc.output("blob") as Blob, fileName, ref, total, count: items.length };
}

/** "බඩු කඩේ" — Sinhala part of the shop name. */
const SHOP_NAME_SI = "\u0DB6\u0DA9\u0DD4 \u0D9A\u0DA9\u0DDA";

/**
 * Ensures the Google Sinhala fonts are genuinely downloaded and decoded by the
 * browser before we draw on `<canvas>`. Note: `document.fonts.check()` returns
 * `true` when a font family isn't registered in CSS yet, so we explicitly wait
 * for the `<link>` stylesheet `load` event first and then call `fonts.load()`.
 */
async function ensureSinhalaFontLoaded() {
  if (typeof document === "undefined") return;
  try {
    let link = document.getElementById("bkw-si-font") as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement("link");
      link.id = "bkw-si-font";
      link.rel = "stylesheet";
      link.href =
        "https://fonts.googleapis.com/css2?family=Abhaya+Libre:wght@700;800&family=Yaldevi:wght@600;700&display=swap";
      await new Promise<void>((resolve) => {
        link!.onload = () => resolve();
        link!.onerror = () => resolve();
        document.head.appendChild(link!);
        setTimeout(resolve, 2000);
      });
    }
    await Promise.race([
      Promise.all([
        document.fonts.load(`800 48px "Abhaya Libre"`, SHOP_NAME_SI),
        document.fonts.load(`700 44px "Yaldevi"`, SHOP_NAME_SI),
      ]),
      new Promise((r) => setTimeout(r, 2200)),
    ]);
  } catch {
    /* fallback to system Sinhala font if offline */
  }
}

/**
 * Shop name as a high-DPI emblem + calligraphic Sinhala script ("BK Wiring බඩු කඩේ"):
 * - Left: Electric Royal Blue rounded badge with white lightning bolt
 * - Middle: Bold geometric "BK Wiring"
 * - Right: Stylized calligraphic Sinhala "බඩු කඩේ" with artistic slant,
 *   stroke contrast, and a graceful decorative swash flourish underneath.
 */
async function shopLogo(name: string, onDark: boolean) {
  await ensureSinhalaFontLoaded();

  const scale = 4;
  const latin = '800 25px "Plus Jakarta Sans", "Inter", Arial, Helvetica, sans-serif';
  const sinhala = '800 35px "Abhaya Libre", "Yaldevi", "Iskoola Pota", "Noto Serif Sinhala", serif';

  const c = document.createElement("canvas");
  const ctx = c.getContext("2d");
  if (!ctx) return null;

  const parts = name.trim().split(/\s+/);
  const firstWord = parts[0] || "BK";
  const restWords = parts.slice(1).join(" ") || "Wiring";

  ctx.font = latin;
  const wFirst = ctx.measureText(firstWord).width;
  const wSpace = ctx.measureText(" ").width;
  const wRest = ctx.measureText(restWords).width;
  const w1 = wFirst + wSpace + wRest;
  ctx.font = sinhala;
  const w2 = ctx.measureText(SHOP_NAME_SI).width;

  const badgeSize = 31;
  const badgeGap = 9.5;
  const wordGap = 12;
  const W = Math.ceil(badgeSize + badgeGap + w1 + wordGap + w2 + 16);
  const H = 48;

  c.width = W * scale;
  c.height = H * scale;
  ctx.scale(scale, scale);

  const baselineY = 32;

  // 1. Draw Deep Navy -> Royal Blue Squircle Badge with Sky-Cyan Walls, White Roof & Copper-Coral Bolt
  const bx = 1;
  const by = 4.5;
  const br = 8.5;
  const bgGrad = ctx.createLinearGradient(bx, by, bx + badgeSize, by + badgeSize);
  bgGrad.addColorStop(0, "#1e3a8a");
  bgGrad.addColorStop(0.5, "#1d4ed8");
  bgGrad.addColorStop(1, "#0f172a");
  ctx.fillStyle = bgGrad;
  ctx.beginPath();
  ctx.roundRect(bx, by, badgeSize, badgeSize, br);
  ctx.fill();

  // Multi-tone Cyan-to-Copper inner rim border
  const rimGrad = ctx.createLinearGradient(bx, by, bx + badgeSize, by + badgeSize);
  rimGrad.addColorStop(0, "rgba(56, 189, 248, 0.8)");
  rimGrad.addColorStop(0.5, "rgba(96, 165, 250, 0.3)");
  rimGrad.addColorStop(1, "rgba(249, 115, 22, 0.7)");
  ctx.strokeStyle = rimGrad;
  ctx.lineWidth = 1.0;
  ctx.beginPath();
  ctx.roundRect(bx + 0.6, by + 0.6, badgeSize - 1.2, badgeSize - 1.2, br - 0.5);
  ctx.stroke();

  // House side walls in Electric Sky Cyan (#38bdf8)
  ctx.strokeStyle = "#38bdf8";
  ctx.lineWidth = 1.7;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(bx + 8.6, by + 13.0);
  ctx.lineTo(bx + 8.6, by + 22.8);
  ctx.lineTo(bx + 12.0, by + 22.8);
  ctx.moveTo(bx + 22.4, by + 13.0);
  ctx.lineTo(bx + 22.4, by + 22.8);
  ctx.lineTo(bx + 19.0, by + 22.8);
  ctx.stroke();

  // Crisp White House Roofline (/\)
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(bx + 6.0, by + 13.6);
  ctx.lineTo(bx + 15.5, by + 5.8);
  ctx.lineTo(bx + 25.0, by + 13.6);
  ctx.stroke();

  // Vibrant Copper-Orange to Live-Coral Electric Bolt
  const boltGrad = ctx.createLinearGradient(bx + 11, by + 10, bx + 20, by + 25);
  boltGrad.addColorStop(0, "#fb923c");
  boltGrad.addColorStop(0.5, "#f97316");
  boltGrad.addColorStop(1, "#e11d48");
  ctx.fillStyle = boltGrad;
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 0.55;
  ctx.beginPath();
  ctx.moveTo(bx + 16.6, by + 9.8);
  ctx.lineTo(bx + 10.8, by + 17.2);
  ctx.lineTo(bx + 15.0, by + 17.2);
  ctx.lineTo(bx + 13.4, by + 24.4);
  ctx.lineTo(bx + 20.1, by + 16.2);
  ctx.lineTo(bx + 15.8, by + 16.2);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // 2. Draw Two-Tone English Name ("BK" in Navy/White + "Wiring" in Electric Blue)
  const textX = bx + badgeSize + badgeGap;
  ctx.textBaseline = "alphabetic";
  ctx.font = latin;
  ctx.fillStyle = onDark ? "#ffffff" : "#0b1120";
  ctx.fillText(firstWord, textX, baselineY);
  ctx.fillStyle = onDark ? "#38bdf8" : "#2563eb";
  ctx.fillText(restWords, textX + wFirst + wSpace, baselineY);

  // 3. Draw Artistic Calligraphic Sinhala ("බඩු කඩේ") with slant & Copper-to-Blue flourish swash
  const siX = textX + w1 + wordGap;
  ctx.save();
  ctx.translate(siX, baselineY);
  ctx.transform(1, -0.02, -0.14, 1, 0, 0);
  ctx.font = sinhala;

  const siGrad = ctx.createLinearGradient(0, -26, w2, 6);
  if (onDark) {
    siGrad.addColorStop(0, "#fb923c");
    siGrad.addColorStop(0.55, "#f97316");
    siGrad.addColorStop(1, "#fda4af");
  } else {
    siGrad.addColorStop(0, "#ea580c");
    siGrad.addColorStop(0.5, "#e11d48");
    siGrad.addColorStop(1, "#1d4ed8");
  }

  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.lineWidth = 0.6;
  ctx.strokeStyle = onDark ? "#fb923c" : "#c2410c";
  ctx.strokeText(SHOP_NAME_SI, 0, 0);
  ctx.fillStyle = siGrad;
  ctx.fillText(SHOP_NAME_SI, 0, 0);
  ctx.restore();

  // Decorative tapered calligraphic swash curve underneath "බඩු කඩේ"
  ctx.save();
  ctx.beginPath();
  const swStart = siX + 2;
  const swEnd = siX + w2 + 4;
  ctx.moveTo(swStart, baselineY + 7.5);
  ctx.bezierCurveTo(
    swStart + w2 * 0.32,
    baselineY + 11.2,
    swStart + w2 * 0.68,
    baselineY + 4.8,
    swEnd,
    baselineY + 7.2,
  );
  const swGrad = ctx.createLinearGradient(swStart, 0, swEnd, 0);
  swGrad.addColorStop(0, onDark ? "#38bdf8" : "#2563eb");
  swGrad.addColorStop(1, "#f97316");
  ctx.strokeStyle = swGrad;
  ctx.lineWidth = 1.7;
  ctx.lineCap = "round";
  ctx.stroke();

  // Copper-Orange spark dot at the tip of the flourish
  ctx.fillStyle = "#f97316";
  ctx.beginPath();
  ctx.arc(swEnd + 2.6, baselineY + 7.0, 1.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  return { data: c.toDataURL("image/png"), ratio: W / H, baseline: baselineY / H };
}

type BrandCardImage = { name: string; dataUrl: string; aspect: number };

/**
 * Loads an image URL into an HTMLImageElement with a timeout.
 */
function loadImageElement(src: string, timeoutMs = 3500): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    const timer = setTimeout(() => resolve(null), timeoutMs);
    img.onload = () => {
      clearTimeout(timer);
      resolve(img);
    };
    img.onerror = () => {
      clearTimeout(timer);
      resolve(null);
    };
    img.src = src;
  });
}

/**
 * Auto-trims excess white or transparent padding around a brand logo image and
 * returns a clean, tightly-cropped PNG data URL (just the brand icon itself,
 * with no outer border box) plus its aspect ratio.
 */
function cropBrandIconToDataUrl(img: HTMLImageElement): { dataUrl: string; aspect: number } | null {
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  if (!w || !h) return null;

  const temp = document.createElement("canvas");
  temp.width = w;
  temp.height = h;
  const tctx = temp.getContext("2d");
  if (!tctx) return null;
  tctx.drawImage(img, 0, 0);

  let minX = 0;
  let minY = 0;
  let maxX = w - 1;
  let maxY = h - 1;

  try {
    const { data } = tctx.getImageData(0, 0, w, h);
    let top = h;
    let left = w;
    let right = -1;
    let bottom = -1;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = (y * w + x) * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        const a = data[idx + 3];
        // Non-transparent and non-white pixel
        if (a > 25 && (r < 246 || g < 246 || b < 246)) {
          if (x < left) left = x;
          if (x > right) right = x;
          if (y < top) top = y;
          if (y > bottom) bottom = y;
        }
      }
    }

    if (right >= left && bottom >= top) {
      const padX = Math.max(2, Math.round((right - left) * 0.04));
      const padY = Math.max(2, Math.round((bottom - top) * 0.06));
      minX = Math.max(0, left - padX);
      minY = Math.max(0, top - padY);
      maxX = Math.min(w - 1, right + padX);
      maxY = Math.min(h - 1, bottom + padY);
    }
  } catch {
    /* If getImageData is blocked, fall back to full image dimensions */
  }

  const cropW = Math.max(1, maxX - minX + 1);
  const cropH = Math.max(1, maxY - minY + 1);

  const out = document.createElement("canvas");
  out.width = cropW;
  out.height = cropH;
  const octx = out.getContext("2d");
  if (!octx) return null;

  octx.drawImage(img, minX, minY, cropW, cropH, 0, 0, cropW, cropH);
  try {
    return { dataUrl: out.toDataURL("image/png"), aspect: cropW / cropH };
  } catch {
    return null;
  }
}

/**
 * Prepares ONLY the selected brands' logo icons (no unselected brands, no text
 * fallbacks, and no rectangular border boxes).
 */
async function prepareBrandStripCards(brandLogos: BrandLogoItem[], selectedBrandNames: string[]): Promise<BrandCardImage[]> {
  if (typeof document === "undefined" || !selectedBrandNames.length || !brandLogos.length) return [];

  const normalizedSelected = selectedBrandNames
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  // Match only brands that are selected in the quotation/comparison AND have a logoUrl
  const seenUrls = new Set<string>();
  const matched: { name: string; logoUrl: string }[] = [];

  for (const sel of normalizedSelected) {
    for (const b of brandLogos) {
      if (!b.logoUrl) continue;
      const bName = b.name.trim().toLowerCase();
      if (!bName) continue;
      const isMatch =
        bName === sel ||
        sel.startsWith(`${bName} `) ||
        bName.startsWith(`${sel} `);
      if (isMatch && !seenUrls.has(b.logoUrl)) {
        seenUrls.add(b.logoUrl);
        matched.push({ name: b.name.trim(), logoUrl: b.logoUrl });
      }
    }
  }

  const results: BrandCardImage[] = [];
  for (const item of matched.slice(0, 8)) {
    const img = await loadImageElement(item.logoUrl);
    if (!img) continue;
    const cropped = cropBrandIconToDataUrl(img);
    if (cropped) {
      results.push({ name: item.name, dataUrl: cropped.dataUrl, aspect: cropped.aspect });
    }
  }

  return results;
}

/**
 * Draws ONLY the cropped brand icons for the selected brands centered at the
 * bottom of the PDF page (right above the footer line), without any boxes or text.
 */
function drawBottomBrandsStrip(doc: any, cards: BrandCardImage[], M: number, W: number, topY: number) {
  if (!cards.length) return;
  const availW = W - 2 * M;
  const gap = 8;
  const iconH = 8.5;
  const maxIconW = 28;

  const dims = cards.map((c) => {
    let w = iconH * c.aspect;
    let h = iconH;
    if (w > maxIconW) {
      w = maxIconW;
      h = w / c.aspect;
    }
    return { w, h };
  });

  const totalRowW = dims.reduce((s, d) => s + d.w, 0) + gap * (cards.length - 1);
  let curX = M + Math.max(0, (availW - totalRowW) / 2);

  cards.forEach((card, idx) => {
    const { w, h } = dims[idx];
    const iconY = topY + (14 - h) / 2;
    doc.addImage(card.dataUrl, "PNG", curX, iconY, w, h, `brand-icon-${idx}`, "FAST");
    curX += w + gap;
  });
}
