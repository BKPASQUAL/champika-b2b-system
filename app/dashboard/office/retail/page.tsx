// app/dashboard/office/retail/page.tsx
"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Store,
  ShoppingCart,
  Users,
  TrendingUp,
  Package,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  Plus,
} from "lucide-react";
import Link from "next/link";
import { getUserBusinessContext } from "@/app/middleware/businessAuth";

interface DashboardStats {
  todaySales: number;
  todaySalesChange: number;
  todayOrders: number;
  todayOrdersChange: number;
  activeCustomers: number;
  activeCustomersChange: number;
  lowStockItems: number;
  lowStockChange: number;
}

export default function RetailDashboardPage() {
  const [businessName, setBusinessName] = useState("");
  const [stats, setStats] = useState<DashboardStats>({
    todaySales: 0,
    todaySalesChange: 0,
    todayOrders: 0,
    todayOrdersChange: 0,
    activeCustomers: 0,
    activeCustomersChange: 0,
    lowStockItems: 0,
    lowStockChange: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Get user business context
    const user = getUserBusinessContext();
    if (user?.businessName) {
      setBusinessName(user.businessName);
    }

    // Fetch dashboard stats
    fetchDashboardStats();
  }, []);

  const fetchDashboardStats = async () => {
    try {
      setIsLoading(true);
      // TODO: Replace with actual API call
      // const response = await fetch("/api/retail/dashboard/stats");
      // const data = await response.json();

      // Mock data for now
      setTimeout(() => {
        setStats({
          todaySales: 45750.5,
          todaySalesChange: 12.5,
          todayOrders: 23,
          todayOrdersChange: 8.3,
          activeCustomers: 156,
          activeCustomersChange: 5.2,
          lowStockItems: 8,
          lowStockChange: -2.1,
        });
        setIsLoading(false);
      }, 800);
    } catch (error) {
      console.error("Failed to fetch dashboard stats:", error);
      setIsLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-LK", {
      style: "currency",
      currency: "LKR",
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const StatCard = ({
    title,
    value,
    change,
    icon: Icon,
    color,
  }: {
    title: string;
    value: string | number;
    change: number;
    icon: any;
    color: string;
  }) => (
    <Card>
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
        <div className="flex items-center text-xs mt-1">
          {change >= 0 ? (
            <ArrowUpRight className="h-3 w-3 text-green-500 mr-1" />
          ) : (
            <ArrowDownRight className="h-3 w-3 text-red-500 mr-1" />
          )}
          <span className={change >= 0 ? "text-green-500" : "text-red-500"}>
            {Math.abs(change)}%
          </span>
          <span className="text-gray-500 ml-1">vs yesterday</span>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Retail Dashboard</h1>
          <p className="text-gray-500 mt-1">{businessName}</p>
        </div>
        <Link href="/dashboard/office/retail/walkin-sales">
          <Button className="bg-green-600 hover:bg-green-700">
            <Plus className="h-4 w-4 mr-2" />
            New Walk-in Sale
          </Button>
        </Link>
      </div>

      {/* Stats Grid */}
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="pb-2">
                <div className="h-4 bg-gray-200 rounded w-24"></div>
              </CardHeader>
              <CardContent>
                <div className="h-8 bg-gray-200 rounded w-32 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-20"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Today's Sales"
            value={formatCurrency(stats.todaySales)}
            change={stats.todaySalesChange}
            icon={DollarSign}
            color="bg-green-500"
          />
          <StatCard
            title="Orders Today"
            value={stats.todayOrders}
            change={stats.todayOrdersChange}
            icon={ShoppingCart}
            color="bg-blue-500"
          />
          <StatCard
            title="Active Customers"
            value={stats.activeCustomers}
            change={stats.activeCustomersChange}
            icon={Users}
            color="bg-purple-500"
          />
          <StatCard
            title="Low Stock Items"
            value={stats.lowStockItems}
            change={stats.lowStockChange}
            icon={Package}
            color="bg-orange-500"
          />
        </div>
      )}

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <Link href="/dashboard/office/retail/orders">
              <Button variant="outline" className="w-full justify-start">
                <ShoppingCart className="h-4 w-4 mr-2" />
                View Orders
              </Button>
            </Link>
            <Link href="/dashboard/office/retail/customers">
              <Button variant="outline" className="w-full justify-start">
                <Users className="h-4 w-4 mr-2" />
                Manage Customers
              </Button>
            </Link>
            <Link href="/dashboard/office/retail/stock">
              <Button variant="outline" className="w-full justify-start">
                <Package className="h-4 w-4 mr-2" />
                Check Stock
              </Button>
            </Link>
            <Link href="/dashboard/office/retail/reports/sales">
              <Button variant="outline" className="w-full justify-start">
                <TrendingUp className="h-4 w-4 mr-2" />
                Sales Reports
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Orders</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div>
                    <p className="font-medium text-sm">Order #RT{10000 + i}</p>
                    <p className="text-xs text-gray-500">Customer Name {i}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-sm">
                      {formatCurrency(2500 * i)}
                    </p>
                    <p className="text-xs text-gray-500">Just now</p>
                  </div>
                </div>
              ))}
            </div>
            <Link href="/dashboard/office/retail/orders">
              <Button variant="link" className="w-full mt-3">
                View All Orders →
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Low Stock Alerts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { name: "Product A", qty: 5, min: 20 },
                { name: "Product B", qty: 3, min: 15 },
                { name: "Product C", qty: 8, min: 25 },
              ].map((item, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-3 bg-orange-50 rounded-lg border border-orange-200"
                >
                  <div>
                    <p className="font-medium text-sm">{item.name}</p>
                    <p className="text-xs text-gray-500">
                      Min: {item.min} units
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-sm text-orange-600">
                      {item.qty} left
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <Link href="/dashboard/office/retail/stock-requests">
              <Button variant="link" className="w-full mt-3">
                Request Stock →
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
