"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { rs } from "./format";

/** Two-handle price slider. Updates ?min=&max= when a handle is let go. */
export function PriceRange({ lo, hi, min, max }: { lo: number; hi: number; min: number; max: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [a, setA] = useState(min);
  const [b, setB] = useState(max);

  useEffect(() => {
    setA(min);
    setB(max);
  }, [min, max]);

  const step = Math.max(1, Math.round((hi - lo) / 100));
  const pct = (v: number) => ((v - lo) / (hi - lo)) * 100;

  const apply = () => {
    const next = new URLSearchParams(params.toString());
    a > lo ? next.set("min", String(a)) : next.delete("min");
    b < hi ? next.set("max", String(b)) : next.delete("max");
    const qs = next.toString();
    router.push(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
  };

  const thumb =
    "pointer-events-none absolute inset-0 h-5 w-full appearance-none bg-transparent [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-[3px] [&::-webkit-slider-thumb]:border-black [&::-webkit-slider-thumb]:bg-(--s-accent) [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-[3px] [&::-moz-range-thumb]:border-black [&::-moz-range-thumb]:bg-(--s-accent)";

  return (
    <div className="w-full max-w-xs">
      <div className="text-xs font-semibold text-(--s-muted)">Price range</div>
      <div className="mt-0.5 text-sm font-semibold text-(--s-ink)">
        {rs(a)} <span className="text-(--s-muted)">–</span> {rs(b)}
      </div>
      <div className="relative mt-3 h-5">
        <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-(--s-line)" />
        <div className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-(--s-accent)" style={{ left: `${pct(a)}%`, right: `${100 - pct(b)}%` }} />
        <input
          aria-label="Lowest price"
          type="range"
          min={lo}
          max={hi}
          step={step}
          value={a}
          onChange={(e) => setA(Math.min(Number(e.target.value), b))}
          onPointerUp={apply}
          onKeyUp={apply}
          className={thumb}
        />
        <input
          aria-label="Highest price"
          type="range"
          min={lo}
          max={hi}
          step={step}
          value={b}
          onChange={(e) => setB(Math.max(Number(e.target.value), a))}
          onPointerUp={apply}
          onKeyUp={apply}
          className={thumb}
        />
      </div>
    </div>
  );
}
