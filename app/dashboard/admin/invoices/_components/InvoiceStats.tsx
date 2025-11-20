// app/dashboard/admin/invoices/_components/InvoiceStats.tsx
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

  // 5. Calculate Pending Count (Unpaid + Partial) [New]
  const pendingCount = invoices.filter(
    (inv) => inv.status === "Unpaid" || inv.status === "Partial"
  ).length;

  // 6. Calculate Overdue Count [New]
  const overdueCount = invoices.filter(
    (inv) => inv.status === "Overdue"
  ).length;

  return (
    // Adjusted grid to fit 6 cards: 2 cols on medium, 3 on large, 6 on extra large screens
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {/* Card 1: Total Revenue */}
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

      {/* Card 2: Revenue (30 Days) */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">
            Revenue (30 Days)
          </CardTitle>
          <CalendarClock className="w-4 h-4 text-blue-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-blue-600">
            LKR {(last30DaysRevenue / 100000).toFixed(2)}L
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Sales in last month
          </p>
        </CardContent>
      </Card>

      {/* Card 3: Due Amount */}
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

      {/* Card 4: Paid Invoices */}
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

      {/* Card 5: Pending Bills (New) */}
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

      {/* Card 6: Overdue Bills (New) */}
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
