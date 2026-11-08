"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Minus, Phone, Plus, ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import { MAX_QTY, useShop } from "./ShopContext";

/** Small "Add" button on product cards. */
export function AddToCartButton({ id, name, available }: { id: string; name: string; available: boolean }) {
  const { add, store } = useShop();
  const [done, setDone] = useState(false);
  if (!available) return <ContactToOrder phone={store.phone} />;
  return (
    <button
      onClick={(e) => {
        e.preventDefault();
        add(id, 1);
        setDone(true);
        toast.success("Added to cart", { description: name });
        setTimeout(() => setDone(false), 1200);
      }}
      className={`flex w-full cursor-pointer items-center justify-center gap-2 rounded-full py-2.5 text-[13px] font-bold transition duration-200 active:scale-[0.98] ${
        done
          ? "bg-emerald-600 text-white shadow-[0_3px_12px_-2px_rgba(22,163,74,0.45)]"
          : "bg-(--s-btn) text-(--s-btn-ink) shadow-[0_3px_10px_-2px_rgba(15,23,42,0.25)] hover:bg-gradient-to-r hover:from-blue-600 hover:to-blue-500 hover:text-white hover:shadow-[0_4px_14px_-2px_rgba(37,99,235,0.45)]"
      }`}
    >
      {done ? <Check className="h-4 w-4 stroke-[2.5]" /> : <ShoppingCart className="h-3.5 w-3.5" />}
      {done ? "Added" : "Add to cart"}
    </button>
  );
}

/** Quantity + "Add to cart" + "Buy now" on the product page. */
export function ProductBuyBox({ id, name, available }: { id: string; name: string; available: boolean }) {
  const { add, href, store } = useShop();
  const router = useRouter();
  const [qty, setQty] = useState(1);
  const clamp = (n: number) => Math.max(1, Math.min(MAX_QTY, Math.floor(n) || 1));

  if (!available)
    return (
      <div className="max-w-sm space-y-2">
        <p className="text-sm text-(--s-ink-2)">Contact us to order this item.</p>
        <ContactToOrder phone={store.phone} large />
      </div>
    );

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex h-12 items-center rounded-full border border-(--s-line) bg-(--s-surface)">
        <button aria-label="Less" className="flex h-full w-11 items-center justify-center rounded-full text-(--s-ink-2) hover:bg-(--s-soft)" onClick={() => setQty((q) => clamp(q - 1))}>
          <Minus className="h-4 w-4" />
        </button>
        <input
          aria-label="Quantity"
          inputMode="numeric"
          value={qty}
          onChange={(e) => setQty(clamp(Number(e.target.value.replace(/\D/g, ""))))}
          className="h-full w-12 bg-transparent text-center text-base font-bold text-(--s-ink) outline-none"
        />
        <button aria-label="More" className="flex h-full w-11 items-center justify-center rounded-full text-(--s-ink-2) hover:bg-(--s-soft)" onClick={() => setQty((q) => clamp(q + 1))}>
          <Plus className="h-4 w-4" />
        </button>
      </div>
      <button
        onClick={() => {
          add(id, qty);
          toast.success(`${qty} added to cart`, { description: name });
        }}
        className="flex h-12 flex-1 items-center justify-center gap-2 rounded-full border-2 border-(--s-ink) px-6 font-semibold text-(--s-ink) transition hover:bg-(--s-soft) sm:flex-none"
      >
        <ShoppingCart className="h-4 w-4" /> Add to cart
      </button>
      <button
        onClick={() => {
          add(id, qty);
          router.push(href("/cart"));
        }}
        className="h-12 flex-1 rounded-full bg-(--s-accent) px-7 font-bold text-(--s-accent-ink) transition hover:brightness-95 sm:flex-none"
      >
        Buy now
      </button>
    </div>
  );
}

/** Shown instead of "Add to cart" for items switched off online (stock is never shown). */
function ContactToOrder({ phone, large }: { phone: string; large?: boolean }) {
  const cls = `flex w-full items-center justify-center gap-1.5 rounded-full border-2 border-(--s-accent) font-semibold text-(--s-ink) transition hover:bg-(--s-accent) hover:text-(--s-accent-ink) ${large ? "h-12 text-base" : "py-1.5 text-sm"}`;
  return phone ? (
    <a href={`tel:${phone}`} className={cls}>
      <Phone className="h-4 w-4" /> Call to order
    </a>
  ) : (
    <span className={cls}>Contact for price</span>
  );
}
