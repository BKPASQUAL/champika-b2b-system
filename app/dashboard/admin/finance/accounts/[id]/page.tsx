// app/dashboard/admin/finance/accounts/[id]/page.tsx
"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  Download,
  Landmark,
  Loader2,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// --- Types ---
interface AccountDetails {
  id: string;
  account_name: string;
  account_type: string;
  account_number: string;
  current_balance: number;
  bank_codes?: {
    bank_code: string;
    bank_name: string;
  };
}

interface Transaction {
  id: string;
  transaction_no: string;
  transaction_type: string;
  transaction_date: string;
  amount: number;
  description: string;
  from_account_id: string | null;
  to_account_id: string | null;
  from_account?: { account_name: string };
  to_account?: { account_name: string };
}

// --- Helpers ---
const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("en-LK", {
    style: "currency",
    currency: "LKR",
    minimumFractionDigits: 2,
  }).format(amount);
};

export default function AccountHistoryPage() {
  const params = useParams();
  const router = useRouter();
  const accountId = params.id as string;

  const [account, setAccount] = useState<AccountDetails | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [accRes, txRes] = await Promise.all([
        fetch(`/api/finance/accounts/${accountId}`),
        fetch(`/api/finance/accounts/${accountId}/transactions`),
      ]);

      if (accRes.ok) setAccount(await accRes.json());
      if (txRes.ok) setTransactions(await txRes.json());
    } catch (error) {
      toast.error("Failed to load account data");
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => {
    if (accountId) fetchData();
  }, [accountId, fetchData]);

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!account) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <h2 className="text-xl font-semibold">Account Not Found</h2>
        <Button onClick={() => router.back()}>Go Back</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {account.account_name}
          </h1>
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            {account.account_type === "Cash on Hand" ? (
              <Wallet className="h-3 w-3" />
            ) : (
              <Building2 className="h-3 w-3" />
            )}
            <span>
              {account.account_type}
              {account.account_number && ` • ${account.account_number}`}
            </span>
          </div>
        </div>
      </div>

      {/* Account Overview Card */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-1 bg-slate-50 border-slate-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">
              Current Balance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className={cn(
                "text-3xl font-bold",
                account.current_balance < 0 ? "text-red-600" : "text-slate-900"
              )}
            >
              {formatCurrency(account.current_balance)}
            </div>
            {account.bank_codes && (
              <p className="text-xs text-muted-foreground mt-1">
                {account.bank_codes.bank_name} ({account.bank_codes.bank_code})
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Transactions Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Transaction History</CardTitle>
          <Button variant="outline" size="sm">
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Reference / Type</TableHead>
                <TableHead className="text-right">Debit (Out)</TableHead>
                <TableHead className="text-right">Credit (In)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="text-center py-8 text-muted-foreground"
                  >
                    No transactions found for this account.
                  </TableCell>
                </TableRow>
              ) : (
                transactions.map((tx) => {
                  const isDebit = tx.from_account_id === accountId;
                  const isCredit = tx.to_account_id === accountId;

                  return (
                    <TableRow key={tx.id}>
                      <TableCell className="whitespace-nowrap">
                        {new Date(tx.transaction_date).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{tx.description}</div>
                        <div className="text-xs text-muted-foreground">
                          {tx.transaction_type === "Transfer" && (
                            <>
                              {isDebit
                                ? `To: ${
                                    tx.to_account?.account_name || "Unknown"
                                  }`
                                : `From: ${
                                    tx.from_account?.account_name || "Unknown"
                                  }`}
                            </>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className="text-xs font-normal"
                        >
                          {tx.transaction_type}
                        </Badge>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {tx.transaction_no}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {isDebit ? (
                          <span className="text-red-600">
                            {formatCurrency(tx.amount)}
                          </span>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {isCredit ? (
                          <span className="text-green-600">
                            {formatCurrency(tx.amount)}
                          </span>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
