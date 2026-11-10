"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, ListChecks, ShoppingBag, Store, UserRound } from "lucide-react";
import { useShop } from "./ShopContext";
import { activeTab } from "./Header";

/** App-style bottom bar on phones: Home · Shop · Categories · Cart · Account. */
export function MobileTabBar() {
  const { href, base, cartCount, ready, customer, t } = useShop();
  // Show the cart count only after mount, so the first render matches the server HTML.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const tab = activeTab(usePathname(), base);
  const items = [
    { key: "home", label: t("Home"), to: "/", icon: Home },
    { key: "shop", label: t("Shop"), to: "/products", icon: Store },
    { key: "quick", label: t("Quick order"), to: "/quick-order", icon: ListChecks },
    { key: "cart", label: t("Cart"), to: "/cart", icon: ShoppingBag },
    { key: "account", label: customer ? t("Account") : t("Log in"), to: customer ? "/account" : "/login", icon: UserRound },
  ];
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-(--s-bar-line) bg-(--s-bar) pb-[env(safe-area-inset-bottom)] md:hidden">
      <div className="grid grid-cols-5">
        {items.map((it) => {
          const on = tab === it.key;
          return (
            <Link key={it.key} href={href(it.to)} className={`relative flex flex-col items-center gap-0.5 py-2.5 text-[12.5px] font-semibold ${on ? "text-white" : "text-neutral-500"}`}>
              {on && <span className="absolute top-0 h-0.5 w-8 rounded-full bg-(--s-accent)" />}
              <span className="relative">
                <it.icon className="h-5 w-5" />
                {it.key === "cart" && mounted && ready && cartCount > 0 && (
                  <span className="absolute -right-2.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-(--s-accent) px-1 text-[12px] font-bold text-(--s-accent-ink)">
                    {cartCount > 99 ? "99+" : cartCount}
                  </span>
                )}
              </span>
              <span className="line-clamp-2 max-w-full px-0.5 text-center leading-tight">{it.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
