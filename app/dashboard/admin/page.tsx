"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Banknote,
  TrendingUp,
  AlertCircle,
  ShoppingCart,
  Users,
  Clock,
  FileText,
  CheckSquare,
  AlertOctagon,
  Building2,
  Loader2,
} from "lucide-react";
import Link from "next/link";

// ─── Types ────────────────────────────────────────────────────────────────────
interface DashboardKPIs {
  totalRevenue: number;
  last30DaysRevenue: number;
  totalDue: number;
  totalInvoices: number;
  overdueCount: number;
  unpaidCount: number;
  pendingOrdersCount: number;
  activeSuppliersCount: number;
  pendingSuppliersCount: number;
  pendingChequesCount: number;
  pendingChequesAmount: number;
}

interface PendingOrder {
  id: string;
  orderId: string;
  customerName: string;
  amount: number;
  date: string;
  status: string;
}

interface PendingCheque {
  id: string;
  chequeNo: string;
  customerName: string;
  amount: number;
  date: string;
  invoiceNo: string;
}

interface PendingSupplier {
  id: string;
  name: string;
  status: string;
}

interface RecentInvoice {
  id: string;
  invoiceNo: string;
  customerName: string;
  salesRepName: string;
  amount: number;
  dueAmount: number;
  status: string;
  orderStatus: string;
  date: string;
}

interface DashboardData {
  kpis: DashboardKPIs;
  pendingOrders: PendingOrder[];
  pendingCheques: PendingCheque[];
  pendingSuppliers: PendingSupplier[];
  recentInvoices: RecentInvoice[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatLKR(amount: number): string {
  if (amount >= 1_000_000) return `LKR ${(amount / 1_000_000).toFixed(2)}M`;
  if (amount >= 100_000) return `LKR ${(amount / 100_000).toFixed(2)}L`;
  if (amount >= 1_000) return `LKR ${(amount / 1_000).toFixed(1)}K`;
  return `LKR ${amount.toFixed(0)}`;
}

function fmtDate(dateStr: string): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function PaymentStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    Paid: "bg-green-100 text-green-700 border-green-200",
    Unpaid: "bg-red-100 text-red-700 border-red-200",
    Partial: "bg-amber-100 text-amber-700 border-amber-200",
    Overdue: "bg-red-200 text-red-800 border-red-300",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${map[status] ?? "bg-slate-100 text-slate-600 border-slate-200"}`}
    >
      {status}
    </span>
  );
}

function OrderStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    Pending: "bg-yellow-100 text-yellow-700 border-yellow-200",
    Processing: "bg-blue-100 text-blue-700 border-blue-200",
    Checking: "bg-purple-100 text-purple-700 border-purple-200",
    Loading: "bg-indigo-100 text-indigo-700 border-indigo-200",
    "In Transit": "bg-orange-100 text-orange-700 border-orange-200",
    Delivered: "bg-green-100 text-green-700 border-green-200",
    Completed: "bg-green-200 text-green-800 border-green-300",
    Cancelled: "bg-slate-100 text-slate-600 border-slate-200",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${map[status] ?? "bg-slate-100 text-slate-600 border-slate-200"}`}
    >
      {status}
    </span>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function AdminDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/dashboard")
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error);
        setData(d);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 space-x-2 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span>Loading dashboard...</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-64 text-destructive">
        <AlertCircle className="h-5 w-5 mr-2" />
        <span>Failed to load dashboard: {error}</span>
      </div>
    );
  }

  const { kpis, pendingOrders, pendingCheques, pendingSuppliers, recentInvoices } = data;
  const totalPendingApprovals =
    kpis.pendingOrdersCount + kpis.pendingChequesCount + kpis.pendingSuppliersCount;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">Overview</h2>
        {totalPendingApprovals > 0 && (
          <div className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-700">
            <CheckSquare className="h-4 w-4" />
            {totalPendingApprovals} pending approval{totalPendingApprovals !== 1 ? "s" : ""}
          </div>
        )}
      </div>

      {/* ── KPI Cards ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {/* Total Revenue */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <Banknote className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-lg sm:text-2xl font-bold">{formatLKR(kpis.totalRevenue)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {formatLKR(kpis.last30DaysRevenue)} in last 30 days
            </p>
          </CardContent>
        </Card>

        {/* Total Outstanding */}
        <Card className={kpis.totalDue > 0 ? "border-l-4 border-l-red-400" : ""}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Outstanding Due</CardTitle>
            <AlertCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-lg sm:text-2xl font-bold text-red-600">
              {formatLKR(kpis.totalDue)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {kpis.overdueCount} overdue · {kpis.unpaidCount} unpaid/partial
            </p>
          </CardContent>
        </Card>

        {/* Pending Orders */}
        <Card className={kpis.pendingOrdersCount > 0 ? "border-l-4 border-l-yellow-400" : ""}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Orders</CardTitle>
            <ShoppingCart className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-lg sm:text-2xl font-bold text-yellow-600">
              {kpis.pendingOrdersCount}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {kpis.totalInvoices} total invoices
            </p>
          </CardContent>
        </Card>

        {/* Suppliers */}
        <Card className={kpis.pendingSuppliersCount > 0 ? "border-l-4 border-l-purple-400" : ""}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Suppliers</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-lg sm:text-2xl font-bold">{kpis.activeSuppliersCount}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {kpis.pendingSuppliersCount > 0 ? (
                <span className="text-purple-600 font-medium">
                  {kpis.pendingSuppliersCount} pending approval
                </span>
              ) : (
                "All suppliers active"
              )}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ── Secondary KPI row ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overdue Invoices</CardTitle>
            <AlertOctagon className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-lg sm:text-2xl font-bold text-destructive">{kpis.overdueCount}</div>
            <p className="text-xs text-muted-foreground mt-1">Payment deadline passed</p>
          </CardContent>
        </Card>

        <Card className={kpis.pendingChequesCount > 0 ? "border-l-4 border-l-blue-400" : ""}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Cheques</CardTitle>
            <TrendingUp className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-lg sm:text-2xl font-bold text-blue-600">
              {kpis.pendingChequesCount}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {formatLKR(kpis.pendingChequesAmount)} awaiting clearance
            </p>
          </CardContent>
        </Card>

        <Card className="col-span-2 sm:col-span-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Invoices</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-lg sm:text-2xl font-bold">{kpis.totalInvoices}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {kpis.unpaidCount} unpaid or partial
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ── Pending Approvals + Recent Invoices ───────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-5">
        {/* Pending Approvals Panel */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <CheckSquare className="h-4 w-4 text-amber-500" />
              Pending Approvals
              {totalPendingApprovals > 0 && (
                <Badge className="ml-auto bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100">
                  {totalPendingApprovals}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Pending Orders */}
            {pendingOrders.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Orders
                  </p>
                  <Link
                    href="/dashboard/admin/orders"
                    className="text-xs text-blue-600 hover:underline"
                  >
                    View all
                  </Link>
                </div>
                <div className="space-y-2">
                  {pendingOrders.map((order) => (
                    <div
                      key={order.id}
                      className="flex items-center justify-between rounded-lg border border-yellow-200 bg-yellow-50 px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{order.customerName}</p>
                        <p className="text-xs text-muted-foreground">{order.orderId}</p>
                      </div>
                      <div className="text-right ml-2 shrink-0">
                        <p className="text-sm font-semibold">{formatLKR(order.amount)}</p>
                        <p className="text-xs text-muted-foreground">{fmtDate(order.date)}</p>
                      </div>
                    </div>
                  ))}
                  {kpis.pendingOrdersCount > pendingOrders.length && (
                    <p className="text-xs text-center text-muted-foreground py-1">
                      +{kpis.pendingOrdersCount - pendingOrders.length} more pending orders
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Pending Cheques */}
            {pendingCheques.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Cheques
                  </p>
                  <Link
                    href="/dashboard/admin/finance/check-registry"
                    className="text-xs text-blue-600 hover:underline"
                  >
                    View all
                  </Link>
                </div>
                <div className="space-y-2">
                  {pendingCheques.map((chq) => (
                    <div
                      key={chq.id}
                      className="flex items-center justify-between rounded-lg border border-blue-200 bg-blue-50 px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{chq.customerName}</p>
                        <p className="text-xs text-muted-foreground">
                          #{chq.chequeNo} · {chq.invoiceNo}
                        </p>
                      </div>
                      <div className="text-right ml-2 shrink-0">
                        <p className="text-sm font-semibold text-blue-700">
                          {formatLKR(chq.amount)}
                        </p>
                        <p className="text-xs text-muted-foreground">{fmtDate(chq.date)}</p>
                      </div>
                    </div>
                  ))}
                  {kpis.pendingChequesCount > pendingCheques.length && (
                    <p className="text-xs text-center text-muted-foreground py-1">
                      +{kpis.pendingChequesCount - pendingCheques.length} more pending cheques
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Pending Supplier Approvals */}
            {pendingSuppliers.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Suppliers
                  </p>
                  <Link
                    href="/dashboard/admin/suppliers"
                    className="text-xs text-blue-600 hover:underline"
                  >
                    View all
                  </Link>
                </div>
                <div className="space-y-2">
                  {pendingSuppliers.map((sup) => (
                    <div
                      key={sup.id}
                      className="flex items-center justify-between rounded-lg border border-purple-200 bg-purple-50 px-3 py-2"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Users className="h-4 w-4 text-purple-500 shrink-0" />
                        <p className="text-sm font-medium truncate">{sup.name}</p>
                      </div>
                      <Badge className="bg-purple-100 text-purple-700 border-purple-200 hover:bg-purple-100 shrink-0 ml-2">
                        Pending
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {totalPendingApprovals === 0 && (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <CheckSquare className="h-8 w-8 mb-2 text-green-400" />
                <p className="text-sm font-medium text-green-600">All clear!</p>
                <p className="text-xs">No pending approvals</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Invoices */}
        <Card className="lg:col-span-3">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="h-4 w-4 text-muted-foreground" />
                Recent Invoices
              </CardTitle>
              <Link
                href="/dashboard/admin/invoices"
                className="text-xs text-blue-600 hover:underline"
              >
                View all
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {recentInvoices.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No invoices found
              </p>
            ) : (
              <div className="space-y-0 divide-y">
                {recentInvoices.map((inv) => (
                  <div key={inv.id} className="flex items-center gap-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium truncate">{inv.customerName}</p>
                        <span className="text-xs text-muted-foreground shrink-0">
                          {inv.invoiceNo}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <p className="text-xs text-muted-foreground">{inv.salesRepName}</p>
                        <span className="text-muted-foreground text-xs">·</span>
                        <OrderStatusBadge status={inv.orderStatus} />
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold">{formatLKR(inv.amount)}</p>
                      <PaymentStatusBadge status={inv.status} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Quick Links ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {[
          { label: "Invoices", href: "/dashboard/admin/invoices", icon: FileText, color: "text-blue-600", bg: "bg-blue-50" },
          { label: "Orders", href: "/dashboard/admin/orders", icon: ShoppingCart, color: "text-yellow-600", bg: "bg-yellow-50" },
          { label: "Payments", href: "/dashboard/admin/payments", icon: Banknote, color: "text-green-600", bg: "bg-green-50" },
          { label: "Suppliers", href: "/dashboard/admin/suppliers", icon: Building2, color: "text-purple-600", bg: "bg-purple-50" },
        ].map(({ label, href, icon: Icon, color, bg }) => (
          <Link key={label} href={href}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="flex items-center gap-3 p-4">
                <div className={`rounded-lg p-2 ${bg}`}>
                  <Icon className={`h-5 w-5 ${color}`} />
                </div>
                <span className="text-sm font-medium">{label}</span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
