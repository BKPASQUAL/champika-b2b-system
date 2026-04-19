// app/dashboard/office/distribution/orders/pending/page.tsx
"use client";

import React, { useState, useMemo } from "react";
import { useCachedFetch } from "@/hooks/useCachedFetch";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  ArrowUpDown,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { Order } from "../types";
import { downloadLoadingSummary } from "../loading/print-loading-summary";

export default function DistributionPendingOrdersPage() {
  const router = useRouter();

  const { data: orders = [], loading } = useCachedFetch<Order[]>(
    "/api/orders?status=Pending",
    [],
    () => toast.error("Failed to load orders")
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [selectedRep, setSelectedRep] = useState<string>("all");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Unique sales reps derived from loaded orders
  const salesReps = useMemo(() => {
    const names = Array.from(new Set(orders.map((o) => o.salesRep).filter(Boolean)));
    return names.sort();
  }, [orders]);

  const filteredOrders = useMemo(() => {
    const searchLower = searchQuery.toLowerCase();
    return orders
      .filter((order) => {
        const invoiceMatch = (order as any).invoiceNo
          ? (order as any).invoiceNo.toLowerCase().includes(searchLower)
          : false;
        const textMatch =
          invoiceMatch ||
          order.orderId.toLowerCase().includes(searchLower) ||
          order.shopName.toLowerCase().includes(searchLower) ||
          order.customerName.toLowerCase().includes(searchLower);
        const repMatch =
          selectedRep === "all" || order.salesRep === selectedRep;
        return textMatch && repMatch;
      })
      .sort((a, b) => {
        const dateA = new Date(a.date).getTime();
        const dateB = new Date(b.date).getTime();
        return sortOrder === "asc" ? dateA - dateB : dateB - dateA;
      });
  }, [orders, searchQuery, selectedRep, sortOrder]);

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

  if (loading) {
    return (
      <div className="flex justify-center items-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="">
      {/* Header Section */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between mb-1">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Pending Orders</h1>
          <p className="text-muted-foreground text-sm">
            Orders waiting for approval or processing.
          </p>
        </div>
        {selectedOrders.length > 0 && (
          <Button
            variant="outline"
            onClick={() =>
              downloadLoadingSummary(selectedOrders, {
                title: "PENDING ORDERS — ITEMS SUMMARY REPORT",
                filePrefix: "Pending_Summary",
              })
            }
            className="animate-in fade-in zoom-in duration-300 bg-white border-slate-200"
          >
            <Download className="w-4 h-4 mr-2" />
            Download Summary ({selectedOrders.length})
          </Button>
        )}
      </div>

      {/* Main Content Card */}
      <Card className="border-0 sm:border shadow-none sm:shadow-sm bg-transparent sm:bg-card">
        <CardHeader className="px-0 sm:px-6 pb-2 pt-2">
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
            {/* Sales Rep Filter */}
            <Select value={selectedRep} onValueChange={setSelectedRep}>
              <SelectTrigger className="w-full sm:w-[200px] bg-white border-slate-200">
                <User className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                <SelectValue placeholder="All Sales Reps" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sales Reps</SelectItem>
                {salesReps.map((rep) => (
                  <SelectItem key={rep} value={rep}>
                    {rep}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {/* Sort by Date */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSortOrder((s) => (s === "asc" ? "desc" : "asc"))}
              className="bg-white border-slate-200 gap-1.5 shrink-0"
            >
              <ArrowUpDown className="h-3.5 w-3.5" />
              {sortOrder === "desc" ? "Newest first" : "Oldest first"}
            </Button>
          </div>
        </CardHeader>

        <CardContent className="px-0 sm:px-6 pt-0">
          {/* --- MOBILE VIEW --- */}
          <div className="grid grid-cols-1 gap-3 md:hidden">
            {filteredOrders.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground bg-slate-50 rounded-lg border border-dashed">
                <div className="flex flex-col items-center justify-center">
                  <AlertCircle className="h-10 w-10 text-muted-foreground/20 mb-3" />
                  <p>No pending orders found.</p>
                </div>
              </div>
            ) : (
              filteredOrders.map((order) => {
                const isSelected = selectedOrders.includes(order.id);
                return (
                  <div
                    key={order.id}
                    className={`bg-white border rounded-xl p-4 shadow-sm flex flex-col gap-3 transition-all duration-200 ${
                      isSelected
                        ? "border-yellow-400 ring-1 ring-yellow-400 bg-yellow-50/10"
                        : "border-slate-200"
                    }`}
                  >
                    {/* Row 1: Checkbox, Invoice, Status */}
                    <div className="flex items-start gap-3">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleSelect(order.id)}
                        className="mt-1"
                      />
                      <div
                        className="flex-1 min-w-0 cursor-pointer"
                        onClick={() =>
                          router.push(
                            `/dashboard/office/distribution/orders/${order.id}`
                          )
                        }
                      >
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1 font-mono font-bold text-yellow-700 bg-yellow-50 px-2 py-0.5 rounded text-xs">
                              <FileText className="h-3 w-3" />
                              {(order as any).invoiceNo || "N/A"}
                            </div>
                            <span className="text-[10px] text-muted-foreground font-mono">
                              ({order.orderId})
                            </span>
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
                      onClick={() =>
                        router.push(
                          `/dashboard/office/distribution/orders/${order.id}`
                        )
                      }
                    >
                      Process Order <ArrowRight className="ml-2 h-3 w-3" />
                    </Button>
                  </div>
                );
              })
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
                  <TableHead className="w-[100px]">Date</TableHead>
                  <TableHead>Invoice No</TableHead>
                  <TableHead>Customer / Shop</TableHead>
                  <TableHead>Sales Rep</TableHead>
                  <TableHead className="text-right">Items</TableHead>
                  <TableHead className="text-right">Total Amount</TableHead>
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
                  filteredOrders.map((order) => (
                    <TableRow
                      key={order.id}
                      className={`hover:bg-slate-50 ${
                        selectedOrders.includes(order.id) ? "bg-yellow-50/30" : ""
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
                        <div className="flex flex-col">
                          <span className="font-medium font-mono text-yellow-700 text-xs flex items-center gap-1">
                            <FileText className="h-3 w-3" />
                            {(order as any).invoiceNo || "N/A"}
                          </span>
                          <span className="text-[10px] text-muted-foreground font-mono">
                            {order.orderId}
                          </span>
                        </div>
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
                        {order.itemCount}
                      </TableCell>
                      <TableCell className="text-right font-semibold text-sm">
                        LKR {order.totalAmount.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge
                          variant="outline"
                          className="bg-yellow-50 text-yellow-700 border-yellow-200"
                        >
                          Pending
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          className="bg-yellow-600 hover:bg-yellow-700 text-white h-8 text-xs"
                          onClick={() =>
                            router.push(
                              `/dashboard/office/distribution/orders/${order.id}`
                            )
                          }
                        >
                          Process <ArrowRight className="ml-1 h-3 w-3" />
                        </Button>
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
