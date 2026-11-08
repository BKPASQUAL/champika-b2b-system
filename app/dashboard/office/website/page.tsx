"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Package, Eye, EyeOff, FolderTree, ShoppingCart, FileText, Users, BadgeCheck, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { webApi } from "./_components/api";

type Stats = {
  products: number;
  published: number;
  unavailable: number;
  categories: number;
  newOrders: number;
  openQuotes: number;
  customers: number;
  tradePending: number;
};

const BASE = "/dashboard/office/website";

export default function WebsiteDashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    webApi<Stats>("/api/website/dashboard").then(setStats).catch((e) => setError(e.message));
  }, []);

  const cards = stats
    ? [
        { label: "New orders", value: stats.newOrders, icon: ShoppingCart, href: `${BASE}/orders`, hot: stats.newOrders > 0 },
        { label: "Quotation requests", value: stats.openQuotes, icon: FileText, href: `${BASE}/quotations`, hot: stats.openQuotes > 0 },
        { label: "Trade approvals waiting", value: stats.tradePending, icon: BadgeCheck, href: `${BASE}/customers`, hot: stats.tradePending > 0 },
        { label: "Customers", value: stats.customers, icon: Users, href: `${BASE}/customers` },
        { label: "Website products", value: stats.products, icon: Package, href: `${BASE}/products` },
        { label: "Published", value: stats.published, icon: Eye, href: `${BASE}/products` },
        { label: "Marked out of stock", value: stats.unavailable, icon: EyeOff, href: `${BASE}/products` },
        { label: "Categories", value: stats.categories, icon: FolderTree, href: `${BASE}/categories` },
      ]
    : [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Website Dashboard</h2>
        <p className="text-muted-foreground text-sm">Online shop overview — bkwiringbadukade.lk</p>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {!stats && !error && <Loader2 className="h-6 w-6 animate-spin text-teal-600" />}

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <Link key={c.label} href={c.href}>
            <Card className={c.hot ? "border-teal-500 bg-teal-50/50" : "hover:bg-muted/40"}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-teal-100 flex items-center justify-center shrink-0">
                  <c.icon className="h-5 w-5 text-teal-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-2xl font-bold leading-none">{c.value}</p>
                  <p className="text-xs text-muted-foreground mt-1 truncate">{c.label}</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
