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
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {/* Total Orders */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between p-3 pb-1 sm:pb-2 sm:p-4">
          <CardTitle className="text-xs font-medium sm:text-sm">Total Orders</CardTitle>
          <ShoppingCart className="w-3 h-3 text-muted-foreground sm:w-4 sm:h-4" />
        </CardHeader>
        <CardContent className="p-3 pt-1 sm:p-4 sm:pt-1">
          <div className="text-xl font-bold sm:text-2xl">{totalOrders}</div>
          <p className="text-xs text-muted-foreground mt-0.5">
            All active
          </p>
        </CardContent>
      </Card>

      {/* 1. Pending */}
      <Card className="border-l-4 border-l-yellow-500">
        <CardHeader className="flex flex-row items-center justify-between p-3 pb-1 sm:pb-2 sm:p-4">
          <CardTitle className="text-xs font-medium sm:text-sm">Pending</CardTitle>
          <Clock className="w-3 h-3 text-yellow-600 sm:w-4 sm:h-4" />
        </CardHeader>
        <CardContent className="p-3 pt-1 sm:p-4 sm:pt-1">
          <div className="text-xl font-bold text-yellow-600 sm:text-2xl">
            {pendingCount}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">Needs approval</p>
        </CardContent>
      </Card>

      {/* 2. Processing */}
      <Card className="border-l-4 border-l-blue-500">
        <CardHeader className="flex flex-row items-center justify-between p-3 pb-1 sm:pb-2 sm:p-4">
          <CardTitle className="text-xs font-medium sm:text-sm">Processing</CardTitle>
          <Loader2 className="w-3 h-3 text-blue-600 sm:w-4 sm:h-4" />
        </CardHeader>
        <CardContent className="p-3 pt-1 sm:p-4 sm:pt-1">
          <div className="text-xl font-bold text-blue-600 sm:text-2xl">
            {processingCount}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">Picking items</p>
        </CardContent>
      </Card>

      {/* 3. Checking */}
      <Card className="border-l-4 border-l-purple-500">
        <CardHeader className="flex flex-row items-center justify-between p-3 pb-1 sm:pb-2 sm:p-4">
          <CardTitle className="text-xs font-medium sm:text-sm">Checking</CardTitle>
          <ClipboardCheck className="w-3 h-3 text-purple-600 sm:w-4 sm:h-4" />
        </CardHeader>
        <CardContent className="p-3 pt-1 sm:p-4 sm:pt-1">
          <div className="text-xl font-bold text-purple-600 sm:text-2xl">
            {checkingCount}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">Quality check</p>
        </CardContent>
      </Card>

      {/* 4. Loading */}
      <Card className="border-l-4 border-l-green-500">
        <CardHeader className="flex flex-row items-center justify-between p-3 pb-1 sm:pb-2 sm:p-4">
          <CardTitle className="text-xs font-medium sm:text-sm">Loading</CardTitle>
          <Truck className="w-3 h-3 text-green-600 sm:w-4 sm:h-4" />
        </CardHeader>
        <CardContent className="p-3 pt-1 sm:p-4 sm:pt-1">
          <div className="text-xl font-bold text-green-600 sm:text-2xl">
            {loadingCount}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">Ready to ship</p>
        </CardContent>
      </Card>

      {/* 5. In Transit */}
      <Card className="border-l-4 border-l-orange-500">
        <CardHeader className="flex flex-row items-center justify-between p-3 pb-1 sm:pb-2 sm:p-4">
          <CardTitle className="text-xs font-medium sm:text-sm">In Transit</CardTitle>
          <MapPin className="w-3 h-3 text-orange-600 sm:w-4 sm:h-4" />
        </CardHeader>
        <CardContent className="p-3 pt-1 sm:p-4 sm:pt-1">
          <div className="text-xl font-bold text-orange-600 sm:text-2xl">
            {inTransitCount}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">On the way</p>
        </CardContent>
      </Card>
    </div>
  );
}
