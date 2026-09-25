"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Search,
  CheckCircle2,
  AlertTriangle,
  FileCheck2,
  Copy,
  Plus,
  Eye,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  RefreshCw,
  Coins,
  Receipt,
  Check,
  Clock,
  Flag,
  AlertOctagon,
  Printer,
  User,
  Hash,
  ShieldCheck,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { getUserBusinessContext } from "@/app/middleware/businessAuth";

interface SettledInvoice {
  paymentId: string;
  invoiceId: string | null;
  invoiceNo: string;
  amount: number;
}

interface ReceiptAuditItem {
  receiptNumber: string;
  numericReceiptNo: number;
  status: "Issued" | "Unused" | "Cancelled";
  isEntered: boolean;
  isAudited?: boolean;
  isIncorrect?: boolean;
  auditedAt?: string;
  auditedBy?: string;
  paymentDate: string | null;
  invoiceNo: string | null;
  invoicesList?: SettledInvoice[];
  invoiceCount?: number;
  customerName: string | null;
  amount: number | null;
  method: string | null;
}

interface AuditSummary {
  startNum: number;
  endNum: number;
  prefix: string;
  totalReceipts: number;
  issuedCount: number;
  unusedCount: number;
  cancelledCount: number;
  auditedCount: number;
  pendingAuditCount: number;
  flaggedCount: number;
  enteredPercentage: number;
  totalCollected: number;
  missingNumbers: (string | number)[];
}

const DEFAULT_PRESET_BOOKS = [
  { label: "Book 1 (1001 - 1050)", start: 1001, end: 1050 },
  { label: "Book 2 (1051 - 1100)", start: 1051, end: 1100 },
  { label: "Book 3 (1101 - 1150)", start: 1101, end: 1150 },
  { label: "Book 4 (1151 - 1200)", start: 1151, end: 1200 },
  { label: "Book 5 (1201 - 1250)", start: 1201, end: 1250 },
];

export default function SierraReceiptBookAuditPage() {
  const router = useRouter();
  const currentUser = getUserBusinessContext();

  // Audit Range Controls
  const [startNumInput, setStartNumInput] = useState<string>("1001");
  const [endNumInput, setEndNumInput] = useState<string>("1050");
  const [prefix, setPrefix] = useState<string>("");
  const [receiptSearchInput, setReceiptSearchInput] = useState<string>("");

  // Data & State
  const [loading, setLoading] = useState<boolean>(false);
  const [summary, setSummary] = useState<AuditSummary | null>(null);
  const [bookInfo, setBookInfo] = useState<any | null>(null);
  const [receipts, setReceipts] = useState<ReceiptAuditItem[]>([]);
  const [recentBooks, setRecentBooks] = useState<{ id?: string; label: string; start: number; end: number; bookNumber?: string; assignedTo?: string }[]>([]);
  const [statusFilter, setStatusFilter] = useState<"all" | "issued" | "unused" | "audited" | "pending_audit" | "flagged">("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [copiedMissing, setCopiedMissing] = useState<boolean>(false);

  const fetchAuditData = async (start: number, end: number, pref: string, bookId?: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (bookId && bookId !== "custom") {
        params.append("bookId", bookId);
      } else {
        params.append("start", String(start));
        params.append("end", String(end));
        if (pref) params.append("prefix", pref);
      }

      const res = await fetch(`/api/receipt-books/audit-details?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch receipt audit data");
      const data = await res.json();
      setSummary(data.summary);
      setBookInfo(data.book);
      setReceipts(data.items || []);
      if (data.recentBooks && Array.isArray(data.recentBooks)) {
        setRecentBooks(data.recentBooks);
      }
    } catch (err: any) {
      toast.error(err.message || "Error running receipt book audit");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleAuditedCheck = async (receiptNumber: string, currentVal: boolean) => {
    const nextVal = !currentVal;
    try {
      const res = await fetch("/api/receipt-books/audit-details", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          receiptNumber,
          isAudited: nextVal,
          performedByName: currentUser?.name || "Office Staff",
          performedByEmail: currentUser?.email || null,
        }),
      });

      if (!res.ok) throw new Error("Failed to update receipt audit check");

      setReceipts((prev) =>
        prev.map((r) =>
          r.receiptNumber === receiptNumber
            ? { ...r, isAudited: nextVal, isIncorrect: nextVal ? false : r.isIncorrect }
            : r
        )
      );

      if (summary) {
        const auditedDelta = nextVal ? 1 : -1;
        setSummary({
          ...summary,
          auditedCount: Math.max(0, summary.auditedCount + auditedDelta),
          pendingAuditCount: Math.max(0, summary.pendingAuditCount - auditedDelta),
        });
      }

      if (nextVal) {
        toast.success(`Receipt #${receiptNumber} marked as Audited & Checked! ✔️`);
      } else {
        toast.info(`Receipt #${receiptNumber} audit check removed`);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to toggle receipt audit check");
    }
  };

  const handleToggleReceiptFlag = async (receiptNumber: string, currentVal: boolean) => {
    const nextVal = !currentVal;
    try {
      const res = await fetch("/api/receipt-books/audit-details", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          receiptNumber,
          isIncorrect: nextVal,
          performedByName: currentUser?.name || "Office Staff",
          performedByEmail: currentUser?.email || null,
        }),
      });

      if (!res.ok) throw new Error("Failed to update receipt audit flag");

      setReceipts((prev) =>
        prev.map((r) =>
          r.receiptNumber === receiptNumber
            ? { ...r, isIncorrect: nextVal }
            : r
        )
      );

      if (summary) {
        const flagDelta = nextVal ? 1 : -1;
        setSummary({
          ...summary,
          flaggedCount: Math.max(0, summary.flaggedCount + flagDelta),
        });
      }

      if (nextVal) {
        toast.error(`Receipt #${receiptNumber} flagged for audit correction!`);
      } else {
        toast.success(`Audit flag removed from Receipt #${receiptNumber}`);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to toggle receipt flag");
    }
  };

  useEffect(() => {
    fetchAuditData(1001, 1050, "");
  }, []);

  const handleStartInputChange = (val: string) => {
    setStartNumInput(val);
    const num = parseInt(val, 10);
    if (!isNaN(num) && num > 0) {
      if (!endNumInput) {
        setEndNumInput((num + 49).toString());
      }
    }
  };

  const handleAuditClick = () => {
    const s = parseInt(startNumInput, 10);
    let e = parseInt(endNumInput, 10);

    if (isNaN(s)) {
      toast.error("Please enter a valid Start Receipt Number (e.g. 1001 or 20401)");
      return;
    }

    if (isNaN(e)) {
      e = s + 49;
      setEndNumInput(e.toString());
    }

    if (e < s) {
      toast.error("End number must be greater than or equal to Start number");
      return;
    }

    fetchAuditData(s, e, prefix);
  };

  // Smart Book Finder for Receipt # (e.g. 20447 -> 20401 to 20450)
  const handleQuickReceiptSearch = () => {
    const rawVal = receiptSearchInput.trim();
    if (!rawVal) return;

    const digitsMatch = rawVal.match(/\d+/);
    if (!digitsMatch) {
      toast.error("Please enter a valid numeric Receipt # (e.g. 20447 or 1025)");
      return;
    }

    const targetNum = parseInt(digitsMatch[0], 10);
    if (isNaN(targetNum) || targetNum < 1) return;

    const prefixMatch = rawVal.match(/^[^\d]+/);
    const extractedPrefix = prefixMatch ? prefixMatch[0] : prefix;

    const bookStart = Math.floor((targetNum - 1) / 50) * 50 + 1;
    const bookEnd = bookStart + 49;

    setStartNumInput(bookStart.toString());
    setEndNumInput(bookEnd.toString());
    setPrefix(extractedPrefix);
    setSearchQuery(rawVal);
    fetchAuditData(bookStart, bookEnd, extractedPrefix);
    toast.info(`Found Receipt Book range #${bookStart}–${bookEnd} for Receipt #${rawVal}`);
  };

  const applyPreset = (start: number, end: number, bookId?: string) => {
    setStartNumInput(start.toString());
    setEndNumInput(end.toString());
    fetchAuditData(start, end, prefix, bookId);
  };

  const handleShiftBook = (direction: -1 | 1) => {
    const currentStart = parseInt(startNumInput, 10) || summary?.startNum || 1001;
    const currentEnd = parseInt(endNumInput, 10) || summary?.endNum || 1050;
    const range = currentEnd - currentStart + 1;
    const newStart = Math.max(1, currentStart + direction * range);
    const newEnd = newStart + range - 1;

    setStartNumInput(newStart.toString());
    setEndNumInput(newEnd.toString());
    fetchAuditData(newStart, newEnd, prefix);
  };

  const copyMissingList = () => {
    if (!summary || summary.missingNumbers.length === 0) return;
    const missingStr = summary.missingNumbers.join(", ");
    navigator.clipboard.writeText(missingStr);
    setCopiedMissing(true);
    toast.success("Unused receipt numbers copied to clipboard!");
    setTimeout(() => setCopiedMissing(false), 2500);
  };

  const auditedCount = receipts.filter((r) => r.isEntered && r.isAudited).length;
  const pendingAuditCount = receipts.filter((r) => r.isEntered && !r.isAudited).length;
  const flaggedCount = receipts.filter((r) => r.isIncorrect).length;

  const filteredReceipts = receipts.filter((r) => {
    const matchesFilter =
      statusFilter === "all" ||
      (statusFilter === "issued" && r.status === "Issued") ||
      (statusFilter === "unused" && r.status === "Unused") ||
      (statusFilter === "audited" && r.isAudited) ||
      (statusFilter === "pending_audit" && r.isEntered && !r.isAudited) ||
      (statusFilter === "flagged" && r.isIncorrect);

    const q = searchQuery.trim().toLowerCase();
    const matchesSearch =
      !q ||
      r.receiptNumber.toLowerCase().includes(q) ||
      (r.invoiceNo && r.invoiceNo.toLowerCase().includes(q)) ||
      (r.customerName && r.customerName.toLowerCase().includes(q)) ||
      (r.method && r.method.toLowerCase().includes(q));

    return matchesFilter && matchesSearch;
  });

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/dashboard/office/sierra/receipt-books")}
            className="shrink-0"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-purple-950 flex items-center gap-2">
              <ShieldCheck className="w-8 h-8 text-purple-600" /> Receipt Book Audit & Sequence Inspector
            </h1>
            <p className="text-muted-foreground mt-0.5 text-sm">
              Audit Sierra 50-receipt books number-by-number to verify collected payments, confirm audit checkmarks, and track unused receipts.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => {
              const s = parseInt(startNumInput, 10) || summary?.startNum || 1001;
              const e = parseInt(endNumInput, 10) || summary?.endNum || 1050;
              fetchAuditData(s, e, prefix);
            }}
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
          <Button
            variant="outline"
            onClick={() => window.print()}
            className="border-purple-200 text-purple-900 hover:bg-purple-50"
          >
            <Printer className="w-4 h-4 mr-2" /> Print Audit
          </Button>
          <Button
            onClick={() => router.push("/dashboard/office/sierra/payments/entry")}
            className="bg-purple-600 hover:bg-purple-700 text-white"
          >
            <Plus className="w-4 h-4 mr-2" /> Payment Entry
          </Button>
        </div>
      </div>

      {/* Book Controls Card */}
      <Card className="border-purple-100 shadow-sm bg-gradient-to-r from-purple-50/40 via-white to-indigo-50/20">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center justify-between">
            <span className="flex items-center gap-2 text-purple-950">
              <BookOpen className="w-5 h-5 text-purple-600" /> Select Receipt Book Range (50 Receipts)
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleShiftBook(-1)}
                disabled={loading || (parseInt(startNumInput, 10) || summary?.startNum || 1) <= 1}
                title="Previous 50 Receipts"
                className="h-8 text-xs"
              >
                <ChevronLeft className="w-4 h-4 mr-1" /> Prev Book
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleShiftBook(1)}
                disabled={loading}
                title="Next 50 Receipts"
                className="h-8 text-xs"
              >
                Next Book <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </CardTitle>
          <CardDescription className="text-xs">
            Enter the starting receipt number (e.g. 1001 or 20401) to audit sequential receipts in that book.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Quick Find by Receipt # (e.g. 20447) */}
          <div className="p-3 bg-purple-100/60 border border-purple-200 rounded-lg flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-purple-950">
              <Search className="w-4 h-4 text-purple-600 shrink-0" />
              <span>Quick Lookup by Receipt # (e.g. <span className="font-mono text-purple-700 font-bold">20447</span>):</span>
            </div>
            <div className="flex items-center gap-2 flex-1 sm:max-w-xs">
              <Input
                type="text"
                value={receiptSearchInput}
                onChange={(e) => setReceiptSearchInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleQuickReceiptSearch();
                }}
                placeholder="Enter receipt # (e.g. 20447)..."
                className="font-mono text-sm h-8 bg-white"
              />
              <Button
                size="sm"
                onClick={handleQuickReceiptSearch}
                className="bg-purple-700 hover:bg-purple-800 text-white h-8 text-xs font-semibold shrink-0"
              >
                Audit Book
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
            <div>
              <label className="text-xs font-semibold text-gray-700 block mb-1">
                Start Receipt Number
              </label>
              <Input
                type="number"
                value={startNumInput}
                onChange={(e) => handleStartInputChange(e.target.value)}
                placeholder="e.g. 20401"
                className="font-mono text-base font-semibold"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-700 block mb-1">
                End Receipt Number
              </label>
              <Input
                type="number"
                value={endNumInput}
                onChange={(e) => setEndNumInput(e.target.value)}
                placeholder="e.g. 20450"
                className="font-mono text-base font-semibold"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-700 block mb-1">
                Prefix (Optional)
              </label>
              <Input
                type="text"
                value={prefix}
                onChange={(e) => setPrefix(e.target.value)}
                placeholder="e.g. R- or REC-"
                className="font-mono"
              />
            </div>

            <div>
              <Button
                onClick={handleAuditClick}
                disabled={loading}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Auditing...
                  </>
                ) : (
                  <>
                    <FileCheck2 className="w-4 h-4 mr-2" /> Audit Book
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Presets & Assigned Books */}
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-purple-100">
            <span className="text-xs font-semibold text-purple-950 flex items-center gap-1 mr-1">
              <Clock className="w-3.5 h-3.5 text-purple-600" /> Assigned / Recent Books:
            </span>
            {(() => {
              const displayBooks = [...recentBooks];
              DEFAULT_PRESET_BOOKS.forEach((p) => {
                if (displayBooks.length < 5 && !displayBooks.some((b) => b.start === p.start && b.end === p.end)) {
                  displayBooks.push(p);
                }
              });

              const activeStart = parseInt(startNumInput, 10) || summary?.startNum;
              const activeEnd = parseInt(endNumInput, 10) || summary?.endNum;

              return displayBooks.slice(0, 5).map((preset) => {
                const isActive = activeStart === preset.start && activeEnd === preset.end;
                return (
                  <Button
                    key={`${preset.start}-${preset.end}`}
                    variant={isActive ? "default" : "outline"}
                    size="sm"
                    onClick={() => applyPreset(preset.start, preset.end, preset.id)}
                    className={`text-xs font-mono h-7 border-purple-200 ${
                      isActive ? "bg-purple-700 text-white hover:bg-purple-800" : "hover:border-purple-400 hover:bg-purple-50 text-slate-800"
                    }`}
                  >
                    {preset.label}
                  </Button>
                );
              });
            })()}
          </div>
        </CardContent>
      </Card>

      {/* Audit KPI Cards */}
      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-slate-200 shadow-sm">
            <CardContent className="pt-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase">Receipt Range</p>
                <p className="text-2xl font-bold font-mono tracking-tight text-slate-900 mt-1">
                  #{summary.prefix}{summary.startNum} – #{summary.prefix}{summary.endNum}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">{summary.totalReceipts} Total Receipts</p>
              </div>
              <div className="p-3 bg-purple-100 rounded-xl text-purple-700">
                <Receipt className="w-6 h-6" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-emerald-200 bg-emerald-50/20 shadow-sm">
            <CardContent className="pt-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-emerald-800 uppercase">Issued / Used</p>
                <p className="text-2xl font-bold font-mono tracking-tight text-emerald-700 mt-1">
                  {summary.issuedCount} <span className="text-sm font-normal text-emerald-600">({summary.enteredPercentage}%)</span>
                </p>
                <p className="text-xs text-emerald-600 mt-0.5">Found in payments records</p>
              </div>
              <div className="p-3 bg-emerald-100 rounded-xl text-emerald-700">
                <CheckCircle2 className="w-6 h-6" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-blue-200 bg-blue-50/20 shadow-sm">
            <CardContent className="pt-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-blue-800 uppercase">Audited & Verified</p>
                <p className="text-2xl font-bold font-mono tracking-tight text-blue-900 mt-1">
                  {auditedCount} <span className="text-sm font-normal text-blue-600">({summary.issuedCount > 0 ? Math.round((auditedCount / summary.issuedCount) * 100) : 0}%)</span>
                </p>
                <p className="text-xs text-blue-600 mt-0.5">{pendingAuditCount} Pending Audit</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-xl text-blue-700">
                <Check className="w-6 h-6 stroke-[3]" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-amber-200 bg-amber-50/20 shadow-sm">
            <CardContent className="pt-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-amber-800 uppercase">Total Money Collected</p>
                <p className="text-2xl font-bold font-mono tracking-tight text-amber-900 mt-1">
                  Rs. {summary.totalCollected.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-amber-600 mt-0.5">Sum of all issued receipts</p>
              </div>
              <div className="p-3 bg-amber-100 rounded-xl text-amber-700">
                <Coins className="w-6 h-6" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Unused Receipts Banner */}
      {summary && summary.unusedCount > 0 && (
        <Card className="border-amber-300 bg-gradient-to-r from-amber-50 via-amber-50/60 to-orange-50/30">
          <CardContent className="py-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                  <h3 className="font-semibold text-amber-950 text-base">
                    {summary.unusedCount} Unused / Missing Receipt Numbers in Book #{summary.startNum}–#{summary.endNum}
                  </h3>
                </div>
                <p className="text-xs text-amber-700 mt-1">
                  The following physical receipt numbers have not yet been recorded against customer invoice settlements:
                </p>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {summary.missingNumbers.map((num) => (
                    <Badge
                      key={String(num)}
                      variant="outline"
                      className="bg-white border-amber-300 text-amber-900 font-mono text-xs font-semibold px-2 py-0.5"
                    >
                      #{num}
                    </Badge>
                  ))}
                </div>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={copyMissingList}
                className="bg-white border-amber-300 hover:bg-amber-100 text-amber-900 font-medium shrink-0 self-start md:self-center"
              >
                {copiedMissing ? (
                  <>
                    <Check className="w-4 h-4 mr-1 text-emerald-600" /> Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 mr-1" /> Copy Unused List
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* All Accounted Success Banner */}
      {summary && summary.unusedCount === 0 && summary.totalReceipts > 0 && (
        <Card className="border-emerald-300 bg-emerald-50">
          <CardContent className="py-4 flex items-center gap-3">
            <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
            <div>
              <h3 className="font-semibold text-emerald-950 text-base">
                All 50 Receipts Fully Accounted For!
              </h3>
              <p className="text-xs text-emerald-700">
                Every receipt number in range #{summary.startNum}–#{summary.endNum} has been issued and booked into the system.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Audit Table Section */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-lg font-bold text-gray-900">
                Receipt Number Breakdown ({filteredReceipts.length} Receipts Shown)
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground mt-0.5">
                Sequential status & audit checkmarks for each receipt in this book range.
              </CardDescription>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Filter Tabs */}
              <div className="inline-flex rounded-md p-1 bg-slate-100 border border-slate-200">
                <button
                  onClick={() => setStatusFilter("all")}
                  className={`px-3 py-1 text-xs font-semibold rounded-sm transition-all ${
                    statusFilter === "all"
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  All ({summary?.totalReceipts || 0})
                </button>
                <button
                  onClick={() => setStatusFilter("issued")}
                  className={`px-3 py-1 text-xs font-semibold rounded-sm transition-all ${
                    statusFilter === "issued"
                      ? "bg-purple-600 text-white shadow-sm"
                      : "text-purple-700 hover:text-purple-900"
                  }`}
                >
                  Issued ({summary?.issuedCount || 0})
                </button>
                <button
                  onClick={() => setStatusFilter("audited")}
                  className={`px-3 py-1 text-xs font-semibold rounded-sm transition-all ${
                    statusFilter === "audited"
                      ? "bg-emerald-600 text-white shadow-sm font-bold"
                      : "text-emerald-800 hover:text-emerald-950 font-semibold"
                  }`}
                >
                  Audited ✔️ ({auditedCount})
                </button>
                <button
                  onClick={() => setStatusFilter("pending_audit")}
                  className={`px-3 py-1 text-xs font-semibold rounded-sm transition-all ${
                    statusFilter === "pending_audit"
                      ? "bg-amber-600 text-white shadow-sm font-bold"
                      : "text-amber-800 hover:text-amber-950 font-semibold"
                  }`}
                >
                  Pending Audit ⏳ ({pendingAuditCount})
                </button>
                <button
                  onClick={() => setStatusFilter("unused")}
                  className={`px-3 py-1 text-xs font-semibold rounded-sm transition-all ${
                    statusFilter === "unused"
                      ? "bg-slate-700 text-white shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Unused ({summary?.unusedCount || 0})
                </button>
                <button
                  onClick={() => setStatusFilter("flagged")}
                  className={`px-3 py-1 text-xs font-semibold rounded-sm transition-all ${
                    statusFilter === "flagged"
                      ? "bg-rose-700 text-white shadow-sm font-bold"
                      : "text-rose-800 hover:text-rose-950 font-semibold"
                  }`}
                >
                  🚩 Flagged ({flaggedCount})
                </button>
              </div>

              {/* Search Bar */}
              <div className="relative w-full md:w-56">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Filter receipt, inv, customer..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 h-8 text-xs"
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto border rounded-lg">
            <table className="w-full text-sm text-left border-collapse">
              <thead className="bg-slate-50 text-slate-700 uppercase font-semibold text-[11px] tracking-wider border-b">
                <tr>
                  <th className="py-3 px-4 w-28">Receipt #</th>
                  <th className="py-3 px-4 w-36">Issuance</th>
                  <th className="py-3 px-4 w-40">Audit Status</th>
                  <th className="py-3 px-4 w-28">Date</th>
                  <th className="py-3 px-4 min-w-[220px]">Settled Invoice(s)</th>
                  <th className="py-3 px-4">Customer Shop / Name</th>
                  <th className="py-3 px-4 w-28">Method</th>
                  <th className="py-3 px-4 text-right w-36">Amount (Rs.)</th>
                  <th className="py-3 px-4 text-right w-44">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-sans">
                {loading ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-muted-foreground">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-purple-600" />
                      Auditing receipt book sequence numbers...
                    </td>
                  </tr>
                ) : filteredReceipts.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-muted-foreground">
                      No receipts found matching your filter criteria.
                    </td>
                  </tr>
                ) : (
                  filteredReceipts.map((item) => (
                    <tr
                      key={item.receiptNumber}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        item.isEntered && item.isAudited
                          ? "bg-emerald-50/40"
                          : item.isIncorrect
                          ? "bg-rose-100/40"
                          : item.status === "Unused"
                          ? "bg-slate-50/40 text-slate-400"
                          : ""
                      }`}
                    >
                      {/* Receipt # */}
                      <td className="py-3 px-4 font-mono font-bold text-gray-900 text-base">
                        #{item.receiptNumber}
                      </td>

                      {/* Issuance Status */}
                      <td className="py-3 px-4">
                        {item.status === "Issued" ? (
                          <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 font-semibold text-xs">
                            Issued
                          </Badge>
                        ) : item.status === "Cancelled" ? (
                          <Badge className="bg-rose-100 text-rose-800 hover:bg-rose-100 font-semibold text-xs">
                            Cancelled
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-slate-100 text-slate-500 border-slate-200 text-xs">
                            Unused
                          </Badge>
                        )}
                      </td>

                      {/* Audit Status */}
                      <td className="py-3 px-4">
                        {item.isAudited ? (
                          <Badge className="bg-emerald-100 text-emerald-950 border-emerald-300 hover:bg-emerald-100 font-bold text-xs gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Audited ✔️
                          </Badge>
                        ) : item.isIncorrect ? (
                          <Badge className="bg-rose-100 text-rose-900 border-rose-300 hover:bg-rose-100 font-bold text-xs gap-1">
                            <AlertOctagon className="w-3 h-3 text-rose-600" /> Flagged
                          </Badge>
                        ) : item.status === "Issued" ? (
                          <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-50 text-xs">
                            ⏳ Pending Audit
                          </Badge>
                        ) : (
                          <span className="text-slate-300 text-xs">—</span>
                        )}
                      </td>

                      {/* Date */}
                      <td className="py-3 px-4 text-xs font-mono text-slate-600">
                        {item.paymentDate
                          ? new Date(item.paymentDate).toLocaleDateString("en-LK", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })
                          : "—"}
                      </td>

                      {/* Settled Invoices */}
                      <td className="py-3 px-4 font-mono text-xs font-semibold text-purple-900">
                        {item.invoicesList && item.invoicesList.length > 0 ? (
                          <div className="flex flex-wrap items-center gap-1">
                            {item.invoicesList.map((inv, idx) => (
                              <Badge
                                key={idx}
                                variant="outline"
                                className="bg-purple-50 text-purple-950 border-purple-200 text-[11px] font-mono whitespace-nowrap cursor-pointer hover:bg-purple-100"
                                onClick={() => inv.invoiceId && router.push(`/dashboard/office/sierra/invoices/${inv.invoiceId}`)}
                              >
                                {inv.invoiceNo} <span className="text-purple-700 font-bold ml-1">(Rs. {inv.amount.toLocaleString()})</span>
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>

                      {/* Customer Name */}
                      <td className="py-3 px-4 font-medium text-slate-900">
                        {item.customerName || <span className="text-slate-400 italic">Unused Serial</span>}
                      </td>

                      {/* Method */}
                      <td className="py-3 px-4 text-xs capitalize text-slate-700">
                        {item.method || "—"}
                      </td>

                      {/* Amount */}
                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                        {item.amount !== null ? (
                          `Rs. ${item.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>

                      {/* Action */}
                      <td className="py-3 px-4 text-right">
                        {item.status === "Issued" ? (
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Audited Check Toggle Button */}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleToggleAuditedCheck(item.receiptNumber, !!item.isAudited)}
                              title={item.isAudited ? "Unmark Audited Check" : "Mark as Audited & Checked ✔️"}
                              className={`h-8 text-xs font-bold px-2.5 gap-1 ${
                                item.isAudited
                                  ? "bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700 shadow-xs"
                                  : "border-emerald-500 text-emerald-700 hover:bg-emerald-50"
                              }`}
                            >
                              <Check className="w-3.5 h-3.5 stroke-[3]" />
                              {item.isAudited ? "Checked" : "Check"}
                            </Button>

                            {/* Flag / Incorrect Button */}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleToggleReceiptFlag(item.receiptNumber, !!item.isIncorrect)}
                              title={item.isIncorrect ? "Remove Audit Flag" : "Flag as Incorrect / Needs Audit"}
                              className={`h-8 text-xs font-semibold px-2 ${
                                item.isIncorrect
                                  ? "bg-rose-100 text-rose-800 border-rose-300 hover:bg-rose-200"
                                  : "border-slate-300 text-slate-600 hover:text-rose-700 hover:bg-rose-50"
                              }`}
                            >
                              <Flag className={`w-3.5 h-3.5 ${item.isIncorrect ? "fill-rose-600 text-rose-600" : ""}`} />
                            </Button>

                            {item.invoicesList && item.invoicesList[0]?.invoiceId && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => router.push(`/dashboard/office/sierra/invoices/${item.invoicesList![0].invoiceId}`)}
                                className="h-8 text-xs font-medium border-slate-300"
                              >
                                <Eye className="w-3.5 h-3.5 mr-1" /> View
                              </Button>
                            )}
                          </div>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => router.push(`/dashboard/office/sierra/payments/entry?receiptNo=${encodeURIComponent(item.receiptNumber)}`)}
                            className="h-8 text-xs font-semibold border-purple-200 text-purple-700 hover:bg-purple-50 hover:text-purple-800"
                          >
                            <Plus className="w-3.5 h-3.5 mr-1" /> Use Receipt
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
