// app/dashboard/office/distribution/orders/loading/history/page.tsx
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
  Printer,
  Download,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { downloadLoadingSheet, printLoadingSheet } from "./print-loading-sheet";
import { BUSINESS_IDS } from "@/app/config/business-constants";

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

export default function DistributionDeliveryHistoryPage() {
  const router = useRouter();
  const distributionBusinessId = BUSINESS_IDS.CHAMPIKA_DISTRIBUTION;

  const [history, setHistory] = useState<LoadingHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [printingId, setPrintingId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(
        `/api/orders/loading/history?businessId=${distributionBusinessId}`
      );
      if (!res.ok) throw new Error("Failed to fetch delivery history");
      const data = await res.json();
      setHistory(data);
    } catch (error) {
      console.error(error);
      toast.error("Failed to load delivery history");
    } finally {
      setLoading(false);
    }
  }, [distributionBusinessId]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

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

  const filteredHistory = history.filter((load) => {
    const matchesSearch =
      load.loadId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      load.lorryNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      load.driverName.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus =
      statusFilter === "all" || load.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

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
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() =>
            router.push("/dashboard/office/distribution/orders/loading")
          }
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight text-blue-900">
            Distribution Deliveries
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

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Loads</CardTitle>
            <Truck className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalLoads}</div>
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
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
            <Package className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalOrdersDelivered}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <CardTitle>Recent Deliveries</CardTitle>
            <div className="flex gap-2">
              <div className="relative flex-1 md:w-[300px]">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search Load ID..."
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
                  <TableHead>Driver</TableHead>
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
                      <Loader2 className="h-5 w-5 animate-spin mx-auto" />
                    </TableCell>
                  </TableRow>
                ) : filteredHistory.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="text-center py-12 text-muted-foreground"
                    >
                      No history found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredHistory.map((load) => (
                    <TableRow
                      key={load.id}
                      className="hover:bg-muted/50 cursor-pointer group"
                      onClick={() =>
                        router.push(
                          `/dashboard/office/distribution/orders/loading/history/${load.id}`
                        )
                      }
                    >
                      <TableCell className="font-medium font-mono">
                        {load.loadId}
                      </TableCell>
                      <TableCell>
                        {new Date(load.loadingDate).toLocaleDateString()}
                      </TableCell>
                      <TableCell>{load.lorryNumber}</TableCell>
                      <TableCell>{load.driverName}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline">{load.totalOrders}</Badge>
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
                        >
                          {load.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => handlePrint(e, load.id)}
                            disabled={!!printingId}
                          >
                            {printingId === load.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Printer className="w-4 h-4 text-blue-600" />
                            )}
                          </Button>
                          <ChevronRight className="w-4 h-4 text-muted-foreground" />
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
