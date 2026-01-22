"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Banknote,
  CalendarClock,
  AlertCircle,
  CheckCircle2,
  Clock,
  AlertOctagon,
  TrendingUp,
} from "lucide-react";
import { Invoice } from "../types";

interface InvoiceStatsProps {
  invoices: Invoice[];
}

export function InvoiceStats({ invoices }: InvoiceStatsProps) {
  const totalRevenue = invoices.reduce((sum, inv) => sum + inv.totalAmount, 0);

  // ✅ Total Profit Calculation
  const totalProfit = invoices.reduce((sum, inv) => sum + (inv.profit || 0), 0);

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const last30DaysRevenue = invoices
    .filter((inv) => new Date(inv.date) >= thirtyDaysAgo)
    .reduce((sum, inv) => sum + inv.totalAmount, 0);

  const totalDue = invoices.reduce((sum, inv) => sum + inv.dueAmount, 0);
  const paidCount = invoices.filter((inv) => inv.status === "Paid").length;
  const pendingCount = invoices.filter(
    (inv) => inv.status === "Unpaid" || inv.status === "Partial",
  ).length;
  const overdueCount = invoices.filter(
    (inv) => inv.status === "Overdue",
  ).length;

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-7">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
          <Banknote className="w-4 h-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            LKR {(totalRevenue / 1000000).toFixed(2)}M
          </div>
          <p className="text-xs text-muted-foreground mt-1">Lifetime sales</p>
        </CardContent>
      </Card>

      {/* ✅ PROFIT CARD */}
      <Card className="bg-green-50 border-green-200">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-green-900">
            Total Profit
          </CardTitle>
          <TrendingUp className="w-4 h-4 text-green-700" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-700">
            LKR {(totalProfit / 1000000).toFixed(2)}M
          </div>
          <p className="text-xs text-green-600 mt-1 font-medium">
            (Excl. Free Items)
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">
            Revenue (30 Days)
          </CardTitle>
          <CalendarClock className="w-4 h-4 text-red-600" /> {/* Red Theme */}
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-red-600">
            LKR {(last30DaysRevenue / 100000).toFixed(2)}L
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Sales in last month
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Due Amount</CardTitle>
          <AlertCircle className="w-4 h-4 text-red-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-red-600">
            LKR {(totalDue / 100000).toFixed(2)}L
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Outstanding payments
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Paid Invoices</CardTitle>
          <CheckCircle2 className="w-4 h-4 text-green-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-600">{paidCount}</div>
          <p className="text-xs text-muted-foreground mt-1">
            Fully settled bills
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Pending Bills</CardTitle>
          <Clock className="w-4 h-4 text-amber-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-amber-600">
            {pendingCount}
          </div>
          <p className="text-xs text-muted-foreground mt-1">Unpaid & Partial</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Overdue Bills</CardTitle>
          <AlertOctagon className="w-4 h-4 text-destructive" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-destructive">
            {overdueCount}
          </div>
          <p className="text-xs text-muted-foreground mt-1">Payment missed</p>
        </CardContent>
      </Card>
    </div>
  );
}
