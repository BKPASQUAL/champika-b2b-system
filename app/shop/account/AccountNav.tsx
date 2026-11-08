"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ClipboardList, Loader2, LogOut, Package, UserRound } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { useShop } from "../_components/ShopContext";

export function AccountNav() {
  const { href, base } = useShop();
  const pathname = usePathname().slice(base.length);
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const items = [
    { to: "/account/orders", label: "My orders", icon: Package, on: pathname.startsWith("/account/orders") },
    { to: "/account/quotes", label: "My quotations", icon: ClipboardList, on: pathname.startsWith("/account/quotes") },
    { to: "/account", label: "My details", icon: UserRound, on: pathname === "/account" },
  ];

  const logout = async () => {
    setBusy(true);
    await supabaseBrowser().auth.signOut();
    router.replace(href("/"));
    router.refresh();
  };

  const cls = (on: boolean) =>
    `flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
      on ? "bg-(--s-accent) text-(--s-accent-ink)" : "text-(--s-ink-2) hover:bg-(--s-soft) hover:text-(--s-ink)"
    }`;

  return (
    <nav className="shop-noscroll -mx-4 flex gap-1 overflow-x-auto px-4 lg:mx-0 lg:h-fit lg:flex-col lg:rounded-2xl lg:border lg:border-(--s-line) lg:bg-(--s-surface) lg:p-2">
      {items.map((it) => (
        <Link key={it.to} href={href(it.to)} className={cls(it.on)}>
          <it.icon className="h-4 w-4" /> {it.label}
        </Link>
      ))}
      <button onClick={logout} disabled={busy} className={`${cls(false)} lg:mt-1 lg:border-t lg:border-(--s-line) lg:rounded-t-none lg:pt-3`}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />} Log out
      </button>
    </nav>
  );
}
