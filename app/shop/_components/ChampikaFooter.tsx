import Link from "next/link";
import { Clock, Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import type { NavCategory } from "./Header";
import type { StoreInfo } from "@/lib/shop-data";
import { whatsappLink } from "./format";
import { makeT, type Lang } from "./i18n";

/** Champika Hardware & Distribution footer: navy with a red top line and a red bottom strip. */
export function ChampikaFooter({ store, categories, base, lang = "en" }: { store: StoreInfo; categories: NavCategory[]; base: string; lang?: Lang }) {
  const t = makeT(lang);
  const wa = whatsappLink(store.whatsapp, "Hi, I have a question about wholesale prices.");
  return (
    <footer className="mt-20 border-t-4 border-[#d50f0f] bg-(--s-bar) text-[#c3ccd9]">
      <div className="mx-auto grid max-w-[1440px] grid-cols-1 gap-10 px-4 py-12 sm:grid-cols-2 md:px-6 lg:grid-cols-4 xl:px-8">
        <div>
          <p className="ch-display text-2xl font-black tracking-tight text-white">CHAMPIKA</p>
          <p className="ch-display text-[11px] font-bold tracking-[0.3em] text-white">HARDWARE &amp; DISTRIBUTION</p>
          <p className="mt-4 max-w-xs text-sm leading-6">
            {t("Wholesale hardware for shops and contractors — direct from the distributor.")}
          </p>
        </div>
        <div>
          <p className="mb-4 text-xs font-bold uppercase tracking-[0.15em] text-white">{t("Shop")}</p>
          <ul className="space-y-2 text-sm">
            <li><Link href={`${base}/categories`} className="hover:text-white">{t("All categories")}</Link></li>
            {categories.slice(0, 6).map((c) => (
              <li key={c.slug}>
                <Link href={`${base}/c/${c.slug}`} className="hover:text-white">{c.name}</Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="mb-4 text-xs font-bold uppercase tracking-[0.15em] text-white">{t("Trade")}</p>
          <ul className="space-y-2 text-sm">
            <li><Link href={`${base}/login`} className="hover:text-white">{t("Trade login")}</Link></li>
            <li><Link href={`${base}/quick-order`} className="hover:text-white">{t("Quick order")}</Link></li>
            <li><Link href={`${base}/quote`} className="hover:text-white">{t("Get a quote")}</Link></li>
            <li><Link href={`${base}/account/orders`} className="hover:text-white">{t("My orders")}</Link></li>
          </ul>
        </div>
        <div>
          <p className="mb-4 text-xs font-bold uppercase tracking-[0.15em] text-white">{t("Contact")}</p>
          <ul className="space-y-3 text-sm">
            {store.phone && (
              <li className="flex items-center gap-2.5">
                <Phone className="h-4 w-4 text-[#ff8378]" aria-hidden />
                <a href={`tel:${store.phone}`} className="hover:text-white">{store.phone}</a>
              </li>
            )}
            {wa && (
              <li className="flex items-center gap-2.5">
                <MessageCircle className="h-4 w-4 text-[#ff8378]" aria-hidden />
                <a href={wa} target="_blank" rel="noopener noreferrer" className="hover:text-white">WhatsApp {store.whatsapp}</a>
              </li>
            )}
            {store.email && (
              <li className="flex items-center gap-2.5">
                <Mail className="h-4 w-4 text-[#ff8378]" aria-hidden />
                <a href={`mailto:${store.email}`} className="hover:text-white">{store.email}</a>
              </li>
            )}
            {store.address && (
              <li className="flex items-start gap-2.5">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#ff8378]" aria-hidden />
                <span>{store.address}</span>
              </li>
            )}
            {store.hours && (
              <li className="flex items-start gap-2.5">
                <Clock className="mt-0.5 h-4 w-4 shrink-0 text-[#ff8378]" aria-hidden />
                <span>{store.hours}</span>
              </li>
            )}
            {!store.phone && !wa && !store.email && !store.address && <li>{t("Contact details coming soon.")}</li>}
          </ul>
        </div>
      </div>
      <div className="bg-[#b80d0d] py-3 text-center text-xs font-semibold text-white">
        © {new Date().getFullYear()} {store.name}. {t("All rights reserved.")}
      </div>
    </footer>
  );
}
