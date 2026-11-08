import { rs } from "./format";

/** Discount price with the MRP crossed out and a "% off" badge. */
export function Price({
  price,
  mrp,
  discountPct,
  size = "md",
}: {
  price: number;
  mrp: number;
  discountPct: number;
  size?: "md" | "lg";
}) {
  if (!price) return <span className="text-sm font-medium text-(--s-muted)">Ask for price</span>;
  const off = discountPct > 0 && mrp > price;
  const lg = size === "lg";
  return (
    <div className="flex flex-wrap items-baseline justify-center gap-x-2 gap-y-1">
      <span className={`${lg ? "text-2xl md:text-3xl" : "text-[16px]"} font-extrabold tracking-tight text-(--s-ink)`}>{rs(price)}</span>
      {off && (
        <>
          <span className={`${lg ? "text-base" : "text-xs"} font-medium text-(--s-muted) line-through decoration-(--s-muted)/70`}>{rs(mrp)}</span>
          {lg && (
            <span className="rounded-full bg-(--s-accent) px-2.5 py-0.5 text-xs font-bold text-(--s-accent-ink)">{discountPct}% OFF</span>
          )}
        </>
      )}
    </div>
  );
}
