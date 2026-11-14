"use client";

import { useState } from "react";
import { ArrowLeftRight, ChevronDown } from "lucide-react";
import { rs } from "./format";

/** The same item from another brand (from /api/storefront/cart `others`). */
export type CompareOther = {
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

/** What the compare panel needs from a cart / list line. */
export type CompareLine = { brand: string | null; price: number; others: CompareOther[] };

/** "Compare other brands" under a cart line: same item from other brands, with a Switch button. */
export function BrandCompare({
  line,
  qty,
  onSwitch,
  href,
  where = "In your cart",
}: {
  line: CompareLine;
  qty: number;
  onSwitch: (id: string) => void;
  href: (p: string) => string;
  /** Label for the current item's row, e.g. "In your cart" / "In your list". */
  where?: string;
}) {
  const [open, setOpen] = useState(false);
  const cheapest = line.others.filter((o) => o.available).sort((a, b) => a.price - b.price)[0];
  const saving = cheapest && cheapest.price < line.price ? (line.price - cheapest.price) * qty : 0;
  return (
    <div className="basis-full border-t border-(--s-line) pt-2.5">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-2 text-left text-[14px] font-semibold text-(--s-accent)">
        <ArrowLeftRight className="h-4 w-4" />
        Compare {line.others.length} other {line.others.length === 1 ? "brand" : "brands"}
        {saving > 0 && <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[12.5px] font-bold text-emerald-700 dark:text-emerald-300">save up to {rs(saving)}</span>}
        <ChevronDown className={`ml-auto h-4 w-4 transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="mt-2 overflow-hidden rounded-xl border border-(--s-line)">
          <div className="flex items-center gap-3 bg-(--s-soft) px-3 py-2 text-[14px]">
            <span className="w-24 shrink-0 truncate font-bold">{line.brand || "This item"}</span>
            <span className="min-w-0 flex-1 truncate text-(--s-muted)">{where}</span>
            <span className="font-bold">{rs(line.price)}</span>
            <span className="w-[76px] shrink-0" />
          </div>
          {line.others.map((o) => {
            const diff = o.price - line.price;
            return (
              <div key={o.id} className="flex items-center gap-3 border-t border-(--s-line) px-3 py-2 text-[14px]">
                <span className="w-24 shrink-0 truncate font-bold">{o.brand}</span>
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
                    onClick={() => onSwitch(o.id)}
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
        </div>
      )}
    </div>
  );
}
