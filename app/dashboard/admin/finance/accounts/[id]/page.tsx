// app/dashboard/admin/finance/accounts/[id]/page.tsx
"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowDownLeft,
  ArrowUpRight,
  Building2,
  ChevronLeft,
  ChevronRight,
  Download,
  Loader2,
  Search,
  Wallet,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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

// ─── Types ────────────────────────────────────────────────────────────────────

interface AccountDetails {
  id: string;
  account_name: string;
  account_type: string;
  account_number: string;
  current_balance: number;
  bank_codes?: { bank_code: string; bank_name: string };
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

type TxWithBalance = Transaction & { balance: number };

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 20;

const CHEQUE_STATUS_STYLES: Record<string, string> = {
  pending:   "bg-amber-50 text-amber-700 border-amber-200",
  passed:    "bg-green-50 text-green-700 border-green-200",
  returned:  "bg-red-50   text-red-700   border-red-200",
  Pending:   "bg-amber-50 text-amber-700 border-amber-200",
  Deposited: "bg-blue-50  text-blue-700  border-blue-200",
  Cleared:   "bg-green-50 text-green-700 border-green-200",
  Bounced:   "bg-red-50   text-red-700   border-red-200",
  Returned:  "bg-gray-100 text-gray-600  border-gray-300",
};

const TX_TYPE_STYLES: Record<string, string> = {
  Deposit:        "bg-green-50 text-green-700 border-green-200",
  Withdrawal:     "bg-red-50   text-red-700   border-red-200",
  Transfer:       "bg-blue-50  text-blue-700  border-blue-200",
  "Opening Balance": "bg-slate-50 text-slate-600 border-slate-200",
};

const METHOD_LABEL: Record<string, string> = {
  cash: "Cash", bank: "Bank Transfer", cheque: "Cheque", credit: "Credit",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  new Intl.NumberFormat("en-LK", { style: "currency", currency: "LKR", minimumFractionDigits: 2 }).format(n);

const fmtDate = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";

// ─── Component ────────────────────────────────────────────────────────────────

export default function AccountHistoryPage() {
  const params   = useParams();
  const router   = useRouter();
  const accountId = params.id as string;

  const [account,      setAccount]      = useState<AccountDetails | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [search,       setSearch]       = useState("");
  const [page,         setPage]         = useState(1);

  const fetchData = useCallback(async () => {
    try {
      const [accRes, txRes] = await Promise.all([
        fetch(`/api/finance/accounts/${accountId}`),
        fetch(`/api/finance/accounts/${accountId}/transactions`),
      ]);
      if (accRes.ok) setAccount(await accRes.json());
      if (txRes.ok)  setTransactions(await txRes.json());
    } catch {
      toast.error("Failed to load account data");
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => { if (accountId) fetchData(); }, [accountId, fetchData]);

  // ── Running balance (oldest → newest, display newest first) ───────────────
  const withBalance = useMemo<TxWithBalance[]>(() => {
    const sorted = [...transactions].sort(
      (a, b) =>
        new Date(a.transaction_date).getTime() - new Date(b.transaction_date).getTime() ||
        new Date(a.created_at).getTime()       - new Date(b.created_at).getTime()
    );
    let running = account?.current_balance ?? 0;
    const result: TxWithBalance[] = [];
    for (let i = sorted.length - 1; i >= 0; i--) {
      const tx = sorted[i];
      result.unshift({ ...tx, balance: running });
      running = tx.from_account_id === accountId ? running + tx.amount : running - tx.amount;
    }
    return result;
  }, [transactions, account, accountId]);

  // ── Summary stats ─────────────────────────────────────────────────────────
  const totalIn  = withBalance.filter(t => t.to_account_id   === accountId).reduce((s, t) => s + t.amount, 0);
  const totalOut = withBalance.filter(t => t.from_account_id === accountId).reduce((s, t) => s + t.amount, 0);

  // ── Search filter ─────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return withBalance;
    return withBalance.filter(tx =>
      [tx.description, tx.customer_name, tx.business_name, tx.cheque_no,
       tx.invoice_no, tx.reference_no, tx.notes, tx.transaction_type,
       tx.transaction_no, tx.payment_method]
        .some(f => f?.toLowerCase().includes(q))
    );
  }, [withBalance, search]);

  // ── Pagination ────────────────────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage   = Math.min(page, totalPages);
  const paginated  = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const handleSearch = (v: string) => { setSearch(v); setPage(1); };

  // ── Loading / not found ───────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex justify-center items-center py-24">
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

  return (
    <div className="space-y-6 pb-10">

      {/* ── Header ── */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{account.account_name}</h1>
          <div className="flex items-center gap-1.5 text-muted-foreground text-sm mt-0.5">
            {account.account_type === "Cash on Hand"
              ? <Wallet className="h-3 w-3" />
              : <Building2 className="h-3 w-3" />}
            <span>{account.account_type}</span>
            {account.account_number && <><span>•</span><span className="font-mono">{account.account_number}</span></>}
            {account.bank_codes && <><span>•</span><span>{account.bank_codes.bank_name} ({account.bank_codes.bank_code})</span></>}
          </div>
        </div>
      </div>

      {/* ── Summary Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-slate-200 bg-slate-50">
          <CardContent className="pt-5 pb-4">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Current Balance</p>
            <p className={cn("text-2xl font-bold mt-1", account.current_balance < 0 ? "text-red-600" : "text-slate-900")}>
              {fmt(account.current_balance)}
            </p>
          </CardContent>
        </Card>
        <Card className="border-green-100 bg-green-50">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-1.5">
              <ArrowDownLeft className="h-3.5 w-3.5 text-green-600" />
              <p className="text-xs font-medium text-green-700 uppercase tracking-wide">Total In</p>
            </div>
            <p className="text-2xl font-bold mt-1 text-green-700">{fmt(totalIn)}</p>
            <p className="text-xs text-green-600 mt-0.5">{withBalance.filter(t => t.to_account_id === accountId).length} transactions</p>
          </CardContent>
        </Card>
        <Card className="border-red-100 bg-red-50">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-1.5">
              <ArrowUpRight className="h-3.5 w-3.5 text-red-600" />
              <p className="text-xs font-medium text-red-700 uppercase tracking-wide">Total Out</p>
            </div>
            <p className="text-2xl font-bold mt-1 text-red-700">{fmt(totalOut)}</p>
            <p className="text-xs text-red-600 mt-0.5">{withBalance.filter(t => t.from_account_id === accountId).length} transactions</p>
          </CardContent>
        </Card>
      </div>

      {/* ── Transaction Table ── */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3 border-b">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base">Transaction History</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                {filtered.length} of {withBalance.length} transactions
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search transactions…"
                  value={search}
                  onChange={e => handleSearch(e.target.value)}
                  className="pl-8 h-8 text-sm w-56"
                />
              </div>
              <Button variant="outline" size="sm" className="h-8 text-xs">
                <Download className="h-3.5 w-3.5 mr-1" />
                Export
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50/80 hover:bg-gray-50/80">
                  <TableHead className="whitespace-nowrap pl-4 w-[110px]">Date</TableHead>
                  <TableHead className="w-[160px]">Type</TableHead>
                  <TableHead>Description / Notes</TableHead>
                  <TableHead className="hidden md:table-cell">Party</TableHead>
                  <TableHead className="hidden lg:table-cell">Cheque</TableHead>
                  <TableHead className="text-right whitespace-nowrap text-red-600">Out</TableHead>
                  <TableHead className="text-right whitespace-nowrap text-green-600">In</TableHead>
                  <TableHead className="text-right whitespace-nowrap pr-4">Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-16 text-muted-foreground">
                      <FileText className="h-8 w-8 mx-auto mb-2 opacity-30" />
                      {search ? "No transactions match your search." : "No transactions found."}
                    </TableCell>
                  </TableRow>
                ) : (
                  paginated.map((tx) => {
                    const isDebit  = tx.from_account_id === accountId;
                    const isCredit = tx.to_account_id   === accountId;
                    const isCheque = tx.payment_method === "cheque" || tx.transaction_type.toLowerCase().includes("cheque");
                    const txStyle  = TX_TYPE_STYLES[tx.transaction_type] ?? "bg-gray-50 text-gray-600 border-gray-200";
                    const chkStyle = tx.cheque_status ? (CHEQUE_STATUS_STYLES[tx.cheque_status] ?? CHEQUE_STATUS_STYLES.Pending) : null;

                    return (
                      <TableRow key={tx.id} className="hover:bg-slate-50/60 align-top">

                        {/* Date */}
                        <TableCell className="pl-4 py-3 whitespace-nowrap">
                          <span className="text-sm font-medium text-gray-700">{fmtDate(tx.transaction_date)}</span>
                          <p className="text-[10px] text-muted-foreground font-mono mt-0.5">{tx.transaction_no}</p>
                        </TableCell>

                        {/* Type */}
                        <TableCell className="py-3">
                          <span className={cn("inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium border", txStyle)}>
                            {tx.transaction_type}
                          </span>
                          {tx.payment_method && (
                            <p className="text-[11px] text-muted-foreground mt-1">
                              {METHOD_LABEL[tx.payment_method] ?? tx.payment_method}
                            </p>
                          )}
                        </TableCell>

                        {/* Description / Notes */}
                        <TableCell className="py-3 max-w-[220px]">
                          {tx.invoice_no && (
                            <p className="text-xs font-mono font-semibold text-gray-800">{tx.invoice_no}</p>
                          )}
                          {tx.description && (
                            <p className="text-xs text-gray-600 truncate" title={tx.description}>{tx.description}</p>
                          )}
                          {tx.notes && (
                            <p className="text-[11px] text-blue-600 mt-0.5 truncate" title={tx.notes}>
                              {tx.notes}
                            </p>
                          )}
                          {/* Mobile-only party */}
                          {tx.customer_name && (
                            <p className="text-xs font-medium text-gray-700 mt-0.5 md:hidden">{tx.customer_name}</p>
                          )}
                          {/* Mobile-only cheque */}
                          {isCheque && tx.cheque_no && (
                            <p className="text-xs font-mono text-gray-600 mt-0.5 lg:hidden">#{tx.cheque_no}</p>
                          )}
                        </TableCell>

                        {/* Party — hidden on small screens */}
                        <TableCell className="py-3 hidden md:table-cell">
                          {tx.customer_name ? (
                            <span className="text-sm font-medium text-gray-800">{tx.customer_name}</span>
                          ) : tx.transaction_type === "Transfer" ? (
                            <span className="text-xs text-muted-foreground">
                              {isDebit
                                ? `→ ${tx.to_account?.account_name ?? "—"}`
                                : `← ${tx.from_account?.account_name ?? "—"}`}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                          {tx.business_name && (
                            <p className="text-[11px] text-muted-foreground mt-0.5">{tx.business_name}</p>
                          )}
                        </TableCell>

                        {/* Cheque — hidden on medium screens */}
                        <TableCell className="py-3 hidden lg:table-cell">
                          {isCheque && tx.cheque_no ? (
                            <div className="space-y-0.5">
                              <p className="font-mono text-xs font-semibold text-gray-800">#{tx.cheque_no}</p>
                              {tx.cheque_date && (
                                <p className="text-[11px] text-muted-foreground">{fmtDate(tx.cheque_date)}</p>
                              )}
                              {(tx.cheque_bank_code || tx.cheque_bank_name) && (
                                <p className="text-[11px] text-muted-foreground">
                                  {[tx.cheque_bank_code, tx.cheque_bank_name].filter(Boolean).join(" – ")}
                                </p>
                              )}
                              {tx.cheque_status && chkStyle && (
                                <span className={cn("inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium border", chkStyle)}>
                                  {tx.cheque_status}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>

                        {/* Out */}
                        <TableCell className="py-3 text-right whitespace-nowrap">
                          {isDebit ? (
                            <span className="text-sm font-semibold text-red-600">{fmt(tx.amount)}</span>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>

                        {/* In */}
                        <TableCell className="py-3 text-right whitespace-nowrap">
                          {isCredit ? (
                            <span className="text-sm font-semibold text-green-600">{fmt(tx.amount)}</span>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>

                        {/* Running Balance */}
                        <TableCell className="py-3 pr-4 text-right whitespace-nowrap">
                          <span className={cn("text-sm font-bold", tx.balance < 0 ? "text-red-600" : "text-gray-900")}>
                            {fmt(tx.balance)}
                          </span>
                        </TableCell>

                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {/* ── Pagination ── */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t bg-gray-50/50">
              <p className="text-xs text-muted-foreground">
                Showing {((safePage - 1) * PAGE_SIZE) + 1}–{Math.min(safePage * PAGE_SIZE, filtered.length)} of {filtered.length}
              </p>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline" size="icon"
                  className="h-7 w-7"
                  disabled={safePage === 1}
                  onClick={() => setPage(p => p - 1)}
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(p => p === 1 || p === totalPages || Math.abs(p - safePage) <= 1)
                  .reduce<(number | "…")[]>((acc, p, i, arr) => {
                    if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push("…");
                    acc.push(p);
                    return acc;
                  }, [])
                  .map((p, i) =>
                    p === "…" ? (
                      <span key={`ellipsis-${i}`} className="px-1 text-xs text-muted-foreground">…</span>
                    ) : (
                      <Button
                        key={p}
                        variant={safePage === p ? "default" : "outline"}
                        size="icon"
                        className="h-7 w-7 text-xs"
                        onClick={() => setPage(p as number)}
                      >
                        {p}
                      </Button>
                    )
                  )}
                <Button
                  variant="outline" size="icon"
                  className="h-7 w-7"
                  disabled={safePage === totalPages}
                  onClick={() => setPage(p => p + 1)}
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
