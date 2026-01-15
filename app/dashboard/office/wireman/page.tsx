"use client";

import React, { useState, useEffect } from "react";
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

export default function WiremanDashboardPage() {
  const [businessName, setBusinessName] = useState("");
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DashboardData>({
    stats: {
      todaySales: 0,
      todaySalesCount: 0,
      dueInvoicesCount: 0,
      dueInvoicesAmount: 0,
      supplierDueAmount: 0,
      lowStockCount: 0,
    },
    recentInvoices: [],
    urgentDueInvoices: [],
  });

  useEffect(() => {
    const user = getUserBusinessContext();
    if (user?.businessName) {
      setBusinessName(user.businessName);
    }
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      // ✅ Use Wireman ID
      const wiremanId = BUSINESS_IDS.WIREMAN_AGENCY;

      // 1. Fetch Invoices (Sales & Dues)
      const invRes = await fetch(`/api/invoices?businessId=${wiremanId}`);
      const invoices = invRes.ok ? await invRes.json() : [];

      // 2. Fetch Purchases (Supplier Payables)
      const purRes = await fetch(`/api/purchases?businessId=${wiremanId}`);
      const purchases = purRes.ok ? await purRes.json() : [];

      // 3. Fetch Inventory (Stock Levels)
      const stockRes = await fetch(`/api/inventory?businessId=${wiremanId}`);
      const stockData = stockRes.ok ? await stockRes.json() : null;

      // --- Process Data ---

      // A. Today's Sales
      const todayStr = new Date().toISOString().split("T")[0];
      const todayInvoices = invoices.filter(
        (inv: any) => inv.date && inv.date.startsWith(todayStr)
      );

      const todaySalesVal = todayInvoices.reduce(
        (sum: number, inv: any) =>
          sum + (inv.finalAmount || inv.totalAmount || 0),
        0
      );

      // B. Customer Due (Receivables)
      const dueInvoices = invoices.filter(
        (inv: any) =>
          inv.paymentStatus !== "Paid" &&
          (inv.dueAmount > 0 || inv.status === "Overdue")
      );
      const totalDueAmount = dueInvoices.reduce(
        (sum: number, inv: any) => sum + (inv.dueAmount || 0),
        0
      );

      // C. Supplier Due (Payables to Wireman Suppliers)
      const supplierDue = purchases.reduce((sum: number, p: any) => {
        const total = Number(p.totalAmount) || 0;
        const paid = Number(p.paidAmount) || 0;
        return sum + (total - paid);
      }, 0);

      // D. Low Stock
      const lowStock = stockData?.stats?.lowStock || 0;

      setData({
        stats: {
          todaySales: todaySalesVal,
          todaySalesCount: todayInvoices.length,
          dueInvoicesCount: dueInvoices.length,
          dueInvoicesAmount: totalDueAmount,
          supplierDueAmount: supplierDue,
          lowStockCount: lowStock,
        },
        recentInvoices: invoices.slice(0, 5),
        urgentDueInvoices: dueInvoices
          .sort((a: any, b: any) => b.dueAmount - a.dueAmount)
          .slice(0, 3),
      });
    } catch (error) {
      console.error("Error loading dashboard", error);
      toast.error("Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[80vh]">
        <Loader2 className="h-10 w-10 animate-spin text-red-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            Wireman Overview
          </h1>
          <p className="text-slate-500 mt-1 flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            {businessName || "Wireman Agency"} •{" "}
            {new Date().toLocaleDateString()}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/office/wireman/invoices/create">
            <Button className="bg-red-600 hover:bg-red-700 text-white">
              + New Invoice
            </Button>
          </Link>
          <Button variant="outline" onClick={fetchDashboardData}>
            Refresh
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* 1. Today's Sales */}
        <Card className="border-l-4 border-l-green-500 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today's Sales</CardTitle>
            <ShoppingCart className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-700">
              LKR {(data.stats.todaySales / 1000).toFixed(1)}k
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {data.stats.todaySalesCount} invoices generated
            </p>
          </CardContent>
        </Card>

        {/* 2. Customer Due (Receivables) */}
        <Link href="/dashboard/office/wireman/invoices/due">
          <Card className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-red-500 bg-red-50/10">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-red-700">
                Customer Dues
              </CardTitle>
              <AlertCircle className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-700">
                LKR {(data.stats.dueInvoicesAmount / 1000).toFixed(1)}k
              </div>
              <p className="text-xs text-red-600/80 mt-1">
                {data.stats.dueInvoicesCount} invoices pending
              </p>
            </CardContent>
          </Card>
        </Link>

        {/* 3. Supplier Payables */}
        <Link href="/dashboard/office/wireman/purchases">
          <Card className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-blue-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Payable to Suppliers
              </CardTitle>
              <Factory className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-700">
                LKR {(data.stats.supplierDueAmount / 1000).toFixed(1)}k
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Outstanding bills balance
              </p>
            </CardContent>
          </Card>
        </Link>

        {/* 4. Low Stock */}
        <Link href="/dashboard/office/wireman/inventory">
          <Card className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-amber-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Low Stock</CardTitle>
              <Package className="h-4 w-4 text-amber-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-700">
                {data.stats.lowStockCount}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Items below reorder level
              </p>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Main Content Areas */}
      <div className="grid gap-6 md:grid-cols-7">
        {/* Left Column: Recent Invoices (Wide) */}
        <Card className="md:col-span-4 lg:col-span-5">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Banknote className="h-5 w-5 text-slate-500" />
                  Recent Invoices
                </CardTitle>
                <CardDescription>
                  Latest customer billing activity.
                </CardDescription>
              </div>
              <Link href="/dashboard/office/wireman/invoices">
                <Button variant="ghost" size="sm">
                  View All &rarr;
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {data.recentInvoices.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground bg-slate-50 rounded-lg border border-dashed">
                <Wallet className="h-10 w-10 mb-2 opacity-20" />
                <p>No invoices recorded yet.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {data.recentInvoices.map((inv: any) => (
                  <div
                    key={inv.id}
                    className="flex items-center justify-between p-4 bg-white border rounded-lg hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-green-100 rounded text-green-700">
                        <Banknote className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="font-medium text-slate-900">
                          {inv.customerName || "Walking Customer"}
                        </p>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground mt-0.5">
                          <span className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded">
                            {inv.invoiceNo}
                          </span>
                          <span>
                            •{" "}
                            {inv.date
                              ? new Date(inv.date).toLocaleDateString()
                              : "-"}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-slate-900">
                        LKR {inv.finalAmount?.toLocaleString()}
                      </p>
                      <Badge
                        variant="outline"
                        className={
                          inv.paymentStatus === "Paid"
                            ? "text-green-600 border-green-200 bg-green-50"
                            : inv.paymentStatus === "Unpaid"
                            ? "text-red-600 border-red-200 bg-red-50"
                            : "text-amber-600 border-amber-200 bg-amber-50"
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

        {/* Right Column: Urgent Alerts (Narrow) */}
        <div className="md:col-span-3 lg:col-span-2 space-y-6">
          {/* Urgent Collections */}
          <Card className="border-red-200 shadow-sm">
            <CardHeader className="bg-red-50/50 pb-3">
              <CardTitle className="text-base flex items-center gap-2 text-red-800">
                <Clock className="h-4 w-4" />
                High Value Due
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              {data.urgentDueInvoices.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No major dues pending.
                </p>
              ) : (
                <div className="space-y-3">
                  {data.urgentDueInvoices.map((inv: any) => (
                    <div
                      key={inv.id}
                      className="flex items-center justify-between border-b pb-2 last:border-0 last:pb-0"
                    >
                      <div className="overflow-hidden">
                        <p className="text-sm font-medium truncate w-28">
                          {inv.customerName}
                        </p>
                        <p className="text-xs text-red-500 font-mono">
                          {inv.invoiceNo}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-bold text-red-700">
                          {(inv.dueAmount / 1000).toFixed(1)}k
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <Link href="/dashboard/office/wireman/invoices/due">
                <Button
                  size="sm"
                  variant="ghost"
                  className="w-full mt-3 text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  View All Dues
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">
                Quick Actions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Link href="/dashboard/office/wireman/payments">
                <Button variant="outline" className="w-full justify-start">
                  <ArrowDownRight className="mr-2 h-4 w-4 text-green-600" />
                  Receive Payment
                </Button>
              </Link>
              <Link href="/dashboard/office/wireman/suppliers/payments">
                <Button variant="outline" className="w-full justify-start">
                  <ArrowUpRight className="mr-2 h-4 w-4 text-red-600" />
                  Pay Supplier
                </Button>
              </Link>
              <Link href="/dashboard/office/wireman/inventory/damage/create">
                <Button variant="outline" className="w-full justify-start">
                  <AlertCircle className="mr-2 h-4 w-4 text-orange-600" />
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
