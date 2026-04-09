// app/dashboard/office/distribution/invoices/_components/InvoiceStats.tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Banknote,
  CalendarClock,
  AlertCircle,
  CheckCircle2,
  Clock,
  AlertOctagon,
} from "lucide-react";
import { Invoice } from "../types";

interface InvoiceStatsProps {
  invoices: Invoice[];
}

export function InvoiceStats({ invoices }: InvoiceStatsProps) {
  // 1. Calculate Total Revenue (All Time)
  const totalRevenue = invoices.reduce((sum, inv) => sum + inv.totalAmount, 0);

  // 2. Calculate Last 30 Days Revenue
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const last30DaysRevenue = invoices
    .filter((inv) => new Date(inv.date) >= thirtyDaysAgo)
    .reduce((sum, inv) => sum + inv.totalAmount, 0);

  // 3. Calculate Due Amount
  const totalDue = invoices.reduce((sum, inv) => sum + inv.dueAmount, 0);

  // 4. Calculate Paid Count
  const paidCount = invoices.filter((inv) => inv.status === "Paid").length;

  // 5. Calculate Pending Count (Unpaid + Partial)
  const pendingCount = invoices.filter(
    (inv) => inv.status === "Unpaid" || inv.status === "Partial"
  ).length;

  // 6. Calculate Overdue Count
  const overdueCount = invoices.filter(
    (inv) => inv.status === "Overdue"
  ).length;

  return (
    <div className="grid gap-2 sm:gap-4 grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      <Card className="p-0">
        <CardHeader className="flex flex-row items-center justify-between p-3 sm:p-4 pb-1 sm:pb-2">
          <CardTitle className="text-xs sm:text-sm font-medium leading-tight">Total Revenue</CardTitle>
          <Banknote className="w-3 h-3 sm:w-4 sm:h-4 text-muted-foreground shrink-0" />
        </CardHeader>
        <CardContent className="px-3 sm:px-4 pb-3 sm:pb-4 pt-0">
          <div className="text-base sm:text-2xl font-bold leading-tight">
            LKR {(totalRevenue / 1000000).toFixed(2)}M
          </div>
          <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 sm:mt-1">Lifetime sales</p>
        </CardContent>
      </Card>

      <Card className="p-0">
        <CardHeader className="flex flex-row items-center justify-between p-3 sm:p-4 pb-1 sm:pb-2">
          <CardTitle className="text-xs sm:text-sm font-medium leading-tight">Revenue (30 Days)</CardTitle>
          <CalendarClock className="w-3 h-3 sm:w-4 sm:h-4 text-blue-600 shrink-0" />
        </CardHeader>
        <CardContent className="px-3 sm:px-4 pb-3 sm:pb-4 pt-0">
          <div className="text-base sm:text-2xl font-bold text-blue-600 leading-tight">
            LKR {(last30DaysRevenue / 100000).toFixed(2)}L
          </div>
          <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 sm:mt-1">Last month</p>
        </CardContent>
      </Card>

      <Card className="p-0">
        <CardHeader className="flex flex-row items-center justify-between p-3 sm:p-4 pb-1 sm:pb-2">
          <CardTitle className="text-xs sm:text-sm font-medium leading-tight">Due Amount</CardTitle>
          <AlertCircle className="w-3 h-3 sm:w-4 sm:h-4 text-red-600 shrink-0" />
        </CardHeader>
        <CardContent className="px-3 sm:px-4 pb-3 sm:pb-4 pt-0">
          <div className="text-base sm:text-2xl font-bold text-red-600 leading-tight">
            LKR {(totalDue / 100000).toFixed(2)}L
          </div>
          <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 sm:mt-1">Outstanding</p>
        </CardContent>
      </Card>

      <Card className="p-0">
        <CardHeader className="flex flex-row items-center justify-between p-3 sm:p-4 pb-1 sm:pb-2">
          <CardTitle className="text-xs sm:text-sm font-medium leading-tight">Paid Invoices</CardTitle>
          <CheckCircle2 className="w-3 h-3 sm:w-4 sm:h-4 text-green-600 shrink-0" />
        </CardHeader>
        <CardContent className="px-3 sm:px-4 pb-3 sm:pb-4 pt-0">
          <div className="text-base sm:text-2xl font-bold text-green-600 leading-tight">{paidCount}</div>
          <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 sm:mt-1">Settled bills</p>
        </CardContent>
      </Card>

      <Card className="p-0">
        <CardHeader className="flex flex-row items-center justify-between p-3 sm:p-4 pb-1 sm:pb-2">
          <CardTitle className="text-xs sm:text-sm font-medium leading-tight">Pending Bills</CardTitle>
          <Clock className="w-3 h-3 sm:w-4 sm:h-4 text-amber-600 shrink-0" />
        </CardHeader>
        <CardContent className="px-3 sm:px-4 pb-3 sm:pb-4 pt-0">
          <div className="text-base sm:text-2xl font-bold text-amber-600 leading-tight">{pendingCount}</div>
          <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 sm:mt-1">Unpaid & Partial</p>
        </CardContent>
      </Card>

      <Card className="p-0">
        <CardHeader className="flex flex-row items-center justify-between p-3 sm:p-4 pb-1 sm:pb-2">
          <CardTitle className="text-xs sm:text-sm font-medium leading-tight">Overdue Bills</CardTitle>
          <AlertOctagon className="w-3 h-3 sm:w-4 sm:h-4 text-destructive shrink-0" />
        </CardHeader>
        <CardContent className="px-3 sm:px-4 pb-3 sm:pb-4 pt-0">
          <div className="text-base sm:text-2xl font-bold text-destructive leading-tight">{overdueCount}</div>
          <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 sm:mt-1">Payment missed</p>
        </CardContent>
      </Card>
    </div>
  );
}
