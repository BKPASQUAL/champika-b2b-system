import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Box,
  Cable,
  ClipboardList,
  ImageOff,
  Layers,
  MapPin,
  Phone,
  Search,
  ShieldCheck,
  ToggleRight,
  Truck,
  Zap, ListChecks } from "lucide-react";
import {
  getBanners,
  getCategoryTree,
  getFeaturedBrands,
  getProducts,
  getShopBase,
  getStoreInfo,
  sortProducts,
} from "@/lib/shop-data";
import { ProductGrid } from "./_components/ProductCard";
import { BannerSlider } from "./_components/BannerSlider";
import { AllCategories } from "./_components/AllCategories";
import { whatsappLink } from "./_components/format";

function getCategoryIcon(name: string) {
  const n = name.toLowerCase();
  if (n.includes("cable") || n.includes("wire")) return Cable;
  if (n.includes("protect") || n.includes("control") || n.includes("breaker") || n.includes("mcb")) return ShieldCheck;
  if (n.includes("enclos") || n.includes("board") || n.includes("box")) return Box;
  if (n.includes("switch") || n.includes("socket")) return ToggleRight;
  return Layers;
}

export default async function ShopHome() {
  const [base, tree, banners, all, brands, store] = await Promise.all([
    getShopBase(),
    getCategoryTree(),
    getBanners(),
    getProducts(),
    getFeaturedBrands(),
    getStoreInfo(),
  ]);

  const featured = sortProducts(all.filter((p) => p.isFeatured), "popular");
  const newest = sortProducts(all, "newest");
  const deals = sortProducts(all.filter((p) => p.discountPct > 0 && p.available), "popular").sort((a, b) => b.discountPct - a.discountPct);
  const picks = (featured.length ? featured : deals.length ? deals : newest).slice(0, 10);
  // Categories with products first, so the hero tiles lead with things to buy.
  const subs = tree.flatMap((c) => c.children).sort((a, b) => Number(b.productCount > 0) - Number(a.productCount > 0));
  const wa = whatsappLink(store.whatsapp, "Hi, I need a quotation for wiring my house.");
  const quoteHref = wa || (store.phone ? `tel:${store.phone}` : null);

  return (
    <div className="space-y-14 md:space-y-18">
      {/* ---------- Hero ---------- */}
      <section className="shop-stripes relative overflow-hidden bg-(--s-bar) text-white">
        <div className="pointer-events-none absolute -left-24 -top-24 h-96 w-96 rounded-full bg-blue-600 opacity-15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 right-10 h-96 w-96 rounded-full bg-sky-500 opacity-10 blur-3xl" />
        <div className="relative mx-auto grid max-w-[1800px] items-center gap-8 px-4 py-10 md:grid-cols-[1.1fr_1fr] md:px-6 md:py-14 xl:gap-12 xl:px-10">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-2 rounded-full border border-slate-700/80 bg-slate-900/80 px-3.5 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-blue-300">
                <span className="h-2 w-2 rounded-full bg-blue-500 shadow-[0_0_8px_#3b82f6]" /> House wiring store
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/15 px-3.5 py-1 text-[11px] font-bold tracking-wide text-emerald-300">
                <MapPin className="h-3.5 w-3.5 text-emerald-400" /> Fast Delivery in Galle Area
              </span>
            </div>
            <h1 className="mt-4 text-3xl font-extrabold leading-[1.12] tracking-tight sm:text-4xl lg:text-5xl">
              Wire your home
              <br />
              with <span className="bg-gradient-to-r from-blue-400 to-sky-300 bg-clip-text text-transparent">confidence.</span>
            </h1>
            <p className="mt-4 max-w-md text-sm leading-6 text-slate-300/80 sm:text-base sm:leading-7">
              Genuine cables, switches, sockets and breakers from trusted brands — at discount prices, delivered fast across the <strong className="font-semibold text-white">Galle area</strong>.
            </p>

            <form action={`${base}/search`} className="mt-6 flex max-w-lg items-center gap-2 rounded-full bg-white p-1.5 pl-5 shadow-[0_8px_30px_rgba(0,0,0,0.25)]">
              <Search className="h-5 w-5 shrink-0 text-slate-400" />
              <input
                name="q"
                type="search"
                placeholder="What do you need? e.g. 1/113 wire"
                className="h-10 min-w-0 flex-1 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
              />
              <button className="h-10 shrink-0 cursor-pointer rounded-full bg-slate-900 px-6 text-sm font-bold text-white transition hover:bg-blue-600">
                Search
              </button>
            </form>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href={`${base}/products`}
                className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-blue-600 to-blue-500 px-6 py-3 text-sm font-bold text-white shadow-[0_4px_16px_rgba(37,99,235,0.4)] transition hover:brightness-110"
              >
                Shop now <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href={`${base}/quick-order`}
                className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-bold text-slate-900 shadow transition hover:bg-slate-100"
              >
                <ListChecks className="h-4 w-4" /> Quick order
              </Link>
              <Link
                href={`${base}/categories`}
                className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900/60 px-6 py-3 text-sm font-semibold text-slate-200 transition hover:border-slate-500 hover:bg-slate-800/80 hover:text-white"
              >
                All categories
              </Link>
            </div>

            <dl className="mt-8 flex flex-wrap gap-8 border-t border-slate-800/80 pt-5 sm:gap-12">
              <Stat value={String(all.length)} label={all.length === 1 ? "Product" : "Products"} />
              <Stat value={String(brands.length)} label={brands.length === 1 ? "Brand" : "Brands"} />
              <Stat value="Galle Area" label="Doorstep Delivery" highlight />
            </dl>

            {brands.length > 0 && (
              <div className="mt-5 flex flex-wrap items-center gap-2">
                <span className="mr-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">Main Brands:</span>
                {brands.slice(0, 6).map((b) => (
                  <Link
                    key={b.id}
                    href={`${base}/b/${b.slug}`}
                    className="inline-flex items-center gap-2 rounded-full border border-slate-700/80 bg-slate-900/80 px-3.5 py-1.5 text-xs font-semibold text-slate-200 transition hover:border-blue-500 hover:bg-blue-600/20 hover:text-white"
                  >
                    {b.logoUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={b.logoUrl} alt="" className="h-4 max-w-10 rounded-xs bg-white px-1 object-contain" />
                    )}
                    {b.name}
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Category quick tiles: compact, balanced 2x2 grid with full-bleed photo or icons */}
          <div className="hidden grid-cols-2 gap-3.5 md:grid">
            {subs.slice(0, 4).map((c, i) => {
              const Icon = getCategoryIcon(c.name);
              const active = i === 0;
              return (
                <Link
                  key={c.id}
                  href={`${base}/c/${c.slug}`}
                  className={`group relative flex min-h-[164px] flex-col justify-between overflow-hidden rounded-3xl p-5 transition duration-300 hover:-translate-y-1 ${active
                    ? "bg-gradient-to-br from-blue-600 via-blue-600 to-indigo-700 text-white shadow-[0_12px_32px_-8px_rgba(37,99,235,0.55)] ring-1 ring-white/15"
                    : "bg-slate-900/90 text-white ring-1 ring-slate-800 hover:bg-slate-800/90 hover:ring-blue-500/40"
                    }`}
                >
                  {c.imageUrl ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={c.imageUrl}
                        alt=""
                        className="pointer-events-none absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-105"
                      />
                      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/45 to-slate-950/25" />
                    </>
                  ) : (
                    /* Decorative background icon watermark */
                    <Icon
                      className={`pointer-events-none absolute -bottom-4 -right-4 h-28 w-28 transition duration-500 group-hover:scale-110 ${active ? "text-white/10" : "text-blue-500/[0.07]"
                        }`}
                    />
                  )}

                  <div className="relative flex items-center justify-between gap-2">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold backdrop-blur-xs ${c.imageUrl || active
                          ? "bg-black/45 text-white ring-1 ring-white/20"
                          : c.productCount > 0
                            ? "bg-blue-500/15 text-blue-300 ring-1 ring-blue-500/30"
                            : "bg-slate-800 text-slate-400"
                        }`}
                    >
                      {c.productCount ? `${c.productCount} ${c.productCount === 1 ? "item" : "items"}` : "Coming soon"}
                    </span>
                    <span
                      className={`flex h-8 w-8 items-center justify-center rounded-full backdrop-blur-xs transition ${c.imageUrl || active
                          ? "bg-black/45 text-white ring-1 ring-white/20 group-hover:bg-blue-600"
                          : "bg-slate-800 text-slate-300 group-hover:bg-blue-600 group-hover:text-white"
                        }`}
                    >
                      <ArrowUpRight className="h-4 w-4 transition group-hover:rotate-45" />
                    </span>
                  </div>

                  <div className="relative mt-4 flex items-end justify-between gap-3">
                    <div className="min-w-0">
                      {!c.imageUrl && (
                        <div
                          className={`mb-2.5 flex h-11 w-11 items-center justify-center rounded-2xl ${active ? "bg-white/15 text-white ring-1 ring-white/20" : "bg-blue-500/10 text-blue-400 ring-1 ring-blue-500/20"
                            }`}
                        >
                          <Icon className="h-5 w-5" />
                        </div>
                      )}
                      <span className="line-clamp-2 text-base font-bold leading-snug tracking-tight drop-shadow-xs lg:text-[17px]">{c.name}</span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* ---------- Banners ---------- */}
      {banners.length > 0 && (
        <BannerSlider banners={banners.map((b) => ({ ...b, link: b.link ? (b.link.startsWith("/") ? `${base}${b.link}` : b.link) : null }))} />
      )}

      {/* ---------- Main Brands ---------- */}
      {brands.length > 0 && (
        <section className="mx-auto max-w-[1800px] px-4 md:px-6 xl:px-10">
          <SectionTitle kicker="Trusted makers" title="Our main brands" />
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {brands.map((b) => (
              <Link
                key={b.id}
                href={`${base}/b/${b.slug}`}
                title={b.name}
                className="group flex h-28 items-center justify-center overflow-hidden rounded-2xl border border-(--s-line) bg-white p-3 shadow-[0_4px_20px_-6px_rgba(15,23,42,0.06)] transition duration-300 hover:-translate-y-1 hover:border-blue-500/60 hover:shadow-[0_18px_36px_-14px_rgba(37,99,235,0.16)]"
              >
                {b.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={b.logoUrl}
                    alt={b.name}
                    loading="lazy"
                    className="h-full w-full object-contain transition duration-300 group-hover:scale-105"
                  />
                ) : (
                  <span className="text-xl font-black tracking-tight text-slate-900 group-hover:text-blue-600">{b.name}</span>
                )}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ---------- All categories ---------- */}
      {tree.length > 0 && (
        <section className="mx-auto max-w-[1800px] px-4 md:px-6 xl:px-10">
          <SectionTitle kicker="Browse" title="All categories" href={`${base}/categories`} linkLabel="View all" />
          <AllCategories tree={tree} base={base} />
        </section>
      )}

      {/* ---------- Picks ---------- */}
      {picks.length > 0 && (
        <section className="mx-auto max-w-[1800px] px-4 md:px-6 xl:px-10">
          <SectionTitle
            kicker={featured.length ? "Hand-picked" : deals.length ? "Save more" : "Just in"}
            title={featured.length ? "Top picks" : deals.length ? "Best deals" : "Latest products"}
            href={`${base}/products`}
            linkLabel="Shop all"
          />
          <ProductGrid products={picks} base={base} wide />
        </section>
      )}

      {/* ---------- Quotation ---------- */}
      <section className="mx-auto max-w-[1800px] px-4 md:px-6 xl:px-10">
        <div className="relative overflow-hidden rounded-3xl bg-(--s-accent) p-8 text-(--s-accent-ink) md:p-12">
          <ClipboardList className="absolute -bottom-6 -right-6 h-48 w-48 opacity-10" />
          <div className="relative max-w-xl">
            <span className="text-xs font-bold uppercase tracking-[0.18em]">Building or renovating?</span>
            <h2 className="mt-2 text-2xl font-bold leading-tight md:text-3xl">Get one price for your whole house.</h2>
            <p className="mt-3 text-white/80">
              Tell us the rooms and the number of lights, plugs and fans. We will send a complete item list with our best discount.
            </p>
            {quoteHref && (
              <a
                href={quoteHref}
                target={wa ? "_blank" : undefined}
                rel="noopener noreferrer"
                className="mt-6 inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-bold text-slate-900 hover:bg-slate-100"
              >
                {wa ? <ClipboardList className="h-4 w-4" /> : <Phone className="h-4 w-4" />} Ask for a quotation
              </a>
            )}
          </div>
        </div>
      </section>

      {/* ---------- New arrivals ---------- */}
      {picks !== newest && newest.length > 0 && (featured.length > 0 || deals.length > 0) && (
        <section className="mx-auto max-w-[1800px] px-4 md:px-6 xl:px-10">
          <SectionTitle kicker="Just in" title="New arrivals" href={`${base}/products?sort=newest`} linkLabel="See more" />
          <ProductGrid products={newest.slice(0, 10)} base={base} wide />
        </section>
      )}

      {!all.length && !tree.length && (
        <div className="mx-auto max-w-[1800px] px-4 md:px-6 xl:px-10 py-16 text-center text-(--s-muted)">
          <ImageOff className="mx-auto h-10 w-10" />
          <p className="mt-3">Our online shop is opening soon. Please check back shortly.</p>
        </div>
      )}
    </div>
  );
}

function Stat({ value, label, highlight }: { value: string; label: string; highlight?: boolean }) {
  return (
    <div>
      <dt className={`text-xl font-bold ${highlight ? "text-emerald-400" : "text-white"}`}>{value}</dt>
      <dd className="text-xs uppercase tracking-wider text-slate-400">{label}</dd>
    </div>
  );
}

function SectionTitle({ kicker, title, href, linkLabel }: { kicker: string; title: string; href?: string; linkLabel?: string }) {
  return (
    <div className="mb-6 flex items-end justify-between gap-4">
      <div>
        <span className="text-xs font-semibold text-(--s-muted)">{kicker}</span>
        <h2 className="mt-0.5 text-xl font-bold md:text-2xl">{title}</h2>
      </div>
      {href && (
        <Link href={href} className="group flex shrink-0 items-center gap-1 text-sm font-semibold">
          {linkLabel} <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
        </Link>
      )}
    </div>
  );
}
