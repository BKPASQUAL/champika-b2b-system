// app/dashboard/admin/orders/pending/page.tsx
"use client";

import React, { useState, useMemo, useEffect, useCallback } from "react";
import { useCachedFetch } from "@/hooks/useCachedFetch";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  ArrowRight,
  Loader2,
  User,
  Calendar,
  FileText,
  AlertCircle,
  Download,
  Printer,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  MapPin,
  Undo2,
  CheckCircle2,
  XCircle,
  Sparkles,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Order, SortField, SortOrder } from "@/app/dashboard/office/distribution/orders/types";
import {
  downloadLoadingSummary,
  printLoadingSummary,
} from "@/app/dashboard/office/distribution/orders/loading/print-loading-summary";
import { printBulkInvoices } from "@/app/lib/invoice-print";

interface ParsedReturnMeta {
  invoiceNo: string;
  unitPrice: number;
  noteCode: string;
  cleanReason: string;
}

const parseReturnMetadata = (
  reason?: string | null,
  fallbackPrice?: number
): ParsedReturnMeta => {
  let invoiceNo = "-";
  let unitPrice = fallbackPrice || 0;
  let noteCode = "";
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
    const noteMatch = reason.match(/\[NOTE:([^\]]+)\]/);
    if (noteMatch) {
      noteCode = noteMatch[1];
      cleanReason = cleanReason.replace(noteMatch[0], "").trim();
    }
    const batchMatch = reason.match(/\[BATCH:([^\]]+)\]/);
    if (batchMatch) {
      cleanReason = cleanReason.replace(batchMatch[0], "").trim();
    }
    const bracketMatch = reason.match(/\[([A-Z0-9_-]+)\]/);
    if (
      invoiceNo === "-" &&
      bracketMatch &&
      !bracketMatch[1].startsWith("PRICE:") &&
      !bracketMatch[1].startsWith("NOTE:") &&
      !bracketMatch[1].startsWith("BATCH:")
    ) {
      invoiceNo = bracketMatch[1];
    }
  }

  return { invoiceNo, unitPrice, noteCode, cleanReason };
};

export interface UnifiedPendingItem {
  id: string;
  isReturn: boolean;
  orderId: string;
  invoiceNo: string;
  invoiceId?: string;
  customerName: string;
  shopName: string;
  salesRep: string;
  itemCount: number;
  totalAmount: number;
  status: string;
  date: string;
  route: string;
  notes?: string | null;
  returnType?: "Good" | "Damage" | "Exchange";
  originalBillNo?: string;
  productName?: string;
  productSku?: string;
  unitOfMeasure?: string;
  unitRate?: number;
  rawReturn?: any;
}

export default function PendingOrdersPage() {
  const router = useRouter();

  // 1. Fetch Orders
  const {
    data: rawOrders = [],
    loading: ordersLoading,
    refetch: refetchOrders,
  } = useCachedFetch<Order[]>(
    "/api/orders?status=Pending",
    [],
    () => toast.error("Failed to load orders")
  );

  // 2. Fetch Returns
  const [pendingReturns, setPendingReturns] = useState<any[]>([]);
  const [returnsLoading, setReturnsLoading] = useState(false);

  const fetchPendingReturns = useCallback(async () => {
    setReturnsLoading(true);
    try {
      const res = await fetch("/api/inventory/returns?status=Pending&limit=all");
      if (res.ok) {
        const json = await res.json();
        setPendingReturns(json.data || []);
      }
    } catch (err) {
      console.error("Failed to load pending returns:", err);
    } finally {
      setReturnsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPendingReturns();
  }, [fetchPendingReturns]);

  // Filters State
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [selectedRep, setSelectedRep] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("admin_pending_selectedRep") ?? "all";
    }
    return "all";
  });

  useEffect(() => {
    localStorage.setItem("admin_pending_selectedRep", selectedRep);
  }, [selectedRep]);

  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDirection, setSortDirection] = useState<SortOrder>("desc");

  // Modal Dialog states for Return Note Review & Rejection
  const [checkingReturn, setCheckingReturn] = useState<any | null>(null);
  const [rejectingReturn, setRejectingReturn] = useState<any | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [actionProcessing, setActionProcessing] = useState(false);

  // Combine Orders and Returns into Unified List
  const unifiedItems: UnifiedPendingItem[] = useMemo(() => {
    const list: UnifiedPendingItem[] = [];

    // Map Orders
    rawOrders.forEach((o) => {
      list.push({
        id: o.id,
        isReturn: false,
        orderId: o.orderId,
        invoiceNo: (o as any).invoiceNo || "N/A",
        invoiceId: o.invoiceId,
        customerName: o.customerName || "Customer",
        shopName: o.shopName || "Unknown",
        salesRep: o.salesRep || "Unassigned",
        itemCount: o.itemCount || 1,
        totalAmount: o.totalAmount || 0,
        status: o.status || "Pending",
        date: o.date || new Date().toISOString(),
        route: o.route || "General",
        notes: o.notes,
      });
    });

    // Map Returns
    pendingReturns.forEach((r) => {
      const meta = parseReturnMetadata(r.reason, r.products?.selling_price);
      const totalLine = Number(r.quantity || 1) * meta.unitPrice;

      list.push({
        id: r.id,
        isReturn: true,
        orderId: r.return_number,
        invoiceNo: r.return_number,
        customerName: r.customers?.owner_name || r.customers?.shop_name || "Customer",
        shopName: r.customers?.shop_name || "Unknown Shop",
        salesRep: r.profiles?.full_name || "Sales Rep",
        itemCount: Number(r.quantity || 1),
        totalAmount: totalLine,
        status: "Pending",
        date: r.return_date || r.created_at || new Date().toISOString(),
        route: r.customers?.route || "General",
        notes: meta.cleanReason,
        returnType: r.return_type || "Good",
        originalBillNo: meta.invoiceNo && meta.invoiceNo !== "-" ? meta.invoiceNo : undefined,
        productName: r.products?.name || "Product",
        productSku: r.products?.sku,
        unitOfMeasure: r.products?.unit_of_measure || "Pcs",
        unitRate: meta.unitPrice,
        rawReturn: r,
      });
    });

    return list;
  }, [rawOrders, pendingReturns]);

  // Unique sales reps derived from loaded orders & returns
  const salesReps = useMemo(() => {
    const names = Array.from(
      new Set(unifiedItems.map((o) => o.salesRep).filter(Boolean))
    );
    return names.sort();
  }, [unifiedItems]);

  const activeRep = useMemo(() => {
    if (!selectedRep || selectedRep === "all") return "all";
    if (salesReps.includes(selectedRep)) return selectedRep;
    return "all";
  }, [selectedRep, salesReps]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return <ArrowUpDown className="h-3.5 w-3.5 ml-1 opacity-40" />;
    return sortDirection === "asc" ? (
      <ArrowUp className="h-3.5 w-3.5 ml-1" />
    ) : (
      <ArrowDown className="h-3.5 w-3.5 ml-1" />
    );
  };

  const filteredOrders = useMemo(() => {
    const searchLower = searchQuery.toLowerCase().trim();
    return unifiedItems
      .filter((order) => {
        const invoiceMatch = order.invoiceNo
          ? order.invoiceNo.toLowerCase().includes(searchLower)
          : false;
        const textMatch =
          !searchLower ||
          invoiceMatch ||
          order.orderId.toLowerCase().includes(searchLower) ||
          order.shopName.toLowerCase().includes(searchLower) ||
          order.customerName.toLowerCase().includes(searchLower) ||
          (order.productName?.toLowerCase().includes(searchLower) ?? false) ||
          (order.originalBillNo?.toLowerCase().includes(searchLower) ?? false);
        const repMatch =
          activeRep === "all" || order.salesRep === activeRep;
        const cancelReqMatch =
          order.isReturn || !order.notes?.includes("[CANCEL_REQUEST:");
        return textMatch && repMatch && cancelReqMatch;
      })
      .sort((a, b) => {
        let cmp = 0;
        switch (sortField) {
          case "date":
            cmp = new Date(a.date).getTime() - new Date(b.date).getTime();
            break;
          case "invoiceNo":
            cmp = (a.invoiceNo || "").localeCompare(b.invoiceNo || "");
            break;
          case "customerName":
            cmp = a.shopName.localeCompare(b.shopName);
            break;
          case "totalAmount":
            cmp = a.totalAmount - b.totalAmount;
            break;
          default:
            cmp = new Date(a.date).getTime() - new Date(b.date).getTime();
        }
        return sortDirection === "asc" ? cmp : -cmp;
      });
  }, [unifiedItems, searchQuery, activeRep, sortField, sortDirection]);

  const totalAmount = useMemo(
    () => filteredOrders.reduce((sum, o) => sum + o.totalAmount, 0),
    [filteredOrders]
  );

  const repTotals = useMemo(() => {
    const map: Record<string, number> = {};
    filteredOrders.forEach((o) => {
      if (o.salesRep) map[o.salesRep] = (map[o.salesRep] || 0) + o.totalAmount;
    });
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
  }, [filteredOrders]);

  const selectedTotal = useMemo(
    () =>
      filteredOrders
        .filter((o) => selectedOrders.includes(o.id))
        .reduce((sum, o) => sum + o.totalAmount, 0),
    [filteredOrders, selectedOrders]
  );

  // Group already-sorted filteredOrders by route, routes sorted alphabetically
  const groupedOrders = useMemo(() => {
    const groups: Record<string, UnifiedPendingItem[]> = {};
    filteredOrders.forEach((order) => {
      const key = order.route || "General";
      if (!groups[key]) groups[key] = [];
      groups[key].push(order);
    });
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [filteredOrders]);

  const toggleSelect = (id: string) =>
    setSelectedOrders((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );

  const toggleSelectAll = () =>
    setSelectedOrders(
      selectedOrders.length === filteredOrders.length
        ? []
        : filteredOrders.map((o) => o.id)
    );

  // Return actions: Approve
  const handleApproveReturn = async (ret: any) => {
    setActionProcessing(true);
    try {
      const res = await fetch(`/api/inventory/returns/${ret.id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Approval failed");

      toast.success(
        `Return Note ${ret.return_number} approved! ${ret?.return_type === "Exchange" ? "Exchange sent to Approved Orders — process the replacement items (no payment needed)." : "Routed directly to Loading so driver can collect items from customer."}`
      );
      setCheckingReturn(null);
      setSelectedOrders((prev) => prev.filter((id) => id !== ret.id));
      fetchPendingReturns();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to approve return note");
    } finally {
      setActionProcessing(false);
    }
  };

  // Return actions: Reject
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
      setSelectedOrders((prev) => prev.filter((id) => id !== rejectingReturn.id));
      fetchPendingReturns();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to reject return note");
    } finally {
      setActionProcessing(false);
    }
  };

  if (ordersLoading && returnsLoading) {
    return (
      <div className="flex justify-center items-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="">
      {/* Header Section */}
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between mb-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Pending Orders</h1>
          <p className="text-muted-foreground text-sm">
            Orders waiting for approval or processing.
          </p>
        </div>
        <div className="flex flex-col items-start md:items-end gap-2">
          {filteredOrders.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 py-1.5 px-3 bg-slate-50 rounded-lg border border-slate-100 text-xs">
              <div className="flex items-center gap-1.5 font-semibold text-slate-700 shrink-0">
                <span>{filteredOrders.length} order{filteredOrders.length !== 1 ? "s" : ""}</span>
                <span className="text-slate-400">·</span>
                <span className="text-slate-900">LKR {totalAmount.toLocaleString()}</span>
              </div>
              {repTotals.length > 0 && (
                <>
                  <div className="w-px h-4 bg-slate-200 mx-0.5" />
                  {repTotals.map(([rep, total]) => (
                    <span
                      key={rep}
                      className="flex items-center gap-1 bg-white border border-slate-200 rounded-full px-2 py-0.5"
                    >
                      <User className="h-3 w-3 text-orange-400 shrink-0" />
                      <span className="text-slate-600">{rep}:</span>
                      <span className="font-semibold text-slate-800">
                        LKR {total.toLocaleString()}
                      </span>
                    </span>
                  ))}
                </>
              )}
              {selectedOrders.length > 0 && (
                <>
                  <div className="w-px h-4 bg-slate-200 mx-0.5" />
                  <span className="flex items-center gap-1 bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-full px-2 py-0.5 font-semibold shrink-0">
                    Selected {selectedOrders.length}: LKR {selectedTotal.toLocaleString()}
                  </span>
                </>
              )}
            </div>
          )}
          {selectedOrders.length > 0 && (
            <div className="flex gap-2 animate-in fade-in zoom-in duration-300">
              <Button
                variant="outline"
                onClick={() => {
                  const invoiceIds = filteredOrders
                    .filter((o) => !o.isReturn && selectedOrders.includes(o.id) && o.invoiceId)
                    .map((o) => o.invoiceId as string);
                  if (invoiceIds.length === 0) {
                    toast.error("No invoices found for the selected orders.");
                    return;
                  }
                  printBulkInvoices(invoiceIds, "distribution");
                }}
                className="bg-white border-slate-200"
              >
                <Printer className="w-4 h-4 mr-2" />
                Print Invoices ({selectedOrders.length})
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  const selectedOrderIds = filteredOrders
                    .filter((o) => !o.isReturn && selectedOrders.includes(o.id))
                    .map((o) => o.id);
                  if (selectedOrderIds.length === 0) {
                    toast.error("Select orders to generate summary");
                    return;
                  }
                  printLoadingSummary(selectedOrderIds, {
                    title: "PENDING ORDERS — ITEMS SUMMARY REPORT",
                  });
                }}
                className="bg-white border-slate-200"
              >
                <Printer className="w-4 h-4 mr-2" />
                Print Summary ({selectedOrders.length})
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  const selectedOrderIds = filteredOrders
                    .filter((o) => !o.isReturn && selectedOrders.includes(o.id))
                    .map((o) => o.id);
                  if (selectedOrderIds.length === 0) {
                    toast.error("Select orders to download summary");
                    return;
                  }
                  downloadLoadingSummary(selectedOrderIds, {
                    title: "PENDING ORDERS — ITEMS SUMMARY REPORT",
                    filePrefix: "Pending_Summary",
                  });
                }}
                className="bg-white border-slate-200"
              >
                <Download className="w-4 h-4 mr-2" />
                Download Summary ({selectedOrders.length})
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Main Content Card */}
      <Card className="border-0 sm:border shadow-none sm:shadow-sm bg-transparent sm:bg-card">
        <CardHeader className="px-0 sm:px-6 pb-2 pt-2">
          <div className="flex flex-col gap-2">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search Invoice, Order ID or Shop..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 bg-white border-slate-200"
                />
              </div>
              {/* Sort Field */}
              <Select value={sortField} onValueChange={(v) => setSortField(v as SortField)}>
                <SelectTrigger className="w-full sm:w-40 bg-white border-slate-200">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="date">Date</SelectItem>
                  <SelectItem value="invoiceNo">Invoice No</SelectItem>
                  <SelectItem value="customerName">Shop Name</SelectItem>
                  <SelectItem value="totalAmount">Total Amount</SelectItem>
                </SelectContent>
              </Select>
              {/* Sort Direction */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSortDirection((d) => (d === "asc" ? "desc" : "asc"))}
                className="bg-white border-slate-200 gap-1.5 shrink-0"
              >
                {sortDirection === "desc" ? (
                  <><ArrowDown className="h-3.5 w-3.5" /> Desc</>
                ) : (
                  <><ArrowUp className="h-3.5 w-3.5" /> Asc</>
                )}
              </Button>
            </div>

            {/* Sales Rep filter pills */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                onClick={() => setSelectedRep("all")}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${
                  activeRep === "all"
                    ? "bg-slate-800 text-white border-slate-800"
                    : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"
                }`}
              >
                All
              </button>
              {salesReps.map((rep) => (
                <button
                  key={rep}
                  onClick={() => setSelectedRep(activeRep === rep ? "all" : rep)}
                  className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium border transition-all ${
                    activeRep === rep
                      ? "bg-orange-600 text-white border-orange-600"
                      : "bg-white text-orange-700 border-orange-200 hover:border-orange-400 hover:bg-orange-50"
                  }`}
                >
                  <User className="h-3 w-3" />
                  {rep}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>

        <CardContent className="px-0 sm:px-6 pt-0">
          {/* --- MOBILE VIEW --- */}
          <div className="flex flex-col gap-3 md:hidden">
            {filteredOrders.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground bg-slate-50 rounded-lg border border-dashed">
                <div className="flex flex-col items-center justify-center">
                  <AlertCircle className="h-10 w-10 text-muted-foreground/20 mb-3" />
                  <p>No pending orders found.</p>
                </div>
              </div>
            ) : (
              groupedOrders.map(([routeName, routeOrders]) => (
                <React.Fragment key={routeName}>
                  {/* Route group header */}
                  <div className="flex items-center gap-2 px-1 pt-1">
                    <MapPin className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                    <span className="text-xs font-bold text-blue-800 uppercase tracking-wide">{routeName}</span>
                    <span className="text-xs text-blue-500 ml-auto">{routeOrders.length} order{routeOrders.length !== 1 ? "s" : ""}</span>
                  </div>

                  {routeOrders.map((order) => {
                    const isSelected = selectedOrders.includes(order.id);
                    return (
                      <div
                        key={order.id}
                        className={`bg-white border rounded-xl p-4 shadow-sm flex flex-col gap-3 transition-all duration-200 ${
                          order.isReturn
                            ? "border-amber-200 bg-amber-50/15"
                            : isSelected
                            ? "border-yellow-400 ring-1 ring-yellow-400 bg-yellow-50/10"
                            : "border-slate-200"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleSelect(order.id)}
                            className="mt-1"
                          />
                          <div
                            className="flex-1 min-w-0 cursor-pointer"
                            onClick={() => {
                              if (order.isReturn) router.push(`/dashboard/admin/inventory/returns/${order.id}`);
                              else router.push(`/dashboard/admin/orders/${order.id}`);
                            }}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                {order.isReturn ? (
                                  <div className="flex items-center gap-1 font-mono font-bold text-amber-800 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded text-xs">
                                    <Undo2 className="h-3 w-3" />
                                    {order.invoiceNo}
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1 font-mono font-bold text-yellow-700 bg-yellow-50 px-2 py-0.5 rounded text-xs">
                                    <FileText className="h-3 w-3" />
                                    {order.invoiceNo || "N/A"}
                                  </div>
                                )}

                                {order.isReturn ? (
                                  <Badge className="bg-amber-100 text-amber-900 border-amber-200 text-[10px] px-1.5 py-0 font-semibold">
                                    Return Note
                                  </Badge>
                                ) : (
                                  <span className="text-[10px] text-muted-foreground font-mono">
                                    ({order.orderId})
                                  </span>
                                )}
                              </div>

                              <Badge
                                variant="outline"
                                className="bg-yellow-50 text-yellow-700 border-yellow-200 shrink-0"
                              >
                                Pending
                              </Badge>
                            </div>

                            <div className="flex justify-between items-start gap-2 mt-1">
                              <div className="flex flex-col min-w-0">
                                <p className="text-sm font-bold text-slate-900 truncate">
                                  {order.shopName}
                                </p>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                  <Calendar className="h-3 w-3" />
                                  {new Date(order.date).toLocaleDateString()}
                                </div>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0 bg-slate-50 border border-slate-100 text-slate-600 px-2 py-1 rounded text-xs font-medium">
                                <User className="h-3 w-3" />
                                <span>{order.salesRep}</span>
                              </div>
                            </div>

                            {order.isReturn && order.productName && (
                              <div className="bg-white/80 p-2 rounded border border-amber-200 mt-2 text-xs">
                                <p className="font-medium text-slate-900">{order.productName}</p>
                                <div className="flex items-center justify-between text-[11px] text-slate-600 mt-1">
                                  <span>Qty: {order.itemCount} {order.unitOfMeasure}</span>
                                  {order.originalBillNo && (
                                    <span className="font-mono text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                                      Bill: {order.originalBillNo}
                                    </span>
                                  )}
                                </div>
                              </div>
                            )}

                            <div className="grid grid-cols-2 gap-2 text-sm border-t pt-2 mt-2">
                              <div>
                                <p className="text-xs text-muted-foreground">Items</p>
                                <p className="font-medium">{order.itemCount}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-xs text-muted-foreground">Total Amount</p>
                                <p className="font-bold text-slate-900">
                                  LKR {order.totalAmount.toLocaleString()}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>

                        <Button
                          size="sm"
                          className="w-full mt-1 bg-yellow-600 hover:bg-yellow-700 text-white h-9"
                          disabled={selectedOrders.length > 0 && !selectedOrders.includes(order.id)}
                          onClick={() => {
                            if (order.isReturn) router.push(`/dashboard/admin/inventory/returns/${order.id}`);
                            else router.push(`/dashboard/admin/orders/${order.id}`);
                          }}
                        >
                          Process Order <ArrowRight className="ml-2 h-3 w-3" />
                        </Button>
                      </div>
                    );
                  })}
                </React.Fragment>
              ))
            )}
          </div>

          {/* --- DESKTOP VIEW --- */}
          <div className="hidden md:block rounded-md border bg-white overflow-hidden">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="w-[50px]">
                    <Checkbox
                      checked={
                        filteredOrders.length > 0 &&
                        selectedOrders.length === filteredOrders.length
                      }
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead
                    className="w-[100px] cursor-pointer hover:bg-slate-100 select-none"
                    onClick={() => handleSort("date")}
                  >
                    <div className="flex items-center">Date {getSortIcon("date")}</div>
                  </TableHead>
                  <TableHead
                    className="cursor-pointer hover:bg-slate-100 select-none"
                    onClick={() => handleSort("invoiceNo")}
                  >
                    <div className="flex items-center">Invoice No {getSortIcon("invoiceNo")}</div>
                  </TableHead>
                  <TableHead
                    className="cursor-pointer hover:bg-slate-100 select-none"
                    onClick={() => handleSort("customerName")}
                  >
                    <div className="flex items-center">Customer / Shop {getSortIcon("customerName")}</div>
                  </TableHead>
                  <TableHead>Sales Rep</TableHead>
                  <TableHead className="text-right">Items</TableHead>
                  <TableHead
                    className="text-right cursor-pointer hover:bg-slate-100 select-none"
                    onClick={() => handleSort("totalAmount")}
                  >
                    <div className="flex items-center justify-end">Total Amount {getSortIcon("totalAmount")}</div>
                  </TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOrders.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={9}
                      className="text-center py-12 text-muted-foreground"
                    >
                      <div className="flex flex-col items-center justify-center">
                        <AlertCircle className="h-12 w-12 text-muted-foreground/20 mb-4" />
                        <p>No pending orders found.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  groupedOrders.map(([routeName, routeOrders]) => (
                    <React.Fragment key={routeName}>
                      {/* Route divider row */}
                      <TableRow className="bg-blue-50 hover:bg-blue-50 border-t-2 border-blue-100">
                        <TableCell colSpan={9} className="py-2 px-4">
                          <div className="flex items-center gap-2">
                            <MapPin className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                            <span className="text-xs font-bold text-blue-800 uppercase tracking-wide">
                              {routeName}
                            </span>
                            <span className="text-xs text-blue-500 font-normal">
                              — {routeOrders.length} order{routeOrders.length !== 1 ? "s" : ""}
                            </span>
                          </div>
                        </TableCell>
                      </TableRow>

                      {routeOrders.map((order) => (
                        <TableRow
                          key={order.id}
                          className={`hover:bg-slate-50 ${
                            selectedOrders.includes(order.id)
                              ? "bg-yellow-50/30"
                              : order.isReturn
                              ? "bg-amber-50/20"
                              : ""
                          }`}
                        >
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              checked={selectedOrders.includes(order.id)}
                              onCheckedChange={() => toggleSelect(order.id)}
                            />
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-muted-foreground text-xs">
                            {new Date(order.date).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            {order.isReturn ? (
                              <div className="flex flex-col">
                                <span className="font-medium font-mono text-amber-800 text-xs flex items-center gap-1">
                                  <Undo2 className="h-3 w-3 text-amber-600 shrink-0" />
                                  {order.invoiceNo}
                                </span>
                                <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                                  <Badge className="bg-amber-100 text-amber-900 border-amber-300 text-[10px] px-1 py-0 font-semibold">
                                    Return Note
                                  </Badge>
                                  {order.originalBillNo && (
                                    <span className="text-[10px] font-mono text-blue-700 bg-blue-50 border border-blue-200 px-1 rounded">
                                      {order.originalBillNo}
                                    </span>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <div className="flex flex-col">
                                <span className="font-medium font-mono text-yellow-700 text-xs flex items-center gap-1">
                                  <FileText className="h-3 w-3" />
                                  {order.invoiceNo || "N/A"}
                                </span>
                                <span className="text-[10px] text-muted-foreground font-mono">
                                  {order.orderId}
                                </span>
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="font-medium text-sm text-slate-900">
                                {order.shopName}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {order.customerName}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">{order.salesRep}</TableCell>
                          <TableCell className="text-right text-sm">
                            {order.isReturn ? (
                              <div className="flex flex-col items-end">
                                <span className="font-medium">{order.itemCount} Pcs</span>
                                {order.returnType && (
                                  <span className="text-[10px] text-muted-foreground">
                                    {order.returnType}
                                  </span>
                                )}
                              </div>
                            ) : (
                              order.itemCount
                            )}
                          </TableCell>
                          <TableCell className="text-right font-semibold text-sm">
                            LKR {order.totalAmount.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge
                              variant="outline"
                              className={
                                order.isReturn
                                  ? "bg-amber-50 text-amber-800 border-amber-300"
                                  : "bg-yellow-50 text-yellow-700 border-yellow-200"
                              }
                            >
                              Pending
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              className="bg-yellow-600 hover:bg-yellow-700 text-white h-8 text-xs font-semibold"
                              disabled={selectedOrders.length > 0 && !selectedOrders.includes(order.id)}
                              onClick={() => {
                                if (order.isReturn) router.push(`/dashboard/admin/inventory/returns/${order.id}`);
                                else router.push(`/dashboard/admin/orders/${order.id}`);
                              }}
                            >
                              Process <ArrowRight className="ml-1 h-3 w-3" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </React.Fragment>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* ========================================================================= */}
      {/* ── MODAL: CHECK & ACCEPT RETURN NOTE ──────────────────────────────────── */}
      {/* ========================================================================= */}
      <Dialog
        open={!!checkingReturn}
        onOpenChange={(open) => !open && setCheckingReturn(null)}
      >
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-lg">
                  Check & Accept Return Note
                </DialogTitle>
                <DialogDescription className="text-xs">
                  Review original invoice, item condition, and approve stock & credit actions.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {checkingReturn && (
            <div className="space-y-4 py-2">
              {/* Customer & Invoice Overview Card */}
              <div className="grid grid-cols-2 gap-3 p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs">
                <div>
                  <span className="text-muted-foreground block text-[10px] uppercase font-bold tracking-wider">
                    Customer / Shop
                  </span>
                  <p className="font-bold text-slate-900 text-sm mt-0.5">
                    {checkingReturn.customers?.shop_name || "Unknown"}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    Route: {checkingReturn.customers?.route || "General"}
                  </p>
                </div>

                <div>
                  <span className="text-muted-foreground block text-[10px] uppercase font-bold tracking-wider">
                    Sales Rep / Requester
                  </span>
                  <p className="font-semibold text-slate-800 text-sm mt-0.5">
                    {checkingReturn.profiles?.full_name || "Unknown"}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    Date:{" "}
                    {new Date(
                      checkingReturn.return_date || checkingReturn.created_at
                    ).toLocaleDateString()}
                  </p>
                </div>

                <div className="col-span-2 border-t pt-2 mt-1 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground text-xs">Original Bill:</span>
                    {(() => {
                      const meta = parseReturnMetadata(
                        checkingReturn.reason,
                        checkingReturn.products?.selling_price
                      );
                      return meta.invoiceNo && meta.invoiceNo !== "-" ? (
                        <span className="font-mono font-bold text-xs bg-blue-100 text-blue-800 border border-blue-200 px-2 py-0.5 rounded">
                          {meta.invoiceNo}
                        </span>
                      ) : (
                        <span className="text-xs italic text-muted-foreground">
                          General Product Return
                        </span>
                      );
                    })()}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="text-muted-foreground text-xs">Return ID:</span>
                    <span className="font-mono font-bold text-xs text-slate-900">
                      {checkingReturn.return_number}
                    </span>
                  </div>
                </div>
              </div>

              {/* Item Details Card */}
              <div className="p-3.5 border rounded-xl space-y-2 bg-white">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-bold text-sm text-slate-900">
                      {checkingReturn.products?.name}
                    </p>
                    <p className="text-xs font-mono text-muted-foreground">
                      SKU: {checkingReturn.products?.sku || "N/A"}
                    </p>
                  </div>

                  {checkingReturn.return_type === "Good" ? (
                    <Badge className="bg-emerald-100 text-emerald-900 border-emerald-300 font-semibold">
                      Good Return
                    </Badge>
                  ) : checkingReturn.return_type === "Damage" ? (
                    <Badge className="bg-rose-100 text-rose-900 border-rose-300 font-semibold">
                      Damaged Stock
                    </Badge>
                  ) : (
                    <Badge className="bg-purple-100 text-purple-900 border-purple-300 font-semibold">
                      Damage Exchange
                    </Badge>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2 border-t pt-2 mt-2 text-xs">
                  <div>
                    <span className="text-muted-foreground block text-[10px]">Quantity</span>
                    <p className="font-bold text-slate-900 text-sm">
                      {checkingReturn.quantity}{" "}
                      {checkingReturn.products?.unit_of_measure || "Pcs"}
                    </p>
                  </div>

                  <div>
                    <span className="text-muted-foreground block text-[10px]">Verified Rate</span>
                    {(() => {
                      const meta = parseReturnMetadata(
                        checkingReturn.reason,
                        checkingReturn.products?.selling_price
                      );
                      return (
                        <p className="font-mono font-semibold text-slate-800 text-sm">
                          LKR {meta.unitPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </p>
                      );
                    })()}
                  </div>

                  <div className="text-right">
                    <span className="text-muted-foreground block text-[10px]">Total Value</span>
                    {(() => {
                      const meta = parseReturnMetadata(
                        checkingReturn.reason,
                        checkingReturn.products?.selling_price
                      );
                      const totalVal =
                        Number(checkingReturn.quantity || 0) * meta.unitPrice;
                      return (
                        <p className="font-mono font-bold text-emerald-700 text-sm">
                          LKR {totalVal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </p>
                      );
                    })()}
                  </div>
                </div>

                {/* Reason string */}
                {(() => {
                  const meta = parseReturnMetadata(
                    checkingReturn.reason,
                    checkingReturn.products?.selling_price
                  );
                  return meta.cleanReason ? (
                    <div className="bg-slate-50 p-2 rounded text-xs text-slate-700 border border-slate-100 mt-2">
                      <span className="font-semibold text-slate-500 mr-1">Remarks:</span>
                      {meta.cleanReason}
                    </div>
                  ) : null;
                })()}
              </div>

              {/* Workflow Impact Notification Box */}
              <div
                className={`p-3 rounded-xl border text-xs ${
                  checkingReturn.return_type === "Exchange"
                    ? "bg-purple-50/70 border-purple-200 text-purple-950"
                    : checkingReturn.return_type === "Good"
                    ? "bg-emerald-50/70 border-emerald-200 text-emerald-950"
                    : "bg-rose-50/70 border-rose-200 text-rose-950"
                }`}
              >
                <p className="font-bold flex items-center gap-1.5 mb-1">
                  <Sparkles className="h-4 w-4" />
                  What happens when you accept:
                </p>
                {checkingReturn.return_type === "Good" && (
                  <ul className="list-disc list-inside space-y-0.5 text-xs text-emerald-900">
                    <li>
                      <strong>Inventory</strong>: {checkingReturn.quantity} {checkingReturn.products?.unit_of_measure || "Pcs"} will be added directly into Main Warehouse <strong>Good Stock</strong>.
                    </li>
                    <li>
                      <strong>Finance</strong>: Return credit note will be issued for customer balance & payment entry settlement.
                    </li>
                  </ul>
                )}
                {checkingReturn.return_type === "Damage" && (
                  <ul className="list-disc list-inside space-y-0.5 text-xs text-rose-900">
                    <li>
                      <strong>Inventory</strong>: {checkingReturn.quantity} {checkingReturn.products?.unit_of_measure || "Pcs"} will be recorded into Main Warehouse <strong>Damaged Inventory</strong>.
                    </li>
                    <li>
                      <strong>Finance</strong>: Return credit note will be issued for customer balance & payment entry settlement.
                    </li>
                  </ul>
                )}
                {checkingReturn.return_type === "Exchange" && (
                  <ul className="list-disc list-inside space-y-0.5 text-xs text-purple-900">
                    <li>
                      <strong>Lorry Dispatch</strong>: An Exchange delivery order will be <strong>automatically placed into Checking & Loading</strong> for immediate delivery dispatch!
                    </li>
                    <li>
                      <strong>Inventory</strong>: Defective unit will be logged into Damaged stock. Customer bill balance remains intact.
                    </li>
                  </ul>
                )}
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => {
                const ret = checkingReturn;
                setCheckingReturn(null);
                setRejectingReturn(ret);
              }}
              disabled={actionProcessing}
              className="border-rose-200 text-rose-700 hover:bg-rose-50 text-xs"
            >
              Reject Return...
            </Button>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                onClick={() => setCheckingReturn(null)}
                disabled={actionProcessing}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                onClick={() => handleApproveReturn(checkingReturn)}
                disabled={actionProcessing}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-4"
              >
                {actionProcessing ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                ) : (
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                )}
                Accept & Approve Return
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* ── MODAL: REJECT RETURN NOTE ──────────────────────────────────────────── */}
      {/* ========================================================================= */}
      <Dialog
        open={!!rejectingReturn}
        onOpenChange={(open) => !open && setRejectingReturn(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                <XCircle className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-lg">Reject Return Note</DialogTitle>
                <DialogDescription className="text-xs">
                  Provide a reason for rejecting return note {rejectingReturn?.return_number}.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <p className="text-xs text-muted-foreground">
              Rejecting will mark this return note as <strong>Rejected</strong> and no stock or balance adjustments will be made.
            </p>
            <Textarea
              placeholder="Enter rejection reason (e.g. Item not from specified invoice, defect not verified, etc.)..."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              className="text-xs"
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRejectingReturn(null)}
              disabled={actionProcessing}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleRejectReturn}
              disabled={actionProcessing}
              className="text-xs font-semibold"
            >
              {actionProcessing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
              ) : (
                <XCircle className="h-3.5 w-3.5 mr-1.5" />
              )}
              Confirm Rejection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
