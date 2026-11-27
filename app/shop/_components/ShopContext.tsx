"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { makeT, type Lang, type T } from "./i18n";
import type { SiteProfile } from "./site-profile";
import type { WebSite } from "@/app/config/business-constants";

/** One cart line kept in the browser. Prices are always re-checked on the server. */
export type CartLine = { id: string; qty: number };

type ShopCtx = {
  /** Which shop this is ("bk" | "champika"). */
  site: WebSite;
  /** Fixed words for this shop (delivery area, domain, default name…). */
  profile: SiteProfile;
  /** Link prefix: "" on the shop's domain, "/shop" or "/champika" when testing on the B2B domain. */
  base: string;
  href: (path: string) => string;
  store: { name: string; phone: string; whatsapp: string };
  /** Logged-in customer (null for guests). */
  customer: ShopCustomer | null;
  cart: CartLine[];
  cartCount: number;
  ready: boolean;
  add: (id: string, qty?: number) => void;
  /** Add several items in one go (e.g. "Order again"). */
  addMany: (lines: CartLine[]) => void;
  setQty: (id: string, qty: number) => void;
  remove: (id: string) => void;
  /** Swap one item for another (e.g. the same item from another brand), keeping the quantity. */
  replace: (fromId: string, toId: string) => void;
  /** Several swaps in one go (e.g. "use Sierra for everything"). */
  replaceMany: (pairs: [fromId: string, toId: string][]) => void;
  clear: () => void;
  dark: boolean;
  toggleTheme: () => void;
  /** "en" or "si" (Sinhala), picked with the language button. */
  lang: Lang;
  setLang: (lang: Lang) => void;
  /** Translate: t("Add to cart"). */
  t: T;
};

export type ShopCustomer = { name: string | null; email: string | null };

/** Swap cart items for others, keeping quantities (merges when the new item is already in the cart). */
function swap(cart: CartLine[], pairs: [string, string][], clamp: (n: number) => number): CartLine[] {
  let out = cart;
  for (const [fromId, toId] of pairs) {
    const from = out.find((l) => l.id === fromId);
    if (!from || fromId === toId) continue;
    const to = out.find((l) => l.id === toId);
    out = to
      ? out.filter((l) => l.id !== fromId).map((l) => (l.id === toId ? { ...l, qty: clamp(l.qty + from.qty) } : l))
      : out.map((l) => (l.id === fromId ? { id: toId, qty: from.qty } : l));
  }
  return out;
}

const Ctx = createContext<ShopCtx | null>(null);
export const MAX_QTY = 999;

function readCart(key: string): CartLine[] {
  try {
    const raw = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(raw)
      ? raw.filter((l) => typeof l?.id === "string" && Number(l.qty) > 0).map((l) => ({ id: l.id, qty: Math.min(MAX_QTY, Math.floor(l.qty)) }))
      : [];
  } catch {
    return [];
  }
}

export function ShopProvider({
  site = "bk",
  profile,
  base,
  store,
  initialDark,
  initialLang = "en",
  customer,
  children,
}: {
  site?: WebSite;
  /** This shop's fixed words (from the server; never the other shop's). */
  profile: SiteProfile;
  base: string;
  store: ShopCtx["store"];
  initialDark: boolean;
  initialLang?: Lang;
  customer: ShopCustomer | null;
  children: React.ReactNode;
}) {
  const [cart, setCart] = useState<CartLine[]>([]);
  const [ready, setReady] = useState(false);
  const [dark, setDark] = useState(initialDark);
  const [lang, setLangState] = useState<Lang>(initialLang);
  const router = useRouter();
  // Each shop keeps its own cart and settings in the browser.
  const KEY = profile.cartKey;

  useEffect(() => {
    setCart(readCart(KEY));
    setReady(true);
    // Keep several open tabs in step.
    const onStorage = (e: StorageEvent) => e.key === KEY && setCart(readCart(KEY));
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [KEY]);

  const save = useCallback((next: CartLine[]) => {
    setCart(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* private mode: cart lasts for this visit only */
    }
  }, [KEY]);

  // Remember for a year; the layout reads the cookie so pages arrive in the right colours.
  useEffect(() => {
    document.querySelector(".shop-root")?.classList.toggle("shop-dark", dark);
  }, [dark]);
  const toggleTheme = useCallback(() => {
    const next = !dark;
    setDark(next);
    document.cookie = `${profile.themeCookie}=${next ? "dark" : "light"}; path=/; max-age=31536000; samesite=lax`;
  }, [dark, profile.themeCookie]);

  // Remember the language for a year; the server reads it too, so pages arrive translated.
  const setLang = useCallback(
    (next: Lang) => {
      setLangState(next);
      document.cookie = `${profile.langCookie}=${next}; path=/; max-age=31536000; samesite=lax`;
      document.querySelector(".shop-root")?.classList.toggle("shop-si", next === "si");
      router.refresh();
    },
    [router, profile.langCookie],
  );

  const value = useMemo<ShopCtx>(() => {
    const clamp = (n: number) => Math.max(1, Math.min(MAX_QTY, Math.floor(n) || 1));
    return {
      site,
      profile,
      base,
      href: (path: string) => `${base}${path === "/" && base ? "" : path}` || "/",
      store,
      customer,
      cart,
      ready,
      cartCount: cart.reduce((s, l) => s + l.qty, 0),
      add: (id, qty = 1) => {
        const found = cart.find((l) => l.id === id);
        save(found ? cart.map((l) => (l.id === id ? { ...l, qty: clamp(l.qty + qty) } : l)) : [...cart, { id, qty: clamp(qty) }]);
      },
      addMany: (lines) => {
        let next = cart;
        for (const { id, qty } of lines) {
          const found = next.find((l) => l.id === id);
          next = found ? next.map((l) => (l.id === id ? { ...l, qty: clamp(l.qty + qty) } : l)) : [...next, { id, qty: clamp(qty) }];
        }
        save(next);
      },
      setQty: (id, qty) => save(cart.map((l) => (l.id === id ? { ...l, qty: clamp(qty) } : l))),
      remove: (id) => save(cart.filter((l) => l.id !== id)),
      replace: (fromId, toId) => save(swap(cart, [[fromId, toId]], clamp)),
      replaceMany: (pairs) => save(swap(cart, pairs, clamp)),
      clear: () => save([]),
      dark,
      toggleTheme,
      lang,
      setLang,
      t: makeT(lang),
    };
  }, [site, profile, base, store, customer, cart, ready, save, dark, toggleTheme, lang, setLang]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useShop() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useShop must be used inside ShopProvider");
  return c;
}
