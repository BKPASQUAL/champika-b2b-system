"use client";

import React, { useState, useMemo } from "react";
import { useCachedFetch } from "@/hooks/useCachedFetch";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Search,
  Loader2,
  FileText,
  AlertTriangle,
  User,
  Calendar,
  Check,
  X,
  ArrowLeft,
} from "lucide-react";
import { toast } from "sonner";
import { Order } from "@/app/dashboard/admin/orders/types";
import { getUserBusinessContext } from "@/app/middleware/businessAuth";
import { BUSINESS_IDS } from "@/app/config/business-constants";

export default function DistributionCancelRequestsPage() {
  const router = useRouter();
  const distributionBusinessId = BUSINESS_IDS.CHAMPIKA_DISTRIBUTION;

  // Dialog & Sheet States
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showInvoiceSheet, setShowInvoiceSheet] = useState(false);
  const [showAcceptCancelDialog, setShowAcceptCancelDialog] = useState(false);
  const [showRejectCancelRequestDialog, setShowRejectCancelRequestDialog] = useState(false);
  const [invoiceDetails, setInvoiceDetails] = useState<any>(null);
  const [loadingInvoice, setLoadingInvoice] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch orders in Loading status for distribution business
  const {
    data: orders = [],
    loading,
    refetch: refetchOrders,
  } = useCachedFetch<Order[]>(
    `/api/orders?status=Loading&businessId=${distributionBusinessId}`,
    [],
    () => toast.error("Failed to load orders")
  );

  // Filter client-side to only show orders that have an active cancel request in notes
  const cancelRequests = useMemo(() => {
    return orders.filter(
      (order) => order.notes && order.notes.includes("[CANCEL_REQUEST:")
    );
  }, [orders]);

  // Search filter
  const filteredRequests = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return cancelRequests.filter((order) => {
      const invoiceMatch = order.invoiceNo
        ? order.invoiceNo.toLowerCase().includes(q)
        : false;
      return (
        !q ||
        invoiceMatch ||
        order.orderId.toLowerCase().includes(q) ||
        order.shopName.toLowerCase().includes(q) ||
        (order.customerName && order.customerName.toLowerCase().includes(q))
      );
    });
  }, [cancelRequests, searchQuery]);

  const openInvoiceSheet = async (order: Order) => {
    if (!order.invoiceId) {
      toast.error("No invoice associated with this order");
      return;
    }
    setSelectedOrder(order);
    setShowInvoiceSheet(true);
    setLoadingInvoice(true);
    try {
      const res = await fetch(`/api/invoices/${order.invoiceId}`);
      if (!res.ok) throw new Error("Failed to fetch invoice details");
      const data = await res.json();
      setInvoiceDetails(data);
    } catch (error: any) {
      toast.error(error.message || "Failed to load invoice");
    } finally {
      setLoadingInvoice(false);
    }
  };

  const handleAcceptCancel = async () => {
    if (!selectedOrder?.invoiceId) {
      toast.error("No invoice associated with this order");
      return;
    }

    const cancelRequestReason = selectedOrder.notes
      ? selectedOrder.notes.match(/\[CANCEL_REQUEST:\s*(.*?)\]/)?.[1]
      : "Cancellation request approved";

    setProcessing(true);
    try {
      const user = getUserBusinessContext();
      const res = await fetch(`/api/invoices/${selectedOrder.invoiceId}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user?.id,
          reason: `Cancel request accepted: ${cancelRequestReason}`,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to cancel order & invoice");

      toast.success("Order & Invoice cancelled successfully");
      setShowAcceptCancelDialog(false);
      setSelectedOrder(null);
      refetchOrders();
    } catch (error: any) {
      toast.error(error.message || "Failed to cancel order & invoice");
    } finally {
      setProcessing(false);
    }
  };

  const handleRejectCancelRequest = async () => {
    if (!selectedOrder) return;
    setProcessing(true);
    try {
      const user = getUserBusinessContext();
      const res = await fetch(`/api/orders/${selectedOrder.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reject_cancel_request",
          userId: user?.id,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to reject cancellation request");

      toast.success("Cancellation request rejected successfully");
      setShowRejectCancelRequestDialog(false);
      setSelectedOrder(null);
      refetchOrders();
    } catch (error: any) {
      toast.error(error.message || "Failed to reject cancellation request");
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/dashboard/office/distribution")}
            className="h-9 w-9"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-amber-900 flex items-center gap-2">
              <AlertTriangle className="h-6 w-6 text-amber-500" />
              Cancel Requests Queue
            </h1>
            <p className="text-muted-foreground text-sm">
              Review and process pending invoice cancellation requests from the Loading stage.
            </p>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <Card className="border-0 sm:border shadow-none sm:shadow-sm bg-transparent sm:bg-card">
        <CardHeader className="px-0 sm:px-6 pb-2 pt-2">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search Invoice, Order ID or Shop..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-white border-slate-200"
            />
          </div>
        </CardHeader>

        <CardContent className="px-0 sm:px-6 pt-0">
          {/* MOBILE VIEW */}
          <div className="grid grid-cols-1 gap-3 md:hidden">
            {filteredRequests.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground bg-amber-50/20 rounded-lg border border-dashed border-amber-200">
                <div className="flex flex-col items-center justify-center">
                  <AlertTriangle className="h-10 w-10 text-amber-500/30 mb-3" />
                  <p className="text-amber-800 font-medium">No pending cancellation requests found.</p>
                </div>
              </div>
            ) : (
              filteredRequests.map((order) => {
                const cancelReason = order.notes
                  ? order.notes.match(/\[CANCEL_REQUEST:\s*(.*?)\]/)?.[1]
                  : "No reason provided";
                return (
                  <div
                    key={order.id}
                    className="bg-white border border-amber-200 rounded-xl p-4 shadow-sm flex flex-col gap-3 transition-all duration-200 hover:border-amber-400"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1 font-mono font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded text-xs">
                            <FileText className="h-3 w-3" />
                            {order.invoiceNo || "N/A"}
                          </div>
                          <span className="text-[10px] text-muted-foreground font-mono">
                            ({order.orderId})
                          </span>
                        </div>
                        <Badge
                          variant="outline"
                          className="bg-amber-50 text-amber-700 border-amber-200 animate-pulse"
                        >
                          Cancel Pending
                        </Badge>
                      </div>

                      <div className="mt-1 space-y-1">
                        <p className="text-sm font-bold text-slate-900 truncate">
                          {order.shopName}
                        </p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {order.date ? new Date(order.date).toLocaleDateString() : ""}
                        </p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {order.salesRep}
                        </p>
                      </div>

                      <div className="mt-2.5 p-2 bg-amber-50 border border-amber-100 rounded text-xs text-amber-900">
                        <p className="font-semibold mb-0.5">Cancellation Reason:</p>
                        <p className="italic">{cancelReason}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 border-t pt-3 mt-1">
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-slate-700 text-xs border-slate-200"
                        onClick={() => openInvoiceSheet(order)}
                      >
                        View Invoice
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-amber-800 border-amber-200 hover:bg-amber-50 text-xs font-semibold"
                        onClick={() => {
                          setSelectedOrder(order);
                          setShowRejectCancelRequestDialog(true);
                        }}
                      >
                        Reject
                      </Button>
                      <Button
                        size="sm"
                        className="bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold"
                        onClick={() => {
                          setSelectedOrder(order);
                          setShowAcceptCancelDialog(true);
                        }}
                      >
                        Accept
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* DESKTOP VIEW */}
          <div className="hidden md:block rounded-md border border-amber-100 bg-white overflow-hidden shadow-sm">
            <Table>
              <TableHeader className="bg-amber-50/40">
                <TableRow className="border-amber-100">
                  <TableHead className="w-[110px]">Date</TableHead>
                  <TableHead>Invoice No</TableHead>
                  <TableHead>Customer / Shop</TableHead>
                  <TableHead>Sales Rep</TableHead>
                  <TableHead className="max-w-[250px]">Cancellation Reason</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRequests.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="text-center py-12 text-muted-foreground"
                    >
                      <div className="flex flex-col items-center justify-center py-4">
                        <AlertTriangle className="h-12 w-12 text-amber-500/20 mb-4" />
                        <p className="text-amber-800 font-medium text-base">No pending cancellation requests found.</p>
                        <p className="text-xs text-muted-foreground mt-1">Orders with requested cancellations will appear here.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRequests.map((order) => {
                    const cancelReason = order.notes
                      ? order.notes.match(/\[CANCEL_REQUEST:\s*(.*?)\]/)?.[1]
                      : "No reason provided";
                    return (
                      <TableRow
                        key={order.id}
                        className="hover:bg-amber-50/10 border-amber-50"
                      >
                        <TableCell className="whitespace-nowrap text-muted-foreground text-xs font-medium">
                          {order.date ? new Date(order.date).toLocaleDateString() : ""}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-semibold font-mono text-amber-700 text-xs flex items-center gap-1">
                              <FileText className="h-3 w-3" />
                              {order.invoiceNo || "N/A"}
                            </span>
                            <span className="text-[10px] text-muted-foreground font-mono">
                              {order.orderId}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-semibold text-sm text-slate-900">
                              {order.shopName}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {order.customerName || ""}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm font-medium">{order.salesRep}</TableCell>
                        <TableCell className="text-xs text-slate-700 italic max-w-[250px] truncate" title={cancelReason}>
                          {cancelReason}
                        </TableCell>
                        <TableCell className="text-right font-semibold text-sm whitespace-nowrap">
                          LKR {order.totalAmount.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-1.5 justify-end">
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-slate-700 h-8 text-xs font-medium border-slate-200 hover:bg-slate-50"
                              onClick={() => openInvoiceSheet(order)}
                            >
                              View Invoice
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-amber-800 border-amber-200 hover:bg-amber-50 h-8 text-xs font-semibold"
                              onClick={() => {
                                setSelectedOrder(order);
                                setShowRejectCancelRequestDialog(true);
                              }}
                            >
                              Reject
                            </Button>
                            <Button
                              size="sm"
                              className="bg-orange-600 hover:bg-orange-700 text-white h-8 text-xs font-semibold"
                              onClick={() => {
                                setSelectedOrder(order);
                                setShowAcceptCancelDialog(true);
                              }}
                            >
                              Accept
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

      {/* Accept Cancellation Dialog */}
      <AlertDialog open={showAcceptCancelDialog} onOpenChange={setShowAcceptCancelDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-orange-600">
              <AlertTriangle className="h-5 w-5 animate-bounce" />
              Accept Cancellation Request
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to accept the cancellation request for order #{selectedOrder?.orderId}? This will cancel the associated invoice, restore inventory, and adjust the customer balance. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={processing} onClick={() => setSelectedOrder(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleAcceptCancel}
              disabled={processing}
              className="bg-orange-600 hover:bg-orange-700 text-white"
            >
              {processing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                "Yes, Cancel Order & Invoice"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reject Cancellation Request Dialog */}
      <AlertDialog open={showRejectCancelRequestDialog} onOpenChange={setShowRejectCancelRequestDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject Cancellation Request</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to reject the cancellation request for order #{selectedOrder?.orderId}? The order will return to its active Loading state.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={processing} onClick={() => setSelectedOrder(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRejectCancelRequest}
              disabled={processing}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {processing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                "Reject Request"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Invoice Details Sidebar (Sheet) */}
      <Sheet open={showInvoiceSheet} onOpenChange={setShowInvoiceSheet}>
        <SheetContent className="sm:max-w-xl overflow-y-auto h-full">
          <SheetHeader className="pb-4 border-b">
            <SheetTitle className="text-xl font-bold flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-600" />
              Invoice Details
            </SheetTitle>
          </SheetHeader>

          {loadingInvoice ? (
            <div className="flex justify-center items-center h-[300px]">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : invoiceDetails ? (
            <div className="py-4 space-y-6">
              {/* Cancellation requested callout banner inside sheet */}
              <div className="flex flex-col gap-3 bg-amber-50 border border-amber-300 rounded-lg p-4 text-amber-800">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="h-5 w-5 shrink-0 text-amber-500 mt-0.5 animate-bounce" />
                  <div>
                    <h4 className="font-semibold text-amber-900 text-sm">Cancellation Requested</h4>
                    <p className="text-xs text-amber-800 mt-1">
                      <strong>Reason:</strong> {selectedOrder?.notes?.match(/\[CANCEL_REQUEST:\s*(.*?)\]/)?.[1] || "No reason specified"}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2 justify-end pt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-amber-800 border-amber-300 hover:bg-amber-100 h-8 text-xs font-semibold"
                    onClick={() => {
                      setShowInvoiceSheet(false);
                      setShowRejectCancelRequestDialog(true);
                    }}
                    disabled={processing}
                  >
                    <X className="w-3.5 h-3.5 mr-1" /> Reject
                  </Button>
                  <Button
                    size="sm"
                    className="bg-orange-600 hover:bg-orange-700 text-white h-8 text-xs font-semibold"
                    onClick={() => {
                      setShowInvoiceSheet(false);
                      setShowAcceptCancelDialog(true);
                    }}
                    disabled={processing}
                  >
                    <Check className="w-3.5 h-3.5 mr-1" /> Accept & Cancel
                  </Button>
                </div>
              </div>

              {/* Invoice Meta */}
              <div className="bg-slate-50 p-4 rounded-lg border space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground uppercase font-semibold">Invoice No</span>
                  <span className="font-mono font-bold text-sm text-slate-900">{invoiceDetails.invoiceNo}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground uppercase font-semibold">Invoice Date</span>
                  <span className="text-sm font-medium">{new Date(invoiceDetails.date).toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground uppercase font-semibold">Payment Status</span>
                  <Badge className={invoiceDetails.status === "Paid" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>
                    {invoiceDetails.status}
                  </Badge>
                </div>
              </div>

              {/* Customer Info */}
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Bill To</h4>
                <div className="p-3 border rounded-lg bg-slate-50/50">
                  <p className="font-semibold text-sm">{invoiceDetails.customerName || invoiceDetails.customers?.shop_name}</p>
                  <p className="text-xs text-muted-foreground mt-1">Rep: {invoiceDetails.salesRepName}</p>
                </div>
              </div>

              {/* Items Table */}
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Items</h4>
                <div className="border rounded-md overflow-hidden">
                  <Table>
                    <TableHeader className="bg-slate-50">
                      <TableRow>
                        <TableHead className="text-xs font-semibold">Item</TableHead>
                        <TableHead className="text-center text-xs font-semibold">Qty</TableHead>
                        <TableHead className="text-right text-xs font-semibold">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {invoiceDetails.items?.map((item: any) => (
                        <TableRow key={item.productId || item.sku}>
                          <TableCell className="py-2.5">
                            <p className="text-sm font-medium leading-none">{item.productName || item.sku}</p>
                            <p className="text-[10px] text-muted-foreground font-mono mt-1">{item.sku}</p>
                          </TableCell>
                          <TableCell className="text-center py-2.5 text-sm">
                            {item.quantity} {item.unit}
                            {item.freeQuantity > 0 && (
                              <span className="text-[10px] text-green-600 block">+{item.freeQuantity} free</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right py-2.5 font-mono text-sm font-medium">
                            LKR {item.total?.toLocaleString()}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* Summary */}
              <div className="border-t pt-4 space-y-2.5">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-medium font-mono">LKR {invoiceDetails.totalAmount?.toLocaleString()}</span>
                </div>
                {invoiceDetails.extraDiscountAmount > 0 && (
                  <div className="flex justify-between text-sm text-red-600">
                    <span>Discount</span>
                    <span className="font-medium font-mono">-LKR {invoiceDetails.extraDiscountAmount?.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between items-center pt-2 border-t border-dashed">
                  <span className="font-bold text-sm">Grand Total</span>
                  <span className="font-bold font-mono text-lg text-blue-600">
                    LKR {invoiceDetails.totalAmount?.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Paid Amount</span>
                  <span className="font-medium font-mono text-green-600">LKR {invoiceDetails.paidAmount?.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm pt-1 border-t">
                  <span className="font-semibold text-slate-700">Due Amount</span>
                  <span className="font-bold font-mono text-red-600">LKR {invoiceDetails.dueAmount?.toLocaleString()}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground text-sm">
              Failed to load invoice details.
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
