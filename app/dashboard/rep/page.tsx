"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Users, 
  ShoppingBag, 
  CreditCard, 
  AlertCircle, 
  Plus, 
  TrendingUp,
  MapPin
} from "lucide-react";
import { useRouter } from "next/navigation";

export default function RepDashboardPage() {
  const router = useRouter();

  return (
    <div className="space-y-6">
      {/* Page Title & Action Button */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">My Dashboard</h2>
          <p className="text-muted-foreground">Welcome back, here is your daily summary.</p>
        </div>
        <Button 
          onClick={() => router.push("/dashboard/rep/orders/create")}
          className="bg-black hover:bg-gray-800 text-white"
        >
          <Plus className="mr-2 h-4 w-4" /> Create New Order
        </Button>
      </div>
      
      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monthly Sales</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">LKR 850,000</div>
            <p className="text-xs text-muted-foreground">+12% from last month</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Orders</CardTitle>
            <ShoppingBag className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">8</div>
            <p className="text-xs text-muted-foreground">2 Pending Approval</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Due Collections</CardTitle>
            <AlertCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">LKR 125,000</div>
            <p className="text-xs text-muted-foreground">From 3 Customers</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">My Commission</CardTitle>
            <CreditCard className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">LKR 42,500</div>
            <p className="text-xs text-muted-foreground">Pending Payout</p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity & Route Section */}
      <div className="grid gap-4 md:grid-cols-7">
        {/* Recent Orders List */}
        <Card className="md:col-span-4">
          <CardHeader>
            <CardTitle>Recent Orders</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                { id: "ORD-001", shop: "Saman Electronics", amount: "15,400", status: "Pending", color: "bg-yellow-100 text-yellow-800" },
                { id: "ORD-002", shop: "City Hardware", amount: "85,000", status: "Processing", color: "bg-blue-100 text-blue-800" },
                { id: "ORD-003", shop: "Lanka Traders", amount: "24,500", status: "Delivered", color: "bg-green-100 text-green-800" },
              ].map((order, i) => (
                <div key={i} className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0">
                  <div>
                    <p className="font-medium">{order.shop}</p>
                    <p className="text-sm text-muted-foreground">{order.id}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">LKR {order.amount}</p>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${order.color}`}>
                      {order.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Route & Visits */}
        <Card className="md:col-span-3">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-4 w-4" /> Route Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h4 className="font-bold text-blue-900">Galle Town</h4>
                    <p className="text-xs text-blue-600">Assigned Route</p>
                  </div>
                  <span className="text-lg font-bold text-blue-700">66%</span>
                </div>
                <div className="h-2 w-full bg-blue-200 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-600 w-[66%]"></div>
                </div>
                <p className="text-xs text-blue-600 mt-2 font-medium">12 of 18 Shops Visited Today</p>
              </div>
              
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Next Visits</h4>
                <div className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-md transition-colors cursor-pointer">
                  <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-700">1</div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">Ruhuna Motors</p>
                    <p className="text-xs text-muted-foreground">Last visited: 3 days ago</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-md transition-colors cursor-pointer">
                  <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-700">2</div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">Global Paints</p>
                    <p className="text-xs text-muted-foreground">Last visited: 7 days ago</p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}