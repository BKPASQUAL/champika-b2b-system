"use client";

import { useState, useMemo } from "react";
import { useCachedFetch } from "@/hooks/useCachedFetch";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  TrendingUp,
  AlertCircle,
  Package,
  Factory,
  Banknote,
  ShoppingCart,
  ArrowUpRight,
  ArrowDownRight,
  Loader2,
  Wallet,
  Clock,
  RefreshCw,
  PlusCircle,
} from "lucide-react";
import { getUserBusinessContext } from "@/app/middleware/businessAuth";
import { BUSINESS_IDS } from "@/app/config/business-constants";
import { toast } from "sonner";

interface DashboardData {
  stats: {
    todaySales: number;
    todaySalesCount: number;
    dueInvoicesCount: number;
    dueInvoicesAmount: number;
    supplierDueAmount: number;
    lowStockCount: number;
  };
  recentInvoices: any[];
  urgentDueInvoices: any[];
}

export default function OrangeDashboardPage() {
  const [businessName] = useState(() => getUserBusinessContext()?.businessName ?? "");
  const orangeId = BUSINESS_IDS.ORANGE_AGENCY;

  const { data: invoices = [], loading: l1, refetch: refetchInvoices } =
    useCachedFetch<any[]>(`/api/invoices?businessId=${orangeId}`, [], () => toast.error("Failed to load invoices"));
  const { data: purchases = [], loading: l2, refetch: refetchPurchases } =
    useCachedFetch<any[]>(`/api/purchases?businessId=${orangeId}`, [], () => toast.error("Failed to load purchases"));
  const { data: stockData, loading: l3, refetch: refetchInventory } =
    useCachedFetch<any>(`/api/inventory?businessId=${orangeId}`, null, () => toast.error("Failed to load inventory"));

  const loading = l1 || l2 || l3;
  const fetchDashboardData = () => { refetchInvoices(); refetchPurchases(); refetchInventory(); };

  const data = useMemo<DashboardData>(() => {
    const todayStr = new Date().toISOString().split("T")[0];
    const todayInvoices = invoices.filter(
      (inv: any) => inv.date && inv.date.startsWith(todayStr)
    );
    const todaySalesVal = todayInvoices.reduce(
      (sum: number, inv: any) => sum + (inv.finalAmount || inv.totalAmount || 0),
      0
    );
    const dueInvoices = invoices.filter(
      (inv: any) =>
        inv.paymentStatus !== "Paid" &&
        (inv.dueAmount > 0 || inv.status === "Overdue")
    );
    const totalDueAmount = dueInvoices.reduce(
      (sum: number, inv: any) => sum + (inv.dueAmount || 0),
      0
    );
    const supplierDue = purchases.reduce((sum: number, p: any) => {
      return sum + (Number(p.totalAmount) || 0) - (Number(p.paidAmount) || 0);
    }, 0);
    return {
      stats: {
        todaySales: todaySalesVal,
        todaySalesCount: todayInvoices.length,
        dueInvoicesCount: dueInvoices.length,
        dueInvoicesAmount: totalDueAmount,
        supplierDueAmount: supplierDue,
        lowStockCount: stockData?.stats?.lowStock || 0,
      },
      recentInvoices: invoices.slice(0, 5),
      urgentDueInvoices: dueInvoices.sort((a: any, b: any) => b.dueAmount - a.dueAmount).slice(0, 3),
    };
  }, [invoices, purchases, stockData]);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-24">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-9 w-9 animate-spin text-orange-500" />
          <p className="text-sm text-muted-foreground">Loading dashboard…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 px-1 sm:px-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            Agency Overview
          </h1>
          <p className="text-slate-500 mt-1 text-sm flex items-center gap-1.5">
            <TrendingUp className="h-3.5 w-3.5" />
            {businessName || "Orange Agency"} &bull;{" "}
            {new Date().toLocaleDateString("en-US", { weekday: "short", year: "numeric", month: "short", day: "numeric" })}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/office/orange/invoices/create" className="flex-1 sm:flex-none">
            <Button className="bg-orange-600 hover:bg-orange-700 text-white w-full sm:w-auto gap-1.5">
              <PlusCircle className="h-4 w-4" />
              New Invoice
            </Button>
          </Link>
          <Button variant="outline" onClick={fetchDashboardData} size="icon" title="Refresh">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* KPI Cards — 2 per row on mobile/tablet, 4 on desktop */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Today's Sales */}
        <Card className="border-l-4 border-l-green-500 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-3 px-3 sm:px-6 sm:pt-4">
            <CardTitle className="text-xs sm:text-sm font-medium text-slate-600">Today&apos;s Sales</CardTitle>
            <div className="p-1.5 bg-green-100 rounded-md">
              <ShoppingCart className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-green-600" />
            </div>
          </CardHeader>
          <CardContent className="px-3 pb-3 sm:px-6 sm:pb-4">
            <div className="text-lg sm:text-2xl font-bold text-green-700">
              LKR {(data.stats.todaySales / 1000).toFixed(1)}k
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {data.stats.todaySalesCount} invoice{data.stats.todaySalesCount !== 1 ? "s" : ""} today
            </p>
          </CardContent>
        </Card>

        {/* Customer Dues */}
        <Link href="/dashboard/office/orange/invoices/due">
          <Card className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-red-500 bg-red-50/20 h-full">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-3 px-3 sm:px-6 sm:pt-4">
              <CardTitle className="text-xs sm:text-sm font-medium text-red-700">Customer Dues</CardTitle>
              <div className="p-1.5 bg-red-100 rounded-md">
                <AlertCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-red-600" />
              </div>
            </CardHeader>
            <CardContent className="px-3 pb-3 sm:px-6 sm:pb-4">
              <div className="text-lg sm:text-2xl font-bold text-red-700">
                LKR {(data.stats.dueInvoicesAmount / 1000).toFixed(1)}k
              </div>
              <p className="text-xs text-red-500 mt-0.5">
                {data.stats.dueInvoicesCount} pending
              </p>
            </CardContent>
          </Card>
        </Link>

        {/* Payable to Orel */}
        <Link href="/dashboard/office/orange/purchases">
          <Card className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-blue-500 h-full">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-3 px-3 sm:px-6 sm:pt-4">
              <CardTitle className="text-xs sm:text-sm font-medium text-slate-600 leading-tight">Payable to Orel</CardTitle>
              <div className="p-1.5 bg-blue-100 rounded-md">
                <Factory className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-blue-600" />
              </div>
            </CardHeader>
            <CardContent className="px-3 pb-3 sm:px-6 sm:pb-4">
              <div className="text-lg sm:text-2xl font-bold text-blue-700">
                LKR {(data.stats.supplierDueAmount / 1000).toFixed(1)}k
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">Outstanding balance</p>
            </CardContent>
          </Card>
        </Link>

        {/* Low Stock */}
        <Link href="/dashboard/office/orange/inventory">
          <Card className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-amber-500 h-full">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-3 px-3 sm:px-6 sm:pt-4">
              <CardTitle className="text-xs sm:text-sm font-medium text-slate-600">Low Stock</CardTitle>
              <div className="p-1.5 bg-amber-100 rounded-md">
                <Package className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-amber-600" />
              </div>
            </CardHeader>
            <CardContent className="px-3 pb-3 sm:px-6 sm:pb-4">
              <div className="text-lg sm:text-2xl font-bold text-amber-700">
                {data.stats.lowStockCount}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">Below reorder level</p>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Main Content — stacked on mobile/tablet, side-by-side on desktop */}
      <div className="grid gap-5 lg:grid-cols-7">
        {/* Recent Invoices */}
        <Card className="lg:col-span-5">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                  <Banknote className="h-4 w-4 sm:h-5 sm:w-5 text-slate-500" />
                  Recent Invoices
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm mt-0.5">
                  Latest customer billing activity
                </CardDescription>
              </div>
              <Link href="/dashboard/office/orange/invoices">
                <Button variant="ghost" size="sm" className="text-xs sm:text-sm gap-1">
                  View All <ArrowUpRight className="h-3 w-3" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="px-3 sm:px-6">
            {data.recentInvoices.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center text-muted-foreground bg-slate-50 rounded-lg border border-dashed">
                <Wallet className="h-10 w-10 mb-2 opacity-20" />
                <p className="text-sm">No invoices recorded yet.</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {data.recentInvoices.map((inv: any) => (
                  <div
                    key={inv.id}
                    className="flex items-center gap-3 p-3 sm:p-4 bg-white border rounded-lg hover:bg-slate-50 transition-colors"
                  >
                    <div className="p-2 bg-green-100 rounded-md text-green-700 shrink-0">
                      <Banknote className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-900 text-sm truncate">
                        {inv.customerName || "Walking Customer"}
                      </p>
                      <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                        <span className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">
                          {inv.invoiceNo}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {inv.date ? new Date(inv.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "-"}
                        </span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-bold text-slate-900 text-sm">
                        LKR {inv.finalAmount?.toLocaleString() ?? "-"}
                      </p>
                      <Badge
                        variant="outline"
                        className={
                          inv.paymentStatus === "Paid"
                            ? "text-green-600 border-green-200 bg-green-50 text-xs"
                            : inv.paymentStatus === "Unpaid"
                            ? "text-red-600 border-red-200 bg-red-50 text-xs"
                            : "text-amber-600 border-amber-200 bg-amber-50 text-xs"
                        }
                      >
                        {inv.paymentStatus}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right Column: Alerts + Quick Actions */}
        <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-5">
          {/* High Value Due */}
          <Card className="border-red-200 shadow-sm">
            <CardHeader className="bg-red-50/60 pb-2 pt-3 px-4 rounded-t-lg">
              <CardTitle className="text-sm flex items-center gap-2 text-red-800">
                <Clock className="h-4 w-4" />
                High Value Due
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-3 px-4 pb-3">
              {data.urgentDueInvoices.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">
                  No major dues pending.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {data.urgentDueInvoices.map((inv: any) => (
                    <div
                      key={inv.id}
                      className="flex items-center justify-between border-b pb-2 last:border-0 last:pb-0"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">
                          {inv.customerName}
                        </p>
                        <p className="text-xs text-red-500 font-mono">
                          {inv.invoiceNo}
                        </p>
                      </div>
                      <span className="text-sm font-bold text-red-700 ml-2 shrink-0">
                        LKR {(inv.dueAmount / 1000).toFixed(1)}k
                      </span>
                    </div>
                  ))}
                </div>
              )}
              <Link href="/dashboard/office/orange/invoices/due">
                <Button
                  size="sm"
                  variant="ghost"
                  className="w-full mt-3 text-red-600 hover:text-red-700 hover:bg-red-50 text-xs"
                >
                  View All Dues →
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader className="pb-2 pt-3 px-4">
              <CardTitle className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Quick Actions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 px-4 pb-4">
              <Link href="/dashboard/office/orange/payments/entry">
                <Button variant="outline" className="w-full justify-start text-sm gap-2">
                  <ArrowDownRight className="h-4 w-4 text-green-600 shrink-0" />
                  Receive Payment
                </Button>
              </Link>
              <Link href="/dashboard/office/orange/suppliers/payments">
                <Button variant="outline" className="w-full justify-start text-sm gap-2">
                  <ArrowUpRight className="h-4 w-4 text-red-600 shrink-0" />
                  Pay Supplier
                </Button>
              </Link>
              <Link href="/dashboard/office/orange/inventory/damage/create">
                <Button variant="outline" className="w-full justify-start text-sm gap-2">
                  <AlertCircle className="h-4 w-4 text-orange-600 shrink-0" />
                  Report Damage
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
