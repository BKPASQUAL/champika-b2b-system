// app/dashboard/office/wireman/purchases/_components/PurchaseStats.tsx
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

  const totalBills = purchases.length;

  const last30DaysValue = purchases.reduce((sum, p) => {
    const pDate = new Date(p.purchaseDate);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    thirtyDaysAgo.setHours(0, 0, 0, 0);
    pDate.setHours(0, 0, 0, 0);

    if (pDate >= thirtyDaysAgo) {
      return sum + (Number(p.totalAmount) || 0);
    }
    return sum;
  }, 0);

  const pendingPaymentCount = purchases.filter(
    (p) => p.paymentStatus !== "Paid"
  ).length;

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
      {/* Total Bills */}
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

      {/* 30 Days Value - Red Theme */}
      <Card className="border-l-4 border-l-red-500 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Purchasing (30 Days)
          </CardTitle>
          <CalendarRange className="w-4 h-4 text-red-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-red-700">
            {formatCurrency(last30DaysValue)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Last 30 days volume
          </p>
        </CardContent>
      </Card>

      {/* Pending Payment */}
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

      {/* Total Outstanding */}
      <Card className="border-l-4 border-l-red-800 shadow-sm bg-red-50/20">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-red-900">
            Total Outstanding
          </CardTitle>
          <AlertCircle className="w-4 h-4 text-red-800" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-red-800">
            {formatCurrency(totalOutstanding)}
          </div>
          <p className="text-xs text-red-700/70 mt-1">Payable to Suppliers</p>
        </CardContent>
      </Card>
    </div>
  );
}
