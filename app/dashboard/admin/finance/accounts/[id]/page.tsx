// app/dashboard/admin/finance/accounts/[id]/page.tsx
"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  Download,
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
  reference_no: string | null;
  from_account_id: string | null;
  to_account_id: string | null;
  from_account?: { account_name: string };
  to_account?: { account_name: string };
  created_at: string;
  // Enriched fields
  customer_name: string | null;
  business_name: string | null;
  payment_method: string | null;
  cheque_no: string | null;
  cheque_date: string | null;
  cheque_status: string | null;
  cheque_bank_code: string | null;
  cheque_bank_name: string | null;
  invoice_no: string | null;
  notes: string | null;
}

// --- Helpers ---
const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("en-LK", {
    style: "currency",
    currency: "LKR",
    minimumFractionDigits: 2,
  }).format(amount);

const formatDate = (d: string | null | undefined) =>
  d
    ? new Date(d).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "—";

const CHEQUE_STATUS_STYLES: Record<string, string> = {
  Pending:   "bg-amber-50  text-amber-700  border-amber-200",
  Deposited: "bg-blue-50   text-blue-700   border-blue-200",
  Cleared:   "bg-green-50  text-green-700  border-green-200",
  Bounced:   "bg-red-50    text-red-700    border-red-200",
  Returned:  "bg-gray-100  text-gray-600   border-gray-300",
};

const METHOD_LABEL: Record<string, string> = {
  cash: "Cash",
  bank: "Bank Transfer",
  cheque: "Cheque",
  credit: "Credit",
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
    } catch {
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
      <div className="flex justify-center items-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
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

  // Calculate running balance (oldest → newest, then reverse for display)
  const sorted = [...transactions].sort(
    (a, b) =>
      new Date(a.transaction_date).getTime() - new Date(b.transaction_date).getTime() ||
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  let running = account.current_balance;
  const withBalance: (Transaction & { balance: number })[] = [];
  for (let i = sorted.length - 1; i >= 0; i--) {
    const tx = sorted[i];
    const isDebit = tx.from_account_id === accountId;
    withBalance.unshift({ ...tx, balance: running });
    running = isDebit ? running + tx.amount : running - tx.amount;
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
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead className="whitespace-nowrap">Date</TableHead>
                  <TableHead>Type / Reference</TableHead>
                  <TableHead>Customer / Supplier</TableHead>
                  <TableHead>Business</TableHead>
                  <TableHead>Cheque Details</TableHead>
                  <TableHead className="text-right">Debit (Out)</TableHead>
                  <TableHead className="text-right">Credit (In)</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {withBalance.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="text-center py-8 text-muted-foreground"
                    >
                      No transactions found for this account.
                    </TableCell>
                  </TableRow>
                ) : (
                  withBalance.map((tx) => {
                    const isDebit = tx.from_account_id === accountId;
                    const isCredit = tx.to_account_id === accountId;
                    const isCheque = tx.payment_method === "cheque" || tx.transaction_type === "Cheque Cleared";
                    const chequeStatusStyle = tx.cheque_status
                      ? CHEQUE_STATUS_STYLES[tx.cheque_status] ?? CHEQUE_STATUS_STYLES.Pending
                      : null;

                    return (
                      <TableRow key={tx.id} className="align-top">
                        {/* Date */}
                        <TableCell className="whitespace-nowrap text-sm">
                          {formatDate(tx.transaction_date)}
                        </TableCell>

                        {/* Type / Reference */}
                        <TableCell>
                          <Badge variant="outline" className="text-xs font-normal whitespace-nowrap">
                            {tx.transaction_type}
                          </Badge>
                          {tx.invoice_no && (
                            <p className="text-xs text-muted-foreground mt-0.5 font-mono">
                              {tx.invoice_no}
                            </p>
                          )}
                          {tx.payment_method && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {METHOD_LABEL[tx.payment_method] ?? tx.payment_method}
                            </p>
                          )}
                          {!tx.invoice_no && tx.description && (
                            <p className="text-xs text-muted-foreground mt-0.5 max-w-[180px] truncate">
                              {tx.description}
                            </p>
                          )}
                          {tx.notes && (
                            <p className="text-xs text-blue-600 mt-0.5 max-w-[180px] truncate" title={tx.notes}>
                              {tx.notes}
                            </p>
                          )}
                        </TableCell>

                        {/* Customer / Supplier */}
                        <TableCell>
                          {tx.customer_name ? (
                            <span className="text-sm font-medium text-gray-800">
                              {tx.customer_name}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                          {tx.transaction_type === "Transfer" && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {isDebit
                                ? `→ ${tx.to_account?.account_name ?? "Unknown"}`
                                : `← ${tx.from_account?.account_name ?? "Unknown"}`}
                            </p>
                          )}
                        </TableCell>

                        {/* Business */}
                        <TableCell>
                          {tx.business_name ? (
                            <span className="text-sm text-gray-700">{tx.business_name}</span>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>

                        {/* Cheque Details */}
                        <TableCell>
                          {isCheque && tx.cheque_no ? (
                            <div className="space-y-0.5">
                              <p className="font-mono text-xs font-semibold text-gray-800">
                                #{tx.cheque_no}
                              </p>
                              {tx.cheque_date && (
                                <p className="text-xs text-muted-foreground">
                                  {formatDate(tx.cheque_date)}
                                </p>
                              )}
                              {(tx.cheque_bank_code || tx.cheque_bank_name) && (
                                <p className="text-xs text-muted-foreground">
                                  {tx.cheque_bank_code}
                                  {tx.cheque_bank_name ? ` – ${tx.cheque_bank_name}` : ""}
                                </p>
                              )}
                              {tx.cheque_status && chequeStatusStyle && (
                                <span
                                  className={cn(
                                    "inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border",
                                    chequeStatusStyle
                                  )}
                                >
                                  {tx.cheque_status}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>

                        {/* Debit (Out) */}
                        <TableCell className="text-right font-medium whitespace-nowrap">
                          {isDebit ? (
                            <span className="text-red-600">{formatCurrency(tx.amount)}</span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>

                        {/* Credit (In) */}
                        <TableCell className="text-right font-medium whitespace-nowrap">
                          {isCredit ? (
                            <span className="text-green-600">{formatCurrency(tx.amount)}</span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>

                        {/* Running Balance */}
                        <TableCell className="text-right whitespace-nowrap">
                          <span
                            className={cn(
                              "font-semibold text-sm",
                              tx.balance < 0 ? "text-red-600" : "text-gray-900"
                            )}
                          >
                            {formatCurrency(tx.balance)}
                          </span>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
