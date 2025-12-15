// app/dashboard/office/distribution/orders/_components/OrderStats.tsx

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ShoppingCart,
  Clock,
  Loader2,
  ClipboardCheck,
  Truck,
  MapPin,
} from "lucide-react";
import { Order } from "../types";

interface OrderStatsProps {
  orders: Order[];
}

export function OrderStats({ orders }: OrderStatsProps) {
  const totalOrders = orders.length;

  const pendingCount = orders.filter((o) => o.status === "Pending").length;
  const processingCount = orders.filter(
    (o) => o.status === "Processing"
  ).length;
  const checkingCount = orders.filter((o) => o.status === "Checking").length;
  const loadingCount = orders.filter((o) => o.status === "Loading").length;
  const inTransitCount = orders.filter((o) => o.status === "In Transit").length;

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-6">
      {/* Total Orders */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
          <ShoppingCart className="w-4 h-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{totalOrders}</div>
          <p className="text-xs text-muted-foreground mt-1">
            All active orders
          </p>
        </CardContent>
      </Card>

      {/* 1. Pending */}
      <Card className="border-l-4 border-l-yellow-500">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">1. Pending</CardTitle>
          <Clock className="w-4 h-4 text-yellow-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-yellow-600">
            {pendingCount}
          </div>
          <p className="text-xs text-muted-foreground mt-1">Needs approval</p>
        </CardContent>
      </Card>

      {/* 2. Processing */}
      <Card className="border-l-4 border-l-blue-500">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">2. Processing</CardTitle>
          <Loader2 className="w-4 h-4 text-blue-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-blue-600">
            {processingCount}
          </div>
          <p className="text-xs text-muted-foreground mt-1">Picking items</p>
        </CardContent>
      </Card>

      {/* 3. Checking */}
      <Card className="border-l-4 border-l-purple-500">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">3. Checking</CardTitle>
          <ClipboardCheck className="w-4 h-4 text-purple-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-purple-600">
            {checkingCount}
          </div>
          <p className="text-xs text-muted-foreground mt-1">Quality control</p>
        </CardContent>
      </Card>

      {/* 4. Loading */}
      <Card className="border-l-4 border-l-green-500">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">4. Loading</CardTitle>
          <Truck className="w-4 h-4 text-green-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-600">
            {loadingCount}
          </div>
          <p className="text-xs text-muted-foreground mt-1">Ready to ship</p>
        </CardContent>
      </Card>

      {/* 5. In Transit */}
      <Card className="border-l-4 border-l-orange-500">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">5. In Transit</CardTitle>
          <MapPin className="w-4 h-4 text-orange-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-orange-600">
            {inTransitCount}
          </div>
          <p className="text-xs text-muted-foreground mt-1">On the way</p>
        </CardContent>
      </Card>
    </div>
  );
}
