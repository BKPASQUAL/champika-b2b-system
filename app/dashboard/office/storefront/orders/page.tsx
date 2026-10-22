"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  ShoppingCart,
  Search,
  RefreshCw,
  Printer,
  ExternalLink,
  Truck,
  CheckCircle2,
  Clock,
  Send,
  Loader2,
  ChevronLeft,
} from "lucide-react";
import { toast } from "sonner";

export default function StorefrontOrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [convertingOrderId, setConvertingOrderId] = useState<string | null>(null);

  // Dispatch modal
  const [dispatchOrder, setDispatchOrder] = useState<any | null>(null);
  const [courierName, setCourierName] = useState("Delivery Lorry");
  const [trackingNo, setTrackingNo] = useState("");
  const [updatingDispatch, setUpdatingDispatch] = useState(false);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/storefront/manage/orders");
      if (!res.ok) throw new Error("Failed to load orders");
      const data = await res.json();
      setOrders(data || []);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  // 1-Click Convert Order to CHO-XXXX Invoice
  const handleConvertToInvoice = async (order: any) => {
    setConvertingOrderId(order.id);
    try {
      const res = await fetch(`/api/storefront/manage/orders/${order.id}/convert`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to convert to invoice");

      toast.success(`Invoice ${data.invoiceNo} generated! Opening print preview...`);
      fetchOrders();
      window.open(`/invoice/${data.invoiceId}?division=online`, "_blank");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setConvertingOrderId(null);
    }
  };

  // Status update
  const updateOrderStatus = async (orderId: string, newStatus: string, extra: any = {}) => {
    try {
      const res = await fetch("/api/storefront/manage/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, orderStatus: newStatus, ...extra }),
      });
      if (!res.ok) throw new Error("Failed to update status");
      toast.success(`Order marked as ${newStatus}`);
      fetchOrders();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  // Confirm Dispatch
  const handleConfirmDispatch = async () => {
    if (!dispatchOrder) return;
    setUpdatingDispatch(true);
    try {
      await updateOrderStatus(dispatchOrder.id, "Dispatched", {
        courierName,
        trackingNo,
      });
      setDispatchOrder(null);
      setTrackingNo("");
      toast.success("Order dispatched and live tracking updated!");
    } finally {
      setUpdatingDispatch(false);
    }
  };

  const fmt = (num: number) =>
    (num || 0).toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // Filtered orders
  const filteredOrders = orders.filter((o) => {
    const matchesStatus = statusFilter === "all" || o.orderStatus === statusFilter;
    const matchesSearch =
      !search ||
      o.orderNo?.toLowerCase().includes(search.toLowerCase()) ||
      o.customerName?.toLowerCase().includes(search.toLowerCase()) ||
      o.customerPhone?.toLowerCase().includes(search.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  return (
    <div className="space-y-6 w-full">
      {/* Top Banner & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-5">
        <div>
          <div className="flex items-center gap-2">
            <Link href="/dashboard/office/storefront">
              <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-slate-900">
                <ChevronLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div className="p-2 bg-blue-500/10 text-blue-600 rounded-lg">
              <ShoppingCart className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
                Online Orders & Delivery Pipeline
              </h1>
              <p className="text-sm text-slate-500 mt-0.5">
                Manage orders from Placed → Confirmed → Invoiced → Dispatched → Delivered
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => window.open("/", "_blank")}
          >
            <ExternalLink className="w-4 h-4 text-emerald-600" />
            Visit Storefront
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => {
              fetchOrders();
              toast.info("Refreshed orders");
            }}
          >
            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
          </Button>
        </div>
      </div>

      {/* Main Table Card */}
      <Card>
        <CardHeader className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
          <div>
            <CardTitle>Customer Orders ({filteredOrders.length})</CardTitle>
            <CardDescription>
              Filter orders by delivery stage and generate CHO-XXXX invoices
            </CardDescription>
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Search order no, customer, phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Status Filter Pills */}
          <div className="flex flex-wrap gap-2 border-b pb-3">
            {["all", "Pending", "Confirmed", "Processing", "Dispatched", "Delivered", "Cancelled"].map((st) => (
              <Button
                key={st}
                variant={statusFilter === st ? "default" : "outline"}
                size="sm"
                className="capitalize text-xs h-8"
                onClick={() => setStatusFilter(st)}
              >
                {st === "all" ? "All Orders" : st}
                {st !== "all" && (
                  <span className="ml-1.5 opacity-60">
                    ({orders.filter((o) => o.orderStatus === st).length})
                  </span>
                )}
              </Button>
            ))}
          </div>

          {/* Orders Table */}
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="w-[120px]">Order No</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead className="text-right">Total (Rs.)</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12 text-slate-400">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
                      Loading online orders...
                    </TableCell>
                  </TableRow>
                ) : filteredOrders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12 text-slate-400">
                      No orders found matching this filter.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredOrders.map((o) => (
                    <TableRow key={o.id} className="hover:bg-slate-50/80">
                      <TableCell className="font-semibold text-slate-900">
                        <div>{o.orderNo}</div>
                        <div className="text-[11px] text-slate-400">
                          {new Date(o.createdAt).toLocaleDateString()}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-slate-900">{o.customerName}</div>
                        <div className="text-xs text-slate-500">{o.customerPhone}</div>
                      </TableCell>
                      <TableCell className="text-xs text-slate-600 max-w-[180px] truncate">
                        {o.shippingAddress || "Counter Pickup"}
                      </TableCell>
                      <TableCell>
                        <div className="text-xs text-slate-700">
                          {o.items?.length || 0} items
                        </div>
                        <div className="text-[11px] text-slate-400 max-w-[200px] truncate">
                          {o.items?.map((i: any) => `${i.productName} (x${i.quantity})`).join(", ")}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-bold text-slate-900">
                        Rs. {fmt(o.totalAmount)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[11px]">
                          {o.paymentMethod === "cod" ? "Cash on Delivery" : "Bank Transfer"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={cn(
                            "capitalize text-xs font-semibold",
                            o.orderStatus === "Pending" && "bg-amber-100 text-amber-800 hover:bg-amber-100",
                            o.orderStatus === "Confirmed" && "bg-blue-100 text-blue-800 hover:bg-blue-100",
                            o.orderStatus === "Processing" && "bg-indigo-100 text-indigo-800 hover:bg-indigo-100",
                            o.orderStatus === "Dispatched" && "bg-purple-100 text-purple-800 hover:bg-purple-100",
                            o.orderStatus === "Delivered" && "bg-emerald-100 text-emerald-800 hover:bg-emerald-100",
                            o.orderStatus === "Cancelled" && "bg-rose-100 text-rose-800 hover:bg-rose-100"
                          )}
                        >
                          {o.orderStatus}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* 1-Click Convert to Invoice */}
                          {!o.invoiceId ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 gap-1 border-blue-200 text-blue-700 hover:bg-blue-50"
                              disabled={convertingOrderId === o.id}
                              onClick={() => handleConvertToInvoice(o)}
                              title="Generate clean CHO-XXXX invoice & deduct stock"
                            >
                              {convertingOrderId === o.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Printer className="w-3.5 h-3.5" />
                              )}
                              Invoice
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 gap-1 text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                              onClick={() => window.open(`/invoice/${o.invoiceId}?division=online`, "_blank")}
                              title="Print BK Wiring Kade Bill"
                            >
                              <Printer className="w-3.5 h-3.5" />
                              Print
                            </Button>
                          )}

                          {/* Quick Lifecycle Buttons */}
                          {o.orderStatus === "Pending" && (
                            <Button
                              size="sm"
                              className="h-8 bg-blue-600 hover:bg-blue-700 text-white"
                              onClick={() => updateOrderStatus(o.id, "Confirmed")}
                            >
                              Confirm
                            </Button>
                          )}

                          {o.orderStatus === "Confirmed" && (
                            <Button
                              size="sm"
                              className="h-8 bg-indigo-600 hover:bg-indigo-700 text-white"
                              onClick={() => updateOrderStatus(o.id, "Processing")}
                            >
                              Pack
                            </Button>
                          )}

                          {o.orderStatus === "Processing" && (
                            <Button
                              size="sm"
                              className="h-8 bg-purple-600 hover:bg-purple-700 text-white gap-1"
                              onClick={() => setDispatchOrder(o)}
                            >
                              <Truck className="w-3.5 h-3.5" />
                              Dispatch
                            </Button>
                          )}

                          {o.orderStatus === "Dispatched" && (
                            <Button
                              size="sm"
                              className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white gap-1"
                              onClick={() => updateOrderStatus(o.id, "Delivered")}
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Delivered
                            </Button>
                          )}

                          {/* WhatsApp Direct Notification */}
                          {o.customerPhone && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-emerald-600 hover:bg-emerald-50"
                              title="WhatsApp Customer"
                              onClick={() => {
                                const cleanPhone = o.customerPhone.replace(/[^0-9]/g, "");
                                const intlPhone = cleanPhone.startsWith("0")
                                  ? "94" + cleanPhone.slice(1)
                                  : cleanPhone;
                                const text = encodeURIComponent(
                                  `Hello ${o.customerName}, this is BK Wiring Kade regarding your order #${o.orderNo}. Current status: ${o.orderStatus}. Track live: ${window.location.origin}/track/${o.orderNo}`
                                );
                                window.open(`https://wa.me/${intlPhone}?text=${text}`, "_blank");
                              }}
                            >
                              <Send className="w-3.5 h-3.5" />
                            </Button>
                          )}
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

      {/* Dispatch Modal */}
      <Dialog open={!!dispatchOrder} onOpenChange={(open) => !open && setDispatchOrder(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Dispatch Order #{dispatchOrder?.orderNo}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-xs font-semibold text-slate-700">Courier / Transport Name</label>
              <Input
                value={courierName}
                onChange={(e) => setCourierName(e.target.value)}
                placeholder="e.g. Delivery Lorry, Prompt Xpress, Domex"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700">Waybill / Tracking No (Optional)</label>
              <Input
                placeholder="e.g. TRK-982341"
                value={trackingNo}
                onChange={(e) => setTrackingNo(e.target.value)}
                className="mt-1"
              />
            </div>
            <p className="text-xs text-slate-500">
              This will update the customer&apos;s live tracking page to &ldquo;Dispatched&rdquo;.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDispatchOrder(null)}>
              Cancel
            </Button>
            <Button
              className="bg-purple-600 hover:bg-purple-700 text-white"
              disabled={updatingDispatch}
              onClick={handleConfirmDispatch}
            >
              {updatingDispatch ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirm Dispatch"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function cn(...classes: any[]) {
  return classes.filter(Boolean).join(" ");
}
