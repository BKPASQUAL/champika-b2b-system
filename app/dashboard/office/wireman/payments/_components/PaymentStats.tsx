// app/dashboard/office/wireman/payments/_components/PaymentStats.tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Banknote, CreditCard, AlertCircle, CheckCircle2 } from "lucide-react";
import { Payment } from "../types";

interface PaymentStatsProps {
  payments: Payment[];
}

export function PaymentStats({ payments }: PaymentStatsProps) {
  // 1. Total Collections
  const totalCollected = payments.reduce((sum, p) => sum + p.amount, 0);

  // 2. Cash vs Cheque
  const cashTotal = payments
    .filter((p) => p.method === "Cash")
    .reduce((sum, p) => sum + p.amount, 0);

  const chequeTotal = payments
    .filter((p) => p.method === "Cheque")
    .reduce((sum, p) => sum + p.amount, 0);

  // 3. Pending Cheques
  const pendingCheques = payments.filter(
    (p) => p.method === "Cheque" && p.chequeStatus === "Pending"
  );
  const pendingChequeAmount = pendingCheques.reduce(
    (sum, p) => sum + p.amount,
    0
  );

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {/* Total Collected */}
      <Card className="border-l-4 border-l-green-500 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Total Collected
          </CardTitle>
          <Banknote className="w-4 h-4 text-green-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-gray-800">
            LKR {(totalCollected / 1000).toFixed(1)}k
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            All time receipts
          </p>
        </CardContent>
      </Card>

      {/* Cash In Hand */}
      <Card className="shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Cash Receipts
          </CardTitle>
          <div className="text-green-600 font-bold text-xs">CASH</div>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-gray-800">
            LKR {(cashTotal / 1000).toFixed(1)}k
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Liquid cash collected
          </p>
        </CardContent>
      </Card>

      {/* Cheques Total */}
      <Card className="shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Cheque Receipts
          </CardTitle>
          <CreditCard className="w-4 h-4 text-blue-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-gray-800">
            LKR {(chequeTotal / 1000).toFixed(1)}k
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Total cheque value
          </p>
        </CardContent>
      </Card>

      {/* Pending Cheques (Alert) */}
      <Card className="border-l-4 border-l-amber-500 shadow-sm bg-amber-50/20">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-amber-800">
            Pending Cheques
          </CardTitle>
          <AlertCircle className="w-4 h-4 text-amber-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-amber-700">
            LKR {(pendingChequeAmount / 1000).toFixed(1)}k
          </div>
          <p className="text-xs text-amber-600/80 mt-1">
            {pendingCheques.length} cheques to clear
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
