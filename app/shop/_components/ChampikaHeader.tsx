"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, Menu, Phone, Search, ShoppingBag, Truck, UserRound, X } from "lucide-react";
import { useShop } from "./ShopContext";
import { activeTab, type NavCategory } from "./Header";

/**
 * Champika Hardware & Distribution header (approved design):
 *   red top bar → navy main bar (logo, menu, search, cart) → white bar with category names.
 */
export function ChampikaHeader({ categories }: { categories: NavCategory[] }) {
  const { href, base, cartCount, ready, store, profile, customer, lang, setLang, t } = useShop();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") || "");
  const [megaOpen, setMegaOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tab = activeTab(pathname, base);

  useEffect(() => {
    setMegaOpen(false);
    setMenuOpen(false);
    setSearchOpen(false);
  }, [pathname]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const term = q.trim();
    router.push(term ? `${href("/search")}?q=${encodeURIComponent(term)}` : href("/products"));
  };
  const openMega = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setMegaOpen(true);
  };
  const closeMega = () => {
    closeTimer.current = setTimeout(() => setMegaOpen(false), 150);
  };

  const langLabel = lang === "si" ? "English" : "සිංහල";
  const toggleLang = () => setLang(lang === "si" ? "en" : "si");
  const activeCat = pathname.startsWith(`${base}/c/`) ? pathname.slice(`${base}/c/`.length).split("/")[0] : "";

  const mainLink = (key: string, label: string, to: string) => (
    <Link
      href={href(to)}
      className={`flex h-full items-center whitespace-nowrap border-b-[3px] px-3.5 text-[15px] font-semibold transition xl:px-4 ${
        tab === key ? "border-(--s-accent) text-white" : "border-transparent text-[#c3ccd9] hover:text-white"
      }`}
    >
      {label}
    </Link>
  );

  const searchBox = (
    <form onSubmit={submit} role="search" className="relative w-full">
      <label htmlFor="ch-search" className="sr-only">
        {t("Search")}
      </label>
      <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8d99aa]" aria-hidden />
      <input
        id="ch-search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        type="search"
        placeholder={t("Search wires, pipes, paint… e.g. 7/1.04")}
        className="h-11 w-full rounded-full border border-white/15 bg-white/[0.08] pl-10 pr-4 text-sm text-white outline-none transition placeholder:text-[#8d99aa] focus:border-(--s-accent) focus:bg-[#0a1424]"
      />
    </form>
  );

  return (
    <header className="sticky top-0 z-40 shadow-[0_6px_20px_-6px_rgba(15,30,51,0.45)]">
      {/* Tone 1: red top bar (desktop) */}
      <div className="hidden bg-[#b80d0d] text-white md:block">
        <div className="mx-auto flex min-h-9 max-w-[1440px] flex-wrap items-center gap-x-6 gap-y-1 px-4 text-[13px] font-bold md:px-6 xl:px-8">
          <button
            type="button"
            onClick={() => setMegaOpen((o) => !o)}
            onMouseEnter={openMega}
            onMouseLeave={closeMega}
            className="flex items-center gap-1 py-2"
            aria-expanded={megaOpen}
          >
            {t("All categories")} <ChevronDown className={`h-3.5 w-3.5 transition ${megaOpen ? "rotate-180" : ""}`} aria-hidden />
          </button>
          <span className="hidden items-center gap-1.5 font-semibold text-[#ffe1de] lg:flex">
            <Truck className="h-3.5 w-3.5" aria-hidden /> {t(profile.deliveryBadge)}
          </span>
          <nav aria-label={t("Quick links")} className="ml-auto flex flex-wrap items-center gap-x-5 gap-y-1">
            <Link href={href("/quick-order")} className="hover:underline">{t("Quick order")}</Link>
            <Link href={href("/quote")} className="hover:underline">{t("Get a quote")}</Link>
            <Link href={href(customer ? "/account/orders" : "/login")} className="hover:underline">{t("My orders")}</Link>
            {store.phone && (
              <a href={`tel:${store.phone}`} className="hidden items-center gap-1.5 text-[#ffe1de] hover:text-white lg:flex">
                <Phone className="h-3.5 w-3.5" aria-hidden /> {store.phone}
              </a>
            )}
            <button type="button" onClick={toggleLang} className="rounded-full bg-white/15 px-3 py-0.5 font-bold hover:bg-white/25" aria-label={t("Language")}>
              {langLabel}
            </button>
            <Link href={href(customer ? "/account" : "/login")} className="flex items-center gap-1.5 hover:underline">
              <UserRound className="h-3.5 w-3.5" aria-hidden />
              <span className="max-w-28 truncate">{customer ? (customer.name || t("Account")).split(" ")[0] : t("Trade login")}</span>
            </Link>
          </nav>
        </div>
      </div>

      {/* Tone 2: navy main bar with faint slanted stripes */}
      <div className="relative overflow-hidden bg-(--s-bar) text-white">
        <div aria-hidden className="pointer-events-none absolute inset-0 hidden md:block">
          <span className="absolute top-0 left-[14%] h-full w-20 -skew-x-[35deg] bg-white/[0.04]" />
          <span className="absolute top-0 left-[19%] h-full w-8 -skew-x-[35deg] bg-[#d50f0f]/25" />
          <span className="absolute top-0 left-[52%] h-full w-20 -skew-x-[35deg] bg-white/[0.04]" />
          <span className="absolute top-0 left-[78%] h-full w-8 -skew-x-[35deg] bg-[#d50f0f]/25" />
        </div>
        <div className="relative mx-auto flex h-16 max-w-[1440px] items-center gap-2 px-4 md:h-[76px] md:px-6 xl:px-8">
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            className="rounded-lg p-2.5 text-white hover:bg-white/10 md:hidden"
            aria-label={menuOpen ? t("Close menu") : t("Open menu")}
            aria-expanded={menuOpen}
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <Link href={href("/")} className="mr-2 shrink-0 rounded-lg bg-white px-1.5 py-1 xl:mr-5" aria-label={`${store.name} — ${t("Home")}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/ch-logo.png" alt={store.name} width={560} height={412} className="h-11 w-auto md:h-14" />
          </Link>

          <nav aria-label={t("Main")} className="hidden h-full items-stretch md:flex">
            {mainLink("home", t("Home"), "/")}
            {mainLink("shop", t("Shop"), "/products")}
            {mainLink("categories", t("Categories"), "/categories")}
            {mainLink("quick", t("Quick Order"), "/quick-order")}
            <span className="hidden xl:flex">{mainLink("quote", t("Quotation"), "/quote")}</span>
          </nav>

          <div className="ml-auto hidden w-full max-w-xs lg:block xl:max-w-sm">{searchBox}</div>

          <div className="ml-auto flex items-center gap-1.5 lg:ml-3">
            <button
              type="button"
              onClick={() => setSearchOpen((o) => !o)}
              className="rounded-full p-2.5 text-[#c3ccd9] hover:bg-white/10 hover:text-white lg:hidden"
              aria-label={t("Search")}
            >
              {searchOpen ? <X className="h-5 w-5" /> : <Search className="h-5 w-5" />}
            </button>
            <button type="button" onClick={toggleLang} className="rounded-full bg-white/10 px-2.5 py-1.5 text-[13px] font-bold ring-1 ring-white/15 md:hidden" aria-label={t("Language")}>
              {lang === "si" ? "EN" : "සිං"}
            </button>
            <Link
              href={href("/cart")}
              className="relative flex h-11 items-center gap-2 rounded-full bg-(--s-accent) px-3 text-sm font-bold text-white transition hover:bg-(--s-accent-hover) md:px-4"
              aria-label={mounted && ready && cartCount > 0 ? `${t("Cart")}: ${cartCount}` : t("Cart")}
            >
              <ShoppingBag className="h-5 w-5 md:h-4 md:w-4" aria-hidden />
              <span className="hidden md:inline">{t("Cart")}</span>
              {mounted && ready && cartCount > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1 text-[12px] font-extrabold text-[#b80d0d]">
                  {cartCount > 99 ? "99+" : cartCount}
                </span>
              )}
            </Link>
          </div>
        </div>
        {searchOpen && <div className="relative border-t border-(--s-bar-line) px-4 py-3 lg:hidden">{searchBox}</div>}
      </div>

      {/* White bar: category names only */}
      <nav aria-label={t("Categories")} className="border-b border-(--s-line) bg-(--s-surface)">
        <div className="shop-noscroll mx-auto flex max-w-[1440px] items-stretch gap-1 overflow-x-auto px-4 text-[14.5px] font-semibold md:px-6 xl:px-8">
          <Link
            href={href("/categories")}
            className={`shrink-0 border-b-[3px] px-3 py-3 ${tab === "categories" && !activeCat ? "border-(--s-accent) text-(--s-accent-text)" : "border-transparent text-(--s-ink) hover:text-(--s-accent-text)"}`}
          >
            {t("All categories")}
          </Link>
          {categories.map((c) => (
            <Link
              key={c.slug}
              href={href(`/c/${c.slug}`)}
              className={`shrink-0 whitespace-nowrap border-b-[3px] px-3 py-3 ${
                activeCat === c.slug || c.children.some((s) => s.slug === activeCat)
                  ? "border-(--s-accent) text-(--s-accent-text)"
                  : "border-transparent text-(--s-ink) hover:text-(--s-accent-text)"
              }`}
            >
              {c.name}
            </Link>
          ))}
          <Link href={href("/products?sort=popular")} className="ml-auto shrink-0 whitespace-nowrap border-b-[3px] border-transparent px-3 py-3 text-(--s-accent-text) hover:underline">
            {t("Special offers")}
          </Link>
        </div>
      </nav>

      {/* Phone menu */}
      {menuOpen && (
        <nav aria-label={t("Main")} className="border-b border-(--s-line) bg-(--s-surface) px-4 py-3 text-(--s-ink) md:hidden">
          {[
            [t("Home"), "/"],
            [t("Shop"), "/products"],
            [t("Categories"), "/categories"],
            [t("Quick Order"), "/quick-order"],
            [t("Quotation"), "/quote"],
            [customer ? t("Account") : t("Trade login"), customer ? "/account" : "/login"],
          ].map(([label, to]) => (
            <Link key={to} href={href(to)} className="block rounded-lg px-3 py-3 text-[15px] font-semibold hover:bg-(--s-soft)">
              {label}
            </Link>
          ))}
          {store.phone && (
            <a href={`tel:${store.phone}`} className="mt-1 flex items-center gap-2 rounded-lg px-3 py-3 text-[15px] font-semibold text-(--s-accent-text)">
              <Phone className="h-4 w-4" aria-hidden /> {store.phone}
            </a>
          )}
        </nav>
      )}

      {/* Categories dropdown (from the red bar) */}
      {megaOpen && (
        <div
          className="absolute inset-x-0 top-full hidden border-t border-(--s-line) bg-(--s-surface) text-(--s-ink) shadow-2xl md:block"
          onMouseEnter={openMega}
          onMouseLeave={closeMega}
        >
          <div className="mx-auto grid max-w-[1440px] grid-cols-2 gap-6 px-6 py-6 lg:grid-cols-4 xl:px-8">
            {categories.map((c) => (
              <div key={c.slug}>
                <Link href={href(`/c/${c.slug}`)} className="ch-display mb-2 block text-[15px] font-extrabold hover:text-(--s-accent-text)">
                  {c.name}
                </Link>
                <ul className="space-y-1">
                  {c.children.slice(0, 8).map((s) => (
                    <li key={s.slug}>
                      <Link href={href(`/c/${s.slug}`)} className="text-[14px] text-(--s-ink-2) hover:text-(--s-accent-text) hover:underline">
                        {s.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}
    </header>
  );
}
