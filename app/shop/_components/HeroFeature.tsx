"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, ListChecks, MapPin, Search } from "lucide-react";
import { useShop } from "./ShopContext";

type Banner = { id: string; title: string | null; imageUrl: string; link: string | null };

/** Background photo for the welcome hero. Put the file in /public with this name. */
const HERO_BG = "/hero-bg.jpg";

/**
 * The big panel at the top-left of the home page. Shows the offer banners
 * (changing every 6 seconds) with their title in the bottom-left corner.
 * With no banners it shows a "Wire your home" welcome panel instead.
 */
export function HeroFeature({ banners, base }: { banners: Banner[]; base: string }) {
  const [i, setI] = useState(0);
  const { t } = useShop();
  const n = banners.length;

  useEffect(() => {
    if (n < 2) return;
    const timer = setInterval(() => setI((x) => (x + 1) % n), 6000);
    return () => clearInterval(timer);
  }, [n]);

  if (!n) {
    return (
      <div className="relative flex h-full min-h-[340px] flex-col justify-center overflow-hidden rounded-xl bg-slate-900 p-6 text-white md:min-h-[460px] md:p-8">
        {/* Wiring photo (public/hero-bg.jpg), brightened, with a slow zoom. */}
        <div
          className="shop-hero-bg pointer-events-none absolute inset-0 bg-cover bg-right"
          style={{ backgroundImage: `url(${HERO_BG})` }}
        />
        {/* Light blue shade on the left only, so the text stays readable and the board stays bright. */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "linear-gradient(100deg, rgba(29,78,216,0.92) 0%, rgba(30,64,175,0.8) 34%, rgba(30,64,175,0.25) 50%, transparent 62%)",
          }}
        />
        {/* Light sweep across the board every few seconds. */}
        <div className="shop-hero-sweep pointer-events-none absolute inset-0" />
        {/* Phones: the text covers the photo, so darken it from the bottom. */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/90 via-blue-950/55 to-blue-950/20 md:hidden" />
        <div className="shop-hero-in relative max-w-xl md:max-w-[48%]">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[12.5px] font-bold text-sky-200 ring-1 ring-white/15 backdrop-blur-xs">
            <MapPin className="h-3.5 w-3.5" /> {t("House wiring store · Galle area")}
          </span>
          <h1 className="mt-4 text-3xl font-extrabold leading-[1.08] tracking-tight md:text-[clamp(28px,2.6vw,44px)]">
            {t("Wire your home with confidence.")}
          </h1>
          <p className="mt-3 max-w-md text-sm leading-6 text-blue-100/85 md:text-[15px]">
            {t("Genuine cables, switches, sockets and breakers at discount prices — delivered to your door.")}
          </p>
          <form action={`${base}/search`} className="mt-5 flex max-w-md items-center gap-2 rounded-full bg-white p-1.5 pl-4 shadow-[0_8px_30px_rgba(0,0,0,0.3)]">
            <Search className="h-4 w-4 shrink-0 text-slate-400" />
            <input
              name="q"
              type="search"
              placeholder={t("What do you need? e.g. 1/113 wire")}
              className="h-9 min-w-0 flex-1 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
            />
            <button className="h-9 shrink-0 cursor-pointer rounded-full bg-slate-900 px-5 text-sm font-bold text-white transition hover:bg-blue-600">
              {t("Search")}
            </button>
          </form>
          <div className="mt-4 flex flex-wrap gap-2.5">
            <Link href={`${base}/products`} className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-bold text-slate-900 transition hover:bg-blue-50">
              {t("Shop now")} <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href={`${base}/quick-order`}
              className="inline-flex items-center gap-2 rounded-full bg-white/10 px-5 py-2.5 text-sm font-bold text-white ring-1 ring-white/25 transition hover:bg-white/20"
            >
              <ListChecks className="h-4 w-4" /> {t("Quick order")}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full min-h-[300px] overflow-hidden rounded-xl bg-(--s-bar) md:min-h-[460px]">
      {banners.map((b, idx) => {
        const body = (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={b.imageUrl} alt={b.title || "Offer"} className="absolute inset-0 h-full w-full object-cover" loading={idx === 0 ? "eager" : "lazy"} />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
            {b.title && (
              <h2 className="absolute bottom-6 left-6 right-24 text-2xl font-bold leading-tight tracking-tight text-white drop-shadow md:bottom-8 md:left-8 md:text-[32px]">
                {b.title}
              </h2>
            )}
          </>
        );
        return (
          <div key={b.id} className={`absolute inset-0 transition-opacity duration-700 ${idx === i ? "opacity-100" : "pointer-events-none opacity-0"}`}>
            {b.link ? (
              <a href={b.link} className="block h-full">
                {body}
              </a>
            ) : (
              body
            )}
          </div>
        );
      })}
      {n > 1 && (
        <div className="absolute bottom-7 right-6 flex gap-1.5 md:bottom-9 md:right-8">
          {banners.map((b, idx) => (
            <button
              key={b.id}
              aria-label={`Banner ${idx + 1}`}
              onClick={() => setI(idx)}
              className={`h-1.5 rounded-full transition-all ${idx === i ? "w-6 bg-white" : "w-1.5 bg-white/50"}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
