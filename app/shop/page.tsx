import Link from "next/link";
import {
  Box,
  Cable,
  Camera,
  ChevronRight,
  ClipboardList,
  Flame,
  ImageOff,
  Layers,
  LayoutGrid,
  ListChecks,
  MessageCircle,
  Phone,
  Send,
  ShieldCheck,
  PackagePlus,
  Tag,
  ToggleRight,
} from "lucide-react";
import {
  getBanners,
  getCategoryTree,
  getDeliveryInfo,
  getFeaturedBrands,
  getProducts,
  getPromoStrip,
  getShopBase,
  getStoreInfo,
  sortProducts,
  type PromoStripItem,
  type ShopProductCard,
} from "@/lib/shop-data";
import { ProductCard } from "./_components/ProductCard";
import { HeroFeature } from "./_components/HeroFeature";
import { ScrollRow } from "./_components/ScrollRow";
import { AllCategories } from "./_components/AllCategories";
import { rs, whatsappLink } from "./_components/format";
import { getT } from "./_components/lang-server";
import { VisitShop } from "./_components/VisitShop";
import { WhatsAppIcon } from "./_components/WhatsAppButton";

function getCategoryIcon(name: string) {
  const n = name.toLowerCase();
  if (n.includes("cable") || n.includes("wire")) return Cable;
  if (n.includes("protect") || n.includes("control") || n.includes("breaker") || n.includes("mcb")) return ShieldCheck;
  if (n.includes("enclos") || n.includes("board") || n.includes("box")) return Box;
  if (n.includes("switch") || n.includes("socket")) return ToggleRight;
  return Layers;
}

const BADGE_BG = { red: "bg-red-600", orange: "bg-orange-500", green: "bg-emerald-600", blue: "bg-blue-600" } as const;
const BADGE_RING = { red: "ring-red-500", orange: "ring-orange-400", green: "ring-emerald-500", blue: "ring-blue-500" } as const;

const wrap = "mx-auto px-4 md:px-6 xl:px-10";

export default async function ShopHome() {
  const [base, tree, banners, all, brands, store, promos, delivery, t] = await Promise.all([
    getShopBase(),
    getCategoryTree(),
    getBanners(),
    getProducts(),
    getFeaturedBrands(),
    getStoreInfo(),
    getPromoStrip(),
    getDeliveryInfo(),
    getT(),
  ]);

  const featured = sortProducts(all.filter((p) => p.isFeatured), "popular");
  const newest = sortProducts(all, "newest");
  const deals = sortProducts(all.filter((p) => p.discountPct > 0 && p.available), "popular").sort((a, b) => b.discountPct - a.discountPct);

  // Hero: 4 picture tiles in the middle, a list of 4 more on the right (no repeats).
  const tiles = (featured.length ? featured : deals.length ? deals : newest).slice(0, 4);
  const used = new Set(tiles.map((p) => p.id));
  const sideList = [...deals, ...newest].filter((p, idx, arr) => !used.has(p.id) && arr.findIndex((x) => x.id === p.id) === idx).slice(0, 4);
  const sideTitle = deals.some((p) => sideList.includes(p)) ? t("Best deals") : t("Just in");

  const strip = buildStrip(promos, all);
  const wa = whatsappLink(store.whatsapp, "Hi, I need a quotation for wiring my house.");
  const waList = whatsappLink(store.whatsapp, "Hi, I am sending a photo of my wiring item list. Please send me a quotation.");
  const heroBanners = banners.map((b) => ({ ...b, link: b.link ? (b.link.startsWith("/") ? `${base}${b.link}` : b.link) : null }));

  const pills = [
    { label: t("Shop all"), to: `${base}/products`, icon: LayoutGrid },
    { label: t("Best deals"), to: `${base}/products?sort=popular`, icon: Flame },
    { label: t("New arrivals"), to: `${base}/products?sort=newest`, icon: PackagePlus },
    { label: t("Quick order"), to: `${base}/quick-order`, icon: ListChecks },
    { label: t("Send a photo of your list"), to: `${base}/quote?mode=list`, icon: Camera },
    { label: t("House quotation"), to: `${base}/quote`, icon: ClipboardList },
    { label: t("Brands"), to: "#brands", icon: Tag },
  ];

  return (
    <div className="pb-14 md:pb-20">
      {/* ---------- Category strip (right under the menu bar) ---------- */}
      {strip.length > 0 && (
        <section className="border-b border-(--s-bar-line) bg-black text-white">
          <div className={`${wrap} shop-noscroll flex items-center gap-1 overflow-x-auto py-3`}>
            <Link
              href={`${base}/products`}
              className="mr-3 flex shrink-0 flex-col justify-center gap-0.5 rounded-lg bg-white/[0.08] px-4 py-2 ring-1 ring-white/10 transition hover:bg-white/[0.14]"
            >
              <span className="flex items-center gap-1.5 text-[15px] font-bold leading-tight">
                <span className="h-2 w-2 rounded-full bg-red-500 shadow-[0_0_6px_#ef4444]" /> {t("Special")}
                <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
              </span>
              <span className="text-[14px] font-semibold leading-tight text-slate-300">{t("Offers")}</span>
            </Link>
            {strip.map((c) => (
              <Link
                key={c.key}
                href={c.link.startsWith("http") ? c.link : `${base}${c.link}`}
                className="group flex w-[88px] shrink-0 flex-col items-center gap-1.5 rounded-lg px-1 pb-1 pt-1 text-center transition hover:bg-white/[0.06]"
              >
                <span className="relative">
                  <span
                    className={`flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-blue-500/30 to-slate-800 ring-2 transition group-hover:ring-blue-400 ${
                      c.badge ? BADGE_RING[c.color] : "ring-white/10"
                    }`}
                  >
                    {c.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.imageUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <c.Icon className="h-5 w-5 text-blue-200" />
                    )}
                  </span>
                  {c.badge && (
                    <span
                      className={`absolute -bottom-1.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded px-1.5 py-px text-[11px] font-extrabold uppercase tracking-wide text-white shadow ${BADGE_BG[c.color]}`}
                    >
                      {c.badge}
                    </span>
                  )}
                </span>
                <span className="mt-0.5 line-clamp-2 text-[12.5px] font-bold leading-tight text-slate-200 group-hover:text-white">{c.title}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ---------- Quick link pills ---------- */}
      <div className={`${wrap} shop-noscroll flex gap-2.5 overflow-x-auto pt-6`}>
        {pills.map(({ label, to, icon: Icon }) => (
          <Link
            key={label}
            href={to}
            className="flex shrink-0 items-center gap-1.5 rounded-full bg-(--s-soft) px-4 py-2 text-[14px] font-bold text-(--s-ink) ring-1 ring-(--s-line) transition hover:bg-(--s-accent) hover:text-(--s-accent-ink) hover:ring-(--s-accent)"
          >
            <Icon className="h-4 w-4" /> {label}
          </Link>
        ))}
        {wa && (
          <a
            href={wa}
            target="_blank"
            rel="noopener noreferrer"
            className="flex shrink-0 items-center gap-1.5 rounded-full bg-(--s-soft) px-4 py-2 text-[14px] font-bold text-(--s-ink) ring-1 ring-(--s-line) transition hover:bg-emerald-600 hover:text-white hover:ring-emerald-600"
          >
            <MessageCircle className="h-4 w-4" /> {t("Chat on WhatsApp")}
          </a>
        )}
      </div>

      {/* ---------- Hero: big feature · 2x2 tiles · side list ---------- */}
      <section className={`${wrap} pt-6`}>
        <div
          className={`grid gap-6 ${
            tiles.length
              ? sideList.length
                ? "lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] 2xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,0.72fr)]"
                : "lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]"
              : ""
          }`}
        >
          <HeroFeature banners={heroBanners} base={base} />

          {tiles.length > 0 && (
            <div className="grid grid-cols-2 gap-x-4 gap-y-6">
              {tiles.map((p) => (
                <HeroTile key={p.id} p={p} base={base} />
              ))}
            </div>
          )}

          {sideList.length > 0 && (
            <div className="lg:col-span-2 2xl:col-span-1">
              <div className="mb-1 flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-(--s-muted)">{sideTitle}</span>
                <Link href={`${base}/products`} className="text-xs font-bold hover:underline">
                  {t("View all")}
                </Link>
              </div>
              <div className="grid sm:grid-cols-2 sm:gap-x-8 2xl:grid-cols-1">
                {sideList.map((p) => (
                  <SideItem key={p.id} p={p} base={base} />
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ---------- Photo list → quotation (marketing band, top of page) ---------- */}
      <section className={`${wrap} pt-6`}>
        <div className="relative overflow-hidden rounded-2xl bg-(--s-bar) text-white ring-1 ring-white/5">
          <div className="shop-stripes pointer-events-none absolute inset-0" />
          <Camera className="pointer-events-none absolute -right-6 -top-8 h-48 w-48 text-blue-500/10" strokeWidth={1.25} />
          <div className="relative grid items-center gap-8 p-6 md:p-8 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)_auto]">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/15 px-3 py-1 text-xs font-bold text-blue-200 ring-1 ring-blue-400/30">
                {t("Free quotation service")}
              </span>
              <h2 className="mt-3 text-2xl font-extrabold leading-tight tracking-tight md:text-[28px]">
                {t("Have a list from your electrician?")}
              </h2>
              <p className="mt-2 text-[15px] text-slate-300">
                {t("Send us a photo of it. We price every item and send the quotation back to you.")}
              </p>
            </div>

            <ol className="grid gap-3 sm:grid-cols-3">
              {[
                { Icon: Camera, title: t("Upload a photo"), text: t("Snap the paper list and upload it") },
                { Icon: ClipboardList, title: t("We price it"), text: t("Every item at our best discount") },
                { Icon: Send, title: t("Get your quotation"), text: t("We send it back on WhatsApp or SMS") },
              ].map(({ Icon, title, text }, i) => (
                <li key={title} className="relative flex gap-3 rounded-xl bg-white/[0.05] p-4 ring-1 ring-white/10 sm:flex-col">
                  <span className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-(--s-accent) text-white shadow-lg shadow-blue-900/40">
                    <Icon className="h-5 w-5" />
                    <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-white text-[11px] font-extrabold text-slate-900">
                      {i + 1}
                    </span>
                  </span>
                  <span>
                    <span className="block text-[15px] font-bold">{title}</span>
                    <span className="mt-0.5 block text-[13px] leading-snug text-slate-400">{text}</span>
                  </span>
                </li>
              ))}
            </ol>

            <div className="flex flex-wrap gap-3 xl:flex-col">
              <Link
                href={`${base}/quote?mode=list`}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-white px-6 text-[15px] font-bold text-slate-900 transition hover:bg-blue-50"
              >
                <Camera className="h-4 w-4" /> {t("Upload photo")}
              </Link>
              {waList && (
                <a
                  href={waList}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-[#25D366] px-6 text-[15px] font-bold text-white transition hover:bg-[#1ebe5a]"
                >
                  <WhatsAppIcon className="h-5 w-5" /> {t("Send on WhatsApp")}
                </a>
              )}
            </div>
          </div>
        </div>
      </section>

      <div className="space-y-14 pt-14 md:space-y-20 md:pt-20">
        {/* ---------- Brands ---------- */}
        {brands.length > 0 && (
          <section id="brands" className={`${wrap} scroll-mt-32`}>
            <div className="mb-5 flex items-end justify-between gap-4">
              <h2 className="shop-display">{t("Brands")}</h2>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 sm:gap-4">
              {brands.map((b) => (
                <Link
                  key={b.id}
                  href={`${base}/b/${b.slug}`}
                  title={b.name}
                  className="group flex h-24 items-center justify-center overflow-hidden rounded-xl border border-(--s-line) bg-white p-3 transition duration-300 hover:-translate-y-0.5 hover:border-blue-500/60 hover:shadow-[0_14px_30px_-14px_rgba(37,99,235,0.25)] md:h-28"
                >
                  {b.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={b.logoUrl} alt={b.name} loading="lazy" className="h-full w-full object-contain transition duration-300 group-hover:scale-105" />
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
          <section className={wrap}>
            <div className="mb-5 flex items-end justify-between gap-4">
              <h2 className="shop-display">{t("All categories")}</h2>
              <Link href={`${base}/categories`} className="shrink-0 text-sm font-bold hover:underline md:text-base">
                {t("View all")}
              </Link>
            </div>
            <AllCategories tree={tree} base={base} />
          </section>
        )}

        {/* ---------- House quotation ---------- */}
        <section className={`${wrap} grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]`}>
          <div className="shop-stripes relative overflow-hidden rounded-xl bg-(--s-bar) p-8 text-white md:p-12">
            <ClipboardList className="absolute -bottom-6 -right-6 h-48 w-48 text-white/10" />
            <div className="relative max-w-xl">
              <span className="text-xs font-bold uppercase tracking-[0.18em] text-blue-300">{t("Building or renovating?")}</span>
              <h2 className="mt-2 text-2xl font-extrabold uppercase leading-tight tracking-tight md:text-4xl">{t("One price for your whole house.")}</h2>
              <p className="mt-3 text-slate-300">
                {t("Tell us the rooms and the number of lights, plugs and fans. We will send a complete item list with our best discount.")}
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link href={`${base}/quote`} className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-bold text-slate-900 hover:bg-blue-50">
                  <ClipboardList className="h-4 w-4" /> {t("Ask for a quotation")}
                </Link>
                {store.phone && (
                  <a href={`tel:${store.phone}`} className="inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-bold text-white ring-1 ring-white/25 hover:bg-white/10">
                    <Phone className="h-4 w-4" /> {store.phone}
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* Send a photo of the electrician's paper list */}
          <div className="flex flex-col justify-center rounded-xl border-2 border-dashed border-(--s-accent)/40 bg-(--s-accent-soft)/50 p-8 md:p-10">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-(--s-accent) text-white shadow-lg">
              <Camera className="h-7 w-7" />
            </span>
            <h2 className="mt-4 text-2xl font-extrabold tracking-tight text-(--s-ink)">{t("Have a list from your electrician?")}</h2>
            <p className="mt-2 text-(--s-ink-2)">
              {t("Take a photo of the paper list and send it. We will price every item and send you one quotation.")}
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href={`${base}/quote?mode=list`}
                className="inline-flex h-12 items-center gap-2 rounded-full bg-(--s-accent) px-6 text-[15px] font-bold text-white transition hover:bg-(--s-accent-hover)"
              >
                <Camera className="h-4 w-4" /> {t("Upload photo")}
              </Link>
              {waList && (
                <a
                  href={waList}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-12 items-center gap-2 rounded-full bg-[#25D366] px-6 text-[15px] font-bold text-white transition hover:bg-[#1ebe5a]"
                >
                  <WhatsAppIcon className="h-5 w-5" /> {t("Send on WhatsApp")}
                </a>
              )}
            </div>
          </div>
        </section>

        {/* ---------- New arrivals ---------- */}
        {newest.length > 0 && (
          <section className={wrap}>
            <ScrollRow title={t("New arrivals")} href={`${base}/products?sort=newest`}>
              {newest.slice(0, 16).map((p) => (
                <div key={p.id} className="w-[46%] shrink-0 snap-start sm:w-[220px] xl:w-[240px]">
                  <ProductCard p={p} base={base} />
                </div>
              ))}
            </ScrollRow>
          </section>
        )}

        {/* ---------- Visit our shop (address, map, hours, delivery) ---------- */}
        <section className={wrap}>
          <VisitShop store={store} delivery={delivery} t={t} />
        </section>

        {!all.length && !tree.length && (
          <div className={`${wrap} py-16 text-center text-(--s-muted)`}>
            <ImageOff className="mx-auto h-10 w-10" />
            <p className="mt-3">{t("Our online shop is opening soon. Please check back shortly.")}</p>
          </div>
        )}
      </div>
    </div>
  );
}

/** Picture tile in the hero's 2x2 grid: image, name, price and a save badge. */
function HeroTile({ p, base }: { p: ShopProductCard; base: string }) {
  return (
    <Link href={`${base}/p/${p.slug}`} className="group block min-w-0">
      <div className="relative aspect-[16/11] overflow-hidden rounded-lg bg-white ring-1 ring-(--s-line)">
        {p.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.image} alt={p.name} className="h-full w-full object-contain p-3 transition duration-300 group-hover:scale-105" />
        ) : (
          <ImageOff className="absolute inset-0 m-auto h-8 w-8 text-slate-300" />
        )}
      </div>
      <h3 className="mt-2.5 line-clamp-2 text-[15px] font-semibold leading-snug group-hover:underline">{p.name}</h3>
      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="text-sm font-bold">{rs(p.price)}</span>
        {p.discountPct > 0 && p.mrp > p.price && <span className="text-xs text-(--s-muted) line-through">{rs(p.mrp)}</span>}
        {p.discountPct > 0 && (
          <span className="rounded-sm bg-red-600 px-1.5 py-0.5 text-[12px] font-extrabold uppercase tracking-wide text-white">Save {Math.round(p.discountPct)}%</span>
        )}
      </div>
    </Link>
  );
}

/** Row in the hero's right-hand list: underlined name + price, small picture on the right. */
function SideItem({ p, base }: { p: ShopProductCard; base: string }) {
  return (
    <Link href={`${base}/p/${p.slug}`} className="group flex items-start gap-4 border-t border-(--s-line) py-4">
      <div className="min-w-0 flex-1">
        <h3 className="line-clamp-2 text-[15px] font-semibold leading-snug underline-offset-2 group-hover:underline">{p.name}</h3>
        <div className="mt-1 flex items-center gap-2 text-sm">
          <span className="font-bold">{rs(p.price)}</span>
          {p.discountPct > 0 && p.mrp > p.price && <span className="text-xs text-(--s-muted) line-through">{rs(p.mrp)}</span>}
        </div>
      </div>
      <div className="h-14 w-14 shrink-0 overflow-hidden rounded-md bg-white ring-1 ring-(--s-line)">
        {p.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.image} alt="" className="h-full w-full object-contain p-1" />
        ) : null}
      </div>
    </Link>
  );
}

/**
 * Items for the black strip: only the promotions set in the website portal
 * (Home Promo Strip). No promotions → the strip is not shown.
 */
function buildStrip(promos: PromoStripItem[], all: ShopProductCard[]) {
  const maxOff = (list: ShopProductCard[]) => Math.max(0, ...list.filter((p) => p.available).map((p) => Math.round(p.discountPct)));
  const fromPromos = promos.map((p) => {
    let badge: string | null = null;
    if (p.badgeMode === "text") badge = p.badgeText;
    if (p.badgeMode === "auto") {
      const list =
        p.linkType === "category"
          ? all.filter((x) => p.targetId && x.categoryIds.includes(p.targetId))
          : p.linkType === "brand"
            ? all.filter((x) => p.targetId && (x.brandId === p.targetId || x.subBrandId === p.targetId))
            : p.linkType === "product"
              ? all.filter((x) => x.slug === p.targetId)
              : [];
      const off = maxOff(list);
      if (off > 0) badge = p.linkType === "product" ? `${off}% OFF` : `Up to ${off}%`;
    }
    const productImage = p.linkType === "product" ? all.find((x) => x.slug === p.targetId)?.image : null;
    return {
      key: p.id,
      title: p.title,
      link: p.link,
      imageUrl: p.imageUrl || productImage || null,
      Icon: getCategoryIcon(p.title),
      badge,
      color: p.badgeColor,
    };
  });
  return fromPromos;
}
