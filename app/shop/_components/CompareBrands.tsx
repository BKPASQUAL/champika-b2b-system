"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, Check, Download, FileText, Loader2, Lock, Share2, ShoppingBag, X } from "lucide-react";
import { useShop } from "./ShopContext";
import { rs } from "./format";
import { QuoteFromCart } from "./QuoteFromCart";

type Cell = { id: string; name: string; maker: string; price: number; mrp: number; available: boolean };
type Row = { cartId: string; label: string; image: string | null; qty: number; group: string; cartBrand: string; cells: Record<string, Cell> };
type Table = { brands: string[]; rows: Row[] };

type BrandSum = {
  /** Option name, e.g. "Sierra" or "Akoya Black". */
  name: string;
  /** Main brand, e.g. "Orange". */
  maker: string;
  /** These items: this option where it has the item, the cart's choice for the rest. */
  total: number;
  covered: number;
  /** The cart already uses this option wherever it can. */
  isCart: boolean;
};
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

function summarise(rows: Row[], order: string[]): Summary {
  const names = order.filter((b) => rows.some((r) => r.cells[b]));
  const brands: BrandSum[] = names.map((b) => ({
    name: b,
    maker: rows.find((r) => r.cells[b])!.cells[b].maker || b,
    total: rows.reduce((s, r) => s + (available(r.cells[b])?.price ?? cartPrice(r)) * r.qty, 0),
    covered: rows.filter((r) => available(r.cells[b])).length,
    isCart: rows.every((r) => !available(r.cells[b]) || r.cartBrand === b),
  }));
  // Cheapest first: every total covers the same items, so they compare fairly.
  brands.sort((a, b) => a.total - b.total || b.covered - a.covered);
  return {
    rows,
    brands,
    bestTotal: rows.reduce((s, r) => s + (bestOf(r)?.[1].price ?? cartPrice(r)) * r.qty, 0),
    cartTotal: rows.reduce((s, r) => s + cartPrice(r) * r.qty, 0),
    winner: brands.length > 1 ? brands[0].name : null,
  };
}

/** Options shown in a section's table: the customer's pick, else cheapest + the cart's option + next cheapest. */
function defaultPick(sum: Summary) {
  const count = new Map<string, number>();
  sum.rows.forEach((r) => count.set(r.cartBrand, (count.get(r.cartBrand) || 0) + 1));
  const inCart = [...count.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  return [...new Set([sum.brands[0]?.name, inCart, ...sum.brands.map((b) => b.name)].filter(Boolean) as string[])].slice(0, MAX_COLS);
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
  const [pdfOpen, setPdfOpen] = useState(false);
  const [quoteBusy, setQuoteBusy] = useState<"download" | "share" | null>(null);

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
    const sections = groups.map((g) => ({ name: g, sum: summarise(comp.filter((r) => r.group === g), data.brands) }));
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
    for (const r of sec.sum.rows) {
      const target = option === BEST ? bestOf(r)?.[1] : r.cells[option];
      if (target?.available && target.id !== r.cartId) pairs.push([r.cartId, target.id]);
    }
    if (!pairs.length) return toast.info("Your cart already uses these items");
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
      const q = await makeQuotationPdf(allRows(view), store, customer?.name || "");
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
      await makePdf(rows, choice.makers, store, choice.name.trim());
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
          onToggle={(nm) => togglePick(sec, nm)}
          onSwitch={(opt) => switchTo(sec, opt)}
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
                          <td colSpan={5} className="px-5 py-2 text-[11px] font-bold uppercase tracking-wide text-(--s-muted)">
                            {r.group}
                          </td>
                        </tr>
                      )}
                      <tr className="border-b border-(--s-line)">
                        <ItemCell r={r} />
                        <td className="px-4 py-3">
                          {c?.maker && c.maker !== r.cartBrand && (
                            <div className="text-[10px] font-bold uppercase tracking-wider text-(--s-muted)">{c.maker}</div>
                          )}
                          <div className="font-semibold">{r.cartBrand}</div>
                          {hasChoice ? (
                            <a href={`#${sectionId(r.group)}`} className="text-[11px] font-semibold text-(--s-accent) hover:underline">
                              Change
                            </a>
                          ) : (
                            <div className="text-[11px] text-(--s-muted)">Only brand</div>
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
                    <div className="text-[11px] text-(--s-muted)">{itemsWord(n)} · delivery not included</div>
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
    </div>
  );
}

/** One type of item (e.g. Switches & Sockets): option cards + price table. */
function SectionBlock({
  index,
  sec,
  shown,
  onToggle,
  onSwitch,
}: {
  index: number | null;
  sec: Section;
  shown: string[];
  onToggle: (option: string) => void;
  onSwitch: (option: string) => void;
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

      {/* Option cards: every option, small */}
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 2xl:grid-cols-6">
        {sum.brands.map((b) => (
          <div
            key={b.name}
            className={`flex flex-col rounded-lg border p-2.5 transition ${
              b.isCart
                ? "border-(--s-accent) bg-(--s-accent-soft) shadow-[0_6px_18px_-10px_rgba(37,99,235,0.6)] ring-1 ring-(--s-accent)"
                : "border-(--s-line) bg-(--s-surface)"
            }`}
          >
            <OptionName b={b} m={m} />
            <div className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-1">
              <span className="text-[15px] font-bold leading-none">{rs(b.total)}</span>
              {!b.isCart && <DiffChip diff={b.total - sum.cartTotal} />}
            </div>
            {b.isCart ? (
              <span className="mt-2 inline-flex h-7 items-center justify-center gap-1 rounded-md bg-(--s-accent) text-[11px] font-bold text-(--s-accent-ink)">
                <Check className="h-3.5 w-3.5" /> Selected · in your cart
              </span>
            ) : (
              <button
                onClick={() => onSwitch(b.name)}
                title={`Switch to ${b.name}`}
                className="mt-2 h-7 truncate rounded-md bg-(--s-btn) px-2 text-[11px] font-semibold text-(--s-btn-ink) transition hover:bg-(--s-accent) hover:text-(--s-accent-ink)"
              >
                Switch to {b.name}
              </button>
            )}
          </div>
        ))}
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
              {tableBrands.map((b) => (
                <th key={b.name} className="w-[190px] px-5 py-3.5 text-right">
                  {b.maker !== b.name && <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{b.maker}</div>}
                  <div className="text-[15px] font-bold">{b.name}</div>
                  <div className="text-[11px] font-medium text-slate-400">
                    {b.covered} of {itemsWord(m)}
                  </div>
                </th>
              ))}
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
                        <div className="mt-0.5 flex items-center justify-end gap-1.5 text-[11px] text-(--s-muted)">
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
                <div className="text-[11px] text-(--s-muted)">{m === 1 ? "This item" : `These ${itemsWord(m)}`}</div>
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

/** Avatar letter + option name (+ main brand when it is a range, e.g. "Orange · Akoya Black"). */
function OptionName({ b, m }: { b: BrandSum; m: number }) {
  return (
    <div className="min-w-0">
      {b.maker !== b.name && <div className="truncate text-[10px] font-bold uppercase tracking-wider text-(--s-muted)">{b.maker}</div>}
      <div className="truncate text-sm font-extrabold leading-tight" title={b.name}>{b.name}</div>
      <div className="truncate text-[10px] text-(--s-muted)">
        {b.covered === m ? (m === 1 ? "Has this item" : `Has all ${itemsWord(m)}`) : `Has ${b.covered} of ${itemsWord(m)}`}
      </div>
    </div>
  );
}


/** "Save Rs 36" / "+Rs 36" / "Same as cart" compared with the cart. */
function DiffChip({ diff }: { diff: number }) {
  if (Math.round(diff) === 0)
    return <span className="rounded-full bg-(--s-soft) px-2 py-0.5 text-[10px] font-semibold text-(--s-muted)">Same as cart</span>;
  return diff < 0 ? (
    <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">Save {rs(-diff)}</span>
  ) : (
    <span className="rounded-full bg-(--s-soft) px-2 py-0.5 text-[10px] font-semibold text-(--s-ink-2)">+{rs(diff)}</span>
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
async function makePdf(rows: Row[], makers: string[], store: { name: string; phone: string; whatsapp: string }, customer: string) {
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
  doc.rect(0, 30, W, 1.2, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(19);
  doc.text(store.name || "BK Wiring", M, 14);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(147, 197, 253);
  doc.text(["bkwiringbadukade.lk", store.phone ? `Tel: ${store.phone}` : ""].filter(Boolean).join("   |   "), M, 21);
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
    margin: { left: M, right: M, bottom: 18 },
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
  if (y > H - 30) {
    doc.addPage();
    y = 18;
  }
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...MUTED);
  const notes = [
    "A brand's total adds only the items that brand has. Check \"Items this brand has\" before comparing totals.",
    "Where a brand has more than one range or colour, the cheapest one is shown (its name is under the price).",
    "Prices include taxes. Delivery is not included.",
  ];
  doc.text(notes, M, y);

  // ---- Footer on every page
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setDrawColor(...LINE);
    doc.line(M, H - 13, W - M, H - 13);
    doc.setFontSize(7.5);
    doc.setTextColor(...MUTED);
    doc.text(`Prices valid on ${today} and may change.  To order: bkwiringbadukade.lk${store.phone ? `  |  ${store.phone}` : ""}`, M, H - 8);
    doc.text(`Page ${p} of ${pages}`, W - M, H - 8, { align: "right" });
  }

  doc.save(`brand-comparison-${new Date().toISOString().slice(0, 10)}.pdf`);
}

/**
 * Invoice-style quotation PDF of the final list: only the items as they are in
 * the cart now (the brand / range the customer picked). Returns the PDF as a
 * Blob plus a file name, so it can be downloaded or shared.
 */
async function makeQuotationPdf(rows: Row[], store: { name: string; phone: string; whatsapp: string }, customer: string) {
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
  const MUTED: RGB = [100, 116, 139];
  const LINE: RGB = [226, 232, 240];
  const SOFT: RGB = [241, 245, 249];
  const BLUE: RGB = [37, 99, 235];
  const NAVY: RGB = [11, 17, 32];
  const GREEN_INK: RGB = [21, 128, 61];

  const items = rows
    .map((r) => ({ r, c: r.cells[r.cartBrand] }))
    .filter((x) => x.c?.available);
  const total = items.reduce((s, { r, c }) => s + c.price * r.qty, 0);
  const mrpTotal = items.reduce((s, { r, c }) => s + Math.max(c.mrp || 0, c.price) * r.qty, 0);
  const saving = Math.max(0, mrpTotal - total);

  // ---- Top: shop on the left, QUOTATION on the right
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, W, 6, "F");
  doc.setTextColor(...INK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text(store.name || "BK Wiring", M, 22);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  const shopLines = ["House wiring accessories", "bkwiringbadukade.lk"];
  if (store.phone) shopLines.push(`Tel: ${store.phone}`);
  if (store.whatsapp && store.whatsapp !== store.phone) shopLines.push(`WhatsApp: ${store.whatsapp}`);
  doc.text(shopLines, M, 28);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(24);
  doc.setTextColor(...BLUE);
  doc.text("QUOTATION", W - M, 22, { align: "right" });
  doc.setFontSize(9);
  doc.setTextColor(...INK);
  const meta: [string, string][] = [
    ["Ref:", ref],
    ["Date:", dateText],
  ];
  meta.forEach(([k, v], i) => {
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...MUTED);
    doc.text(k, W - M - 42, 29 + i * 5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...INK);
    doc.text(v, W - M, 29 + i * 5, { align: "right" });
  });

  let y = 29 + shopLines.length * 4 + 6;
  y = Math.max(y, 46);
  doc.setDrawColor(...LINE);
  doc.line(M, y, W - M, y);
  y += 7;

  // ---- Prepared for
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text("PREPARED FOR", M, y);
  doc.setFontSize(11);
  doc.setTextColor(...INK);
  doc.text(customer || "Customer", M, y + 5.5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  doc.text(`${itemsWord(items.length)} for house wiring`, M, y + 10.5);
  y += 17;

  // ---- Items table
  autoTable(doc, {
    theme: "plain",
    margin: { left: M, right: M, bottom: 20 },
    startY: y,
    head: [["#", "Description", "Qty", "Unit price", "Amount"]],
    body: items.map(({ r, c }, i) => {
      return [String(i + 1), c.name, String(r.qty), rs(c.price), rs(c.price * r.qty)];
    }),
    styles: { font: "helvetica", fontSize: 9, cellPadding: { top: 3, bottom: 3, left: 2.5, right: 2.5 }, textColor: INK, valign: "middle", lineColor: LINE },
    headStyles: { fillColor: NAVY, textColor: 255, fontStyle: "bold", fontSize: 9 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 9, halign: "center" },
      2: { cellWidth: 14, halign: "center" },
      3: { cellWidth: 28, halign: "right" },
      4: { cellWidth: 30, halign: "right", fontStyle: "bold" },
    },
    didParseCell: (h) => {
      if (h.section === "head" && h.column.index >= 3) h.cell.styles.halign = "right";
      if (h.section === "head" && (h.column.index === 0 || h.column.index === 2)) h.cell.styles.halign = "center";
      if (h.section === "body") {
        h.cell.styles.lineWidth = { bottom: 0.2, top: 0, left: 0, right: 0 };
      }
    },
  });
  y = ((doc as any).lastAutoTable?.finalY ?? y) + 6;

  // ---- Totals box (right)
  if (y > H - 60) {
    doc.addPage();
    y = 20;
  }
  const bx = W - M - 80;
  // Invoice maths: MRP value − discount = total (when there is a discount).
  const rowsT: [string, string][] = saving > 0 ? [["MRP value", rs(mrpTotal)], ["Your discount", `- ${rs(saving)}`]] : [["Subtotal", rs(total)]];
  rowsT.push(["Delivery", "Not included"]);
  doc.setFontSize(9.5);
  rowsT.forEach(([k, v], i) => {
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...(k === "Your discount" ? GREEN_INK : MUTED));
    doc.text(k, bx + 3, y + 5 + i * 6);
    doc.setTextColor(...(k === "Your discount" ? GREEN_INK : INK));
    doc.text(v, W - M - 3, y + 5 + i * 6, { align: "right" });
  });
  const ty = y + 5 + rowsT.length * 6;
  doc.setFillColor(...BLUE);
  doc.roundedRect(bx, ty - 1, 80, 11, 1.5, 1.5, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(255, 255, 255);
  doc.text("TOTAL", bx + 3, ty + 6.3);
  doc.text(rs(total), W - M - 3, ty + 6.3, { align: "right" });

  // ---- Notes (left of totals)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...INK);
  doc.text("Notes", M, y + 5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...MUTED);
  const notes = doc.splitTextToSize(
    [
      "Prices include taxes.",
      `Prices as on ${dateText}. They can change and items are subject to stock.`,
      "Delivery charges are not included.",
      `To order, visit bkwiringbadukade.lk${store.phone ? ` or call ${store.phone}` : ""} and quote ${ref}.`,
    ].join("\n"),
    bx - M - 8,
  );
  doc.text(notes, M, y + 10);

  // ---- Footer on every page
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setDrawColor(...LINE);
    doc.line(M, H - 14, W - M, H - 14);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...MUTED);
    doc.text(`${store.name || "BK Wiring"}  |  bkwiringbadukade.lk${store.phone ? `  |  ${store.phone}` : ""}  |  Thank you for your interest.`, M, H - 9);
    doc.text(`${ref}  |  Page ${p} of ${pages}`, W - M, H - 9, { align: "right" });
  }

  const fileName = `quotation-${ref}.pdf`;
  return { blob: doc.output("blob") as Blob, fileName, ref, total, count: items.length };
}
