import Link from "next/link";
import { ArrowRight, Building2, Camera, ClipboardList, MessageCircle, Phone, ShieldCheck, Truck, Wallet } from "lucide-react";
import {
  getCategoryTree,
  getFeaturedBrands,
  getProducts,
  getShopBase,
  getStoreInfo,
  sortProducts,
} from "@/lib/shop-data";
import { ProductGrid } from "./ProductCard";
import { whatsappLink } from "./format";
import { getT } from "./lang-server";

const wrap = "mx-auto max-w-[1440px] px-4 md:px-6 xl:px-8";

/**
 * Champika Hardware & Distribution home page (approved design):
 * dark hero with red slanted stripes + Quick Quote card, then the project /
 * trade boxes, popular products, brands and why-us. Wholesale prices only.
 */
export async function ChampikaHome() {
  const [base, tree, all, brands, store, t] = await Promise.all([
    getShopBase(),
    getCategoryTree(),
    getProducts(),
    getFeaturedBrands(),
    getStoreInfo(),
    getT(),
  ]);
  const featured = sortProducts(all.filter((p) => p.isFeatured), "popular");
  const popular = (featured.length ? featured : sortProducts(all, "popular")).slice(0, 8);
  const wa = whatsappLink(store.whatsapp, "Hi, I'd like a wholesale price list / quotation.");
  const waList = whatsappLink(store.whatsapp, "Hi, I am sending a photo of my item list. Please send me your wholesale prices.");

  return (
    <div className="pb-6">
      {/* ---------- Hero ---------- */}
      <section className="relative overflow-hidden bg-(--s-bar) text-white">
        <div aria-hidden className="pointer-events-none absolute -right-28 -top-10 h-[120%] w-[30%] min-w-[260px] -skew-x-[32deg] bg-[#d50f0f]" />
        <div aria-hidden className="pointer-events-none absolute -top-10 right-[29%] hidden h-[120%] w-6 -skew-x-[32deg] bg-[#d50f0f] md:block" />
        <div className={`${wrap} relative flex flex-wrap items-center gap-10 py-14 md:py-20`}>
          <div className="min-w-0 max-w-2xl flex-[1_1_520px]">
            <p className="ch-display mb-3.5 text-[12.5px] font-bold uppercase tracking-[0.18em] text-[#ff8378]">
              {t("Wholesale · For hardware shops & contractors")}
            </p>
            <h1 className="ch-display text-[clamp(34px,5vw,58px)] font-black leading-[1.04]">
              {t("Stock your shop direct from the distributor.")}
            </h1>
            <p className="mt-5 max-w-xl text-[17px] leading-7 text-[#c3ccd9]">
              {t("Wholesale prices on every item, carton and bulk rates, and delivery by our own lorries on fixed routes.")}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href={`${base}/products`} className="inline-flex items-center gap-2 rounded-xl bg-[#d50f0f] px-6 py-3.5 text-[15px] font-bold text-white transition hover:bg-[#b80d0d]">
                {t("See wholesale prices")} <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
              <Link href={`${base}/login`} className="inline-flex items-center rounded-xl border-2 border-[#33445e] px-6 py-3 text-[15px] font-semibold text-white transition hover:border-white">
                {t("Open a trade account")}
              </Link>
            </div>
          </div>

          {/* Quick quote card */}
          <div className="flex min-w-0 flex-[1_1_340px] justify-center">
            <div className="w-full max-w-sm rounded-2xl bg-(--s-surface) p-6 text-(--s-ink) shadow-[0_24px_60px_rgba(0,0,0,.35)]">
              <p className="text-[12.5px] font-bold uppercase tracking-[0.08em] text-(--s-muted)">{t("Quick quote")}</p>
              <p className="ch-display mb-4 mt-1.5 text-[22px] font-extrabold">{t("Send us your item list")}</p>
              <div className="flex flex-col gap-2.5">
                <Link href={`${base}/quote?mode=list`} className="flex items-center gap-3 rounded-xl border border-(--s-line) p-3.5 font-semibold transition hover:border-[#d50f0f]">
                  <Camera className="h-5 w-5 shrink-0 text-[#d50f0f]" aria-hidden /> {t("Upload a photo of your list")}
                </Link>
                <Link href={`${base}/quote`} className="flex items-center gap-3 rounded-xl border border-(--s-line) p-3.5 font-semibold transition hover:border-[#d50f0f]">
                  <Building2 className="h-5 w-5 shrink-0 text-[#d50f0f]" aria-hidden /> {t("Big project? Send your BOQ")}
                </Link>
                {wa ? (
                  <a href={wa} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-xl border border-(--s-line) p-3.5 font-semibold transition hover:border-[#d50f0f]">
                    <MessageCircle className="h-5 w-5 shrink-0 text-[#d50f0f]" aria-hidden /> {t("Chat on WhatsApp")}
                  </a>
                ) : (
                  <Link href={`${base}/quick-order`} className="flex items-center gap-3 rounded-xl border border-(--s-line) p-3.5 font-semibold transition hover:border-[#d50f0f]">
                    <ClipboardList className="h-5 w-5 shrink-0 text-[#d50f0f]" aria-hidden /> {t("Quick order by item name")}
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- Project / trade boxes ---------- */}
      <section className={`${wrap} pt-12`}>
        <div className="grid gap-5 md:grid-cols-2">
          <div className="flex flex-col gap-3.5 rounded-2xl border border-(--s-line) bg-(--s-surface) p-7">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-(--s-accent-soft)">
                <Building2 className="h-5 w-5 text-[#b80d0d]" aria-hidden />
              </span>
              <h2 className="ch-display text-[22px] font-extrabold">{t("Big project or site order?")}</h2>
            </div>
            <ul className="list-disc space-y-1 pl-5 text-(--s-ink-2)">
              <li>{t("Send your full item list or BOQ")}</li>
              <li>{t("We price it at wholesale rates")}</li>
              <li>{t("Delivered straight to your site")}</li>
            </ul>
            <Link href={`${base}/quote`} className="mt-auto font-bold text-(--s-accent-text) hover:underline">
              {t("Get a project quote")} →
            </Link>
          </div>
          <div className="flex flex-col gap-3.5 rounded-2xl bg-(--s-bar) p-7 text-white">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#d50f0f]">
                <Truck className="h-5 w-5" aria-hidden />
              </span>
              <h2 className="ch-display text-[22px] font-extrabold">{t("Wholesale — supply for your shop")}</h2>
            </div>
            <ul className="list-disc space-y-1 pl-5 text-[#c3ccd9]">
              <li>{t("Carton and bulk prices on every item")}</li>
              <li>{t("Order online, by WhatsApp or by phone")}</li>
              <li>{t("Reorder your past orders in one tap")}</li>
            </ul>
            <Link href={`${base}/login`} className="mt-auto font-bold text-[#ff8378] hover:underline">
              {t("Open a trade account")} →
            </Link>
          </div>
        </div>
      </section>

      {/* ---------- Categories (text cards) ---------- */}
      {tree.length > 0 && (
        <section className={`${wrap} pt-12`}>
          <div className="mb-5 flex items-end justify-between gap-4">
            <h2 className="ch-display text-[28px] font-extrabold">{t("Shop by category")}</h2>
            <Link href={`${base}/categories`} className="font-semibold text-(--s-accent-text) hover:underline">{t("See all")}</Link>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {tree.slice(0, 12).map((c) => (
              <Link
                key={c.slug}
                href={`${base}/c/${c.slug}`}
                className="flex min-h-24 flex-col justify-between gap-2 rounded-2xl border border-(--s-line) border-t-4 border-t-[#d50f0f] bg-(--s-surface) p-4 transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <span className="ch-display text-[15px] font-extrabold leading-tight">{c.name}</span>
                <span className="text-[13px] text-(--s-muted)">
                  {c.productCount ? (c.productCount === 1 ? t("1 item") : t("{n} items", { n: c.productCount })) : t("Coming soon")}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ---------- Popular products ---------- */}
      {popular.length > 0 && (
        <section className={`${wrap} pt-12`}>
          <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="ch-display text-[28px] font-extrabold">{t("Popular this month")}</h2>
              <p className="mt-1 text-(--s-muted)">{t("Wholesale prices. Bigger packs get a lower price.")}</p>
            </div>
            <Link href={`${base}/products`} className="font-semibold text-(--s-accent-text) hover:underline">{t("See all products")}</Link>
          </div>
          <ProductGrid products={popular} base={base} />
        </section>
      )}

      {/* ---------- Brands ---------- */}
      {brands.length > 0 && (
        <section className={`${wrap} pt-14`}>
          <h2 className="ch-display mb-5 text-[28px] font-extrabold">{t("Brands we distribute")}</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {brands.slice(0, 12).map((b) => (
              <Link
                key={b.id}
                href={`${base}/b/${b.slug}`}
                className="flex h-20 items-center justify-center rounded-2xl border border-(--s-line) bg-(--s-surface) px-3 transition hover:border-[#d50f0f]"
              >
                {b.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={b.logoUrl} alt={b.name} className="max-h-12 max-w-full object-contain" loading="lazy" />
                ) : (
                  <span className="ch-display text-lg font-extrabold">{b.name}</span>
                )}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ---------- Why us ---------- */}
      <section className={`${wrap} pt-14`}>
        <div className="grid gap-7 border-t border-(--s-line) pt-10 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: ShieldCheck, title: t("Direct from the distributor"), text: t("Genuine stock, straight from our warehouse — no middle shop.") },
            { icon: Truck, title: t("Our own delivery routes"), text: t("Shops on our lorry routes get orders on the next route day.") },
            { icon: Wallet, title: t("Pay the way you like"), text: t("Cash on delivery or bank transfer.") },
            { icon: Phone, title: t("Help in Sinhala & English"), text: t("Call or WhatsApp us — we will build the order for you.") },
          ].map((f) => (
            <div key={f.title} className="flex gap-3">
              <f.icon className="mt-0.5 h-5 w-5 shrink-0 text-[#d50f0f]" aria-hidden />
              <div>
                <p className="ch-display text-[17px] font-extrabold">{f.title}</p>
                <p className="mt-1.5 leading-6 text-(--s-muted)">{f.text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {waList && (
        <p className={`${wrap} pt-8 text-sm text-(--s-muted)`}>
          {t("Have a written list?")}{" "}
          <a href={waList} target="_blank" rel="noopener noreferrer" className="font-semibold text-(--s-accent-text) hover:underline">
            {t("Send a photo on WhatsApp")}
          </a>
        </p>
      )}
    </div>
  );
}
