"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  RefreshCw,
  Search,
  ShoppingCart,
  Package,
  Undo2,
  TrendingUp,
  TrendingDown,
  ReceiptText,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { toast } from "sonner";
import { BUSINESS_IDS } from "@/app/config/business-constants";

type TxnType = "Sale" | "Purchase" | "Return";

interface UnifiedTxn {
  id: string;
  date: string;
  type: TxnType;
  ref: string;
  party: string;
  amount: number;
  paidAmount: number;
  balance: number;
  status: string;
}

const fmt = (n: number) =>
  new Intl.NumberFormat("en-LK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n || 0);

const fmtDate = (d: string) => {
  if (!d) return "-";
  try {
    return new Date(d).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return d;
  }
};

const TYPE_CONFIG: Record<TxnType, { label: string; color: string; bg: string }> = {
  Sale:     { label: "Sale",     color: "text-green-700",  bg: "bg-green-50 border-green-200" },
  Purchase: { label: "Purchase", color: "text-blue-700",   bg: "bg-blue-50 border-blue-200" },
  Return:   { label: "Return",   color: "text-orange-700", bg: "bg-orange-50 border-orange-200" },
};

const STATUS_COLORS: Record<string, string> = {
  Paid:     "bg-green-100 text-green-800",
  Unpaid:   "bg-red-100 text-red-800",
  Partial:  "bg-yellow-100 text-yellow-800",
  Overdue:  "bg-red-100 text-red-800",
  Ordered:  "bg-blue-100 text-blue-800",
  Received: "bg-green-100 text-green-800",
  Cancelled:"bg-gray-100 text-gray-600",
  Good:     "bg-green-100 text-green-800",
  Damage:   "bg-red-100 text-red-800",
};

const ITEMS_PER_PAGE = 20;

export default function SierraTransactionsPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<UnifiedTxn[]>([]);
  const [typeFilter, setTypeFilter] = useState<"All" | TxnType>("All");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [invRes, purRes, retRes] = await Promise.all([
        fetch(`/api/invoices?businessId=${BUSINESS_IDS.SIERRA_AGENCY}`),
        fetch(`/api/purchases?businessId=${BUSINESS_IDS.SIERRA_AGENCY}`),
        fetch(`/api/inventory/returns?businessId=${BUSINESS_IDS.SIERRA_AGENCY}&limit=10000`),
      ]);

      const invoices  = invRes.ok  ? await invRes.json()  : [];
      const purchases = purRes.ok  ? await purRes.json()  : [];
      const retPayload = retRes.ok ? await retRes.json()  : { data: [] };
      const returns   = Array.isArray(retPayload) ? retPayload : (retPayload.data ?? []);

      const merged: UnifiedTxn[] = [
        ...(Array.isArray(invoices) ? invoices : []).map((inv: any) => ({
          id:         inv.id,
          date:       inv.date || inv.createdAt?.split("T")[0] || "",
          type:       "Sale" as TxnType,
          ref:        inv.invoiceNo || "-",
          party:      inv.customerName || "-",
          amount:     inv.totalAmount  || 0,
          paidAmount: inv.paidAmount   || 0,
          balance:    (inv.totalAmount || 0) - (inv.paidAmount || 0),
          status:     inv.status       || "-",
        })),
        ...(Array.isArray(purchases) ? purchases : []).map((pur: any) => ({
          id:         pur.id,
          date:       pur.purchaseDate || "",
          type:       "Purchase" as TxnType,
          ref:        pur.purchaseId || pur.invoiceNo || "-",
          party:      pur.supplierName || "-",
          amount:     pur.totalAmount  || 0,
          paidAmount: pur.paidAmount   || 0,
          balance:    (pur.totalAmount || 0) - (pur.paidAmount || 0),
          status:     pur.paymentStatus || "-",
        })),
        ...(Array.isArray(returns) ? returns : []).map((ret: any) => {
          const val = (ret.quantity || 0) * (ret.products?.selling_price || 0);
          return {
            id:         ret.id,
            date:       ret.created_at?.split("T")[0] || "",
            type:       "Return" as TxnType,
            ref:        ret.return_number || "-",
            party:      ret.profiles?.full_name || "-",
            amount:     val,
            paidAmount: val,
            balance:    0,
            status:     ret.return_type || "-",
          };
        }),
      ].sort((a, b) => {
        const da = a.date ? new Date(a.date).getTime() : 0;
        const db = b.date ? new Date(b.date).getTime() : 0;
        return db - da;
      });

      setTransactions(merged);
    } catch {
      toast.error("Failed to load transactions");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  // Summary totals (unfiltered)
  const salesTotal     = useMemo(() => transactions.filter(t => t.type === "Sale").reduce((s, t) => s + t.amount, 0), [transactions]);
  const purchasesTotal = useMemo(() => transactions.filter(t => t.type === "Purchase").reduce((s, t) => s + t.amount, 0), [transactions]);
  const returnsTotal   = useMemo(() => transactions.filter(t => t.type === "Return").reduce((s, t) => s + t.amount, 0), [transactions]);
  const salesCount     = useMemo(() => transactions.filter(t => t.type === "Sale").length, [transactions]);
  const purchasesCount = useMemo(() => transactions.filter(t => t.type === "Purchase").length, [transactions]);
  const returnsCount   = useMemo(() => transactions.filter(t => t.type === "Return").length, [transactions]);

  // Filtered list
  const filtered = useMemo(() => {
    return transactions.filter(t => {
      if (typeFilter !== "All" && t.type !== typeFilter) return false;
      if (search) {
        const s = search.toLowerCase();
        if (
          !t.ref.toLowerCase().includes(s) &&
          !t.party.toLowerCase().includes(s)
        ) return false;
      }
      if (dateFrom && t.date && t.date < dateFrom) return false;
      if (dateTo   && t.date && t.date > dateTo)   return false;
      return true;
    });
  }, [transactions, typeFilter, search, dateFrom, dateTo]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const paginated  = filtered.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const filteredSalesTotal     = useMemo(() => filtered.filter(t => t.type === "Sale").reduce((s, t) => s + t.amount, 0), [filtered]);
  const filteredPurchasesTotal = useMemo(() => filtered.filter(t => t.type === "Purchase").reduce((s, t) => s + t.amount, 0), [filtered]);
  const filteredReturnsTotal   = useMemo(() => filtered.filter(t => t.type === "Return").reduce((s, t) => s + t.amount, 0), [filtered]);

  const handlePageChange = (p: number) => {
    if (p < 1 || p > totalPages) return;
    setCurrentPage(p);
  };

  const clearFilters = () => {
    setTypeFilter("All");
    setSearch("");
    setDateFrom("");
    setDateTo("");
    setCurrentPage(1);
  };

  const hasFilters = typeFilter !== "All" || search || dateFrom || dateTo;

  return (
    <div className="p-4 md:p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Transaction History</h1>
          <p className="text-sm text-gray-500">Sierra Agency — Sales, Purchases &amp; Returns</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchAll}
          disabled={loading}
          className="ml-auto"
        >
          <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-green-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-600" />
              Total Sales
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-xl font-bold text-gray-900">LKR {fmt(salesTotal)}</div>
            <div className="text-xs text-gray-400 mt-0.5">{salesCount} invoice{salesCount !== 1 ? "s" : ""}</div>
          </CardContent>
        </Card>

        <Card className="border-blue-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
              <Package className="h-4 w-4 text-blue-600" />
              Total Purchases
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-xl font-bold text-gray-900">LKR {fmt(purchasesTotal)}</div>
            <div className="text-xs text-gray-400 mt-0.5">{purchasesCount} order{purchasesCount !== 1 ? "s" : ""}</div>
          </CardContent>
        </Card>

        <Card className="border-orange-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
              <Undo2 className="h-4 w-4 text-orange-600" />
              Total Returns
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-xl font-bold text-gray-900">LKR {fmt(returnsTotal)}</div>
            <div className="text-xs text-gray-400 mt-0.5">{returnsCount} return{returnsCount !== 1 ? "s" : ""}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[180px]">
              <label className="text-xs font-medium text-gray-500 mb-1 block">Search</label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-gray-400" />
                <Input
                  placeholder="Reference No or Party..."
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
                  className="pl-8 h-9 text-sm"
                />
              </div>
            </div>

            <div className="w-36">
              <label className="text-xs font-medium text-gray-500 mb-1 block">Type</label>
              <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v as any); setCurrentPage(1); }}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All Types</SelectItem>
                  <SelectItem value="Sale">Sales</SelectItem>
                  <SelectItem value="Purchase">Purchases</SelectItem>
                  <SelectItem value="Return">Returns</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="w-36">
              <label className="text-xs font-medium text-gray-500 mb-1 block">From Date</label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => { setDateFrom(e.target.value); setCurrentPage(1); }}
                className="h-9 text-sm"
              />
            </div>

            <div className="w-36">
              <label className="text-xs font-medium text-gray-500 mb-1 block">To Date</label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => { setDateTo(e.target.value); setCurrentPage(1); }}
                className="h-9 text-sm"
              />
            </div>

            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9 text-gray-500">
                <X className="h-3.5 w-3.5 mr-1" /> Clear
              </Button>
            )}
          </div>

          {hasFilters && (
            <div className="mt-3 pt-3 border-t grid grid-cols-3 gap-3 text-sm">
              <div>
                <span className="text-gray-500">Filtered Sales:</span>{" "}
                <span className="font-semibold text-green-700">LKR {fmt(filteredSalesTotal)}</span>
              </div>
              <div>
                <span className="text-gray-500">Filtered Purchases:</span>{" "}
                <span className="font-semibold text-blue-700">LKR {fmt(filteredPurchasesTotal)}</span>
              </div>
              <div>
                <span className="text-gray-500">Filtered Returns:</span>{" "}
                <span className="font-semibold text-orange-700">LKR {fmt(filteredReturnsTotal)}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-20 text-gray-400">
              <RefreshCw className="h-5 w-5 animate-spin mr-2" />
              Loading transactions…
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400 gap-2">
              <ReceiptText className="h-10 w-10 opacity-30" />
              <p className="text-sm">No transactions found</p>
              {hasFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  Clear filters
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead className="text-xs font-semibold text-gray-600 w-[40px]">#</TableHead>
                  <TableHead className="text-xs font-semibold text-gray-600">Date</TableHead>
                  <TableHead className="text-xs font-semibold text-gray-600">Type</TableHead>
                  <TableHead className="text-xs font-semibold text-gray-600">Reference No</TableHead>
                  <TableHead className="text-xs font-semibold text-gray-600">Customer / Supplier</TableHead>
                  <TableHead className="text-xs font-semibold text-gray-600 text-right">Amount</TableHead>
                  <TableHead className="text-xs font-semibold text-gray-600 text-right">Paid</TableHead>
                  <TableHead className="text-xs font-semibold text-gray-600 text-right">Balance</TableHead>
                  <TableHead className="text-xs font-semibold text-gray-600">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.map((txn, idx) => {
                  const cfg = TYPE_CONFIG[txn.type];
                  const globalIdx = (currentPage - 1) * ITEMS_PER_PAGE + idx + 1;
                  return (
                    <TableRow
                      key={txn.id}
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => {
                        if (txn.type === "Sale")
                          router.push(`/dashboard/office/sierra/invoices/${txn.id}`);
                        else if (txn.type === "Purchase")
                          router.push(`/dashboard/office/sierra/purchases/${txn.id}`);
                      }}
                    >
                      <TableCell className="text-xs text-gray-400">{globalIdx}</TableCell>
                      <TableCell className="text-sm text-gray-700 whitespace-nowrap">{fmtDate(txn.date)}</TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.bg} ${cfg.color}`}>
                          {txn.type === "Sale"     && <TrendingUp  className="h-3 w-3" />}
                          {txn.type === "Purchase" && <TrendingDown className="h-3 w-3" />}
                          {txn.type === "Return"   && <Undo2        className="h-3 w-3" />}
                          {cfg.label}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm font-medium text-gray-800">{txn.ref}</TableCell>
                      <TableCell className="text-sm text-gray-700">{txn.party}</TableCell>
                      <TableCell className="text-sm font-semibold text-gray-900 text-right whitespace-nowrap">
                        LKR {fmt(txn.amount)}
                      </TableCell>
                      <TableCell className="text-sm text-gray-700 text-right whitespace-nowrap">
                        LKR {fmt(txn.paidAmount)}
                      </TableCell>
                      <TableCell className={`text-sm font-medium text-right whitespace-nowrap ${txn.balance > 0 ? "text-red-600" : "text-green-600"}`}>
                        {txn.balance > 0 ? `LKR ${fmt(txn.balance)}` : "-"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`text-xs ${STATUS_COLORS[txn.status] ?? "bg-gray-100 text-gray-600"}`}
                        >
                          {txn.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>

        {/* Pagination */}
        {!loading && filtered.length > ITEMS_PER_PAGE && (
          <div className="flex items-center justify-between px-4 py-3 border-t text-sm text-gray-500">
            <span>
              Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1}–{Math.min(currentPage * ITEMS_PER_PAGE, filtered.length)} of {filtered.length}
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                className="h-7 w-7"
                disabled={currentPage === 1}
                onClick={() => handlePageChange(currentPage - 1)}
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                .reduce<(number | "…")[]>((acc, p, i, arr) => {
                  if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push("…");
                  acc.push(p);
                  return acc;
                }, [])
                .map((p, i) =>
                  p === "…" ? (
                    <span key={`ellipsis-${i}`} className="px-1">…</span>
                  ) : (
                    <Button
                      key={p}
                      variant={currentPage === p ? "default" : "outline"}
                      size="icon"
                      className={`h-7 w-7 text-xs ${currentPage === p ? "bg-red-600 hover:bg-red-700 border-red-600" : ""}`}
                      onClick={() => handlePageChange(p as number)}
                    >
                      {p}
                    </Button>
                  )
                )}
              <Button
                variant="outline"
                size="icon"
                className="h-7 w-7"
                disabled={currentPage === totalPages}
                onClick={() => handlePageChange(currentPage + 1)}
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
