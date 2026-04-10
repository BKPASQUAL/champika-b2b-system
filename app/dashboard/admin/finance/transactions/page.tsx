// app/dashboard/admin/finance/transactions/page.tsx
"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Search,
  ArrowRightLeft,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Wallet,
  Banknote,
  ArrowDownToLine,
  ArrowUpFromLine,
  RefreshCw,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// --- Types ---
interface AccountRef {
  id: string;
  account_name: string;
  account_type: string;
}

interface Transaction {
  id: string;
  transaction_no: string;
  transaction_type: string;
  from_account: AccountRef | null;
  to_account: AccountRef | null;
  amount: number;
  reference_no: string | null;
  description: string | null;
  transaction_date: string;
  cheque_status: string | null;
  created_at: string;
}

interface BankAccount {
  id: string;
  account_name: string;
  account_type: string;
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("en-LK", {
    style: "currency",
    currency: "LKR",
    minimumFractionDigits: 2,
  }).format(amount);

const TRANSACTION_TYPES = [
  "Deposit",
  "Withdrawal",
  "Transfer",
  "Opening Balance",
  "Cheque",
];

const TYPE_CONFIG: Record<
  string,
  { color: string; bg: string; icon: React.ElementType }
> = {
  Deposit: { color: "text-green-700", bg: "bg-green-50", icon: ArrowDownToLine },
  Withdrawal: { color: "text-red-700", bg: "bg-red-50", icon: ArrowUpFromLine },
  Transfer: { color: "text-blue-700", bg: "bg-blue-50", icon: ArrowRightLeft },
  "Opening Balance": {
    color: "text-purple-700",
    bg: "bg-purple-50",
    icon: TrendingUp,
  },
  Cheque: { color: "text-orange-700", bg: "bg-orange-50", icon: Banknote },
  "Cheque Return": { color: "text-red-700", bg: "bg-red-50", icon: RefreshCw },
};

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [accountFilter, setAccountFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (typeFilter !== "all") params.set("type", typeFilter);
      if (accountFilter !== "all") params.set("accountId", accountFilter);

      const [txRes, accRes] = await Promise.all([
        fetch(`/api/finance/transactions?${params.toString()}`),
        fetch("/api/finance/accounts"),
      ]);

      if (txRes.ok) setTransactions(await txRes.json());
      if (accRes.ok) setAccounts(await accRes.json());
    } catch {
      toast.error("Failed to load transactions");
    } finally {
      setLoading(false);
    }
  }, [typeFilter, accountFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, typeFilter, accountFilter]);

  const filtered = transactions.filter((tx) => {
    const term = searchTerm.toLowerCase();
    return (
      tx.transaction_no.toLowerCase().includes(term) ||
      tx.description?.toLowerCase().includes(term) ||
      tx.reference_no?.toLowerCase().includes(term) ||
      tx.from_account?.account_name.toLowerCase().includes(term) ||
      tx.to_account?.account_name.toLowerCase().includes(term)
    );
  });

  const totalItems = filtered.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginated = filtered.slice(startIndex, startIndex + itemsPerPage);

  // Stats
  const totalDeposits = transactions
    .filter((t) => t.transaction_type === "Deposit")
    .reduce((s, t) => s + t.amount, 0);
  const totalWithdrawals = transactions
    .filter((t) => t.transaction_type === "Withdrawal")
    .reduce((s, t) => s + t.amount, 0);
  const totalTransfers = transactions
    .filter((t) => t.transaction_type === "Transfer")
    .reduce((s, t) => s + t.amount, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Account Transactions
          </h1>
          <p className="text-muted-foreground">
            View all financial movements across all accounts
          </p>
        </div>
        <Button variant="outline" onClick={fetchData}>
          <RefreshCw className="mr-2 h-4 w-4" /> Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-green-200 bg-green-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-green-700 flex items-center gap-2">
              <ArrowDownToLine className="h-4 w-4" /> Total Deposits
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-green-800">
              {formatCurrency(totalDeposits)}
            </div>
          </CardContent>
        </Card>
        <Card className="border-red-200 bg-red-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-red-700 flex items-center gap-2">
              <ArrowUpFromLine className="h-4 w-4" /> Total Withdrawals
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-red-800">
              {formatCurrency(totalWithdrawals)}
            </div>
          </CardContent>
        </Card>
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-blue-700 flex items-center gap-2">
              <ArrowRightLeft className="h-4 w-4" /> Total Transfers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-blue-800">
              {formatCurrency(totalTransfers)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <CardTitle>Transaction Ledger</CardTitle>
            <div className="flex items-center gap-3 flex-wrap">
              {/* Search */}
              <div className="relative w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search transactions..."
                  className="pl-8"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              {/* Account Filter */}
              <Select value={accountFilter} onValueChange={setAccountFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="All Accounts" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Accounts</SelectItem>
                  {accounts.map((acc) => (
                    <SelectItem key={acc.id} value={acc.id}>
                      {acc.account_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {/* Type Filter */}
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {TRANSACTION_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Transaction #</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>From Account</TableHead>
                <TableHead>To Account</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-16">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                  </TableCell>
                </TableRow>
              ) : paginated.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="h-24 text-center text-muted-foreground"
                  >
                    No transactions found.
                  </TableCell>
                </TableRow>
              ) : (
                paginated.map((tx) => {
                  const cfg = TYPE_CONFIG[tx.transaction_type] || {
                    color: "text-gray-700",
                    bg: "bg-gray-50",
                    icon: Wallet,
                  };
                  const Icon = cfg.icon;

                  return (
                    <TableRow key={tx.id}>
                      <TableCell className="text-sm">
                        {new Date(tx.transaction_date).toLocaleDateString(
                          "en-LK"
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs font-medium">
                        {tx.transaction_no}
                      </TableCell>
                      <TableCell>
                        <span
                          className={cn(
                            "inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full",
                            cfg.color,
                            cfg.bg
                          )}
                        >
                          <Icon className="h-3 w-3" />
                          {tx.transaction_type}
                        </span>
                      </TableCell>
                      <TableCell>
                        {tx.from_account ? (
                          <div>
                            <div className="text-sm font-medium">
                              {tx.from_account.account_name}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {tx.from_account.account_type}
                            </div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {tx.to_account ? (
                          <div>
                            <div className="text-sm font-medium">
                              {tx.to_account.account_name}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {tx.to_account.account_type}
                            </div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs font-mono">
                        {tx.reference_no || "—"}
                      </TableCell>
                      <TableCell className="text-sm max-w-[200px] truncate">
                        {tx.description || "—"}
                      </TableCell>
                      <TableCell className="text-right font-bold text-sm">
                        {formatCurrency(tx.amount)}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>

        <CardFooter className="flex items-center justify-between py-4">
          <div className="text-sm text-muted-foreground">
            Showing {Math.min(startIndex + 1, totalItems)} to{" "}
            {Math.min(startIndex + itemsPerPage, totalItems)} of {totalItems}{" "}
            transactions
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" /> Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setCurrentPage((p) => Math.min(totalPages, p + 1))
              }
              disabled={currentPage === totalPages || totalPages === 0}
            >
              Next <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
