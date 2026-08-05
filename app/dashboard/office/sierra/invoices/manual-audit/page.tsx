"use client";

import React, { useState, useEffect } from "react";
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
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface BillAuditItem {
  billNo: number;
  formattedBillNo: string;
  isEntered: boolean;
  invoice: {
    id: string;
    invoiceNo: string;
    manualInvoiceNo: string | null;
    customerId: string;
    customerName: string;
    date: string;
    totalAmount: number;
    paidAmount: number;
    dueAmount: number;
    status: string;
    isIncorrect?: boolean;
    isAudited?: boolean;
  } | null;
}

interface AuditSummary {
  startNum: number;
  endNum: number;
  prefix: string;
  totalBills: number;
  enteredCount: number;
  missingCount: number;
  enteredPercentage: number;
  totalEnteredAmount: number;
  missingNumbers: (string | number)[];
}

const PRESET_BOOKS = [
  { label: "Book 1 (101 - 150)", start: 101, end: 150 },
  { label: "Book 2 (151 - 200)", start: 151, end: 200 },
  { label: "Book 3 (201 - 250)", start: 201, end: 250 },
  { label: "Book 4 (251 - 300)", start: 251, end: 300 },
  { label: "Book 5 (301 - 350)", start: 301, end: 350 },
];

export default function SierraManualInvoiceAuditPage() {
  const router = useRouter();

  // Audit Range Controls (allow empty string for flexible input)
  const [startNumInput, setStartNumInput] = useState<string>("");
  const [endNumInput, setEndNumInput] = useState<string>("");
  const [prefix, setPrefix] = useState<string>("");
  const [manualRefInput, setManualRefInput] = useState<string>("");

  // Data & State
  const [loading, setLoading] = useState<boolean>(false);
  const [summary, setSummary] = useState<AuditSummary | null>(null);
  const [bills, setBills] = useState<BillAuditItem[]>([]);
  const [recentBooks, setRecentBooks] = useState<{ label: string; start: number; end: number }[]>([]);
  const [statusFilter, setStatusFilter] = useState<"all" | "entered" | "missing" | "audited" | "pending_audit" | "flagged">("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [copiedMissing, setCopiedMissing] = useState<boolean>(false);

  const fetchAuditData = async (start: number, end: number, pref: string) => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/sierra/manual-invoice-audit?start=${start}&end=${end}&prefix=${encodeURIComponent(pref)}`
      );
      if (!res.ok) throw new Error("Failed to fetch audit data");
      const data = await res.json();
      setSummary(data.summary);
      setBills(data.bills || []);
      if (data.recentBooks && Array.isArray(data.recentBooks)) {
        setRecentBooks(data.recentBooks);
      }
    } catch (err: any) {
      toast.error(err.message || "Error running manual invoice audit");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleAuditedCheck = async (invoiceId: string, currentVal: boolean) => {
    const nextVal = !currentVal;
    try {
      const res = await fetch(`/api/invoices/${invoiceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isAudited: nextVal }),
      });
      if (!res.ok) throw new Error("Failed to update audit check");
      
      setBills((prev) =>
        prev.map((b) =>
          b.invoice?.id === invoiceId
            ? { ...b, invoice: { ...b.invoice, isAudited: nextVal } }
            : b
        )
      );

      if (nextVal) {
        toast.success("Bill marked as Audited & Checked! ✔️");
      } else {
        toast.info("Audit check removed");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to toggle audit check");
    }
  };

  const handleToggleBillFlag = async (invoiceId: string, currentVal: boolean) => {
    const nextVal = !currentVal;
    try {
      const res = await fetch(`/api/invoices/${invoiceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isIncorrect: nextVal }),
      });
      if (!res.ok) throw new Error("Failed to update audit flag");
      
      setBills((prev) =>
        prev.map((b) =>
          b.invoice?.id === invoiceId
            ? { ...b, invoice: { ...b.invoice, isIncorrect: nextVal } }
            : b
        )
      );

      if (nextVal) {
        toast.error("Invoice flagged for audit / incorrect!");
      } else {
        toast.success("Audit flag removed");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to toggle audit flag");
    }
  };

  useEffect(() => {
    // Default initial fetch with range 101-150
    fetchAuditData(101, 150, "");
  }, []);

  const handleStartInputChange = (val: string) => {
    setStartNumInput(val);
    const num = parseInt(val, 10);
    if (!isNaN(num) && num > 0) {
      // Auto-calculate end number 50 bills range if end field is empty
      if (!endNumInput) {
        setEndNumInput((num + 49).toString());
      }
    }
  };

  const handleAuditClick = () => {
    const s = parseInt(startNumInput, 10);
    let e = parseInt(endNumInput, 10);

    if (isNaN(s)) {
      toast.error("Please enter a valid Start Bill Number (e.g. 11801)");
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

  // Smart Book Finder for Manual Ref # (e.g. 11823 -> 11801 to 11850)
  const handleQuickManualRefSearch = () => {
    const rawVal = manualRefInput.trim();
    if (!rawVal) return;

    // Extract digits (e.g. 11823)
    const digitsMatch = rawVal.match(/\d+/);
    if (!digitsMatch) {
      toast.error("Please enter a valid numeric Manual Ref # (e.g. 11823)");
      return;
    }

    const targetNum = parseInt(digitsMatch[0], 10);
    if (isNaN(targetNum) || targetNum < 1) return;

    // Extract any leading non-digits prefix (e.g. "S-" from "S-11823")
    const prefixMatch = rawVal.match(/^[^\d]+/);
    const extractedPrefix = prefixMatch ? prefixMatch[0] : prefix;

    // Calculate 50-bill book boundaries containing this number
    const bookStart = Math.floor((targetNum - 1) / 50) * 50 + 1;
    const bookEnd = bookStart + 49;

    setStartNumInput(bookStart.toString());
    setEndNumInput(bookEnd.toString());
    setPrefix(extractedPrefix);
    setSearchQuery(rawVal); // Pre-highlight the searched bill in table
    fetchAuditData(bookStart, bookEnd, extractedPrefix);
    toast.info(`Found Book range #${bookStart}–${bookEnd} for Manual Ref #${rawVal}`);
  };

  const applyPreset = (start: number, end: number) => {
    setStartNumInput(start.toString());
    setEndNumInput(end.toString());
    fetchAuditData(start, end, prefix);
  };

  const handleShiftBook = (direction: -1 | 1) => {
    const currentStart = parseInt(startNumInput, 10) || summary?.startNum || 101;
    const currentEnd = parseInt(endNumInput, 10) || summary?.endNum || 150;
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
    toast.success("Missing bill numbers copied to clipboard!");
    setTimeout(() => setCopiedMissing(false), 2500);
  };

  const auditedCount = bills.filter((b) => b.isEntered && b.invoice?.isAudited).length;
  const pendingAuditCount = bills.filter((b) => b.isEntered && !b.invoice?.isAudited).length;
  const flaggedCount = bills.filter((b) => b.isEntered && b.invoice?.isIncorrect).length;

  // Filter bills based on search and tab filter
  const filteredBills = bills.filter((b) => {
    const matchesFilter =
      statusFilter === "all" ||
      (statusFilter === "entered" && b.isEntered) ||
      (statusFilter === "missing" && !b.isEntered) ||
      (statusFilter === "audited" && b.isEntered && b.invoice?.isAudited) ||
      (statusFilter === "pending_audit" && b.isEntered && !b.invoice?.isAudited) ||
      (statusFilter === "flagged" && b.isEntered && b.invoice?.isIncorrect);

    const q = searchQuery.trim().toLowerCase();
    const matchesSearch =
      !q ||
      b.formattedBillNo.toLowerCase().includes(q) ||
      (b.invoice?.invoiceNo && b.invoice.invoiceNo.toLowerCase().includes(q)) ||
      (b.invoice?.customerName && b.invoice.customerName.toLowerCase().includes(q));

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
            onClick={() => router.push("/dashboard/office/sierra/invoices")}
            className="shrink-0"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-red-900 flex items-center gap-2">
              <FileCheck2 className="w-8 h-8 text-red-600" /> Manual Invoice Book Audit
            </h1>
            <p className="text-muted-foreground mt-0.5 text-sm">
              Audit Sierra 50-bill manual invoice books to verify entered bills and identify missing numbers.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => {
              const s = parseInt(startNumInput, 10) || summary?.startNum || 101;
              const e = parseInt(endNumInput, 10) || summary?.endNum || 150;
              fetchAuditData(s, e, prefix);
            }}
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
          <Button
            onClick={() => router.push("/dashboard/office/sierra/invoices/create")}
            className="bg-red-600 hover:bg-red-700"
          >
            <Plus className="w-4 h-4 mr-2" /> Create Bill
          </Button>
        </div>
      </div>

      {/* Book Controls Card */}
      <Card className="border-red-100 shadow-sm bg-gradient-to-r from-red-50/40 via-white to-orange-50/20">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center justify-between">
            <span className="flex items-center gap-2 text-red-950">
              <BookOpen className="w-5 h-5 text-red-600" /> Select Manual Invoice Book Range (50 Bills)
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleShiftBook(-1)}
                disabled={loading || (parseInt(startNumInput, 10) || summary?.startNum || 1) <= 1}
                title="Previous 50 Bills"
              >
                <ChevronLeft className="w-4 h-4 mr-1" /> Prev Book
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleShiftBook(1)}
                disabled={loading}
                title="Next 50 Bills"
              >
                Next Book <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </CardTitle>
          <CardDescription className="text-xs">
            Enter the starting bill number (e.g. 101 or 301) to audit 50 sequential bills in that book.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Quick Find by Manual Ref # (e.g. 11823) */}
          <div className="p-3 bg-red-100/50 border border-red-200 rounded-lg flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-red-950">
              <Search className="w-4 h-4 text-red-600 shrink-0" />
              <span>Quick Lookup by Manual Ref # (e.g. <span className="font-mono text-red-700 font-bold">11823</span>):</span>
            </div>
            <div className="flex items-center gap-2 flex-1 sm:max-w-xs">
              <Input
                type="text"
                value={manualRefInput}
                onChange={(e) => setManualRefInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleQuickManualRefSearch();
                }}
                placeholder="Enter bill # (e.g. 11823)..."
                className="font-mono text-sm h-8 bg-white"
              />
              <Button
                size="sm"
                onClick={handleQuickManualRefSearch}
                className="bg-red-700 hover:bg-red-800 text-white h-8 text-xs font-semibold shrink-0"
              >
                Audit Book
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
            <div>
              <label className="text-xs font-semibold text-gray-700 block mb-1">
                Start Bill Number
              </label>
              <Input
                type="number"
                value={startNumInput}
                onChange={(e) => handleStartInputChange(e.target.value)}
                placeholder="e.g. 11801"
                className="font-mono text-base font-semibold"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-700 block mb-1">
                End Bill Number
              </label>
              <Input
                type="number"
                value={endNumInput}
                onChange={(e) => setEndNumInput(e.target.value)}
                placeholder="e.g. 11850"
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
                placeholder="e.g. S- or SB-"
                className="font-mono"
              />
            </div>

            <div>
              <Button
                onClick={handleAuditClick}
                disabled={loading}
                className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold"
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

          {/* Presets: Last 5 Recently Added / Used Books */}
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-red-100">
            <span className="text-xs font-semibold text-red-950 flex items-center gap-1 mr-1">
              <Clock className="w-3.5 h-3.5 text-red-600" /> Last 5 Recently Added Books:
            </span>
            {(() => {
              // Combine recent books from API with default presets to always show 5 options
              const displayBooks = [...recentBooks];
              PRESET_BOOKS.forEach((p) => {
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
                    onClick={() => applyPreset(preset.start, preset.end)}
                    className={`text-xs font-mono h-7 border-red-200 ${
                      isActive ? "bg-red-600 text-white hover:bg-red-700" : "hover:border-red-400 hover:bg-red-50 text-slate-800"
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
          <Card className="border-slate-200">
            <CardContent className="pt-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase">Book Range</p>
                <p className="text-2xl font-bold font-mono tracking-tight text-slate-900 mt-1">
                  {summary.prefix}{summary.startNum} – {summary.prefix}{summary.endNum}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">{summary.totalBills} Total Bills</p>
              </div>
              <div className="p-3 bg-slate-100 rounded-xl text-slate-700">
                <Receipt className="w-6 h-6" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-emerald-200 bg-emerald-50/20">
            <CardContent className="pt-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-emerald-800 uppercase">Entered / Booked</p>
                <p className="text-2xl font-bold font-mono tracking-tight text-emerald-700 mt-1">
                  {summary.enteredCount} <span className="text-sm font-normal text-emerald-600">({summary.enteredPercentage}%)</span>
                </p>
                <p className="text-xs text-emerald-600 mt-0.5">Found in Sierra system</p>
              </div>
              <div className="p-3 bg-emerald-100 rounded-xl text-emerald-700">
                <CheckCircle2 className="w-6 h-6" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-rose-200 bg-rose-50/20">
            <CardContent className="pt-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-rose-800 uppercase">Missing Bills</p>
                <p className="text-2xl font-bold font-mono tracking-tight text-rose-700 mt-1">
                  {summary.missingCount} <span className="text-sm font-normal text-rose-600">({100 - summary.enteredPercentage}%)</span>
                </p>
                <p className="text-xs text-rose-600 mt-0.5">Not yet entered in workflow</p>
              </div>
              <div className="p-3 bg-rose-100 rounded-xl text-rose-700">
                <AlertTriangle className="w-6 h-6" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-blue-200 bg-blue-50/20">
            <CardContent className="pt-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-blue-800 uppercase">Book Total Entered</p>
                <p className="text-2xl font-bold font-mono tracking-tight text-blue-900 mt-1">
                  Rs. {summary.totalEnteredAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-blue-600 mt-0.5">Sum of entered bill amounts</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-xl text-blue-700">
                <Coins className="w-6 h-6" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Missing Bills Banner */}
      {summary && summary.missingCount > 0 && (
        <Card className="border-rose-300 bg-gradient-to-r from-rose-50 via-rose-50/60 to-orange-50/30">
          <CardContent className="py-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
                  <h3 className="font-semibold text-rose-950 text-base">
                    {summary.missingCount} Missing Manual Invoice Numbers in Book #{summary.startNum}–{summary.endNum}
                  </h3>
                </div>
                <p className="text-xs text-rose-700 mt-1">
                  The following physical bill numbers have not been booked into the workflow yet:
                </p>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {summary.missingNumbers.map((num) => (
                    <Badge
                      key={String(num)}
                      variant="outline"
                      className="bg-white border-rose-300 text-rose-800 font-mono text-xs font-semibold px-2 py-0.5"
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
                className="bg-white border-rose-300 hover:bg-rose-100 text-rose-800 font-medium shrink-0 self-start md:self-center"
              >
                {copiedMissing ? (
                  <>
                    <Check className="w-4 h-4 mr-1 text-emerald-600" /> Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 mr-1" /> Copy Missing List
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* All Cleared Success Banner */}
      {summary && summary.missingCount === 0 && summary.totalBills > 0 && (
        <Card className="border-emerald-300 bg-emerald-50">
          <CardContent className="py-4 flex items-center gap-3">
            <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
            <div>
              <h3 className="font-semibold text-emerald-950 text-base">
                All 50 Bills Accounted For!
              </h3>
              <p className="text-xs text-emerald-700">
                Every bill number in range #{summary.startNum}–{summary.endNum} has been entered into the Sierra workflow.
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
                Bill Audit Breakdown ({filteredBills.length} Bills Shown)
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground mt-0.5">
                Sequential status of each manual invoice bill number.
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
                  All ({summary?.totalBills || 0})
                </button>
                <button
                  onClick={() => setStatusFilter("entered")}
                  className={`px-3 py-1 text-xs font-semibold rounded-sm transition-all ${
                    statusFilter === "entered"
                      ? "bg-emerald-600 text-white shadow-sm"
                      : "text-emerald-700 hover:text-emerald-900"
                  }`}
                >
                  Entered ({summary?.enteredCount || 0})
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
                  onClick={() => setStatusFilter("missing")}
                  className={`px-3 py-1 text-xs font-semibold rounded-sm transition-all ${
                    statusFilter === "missing"
                      ? "bg-rose-600 text-white shadow-sm"
                      : "text-rose-700 hover:text-rose-900"
                  }`}
                >
                  Missing ({summary?.missingCount || 0})
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
                  placeholder="Filter bill #, customer..."
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
                  <th className="py-3 px-4 w-28">Manual Bill #</th>
                  <th className="py-3 px-4 w-40">Status</th>
                  <th className="py-3 px-4">System Invoice #</th>
                  <th className="py-3 px-4">Customer Shop / Name</th>
                  <th className="py-3 px-4 w-28">Invoice Date</th>
                  <th className="py-3 px-4 text-right w-36">Amount (Rs.)</th>
                  <th className="py-3 px-4 w-28 text-center">Payment</th>
                  <th className="py-3 px-4 text-right w-44">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-sans">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-muted-foreground">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-red-600" />
                      Auditing manual invoice book numbers...
                    </td>
                  </tr>
                ) : filteredBills.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-muted-foreground">
                      No bill numbers found matching your filters.
                    </td>
                  </tr>
                ) : (
                  filteredBills.map((item) => (
                    <tr
                      key={item.billNo}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        item.isEntered && item.invoice?.isAudited
                          ? "bg-emerald-50/40"
                          : item.isEntered && item.invoice?.isIncorrect
                          ? "bg-rose-100/40"
                          : !item.isEntered
                          ? "bg-rose-50/20"
                          : ""
                      }`}
                    >
                      {/* Manual Bill # */}
                      <td className="py-3 px-4 font-mono font-bold text-gray-900 text-base">
                        #{item.formattedBillNo}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4">
                        {item.isEntered && item.invoice?.isAudited ? (
                          <Badge className="bg-emerald-100 text-emerald-950 border-emerald-300 hover:bg-emerald-100 font-bold text-xs gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Audited ✔️
                          </Badge>
                        ) : item.isEntered && item.invoice?.isIncorrect ? (
                          <Badge className="bg-rose-100 text-rose-900 border-rose-300 hover:bg-rose-100 font-bold text-xs">
                            <AlertOctagon className="w-3 h-3 mr-1 text-rose-600" /> Flagged / Audit
                          </Badge>
                        ) : item.isEntered ? (
                          <Badge variant="outline" className="bg-blue-50 text-blue-800 border-blue-200 hover:bg-blue-50 font-medium">
                            <CheckCircle2 className="w-3 h-3 mr-1 text-blue-600" /> Entered (Pending Audit)
                          </Badge>
                        ) : (
                          <Badge className="bg-rose-100 text-rose-800 border-rose-300 hover:bg-rose-100 font-medium">
                            <AlertTriangle className="w-3 h-3 mr-1 text-rose-600" /> Missing
                          </Badge>
                        )}
                      </td>

                      {/* System Invoice # */}
                      <td className="py-3 px-4 font-mono text-xs text-slate-700 font-semibold">
                        {item.invoice ? item.invoice.invoiceNo : "—"}
                      </td>

                      {/* Customer Name */}
                      <td className="py-3 px-4 font-medium text-slate-900">
                        {item.invoice ? (
                          <div>
                            <p className="font-semibold text-slate-900">{item.invoice.customerName}</p>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">Not Booked</span>
                        )}
                      </td>

                      {/* Date */}
                      <td className="py-3 px-4 text-xs font-mono text-slate-600">
                        {item.invoice ? item.invoice.date : "—"}
                      </td>

                      {/* Amount */}
                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                        {item.invoice ? (
                          `Rs. ${item.invoice.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>

                      {/* Payment Status */}
                      <td className="py-3 px-4 text-center">
                        {item.invoice ? (
                          <span
                            className={`inline-block px-2 py-0.5 text-xs font-semibold rounded ${
                              item.invoice.status === "Paid"
                                ? "bg-emerald-100 text-emerald-800"
                                : item.invoice.status === "Partial"
                                ? "bg-amber-100 text-amber-800"
                                : "bg-red-100 text-red-800"
                            }`}
                          >
                            {item.invoice.status}
                          </span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>

                      {/* Action */}
                      <td className="py-3 px-4 text-right">
                        {item.isEntered && item.invoice ? (
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Check Tick Toggle Button */}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                handleToggleAuditedCheck(item.invoice!.id, !!item.invoice!.isAudited)
                              }
                              title={item.invoice.isAudited ? "Unmark Audited Check" : "Mark as Audited & Checked ✔️"}
                              className={`h-8 text-xs font-bold px-2.5 gap-1 ${
                                item.invoice.isAudited
                                  ? "bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700 shadow-xs"
                                  : "border-emerald-500 text-emerald-700 hover:bg-emerald-50"
                              }`}
                            >
                              <Check className="w-3.5 h-3.5 stroke-[3]" />
                              {item.invoice.isAudited ? "Checked" : "Check"}
                            </Button>

                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                router.push(`/dashboard/office/sierra/invoices/${item.invoice!.id}`)
                              }
                              className="h-8 text-xs font-medium border-slate-300"
                            >
                              <Eye className="w-3.5 h-3.5 mr-1" /> View
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                handleToggleBillFlag(item.invoice!.id, !!item.invoice!.isIncorrect)
                              }
                              title={item.invoice.isIncorrect ? "Remove Audit Flag" : "Flag as Incorrect / Needs Audit"}
                              className={`h-8 text-xs font-semibold px-2 ${
                                item.invoice.isIncorrect
                                  ? "bg-rose-100 text-rose-800 border-rose-300 hover:bg-rose-200"
                                  : "border-slate-300 text-slate-600 hover:text-rose-700 hover:bg-rose-50"
                              }`}
                            >
                              <Flag className={`w-3.5 h-3.5 ${item.invoice.isIncorrect ? "fill-rose-600 text-rose-600" : ""}`} />
                            </Button>
                          </div>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              router.push(
                                `/dashboard/office/sierra/invoices/create?manualNo=${encodeURIComponent(
                                  item.formattedBillNo
                                )}`
                              )
                            }
                            className="h-8 text-xs font-semibold border-rose-300 text-rose-700 hover:bg-rose-50 hover:text-rose-800"
                          >
                            <Plus className="w-3.5 h-3.5 mr-1" /> Book Bill
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
