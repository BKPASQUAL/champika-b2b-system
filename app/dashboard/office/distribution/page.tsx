// app/dashboard/office/distribution/page.tsx
"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Truck,
  Package,
  ClipboardCheck,
  Clock,
  ArrowUpRight,
  Box,
  AlertCircle,
  Warehouse,
} from "lucide-react";
import Link from "next/link";
import { getUserBusinessContext } from "@/app/middleware/businessAuth";

interface DistStats {
  ordersPending: number;
  ordersProcessing: number;
  readyToLoad: number;
  activeLoads: number;
  dispatchedToday: number;
  lowStockItems: number;
}

export default function DistributionDashboardPage() {
  const [businessName, setBusinessName] = useState("");
  const [stats, setStats] = useState<DistStats>({
    ordersPending: 0,
    ordersProcessing: 0,
    readyToLoad: 0,
    activeLoads: 0,
    dispatchedToday: 0,
    lowStockItems: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const user = getUserBusinessContext();
    if (user?.businessName) {
      setBusinessName(user.businessName);
    }
    fetchDashboardStats();
  }, []);

  const fetchDashboardStats = async () => {
    try {
      setIsLoading(true);
      // Mock data for distribution
      setTimeout(() => {
        setStats({
          ordersPending: 12,
          ordersProcessing: 8,
          readyToLoad: 5,
          activeLoads: 3,
          dispatchedToday: 18,
          lowStockItems: 4,
        });
        setIsLoading(false);
      }, 800);
    } catch (error) {
      console.error("Failed to fetch stats");
      setIsLoading(false);
    }
  };

  const StatCard = ({
    title,
    value,
    subtitle,
    icon: Icon,
    color,
    href,
  }: {
    title: string;
    value: string | number;
    subtitle: string;
    icon: any;
    color: string;
    href: string;
  }) => (
    <Link href={href}>
      <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-gray-600">
            {title}
          </CardTitle>
          <div className={`p-2 rounded-lg ${color}`}>
            <Icon className="h-4 w-4 text-white" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{value}</div>
          <p className="text-xs text-gray-500 mt-1">{subtitle}</p>
        </CardContent>
      </Card>
    </Link>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Distribution Overview</h1>
          <p className="text-gray-500 mt-1">{businessName}</p>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/office/orders/loading">
            <Button className="bg-blue-600 hover:bg-blue-700">
              <Box className="h-4 w-4 mr-2" />
              Manage Loads
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Pending Approval"
          value={stats.ordersPending}
          subtitle="Orders waiting for office action"
          icon={Clock}
          color="bg-yellow-500"
          href="/dashboard/office/orders/pending"
        />
        <StatCard
          title="Processing"
          value={stats.ordersProcessing}
          subtitle="Currently being picked"
          icon={Package}
          color="bg-blue-500"
          href="/dashboard/office/orders/processing"
        />
        <StatCard
          title="Ready to Check"
          value={stats.readyToLoad}
          subtitle="Waiting for final check"
          icon={ClipboardCheck}
          color="bg-indigo-500"
          href="/dashboard/office/orders/checking"
        />
        <StatCard
          title="Active Vehicles"
          value={stats.activeLoads}
          subtitle="Currently loading"
          icon={Truck}
          color="bg-green-600"
          href="/dashboard/office/orders/loading"
        />
      </div>

      {/* Main Content Sections */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* Left Col: Priority Actions */}
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Truck className="h-5 w-5 text-blue-600" />
                Active Loads
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-100"
                  >
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-gray-900">
                          Lorry {i} (NC-558{i})
                        </span>
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                          Loading
                        </span>
                      </div>
                      <p className="text-sm text-gray-500">
                        Driver: Sunil Perera • Route: Colombo South
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">
                        {15 + i * 2} Orders
                      </p>
                      <p className="text-xs text-gray-400">Started 2h ago</p>
                    </div>
                  </div>
                ))}
              </div>
              <Button variant="outline" className="w-full mt-4">
                View All Loads
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[
                  { text: "Order #8821 verified by Amal", time: "10 mins ago" },
                  { text: "Lorry NC-2210 dispatched", time: "25 mins ago" },
                  { text: "Stock received from Supplier X", time: "1 hour ago" },
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-3 text-sm">
                    <div className="h-2 w-2 mt-1.5 rounded-full bg-gray-300" />
                    <div>
                      <p className="text-gray-900">{item.text}</p>
                      <p className="text-gray-500 text-xs">{item.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Col: Alerts & Inventory */}
        <div className="space-y-6">
          <Card className="border-red-100 bg-red-50/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2 text-red-700">
                <AlertCircle className="h-4 w-4" />
                Urgent Attention
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2 text-red-600">
                  <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                  3 Orders delayed 
                </li>
                <li className="flex items-center gap-2 text-red-600">
                  <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                  Vehicle breakdown (WP-1122)
                </li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Warehouse className="h-4 w-4 text-gray-500" />
                Inventory Stats
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-500">Warehouse Capacity</span>
                    <span className="font-medium">85%</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 w-[85%]" />
                  </div>
                </div>
                <div className="pt-2 border-t">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium">Low Stock</span>
                    <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">
                      {stats.lowStockItems} Items
                    </span>
                  </div>
                  <Link href="/dashboard/office/inventory">
                    <Button variant="ghost" size="sm" className="w-full text-xs h-8">
                      View Inventory 
                    </Button>
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}