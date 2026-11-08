"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ClipboardList, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useShop } from "./ShopContext";

/** "Buying a lot? Ask for a quotation" — sends the whole cart to the office for a better price. */
export function QuoteFromCart({ disabled }: { disabled?: boolean }) {
  const { cart, customer, href, clear } = useShop();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const send = async () => {
    if (!customer) {
      router.push(`${href("/login")}?next=${encodeURIComponent("/cart")}`);
      return;
    }
    if (!confirm("Send this cart to us for a quotation? We'll reply with our best price.")) return;
    setBusy(true);
    const res = await fetch("/api/storefront/quotes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "cart", items: cart }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setBusy(false);
      toast.error(json.error || "Could not send. Please try again.");
      return;
    }
    clear();
    router.replace(`${href(`/account/quotes/${json.quoteNo}`)}?sent=1`);
  };

  return (
    <button
      type="button"
      onClick={send}
      disabled={busy || disabled}
      className="flex w-full items-center justify-center gap-2 rounded-full border border-(--s-line) py-3 text-sm font-semibold text-(--s-ink) transition hover:border-(--s-ink) disabled:opacity-50"
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardList className="h-4 w-4" />}
      Buying a lot? Ask for a quotation
    </button>
  );
}
