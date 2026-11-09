"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

type Banner = { id: string; title: string | null; imageUrl: string; link: string | null };

/** Full-width banner carousel; moves every 5 seconds. */
export function BannerSlider({ banners }: { banners: Banner[] }) {
  const [i, setI] = useState(0);
  const n = banners.length;

  useEffect(() => {
    if (n < 2) return;
    const t = setInterval(() => setI((x) => (x + 1) % n), 5000);
    return () => clearInterval(t);
  }, [n]);

  return (
    <section className="relative mx-auto overflow-hidden sm:px-6 xl:px-10">
      <div className="relative aspect-[16/7] overflow-hidden bg-(--s-soft) sm:rounded-3xl md:aspect-[16/5]">
        {banners.map((b, idx) => {
          const img = (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={b.imageUrl} alt={b.title || "Offer"} className="h-full w-full object-cover" loading={idx === 0 ? "eager" : "lazy"} />
          );
          return (
            <div key={b.id} className={`absolute inset-0 transition-opacity duration-700 ${idx === i ? "opacity-100" : "pointer-events-none opacity-0"}`}>
              {b.link ? <a href={b.link} className="block h-full">{img}</a> : img}
            </div>
          );
        })}
        {n > 1 && (
          <>
            <button aria-label="Previous" onClick={() => setI((i - 1 + n) % n)} className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-2 text-black shadow hover:bg-white">
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button aria-label="Next" onClick={() => setI((i + 1) % n)} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-2 text-black shadow hover:bg-white">
              <ChevronRight className="h-5 w-5" />
            </button>
            <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
              {banners.map((b, idx) => (
                <button key={b.id} aria-label={`Banner ${idx + 1}`} onClick={() => setI(idx)} className={`h-2 rounded-full transition-all ${idx === i ? "w-6 bg-(--s-accent)" : "w-2 bg-white/70"}`} />
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
