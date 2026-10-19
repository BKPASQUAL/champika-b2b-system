// app/dashboard/admin/orders/loading/history/page.tsx
"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ArrowLeft,
  Truck,
  Search,
  Filter,
  Loader2,
  Package,
  Calendar,
  RefreshCw,
  Printer,
  Download,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  FileText,
  Share2,
} from "lucide-react";
import { toast } from "sonner";
import {
  downloadLoadingSheet,
  printLoadingSheet,
  printLoadingOutstandingReport,
  downloadLoadingOutstandingReport,
  shareLoadingOutstandingReport,
} from "./print-loading-sheet";

interface OrderRow {
  id: string;
  orderId: string;
  invoiceId?: string | null;
  invoiceNo: string | null;
  totalAmount: number;
}

interface LoadingHistory {
  id: string;
  loadId: string;
  loadingDate: string;
  lorryNumber: string;
  driverName: string;
  helperName: string;
  status: string;
  totalOrders: number;
  totalAmount: number;
  orders: OrderRow[];
  createdAt: string;
}

export default function DeliveryHistoryPage() {
  const router = useRouter();

  const [history, setHistory] = useState<LoadingHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [printingId, setPrintingId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 10;

  const fetchHistory = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/orders/loading/history");
      if (!res.ok) throw new Error("Failed to fetch delivery history");
      setHistory(await res.json());
    } catch {
      toast.error("Failed to load delivery history");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  const handlePrint = async (e: React.MouseEvent, loadId: string) => {
    e.stopPropagation();
    if (printingId || downloadingId) return;
    setPrintingId(loadId);
    await printLoadingSheet(loadId);
    setPrintingId(null);
  };

  const handleDownload = async (e: React.MouseEvent, loadId: string) => {
    e.stopPropagation();
    if (printingId || downloadingId) return;
    setDownloadingId(loadId);
    await downloadLoadingSheet(loadId);
    setDownloadingId(null);
  };

  const toggleExpand = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const filteredHistory = history.filter((load) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      load.loadId.toLowerCase().includes(q) ||
      load.lorryNumber.toLowerCase().includes(q) ||
      load.driverName.toLowerCase().includes(q) ||
      load.orders?.some(
        (o) =>
          o.orderId.toLowerCase().includes(q) ||
          (o.invoiceNo && o.invoiceNo.toLowerCase().includes(q))
      );
    const matchesStatus =
      statusFilter === "all" || load.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalPages = Math.max(1, Math.ceil(filteredHistory.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const pagedHistory = filteredHistory.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const totalLoads = history.length;
  const inTransitCount = history.filter((l) => l.status === "In Transit").length;
  const completedCount = history.filter((l) => l.status === "Completed").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Delivery History</h1>
          <p className="text-muted-foreground">
            View all generated loading sheets and delivery loads.
          </p>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Loads</CardTitle>
            <Truck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalLoads}</div>
            <p className="text-xs text-muted-foreground mt-1">All time</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">In Transit</CardTitle>
            <Package className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{inTransitCount}</div>
            <p className="text-xs text-muted-foreground mt-1">Currently on delivery</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <Calendar className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{completedCount}</div>
            <p className="text-xs text-muted-foreground mt-1">Successfully delivered</p>
          </CardContent>
        </Card>
      </div>

      {/* Table Card */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-1 items-center gap-2">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search Load ID, Vehicle, or Driver..."
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                  className="pl-9"
                />
              </div>
              <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setCurrentPage(1); }}>
                <SelectTrigger className="w-[180px]">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Filter Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="In Transit">In Transit</SelectItem>
                  <SelectItem value="Completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" size="icon" onClick={fetchHistory} title="Refresh">
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-10" />
                  <TableHead>Load ID</TableHead>
                  <TableHead>Dispatched Date</TableHead>
                  <TableHead>Vehicle</TableHead>
                  <TableHead>Driver</TableHead>
                  <TableHead className="text-center">Orders</TableHead>
                  <TableHead className="text-right">Total Amount</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-12">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
                    </TableCell>
                  </TableRow>
                ) : filteredHistory.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">
                      <div className="flex flex-col items-center gap-2">
                        <Truck className="h-12 w-12 text-muted-foreground/30" />
                        <p className="font-medium">No delivery history found</p>
                        <p className="text-sm">Deliveries will appear here once loading sheets are created</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  pagedHistory.map((load) => {
                    const isExpanded = expandedIds.has(load.id);
                    return (
                      <React.Fragment key={load.id}>
                        <TableRow
                          className="hover:bg-muted/50 cursor-pointer group"
                          onClick={() => router.push(`/dashboard/admin/orders/loading/history/${load.id}`)}
                        >
                          <TableCell onClick={(e) => toggleExpand(e, load.id)} className="pl-3">
                            {isExpanded
                              ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                              : <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground" />
                            }
                          </TableCell>
                          <TableCell className="font-medium font-mono">
                            {load.loadId}
                          </TableCell>
                          <TableCell>
                            {new Date(load.loadingDate).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{load.lorryNumber}</Badge>
                          </TableCell>
                          <TableCell>{load.driverName}</TableCell>
                          <TableCell className="text-center">
                            <Badge variant="secondary">{load.totalOrders}</Badge>
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            LKR {load.totalAmount.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge
                              variant="outline"
                              className={
                                load.status === "In Transit"
                                  ? "bg-blue-50 text-blue-700 border-blue-200"
                                  : "bg-green-50 text-green-700 border-green-200"
                              }
                            >
                              {load.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={(e) => handlePrint(e, load.id)}
                                disabled={printingId === load.id}
                                title="Print Loading Sheet"
                              >
                                {printingId === load.id
                                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  : <Printer className="w-3.5 h-3.5" />
                                }
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={(e) => handleDownload(e, load.id)}
                                disabled={downloadingId === load.id}
                                title="Download Loading Sheet"
                              >
                                {downloadingId === load.id
                                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  : <Download className="w-3.5 h-3.5" />
                                }
                              </Button>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                                    <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => printLoadingOutstandingReport(load.id)}>
                                    <Printer className="h-4 w-4 mr-2" />
                                    Print Outstanding Invoices
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => downloadLoadingOutstandingReport(load.id)}>
                                    <Download className="h-4 w-4 mr-2" />
                                    Download Outstanding Invoices (PDF)
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => shareLoadingOutstandingReport(load.id)}>
                                    <Share2 className="h-4 w-4 mr-2" />
                                    Share Outstanding Invoices
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </TableCell>
                        </TableRow>

                        {/* Inline Expandable Rows */}
                        {isExpanded && (
                          <TableRow className="bg-muted/20 hover:bg-muted/20 border-b">
                            <TableCell colSpan={9} className="py-2 px-6">
                              <div className="text-xs space-y-1">
                                <span className="font-semibold text-muted-foreground uppercase tracking-wide">
                                  Invoices in this Load ({load.orders?.length ?? 0}):
                                </span>
                                {load.orders && load.orders.length > 0 ? (
                                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 pt-1">
                                    {load.orders.map((o) => {
                                      const hasInvoice = Boolean(o.invoiceId);
                                      return (
                                        <div
                                          key={o.id}
                                          className={`flex items-center justify-between p-2 rounded border bg-white text-xs ${
                                            hasInvoice
                                              ? "cursor-pointer hover:border-blue-300 hover:bg-blue-50/50"
                                              : "cursor-default opacity-80"
                                          }`}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            if (hasInvoice) {
                                              window.open(`/dashboard/admin/invoices/${o.invoiceId}`, "_blank");
                                            } else {
                                              toast.error("Invoice details not available");
                                            }
                                          }}
                                          title={hasInvoice ? "Click to view invoice details" : "No invoice details"}
                                        >
                                          <div>
                                            <p className="font-mono font-bold text-slate-800">
                                              {o.invoiceNo || "No Inv No"}
                                            </p>
                                            <p className="text-[10px] text-muted-foreground font-mono">
                                              {o.orderId}
                                            </p>
                                          </div>
                                          <span className="font-semibold text-slate-900">
                                            LKR {o.totalAmount.toLocaleString()}
                                          </span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  <p className="text-muted-foreground">No order details available.</p>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-2 pt-4">
              <p className="text-sm text-muted-foreground">
                Showing {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filteredHistory.length)} of {filteredHistory.length} loads
              </p>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={safePage === 1}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((p) => p === 1 || p === totalPages || Math.abs(p - safePage) <= 1)
                  .reduce<(number | "…")[]>((acc, p, idx, arr) => {
                    if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push("…");
                    acc.push(p);
                    return acc;
                  }, [])
                  .map((p, i) =>
                    p === "…" ? (
                      <span key={`ellipsis-${i}`} className="px-1 text-muted-foreground text-sm">…</span>
                    ) : (
                      <Button
                        key={p}
                        variant={safePage === p ? "default" : "outline"}
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setCurrentPage(p as number)}
                      >
                        {p}
                      </Button>
                    )
                  )}
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={safePage === totalPages}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
