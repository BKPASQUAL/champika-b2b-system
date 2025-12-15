// app/dashboard/office/distribution/orders/loading/page.tsx
"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Search,
  Filter,
  Truck,
  History,
  PlusCircle,
  Loader2,
  RefreshCw,
  FileText,
  User,
  MapPin,
} from "lucide-react";
import { toast } from "sonner";
import { LoadingSheetDialog } from "@/app/dashboard/admin/orders/_components/LoadingSheetDialog"; // Reusing Admin component

interface Order {
  id: string;
  orderId: string;
  invoiceNo?: string;
  shopName: string;
  route: string;
  salesRepName: string; // Ensure backend returns this or map it
  totalAmount: number;
  status: string;
  date?: string;
}

export default function DistributionLoadingOrdersPage() {
  const router = useRouter();

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      // Fetch orders with 'Loading' status
      const res = await fetch("/api/orders/loading");
      if (!res.ok) throw new Error("Failed to fetch loading orders");
      const data = await res.json();
      setOrders(data);
      setSelectedOrders([]);
    } catch (error) {
      console.error(error);
      toast.error("Failed to load orders");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const filteredOrders = orders.filter((order) => {
    const searchLower = searchQuery.toLowerCase();
    const invoiceMatch = order.invoiceNo
      ? order.invoiceNo.toLowerCase().includes(searchLower)
      : false;

    return (
      invoiceMatch ||
      order.orderId.toLowerCase().includes(searchLower) ||
      order.shopName.toLowerCase().includes(searchLower) ||
      (order.salesRepName &&
        order.salesRepName.toLowerCase().includes(searchLower))
    );
  });

  const toggleSelectOrder = (orderId: string) => {
    setSelectedOrders((prev) =>
      prev.includes(orderId)
        ? prev.filter((id) => id !== orderId)
        : [...prev, orderId]
    );
  };

  const toggleSelectAll = () => {
    if (selectedOrders.length === filteredOrders.length) {
      setSelectedOrders([]);
    } else {
      setSelectedOrders(filteredOrders.map((o) => o.id));
    }
  };

  const handleCreateLoad = async (formData: any) => {
    try {
      const payload = {
        lorryNumber: formData.lorryNumber,
        driverId: formData.driverId,
        helperName: formData.helperName || "",
        date: formData.date,
        orderIds: selectedOrders,
      };

      const res = await fetch("/api/orders/loading", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.error || "Failed to create load");
      }

      toast.success(`Load Sheet ${result.loadId} Created!`);

      fetchOrders();
      // Redirect to History or Active Loads in Distribution Portal
      router.push("/dashboard/office/distribution/orders/loading/active");
    } catch (error: any) {
      console.error("Create Load Error:", error);
      toast.error(error.message);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[calc(100vh-200px)]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header Section */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Loading Orders</h1>
          <p className="text-muted-foreground text-sm">
            Select checked orders to create a delivery load.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={fetchOrders}
            title="Refresh"
            className="bg-white"
          >
            <RefreshCw className={loading ? "animate-spin" : ""} />
          </Button>
          <Button
            variant="outline"
            onClick={() =>
              router.push(
                "/dashboard/office/distribution/orders/loading/history"
              )
            }
            className="bg-white"
          >
            <History className="w-4 h-4 mr-2" /> History
          </Button>
          {selectedOrders.length > 0 && (
            <Button
              onClick={() => setIsDialogOpen(true)}
              className="animate-in fade-in zoom-in duration-300 bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              <PlusCircle className="w-4 h-4 mr-2" /> Create Load (
              {selectedOrders.length})
            </Button>
          )}
        </div>
      </div>

      {/* Main Content Card */}
      <Card className="border-0 sm:border shadow-none sm:shadow-sm bg-transparent sm:bg-card">
        <CardHeader className="px-0 sm:px-6 pb-2 pt-2">
          <div className="flex items-center justify-between gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search Invoice, Shop, or Sales Rep..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-white border-slate-200"
              />
            </div>
            <Button variant="outline" size="icon" className="shrink-0 bg-white">
              <Filter className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="px-0 sm:px-6 pt-0">
          {/* --- MOBILE VIEW: CARDS (md:hidden) --- */}
          <div className="grid grid-cols-1 gap-3 md:hidden">
            {filteredOrders.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground bg-slate-50 rounded-lg border border-dashed">
                <div className="flex flex-col items-center gap-2">
                  <Truck className="h-10 w-10 text-muted-foreground/20" />
                  <p>No orders ready for loading</p>
                </div>
              </div>
            ) : (
              filteredOrders.map((order) => {
                const isSelected = selectedOrders.includes(order.id);
                return (
                  <div
                    key={order.id}
                    className={`
                      bg-white border rounded-xl p-4 shadow-sm flex flex-col gap-3 transition-all duration-200
                      ${
                        isSelected
                          ? "border-indigo-500 ring-1 ring-indigo-500 bg-indigo-50/10"
                          : "border-slate-200"
                      }
                    `}
                    onClick={() => toggleSelectOrder(order.id)}
                  >
                    {/* Row 1: Checkbox, ID, Route */}
                    <div className="flex items-start gap-3">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleSelectOrder(order.id)}
                        className="mt-1"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded text-xs">
                              <FileText className="h-3 w-3 inline mr-1" />
                              {order.invoiceNo || "N/A"}
                            </span>
                            <span className="text-[10px] text-muted-foreground font-mono">
                              ({order.orderId})
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <MapPin className="h-3 w-3" />
                          <span className="truncate">{order.route}</span>
                        </div>
                      </div>
                      <Badge
                        variant="outline"
                        className="bg-blue-50 text-blue-700 border-blue-200 shrink-0"
                      >
                        {order.status}
                      </Badge>
                    </div>

                    {/* Row 2: Shop Details */}
                    <div className="pl-7">
                      <p className="font-medium text-sm text-slate-900 truncate">
                        {order.shopName}
                      </p>
                      <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
                        <User className="h-3 w-3" />
                        <span>{order.salesRepName}</span>
                      </div>
                    </div>

                    {/* Row 3: Totals */}
                    <div className="flex justify-end border-t pt-2 pl-7">
                      <p className="font-bold text-slate-900">
                        LKR {order.totalAmount.toLocaleString()}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* --- DESKTOP VIEW: TABLE (hidden md:block) --- */}
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
                  <TableHead>Invoice No</TableHead>
                  <TableHead>Route / Area</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Sales Rep</TableHead>
                  <TableHead className="text-right">Total Bill</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOrders.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="text-center py-12 text-muted-foreground"
                    >
                      <div className="flex flex-col items-center gap-2">
                        <Truck className="h-12 w-12 text-muted-foreground/30" />
                        <p className="font-medium">
                          No orders ready for loading
                        </p>
                        <p className="text-sm">
                          Orders will appear here once they pass quality checks
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredOrders.map((order) => (
                    <TableRow
                      key={order.id}
                      className={`hover:bg-slate-50 cursor-pointer ${
                        selectedOrders.includes(order.id)
                          ? "bg-indigo-50/30"
                          : ""
                      }`}
                      onClick={() => toggleSelectOrder(order.id)}
                    >
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedOrders.includes(order.id)}
                          onCheckedChange={() => toggleSelectOrder(order.id)}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium font-mono text-indigo-700 text-xs flex items-center gap-1">
                            <FileText className="h-3 w-3" />
                            {order.invoiceNo || "N/A"}
                          </span>
                          <span className="text-[10px] text-muted-foreground font-mono mt-0.5">
                            {order.orderId}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className="font-normal text-xs"
                        >
                          {order.route}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="font-medium text-sm text-slate-900">
                          {order.shopName}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="h-6 w-6 rounded-full bg-indigo-50 flex items-center justify-center text-[10px] font-bold text-indigo-600 border border-indigo-100">
                            {order.salesRepName
                              ? order.salesRepName.charAt(0).toUpperCase()
                              : "U"}
                          </div>
                          <span className="text-sm text-muted-foreground">
                            {order.salesRepName || "Unknown"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-semibold text-sm">
                        Rs. {order.totalAmount.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge className="bg-blue-600 hover:bg-blue-700">
                          {order.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <LoadingSheetDialog
        isOpen={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        selectedCount={selectedOrders.length}
        onConfirm={handleCreateLoad}
      />
    </div>
  );
}
