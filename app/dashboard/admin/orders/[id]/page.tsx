"use client";

import React, { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Printer,
  CheckCircle2,
  FileText,
  User,
  MapPin,
  Phone,
  Briefcase,
  Loader2,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
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

export default function ViewOrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const [order, setOrder] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  // Dialog States
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);

  // --- 1. Fetch Order Data ---
  useEffect(() => {
    const fetchOrderDetails = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/orders/${id}`);

        if (!res.ok) throw new Error("Failed to load order");

        const data = await res.json();
        setOrder(data);
        setItems(data.items);
      } catch (error) {
        console.error(error);
        toast.error("Could not fetch order details");
      } finally {
        setLoading(false);
      }
    };

    fetchOrderDetails();
  }, [id]);

  // --- 2. Confirm Approve Logic ---
  const executeApprove = async () => {
    setProcessing(true);
    try {
      const res = await fetch(`/api/orders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "Processing" }),
      });

      if (!res.ok) throw new Error("Failed to approve order");

      toast.success("Order Approved! Moved to Processing.");
      router.push("/dashboard/admin/orders/pending");
    } catch (error) {
      toast.error("Failed to update status");
    } finally {
      setProcessing(false);
      setShowApproveDialog(false);
    }
  };

  // --- 3. Confirm Reject Logic ---
  const executeReject = async () => {
    setProcessing(true);
    try {
      const res = await fetch(`/api/orders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "Cancelled" }),
      });

      if (!res.ok) throw new Error("Failed to cancel order");

      toast.success("Order Cancelled.");
      router.push("/dashboard/admin/orders");
    } catch (error) {
      toast.error("Failed to cancel order");
    } finally {
      setProcessing(false);
      setShowRejectDialog(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[calc(100vh-200px)]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!order) {
    return <div className="p-10 text-center text-red-500">Order not found</div>;
  }

  // Calculations
  const subtotal = items.reduce((acc, item) => acc + (item.total || 0), 0);
  const grandTotal = order.totalAmount;
  const discountAmount = Math.max(0, subtotal - grandTotal);

  return (
    <div className="space-y-4 mx-auto pb-10">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              Order Review
              <Badge
                variant="outline"
                className="bg-blue-50 text-blue-700 border-blue-200"
              >
                {order.status}
              </Badge>
            </h1>
            <p className="text-muted-foreground text-sm">
              Review details for order{" "}
              <span className="font-mono font-medium text-foreground">
                {order.orderId}
              </span>
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="w-4 h-4 mr-2" /> Print
          </Button>

          {/* Approval Buttons only for Pending Orders */}
          {order.status === "Pending" && (
            <>
              <Button
                variant="outline"
                className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                onClick={() => setShowRejectDialog(true)}
                disabled={processing}
              >
                <XCircle className="w-4 h-4 mr-2" /> Reject
              </Button>
              <Button
                className="bg-green-600 hover:bg-green-700 text-white"
                onClick={() => setShowApproveDialog(true)}
                disabled={processing}
              >
                {processing ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                )}
                Approve & Process
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* LEFT COLUMN: Details & Items */}
        <div className="lg:col-span-2 space-y-4">
          {/* 1. Customer & Billing Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-muted-foreground" />
                Invoice Details
              </CardTitle>
              <CardDescription>
                Customer and billing information
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-muted-foreground text-xs uppercase tracking-wider">
                    Customer
                  </Label>
                  <div className="flex items-center gap-2 p-2 border rounded-md bg-muted/30">
                    <User className="w-4 h-4 text-muted-foreground" />
                    <span className="font-medium">
                      {order.customer?.shopName || "Unknown"}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      ({order.customer?.name})
                    </span>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground text-xs uppercase tracking-wider">
                    Representative
                  </Label>
                  <div className="flex items-center gap-2 p-2 border rounded-md bg-muted/30">
                    <Briefcase className="w-4 h-4 text-muted-foreground" />
                    <span className="font-medium">{order.salesRep}</span>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-muted-foreground text-xs uppercase tracking-wider">
                    Route / Area
                  </Label>
                  <div className="flex items-center gap-2 p-2 border rounded-md bg-muted/30">
                    <MapPin className="w-4 h-4 text-muted-foreground" />
                    <span>{order.customer?.route || "N/A"}</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground text-xs uppercase tracking-wider">
                    Shop Mobile
                  </Label>
                  <div className="flex items-center gap-2 p-2 border rounded-md bg-muted/30">
                    <Phone className="w-4 h-4 text-muted-foreground" />
                    <span>{order.customer?.phone || "N/A"}</span>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-muted-foreground text-xs uppercase tracking-wider">
                    Order / Invoice No
                  </Label>
                  <Input
                    value={order.orderId}
                    disabled
                    className="bg-muted/30 font-mono"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground text-xs uppercase tracking-wider">
                    Date
                  </Label>
                  <Input
                    value={new Date(order.date).toLocaleDateString()}
                    disabled
                    className="bg-muted/30"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 2. Order Items Table */}
          <Card>
            <CardHeader>
              <CardTitle>Order Items</CardTitle>
              <CardDescription>Products included in this order</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto px-4">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/20">
                      <TableHead>Code</TableHead>
                      <TableHead>Item Name</TableHead>
                      <TableHead className="text-right">Unit</TableHead>
                      <TableHead className="text-right">Price</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right text-green-600">
                        Free
                      </TableHead>
                      <TableHead className="text-right">Disc %</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {item.sku}
                        </TableCell>
                        <TableCell className="font-medium">
                          {item.name}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {item.unit}
                        </TableCell>
                        <TableCell className="text-right">
                          {item.price.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {item.qty}
                        </TableCell>
                        <TableCell className="text-right text-green-600">
                          {item.free > 0 ? item.free : "-"}
                        </TableCell>
                        <TableCell className="text-right text-red-500">
                          {item.disc > 0 ? item.disc + "%" : "-"}
                        </TableCell>
                        <TableCell className="text-right font-bold">
                          LKR {item.total.toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* RIGHT COLUMN: Summary */}
        <div className="lg:col-span-1">
          <Card className="sticky top-6">
            <CardHeader>
              <CardTitle>Order Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Status Section */}
              <div className="rounded-lg border p-4 bg-muted/10">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-muted-foreground">
                    Payment Status
                  </span>
                  <Badge
                    variant={
                      order.paymentStatus === "Paid" ? "default" : "destructive"
                    }
                  >
                    {order.paymentStatus}
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">
                    Order Status
                  </span>
                  <Badge
                    variant="secondary"
                    className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100"
                  >
                    {order.status}
                  </Badge>
                </div>
              </div>

              {/* Totals Section */}
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total Items</span>
                  <span className="font-medium">{items.length}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total Quantity</span>
                  <span className="font-medium">
                    {items.reduce(
                      (a, b) => a + (b.qty || 0) + (b.free || 0),
                      0
                    )}
                  </span>
                </div>

                <Separator className="my-2" />

                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>LKR {subtotal.toLocaleString()}</span>
                </div>

                {discountAmount > 0 && (
                  <div className="flex justify-between text-sm text-green-600">
                    <span>Total Discount</span>
                    <span>- LKR {discountAmount.toLocaleString()}</span>
                  </div>
                )}

                <Separator className="my-2" />

                <div className="flex justify-between items-center pt-2">
                  <span className="font-bold text-lg">Grand Total</span>
                  <span className="font-bold text-2xl text-primary">
                    LKR {grandTotal.toLocaleString()}
                  </span>
                </div>
              </div>

              <Button
                className="w-full h-12 text-lg"
                variant="outline"
                onClick={() => router.back()}
              >
                Back to Orders
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* --- DIALOGS --- */}

      {/* Approve Dialog */}
      <AlertDialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Approval</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to approve this order? It will be moved to
              the <strong>Processing</strong> stage for picking and packing.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={executeApprove}
              className="bg-green-600 hover:bg-green-700"
            >
              Confirm & Process
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reject Dialog */}
      <AlertDialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject Order?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to reject this order? This will mark it as{" "}
              <strong>Cancelled</strong>. This action cannot be undone easily.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={executeReject}
              className="bg-red-600 hover:bg-red-700"
            >
              Reject Order
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
