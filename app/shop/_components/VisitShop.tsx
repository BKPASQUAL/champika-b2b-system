import { Banknote, Clock, MapPin, Navigation, Phone, ShieldCheck, Truck } from "lucide-react";
import type { DeliveryInfo, StoreInfo } from "@/lib/shop-data";
import { rs, whatsappLink } from "./format";
import type { T } from "./i18n";
import { WhatsAppIcon } from "./WhatsAppButton";

/**
 * "Visit our shop": address with a map, hours, phone, WhatsApp, delivery areas
 * and cash on delivery. Builds trust: customers see a real shop they can visit.
 * Hidden until the address or phone is saved in Website → Settings.
 */
export function VisitShop({ store, delivery, t }: { store: StoreInfo; delivery: DeliveryInfo; t: T }) {
  if (!store.address && !store.phone) return null;
  const wa = whatsappLink(store.whatsapp, "Hi, I have a question.");
  const directions = store.mapUrl || (store.address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(store.address)}` : "");
  const feeText =
    delivery.flatFee > 0
      ? `${t("Delivery fee")}: ${rs(delivery.flatFee)}${delivery.freeOver > 0 ? ` · ${t("Free delivery over {amount}", { amount: rs(delivery.freeOver) })}` : ""}`
      : t("Free delivery");

  return (
    <div className="grid overflow-hidden rounded-2xl border border-(--s-line) bg-(--s-surface) lg:grid-cols-2">
      <div className="p-6 md:p-8">
        <h2 className="shop-display">{t("Visit our shop")}</h2>
        <p className="mt-1 text-(--s-muted)">{t("A real shop you can call and visit")}</p>

        <ul className="mt-6 space-y-4 text-[15px]">
          {store.address && (
            <li className="flex gap-3">
              <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-(--s-accent)" />
              <span className="font-semibold text-(--s-ink)">{store.address}</span>
            </li>
          )}
          {store.hours && (
            <li className="flex gap-3">
              <Clock className="mt-0.5 h-5 w-5 shrink-0 text-(--s-accent)" />
              <span>
                <span className="block text-sm text-(--s-muted)">{t("Opening hours")}</span>
                <span className="font-semibold text-(--s-ink)">{store.hours}</span>
              </span>
            </li>
          )}
          <li className="flex gap-3">
            <Truck className="mt-0.5 h-5 w-5 shrink-0 text-(--s-accent)" />
            <span>
              <span className="block text-sm text-(--s-muted)">{t("We deliver to")}</span>
              <span className="font-semibold text-(--s-ink)">{delivery.areas || t("Galle area delivery")}</span>
              <span className="block text-sm text-(--s-ink-2)">{feeText}</span>
            </span>
          </li>
        </ul>

        <div className="mt-5 flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1.5 text-sm font-bold text-emerald-700 dark:text-emerald-300">
            <Banknote className="h-4 w-4" /> {t("Cash on delivery")}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/10 px-3 py-1.5 text-sm font-bold text-(--s-accent)">
            <ShieldCheck className="h-4 w-4" /> {t("Genuine brands")}
          </span>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          {store.phone && (
            <a
              href={`tel:${store.phone}`}
              className="inline-flex h-12 items-center gap-2 rounded-full bg-(--s-btn) px-6 text-[15px] font-bold text-(--s-btn-ink) transition hover:opacity-90"
            >
              <Phone className="h-4 w-4" /> {t("Call us")}: {store.phone}
            </a>
          )}
          {wa && (
            <a
              href={wa}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-12 items-center gap-2 rounded-full bg-[#25D366] px-6 text-[15px] font-bold text-white transition hover:bg-[#1ebe5a]"
            >
              <WhatsAppIcon className="h-5 w-5" /> WhatsApp
            </a>
          )}
          {directions && (
            <a
              href={directions}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-12 items-center gap-2 rounded-full border border-(--s-line) px-6 text-[15px] font-bold text-(--s-ink) transition hover:border-(--s-accent) hover:text-(--s-accent)"
            >
              <Navigation className="h-4 w-4" /> {t("Get directions")}
            </a>
          )}
        </div>
      </div>

      {store.address ? (
        <iframe
          title="Map"
          src={`https://maps.google.com/maps?q=${encodeURIComponent(store.address)}&z=15&output=embed`}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          className="h-72 w-full border-0 lg:h-full lg:min-h-[360px]"
        />
      ) : (
        <div className="hidden bg-(--s-soft) lg:block" />
      )}
    </div>
  );
}
