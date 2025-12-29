"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShoppingCart, CalendarRange, Clock, AlertCircle } from "lucide-react";
import { Purchase } from "../types";

interface PurchaseStatsProps {
  purchases: Purchase[];
}

export function PurchaseStats({ purchases }: PurchaseStatsProps) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // 1. Total Bills (Count)
  const totalBills = purchases.length;

  // 2. Last 30 Days Purchasing (Value)
  const last30DaysValue = purchases.reduce((sum, p) => {
    const pDate = new Date(p.purchaseDate);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Reset time parts for accurate date comparison
    thirtyDaysAgo.setHours(0, 0, 0, 0);
    pDate.setHours(0, 0, 0, 0);

    if (pDate >= thirtyDaysAgo) {
      return sum + (Number(p.totalAmount) || 0);
    }
    return sum;
  }, 0);

  // 3. Pending Payment (Count)
  // Counts bills that are NOT 'Paid' (i.e., 'Unpaid' or 'Partial')
  const pendingPaymentCount = purchases.filter(
    (p) => p.paymentStatus !== "Paid"
  ).length;

  // 4. Total Outstanding (Value)
  const totalOutstanding = purchases.reduce((sum, p) => {
    const total = Number(p.totalAmount) || 0;
    const paid = Number(p.paidAmount) || 0;
    return sum + (total - paid);
  }, 0);

  const formatCurrency = (amount: number) => {
    if (!isMounted) return "...";
    return new Intl.NumberFormat("en-LK", {
      style: "currency",
      currency: "LKR",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {/* 1. Total Bills */}
      <Card className="border-l-4 border-l-blue-500 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Total Bills
          </CardTitle>
          <ShoppingCart className="w-4 h-4 text-blue-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{totalBills}</div>
          <p className="text-xs text-muted-foreground mt-1">All time orders</p>
        </CardContent>
      </Card>

      {/* 2. Last 30 Days Value */}
      <Card className="border-l-4 border-l-orange-500 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Purchasing (30 Days)
          </CardTitle>
          <CalendarRange className="w-4 h-4 text-orange-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-orange-700">
            {formatCurrency(last30DaysValue)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Last 30 days volume
          </p>
        </CardContent>
      </Card>

      {/* 3. Pending Payment Count (UPDATED) */}
      <Card className="border-l-4 border-l-amber-500 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Pending Payment
          </CardTitle>
          <Clock className="w-4 h-4 text-amber-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-amber-600">
            {pendingPaymentCount}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Bills pending to pay
          </p>
        </CardContent>
      </Card>

      {/* 4. Outstanding Value */}
      <Card className="border-l-4 border-l-red-500 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Total Outstanding
          </CardTitle>
          <AlertCircle className="w-4 h-4 text-red-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-red-600">
            {formatCurrency(totalOutstanding)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Payable to Orel Corp
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
