"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShoppingCart, CheckCircle2, AlertCircle, Wallet } from "lucide-react";
import { Purchase } from "../types";

interface PurchaseStatsProps {
  purchases: Purchase[];
}

export function PurchaseStats({ purchases }: PurchaseStatsProps) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const totalPurchases = purchases.length;

  const totalSpent = purchases.reduce(
    (sum, p) => sum + (Number(p.totalAmount) || 0),
    0
  );

  const totalUnpaid = purchases.reduce((sum, p) => {
    const total = Number(p.totalAmount) || 0;
    const paid = Number(p.paidAmount) || 0;
    return sum + (total - paid);
  }, 0);

  const pendingDeliveries = purchases.filter(
    (p) => p.status === "Ordered"
  ).length;

  const formatCompact = (amount: number) => {
    if (!isMounted) return "Loading...";

    return new Intl.NumberFormat("en-LK", {
      notation: "compact",
      compactDisplay: "short",
      maximumFractionDigits: 1,
      style: "currency",
      currency: "LKR",
    }).format(amount);
  };

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Total Purchases</CardTitle>
          <ShoppingCart className="w-4 h-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{totalPurchases}</div>
          <p className="text-xs text-muted-foreground mt-1">Orders placed</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Total Value</CardTitle>
          <CheckCircle2 className="w-4 h-4 text-blue-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-blue-600">
            {formatCompact(totalSpent)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">Total PO Value</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Outstanding</CardTitle>
          <Wallet className="w-4 h-4 text-red-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-red-600">
            {formatCompact(totalUnpaid)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">Unpaid Amount</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Pending</CardTitle>
          <AlertCircle className="w-4 h-4 text-amber-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-amber-600">
            {pendingDeliveries}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Orders to receive
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
