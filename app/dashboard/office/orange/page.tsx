// app/dashboard/office/orange/page.tsx
"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  TrendingUp,
  Users,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  Plus,
  Package,
  Receipt,
  Truck,
  AlertCircle,
  Factory,
} from "lucide-react";
import Link from "next/link";
import { getUserBusinessContext } from "@/app/middleware/businessAuth";

interface DashboardStats {
  monthlyRevenue: number;
  revenueChange: number;
  totalReceivables: number; // Due from customers
  receivablesChange: number;
  totalPayables: number; // Due to suppliers
  payablesChange: number;
  lowStockCount: number;
}

export default function OrangeDistributionDashboard() {
  const [businessName, setBusinessName] = useState("");
  const [stats, setStats] = useState<DashboardStats>({
    monthlyRevenue: 0,
    revenueChange: 0,
    totalReceivables: 0,
    receivablesChange: 0,
    totalPayables: 0,
    payablesChange: 0,
    lowStockCount: 0,
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
      // Mock Data for Distribution Business
      setTimeout(() => {
        setStats({
          monthlyRevenue: 2450000.0,
          revenueChange: 12.5,
          totalReceivables: 850000.0, // Money waiting to be collected
          receivablesChange: -5.2, // Decreased (Good)
          totalPayables: 420000.0, // Money owed to suppliers
          payablesChange: 8.4,
          lowStockCount: 12,
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
    reverseTrend = false,
  }: {
    title: string;
    value: string | number;
    change?: number;
    icon: any;
    color: string;
    reverseTrend?: boolean;
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
        {change !== undefined && (
          <div className="flex items-center text-xs mt-1">
            {change >= 0 ? (
              <ArrowUpRight className="h-3 w-3 text-green-500 mr-1" />
            ) : (
              <ArrowDownRight className="h-3 w-3 text-red-500 mr-1" />
            )}
            <span
              className={
                (change >= 0 && !reverseTrend) || (change < 0 && reverseTrend)
                  ? "text-green-500"
                  : "text-red-500"
              }
            >
              {Math.abs(change)}%
            </span>
            <span className="text-gray-500 ml-1">vs last month</span>
          </div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Overview</h1>
          <p className="text-gray-500 mt-1">
            {businessName} - Distribution Center
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/office/orange/bills">
            <Button variant="outline">
              <Truck className="h-4 w-4 mr-2" />
              Incoming Stock
            </Button>
          </Link>
          <Link href="/dashboard/office/orange/invoices/create">
            <Button className="bg-orange-600 hover:bg-orange-700">
              <Plus className="h-4 w-4 mr-2" />
              New Sale
            </Button>
          </Link>
        </div>
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
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Monthly Revenue"
            value={formatCurrency(stats.monthlyRevenue)}
            change={stats.revenueChange}
            icon={TrendingUp}
            color="bg-green-500"
          />
          <StatCard
            title="To Collect (Receivables)"
            value={formatCurrency(stats.totalReceivables)}
            change={stats.receivablesChange}
            icon={DollarSign}
            color="bg-blue-500"
            reverseTrend={true} // Less is usually better for outstanding payments
          />
          <StatCard
            title="To Pay (Suppliers)"
            value={formatCurrency(stats.totalPayables)}
            change={stats.payablesChange}
            icon={Factory}
            color="bg-orange-500"
          />
          <StatCard
            title="Low Stock Alerts"
            value={stats.lowStockCount}
            change={0}
            icon={AlertCircle}
            color="bg-red-500"
            reverseTrend={true}
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
            <Link href="/dashboard/office/orange/invoices">
              <Button variant="outline" className="w-full justify-start">
                <Receipt className="h-4 w-4 mr-2" />
                Sales Invoices
              </Button>
            </Link>
            <Link href="/dashboard/office/orange/customers">
              <Button variant="outline" className="w-full justify-start">
                <Users className="h-4 w-4 mr-2" />
                Manage Shops
              </Button>
            </Link>
            <Link href="/dashboard/office/orange/inventory">
              <Button variant="outline" className="w-full justify-start">
                <Package className="h-4 w-4 mr-2" />
                Inventory Check
              </Button>
            </Link>
            <Link href="/dashboard/office/orange/suppliers/payments">
              <Button variant="outline" className="w-full justify-start">
                <DollarSign className="h-4 w-4 mr-2" />
                Supplier Payments
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Sales</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                {
                  inv: "INV-001",
                  customer: "Galle Electronics",
                  amount: 45000,
                  status: "Paid",
                },
                {
                  inv: "INV-002",
                  customer: "City Mobile",
                  amount: 12500,
                  status: "Pending",
                },
                {
                  inv: "INV-003",
                  customer: "Tech Zone",
                  amount: 85000,
                  status: "Paid",
                },
              ].map((item, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 bg-green-100 rounded flex items-center justify-center">
                      <Receipt className="h-4 w-4 text-green-600" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{item.inv}</p>
                      <p className="text-xs text-gray-500">{item.customer}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-sm">
                      {formatCurrency(item.amount)}
                    </p>
                    <span
                      className={`text-xs ${
                        item.status === "Paid"
                          ? "text-green-600"
                          : "text-orange-600"
                      }`}
                    >
                      {item.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <Link href="/dashboard/office/orange/invoices">
              <Button variant="link" className="w-full mt-3">
                View All Sales →
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pending Supplier Bills</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                {
                  bill: "SUP-BILL-88",
                  supplier: "Orange Imports",
                  amount: 150000,
                  due: "Today",
                },
                {
                  bill: "SUP-BILL-92",
                  supplier: "Local Logistics",
                  amount: 25000,
                  due: "Tomorrow",
                },
                {
                  bill: "SUP-BILL-95",
                  supplier: "ABC Packaging",
                  amount: 12000,
                  due: "In 3 days",
                },
              ].map((item, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-3 bg-orange-50 rounded-lg border border-orange-100"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 bg-orange-100 rounded flex items-center justify-center">
                      <Factory className="h-4 w-4 text-orange-600" />
                    </div>
                    <div>
                      <p className="font-medium text-sm text-gray-700">
                        {item.supplier}
                      </p>
                      <p className="text-xs text-gray-500">{item.bill}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-sm">
                      {formatCurrency(item.amount)}
                    </p>
                    <p className="text-xs text-red-500 font-medium">
                      Due: {item.due}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <Link href="/dashboard/office/orange/suppliers/payments">
              <Button variant="link" className="w-full mt-3">
                View Payables →
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
