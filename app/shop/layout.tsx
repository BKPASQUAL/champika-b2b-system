import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { getCategoryTree, getShopBase, getStoreInfo } from "@/lib/shop-data";
import { getWebCustomer } from "@/lib/web-auth";
import { SHOP_URL } from "@/lib/shop-host";
import { ShopProvider } from "./_components/ShopContext";
import { Header, type NavCategory } from "./_components/Header";
import { MobileTabBar } from "./_components/MobileTabBar";
import { Footer } from "./_components/Footer";
import { cookies } from "next/headers";
import { THEME_COOKIE } from "./_components/format";
import { LANG_COOKIE } from "./_components/i18n";
import { WhatsAppButton } from "./_components/WhatsAppButton";
import "./shop.css";

export const dynamic = "force-dynamic";

export const viewport: Viewport = { themeColor: "#0a0a0a" };

export async function generateMetadata(): Promise<Metadata> {
  const store = await getStoreInfo();
  return {
    metadataBase: new URL(SHOP_URL),
    title: { default: `${store.name} — House Wiring Accessories Online`, template: `%s | ${store.name}` },
    description:
      "Buy cables, wires, switches, sockets, breakers and distribution boards online. Genuine brands, discount prices and fast delivery in the Galle area.",
    // The B2B app's install manifest / app title must not appear on the shop.
    manifest: null,
    appleWebApp: null,
    openGraph: { type: "website", siteName: store.name, locale: "en_LK" },
  };
}

export default async function ShopLayout({ children }: { children: React.ReactNode }) {
  const [tree, store, base, jar, me] = await Promise.all([
    getCategoryTree(),
    getStoreInfo(),
    getShopBase(),
    cookies(),
    getWebCustomer().catch(() => null),
  ]);
  const dark = jar.get(THEME_COOKIE)?.value === "dark";
  const lang = jar.get(LANG_COOKIE)?.value === "si" ? "si" : "en";
  const nav: NavCategory[] = tree.map((c) => ({
    name: c.name,
    slug: c.slug,
    imageUrl: c.imageUrl,
    children: c.children.map((s) => ({ name: s.name, slug: s.slug, imageUrl: s.imageUrl, count: s.productCount })),
  }));

  return (
    <ShopProvider base={base} initialDark={dark} initialLang={lang} customer={me ? { name: me.full_name, email: me.email } : null} store={{ name: store.name, phone: store.phone, whatsapp: store.whatsapp }}>
      {/* "shop-dark" switches every shop colour to dark mode (see shop.css). */}
      <div lang={lang} className={`shop-root flex min-h-screen flex-col pb-16 md:pb-0 ${dark ? "shop-dark" : ""} ${lang === "si" ? "shop-si" : ""}`} suppressHydrationWarning>
        <Suspense fallback={<div className="h-16 bg-(--s-bar)" />}>
          <Header categories={nav} />
        </Suspense>
        <main className="flex-1">{children}</main>
        <Footer store={store} categories={nav} base={base} lang={lang} />
        <MobileTabBar />
        <WhatsAppButton />
      </div>
    </ShopProvider>
  );
}
