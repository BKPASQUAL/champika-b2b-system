"use client";

import { useState } from "react";
import { ImageOff } from "lucide-react";

export function Gallery({ images, name }: { images: string[]; name: string }) {
  const [i, setI] = useState(0);
  if (!images.length)
    return (
      <div className="flex aspect-square items-center justify-center rounded-3xl border border-(--s-line) bg-(--s-img) text-neutral-300">
        <ImageOff className="h-16 w-16" />
      </div>
    );
  return (
    <div className="space-y-3">
      <div className="aspect-square overflow-hidden rounded-3xl border border-(--s-line) bg-(--s-img)">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={images[i]} alt={name} className="h-full w-full object-contain p-4" />
      </div>
      {images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto">
          {images.map((src, idx) => (
            <button
              key={src + idx}
              onClick={() => setI(idx)}
              aria-label={`Photo ${idx + 1}`}
              className={`h-16 w-16 shrink-0 overflow-hidden rounded-xl border-2 bg-(--s-img) ${idx === i ? "border-(--s-ink)" : "border-(--s-line)"}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" className="h-full w-full object-contain p-1" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
