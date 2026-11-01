"use client";

import React, { useState } from "react";
import { Input } from "@/components/ui/input";

type Num = number | string | "";

const toNum = (v: Num) => {
  const n = typeof v === "number" ? v : parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};

/**
 * Discount off MRP: MRP -> Disc % -> Unit Price.
 * Shows how far the unit price is below MRP. Typing a % sets the unit price
 * to MRP x (1 - Disc%). Disabled when there is no MRP.
 */
export function MrpDiscountInput({
  mrp,
  unitPrice,
  onUnitPriceChange,
  onKeyDown,
  className,
}: {
  mrp: Num;
  unitPrice: Num;
  onUnitPriceChange: (price: number) => void;
  onKeyDown?: React.KeyboardEventHandler<HTMLInputElement>;
  className?: string;
}) {
  // Text being typed; null means show the value worked out from MRP and price
  const [text, setText] = useState<string | null>(null);
  const m = toNum(mrp);
  const p = toNum(unitPrice);
  const derived = m > 0 ? String(parseFloat((((m - p) / m) * 100).toFixed(2))) : "";

  return (
    <Input
      type="text"
      inputMode="decimal"
      placeholder="0"
      disabled={m <= 0}
      className={className}
      value={text ?? derived}
      onFocus={(e) => e.target.select()}
      onChange={(e) => {
        const t = e.target.value;
        // Numbers only, up to 2 decimals, max 100
        if (!/^\d{0,3}(\.\d{0,2})?$/.test(t)) return;
        if (parseFloat(t) > 100) return;
        setText(t);
        const d = parseFloat(t) || 0;
        onUnitPriceChange(parseFloat((m * (1 - d / 100)).toFixed(2)));
      }}
      onBlur={() => setText(null)}
      onKeyDown={onKeyDown}
    />
  );
}
