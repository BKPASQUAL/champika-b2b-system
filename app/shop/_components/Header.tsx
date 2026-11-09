"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, LayoutGrid, Moon, Phone, Search, ShoppingBag, Sun, Truck, UserRound, X } from "lucide-react";
import { useShop } from "./ShopContext";
import { BrandLogo } from "./BrandLogo";

export type NavCategory = {
  name: string;
  slug: string;
  imageUrl: string | null;
  children: { name: string; slug: string; imageUrl: string | null; count: number }[];
};

/** Which top-bar tab is active for the current path. */
export function activeTab(pathname: string, base: string) {
  const p = pathname.slice(base.length) || "/";
  if (p === "/") return "home";
  if (p.startsWith("/quick-order")) return "quick";
  if (p.startsWith("/quote")) return "quote";
  if (p.startsWith("/cart") || p.startsWith("/checkout")) return "cart";
  if (p.startsWith("/account") || p.startsWith("/login") || p.startsWith("/reset-password")) return "account";
  if (p.startsWith("/categories") || p.startsWith("/c/")) return "categories";
  if (p.startsWith("/products") || p.startsWith("/search") || p.startsWith("/p/") || p.startsWith("/b/")) return "shop";
  return "";
}

export function Header({ categories }: { categories: NavCategory[] }) {
  const { href, base, cartCount, ready, store, dark, toggleTheme, customer } = useShop();
  // This bar hydrates inside <Suspense>, after the cart has already loaded from the
  // browser. Show the count only once this component is mounted, so the first
  // render matches the server HTML.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") || "");
  const [megaOpen, setMegaOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tab = activeTab(pathname, base);

  useEffect(() => {
    setMegaOpen(false);
    setSearchOpen(false);
  }, [pathname]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const t = q.trim();
    router.push(t ? `${href("/search")}?q=${encodeURIComponent(t)}` : href("/products"));
  };

  const openMega = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setMegaOpen(true);
  };
  const closeMega = () => {
    closeTimer.current = setTimeout(() => setMegaOpen(false), 150);
  };

  const navLink = (key: string, label: string, to: string) => (
    <Link
      href={href(to)}
      className={`relative flex h-full items-center px-4 text-[16px] font-semibold tracking-tight transition xl:px-5 xl:text-[17px] ${
        tab === key ? "text-white" : "text-slate-300 hover:text-white"
      }`}
    >
      {label}
      {tab === key && <span className="absolute inset-x-3 bottom-0 h-[3px] rounded-t-full bg-(--s-accent)" />}
    </Link>
  );

  const searchBox = (
    <form onSubmit={submit} className="relative w-full">
      <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        type="search"
        placeholder="Search wires, switches… e.g. 1/113"
        className="h-10 w-full rounded-full border border-white/10 bg-white/[0.07] pl-10 pr-4 text-sm text-white placeholder:text-slate-400 outline-none transition focus:border-(--s-accent) focus:bg-slate-950 focus:ring-2 focus:ring-blue-500/25"
      />
    </form>
  );

  const topLink = (label: string, to: string, active = false) => (
    <Link href={href(to)} className={`transition hover:text-white ${active ? "text-white" : "text-slate-300"}`}>
      {label}
    </Link>
  );

  return (
    <header className="sticky top-0 z-40 bg-(--s-bar) text-white shadow-[0_1px_0_var(--s-bar-line),0_4px_20px_-4px_rgba(15,23,42,0.3)]">
      {/* Thin top bar (desktop): categories on the left, quick links on the right */}
      <div className="hidden border-b border-white/[0.06] bg-black/30 md:block">
        <div className="mx-auto flex h-9 items-center gap-6 px-4 text-[12px] font-bold uppercase tracking-wide md:px-6 xl:px-10">
          <button
            onClick={() => setMegaOpen((o) => !o)}
            onMouseEnter={openMega}
            onMouseLeave={closeMega}
            className="flex items-center gap-1 text-[13px] normal-case text-slate-200 transition hover:text-white"
          >
            All categories <ChevronDown className={`h-3.5 w-3.5 transition ${megaOpen ? "rotate-180" : ""}`} />
          </button>
          <span className="hidden items-center gap-1.5 font-semibold normal-case text-slate-400 lg:flex">
            <Truck className="h-3.5 w-3.5 text-emerald-400" /> Fast delivery in the Galle area
          </span>
          <nav className="ml-auto flex items-center gap-5">
            {topLink("Quick order", "/quick-order", tab === "quick")}
            {topLink("House quotation", "/quote", tab === "quote")}
            {topLink("My orders", customer ? "/account/orders" : "/login")}
            {store.phone && (
              <a href={`tel:${store.phone}`} className="hidden items-center gap-1.5 text-slate-300 transition hover:text-white lg:flex">
                <Phone className="h-3.5 w-3.5" /> {store.phone}
              </a>
            )}
            <span className="h-4 w-px bg-white/15" />
            <button
              onClick={toggleTheme}
              className="text-slate-300 transition hover:text-white"
              aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
              title={dark ? "Light mode" : "Dark mode"}
            >
              {dark ? <Sun className="h-4 w-4 text-sky-400" /> : <Moon className="h-4 w-4" />}
            </button>
            <Link
              href={href(customer ? "/account" : "/login")}
              className={`flex items-center gap-1.5 text-[13px] normal-case transition hover:text-white ${tab === "account" ? "text-white" : "text-slate-300"}`}
              title={customer ? "My account" : "Log in"}
            >
              {customer ? (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-(--s-accent) text-[10px] font-bold text-(--s-accent-ink)">
                  {(customer.name || customer.email || "?").trim().charAt(0).toUpperCase()}
                </span>
              ) : (
                <UserRound className="h-4 w-4" />
              )}
              <span className="max-w-28 truncate">{customer ? (customer.name || "Account").split(" ")[0] : "Log in"}</span>
            </Link>
          </nav>
        </div>
      </div>

      {/* Main bar */}
      <div className="relative overflow-hidden">
        {/* Slanted stripes in the background */}
        <div aria-hidden className="pointer-events-none absolute inset-0 hidden md:block">
          {["left-[13%]", "left-[16.5%]", "left-[42%]", "left-[45.5%]", "left-[70%]", "left-[73.5%]", "left-[92%]"].map((pos, i) => (
            <span
              key={pos}
              className={`absolute top-0 h-full -skew-x-[35deg] bg-gradient-to-b from-white/[0.07] to-white/[0.01] ${pos} ${i % 2 ? "w-10" : "w-20"}`}
            />
          ))}
        </div>

        <div className="relative mx-auto flex h-16 items-center gap-2 px-4 md:h-[72px] md:px-6 xl:px-10">
          {/* Logo */}
          <Link href={href("/")} className="group mr-2 flex shrink-0 items-center xl:mr-6">
            <BrandLogo name={store.name} />
          </Link>

          {/* Main navigation (desktop) */}
          <nav className="hidden h-full items-stretch md:flex">
            {navLink("home", "Home", "/")}
            {navLink("shop", "Shop", "/products")}
            <div className="relative flex" onMouseEnter={openMega} onMouseLeave={closeMega}>
              <button
                onClick={() => setMegaOpen((o) => !o)}
                className={`relative flex h-full items-center gap-1 px-4 text-[16px] font-semibold tracking-tight transition xl:px-5 xl:text-[17px] ${
                  tab === "categories" || megaOpen ? "text-white" : "text-slate-300 hover:text-white"
                }`}
              >
                Categories <ChevronDown className={`h-4 w-4 transition ${megaOpen ? "rotate-180 text-blue-400" : ""}`} />
                {tab === "categories" && <span className="absolute inset-x-3 bottom-0 h-[3px] rounded-t-full bg-(--s-accent)" />}
              </button>
            </div>
            {navLink("quick", "Quick Order", "/quick-order")}
            <span className="hidden xl:flex">{navLink("quote", "Quotation", "/quote")}</span>
          </nav>

          <div className="ml-auto hidden w-full max-w-xs lg:block xl:max-w-sm">{searchBox}</div>

          <div className="ml-auto flex items-center gap-1.5 lg:ml-2">
            <button
              onClick={() => setSearchOpen((o) => !o)}
              className="rounded-full p-2.5 text-slate-300 transition hover:bg-white/10 hover:text-white lg:hidden"
              aria-label="Search"
            >
              {searchOpen ? <X className="h-5 w-5" /> : <Search className="h-5 w-5" />}
            </button>
            <button
              onClick={toggleTheme}
              className="rounded-full p-2.5 text-slate-300 transition hover:bg-white/10 hover:text-white md:hidden"
              aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
            >
              {dark ? <Sun className="h-5 w-5 text-sky-400" /> : <Moon className="h-5 w-5" />}
            </button>
            <Link
              href={href("/cart")}
              className={`relative hidden items-center gap-2 rounded-full px-4 py-2 text-sm font-bold transition md:flex ${
                tab === "cart"
                  ? "bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-[0_2px_12px_rgba(37,99,235,0.45)]"
                  : "bg-white text-slate-900 shadow-sm hover:bg-blue-600 hover:text-white"
              }`}
            >
              <ShoppingBag className="h-4 w-4" /> Cart
              {mounted && ready && cartCount > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-600 px-1 text-[11px] font-bold text-white">
                  {cartCount > 99 ? "99+" : cartCount}
                </span>
              )}
            </Link>
          </div>
        </div>
      </div>

      {/* Phone/tablet search row */}
      {searchOpen && <div className="border-t border-(--s-bar-line) px-4 py-3 lg:hidden">{searchBox}</div>}

      {/* Categories mega menu */}
      {megaOpen && (
        <div
          className="absolute inset-x-0 top-full hidden border-t border-(--s-line) bg-(--s-surface) text-(--s-ink) shadow-2xl md:block"
          onMouseEnter={openMega}
          onMouseLeave={closeMega}
        >
          <div className="mx-auto px-4 md:px-6 xl:px-10 py-6">
            {categories.map((c) => (
              <div key={c.slug} className="mb-4 last:mb-0">
                <div className="mb-3 flex items-center justify-between">
                  <Link href={href(`/c/${c.slug}`)} className="text-xs font-bold uppercase tracking-[0.15em] text-(--s-muted) hover:text-(--s-ink)">
                    {c.name}
                  </Link>
                  <Link href={href("/categories")} className="text-xs font-semibold underline-offset-4 hover:underline">
                    View all categories →
                  </Link>
                </div>
                <div className="grid grid-cols-3 gap-2 lg:grid-cols-6">
                  {c.children.map((s) => (
                    <Link
                      key={s.slug}
                      href={href(`/c/${s.slug}`)}
                      className="group flex items-center gap-3 rounded-xl border border-(--s-line) p-2.5 transition hover:border-blue-500/50 hover:bg-(--s-soft)"
                    >
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
                        {s.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={s.imageUrl} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <LayoutGrid className="h-5 w-5" />
                        )}
                      </span>
                      <span className="min-w-0">
                        <span className="line-clamp-2 text-[13px] font-semibold leading-tight group-hover:text-blue-600 dark:group-hover:text-blue-400">{s.name}</span>
                        <span className="text-[11px] text-(--s-muted)">{s.count ? `${s.count} ${s.count === 1 ? "item" : "items"}` : "Coming soon"}</span>
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
            {store.phone && (
              <div className="mt-5 flex items-center gap-2 border-t border-(--s-line) pt-4 text-sm text-(--s-muted)">
                <Phone className="h-4 w-4" /> Not sure what you need? Call{" "}
                <a href={`tel:${store.phone}`} className="font-semibold text-(--s-ink) hover:underline">{store.phone}</a>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
