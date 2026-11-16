"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { ArrowLeftRight, ArrowRight, ChevronDown, Layers, Table2, X } from "lucide-react";
import { rs } from "./format";

/** The same item from another brand (from /api/storefront/cart `others`). */
export type CompareOther = {
  id: string;
  slug: string;
  name: string;
  /** Option name, e.g. "Sierra" or "Akoya Black". */
  brand: string;
  image: string | null;
  mrp: number;
  price: number;
  discountPct: number;
  available: boolean;
};

/** What the compare panel needs from a cart / list line. */
export type CompareLine = {
  id: string;
  name?: string;
  brand: string | null;
  price: number;
  qty: number;
  others: CompareOther[];
  /** This item's option, e.g. "Akoya Black" (from the cart API). */
  option?: string | null;
  /** Type of item, e.g. "Switches & Sockets" (from the cart API). */
  group?: string | null;
};

export type SwitchPair = [fromId: string, toId: string];

/** One item that would change: the cart line and its version in the target range. */
type Change = { from: CompareLine; to: CompareOther };

/**
 * Items of the same type that can move to `target` (this line first), so a
 * customer's switches & sockets (or wires) can all stay in one brand / range / colour.
 * Items the target range does not have are left out (they keep their current choice).
 */
export function rangeSwitchChanges(line: CompareLine, lines: CompareLine[], target: string): Change[] {
  const same = line.group ? lines.filter((l) => l.group === line.group && l.id !== line.id) : [];
  const out: Change[] = [];
  for (const l of [line, ...same]) {
    if (l.option && l.option === target) continue;
    const o = l.others.find((x) => x.brand === target && x.available);
    if (o && o.id !== l.id) out.push({ from: l, to: o });
  }
  return out;
}

const pairsOf = (changes: Change[]): SwitchPair[] => changes.map((c) => [c.from.id, c.to.id]);
const costDiff = (changes: Change[]) => changes.reduce((s, c) => s + (c.to.price - c.from.price) * c.from.qty, 0);

/** "Compare other brands" under a cart line: same item from other brands, with a Switch button. */
export function BrandCompare({
  line,
  lines,
  onSwitch,
  href,
  where = "In your cart",
}: {
  line: CompareLine;
  /** Every line in the cart / list, so a switch can move all items of this type together. */
  lines: CompareLine[];
  onSwitch: (pairs: SwitchPair[], option: string) => void;
  href: (p: string) => string;
  /** Label for the current item's row, e.g. "In your cart" / "In your list". */
  where?: string;
}) {
  const [open, setOpen] = useState(false);
  /** Switch waiting for the customer to choose "all matching" or "only this item". */
  const [ask, setAsk] = useState<{ option: string; changes: Change[] } | null>(null);
  const qty = line.qty;
  const cheapest = line.others.filter((o) => o.available).sort((a, b) => a.price - b.price)[0];
  const saving = cheapest && cheapest.price < line.price ? (line.price - cheapest.price) * qty : 0;

  // Same type of item in this list (only ones that can be compared), and the ranges they use now.
  const siblings = line.group ? lines.filter((l) => l.group === line.group && (l.others.length > 0 || l.id === line.id)) : [line];
  const ranges = [...new Set(siblings.map((l) => l.option).filter((x): x is string => Boolean(x)))];
  const mixed = ranges.length > 1;

  const doSwitch = (changes: Change[], option: string) => {
    onSwitch(pairsOf(changes), option);
    setAsk(null);
    toast.success(`Switched to ${option}`, {
      description: changes.length > 1 ? `${changes.length} ${line.group || "items"} changed so they all match` : changes[0]?.to.name,
    });
  };

  const startSwitch = (o: CompareOther) => {
    const changes = rangeSwitchChanges(line, lines, o.brand);
    if (!changes.length) return;
    // Other items of the same type would change too → ask first. Otherwise just switch.
    if (changes.length > 1) setAsk({ option: o.brand, changes });
    else doSwitch(changes, o.brand);
  };

  return (
    <div className="basis-full border-t border-(--s-line) pt-2.5">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full flex-wrap items-center gap-2 text-left text-[14px] font-semibold text-(--s-accent)">
        <ArrowLeftRight className="h-4 w-4" />
        Compare {line.others.length} other {line.others.length === 1 ? "brand" : "brands"}
        {saving > 0 && <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[12.5px] font-bold text-emerald-700 dark:text-emerald-300">save up to {rs(saving)}</span>}
        {mixed && <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[12.5px] font-bold text-amber-700 dark:text-amber-300">mixed ranges</span>}
        <ChevronDown className={`ml-auto h-4 w-4 transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="mt-2 overflow-hidden rounded-xl border border-(--s-line)">
          {mixed && (
            <div className="flex items-start gap-2 bg-amber-500/10 px-3 py-2 text-[13px] text-amber-800 dark:text-amber-200">
              <Layers className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                Your {line.group || "items"} are in {ranges.length} ranges ({ranges.join(", ")}). Pick one below to make them all match.
              </span>
            </div>
          )}
          <div className="flex items-center gap-3 bg-(--s-soft) px-3 py-2 text-[14px]">
            <span className="w-24 shrink-0 truncate font-bold">{line.option || line.brand || "This item"}</span>
            <span className="min-w-0 flex-1 truncate text-(--s-muted)">{where}</span>
            <span className="font-bold">{rs(line.price)}</span>
            <span className="w-[76px] shrink-0" />
          </div>
          {line.others.map((o) => {
            const diff = o.price - line.price;
            return (
              <div key={o.id} className="flex items-center gap-3 border-t border-(--s-line) px-3 py-2 text-[14px]">
                <span className="w-24 shrink-0 truncate font-bold" title={o.brand}>
                  {o.brand}
                </span>
                <a href={href(`/p/${o.slug}`)} className="min-w-0 flex-1 truncate text-(--s-ink-2) hover:underline" title={o.name}>
                  {o.name}
                </a>
                <span className="text-right">
                  <span className="block font-bold">{rs(o.price)}</span>
                  {diff !== 0 && (
                    <span className={`block text-[12.5px] font-semibold ${diff < 0 ? "text-emerald-600 dark:text-emerald-400" : "text-(--s-muted)"}`}>
                      {diff < 0 ? `${rs(-diff)} less` : `${rs(diff)} more`}
                    </span>
                  )}
                </span>
                {o.available ? (
                  <button
                    onClick={() => startSwitch(o)}
                    className="w-[76px] shrink-0 rounded-full border border-(--s-line) py-1.5 text-xs font-bold hover:border-(--s-accent) hover:bg-(--s-accent) hover:text-(--s-accent-ink)"
                  >
                    Switch
                  </button>
                ) : (
                  <span className="w-[76px] shrink-0 text-center text-[12.5px] text-(--s-muted)">Not available</span>
                )}
              </div>
            );
          })}
          <a
            href={href("/cart/compare")}
            className="flex items-center gap-2 border-t border-(--s-line) bg-(--s-soft) px-3 py-2 text-[13px] font-semibold text-(--s-accent) hover:underline"
          >
            <Table2 className="h-4 w-4 shrink-0" />
            Compare brands &amp; designs for your whole list →
          </a>
        </div>
      )}
      {ask && (
        <SwitchDialog
          line={line}
          option={ask.option}
          changes={ask.changes}
          group={line.group || "items"}
          compareHref={href("/cart/compare")}
          onAll={() => doSwitch(ask.changes, ask.option)}
          onOne={() => doSwitch(ask.changes.slice(0, 1), ask.option)}
          onClose={() => setAsk(null)}
        />
      )}
    </div>
  );
}

/** Asks: change all items of this type to the same range, or only this item? Shows the price difference of each. */
function SwitchDialog({
  line,
  option,
  changes,
  group,
  compareHref,
  onAll,
  onOne,
  onClose,
}: {
  line: CompareLine;
  option: string;
  changes: Change[];
  group: string;
  compareHref: string;
  onAll: () => void;
  onOne: () => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const allDiff = costDiff(changes);
  const oneDiff = costDiff(changes.slice(0, 1));
  const DiffText = ({ d }: { d: number }) =>
    d === 0 ? (
      <span className="text-(--s-muted)">same price</span>
    ) : (
      <span className={d < 0 ? "text-emerald-600 dark:text-emerald-400" : "text-(--s-bad)"}>{d < 0 ? `save ${rs(-d)}` : `+ ${rs(d)}`}</span>
    );

  return createPortal(
    <div className="fixed inset-0 z-100 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="switch-title"
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border border-(--s-line) bg-(--s-surface) text-(--s-ink) shadow-2xl sm:rounded-3xl"
      >
        <div className="flex items-start gap-3 border-b border-(--s-line) px-5 py-4">
          <div className="min-w-0 flex-1">
            <h2 id="switch-title" className="text-lg font-bold">
              Switch to {option}?
            </h2>
            <p className="mt-0.5 text-sm text-(--s-muted)">
              You have {changes.length} {group} that can change to {option}. Change them all so the design matches, or only this item?
            </p>
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded-full p-1.5 text-(--s-muted) hover:bg-(--s-soft)">
            <X className="h-5 w-5" />
          </button>
        </div>

        <ul className="min-h-0 flex-1 divide-y divide-(--s-line) overflow-y-auto px-5">
          {changes.map((c, i) => {
            const d = (c.to.price - c.from.price) * c.from.qty;
            return (
              <li key={c.from.id} className="py-3 text-sm">
                <div className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate font-semibold">
                    {c.from.name || c.from.option || "Item"}
                    {i === 0 && <span className="ml-1.5 rounded-full bg-(--s-accent-soft) px-1.5 py-0.5 text-[11px] font-bold text-(--s-accent)">this item</span>}
                  </span>
                  <span className="shrink-0 text-xs text-(--s-muted)">× {c.from.qty}</span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[13px]">
                  <span className="text-(--s-muted)">
                    {c.from.option || c.from.brand} {rs(c.from.price)}
                  </span>
                  <ArrowRight className="h-3.5 w-3.5 text-(--s-muted)" />
                  <span className="font-semibold">
                    {option} {rs(c.to.price)}
                  </span>
                  <span className="ml-auto font-semibold">
                    <DiffText d={d} />
                  </span>
                </div>
              </li>
            );
          })}
        </ul>

        <div className="space-y-2 border-t border-(--s-line) bg-(--s-soft) px-5 py-4">
          <button
            onClick={onAll}
            autoFocus
            className="flex w-full items-center justify-between gap-2 rounded-full bg-(--s-accent) px-5 py-3 text-sm font-bold text-(--s-accent-ink) hover:bg-(--s-accent-hover)"
          >
            <span>Change all {changes.length} to {option}</span>
            <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs">{allDiff === 0 ? "same price" : allDiff < 0 ? `save ${rs(-allDiff)}` : `+ ${rs(allDiff)}`}</span>
          </button>
          <button
            onClick={onOne}
            className="flex w-full items-center justify-between gap-2 rounded-full border border-(--s-line) bg-(--s-surface) px-5 py-3 text-sm font-bold hover:border-(--s-accent)"
          >
            <span className="truncate">Only this item</span>
            <span className="text-xs">
              <DiffText d={oneDiff} />
            </span>
          </button>
          <a href={compareHref} className="flex items-center justify-center gap-2 pt-1 text-sm font-semibold text-(--s-accent) hover:underline">
            <Table2 className="h-4 w-4" /> See all brands &amp; designs side by side, with prices →
          </a>
        </div>
      </div>
    </div>,
    // Inside the shop root so the shop colours (--s-*) apply; on <body> the dialog would be see-through.
    document.querySelector(".shop-root") ?? document.body,
  );
}
