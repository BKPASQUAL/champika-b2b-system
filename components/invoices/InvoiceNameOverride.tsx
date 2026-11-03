"use client";

import React, { useEffect, useState } from "react";
import { Pencil, X } from "lucide-react";
import { Input } from "@/components/ui/input";

/**
 * Optional per-invoice item name.
 * Hidden behind a small "Rename on invoice" link; only opens when needed.
 * Empty value = print the normal product name.
 */
export function InvoiceNameOverride({
  value,
  onChange,
  productId,
  productName,
  disabled,
  onKeyDown,
}: {
  value: string;
  onChange: (value: string) => void;
  productId: string;
  productName?: string;
  disabled?: boolean;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}) {
  const [opened, setOpened] = useState(false);

  // Close again when a different product is picked
  useEffect(() => {
    setOpened(false);
  }, [productId]);

  if (!productId) return null;

  const isOpen = opened || !!value;

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setOpened(true)}
        disabled={disabled}
        className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline disabled:opacity-50 disabled:no-underline"
      >
        <Pencil className="w-3 h-3" />
        Rename on invoice
      </button>
    );
  }

  return (
    <div className="rounded-md border border-blue-200 bg-blue-50/50 p-2 space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-blue-700">
          Name printed on this invoice only
        </span>
        <button
          type="button"
          onClick={() => {
            onChange("");
            setOpened(false);
          }}
          disabled={disabled}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive"
          title="Remove rename (use product name)"
        >
          <X className="w-3 h-3" />
          Remove
        </button>
      </div>
      <Input
        autoFocus={!value}
        placeholder={productName || "Item name on invoice"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        disabled={disabled}
        className="bg-background"
      />
      {productName && (
        <p className="text-[11px] text-muted-foreground">
          Product stays as: {productName}
        </p>
      )}
    </div>
  );
}
