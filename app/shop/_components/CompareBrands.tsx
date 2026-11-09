"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, Check, ChevronDown, Download, Loader2, ShoppingBag, Sparkles, Trophy } from "lucide-react";
import { useShop } from "./ShopContext";
import { rs } from "./format";

type Cell = { id: string; name: string; price: number; mrp: number; available: boolean };
type Row = { cartId: string; label: string; image: string | null; qty: number; cartBrand: string; cells: Record<string, Cell> };
type Table = { brands: string[]; rows: Row[] };

type BrandSum = {
  name: string;
  /** Whole list: this brand where it has the item, the cart's choice for the rest. */
  total: number;
  /** Comparable items this brand has. */
  covered: number;
  /** Every item in the cart already uses this brand's version. */
  isCart: boolean;
};
type Summary = {
  /** Items found in two or more brands → one column per brand. */
  compRows: Row[];
  /** Items in one brand only → same price in every option. */
  fixedRows: Row[];
  fixedTotal: number;
  brands: BrandSum[];
  bestTotal: number;
  cartTotal: number;
  winner: string | null;
  bestOf: (r: Row) => [string, Cell] | undefined;
};

const BEST = "Best price mix";
const available = (c?: Cell) => (c && c.available ? c : undefined);
const cartPrice = (r: Row) => available(r.cells[r.cartBrand])?.price ?? 0;
const bestOf = (r: Row) =>
  Object.entries(r.cells)
    .filter(([, c]) => c.available)
    .sort((a, b) => a[1].price - b[1].price)[0];

function summarise(data: Table): Summary {
  const compRows = data.rows.filter((r) => Object.keys(r.cells).length > 1);
  const fixedRows = data.rows.filter((r) => Object.keys(r.cells).length <= 1);
  const fixedTotal = fixedRows.reduce((s, r) => s + cartPrice(r) * r.qty, 0);
  const names = data.brands.filter((b) => compRows.some((r) => r.cells[b]));
  const brands: BrandSum[] = names.map((b) => ({
    name: b,
    total: fixedTotal + compRows.reduce((s, r) => s + (available(r.cells[b])?.price ?? cartPrice(r)) * r.qty, 0),
    covered: compRows.filter((r) => available(r.cells[b])).length,
    isCart: compRows.every((r) => !available(r.cells[b]) || r.cartBrand === b),
  }));
  // Cheapest whole-list total first (every total covers all items, so they compare fairly).
  brands.sort((a, b) => a.total - b.total || b.covered - a.covered);
  const bestTotal = fixedTotal + compRows.reduce((s, r) => s + (bestOf(r)?.[1].price ?? cartPrice(r)) * r.qty, 0);
  const cartTotal = fixedTotal + compRows.reduce((s, r) => s + cartPrice(r) * r.qty, 0);
  const winner = brands.length > 1 ? brands[0].name : null;
  return { compRows, fixedRows, fixedTotal, brands, bestTotal, cartTotal, winner, bestOf };
}

/**
 * The customer's list priced in each brand: items as rows, brands as columns,
 * a total for the whole list under each brand. They can switch the cart to a
 * brand in one click or download the table as a PDF.
 */
export function CompareBrands() {
  const { cart, ready, href, replaceMany, store } = useShop();
  const [data, setData] = useState<Table | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);
  /** Brands chosen for the table (null = our default pick). */
  const [picked, setPicked] = useState<string[] | null>(null);
  const [showAll, setShowAll] = useState(false);

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

  const sum = useMemo(() => (data ? summarise(data) : null), [data]);

  /** Switch every item this brand has (or the cheapest brand for each item). */
  const switchTo = (brand: string) => {
    if (!sum) return;
    const pairs: [string, string][] = [];
    for (const r of sum.compRows) {
      const target = brand === BEST ? bestOf(r)?.[1] : r.cells[brand];
      if (target?.available && target.id !== r.cartId) pairs.push([r.cartId, target.id]);
    }
    if (!pairs.length) return toast.info("Your cart already uses these items");
    replaceMany(pairs);
    toast.success(brand === BEST ? "Cart switched to the best price for each item" : `Cart switched to ${brand}`, {
      description: `${pairs.length} ${pairs.length === 1 ? "item" : "items"} changed`,
    });
  };

  const downloadPdf = async () => {
    if (!sum) return;
    setPdfBusy(true);
    try {
      await makePdf(sum, store, tableBrands.map((b) => b.name));
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
  const brands = sum?.brands || [];
  const c = sum?.compRows.length || 0;
  const winner = brands.find((b) => b.name === sum?.winner);
  const saveMax = sum ? Math.max(0, sum.cartTotal - Math.min(sum.bestTotal, winner?.total ?? Infinity)) : 0;
  const itemsWord = (k: number) => `${k} ${k === 1 ? "item" : "items"}`;

  // Many brands (8–9): top 3 as big cards, the rest in a short ranked list,
  // and the table shows up to MAX_COLS brands the customer picks.
  const MAX_COLS = 4;
  const cartCount = new Map<string, number>();
  sum?.compRows.forEach((r) => cartCount.set(r.cartBrand, (cartCount.get(r.cartBrand) || 0) + 1));
  const cartBrand = [...cartCount.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  const defaultPick = [...new Set([brands[0]?.name, cartBrand, ...brands.map((b) => b.name)].filter(Boolean) as string[])].slice(0, MAX_COLS);
  const shown = (picked ?? defaultPick).filter((nm) => brands.some((b) => b.name === nm));
  const tableBrands = brands.filter((b) => shown.includes(b.name));
  const cols = Math.max(tableBrands.length, 1);
  const togglePick = (nm: string) => {
    if (shown.includes(nm)) {
      if (shown.length > 1) setPicked(shown.filter((x) => x !== nm));
    } else if (shown.length < MAX_COLS) setPicked([...shown, nm]);
    else toast.info(`You can compare up to ${MAX_COLS} brands at a time`, { description: "Untick a brand first, then pick another." });
  };
  const many = brands.length > 4;
  const cardBrands = many ? brands.slice(0, 3) : brands;
  const restBrands = many ? brands.slice(3) : [];

  return (
    <div className="mx-auto max-w-[1800px] px-4 py-8 md:px-6 xl:px-10">
      {/* Title row */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href={href("/cart")} className="inline-flex items-center gap-1.5 text-sm font-semibold text-(--s-ink-2) hover:text-(--s-ink)">
            <ArrowLeft className="h-4 w-4" /> Back to cart
          </Link>
          <h1 className="mt-2 text-2xl font-bold md:text-[30px]">Compare brands</h1>
          <p className="mt-1 max-w-2xl text-sm text-(--s-ink-2)">
            Your list of {itemsWord(n)}, priced in each brand. Choose a total that suits your budget — the cart changes in one click.
          </p>
        </div>
        <button
          onClick={downloadPdf}
          disabled={pdfBusy || !n}
          className="inline-flex items-center gap-2 rounded-full bg-(--s-accent) px-6 py-3 text-sm font-bold text-(--s-accent-ink) shadow-[0_6px_18px_-6px_rgba(37,99,235,0.6)] transition hover:bg-(--s-accent-hover) disabled:opacity-50"
        >
          {pdfBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Download PDF
        </button>
      </div>

      {error && <div className="mt-4 rounded-lg border border-(--s-bad) px-4 py-3 text-sm text-(--s-bad)">{error}</div>}

      {/* Summary bar */}
      {sum && (
        <div className="mt-6 grid overflow-hidden rounded-2xl border border-(--s-line) bg-(--s-surface) sm:grid-cols-3">
          <Stat label="Your cart now" value={rs(sum.cartTotal)} note={itemsWord(n)} />
          <Stat
            label="Lowest total"
            value={rs(Math.min(sum.bestTotal, winner?.total ?? sum.cartTotal))}
            note={brands.length > 1 ? (winner && winner.total <= sum.bestTotal ? winner.name : BEST) : "Only one brand found"}
          />
          <Stat
            label="You can save"
            value={saveMax > 0 ? rs(saveMax) : "Rs 0"}
            note={saveMax > 0 ? "by switching brands" : "Your cart already has the lowest prices"}
            good={saveMax > 0}
          />
        </div>
      )}

      {sum && !c && (
        <div className="mt-5 rounded-xl border border-(--s-line) bg-(--s-soft) px-4 py-3 text-sm text-(--s-ink-2)">
          We could not find these items in other brands yet. You can still download your list as a PDF.
        </div>
      )}

      {/* Options: one card per brand + best mix */}
      {sum && brands.length > 0 && (
        <>
          <h2 className="mt-8 text-sm font-bold uppercase tracking-wide text-(--s-muted)">Choose an option</h2>
          <div className="mt-3 grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(250px,1fr))]">
            {cardBrands.map((b) => {
              const win = b.name === sum.winner;
              const diff = b.total - sum.cartTotal;
              return (
                <div
                  key={b.name}
                  className={`relative flex flex-col rounded-2xl border bg-(--s-surface) p-5 transition ${
                    win ? "border-emerald-500 shadow-[0_10px_30px_-14px_rgba(16,185,129,0.55)] ring-1 ring-emerald-500/40" : "border-(--s-line)"
                  }`}
                >
                  {win && (
                    <span className="absolute -top-3 left-5 inline-flex items-center gap-1 rounded-full bg-emerald-600 px-3 py-1 text-[11px] font-bold text-white shadow">
                      <Trophy className="h-3.5 w-3.5" /> Cheapest brand
                    </span>
                  )}
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-(--s-soft) text-base font-black text-(--s-ink) ring-1 ring-(--s-line)">
                      {b.name.charAt(0).toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <div className="truncate text-lg font-extrabold leading-tight">{b.name}</div>
                      <div className="text-xs text-(--s-muted)">{b.covered === c ? `${b.name} for every compared item` : `${b.name} for ${b.covered} of ${itemsWord(c)}`}</div>
                    </div>
                  </div>
                  <div className="mt-4 flex items-end justify-between gap-2">
                    <div>
                      <div className="text-[26px] font-bold leading-none">{rs(b.total)}</div>
                      <div className="mt-1 text-xs text-(--s-muted)">for all {itemsWord(n)}</div>
                    </div>
                    <DiffChip diff={diff} />
                  </div>
                  {b.isCart ? (
                    <span className="mt-4 inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-(--s-soft) text-[13px] font-semibold text-(--s-ink-2)">
                      <Check className="h-4 w-4 text-emerald-600" /> In your cart now
                    </span>
                  ) : (
                    <button
                      onClick={() => switchTo(b.name)}
                      className={`mt-4 h-10 rounded-xl text-[13px] font-semibold transition ${
                        win ? "bg-emerald-600 text-white hover:bg-emerald-700" : "bg-(--s-btn) text-(--s-btn-ink) hover:bg-(--s-accent) hover:text-(--s-accent-ink)"
                      }`}
                    >
                      Switch cart to {b.name}
                    </button>
                  )}
                </div>
              );
            })}
            {brands.length > 1 && (
              <div className="flex flex-col rounded-2xl border border-dashed border-(--s-accent) bg-(--s-accent-soft) p-5">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-(--s-accent) text-(--s-accent-ink)">
                    <Sparkles className="h-5 w-5" />
                  </span>
                  <div>
                    <div className="text-lg font-extrabold leading-tight">{BEST}</div>
                    <div className="text-xs text-(--s-muted)">Cheapest brand for each item</div>
                  </div>
                </div>
                <div className="mt-4 flex items-end justify-between gap-2">
                  <div>
                    <div className="text-[26px] font-bold leading-none">{rs(sum.bestTotal)}</div>
                    <div className="mt-1 text-xs text-(--s-muted)">for all {itemsWord(n)}</div>
                  </div>
                  <DiffChip diff={sum.bestTotal - sum.cartTotal} />
                </div>
                <button
                  onClick={() => switchTo(BEST)}
                  className="mt-4 h-10 rounded-xl bg-(--s-accent) text-[13px] font-semibold text-(--s-accent-ink) transition hover:bg-(--s-accent-hover)"
                >
                  Use best prices
                </button>
              </div>
            )}
          </div>
          {restBrands.length > 0 && (
            <div className="mt-3 overflow-hidden rounded-2xl border border-(--s-line) bg-(--s-surface)">
              <button onClick={() => setShowAll((o) => !o)} className="flex w-full items-center justify-between gap-3 px-5 py-3.5 text-left text-sm font-semibold">
                <span>
                  {showAll ? "Hide" : "Show"} {restBrands.length} more {restBrands.length === 1 ? "brand" : "brands"}
                  <span className="ml-1.5 font-normal text-(--s-muted)">· from {rs(restBrands[0].total)}</span>
                </span>
                <ChevronDown className={`h-4 w-4 shrink-0 transition ${showAll ? "rotate-180" : ""}`} />
              </button>
              {showAll &&
                restBrands.map((b, i) => (
                  <div key={b.name} className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-(--s-line) px-5 py-3">
                    <span className="w-7 text-sm font-bold text-(--s-muted)">#{i + 4}</span>
                    <span className="min-w-[140px] flex-1">
                      <span className="font-bold">{b.name}</span>
                      <span className="ml-2 text-xs text-(--s-muted)">{b.covered} of {itemsWord(c)}</span>
                    </span>
                    <span className="font-bold">{rs(b.total)}</span>
                    <DiffChip diff={b.total - sum.cartTotal} />
                    {b.isCart ? (
                      <span className="w-[170px] text-center text-xs font-semibold text-(--s-muted)">In your cart now</span>
                    ) : (
                      <button
                        onClick={() => switchTo(b.name)}
                        className="h-9 w-[170px] rounded-xl border border-(--s-line) text-xs font-semibold transition hover:border-(--s-btn) hover:bg-(--s-btn) hover:text-(--s-btn-ink)"
                      >
                        Switch cart to {b.name}
                      </button>
                    )}
                  </div>
                ))}
            </div>
          )}
        </>
      )}

      {/* Price table */}
      {sum && (
        <>
          <h2 className="mt-8 text-sm font-bold uppercase tracking-wide text-(--s-muted)">Price of each item</h2>
          {brands.length > 2 && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="mr-1 text-xs font-semibold text-(--s-ink-2)">
                Brands in the table{brands.length > MAX_COLS ? ` (pick up to ${MAX_COLS})` : ""}:
              </span>
              {brands.map((b) => {
                const on = shown.includes(b.name);
                return (
                  <button
                    key={b.name}
                    onClick={() => togglePick(b.name)}
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
          <div className="mt-3 overflow-x-auto rounded-2xl border border-(--s-line) bg-(--s-surface) shadow-[0_8px_30px_-18px_rgba(15,23,42,0.25)]">
            <table className="w-full min-w-[640px] border-collapse text-sm [&_td:not(:first-child)]:whitespace-nowrap [&_th:not(:first-child)]:whitespace-nowrap">
              <thead>
                <tr className="bg-(--s-bar) text-white">
                  <th className="sticky left-0 z-10 bg-(--s-bar) px-5 py-3.5 text-left font-semibold">Item</th>
                  <th className="w-16 px-3 py-3.5 text-center font-semibold">Qty</th>
                  {tableBrands.length ? (
                    tableBrands.map((b) => (
                      <th key={b.name} className="w-[200px] px-5 py-3.5 text-right">
                        <div className="text-[15px] font-bold">{b.name}</div>
                        <div className="text-[11px] font-medium text-slate-400">{b.covered} of {itemsWord(c)}</div>
                      </th>
                    ))
                  ) : (
                    <th className="w-[200px] px-5 py-3.5 text-right font-semibold">Price</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {sum.compRows.map((r) => {
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
                              {cell ? "Out of stock" : "Not in this brand"}
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
                              {r.cartBrand === b.name && (
                                <span className="rounded bg-(--s-accent-soft) px-1.5 py-px font-semibold text-(--s-accent)">in cart</span>
                              )}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}

                {sum.fixedRows.length > 0 && (
                  <>
                    {c > 0 && (
                      <tr className="border-b border-(--s-line) bg-(--s-soft)">
                        <td colSpan={2 + cols} className="px-5 py-2 text-[11px] font-bold uppercase tracking-wide text-(--s-muted)">
                          Only one brand sells these — same price in every option
                        </td>
                      </tr>
                    )}
                    {sum.fixedRows.map((r) => {
                      const cell = r.cells[r.cartBrand];
                      return (
                        <tr key={r.cartId} className="border-b border-(--s-line)">
                          <ItemCell r={r} brand={r.cartBrand} />
                          <td className="px-3 py-3 text-center font-semibold">{r.qty}</td>
                          {Array.from({ length: cols }, (_, i) => (
                            <td key={i} className="px-5 py-3 text-right text-(--s-ink-2)">
                              {cell?.available ? (
                                <>
                                  <div className="font-semibold">{rs(cell.price * r.qty)}</div>
                                  {r.qty > 1 && <div className="text-[11px] text-(--s-muted)">{rs(cell.price)} each</div>}
                                </>
                              ) : (
                                <span className="text-xs text-(--s-muted)">Out of stock</span>
                              )}
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </>
                )}
              </tbody>
              <tfoot>
                <tr className="bg-(--s-soft)">
                  <td className="sticky left-0 z-10 bg-(--s-soft) px-5 py-4">
                    <div className="text-base font-extrabold">Total</div>
                    <div className="text-[11px] text-(--s-muted)">All {itemsWord(n)}</div>
                  </td>
                  <td />
                  {tableBrands.length ? (
                    tableBrands.map((b) => (
                      <td key={b.name} className={`px-5 py-4 text-right ${b.name === sum.winner ? "bg-emerald-600 text-white" : ""}`}>
                        <div className="text-lg font-extrabold">{rs(b.total)}</div>
                        {b.name === sum.winner ? (
                          <div className="text-[11px] font-semibold">Cheapest brand</div>
                        ) : (
                          b.total !== winner?.total && winner && <div className="text-[11px] text-(--s-muted)">+{rs(b.total - winner.total)}</div>
                        )}
                      </td>
                    ))
                  ) : (
                    <td className="px-5 py-4 text-right text-lg font-extrabold">{rs(sum.cartTotal)}</td>
                  )}
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}

      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-(--s-muted)">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-sm bg-emerald-500/25 ring-1 ring-emerald-500/40" /> Lowest price for that item
        </span>
        <span>Where a brand does not have an item, its total uses the item in your cart.</span>
        <span>Prices include taxes. Delivery not included. Prices are for today.</span>
      </div>
    </div>
  );
}

function Stat({ label, value, note, good }: { label: string; value: string; note: string; good?: boolean }) {
  return (
    <div className="border-b border-(--s-line) px-5 py-4 last:border-0 sm:border-b-0 sm:border-r sm:last:border-r-0">
      <div className="text-xs font-semibold text-(--s-muted)">{label}</div>
      <div className={`mt-1 text-2xl font-bold ${good ? "text-emerald-600 dark:text-emerald-400" : ""}`}>{value}</div>
      <div className="mt-0.5 truncate text-xs text-(--s-ink-2)">{note}</div>
    </div>
  );
}

/** "Save Rs 36" / "+Rs 36" / "Same as cart" compared with the cart total. */
function DiffChip({ diff }: { diff: number }) {
  if (Math.round(diff) === 0)
    return <span className="rounded-full bg-(--s-soft) px-2.5 py-1 text-[11px] font-semibold text-(--s-muted)">Same as cart</span>;
  return diff < 0 ? (
    <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-300">Save {rs(-diff)}</span>
  ) : (
    <span className="rounded-full bg-(--s-soft) px-2.5 py-1 text-[11px] font-semibold text-(--s-ink-2)">+{rs(diff)}</span>
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
          {brand && <span className="text-xs text-(--s-muted)">{brand} only</span>}
        </span>
      </div>
    </td>
  );
}

/** A4 PDF of the same table, made in the browser. */
async function makePdf(sum: Summary, store: { name: string; phone: string; whatsapp: string }, only?: string[]) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const brands = only?.length ? sum.brands.filter((b) => only.includes(b.name)) : sum.brands;
  const cols = Math.max(brands.length, 1);
  const n = sum.compRows.length + sum.fixedRows.length;
  const doc = new jsPDF({ orientation: brands.length > 3 ? "landscape" : "portrait", unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const today = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

  // Header band
  doc.setFillColor(11, 17, 32);
  doc.rect(0, 0, W, 28, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(store.name || "BK Wiring", 14, 13);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(147, 197, 253);
  doc.text(["bkwiringbadukade.lk", store.phone ? `Tel: ${store.phone}` : ""].filter(Boolean).join("   |   "), 14, 20);
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("Brand Price Comparison", W - 14, 13, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(today, W - 14, 20, { align: "right" });

  // Summary
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(10);
  const lines = [`${n} ${n === 1 ? "item" : "items"}. Each total below is for the whole list.`];
  if (sum.winner) lines.push(`Lowest total: ${sum.winner} - ${rs(sum.brands.find((b) => b.name === sum.winner)?.total ?? 0)}`);
  if (sum.brands.length > 1) lines.push(`Best price mix (cheapest brand for each item): ${rs(sum.bestTotal)}`);
  if (brands.length < sum.brands.length)
    lines.push(`Other brands: ${sum.brands.filter((b) => !brands.includes(b)).map((b) => `${b.name} ${rs(b.total)}`).join(", ")}`);
  doc.text(lines, 14, 37);

  const priceText = (c: Cell | undefined, qty: number) =>
    !c ? "-" : !c.available ? "Out of stock" : qty > 1 ? `${rs(c.price * qty)}\n${rs(c.price)} each` : rs(c.price);

  const body: any[] = sum.compRows.map((r, i) => [String(i + 1), r.label, String(r.qty), ...brands.map((b) => priceText(r.cells[b.name], r.qty))]);
  if (sum.fixedRows.length) {
    if (sum.compRows.length)
      body.push([
        {
          content: "Only one brand available - same price in every total",
          colSpan: 3 + cols,
          styles: { fillColor: [241, 245, 249], textColor: [100, 116, 139], fontStyle: "bold", fontSize: 8 },
        },
      ]);
    sum.fixedRows.forEach((r, i) =>
      body.push([
        String(sum.compRows.length + i + 1),
        `${r.label} (${r.cartBrand})`,
        String(r.qty),
        { content: priceText(r.cells[r.cartBrand], r.qty), colSpan: cols, styles: { halign: "right" } },
      ]),
    );
  }
  const foot = [["", "TOTAL (all items)", "", ...(brands.length ? brands.map((b) => rs(b.total)) : [rs(sum.cartTotal)])]];

  autoTable(doc, {
    head: [["#", "Item", "Qty", ...(brands.length ? brands.map((b) => b.name) : ["Price"])]],
    body,
    foot,
    startY: 37 + lines.length * 5 + 3,
    theme: "grid",
    styles: { font: "helvetica", fontSize: 9, cellPadding: 2.5, lineColor: [226, 232, 240], lineWidth: 0.2, textColor: [15, 23, 42], valign: "middle" },
    headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: "bold", fontSize: 10 },
    footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: "bold", fontSize: 10 },
    columnStyles: {
      0: { cellWidth: 8, halign: "center" },
      2: { cellWidth: 12, halign: "center" },
      ...Object.fromEntries(Array.from({ length: cols }, (_, i) => [i + 3, { halign: "right" as const, cellWidth: 32 }])),
    },
    didParseCell: (h) => {
      if (h.column.index < 3) return;
      const brand = brands[h.column.index - 3]?.name;
      if (h.section === "head") h.cell.styles.halign = "right";
      if (h.section === "body" && h.row.index < sum.compRows.length && brand && bestOf(sum.compRows[h.row.index])?.[0] === brand) {
        h.cell.styles.fillColor = [220, 252, 231];
        h.cell.styles.textColor = [21, 128, 61];
        h.cell.styles.fontStyle = "bold";
      }
      if (h.section === "foot" && brand && brand === sum.winner) {
        h.cell.styles.fillColor = [22, 163, 74];
        h.cell.styles.textColor = 255;
      }
    },
  });

  const y = ((doc as any).lastAutoTable?.finalY ?? 60) + 7;
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text(
    [
      "Green = lowest price for that item.  \"-\" = this brand does not have the item; its total then uses the item in your cart.",
      "Prices include taxes. Delivery is not included. Prices are valid on the date above and may change.",
      `To order, visit bkwiringbadukade.lk${store.phone ? ` or call ${store.phone}` : ""}.`,
    ],
    14,
    y,
  );

  doc.save(`brand-comparison-${new Date().toISOString().slice(0, 10)}.pdf`);
}
