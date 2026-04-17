"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ShoppingBag,
  CreditCard,
  AlertCircle,
  Plus,
  TrendingUp,
  Clock,
  Truck,
  CheckCircle2,
  RefreshCw,
  PackageCheck,
} from "lucide-react";
import { useRouter } from "next/navigation";

// ── Types ────────────────────────────────────────────────────────────────────

interface DashboardStats {
  monthlySales: number;
  activeOrders: number;
  pendingOrders: number;
  inTransitOrders: number;
  deliveredOrders: number;
  totalDue: number;
  dueCustomers: number;
  pendingCommission: number;
  totalOrders: number;
}

interface RecentOrder {
  id: string;
  orderRef: string;
  shopName: string;
  amount: number;
  status: string;
  date: string;
  invoiceStatus: string | null;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  new Intl.NumberFormat("en-LK", {
    style: "currency",
    currency: "LKR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);

const STATUS_STYLE: Record<string, { bg: string; text: string }> = {
  Pending:      { bg: "bg-yellow-100",  text: "text-yellow-800" },
  Processing:   { bg: "bg-blue-100",    text: "text-blue-800"   },
  Checking:     { bg: "bg-indigo-100",  text: "text-indigo-800" },
  Loading:      { bg: "bg-orange-100",  text: "text-orange-800" },
  "In Transit": { bg: "bg-purple-100",  text: "text-purple-800" },
  Delivered:    { bg: "bg-green-100",   text: "text-green-800"  },
  Cancelled:    { bg: "bg-red-100",     text: "text-red-800"    },
};

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-LK", {
    month: "short", day: "numeric",
  });

// ── Component ────────────────────────────────────────────────────────────────

export default function RepDashboardPage() {
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState("");

  const fetchDashboard = async (repId: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/rep/dashboard?repId=${repId}`);
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setStats(data.stats);
      setRecentOrders(data.recentOrders ?? []);
    } catch {
      // silently fail — show zeros
      setStats({
        monthlySales: 0, activeOrders: 0, pendingOrders: 0,
        inTransitOrders: 0, deliveredOrders: 0, totalDue: 0,
        dueCustomers: 0, pendingCommission: 0, totalOrders: 0,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = localStorage.getItem("currentUser");
      if (stored) {
        const user = JSON.parse(stored);
        setUserName(user.name || "");
        fetchDashboard(user.id);
      }
    } catch {
      setLoading(false);
    }
  }, []);

  const firstName = userName.split(" ")[0] || "Rep";

  return (
    <div className="space-y-5 sm:space-y-6">

      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight">
            Hi, {firstName} 👋
          </h2>
          <p className="text-muted-foreground text-xs sm:text-sm mt-0.5">
            Here's your sales summary for today.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="icon"
            onClick={() => {
              const stored = localStorage.getItem("currentUser");
              if (stored) fetchDashboard(JSON.parse(stored).id);
            }}
            disabled={loading}
            className="h-9 w-9"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
          <Button
            onClick={() => router.push("/dashboard/rep/orders/create")}
            className="bg-black hover:bg-gray-800 text-white"
          >
            <Plus className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">New Order</span>
          </Button>
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard
          label="Monthly Sales"
          value={stats ? fmt(stats.monthlySales) : "—"}
          sub={stats ? `${stats.totalOrders} total orders` : "Loading…"}
          icon={<TrendingUp className="h-4 w-4" />}
          color="green"
          loading={loading}
        />
        <StatCard
          label="Active Orders"
          value={stats ? String(stats.activeOrders) : "—"}
          sub={stats ? `${stats.pendingOrders} pending approval` : "Loading…"}
          icon={<ShoppingBag className="h-4 w-4" />}
          color="blue"
          loading={loading}
        />
        <StatCard
          label="Due Collections"
          value={stats ? fmt(stats.totalDue) : "—"}
          sub={stats ? `From ${stats.dueCustomers} customer${stats.dueCustomers !== 1 ? "s" : ""}` : "Loading…"}
          icon={<AlertCircle className="h-4 w-4" />}
          color="red"
          loading={loading}
        />
        <StatCard
          label="My Commission"
          value={stats ? fmt(stats.pendingCommission) : "—"}
          sub="Pending payout"
          icon={<CreditCard className="h-4 w-4" />}
          color="purple"
          loading={loading}
        />
      </div>

      {/* ── Order Status Breakdown ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatusCard
          label="Pending"
          count={stats?.pendingOrders ?? 0}
          icon={<Clock className="h-4 w-4" />}
          color="yellow"
          loading={loading}
          onClick={() => router.push("/dashboard/rep/invoices")}
        />
        <StatusCard
          label="In Transit"
          count={stats?.inTransitOrders ?? 0}
          icon={<Truck className="h-4 w-4" />}
          color="purple"
          loading={loading}
          onClick={() => router.push("/dashboard/rep/invoices")}
        />
        <StatusCard
          label="Delivered"
          count={stats?.deliveredOrders ?? 0}
          icon={<CheckCircle2 className="h-4 w-4" />}
          color="green"
          loading={loading}
          onClick={() => router.push("/dashboard/rep/invoices")}
        />
        <StatusCard
          label="Total Orders"
          count={stats?.totalOrders ?? 0}
          icon={<PackageCheck className="h-4 w-4" />}
          color="slate"
          loading={loading}
          onClick={() => router.push("/dashboard/rep/invoices")}
        />
      </div>

      {/* ── Recent Orders ── */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between px-5 pt-5 pb-3">
          <CardTitle className="text-base font-semibold">Recent Orders</CardTitle>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs h-7"
            onClick={() => router.push("/dashboard/rep/invoices")}
          >
            View All
          </Button>
        </CardHeader>
        <CardContent className="px-5 pb-5">
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-14 bg-muted/40 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : recentOrders.length === 0 ? (
            <div className="flex flex-col items-center py-10 text-muted-foreground gap-2">
              <ShoppingBag className="h-8 w-8 opacity-30" />
              <p className="text-sm">No orders yet</p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => router.push("/dashboard/rep/orders/create")}
                className="mt-1"
              >
                Create your first order
              </Button>
            </div>
          ) : (
            <div className="divide-y">
              {recentOrders.map((order) => {
                const s = STATUS_STYLE[order.status] ?? { bg: "bg-gray-100", text: "text-gray-700" };
                return (
                  <div key={order.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0 gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm truncate">{order.shopName}</p>
                      <p className="text-xs text-muted-foreground font-mono">{order.orderRef} · {fmtDate(order.date)}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold tabular-nums">{fmt(order.amount)}</p>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${s.bg} ${s.text}`}>
                        {order.status}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

const COLOR_MAP = {
  green:  { icon: "text-green-600",  bg: "bg-green-50",  ring: "ring-green-100"  },
  blue:   { icon: "text-blue-600",   bg: "bg-blue-50",   ring: "ring-blue-100"   },
  red:    { icon: "text-red-600",    bg: "bg-red-50",    ring: "ring-red-100"    },
  purple: { icon: "text-purple-600", bg: "bg-purple-50", ring: "ring-purple-100" },
  yellow: { icon: "text-yellow-600", bg: "bg-yellow-50", ring: "ring-yellow-100" },
  slate:  { icon: "text-slate-600",  bg: "bg-slate-50",  ring: "ring-slate-100"  },
};

function StatCard({
  label, value, sub, icon, color, loading,
}: {
  label: string; value: string; sub: string;
  icon: React.ReactNode; color: keyof typeof COLOR_MAP; loading: boolean;
}) {
  const c = COLOR_MAP[color];
  return (
    <Card>
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] sm:text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5 truncate">
              {label}
            </p>
            {loading ? (
              <div className="h-7 w-24 bg-muted/50 rounded animate-pulse" />
            ) : (
              <p className="text-xl sm:text-2xl font-bold tabular-nums truncate">{value}</p>
            )}
            <p className="text-[10px] sm:text-xs text-muted-foreground mt-1 truncate">{sub}</p>
          </div>
          <div className={`flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-lg ${c.bg} ${c.icon} ring-2 sm:ring-4 ${c.ring}`}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function StatusCard({
  label, count, icon, color, loading, onClick,
}: {
  label: string; count: number;
  icon: React.ReactNode; color: keyof typeof COLOR_MAP;
  loading: boolean; onClick: () => void;
}) {
  const c = COLOR_MAP[color];
  return (
    <Card
      className="cursor-pointer hover:shadow-md transition-shadow active:scale-[0.98]"
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${c.bg} ${c.icon}`}>
            {icon}
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide truncate">{label}</p>
            {loading ? (
              <div className="h-6 w-8 bg-muted/50 rounded animate-pulse mt-0.5" />
            ) : (
              <p className="text-xl font-bold tabular-nums">{count}</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
