"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Undo2,
  Search,
  RefreshCw,
  ArrowLeft,
  Filter,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Trash2,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Clock,
  Truck,
  AlertTriangle,
  Receipt,
  Store,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import Link from "next/link";
import { BUSINESS_IDS } from "@/app/config/business-constants";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { cn } from "@/lib/utils";

export default function ReturnsPage() {
  const router = useRouter();

  // Active Tab
  const [activeTab, setActiveTab] = useState<"pending" | "history">("pending");

  // Pending Approvals State
  const [pendingLoading, setPendingLoading] = useState(true);
  const [pendingReturns, setPendingReturns] = useState<any[]>([]);
  const [approvingReturn, setApprovingReturn] = useState<any | null>(null);
  const [rejectingReturn, setRejectingReturn] = useState<any | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [actionProcessing, setActionProcessing] = useState(false);

  // History State
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyReturns, setHistoryReturns] = useState<any[]>([]);
  const [deletingReturn, setDeletingReturn] = useState<any>(null);
  const [deleting, setDeleting] = useState(false);

  // Search & Pagination State for History
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const pageSize = 15;

  // Filter State
  const [dateFilterType, setDateFilterType] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Helper to parse metadata tags from reason
  const parseReasonMetadata = (reason?: string | null, fallbackPrice?: number) => {
    let invoiceNo = "-";
    let unitPrice = fallbackPrice || 0;
    let cleanReason = reason || "";

    if (reason) {
      const invMatch = reason.match(/\[INV:([^\]]+)\]/);
      if (invMatch) {
        invoiceNo = invMatch[1];
        cleanReason = cleanReason.replace(invMatch[0], "").trim();
      }
      const priceMatch = reason.match(/\[PRICE:([\d.]+)\]/);
      if (priceMatch) {
        unitPrice = parseFloat(priceMatch[1]) || unitPrice;
        cleanReason = cleanReason.replace(priceMatch[0], "").trim();
      }
      // Bill tag like [CHD-1202] (not system tags like [INVOICE_ADJUSTED])
      const bracketMatch = reason.match(/\[([A-Z]{1,6}-\d+)\]/);
      if (invoiceNo === "-" && bracketMatch) {
        invoiceNo = bracketMatch[1];
      }
    }

    return { invoiceNo, unitPrice, cleanReason };
  };

  // 1. Fetch Pending Approvals
  const fetchPendingReturns = useCallback(async () => {
    setPendingLoading(true);
    try {
      const res = await fetch("/api/inventory/returns?status=Pending&limit=all");
      if (!res.ok) throw new Error("Failed to load pending returns");
      const data = await res.json();
      setPendingReturns(data.data || []);
    } catch (e) {
      console.error(e);
      toast.error("Error loading pending return approvals");
    } finally {
      setPendingLoading(false);
    }
  }, []);

  // 2. Fetch Returns History
  const fetchHistoryReturns = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: pageSize.toString(),
        status: "Approved,Completed,Rejected",
        businessId: BUSINESS_IDS.CHAMPIKA_DISTRIBUTION,
        withBills: "true",
      });

      if (searchQuery) params.append("search", searchQuery);
      if (startDate) params.append("startDate", startDate);
      if (endDate) params.append("endDate", endDate);

      const res = await fetch(`/api/inventory/returns?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to load returns history");

      const data = await res.json();
      setHistoryReturns(data.data || []);
      setTotalPages(data.totalPages || 1);
      setTotalRecords(data.total || 0);
    } catch (e) {
      console.error(e);
      toast.error("Error loading returns history");
    } finally {
      setHistoryLoading(false);
    }
  }, [page, searchQuery, startDate, endDate]);

  useEffect(() => {
    fetchPendingReturns();
  }, [fetchPendingReturns]);

  useEffect(() => {
    if (activeTab === "history") {
      fetchHistoryReturns();
    }
  }, [activeTab, fetchHistoryReturns]);

  // Effect to handle Date Filter Presets
  useEffect(() => {
    const now = new Date();
    if (dateFilterType === "this_month") {
      setStartDate(format(startOfMonth(now), "yyyy-MM-dd"));
      setEndDate(format(endOfMonth(now), "yyyy-MM-dd"));
    } else if (dateFilterType === "last_month") {
      const lastMonth = subMonths(now, 1);
      setStartDate(format(startOfMonth(lastMonth), "yyyy-MM-dd"));
      setEndDate(format(endOfMonth(lastMonth), "yyyy-MM-dd"));
    } else if (dateFilterType === "all") {
      setStartDate("");
      setEndDate("");
    }
    setPage(1);
  }, [dateFilterType]);

  // Approve Handler
  const handleApproveReturn = async () => {
    if (!approvingReturn) return;
    setActionProcessing(true);
    try {
      const res = await fetch(`/api/inventory/returns/${approvingReturn.id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve" }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Approval failed");

      toast.success(
        `Return Note ${approvingReturn.return_number} approved! ${approvingReturn?.return_type === "Exchange" ? "Exchange sent to Approved Orders — process the replacement items (no payment needed)." : "Routed directly to Loading so driver can collect items from customer."}`
      );

      setApprovingReturn(null);
      fetchPendingReturns();
      if (activeTab === "history") fetchHistoryReturns();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to approve return note");
    } finally {
      setActionProcessing(false);
    }
  };

  // Reject Handler
  const handleRejectReturn = async () => {
    if (!rejectingReturn) return;
    setActionProcessing(true);
    try {
      const res = await fetch(`/api/inventory/returns/${rejectingReturn.id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reject",
          rejection_reason: rejectionReason,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Rejection failed");

      toast.success(`Return Note ${rejectingReturn.return_number} rejected.`);
      setRejectingReturn(null);
      setRejectionReason("");
      fetchPendingReturns();
      if (activeTab === "history") fetchHistoryReturns();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to reject return note");
    } finally {
      setActionProcessing(false);
    }
  };

  // Delete & Reverse Handler
  const handleDeleteReturn = async () => {
    if (!deletingReturn) return;
    try {
      setDeleting(true);
      const res = await fetch(`/api/inventory/returns/${deletingReturn.id}`, {
        method: "DELETE",
      });

      const responseData = await res.json();
      if (!res.ok) {
        throw new Error(responseData.error || "Failed to delete return");
      }

      toast.success("Return record deleted and stock reversed successfully");
      setDeletingReturn(null);
      fetchHistoryReturns();
    } catch (error: any) {
      toast.error(error.message || "Error deleting return");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push("/dashboard/office/distribution/inventory")}
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
              <Undo2 className="h-7 w-7 text-green-700" />
              Returns Management &amp; Approvals
            </h1>
          </div>
          <p className="text-muted-foreground mt-1 ml-10 text-xs sm:text-sm">
            Review and approve customer return notes submitted by Sales Reps, manage stock credits, and inspect return logs.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => {
              fetchPendingReturns();
              if (activeTab === "history") fetchHistoryReturns();
            }}
            size="sm"
            className="gap-1.5"
          >
            <RefreshCw
              className={cn("w-4 h-4", (pendingLoading || historyLoading) && "animate-spin")}
            />
            Refresh
          </Button>
          <Button
            size="sm"
            className="bg-green-700 hover:bg-green-800 text-white font-semibold"
            onClick={() =>
              router.push("/dashboard/office/distribution/inventory/returns/create")
            }
          >
            <Undo2 className="w-4 h-4 mr-2" /> Direct Office Return
          </Button>
        </div>
      </div>

      {/* Main Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={(v: any) => setActiveTab(v)}
        className="space-y-4"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-3">
          <TabsList className="bg-gray-100 p-1">
            <TabsTrigger value="pending" className="text-xs sm:text-sm font-semibold relative pr-7">
              Pending Approvals
              {pendingReturns.length > 0 && (
                <span className="ml-1.5 px-1.5 py-0.2 bg-amber-600 text-white rounded-full text-[11px] font-bold">
                  {pendingReturns.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="history" className="text-xs sm:text-sm font-semibold">
              Returns History ({totalRecords})
            </TabsTrigger>
          </TabsList>
        </div>

        {/* ── TAB 1: PENDING APPROVALS ────────────────────────────────────── */}
        <TabsContent value="pending" className="space-y-4 mt-0">
          <Card className="border-amber-200/80 shadow-sm">
            <CardHeader className="py-3 px-4 bg-amber-50/40 border-b flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-bold text-amber-950 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-600" />
                  Rep Return Notes Awaiting Approval ({pendingReturns.length})
                </CardTitle>
                <CardDescription className="text-xs text-amber-800">
                  Verify customer purchases, invoice prices, and approve for stock adjustment or damage exchange loading.
                </CardDescription>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50 text-[11px] uppercase tracking-wider text-gray-500 font-semibold">
                      <TableHead>Return # / Date</TableHead>
                      <TableHead>Sales Rep</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Original Bill</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead>Condition</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Unit Rate</TableHead>
                      <TableHead className="text-right">Total (LKR)</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingLoading ? (
                      <TableRow>
                        <TableCell colSpan={10} className="text-center py-14">
                          <Loader2 className="w-7 h-7 animate-spin mx-auto text-amber-600 mb-2" />
                          <p className="text-xs text-gray-500">Checking pending return notes...</p>
                        </TableCell>
                      </TableRow>
                    ) : pendingReturns.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={10} className="text-center py-12 text-gray-400">
                          <CheckCircle2 className="w-9 h-9 mx-auto mb-2 text-emerald-500 opacity-60" />
                          <p className="text-sm font-semibold text-gray-700">All caught up!</p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            No return notes currently pending office review.
                          </p>
                        </TableCell>
                      </TableRow>
                    ) : (
                      pendingReturns.map((r) => {
                        const { invoiceNo, unitPrice, cleanReason } = parseReasonMetadata(
                          r.reason,
                          r.products?.selling_price
                        );
                        const totalVal =
                          Math.round(Number(r.quantity || 0) * unitPrice * 100) / 100;
                        const dateStr = (r.return_date || r.created_at || "").split("T")[0];

                        return (
                          <TableRow key={r.id} className="text-xs hover:bg-amber-50/20">
                            <TableCell>
                              <div className="font-mono font-bold text-gray-900">
                                {r.return_number}
                              </div>
                              <div className="text-[11px] text-gray-400 font-mono">{dateStr}</div>
                            </TableCell>
                            <TableCell>
                              <span className="font-semibold text-gray-800">
                                {r.profiles?.full_name || "Sales Rep"}
                              </span>
                            </TableCell>
                            <TableCell>
                              <div className="font-semibold text-gray-900">
                                {r.customers?.shop_name || "Unknown"}
                              </div>
                              {r.customers?.route && (
                                <div className="text-[11px] text-gray-500">{r.customers.route}</div>
                              )}
                            </TableCell>
                            <TableCell>
                              {invoiceNo !== "-" ? (
                                <span className="font-mono font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                                  {invoiceNo}
                                </span>
                              ) : (
                                <span className="text-gray-400 font-mono text-xs">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="font-medium text-gray-900 line-clamp-1">
                                {r.products?.name}
                              </div>
                              <div className="text-[11px] text-gray-400 font-mono">
                                {r.products?.sku}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={cn(
                                  "text-[10px]",
                                  r.return_type === "Good"
                                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                    : r.return_type === "Damage"
                                    ? "bg-red-50 text-red-700 border-red-200"
                                    : "bg-blue-50 text-blue-700 border-blue-200"
                                )}
                              >
                                {r.return_type === "Good"
                                  ? "Good Stock"
                                  : r.return_type === "Damage"
                                  ? "Damaged Stock"
                                  : "Damage Exchange"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right font-bold text-gray-900">
                              {r.quantity} {r.products?.unit_of_measure || ""}
                            </TableCell>
                            <TableCell className="text-right font-mono text-gray-700">
                              LKR {unitPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </TableCell>
                            <TableCell className="text-right font-mono font-bold text-emerald-800">
                              LKR {totalVal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                                  onClick={() => {
                                    setRejectingReturn(r);
                                    setRejectionReason("");
                                  }}
                                >
                                  Reject
                                </Button>
                                <Button
                                  size="sm"
                                  className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                                  onClick={() => setApprovingReturn(r)}
                                >
                                  Accept &amp; Approve
                                </Button>
                              </div>
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
        </TabsContent>

        {/* ── TAB 2: RETURNS HISTORY ──────────────────────────────────────── */}
        <TabsContent value="history" className="space-y-4 mt-0">
          {/* Filters Card */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-col md:flex-row gap-4 items-end">
                {/* Search */}
                <div className="flex-1 w-full">
                  <span className="text-xs font-semibold text-gray-600 mb-1 block">
                    Search Returns
                  </span>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Search by Return #, reason, customer..."
                      className="pl-9 text-xs sm:text-sm"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          setPage(1);
                          fetchHistoryReturns();
                        }
                      }}
                    />
                  </div>
                </div>

                {/* Date Preset Filter */}
                <div className="w-full md:w-48">
                  <span className="text-xs font-semibold text-gray-600 mb-1 block">Period</span>
                  <Select value={dateFilterType} onValueChange={setDateFilterType}>
                    <SelectTrigger className="text-xs">
                      <SelectValue placeholder="Select Period" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Time</SelectItem>
                      <SelectItem value="this_month">This Month</SelectItem>
                      <SelectItem value="last_month">Last Month</SelectItem>
                      <SelectItem value="custom">Custom Range</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Custom Date Range */}
                <div className="flex gap-2 w-full md:w-auto">
                  <div>
                    <span className="text-xs font-semibold text-gray-600 mb-1 block">From</span>
                    <Input
                      type="date"
                      value={startDate}
                      onChange={(e) => {
                        setStartDate(e.target.value);
                        setDateFilterType("custom");
                      }}
                      className="w-full md:w-36 text-xs"
                    />
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-gray-600 mb-1 block">To</span>
                    <Input
                      type="date"
                      value={endDate}
                      onChange={(e) => {
                        setEndDate(e.target.value);
                        setDateFilterType("custom");
                      }}
                      className="w-full md:w-36 text-xs"
                    />
                  </div>
                </div>

                <Button
                  size="sm"
                  onClick={() => {
                    setPage(1);
                    fetchHistoryReturns();
                  }}
                  className="gap-1 text-xs"
                >
                  <Filter className="w-3.5 h-3.5" /> Apply
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Returns History Table */}
          <Card>
            <CardHeader className="py-3 px-4 border-b flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-bold text-gray-900">
                  Approved &amp; Processed Returns History
                </CardTitle>
                <CardDescription className="text-xs">
                  Showing {historyReturns.length} records (Page {page} of {totalPages})
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="border-b overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50 text-[11px] uppercase tracking-wider text-gray-500 font-semibold">
                      <TableHead>Return #</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Original Bill</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Condition</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Total (LKR)</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {historyLoading ? (
                      <TableRow>
                        <TableCell colSpan={11} className="text-center py-16">
                          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                        </TableCell>
                      </TableRow>
                    ) : historyReturns.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={11}
                          className="text-center py-8 text-muted-foreground text-xs"
                        >
                          No returns found matching your filters.
                        </TableCell>
                      </TableRow>
                    ) : (
                      historyReturns.map((r: any) => {
                        const { invoiceNo, unitPrice } = parseReasonMetadata(
                          r.reason,
                          r.products?.selling_price
                        );
                        // Applied returns store the exact amount taken off the bill
                        const creditTag = (r.reason || "").match(/\[CREDIT:([\d.]+)\]/);
                        const totalVal = creditTag ? parseFloat(creditTag[1]) :
                          Math.round(Number(r.quantity || 0) * unitPrice * 100) / 100;

                        return (
                          <TableRow key={r.id} className="text-xs hover:bg-gray-50/70">
                            <TableCell className="font-mono font-bold text-gray-900">
                              {r.return_number}
                            </TableCell>
                            <TableCell className="text-gray-500 font-mono text-[11px]">
                              {new Date(r.created_at).toLocaleDateString()}
                            </TableCell>
                            <TableCell>
                              <div className="font-semibold text-gray-900">
                                {r.customers?.shop_name || (r.return_type === "Damage" ? "Warehouse Damage (No Customer)" : "No Customer")}
                              </div>
                              {r.customers?.route && (
                                <div className="text-[11px] text-gray-500">{r.customers.route}</div>
                              )}
                            </TableCell>
                            <TableCell>
                              {(() => {
                                const billNo =
                                  invoiceNo !== "-" ? invoiceNo : r.purchase_invoice_no || null;
                                const settledNo =
                                  r.settled_invoice_no && r.settled_invoice_no !== billNo
                                    ? r.settled_invoice_no
                                    : null;
                                if (!billNo && !settledNo) {
                                  return <span className="text-gray-400 font-mono text-xs">-</span>;
                                }
                                const billHref = (no: string) =>
                                  r.invoice_ids?.[no]
                                    ? `/dashboard/office/distribution/invoices/${r.invoice_ids[no]}`
                                    : null;
                                const deducted = (r.reason || "").includes("[INVOICE_ADJUSTED]");
                                return (
                                  <div className="space-y-1">
                                    {billNo && (() => {
                                      const href = billHref(billNo);
                                      const cls =
                                        "inline-block font-mono font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200";
                                      const title =
                                        invoiceNo !== "-"
                                          ? "Bill selected on the return — click to open"
                                          : "Customer's latest bill for this product — click to open";
                                      return href ? (
                                        <Link href={href} className={cn(cls, "hover:bg-blue-100 hover:underline")} title={title}>
                                          {billNo}
                                        </Link>
                                      ) : (
                                        <span className={cls} title={title}>{billNo}</span>
                                      );
                                    })()}
                                    {deducted && (
                                      <div className="text-[10px] text-emerald-700 font-medium">Deducted from bill</div>
                                    )}
                                    {settledNo && (
                                      <div className="text-[10px] text-emerald-700 font-medium">
                                        Deducted from{" "}
                                        {billHref(settledNo) ? (
                                          <Link href={billHref(settledNo)!} className="font-mono font-semibold hover:underline">
                                            {settledNo}
                                          </Link>
                                        ) : (
                                          <span className="font-mono font-semibold">{settledNo}</span>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                );
                              })()}
                            </TableCell>
                            <TableCell>
                              <div className="font-medium text-gray-900">{r.products?.name}</div>
                              <div className="text-[11px] text-gray-400 font-mono">
                                {r.products?.sku}
                              </div>
                            </TableCell>
                            <TableCell className="text-gray-600">
                              {r.locations?.name || "Main Warehouse"}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={cn(
                                  "text-[10px]",
                                  r.return_type === "Good"
                                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                    : r.return_type === "Damage"
                                    ? "bg-red-50 text-red-700 border-red-200"
                                    : "bg-blue-50 text-blue-700 border-blue-200"
                                )}
                              >
                                {r.return_type === "Good"
                                  ? "Good Stock"
                                  : r.return_type === "Damage"
                                  ? "Damaged"
                                  : "Damage Exchange"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right font-bold text-gray-900">
                              {r.quantity}
                            </TableCell>
                            <TableCell className="text-right font-mono font-bold text-emerald-800">
                              LKR {totalVal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </TableCell>
                            <TableCell className="text-center">
                              {r.status === "Approved" || r.status === "Completed" ? (
                                <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 font-semibold text-[10px]">
                                  Approved
                                </Badge>
                              ) : r.status === "Rejected" ? (
                                <Badge className="bg-red-100 text-red-800 border-red-300 font-semibold text-[10px]">
                                  Rejected
                                </Badge>
                              ) : (
                                <Badge variant="outline">{r.status}</Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-red-600 hover:text-red-800 hover:bg-red-50"
                                title="Delete & Reverse Return"
                                onClick={() => setDeletingReturn(r)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex items-center justify-end space-x-2 p-3">
                  <div className="text-xs text-muted-foreground mr-4">
                    Total: {totalRecords} records
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
                    disabled={page === 1}
                  >
                    <ChevronLeft className="h-3.5 w-3.5" /> Previous
                  </Button>
                  <div className="text-xs font-medium">
                    Page {page} of {totalPages}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => setPage((prev) => Math.min(prev + 1, totalPages))}
                    disabled={page === totalPages}
                  >
                    Next <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ── APPROVE CONFIRMATION DIALOG ─────────────────────────────────── */}
      <Dialog
        open={!!approvingReturn}
        onOpenChange={(open) => {
          if (!open) setApprovingReturn(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-emerald-700">
              <CheckCircle2 className="h-5 w-5" /> Accept &amp; Approve Return Note
            </DialogTitle>
            <DialogDescription className="text-xs">
              Review verified price, customer bill details, and confirm stock update.
            </DialogDescription>
          </DialogHeader>

          {approvingReturn && (
            <div className="p-3.5 rounded-lg border bg-gray-50/70 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-500">Return Note #:</span>
                <span className="font-mono font-bold text-gray-900">
                  {approvingReturn.return_number}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Customer:</span>
                <span className="font-semibold text-gray-900">
                  {approvingReturn.customers?.shop_name || "Unknown"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Product:</span>
                <span className="font-medium text-gray-900">
                  {approvingReturn.products?.name} ({approvingReturn.products?.sku})
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Return Condition:</span>
                <Badge variant="outline" className="text-[10px] font-semibold">
                  {approvingReturn.return_type === "Exchange"
                    ? "Damage Exchange"
                    : approvingReturn.return_type === "Good"
                    ? "Good Stock"
                    : "Damaged Stock"}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Quantity &amp; Verified Rate:</span>
                <span className="font-mono font-bold text-gray-900">
                  {approvingReturn.quantity} units @ LKR{" "}
                  {parseReasonMetadata(
                    approvingReturn.reason,
                    approvingReturn.products?.selling_price
                  ).unitPrice.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between pt-1 border-t">
                <span className="font-bold text-gray-700">Total Return Value:</span>
                <span className="font-mono font-bold text-emerald-800 text-sm">
                  LKR{" "}
                  {(
                    Number(approvingReturn.quantity || 0) *
                    parseReasonMetadata(
                      approvingReturn.reason,
                      approvingReturn.products?.selling_price
                    ).unitPrice
                  ).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>

              {/* Special Exchange Notice */}
              {approvingReturn.return_type === "Exchange" && (
                <div className="p-2.5 rounded bg-blue-50 border border-blue-200 mt-2 flex items-start gap-2 text-[11px] text-blue-900">
                  <Truck className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                  <div>
                    <strong>Scenario 2 (Damage Exchange):</strong> Approving will automatically generate an exchange replacement order in <strong>Checking &amp; Loading</strong> so warehouse staff load the item onto the lorry and print it on the Loading Summary!
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="gap-2 sm:justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setApprovingReturn(null)}
              disabled={actionProcessing}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs"
              onClick={handleApproveReturn}
              disabled={actionProcessing}
            >
              {actionProcessing ? (
                <>
                  <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> Processing...
                </>
              ) : (
                "Confirm & Approve"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── REJECT CONFIRMATION DIALOG ──────────────────────────────────── */}
      <Dialog
        open={!!rejectingReturn}
        onOpenChange={(open) => {
          if (!open) {
            setRejectingReturn(null);
            setRejectionReason("");
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <XCircle className="h-5 w-5" /> Reject Return Note
            </DialogTitle>
            <DialogDescription className="text-xs">
              Provide a reason for rejecting return note{" "}
              <strong className="font-mono">{rejectingReturn?.return_number}</strong>.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-1">
            <span className="text-xs font-semibold text-gray-700 block">
              Rejection Reason / Notes *
            </span>
            <Textarea
              placeholder="e.g., Invoiced price mismatch, warranty expired, product not received in warehouse..."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              className="text-xs min-h-[80px]"
            />
          </div>

          <DialogFooter className="gap-2 sm:justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setRejectingReturn(null);
                setRejectionReason("");
              }}
              disabled={actionProcessing}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleRejectReturn}
              disabled={actionProcessing}
              className="text-xs font-semibold"
            >
              {actionProcessing ? (
                <>
                  <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> Rejecting...
                </>
              ) : (
                "Confirm Rejection"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── DELETE / REVERSE CONFIRMATION DIALOG ────────────────────────── */}
      <Dialog
        open={!!deletingReturn}
        onOpenChange={(open) => {
          if (!open) setDeletingReturn(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <RotateCcw className="h-5 w-5" /> Delete &amp; Reverse Return?
            </DialogTitle>
            <DialogDescription className="text-xs">
              Are you sure you want to delete return record{" "}
              <strong className="font-mono">{deletingReturn?.return_number}</strong>?
              <br />
              This will automatically reverse {deletingReturn?.quantity} unit(s) of{" "}
              <strong>{deletingReturn?.products?.name}</strong> from stock.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDeletingReturn(null)}
              disabled={deleting}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDeleteReturn}
              disabled={deleting}
              className="text-xs font-semibold"
            >
              {deleting ? (
                <>
                  <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> Reversing...
                </>
              ) : (
                "Delete & Reverse"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
