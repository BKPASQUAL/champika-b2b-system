"use client";

import { useState } from "react";
import { ImageOff } from "lucide-react";

export function Gallery({ images, name, discountPct }: { images: string[]; name: string; discountPct?: number }) {
  const [i, setI] = useState(0);
  if (!images.length)
    return (
      <div className="flex aspect-square max-w-[480px] items-center justify-center rounded-3xl border border-(--s-line) bg-(--s-surface) text-slate-300 shadow-[0_4px_24px_-8px_rgba(15,23,42,0.06)]">
        <ImageOff className="h-16 w-16" />
      </div>
    );
  return (
    <div className="w-full max-w-[480px] space-y-3 lg:mx-auto">
      <div className="group relative aspect-square overflow-hidden rounded-3xl border border-(--s-line) bg-(--s-surface) shadow-[0_8px_30px_-10px_rgba(15,23,42,0.08)]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={images[i]}
          alt={name}
          className="h-full w-full object-cover transition duration-500 ease-out group-hover:scale-[1.03]"
        />
        {!!discountPct && discountPct > 0 && (
          <span className="absolute left-4 top-4 rounded-full bg-gradient-to-r from-rose-600 to-red-500 px-3 py-1 text-xs font-extrabold tracking-tight text-white shadow-md ring-1 ring-white/20">
            -{discountPct}% OFF
          </span>
        )}
      </div>
      {images.length > 1 && (
        <div className="flex gap-2.5 overflow-x-auto pb-1">
          {images.map((src, idx) => (
            <button
              key={src + idx}
              onClick={() => setI(idx)}
              aria-label={`Photo ${idx + 1}`}
              className={`h-18 w-18 shrink-0 cursor-pointer overflow-hidden rounded-2xl border-2 bg-(--s-surface) transition ${idx === i
                  ? "border-blue-600 shadow-[0_2px_10px_rgba(37,99,235,0.25)]"
                  : "border-(--s-line) opacity-75 hover:opacity-100"
                }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
