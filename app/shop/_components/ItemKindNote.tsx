"use client";

import { PackageSearch, Phone, Scissors } from "lucide-react";
import { useShop } from "./ShopContext";
import { whatsappLink } from "./format";
import { WhatsAppIcon } from "./WhatsAppButton";

export type ItemKind = "normal" | "special" | "cut";

/** Small tag on product cards and cart lines: "Special order" / "Cut to length". */
export function ItemKindTag({ kind, leadTime }: { kind: ItemKind; leadTime?: string | null }) {
  const { t } = useShop();
  if (kind === "special")
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/15 px-1.5 py-0.5 text-[12px] font-bold text-amber-700 dark:text-amber-300">
        <PackageSearch className="h-3.5 w-3.5" /> {t("Special order")}
        {leadTime ? ` · ${leadTime}` : ""}
      </span>
    );
  if (kind === "cut")
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-slate-500/15 px-1.5 py-0.5 text-[12px] font-bold text-(--s-ink-2)">
        <Scissors className="h-3.5 w-3.5" /> {t("Cut to length")}
      </span>
    );
  return null;
}

/**
 * The explanation box (product page, cart, checkout):
 *  - special: we order it from the supplier; we'll contact you about an advance → WhatsApp / Call
 *  - cut: cut to the length you order, can't be returned
 */
export function ItemKindNote({ kind, leadTime, itemName }: { kind: ItemKind; leadTime?: string | null; itemName?: string }) {
  const { t, store } = useShop();
  if (kind === "cut")
    return (
      <div className="flex gap-3 rounded-2xl border border-(--s-line) bg-(--s-soft) p-4 text-sm">
        <Scissors className="mt-0.5 h-5 w-5 shrink-0 text-(--s-ink-2)" />
        <div>
          <div className="font-bold text-(--s-ink)">{t("Cut to length")}</div>
          <p className="mt-0.5 text-(--s-ink-2)">{t("We cut this to the length you order. Cut pieces can't be returned.")}</p>
        </div>
      </div>
    );
  if (kind !== "special") return null;

  const wa = whatsappLink(store.whatsapp, itemName ? `Hi, about the special order item: ${itemName}` : "Hi, about a special order item.");
  return (
    <div className="rounded-2xl border-2 border-amber-500/40 bg-amber-500/10 p-4 text-sm">
      <div className="flex gap-3">
        <PackageSearch className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
        <div>
          <div className="font-bold text-(--s-ink)">
            {t("Special order item")}
            {leadTime ? ` · ${t("about {time}", { time: leadTime })}` : ""}
          </div>
          <p className="mt-0.5 text-(--s-ink-2)">
            {t("We order this from the supplier for you. After you place the order, we will contact you about an advance payment before we confirm it.")}
          </p>
        </div>
      </div>
      {(wa || store.phone) && (
        <div className="mt-3 flex flex-wrap gap-2 pl-8">
          {wa && (
            <a
              href={wa}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-9 items-center gap-1.5 rounded-full bg-[#25D366] px-4 text-[13px] font-bold text-white hover:bg-[#1ebe5a]"
            >
              <WhatsAppIcon className="h-4 w-4" /> {t("Ask on WhatsApp")}
            </a>
          )}
          {store.phone && (
            <a
              href={`tel:${store.phone}`}
              className="inline-flex h-9 items-center gap-1.5 rounded-full border border-(--s-line) bg-(--s-surface) px-4 text-[13px] font-bold text-(--s-ink) hover:border-(--s-accent)"
            >
              <Phone className="h-4 w-4" /> {t("Call us")}
            </a>
          )}
        </div>
      )}
    </div>
  );
}
