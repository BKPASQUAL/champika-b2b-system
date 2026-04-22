// app/dashboard/office/sierra/payments/_components/PaymentStats.tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Banknote, CreditCard, AlertCircle, TrendingDown } from "lucide-react";
import { Payment } from "../types";

interface PaymentStatsProps {
  payments: Payment[];
  totalDue: number;
}

export function PaymentStats({ payments, totalDue }: PaymentStatsProps) {
  // 1. Monthly Collected — current month only
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const monthlyPayments = payments.filter((p) => {
    const d = new Date(p.date);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  });
  const monthlyCollected = monthlyPayments.reduce((sum, p) => sum + p.amount, 0);
  const monthName = now.toLocaleString("default", { month: "long" });

  // 2. Cash Receipts — all time
  const cashTotal = payments
    .filter((p) => p.method?.toLowerCase() === "cash")
    .reduce((sum, p) => sum + p.amount, 0);

  // 3. Pending Cheques
  const pendingCheques = payments.filter(
    (p) => p.method?.toLowerCase() === "cheque" && p.chequeStatus === "Pending"
  );
  const pendingChequeAmount = pendingCheques.reduce(
    (sum, p) => sum + p.amount,
    0
  );

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {/* Monthly Collected */}
      <Card className="border-l-4 border-l-green-500 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Collected — {monthName}
          </CardTitle>
          <Banknote className="w-4 h-4 text-green-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-700">
            LKR {monthlyCollected.toLocaleString()}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {monthlyPayments.length} payments this month
          </p>
        </CardContent>
      </Card>

      {/* Total Due */}
      <Card className="border-l-4 border-l-red-500 shadow-sm bg-red-50/10">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-red-800">
            Total Due
          </CardTitle>
          <TrendingDown className="w-4 h-4 text-red-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-red-700">
            LKR {totalDue.toLocaleString()}
          </div>
          <p className="text-xs text-red-600/80 mt-1">
            Outstanding customer balance
          </p>
        </CardContent>
      </Card>

      {/* Pending Cheques */}
      <Card className="border-l-4 border-l-amber-500 shadow-sm bg-amber-50/20">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-amber-800">
            Pending Cheques
          </CardTitle>
          <AlertCircle className="w-4 h-4 text-amber-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-amber-700">
            LKR {pendingChequeAmount.toLocaleString()}
          </div>
          <p className="text-xs text-amber-600/80 mt-1">
            {pendingCheques.length} cheques awaiting clearance
          </p>
        </CardContent>
      </Card>

      {/* Cash Receipts */}
      <Card className="shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Cash Receipts
          </CardTitle>
          <CreditCard className="w-4 h-4 text-purple-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-gray-800">
            LKR {cashTotal.toLocaleString()}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Liquid cash collected
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
