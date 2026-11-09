"use client";

import { useRef } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * A section with a big heading, "View all" and ‹ › arrows, and one row of
 * cards that scrolls sideways (swipe on phones, arrows on computers).
 */
export function ScrollRow({
  title,
  href,
  linkLabel = "View all",
  children,
}: {
  title: string;
  href?: string;
  linkLabel?: string;
  children: React.ReactNode;
}) {
  const row = useRef<HTMLDivElement>(null);
  const move = (dir: 1 | -1) => {
    const el = row.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: "smooth" });
  };

  return (
    <div>
      <div className="mb-5 flex items-end justify-between gap-4">
        <h2 className="shop-display">{title}</h2>
        <div className="flex shrink-0 items-center gap-1">
          {href && (
            <Link href={href} className="mr-2 text-sm font-bold hover:underline md:text-base">
              {linkLabel}
            </Link>
          )}
          <button
            onClick={() => move(-1)}
            aria-label="Scroll left"
            className="hidden h-9 w-9 items-center justify-center rounded-full text-(--s-ink-2) transition hover:bg-(--s-soft) hover:text-(--s-ink) sm:flex"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            onClick={() => move(1)}
            aria-label="Scroll right"
            className="hidden h-9 w-9 items-center justify-center rounded-full text-(--s-ink) transition hover:bg-(--s-soft) sm:flex"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>
      <div ref={row} className="shop-noscroll -mx-4 flex snap-x gap-3 overflow-x-auto scroll-px-4 px-4 pb-2 sm:gap-4 md:mx-0 md:scroll-px-0 md:px-0">
        {children}
      </div>
    </div>
  );
}
