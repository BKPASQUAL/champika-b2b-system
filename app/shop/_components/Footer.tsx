import Link from "next/link";
import { Clock, Mail, MapPin, MessageCircle, Phone, ShieldCheck, Truck, Wallet } from "lucide-react";
import type { NavCategory } from "./Header";
import type { StoreInfo } from "@/lib/shop-data";
import { whatsappLink } from "./format";
import { BrandLogo } from "./BrandLogo";
import { makeT, type Lang } from "./i18n";

export function Footer({ store, categories, base, lang = "en" }: { store: StoreInfo; categories: NavCategory[]; base: string; lang?: Lang }) {
  const t = makeT(lang);
  const subs = categories.flatMap((c) => c.children).slice(0, 8);
  const wa = whatsappLink(store.whatsapp, "Hi, I have a question about an item on your website.");
  return (
    <footer className="mt-20 bg-(--s-bar) text-slate-400">
      <div className="border-b border-(--s-bar-line)">
        <div className="mx-auto grid grid-cols-1 gap-6 px-4 md:px-6 xl:px-10 py-8 sm:grid-cols-3">
          {[
            { icon: ShieldCheck, title: t("Genuine brands"), text: t("Only original products from trusted makers") },
            { icon: Truck, title: t("Galle area delivery"), text: t("Fast doorstep delivery across Galle & suburbs") },
            { icon: Wallet, title: t("Easy payment"), text: t("Cash on delivery or bank transfer") },
          ].map((f) => (
            <div key={f.title} className="flex items-center gap-4">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-blue-500/30 bg-blue-500/10 text-blue-400 shadow-[0_0_16px_-4px_rgba(59,130,246,0.3)]">
                <f.icon className="h-5 w-5" />
              </span>
              <div>
                <div className="text-sm font-semibold tracking-tight text-white">{f.title}</div>
                <div className="mt-0.5 text-xs text-slate-400">{f.text}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mx-auto grid grid-cols-1 gap-10 px-4 md:px-6 xl:px-10 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div className="lg:col-span-2">
          <Link href={base || "/"} className="group inline-flex items-center">
            <BrandLogo name={store.name} size="sm" />
          </Link>
          <p className="mt-4 max-w-sm text-sm leading-6">
            {t("Everything you need to wire a house — cables, switches, sockets, breakers and boards — at fair prices, from one place.")}
          </p>
        </div>
        <div>
          <div className="mb-4 text-xs font-bold uppercase tracking-[0.15em] text-white">{t("Shop")}</div>
          <ul className="space-y-2 text-sm">
            <li><Link href={`${base}/products`} className="hover:text-white">{t("All products")}</Link></li>
            {subs.map((c) => (
              <li key={c.slug}>
                <Link href={`${base}/c/${c.slug}`} className="hover:text-white">{c.name}</Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <div className="mb-4 text-xs font-bold uppercase tracking-[0.15em] text-white">{t("Contact")}</div>
          <ul className="space-y-3 text-sm">
            {store.phone && (
              <li className="flex items-center gap-2.5">
                <Phone className="h-4 w-4 text-(--s-accent)" />
                <a href={`tel:${store.phone}`} className="hover:text-white">{store.phone}</a>
              </li>
            )}
            {wa && (
              <li className="flex items-center gap-2.5">
                <MessageCircle className="h-4 w-4 text-(--s-accent)" />
                <a href={wa} target="_blank" rel="noopener noreferrer" className="hover:text-white">WhatsApp {store.whatsapp}</a>
              </li>
            )}
            {store.email && (
              <li className="flex items-center gap-2.5">
                <Mail className="h-4 w-4 text-(--s-accent)" />
                <a href={`mailto:${store.email}`} className="hover:text-white">{store.email}</a>
              </li>
            )}
            {store.address && (
              <li className="flex items-start gap-2.5">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-(--s-accent)" />
                <span>{store.address}</span>
              </li>
            )}
            {store.hours && (
              <li className="flex items-start gap-2.5">
                <Clock className="mt-0.5 h-4 w-4 shrink-0 text-(--s-accent)" />
                <span>{store.hours}</span>
              </li>
            )}
            {!store.phone && !wa && !store.email && !store.address && <li>{t("Contact details coming soon.")}</li>}
          </ul>
        </div>
      </div>
      <div className="border-t border-(--s-bar-line) py-5 text-center text-xs text-neutral-500">
        © {new Date().getFullYear()} {store.name}. {t("All rights reserved.")}
      </div>
    </footer>
  );
}
