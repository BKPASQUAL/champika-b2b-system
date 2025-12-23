// app/dashboard/office/distribution/page.tsx
"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle, 
  CardDescription 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Truck,
  Package,
  ClipboardCheck,
  Clock,
  AlertCircle,
  Warehouse,
  ArrowUpRight,
  AlertTriangle,
  FileText,
  Loader2,
  TrendingUp,
  Banknote
} from "lucide-react";
import { getUserBusinessContext } from "@/app/middleware/businessAuth";
import { BUSINESS_IDS } from "@/app/config/business-constants";
import { toast } from "sonner";

// Define the shape of our dashboard data
interface DashboardData {
  stats: {
    pendingOrders: number;
    processingOrders: number;
    activeLoads: number;
    completedToday: number;
    lowStockCount: number;
    overdueInvoiceCount: number;
    overdueAmount: number;
  };
  recentPending: any[];
  urgentOverdue: any[];
}

export default function DistributionDashboardPage() {
  const [businessName, setBusinessName] = useState("");
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DashboardData>({
    stats: {
      pendingOrders: 0,
      processingOrders: 0,
      activeLoads: 0,
      completedToday: 0,
      lowStockCount: 0,
      overdueInvoiceCount: 0,
      overdueAmount: 0,
    },
    recentPending: [],
    urgentOverdue: [],
  });

  useEffect(() => {
    const user = getUserBusinessContext();
    if (user?.businessName) {
      setBusinessName(user.businessName);
    }
    fetchAllDashboardData();
  }, []);

  const fetchAllDashboardData = async () => {
    try {
      setLoading(true);
      const distId = BUSINESS_IDS.CHAMPIKA_DISTRIBUTION;

      // 1. Fetch Orders (For Pending, Processing, Loads)
      // Note: In a real scenario, you might want specific endpoints for counts to optimize performance
      const ordersRes = await fetch(`/api/orders`);
      const ordersData = ordersRes.ok ? await ordersRes.json() : [];

      // 2. Fetch Invoices (For Overdue)
      const invoicesRes = await fetch(`/api/invoices?businessId=${distId}&status=Overdue`);
      const invoicesData = invoicesRes.ok ? await invoicesRes.json() : [];

      // 3. Fetch Inventory (For Low Stock)
      const inventoryRes = await fetch(`/api/inventory?businessId=${distId}`);
      const inventoryData = inventoryRes.ok ? await inventoryRes.json() : null;

      // --- Process Data ---

      // Orders Stats
      const pending = ordersData.filter((o: any) => o.status === "Pending");
      const processing = ordersData.filter((o: any) => o.status === "Processing");
      const loading = ordersData.filter((o: any) => o.status === "Loading");
      const today = new Date().toISOString().split('T')[0];
      const completedToday = ordersData.filter((o: any) => 
        (o.status === "Delivered" || o.status === "Completed") && 
        o.updatedAt?.startsWith(today)
      );

      // Invoice Stats (Overdue)
      // Filter strictly for overdue logic if API doesn't fully handle it
      const now = new Date();
      const overdueList = invoicesData.filter((inv: any) => {
        const dueDate = new Date(inv.createdAt); // Simplified due date logic
        dueDate.setDate(dueDate.getDate() + 30); // Assuming 30 days credit
        return dueDate < now && inv.dueAmount > 0;
      });
      
      const totalOverdueAmount = overdueList.reduce((sum: number, inv: any) => sum + inv.dueAmount, 0);

      // Inventory Stats
      const lowStock = inventoryData?.stats?.lowStock || 0;

      setData({
        stats: {
          pendingOrders: pending.length,
          processingOrders: processing.length,
          activeLoads: loading.length,
          completedToday: completedToday.length,
          lowStockCount: lowStock,
          overdueInvoiceCount: overdueList.length,
          overdueAmount: totalOverdueAmount,
        },
        recentPending: pending.slice(0, 5), // Top 5 pending
        urgentOverdue: overdueList.slice(0, 3), // Top 3 overdue
      });

    } catch (error) {
      console.error("Dashboard fetch error:", error);
      toast.error("Failed to update dashboard data");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[80vh]">
        <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Distribution Overview</h1>
          <p className="text-slate-500 mt-1 flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            {businessName || "Champika Hardware"} • {new Date().toLocaleDateString()}
          </p>
        </div>
        <div className="flex gap-2">
           <Link href="/dashboard/office/distribution/orders/create">
            <Button>
                + New Order
            </Button>
           </Link>
           <Button variant="outline" onClick={fetchAllDashboardData}>
             Refresh
           </Button>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Pending Orders */}
        <Link href="/dashboard/office/distribution/orders/pending">
            <Card className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-yellow-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pending Approval</CardTitle>
                <Clock className="h-4 w-4 text-yellow-600" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold text-yellow-700">{data.stats.pendingOrders}</div>
                <p className="text-xs text-muted-foreground mt-1">Orders waiting for check</p>
            </CardContent>
            </Card>
        </Link>

        {/* Active Loads */}
        <Link href="/dashboard/office/distribution/orders/loading">
            <Card className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-blue-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Loads</CardTitle>
                <Truck className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold text-blue-700">{data.stats.activeLoads}</div>
                <p className="text-xs text-muted-foreground mt-1">Vehicles loading/transit</p>
            </CardContent>
            </Card>
        </Link>

        {/* Overdue Invoices */}
        <Link href="/dashboard/office/distribution/invoices/due">
            <Card className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-red-500 bg-red-50/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-red-700">Due Invoices</CardTitle>
                <AlertCircle className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold text-red-700">
                    {data.stats.overdueInvoiceCount} <span className="text-sm font-normal text-red-600/80">({(data.stats.overdueAmount / 1000).toFixed(0)}k)</span>
                </div>
                <p className="text-xs text-red-600/80 mt-1">Payments overdue  30 days</p>
            </CardContent>
            </Card>
        </Link>

        {/* Low Stock */}
        <Link href="/dashboard/office/distribution/inventory">
            <Card className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-orange-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Low Stock</CardTitle>
                <Warehouse className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold text-orange-700">{data.stats.lowStockCount}</div>
                <p className="text-xs text-muted-foreground mt-1">Items below minimum level</p>
            </CardContent>
            </Card>
        </Link>
      </div>

      {/* Main Content Sections */}
      <div className="grid gap-6 md:grid-cols-7">
        
        {/* Left Column: Recent Pending Orders (Wide) */}
        <Card className="md:col-span-4 lg:col-span-5">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-slate-500" />
                    Orders Requiring Action
                </CardTitle>
                <CardDescription>Recent orders waiting for your approval.</CardDescription>
            </CardHeader>
            <CardContent>
                {data.recentPending.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground bg-slate-50 rounded-lg border border-dashed">
                        <Clock className="h-10 w-10 mb-2 opacity-20" />
                        <p>No pending orders. All caught up!</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {data.recentPending.map((order: any) => (
                            <div key={order.id} className="flex items-center justify-between p-4 bg-white border rounded-lg hover:bg-slate-50 transition-colors">
                                <div className="flex items-start gap-3">
                                    <div className="p-2 bg-yellow-100 rounded text-yellow-700">
                                        <Clock className="h-4 w-4" />
                                    </div>
                                    <div>
                                        <p className="font-medium text-slate-900">{order.shopName || "Unknown Shop"}</p>
                                        <div className="flex items-center gap-2 text-sm text-muted-foreground mt-0.5">
                                            <span className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded">{order.invoiceNo || order.orderId}</span>
                                            <span>• {order.salesRep}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="font-bold text-slate-900">LKR {order.totalAmount?.toLocaleString()}</p>
                                    <Link href={`/dashboard/office/distribution/orders/${order.id}`}>
                                        <Button variant="link" size="sm" className="h-auto p-0 text-blue-600">
                                            Review Order &rarr;
                                        </Button>
                                    </Link>
                                </div>
                            </div>
                        ))}
                        <Link href="/dashboard/office/distribution/orders/pending">
                            <Button variant="outline" className="w-full mt-2">View All Pending</Button>
                        </Link>
                    </div>
                )}
            </CardContent>
        </Card>

        {/* Right Column: Alerts & Urgent (Narrow) */}
        <div className="md:col-span-3 lg:col-span-2 space-y-6">
            
            {/* Urgent Invoices Card */}
            <Card className="border-red-200 shadow-sm">
                <CardHeader className="bg-red-50/50 pb-3">
                    <CardTitle className="text-base flex items-center gap-2 text-red-800">
                        <AlertTriangle className="h-4 w-4" />
                        Urgent Collections
                    </CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                    {data.urgentOverdue.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">No critical overdue bills.</p>
                    ) : (
                        <div className="space-y-3">
                            {data.urgentOverdue.map((inv: any) => (
                                <div key={inv.id} className="flex items-center justify-between border-b pb-2 last:border-0 last:pb-0">
                                    <div className="overflow-hidden">
                                        <p className="text-sm font-medium truncate">{inv.customer?.shopName || "Customer"}</p>
                                        <p className="text-xs text-red-500 font-mono">{inv.invoiceNo}</p>
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
                    <Link href="/dashboard/office/distribution/invoices/due">
                        <Button size="sm" variant="ghost" className="w-full mt-3 text-red-600 hover:text-red-700 hover:bg-red-50">
                            View Due List
                        </Button>
                    </Link>
                </CardContent>
            </Card>

            {/* Quick Stats / Capacity */}
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-slate-500">
                        Today's Throughput
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-2xl font-bold">{data.stats.completedToday}</span>
                        <Package className="h-8 w-8 text-green-100 text-slate-200" />
                    </div>
                    <p className="text-xs text-muted-foreground">Orders dispatched & completed today.</p>
                    
                    <div className="mt-4 pt-4 border-t space-y-2">
                        <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Active Loads</span>
                            <span className="font-medium">{data.stats.activeLoads}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Processing</span>
                            <span className="font-medium">{data.stats.processingOrders}</span>
                        </div>
                    </div>
                </CardContent>
            </Card>

        </div>
      </div>
    </div>
  );
}