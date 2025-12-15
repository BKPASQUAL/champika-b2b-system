// app/dashboard/office/distribution/orders/loading/history/[id]/page.tsx
"use client";

import React, { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  Loader2,
  Printer,
  Download,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Send,
} from "lucide-react";
import { toast } from "sonner";
import {
  downloadLoadingSheet,
  printLoadingSheet,
} from "@/app/dashboard/admin/orders/loading/history/print-loading-sheet";

interface OrderDetail {
  id: string;
  orderId: string;
  invoiceNo: string;
  totalAmount: number;
  originalAmount?: number;
  status: string;
  customer: {
    shopName: string;
    ownerName: string;
    phone: string;
    address: string;
    route: string;
  };
  salesRep: { name: string };
}

interface LoadingSheetDetail {
  id: string;
  loadId: string;
  lorryNumber: string;
  driverId: string;
  driverName: string;
  helperName: string;
  loadingDate: string;
  status: string;
  createdAt: string;
  totalOrders: number;
  totalAmount: number;
  totalItems: number;
  orders: OrderDetail[];
}

export default function DistributionLoadingSheetDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const [loadingSheet, setLoadingSheet] = useState<LoadingSheetDetail | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [printing, setPrinting] = useState(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    const fetchDetails = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/orders/loading/history/${id}`);
        if (!res.ok) throw new Error("Failed to fetch loading sheet");
        const data = await res.json();
        setLoadingSheet(data);
      } catch (error) {
        console.error(error);
        toast.error("Failed to load loading sheet details");
      } finally {
        setLoading(false);
      }
    };
    fetchDetails();
  }, [id]);

  const handlePrint = async () => {
    if (!loadingSheet) return;
    setPrinting(true);
    await printLoadingSheet(loadingSheet.id);
    setPrinting(false);
  };

  const handleDownload = async () => {
    if (!loadingSheet) return;
    setDownloading(true);
    await downloadLoadingSheet(loadingSheet.id);
    setDownloading(false);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Delivered":
        return (
          <Badge className="bg-green-600 hover:bg-green-700">
            <CheckCircle2 className="w-3 h-3 mr-1" /> Delivered
          </Badge>
        );
      case "Cancelled":
        return (
          <Badge className="bg-red-600 hover:bg-red-700">
            <XCircle className="w-3 h-3 mr-1" /> Returned
          </Badge>
        );
      case "Loading":
        return (
          <Badge className="bg-orange-500 hover:bg-orange-600">
            <RefreshCw className="w-3 h-3 mr-1" /> Rescheduled
          </Badge>
        );
      case "In Transit":
        return (
          <Badge className="bg-blue-500 hover:bg-blue-600">
            <Send className="w-3 h-3 mr-1" /> In Transit
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center h-[calc(100vh-200px)]">
        <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground animate-pulse">
          Loading details...
        </p>
      </div>
    );
  }

  if (!loadingSheet) return <div>Not found</div>;

  const totalSentValue = loadingSheet.orders.reduce(
    (sum, o) => sum + (o.originalAmount || o.totalAmount || 0),
    0
  );
  const totalFinalValue = loadingSheet.orders.reduce(
    (sum, o) => sum + (o.totalAmount || 0),
    0
  );
  const totalDiff = totalFinalValue - totalSentValue;

  return (
    <div className="space-y-6 pb-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
              Loading Sheet
              <Badge className="text-base font-mono px-3">
                {loadingSheet.loadId}
              </Badge>
            </h1>
            <p className="text-muted-foreground mt-1">
              Created on{" "}
              {new Date(loadingSheet.createdAt).toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </p>
          </div>
        </div>

        <div className="flex gap-2 flex-wrap">
          <Button
            variant="outline"
            onClick={handleDownload}
            disabled={downloading}
          >
            {downloading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Download className="w-4 h-4 mr-2" />
            )}
            Download
          </Button>
          <Button variant="default" onClick={handlePrint} disabled={printing}>
            {printing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Printer className="w-4 h-4 mr-2" />
            )}
            Print
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Sent Value (Original)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              Rs. {totalSentValue.toLocaleString()}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-blue-600">
              Final Value (Reconciled)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-700">
              Rs. {totalFinalValue.toLocaleString()}
            </div>
          </CardContent>
        </Card>

        <Card
          className={
            totalDiff !== 0
              ? totalDiff > 0
                ? "bg-green-50 border-green-200"
                : "bg-red-50 border-red-200"
              : ""
          }
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Difference
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold flex items-center gap-2 ${
                totalDiff > 0
                  ? "text-green-700"
                  : totalDiff < 0
                  ? "text-red-700"
                  : ""
              }`}
            >
              {totalDiff > 0 ? "+" : ""}
              {totalDiff !== 0 ? "Rs. " + totalDiff.toLocaleString() : "-"}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Info Grids */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Vehicle & Personnel</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between border-b pb-2">
              <span className="text-muted-foreground">Vehicle</span>
              <span className="font-medium">{loadingSheet.lorryNumber}</span>
            </div>
            <div className="flex justify-between border-b pb-2">
              <span className="text-muted-foreground">Driver</span>
              <span className="font-medium">{loadingSheet.driverName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Helper</span>
              <span className="font-medium">
                {loadingSheet.helperName || "-"}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-2 items-center justify-center h-full py-2">
              <Badge
                className={`text-lg px-4 py-1 ${
                  loadingSheet.status === "Completed"
                    ? "bg-green-600"
                    : "bg-blue-600"
                }`}
              >
                {loadingSheet.status}
              </Badge>
              <p className="text-sm text-muted-foreground">
                {loadingSheet.status === "Completed"
                  ? "All items reconciled and closed."
                  : "Currently in transit."}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Orders List Table */}
      <Card>
        <CardHeader>
          <CardTitle>Order Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order ID</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right text-muted-foreground">
                    Sent Amount
                  </TableHead>
                  <TableHead className="text-right">Final Amount</TableHead>
                  <TableHead className="text-right">Difference</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingSheet.orders.map((order) => {
                  const original =
                    order.originalAmount ?? order.totalAmount ?? 0;
                  const final = order.totalAmount ?? 0;
                  const diff = final - original;

                  return (
                    <TableRow key={order.id}>
                      <TableCell className="font-medium font-mono">
                        {order.orderId}
                        <div className="text-xs text-muted-foreground">
                          {order.invoiceNo}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">
                          {order.customer.shopName}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {order.customer.address}
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(order.status)}</TableCell>
                      <TableCell className="text-right text-muted-foreground font-mono">
                        {original.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-bold font-mono">
                        {final.toLocaleString()}
                      </TableCell>
                      <TableCell
                        className={`text-right font-mono text-sm ${
                          diff !== 0
                            ? diff > 0
                              ? "text-green-600"
                              : "text-red-600"
                            : "text-muted-foreground"
                        }`}
                      >
                        {diff > 0 ? "+" : ""}
                        {diff !== 0 ? diff.toLocaleString() : "-"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
