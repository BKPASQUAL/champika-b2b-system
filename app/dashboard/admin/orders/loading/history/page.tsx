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
  Printer, // Icon for Print
  Download, // Icon for Download
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { downloadLoadingSheet, printLoadingSheet } from "./print-loading-sheet";
// Import both print functions


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
  orderIds: string[];
  createdAt: string;
}

export default function DeliveryHistoryPage() {
  const router = useRouter();

  const [history, setHistory] = useState<LoadingHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Track loading states for specific rows
  const [printingId, setPrintingId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  // Fetch history data
  const fetchHistory = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/orders/loading/history");
      if (!res.ok) throw new Error("Failed to fetch delivery history");
      const data = await res.json();
      setHistory(data);
    } catch (error) {
      console.error(error);
      toast.error("Failed to load delivery history");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  // Handle Print (Direct)
  const handlePrint = async (e: React.MouseEvent, loadId: string) => {
    e.stopPropagation(); // Prevent row click
    if (printingId || downloadingId) return;

    setPrintingId(loadId);
    await printLoadingSheet(loadId);
    setPrintingId(null);
  };

  // Handle Download (File)
  const handleDownload = async (e: React.MouseEvent, loadId: string) => {
    e.stopPropagation(); // Prevent row click
    if (printingId || downloadingId) return;

    setDownloadingId(loadId);
    await downloadLoadingSheet(loadId);
    setDownloadingId(null);
  };

  // Filter logic
  const filteredHistory = history.filter((load) => {
    const matchesSearch =
      load.loadId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      load.lorryNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      load.driverName.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus =
      statusFilter === "all" || load.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  // Calculate stats
  const totalLoads = history.length;
  const inTransitCount = history.filter(
    (l) => l.status === "In Transit"
  ).length;
  const completedCount = history.filter((l) => l.status === "Completed").length;
  const totalOrdersDelivered = history.reduce(
    (sum, load) => sum + load.totalOrders,
    0
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight">
            Loading Deliveries
          </h1>
          <p className="text-muted-foreground mt-1">
            History of dispatched delivery loads.
          </p>
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={fetchHistory}
          title="Refresh"
        >
          <RefreshCw className={loading ? "animate-spin" : ""} />
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Loads</CardTitle>
            <Truck className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalLoads}</div>
            <p className="text-xs text-muted-foreground mt-1">
              All time deliveries
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">In Transit</CardTitle>
            <Truck className="w-4 h-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {inTransitCount}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Currently delivering
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <Package className="w-4 h-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {completedCount}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Successfully delivered
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
            <Package className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalOrdersDelivered}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Orders delivered
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <CardTitle>Recent Deliveries</CardTitle>
            <div className="flex gap-2">
              <div className="relative flex-1 md:w-[300px]">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search Load ID, Vehicle, or Driver..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Filter Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="In Transit">In Transit</SelectItem>
                  <SelectItem value="Completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Load ID</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Vehicle</TableHead>
                  <TableHead>Responsible Person</TableHead>
                  <TableHead className="text-center">Orders</TableHead>
                  <TableHead className="text-right">Total Value</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12">
                      <div className="flex justify-center items-center gap-2 text-muted-foreground">
                        <Loader2 className="h-5 w-5 animate-spin" />
                        Loading delivery history...
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filteredHistory.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="text-center py-12 text-muted-foreground"
                    >
                      <div className="flex flex-col items-center gap-2">
                        <Truck className="h-12 w-12 text-muted-foreground/30" />
                        <p className="font-medium">No delivery history found</p>
                        <p className="text-sm">
                          Deliveries will appear here once loading sheets are
                          created
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredHistory.map((load) => (
                    <TableRow
                      key={load.id}
                      className="hover:bg-muted/50 cursor-pointer group"
                      onClick={() =>
                        router.push(
                          `/dashboard/admin/orders/loading/history/${load.id}`
                        )
                      }
                    >
                      <TableCell className="font-medium font-mono">
                        {load.loadId}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-muted-foreground" />
                          {new Date(load.loadingDate).toLocaleDateString(
                            "en-US",
                            {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            }
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Truck className="w-4 h-4 text-muted-foreground" />
                          <span className="font-medium">
                            {load.lorryNumber}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary">
                            {load.driverName.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex flex-col">
                            <span className="text-sm font-medium">
                              {load.driverName}
                            </span>
                            {load.helperName && (
                              <span className="text-xs text-muted-foreground">
                                + {load.helperName}
                              </span>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="font-semibold">
                          {load.totalOrders}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        Rs. {load.totalAmount.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge
                          variant={
                            load.status === "Completed"
                              ? "default"
                              : "secondary"
                          }
                          className={
                            load.status === "Completed"
                              ? "bg-green-600 hover:bg-green-700"
                              : "bg-blue-600 hover:bg-blue-700 text-white"
                          }
                        >
                          {load.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end items-center gap-1">
                          {/* Print Button */}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                            onClick={(e) => handlePrint(e, load.id)}
                            disabled={
                              printingId === load.id ||
                              downloadingId === load.id
                            }
                            title="Print Sheet"
                          >
                            {printingId === load.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Printer className="w-4 h-4" />
                            )}
                          </Button>

                          {/* Download Button */}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                            onClick={(e) => handleDownload(e, load.id)}
                            disabled={
                              printingId === load.id ||
                              downloadingId === load.id
                            }
                            title="Download PDF"
                          >
                            {downloadingId === load.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Download className="w-4 h-4" />
                            )}
                          </Button>

                          {/* View Indicator */}
                          <ChevronRight className="w-4 h-4 text-muted-foreground/30 group-hover:text-muted-foreground transition-colors ml-1" />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
