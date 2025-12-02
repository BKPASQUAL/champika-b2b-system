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

export default function OfficeViewOrderPage({
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

  // --- 2. Actions ---
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
      router.push("/dashboard/office/orders/pending");
    } catch (error) {
      toast.error("Failed to update status");
    } finally {
      setProcessing(false);
      setShowApproveDialog(false);
    }
  };

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
      router.push("/dashboard/office/orders");
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

  const subtotal = items.reduce((acc, item) => acc + (item.total || 0), 0);
  const grandTotal = order.totalAmount;
  const discountAmount = Math.max(0, subtotal - grandTotal);

  return (
    <div className="space-y-4 mx-auto pb-10 max-w-full">
      {/* --- Header --- */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.back()}
            className="shrink-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex flex-col">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl md:text-2xl font-bold tracking-tight">
                Order Review
              </h1>
              <Badge
                variant="outline"
                className="bg-blue-50 text-blue-700 border-blue-200 whitespace-nowrap"
              >
                {order.status}
              </Badge>
            </div>
            <p className="text-muted-foreground text-xs md:text-sm font-mono">
              #{order.orderId}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          <Button
            variant="outline"
            onClick={() => window.print()}
            className="flex-1 md:flex-none"
          >
            <Printer className="w-4 h-4 mr-2" /> Print
          </Button>

          {order.status === "Pending" && (
            <>
              <Button
                variant="outline"
                className="flex-1 md:flex-none text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                onClick={() => setShowRejectDialog(true)}
                disabled={processing}
              >
                <XCircle className="w-4 h-4 mr-2" /> Reject
              </Button>
              <Button
                className="flex-1 md:flex-none bg-green-600 hover:bg-green-700 text-white"
                onClick={() => setShowApproveDialog(true)}
                disabled={processing}
              >
                {processing ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                )}
                Approve
              </Button>
            </>
          )}
        </div>
      </div>

      {/* --- Main Layout (Responsive Grid) --- */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-3">
        {/* LEFT COLUMN */}
        <div className="lg:col-span-2 space-y-4">
          {/* Customer Details Card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                <FileText className="w-4 h-4 text-muted-foreground" />
                Order Details
              </CardTitle>
              <CardDescription>Customer and route information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Customer */}
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground uppercase">
                    Customer
                  </Label>
                  <div className="flex items-center gap-2 p-2 border rounded-md bg-muted/30">
                    <User className="w-4 h-4 text-muted-foreground shrink-0" />
                    <div className="overflow-hidden">
                      <p className="font-medium truncate">
                        {order.customer?.shopName}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {order.customer?.name}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Sales Rep */}
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground uppercase">
                    Sales Rep
                  </Label>
                  <div className="flex items-center gap-2 p-2 border rounded-md bg-muted/30">
                    <Briefcase className="w-4 h-4 text-muted-foreground shrink-0" />
                    <span className="font-medium truncate">
                      {order.salesRep}
                    </span>
                  </div>
                </div>

                {/* Route */}
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground uppercase">
                    Route / Area
                  </Label>
                  <div className="flex items-center gap-2 p-2 border rounded-md bg-muted/30">
                    <MapPin className="w-4 h-4 text-muted-foreground shrink-0" />
                    <span className="truncate">
                      {order.customer?.route || "N/A"}
                    </span>
                  </div>
                </div>

                {/* Phone */}
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground uppercase">
                    Contact
                  </Label>
                  <div className="flex items-center gap-2 p-2 border rounded-md bg-muted/30">
                    <Phone className="w-4 h-4 text-muted-foreground shrink-0" />
                    <span>{order.customer?.phone || "N/A"}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Order Items Table (Scrollable on mobile) */}
          <Card className="overflow-hidden">
            <CardHeader className="pb-3 bg-muted/30">
              <div className="flex justify-between items-center">
                <CardTitle className="text-base md:text-lg">Items</CardTitle>
                <Badge variant="secondary">{items.length} Products</Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[80px] whitespace-nowrap">
                        Code
                      </TableHead>
                      <TableHead className="min-w-[150px]">Item Name</TableHead>
                      <TableHead className="text-right whitespace-nowrap">
                        Price
                      </TableHead>
                      <TableHead className="text-right whitespace-nowrap">
                        Qty
                      </TableHead>
                      <TableHead className="text-right whitespace-nowrap text-green-600">
                        Free
                      </TableHead>
                      <TableHead className="text-right whitespace-nowrap">
                        Total
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {item.sku}
                        </TableCell>
                        <TableCell className="font-medium text-sm">
                          {item.name}
                          <span className="block md:hidden text-xs text-muted-foreground mt-0.5">
                            {item.unit}
                          </span>
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap">
                          {item.price.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {item.qty}{" "}
                          <span className="hidden md:inline text-xs text-muted-foreground">
                            {item.unit}
                          </span>
                        </TableCell>
                        <TableCell className="text-right text-green-600 font-medium">
                          {item.free > 0 ? `+${item.free}` : "-"}
                        </TableCell>
                        <TableCell className="text-right font-bold whitespace-nowrap">
                          {item.total.toLocaleString()}
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
          <Card className="lg:sticky lg:top-6 border-l-4 border-l-blue-500">
            <CardHeader className="pb-3">
              <CardTitle>Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Status Info */}
              <div className="bg-muted/30 p-3 rounded-lg space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Date</span>
                  <span className="font-medium">
                    {new Date(order.date).toLocaleDateString()}
                  </span>
                </div>
                <Separator />
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Payment</span>
                  <Badge
                    variant={
                      order.paymentStatus === "Paid" ? "default" : "destructive"
                    }
                    className="h-5 px-1.5 text-[10px]"
                  >
                    {order.paymentStatus}
                  </Badge>
                </div>
              </div>

              {/* Totals */}
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{subtotal.toLocaleString()}</span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between text-sm text-green-600">
                    <span>Discount</span>
                    <span>- {discountAmount.toLocaleString()}</span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between items-center">
                  <span className="font-bold text-lg">Total (LKR)</span>
                  <span className="font-bold text-2xl text-primary">
                    {grandTotal.toLocaleString()}
                  </span>
                </div>
              </div>

              <Button
                className="w-full mt-4"
                variant="outline"
                onClick={() => router.back()}
              >
                Back to List
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* --- DIALOGS --- */}
      <AlertDialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
        <AlertDialogContent className="max-w-[90%] sm:max-w-lg rounded-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Approval</AlertDialogTitle>
            <AlertDialogDescription>
              Move order <strong>{order.orderId}</strong> to{" "}
              <strong>Processing</strong>? This will notify the warehouse team
              to start picking.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={executeApprove}
              className="bg-green-600 hover:bg-green-700"
            >
              Approve Order
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <AlertDialogContent className="max-w-[90%] sm:max-w-lg rounded-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-600">
              Reject Order?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will mark order <strong>{order.orderId}</strong> as{" "}
              <strong>Cancelled</strong>. This action cannot be easily undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={executeReject}
              className="bg-red-600 hover:bg-red-700"
            >
              Yes, Reject Order
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
