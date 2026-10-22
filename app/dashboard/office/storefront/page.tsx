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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Globe,
  Package,
  ShoppingCart,
  MessageSquare,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  ArrowRight,
  TrendingUp,
  Loader2,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";

export default function StorefrontOverviewPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [inquiries, setInquiries] = useState<any[]>([]);
  const [backlog, setBacklog] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const [ordersRes, prodsRes, inqRes, backlogRes] = await Promise.all([
        fetch("/api/storefront/manage/orders"),
        fetch("/api/storefront/manage/products"),
        fetch("/api/storefront/manage/inquiries"),
        fetch("/api/storefront/manage/backlog"),
      ]);

      if (ordersRes.ok) setOrders(await ordersRes.json());
      if (prodsRes.ok) setProducts(await prodsRes.json());
      if (inqRes.ok) setInquiries(await inqRes.json());
      if (backlogRes.ok) setBacklog(await backlogRes.json());
    } catch (err: any) {
      toast.error(err.message || "Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  const pendingOrdersCount = orders.filter((o) => o.orderStatus === "Pending").length;
  const publishedProductsCount = products.filter((p) => p.isPublished).length;
  const backlogAlertCount = backlog.length;
  const pendingInquiriesCount = inquiries.filter((i) => i.status !== "resolved").length;

  const fmt = (num: number) =>
    (num || 0).toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="space-y-6 w-full">
      {/* Top Banner & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-amber-500/10 text-amber-600 rounded-lg font-bold text-lg">BK</span>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
              BK Wiring Kade Operations
            </h1>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Online Storefront Cockpit • Live Orders, Products, Customer Inquiries & Reorder Backlog
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => window.open("/", "_blank")}
          >
            <Globe className="w-4 h-4 text-emerald-600" />
            Visit Storefront
            <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => {
              fetchAllData();
              toast.info("Refreshed all storefront data");
            }}
          >
            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
          </Button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Link href="/dashboard/office/storefront/orders">
          <Card className="border-l-4 border-l-amber-500 hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-xs font-semibold text-slate-500 uppercase flex items-center justify-between">
                <span>New Online Orders</span>
                <ShoppingCart className="w-4 h-4 text-amber-500" />
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="text-2xl font-bold text-slate-900">{pendingOrdersCount}</div>
              <p className="text-xs text-amber-600 font-medium mt-1">Pending verification</p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/dashboard/office/storefront/orders">
          <Card className="border-l-4 border-l-blue-500 hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-xs font-semibold text-slate-500 uppercase flex items-center justify-between">
                <span>Total Orders</span>
                <TrendingUp className="w-4 h-4 text-blue-500" />
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="text-2xl font-bold text-slate-900">{orders.length}</div>
              <p className="text-xs text-slate-500 mt-1">Lifetime online orders</p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/dashboard/office/storefront/products">
          <Card className="border-l-4 border-l-emerald-500 hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-xs font-semibold text-slate-500 uppercase flex items-center justify-between">
                <span>Published Online</span>
                <Package className="w-4 h-4 text-emerald-500" />
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="text-2xl font-bold text-slate-900">{publishedProductsCount}</div>
              <p className="text-xs text-emerald-600 font-medium mt-1">Live in catalog</p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/dashboard/office/storefront/backlog">
          <Card className="border-l-4 border-l-rose-500 hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-xs font-semibold text-slate-500 uppercase flex items-center justify-between">
                <span>Stock Shortages</span>
                <AlertTriangle className="w-4 h-4 text-rose-500" />
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="text-2xl font-bold text-rose-600">{backlogAlertCount}</div>
              <p className="text-xs text-rose-500 font-medium mt-1">Items needing reorder</p>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* 4 Operations Hub Quick Cards */}
      <div>
        <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-3">
          Operations Sections
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Orders */}
          <Link href="/dashboard/office/storefront/orders" className="block group">
            <Card className="h-full border border-slate-200 group-hover:border-blue-500 group-hover:shadow-md transition-all">
              <CardHeader className="p-4 pb-2">
                <div className="flex items-center justify-between">
                  <div className="p-2.5 rounded-xl bg-blue-100 text-blue-700 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                    <ShoppingCart className="w-5 h-5" />
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition-transform" />
                </div>
                <CardTitle className="text-base font-bold text-slate-900 mt-3">
                  Orders & Pipeline
                </CardTitle>
                <CardDescription className="text-xs text-slate-500">
                  Manage incoming orders, 1-click CHO-XXXX invoicing, and lorry/courier dispatch
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="text-xs font-semibold text-blue-600 flex items-center gap-1 mt-2">
                  <span>{orders.length} Total Orders</span>
                  {pendingOrdersCount > 0 && (
                    <span className="bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded-full font-bold text-[10px]">
                      {pendingOrdersCount} new
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          </Link>

          {/* Card 2: Products */}
          <Link href="/dashboard/office/storefront/products" className="block group">
            <Card className="h-full border border-slate-200 group-hover:border-emerald-500 group-hover:shadow-md transition-all">
              <CardHeader className="p-4 pb-2">
                <div className="flex items-center justify-between">
                  <div className="p-2.5 rounded-xl bg-emerald-100 text-emerald-700 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                    <Package className="w-5 h-5" />
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition-transform" />
                </div>
                <CardTitle className="text-base font-bold text-slate-900 mt-3">
                  Products & Pricing
                </CardTitle>
                <CardDescription className="text-xs text-slate-500">
                  Publish products, set custom retail pricing, and reserve safety stock for walk-ins
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="text-xs font-semibold text-emerald-600 flex items-center gap-1 mt-2">
                  <span>{publishedProductsCount} Published Live</span>
                </div>
              </CardContent>
            </Card>
          </Link>

          {/* Card 3: Shortage Backlog */}
          <Link href="/dashboard/office/storefront/backlog" className="block group">
            <Card className="h-full border border-slate-200 group-hover:border-rose-500 group-hover:shadow-md transition-all">
              <CardHeader className="p-4 pb-2">
                <div className="flex items-center justify-between">
                  <div className="p-2.5 rounded-xl bg-rose-100 text-rose-700 group-hover:bg-rose-600 group-hover:text-white transition-colors">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition-transform" />
                </div>
                <CardTitle className="text-base font-bold text-slate-900 mt-3">
                  Shortage Backlog
                </CardTitle>
                <CardDescription className="text-xs text-slate-500">
                  Zero-stock items and online customer backorders ready for supplier PO reorders
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="text-xs font-semibold text-rose-600 flex items-center gap-1 mt-2">
                  <span>{backlogAlertCount} Critical Shortages</span>
                </div>
              </CardContent>
            </Card>
          </Link>

          {/* Card 4: Inquiries */}
          <Link href="/dashboard/office/storefront/inquiries" className="block group">
            <Card className="h-full border border-slate-200 group-hover:border-purple-500 group-hover:shadow-md transition-all">
              <CardHeader className="p-4 pb-2">
                <div className="flex items-center justify-between">
                  <div className="p-2.5 rounded-xl bg-purple-100 text-purple-700 group-hover:bg-purple-600 group-hover:text-white transition-colors">
                    <MessageSquare className="w-5 h-5" />
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition-transform" />
                </div>
                <CardTitle className="text-base font-bold text-slate-900 mt-3">
                  Inquiries & Messages
                </CardTitle>
                <CardDescription className="text-xs text-slate-500">
                  Customer product queries, BOQ quotation requests, and 1-click WhatsApp replies
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="text-xs font-semibold text-purple-600 flex items-center gap-1 mt-2">
                  <span>{inquiries.length} Inquiries</span>
                  {pendingInquiriesCount > 0 && (
                    <span className="bg-purple-100 text-purple-800 px-1.5 py-0.2 rounded-full font-bold text-[10px]">
                      {pendingInquiriesCount} pending
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>
      </div>

      {/* Two Live Streams Side-by-Side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Stream 1: Recent Online Orders */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between p-4 border-b">
            <div>
              <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-blue-600" />
                Recent Online Orders
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Latest customer orders from website
              </CardDescription>
            </div>
            <Link href="/dashboard/office/storefront/orders">
              <Button variant="ghost" size="sm" className="h-8 text-xs text-blue-600 hover:text-blue-700 gap-1">
                View All
                <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {loading ? (
                <div className="p-8 text-center text-slate-400 text-xs">
                  <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-600" />
                  Loading recent orders...
                </div>
              ) : orders.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs">
                  No online orders placed yet.
                </div>
              ) : (
                orders.slice(0, 5).map((o) => (
                  <div key={o.id} className="p-3.5 flex items-center justify-between hover:bg-slate-50 transition-colors">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-xs text-slate-900">{o.orderNo}</span>
                        <Badge
                          className={cn(
                            "text-[10px] font-medium capitalize",
                            o.orderStatus === "Pending" && "bg-amber-100 text-amber-800",
                            o.orderStatus === "Confirmed" && "bg-blue-100 text-blue-800",
                            o.orderStatus === "Processing" && "bg-indigo-100 text-indigo-800",
                            o.orderStatus === "Dispatched" && "bg-purple-100 text-purple-800",
                            o.orderStatus === "Delivered" && "bg-emerald-100 text-emerald-800"
                          )}
                        >
                          {o.orderStatus}
                        </Badge>
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {o.customerName} • {o.items?.length || 0} items
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-xs text-slate-900">
                        Rs. {fmt(o.totalAmount)}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {new Date(o.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Stream 2: Critical Shortage Backlog */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between p-4 border-b">
            <div>
              <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600" />
                Critical Shortage Backlog
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Items with 0 physical stock needing supplier PO
              </CardDescription>
            </div>
            <Link href="/dashboard/office/storefront/backlog">
              <Button variant="ghost" size="sm" className="h-8 text-xs text-rose-600 hover:text-rose-700 gap-1">
                View All
                <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {loading ? (
                <div className="p-8 text-center text-slate-400 text-xs">
                  <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-rose-600" />
                  Loading shortages...
                </div>
              ) : backlog.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs">
                  No stock shortages right now!
                </div>
              ) : (
                backlog.slice(0, 5).map((b) => (
                  <div key={b.id} className="p-3.5 flex items-center justify-between hover:bg-slate-50 transition-colors">
                    <div>
                      <div className="font-semibold text-xs text-slate-900 line-clamp-1">{b.name}</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        Brand: {b.brand || "General"} • SKU: {b.sku}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="font-bold text-xs text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full">
                        0 in stock
                      </span>
                      {b.inquiryCount > 0 && (
                        <div className="text-[10px] text-amber-600 font-medium mt-1">
                          {b.inquiryCount} backordered
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function cn(...classes: any[]) {
  return classes.filter(Boolean).join(" ");
}
