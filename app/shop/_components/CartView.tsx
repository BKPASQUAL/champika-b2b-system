"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeftRight, ChevronDown, Table2, ImageOff, Loader2, Lock, MessageCircle, Minus, Phone, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { useShop } from "./ShopContext";
import { QuoteFromCart } from "./QuoteFromCart";
import { rs, whatsappLink } from "./format";

type Line = {
  id: string;
  slug: string;
  name: string;
  image: string | null;
  brand: string | null;
  mrp: number;
  price: number;
  discountPct: number;
  available: boolean;
  qty: number;
  lineTotal: number;
  others: Other[];
};
type Other = { id: string; slug: string; name: string; brand: string; image: string | null; mrp: number; price: number; discountPct: number; available: boolean };
type Priced = {
  lines: Line[];
  missing: string[];
  subtotal: number;
  savings: number;
  deliveryFee: number;
  freeDeliveryOver: number;
  total: number;
};

export function CartView() {
  const { cart, ready, href, setQty, remove, replace, store } = useShop();
  const [data, setData] = useState<Priced | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Re-price from the server whenever the cart changes (debounced for +/- clicks).
  useEffect(() => {
    if (!ready) return;
    if (!cart.length) {
      setData({ lines: [], missing: [], subtotal: 0, savings: 0, deliveryFee: 0, freeDeliveryOver: 0, total: 0 });
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch("/api/storefront/cart", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items: cart }),
          signal: ctrl.signal,
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Could not load the cart");
        setData(json);
        setError(null);
        // Drop items that are no longer sold online.
        for (const id of json.missing as string[]) remove(id);
      } catch (e: any) {
        if (e.name !== "AbortError") setError(e.message);
      }
    }, 250);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart, ready]);

  if (!ready || (!data && !error))
    return (
      <div className="flex justify-center py-24 text-(--s-muted)">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );

  if (data && !data.lines.length)
    return (
      <div className="mx-auto flex max-w-md flex-col items-center px-4 py-20 text-center">
        <ShoppingBag className="h-14 w-14 text-neutral-300" />
        <h1 className="mt-4 text-xl font-bold text-(--s-ink)">Your cart is empty</h1>
        <p className="mt-1 text-(--s-muted)">Find cables, switches and everything else for your wiring job.</p>
        <Link href={href("/search")} className="mt-6 rounded-full bg-(--s-btn) px-6 py-3 font-semibold text-(--s-btn-ink) hover:opacity-85">
          Start shopping
        </Link>
      </div>
    );

  const lines = data?.lines || [];
  const unavailable = lines.filter((l) => !l.available);
  const orderText = [
    "Hi, I would like to order:",
    ...lines.filter((l) => l.available).map((l) => `• ${l.name} × ${l.qty} = ${rs(l.lineTotal)}`),
    `Total: ${rs(data?.total)}${data?.deliveryFee ? ` (incl. delivery ${rs(data.deliveryFee)})` : ""}`,
  ].join("\n");
  const wa = whatsappLink(store.whatsapp, orderText);
  const toFree = data && data.freeDeliveryOver > 0 && data.deliveryFee > 0 ? data.freeDeliveryOver - data.subtotal : 0;

  return (
    <div className="mx-auto px-4 md:px-6 xl:px-10 py-8">
      <h1 className="mb-5 text-2xl font-bold text-(--s-ink) md:text-[28px]">Your cart</h1>
      {error && <div className="mb-4 rounded-lg border border-(--s-bad) px-4 py-3 text-sm text-(--s-bad)">{error}</div>}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          {lines.some((l) => l.others?.length) && (
            <Link
              href={href("/cart/compare")}
              className="flex items-center gap-3 rounded-2xl border border-(--s-accent)/40 bg-(--s-accent-soft) px-4 py-3 text-sm transition hover:border-(--s-accent)"
            >
              <Table2 className="h-5 w-5 shrink-0 text-(--s-accent)" />
              <span className="flex-1">
                <strong>Compare brands:</strong> see your whole list priced in each brand, with totals. Download as PDF.
              </span>
              <span className="shrink-0 font-bold text-(--s-accent)">Open →</span>
            </Link>
          )}
          {unavailable.length > 0 && (
            <div className="rounded-lg border border-(--s-line) bg-(--s-soft) px-4 py-3 text-sm text-(--s-ink-2)">
              {unavailable.length === 1 ? "1 item is" : `${unavailable.length} items are`} not available online right now and not counted in the total. Please contact us for these.
            </div>
          )}
          {lines.map((l) => { const q = cart.find((c) => c.id === l.id)?.qty ?? l.qty; return (
            <div key={l.id} className={`flex flex-wrap gap-3 rounded-2xl border border-(--s-line) bg-(--s-surface) p-3 sm:gap-4 sm:p-4 ${l.available ? "" : "opacity-60"}`}>
              <Link href={href(`/p/${l.slug}`)} className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-(--s-img) sm:h-24 sm:w-24">
                {l.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={l.image} alt={l.name} className="h-full w-full object-contain p-1" />
                ) : (
                  <ImageOff className="h-6 w-6 text-neutral-300" />
                )}
              </Link>
              <div className="flex min-w-0 flex-1 flex-col">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    {l.brand && <div className="text-xs text-(--s-muted)">{l.brand}</div>}
                    <Link href={href(`/p/${l.slug}`)} className="line-clamp-2 text-sm font-medium text-(--s-ink) hover:text-(--s-ink)">
                      {l.name}
                    </Link>
                  </div>
                  <button onClick={() => remove(l.id)} aria-label="Remove" className="rounded p-1 text-(--s-muted) hover:bg-(--s-soft) hover:text-(--s-bad)">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="mt-auto flex flex-wrap items-end justify-between gap-2 pt-2">
                  {l.available ? (
                    <div className="flex h-9 items-center rounded-full border border-(--s-line)">
                      <button aria-label="Less" onClick={() => setQty(l.id, q - 1)} className="flex h-full w-8 items-center justify-center rounded-full hover:bg-(--s-soft)">
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <input
                        aria-label="Quantity"
                        inputMode="numeric"
                        value={q}
                        onChange={(e) => setQty(l.id, Number(e.target.value.replace(/\D/g, "")))}
                        className="h-full w-10 bg-transparent text-center text-sm font-bold text-(--s-ink) outline-none"
                      />
                      <button aria-label="More" onClick={() => setQty(l.id, q + 1)} className="flex h-full w-8 items-center justify-center rounded-full hover:bg-(--s-soft)">
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <span className="text-sm font-medium text-(--s-muted)">Contact us</span>
                  )}
                  <div className="text-right">
                    <div className="font-bold text-(--s-ink)">{rs(l.lineTotal)}</div>
                    <div className="text-xs text-(--s-muted)">
                      {rs(l.price)} each
                      {l.discountPct > 0 && <span className="ml-1 text-(--s-muted) line-through">{rs(l.mrp)}</span>}
                    </div>
                  </div>
                </div>
              </div>
              {l.others?.length > 0 && <BrandCompare line={l} qty={q} onSwitch={(id) => replace(l.id, id)} href={href} />}
            </div>
          ); })}
        </div>

        <aside className="h-fit space-y-4 rounded-3xl border border-(--s-line) bg-(--s-surface) p-6 lg:sticky lg:top-24">
          <h2 className="font-bold text-(--s-ink)">Order summary</h2>
          <dl className="space-y-2 text-sm">
            <Row label="Subtotal" value={rs(data?.subtotal)} />
            {!!data?.savings && <Row label="You save" value={`− ${rs(data.savings)}`} className="text-(--s-good)" />}
            <Row label="Delivery (Galle area)" value={data?.deliveryFee ? rs(data.deliveryFee) : "Free"} />
          </dl>
          <p className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-700 dark:text-emerald-300">
            Doorstep delivery is currently available across the <strong>Galle area</strong>.
          </p>
          {toFree > 0 && (
            <p className="rounded-lg bg-(--s-soft) px-3 py-2 text-xs text-(--s-ink)">Add {rs(toFree)} more for free delivery in Galle.</p>
          )}
          <div className="flex items-baseline justify-between border-t border-(--s-line) pt-3">
            <span className="font-semibold">Total</span>
            <span className="text-2xl font-bold text-(--s-ink)">{rs(data?.total)}</span>
          </div>

          <div className="space-y-2">
            <Link
              href={href("/checkout")}
              aria-disabled={!data?.total}
              className={`flex w-full items-center justify-center gap-2 rounded-full bg-(--s-accent) py-3.5 font-bold text-(--s-accent-ink) transition hover:bg-(--s-accent-hover) ${data?.total ? "" : "pointer-events-none opacity-50"}`}
            >
              <Lock className="h-4 w-4" /> Checkout
            </Link>
            <p className="text-center text-xs text-(--s-muted)">Cash on delivery or bank transfer</p>
            <QuoteFromCart disabled={!data?.total} />
            {lines.length > 0 && (
              <Link
                href={href("/cart/compare")}
                className="flex w-full items-center justify-center gap-2 rounded-full border-2 border-(--s-accent) py-3 text-sm font-bold text-(--s-accent) transition hover:bg-(--s-accent) hover:text-(--s-accent-ink)"
              >
                <Table2 className="h-4 w-4" /> Compare brands · PDF
              </Link>
            )}
            {(wa || store.phone) && (
              <div className="flex gap-2 pt-2">
                {wa && (
                  <a
                    href={wa}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-full border border-(--s-line) py-2.5 text-sm font-medium text-(--s-ink-2) hover:bg-(--s-soft)"
                  >
                    <MessageCircle className="h-4 w-4" /> WhatsApp order
                  </a>
                )}
                {store.phone && (
                  <a href={`tel:${store.phone}`} className="flex flex-1 items-center justify-center gap-1.5 rounded-full border border-(--s-line) py-2.5 text-sm font-medium text-(--s-ink-2) hover:bg-(--s-soft)">
                    <Phone className="h-4 w-4" /> Call us
                  </a>
                )}
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

function Row({ label, value, className = "" }: { label: string; value: string; className?: string }) {
  return (
    <div className={`flex justify-between ${className}`}>
      <dt className="text-(--s-ink-2)">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

/** "Compare other brands" under a cart line: same item from other brands, with a Switch button. */
function BrandCompare({ line, qty, onSwitch, href }: { line: Line; qty: number; onSwitch: (id: string) => void; href: (p: string) => string }) {
  const [open, setOpen] = useState(false);
  const cheapest = line.others.filter((o) => o.available).sort((a, b) => a.price - b.price)[0];
  const saving = cheapest && cheapest.price < line.price ? (line.price - cheapest.price) * qty : 0;
  return (
    <div className="basis-full border-t border-(--s-line) pt-2.5">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-2 text-left text-[13px] font-semibold text-(--s-accent)">
        <ArrowLeftRight className="h-4 w-4" />
        Compare {line.others.length} other {line.others.length === 1 ? "brand" : "brands"}
        {saving > 0 && <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-bold text-emerald-700 dark:text-emerald-300">save up to {rs(saving)}</span>}
        <ChevronDown className={`ml-auto h-4 w-4 transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="mt-2 overflow-hidden rounded-xl border border-(--s-line)">
          <div className="flex items-center gap-3 bg-(--s-soft) px-3 py-2 text-[13px]">
            <span className="w-24 shrink-0 truncate font-bold">{line.brand || "This item"}</span>
            <span className="min-w-0 flex-1 truncate text-(--s-muted)">In your cart</span>
            <span className="font-bold">{rs(line.price)}</span>
            <span className="w-[76px] shrink-0" />
          </div>
          {line.others.map((o) => {
            const diff = o.price - line.price;
            return (
              <div key={o.id} className="flex items-center gap-3 border-t border-(--s-line) px-3 py-2 text-[13px]">
                <span className="w-24 shrink-0 truncate font-bold">{o.brand}</span>
                <a href={href(`/p/${o.slug}`)} className="min-w-0 flex-1 truncate text-(--s-ink-2) hover:underline" title={o.name}>
                  {o.name}
                </a>
                <span className="text-right">
                  <span className="block font-bold">{rs(o.price)}</span>
                  {diff !== 0 && (
                    <span className={`block text-[11px] font-semibold ${diff < 0 ? "text-emerald-600 dark:text-emerald-400" : "text-(--s-muted)"}`}>
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
                  <span className="w-[76px] shrink-0 text-center text-[11px] text-(--s-muted)">Not available</span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
