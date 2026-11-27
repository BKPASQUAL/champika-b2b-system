import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { headers } from "next/headers";
import { Montserrat } from "next/font/google";
import { getCategoryTree, getShopBase, getStoreInfo } from "@/lib/shop-data";
import { getWebCustomer } from "@/lib/web-auth";
import { shopUrlFor } from "@/lib/shop-host";
import { getRequestSite } from "@/lib/web-site";
import { ShopProvider } from "./_components/ShopContext";
import { Header, type NavCategory } from "./_components/Header";
import { ChampikaHeader } from "./_components/ChampikaHeader";
import { MobileTabBar } from "./_components/MobileTabBar";
import { Footer } from "./_components/Footer";
import { ChampikaFooter } from "./_components/ChampikaFooter";
import { cookies } from "next/headers";
import { siteProfile } from "./_components/site-profile";
import { WhatsAppButton } from "./_components/WhatsAppButton";
import "./shop.css";

export const dynamic = "force-dynamic";

/** Champika headings (like the logo lettering). Only used on the Champika shop. */
const chDisplay = Montserrat({ subsets: ["latin"], weight: ["700", "800", "900"], variable: "--font-ch-display", display: "swap" });

export async function generateViewport(): Promise<Viewport> {
  return { themeColor: siteProfile(await getRequestSite()).themeColor };
}

export async function generateMetadata(): Promise<Metadata> {
  const [store, site, h] = await Promise.all([getStoreInfo(), getRequestSite(), headers()]);
  const profile = siteProfile(site);
  const icon = site === "champika" ? "/ch-icon.png" : "/bk-wiring-icon.svg";
  return {
    metadataBase: new URL(shopUrlFor(site, h.get("host")) || "http://localhost:3000"),
    title: { default: `${store.name} — ${profile.titleSuffix}`, template: `%s | ${store.name}` },
    description: profile.metaDescription,
    // Each shop has its own icon; the B2B app's icon, install manifest and app title must not appear on a shop.
    icons: { icon, apple: icon },
    manifest: null,
    appleWebApp: null,
    openGraph: { type: "website", siteName: store.name, locale: "en_LK" },
  };
}

export default async function ShopLayout({ children }: { children: React.ReactNode }) {
  const [tree, store, base, jar, me, site] = await Promise.all([
    getCategoryTree(),
    getStoreInfo(),
    getShopBase(),
    cookies(),
    getWebCustomer().catch(() => null),
    getRequestSite(),
  ]);
  const profile = siteProfile(site);
  const champika = site === "champika";
  const dark = jar.get(profile.themeCookie)?.value === "dark";
  const lang = jar.get(profile.langCookie)?.value === "si" ? "si" : "en";
  const nav: NavCategory[] = tree.map((c) => ({
    name: c.name,
    slug: c.slug,
    imageUrl: c.imageUrl,
    children: c.children.map((s) => ({ name: s.name, slug: s.slug, imageUrl: s.imageUrl, count: s.productCount })),
  }));

  return (
    <ShopProvider
      site={site}
      profile={profile}
      base={base}
      initialDark={dark}
      initialLang={lang}
      customer={me ? { name: me.full_name, email: me.email } : null}
      store={{ name: store.name, phone: store.phone, whatsapp: store.whatsapp }}
    >
      {/* "shop-dark" switches every shop colour to dark mode; data-site picks the shop's colours (see shop.css). */}
      <div
        lang={lang}
        data-site={site}
        className={`shop-root flex min-h-screen flex-col pb-16 md:pb-0 ${dark ? "shop-dark" : ""} ${lang === "si" ? "shop-si" : ""} ${champika ? chDisplay.variable : ""}`}
        suppressHydrationWarning
      >
        <Suspense fallback={<div className={champika ? "h-[150px] bg-(--s-bar)" : "h-16 bg-(--s-bar)"} />}>
          {champika ? <ChampikaHeader categories={nav} /> : <Header categories={nav} />}
        </Suspense>
        <main className="flex-1">{children}</main>
        {champika ? (
          <ChampikaFooter store={store} categories={nav} base={base} lang={lang} />
        ) : (
          <Footer store={store} categories={nav} base={base} lang={lang} />
        )}
        <MobileTabBar />
        <WhatsAppButton />
      </div>
    </ShopProvider>
  );
}
