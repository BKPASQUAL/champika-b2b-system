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
  Edit,
  Save,
  X,
  Calendar,
  Hash,
  CreditCard,
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

  // Edit Mode State
  const [isEditing, setIsEditing] = useState(false);

  // Dialog States
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);

  // --- 1. Fetch Order Data ---
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

  useEffect(() => {
    fetchOrderDetails();
  }, [id]);

  // --- 2. Editing Logic ---
  const handleItemChange = (itemId: string, field: string, value: string) => {
    const numValue = parseFloat(value) || 0;

    setItems((prevItems) =>
      prevItems.map((item) => {
        if (item.id === itemId) {
          const updatedItem = { ...item, [field]: numValue };
          updatedItem.total = updatedItem.price * updatedItem.qty;
          return updatedItem;
        }
        return item;
      })
    );
  };

  const saveChanges = async () => {
    if (!order) return;
    setProcessing(true);

    const newTotalAmount = items.reduce(
      (acc, item) => acc + (item.total || 0),
      0
    );

    try {
      const res = await fetch(`/api/orders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_items",
          items: items,
          totalAmount: newTotalAmount,
        }),
      });

      if (!res.ok) throw new Error("Failed to update order");

      toast.success("Order updated successfully! Stocks adjusted.");
      setIsEditing(false);
      fetchOrderDetails(); // Refresh
    } catch (error) {
      toast.error("Failed to save changes");
    } finally {
      setProcessing(false);
    }
  };

  // --- 3. Action Buttons Logic ---
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

  const subtotal = items.reduce((acc, item) => acc + (item.total || 0), 0);
  const grandTotal = subtotal;

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
              {isEditing ? "Editing Order" : "Order Review"}
              <Badge
                variant="outline"
                className="bg-blue-50 text-blue-700 border-blue-200"
              >
                {order.status}
              </Badge>
            </h1>
            <p className="text-muted-foreground text-sm">
              {isEditing ? (
                "Update quantities below. Stock will adjust automatically."
              ) : (
                <>
                  Review details for order{" "}
                  <span className="font-mono font-medium text-foreground">
                    {order.orderId}
                  </span>
                </>
              )}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {isEditing ? (
            <>
              <Button
                variant="outline"
                onClick={() => setIsEditing(false)}
                disabled={processing}
              >
                <X className="w-4 h-4 mr-2" /> Cancel
              </Button>
              <Button onClick={saveChanges} disabled={processing}>
                {processing ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                Save Changes
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => window.print()}>
                <Printer className="w-4 h-4 mr-2" /> Print
              </Button>

              {/* Allow editing if Pending */}
              {order.status === "Pending" && (
                <Button variant="secondary" onClick={() => setIsEditing(true)}>
                  <Edit className="w-4 h-4 mr-2" /> Edit Order
                </Button>
              )}

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
                    Approve
                  </Button>
                </>
              )}
            </>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* LEFT COLUMN: Details & Items */}
        <div className="lg:col-span-2 space-y-4">
          {/* 1. Extended Customer & Order Details */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-muted-foreground" />
                Invoice & Customer Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* TOP HIGHLIGHT: Invoice Number */}
              <div className="flex flex-col md:flex-row justify-between gap-4 bg-blue-50 p-4 rounded-lg border border-blue-100 shadow-sm">
                <div>
                  <Label className="text-xs uppercase text-blue-600 font-bold tracking-wider">
                    Invoice Number
                  </Label>
                  <div className="text-3xl font-bold text-blue-900 mt-1 font-mono tracking-tight">
                    {order.invoiceNo || "N/A"}
                  </div>
                </div>
                <div className="flex flex-col md:items-end justify-center gap-1">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Hash className="w-4 h-4" />
                    <span>
                      Order ID:{" "}
                      <span className="font-mono font-medium text-foreground">
                        {order.orderId}
                      </span>
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="w-4 h-4" />
                    <span>
                      Date:{" "}
                      <span className="font-medium text-foreground">
                        {new Date(order.date).toLocaleDateString()}
                      </span>
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Customer Info */}
                <div className="space-y-4">
                  <div className="space-y-1">
                    <Label className="text-xs uppercase text-muted-foreground font-semibold tracking-wider">
                      Customer Information
                    </Label>
                    <div className="flex items-start gap-3 p-3 border rounded-md bg-muted/20">
                      <User className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
                      <div className="space-y-0.5">
                        <div className="font-medium text-base">
                          {order.customer?.shopName || "Unknown Shop"}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {order.customer?.name}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs uppercase text-muted-foreground font-semibold tracking-wider">
                      Contact Details
                    </Label>
                    <div className="grid grid-cols-1 gap-2">
                      <div className="flex items-center gap-2 text-sm p-2 border rounded bg-white/50">
                        <Phone className="w-4 h-4 text-muted-foreground" />
                        <span className="font-medium">
                          {order.customer?.phone || "No Phone"}
                        </span>
                      </div>
                      <div className="flex items-start gap-2 text-sm p-2 border rounded bg-white/50">
                        <MapPin className="w-4 h-4 text-muted-foreground mt-0.5" />
                        <div className="flex flex-col">
                          <span className="font-medium">
                            {order.customer?.address || "No Address"}
                          </span>
                          {order.customer?.route && (
                            <Badge
                              variant="secondary"
                              className="w-fit mt-1 text-[10px] px-1.5 h-5"
                            >
                              {order.customer.route}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Order Meta */}
                <div className="space-y-4">
                  <div className="space-y-1">
                    <Label className="text-xs uppercase text-muted-foreground font-semibold tracking-wider">
                      Sales Representative
                    </Label>
                    <div className="flex items-center gap-3 p-3 border rounded-md bg-muted/20">
                      <Briefcase className="w-5 h-5 text-muted-foreground" />
                      <span className="text-sm font-medium">
                        {order.salesRep}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs uppercase text-muted-foreground font-semibold tracking-wider">
                      Payment Details
                    </Label>
                    <div className="flex items-center gap-3 p-3 border rounded-md bg-muted/20">
                      <CreditCard className="w-5 h-5 text-muted-foreground" />
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">Status:</span>
                        <Badge
                          variant={
                            order.paymentStatus === "Paid"
                              ? "default"
                              : "destructive"
                          }
                        >
                          {order.paymentStatus}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 2. Order Items Table (Editable) */}
          <Card>
            <CardHeader>
              <CardTitle>Order Items</CardTitle>
              <CardDescription>
                {isEditing
                  ? "Modify quantities and prices directly below."
                  : "Products included in this order"}
              </CardDescription>
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

                        {/* Editable Fields */}
                        <TableCell className="text-right">
                          {isEditing ? (
                            <Input
                              type="number"
                              className="w-24 text-right h-8 ml-auto"
                              value={item.price}
                              onChange={(e) =>
                                handleItemChange(
                                  item.id,
                                  "price",
                                  e.target.value
                                )
                              }
                            />
                          ) : (
                            item.price.toLocaleString()
                          )}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {isEditing ? (
                            <Input
                              type="number"
                              className="w-20 text-right h-8 ml-auto"
                              value={item.qty}
                              onChange={(e) =>
                                handleItemChange(item.id, "qty", e.target.value)
                              }
                            />
                          ) : (
                            item.qty
                          )}
                        </TableCell>
                        <TableCell className="text-right text-green-600">
                          {isEditing ? (
                            <Input
                              type="number"
                              className="w-20 text-right h-8 ml-auto border-green-200 focus:border-green-500"
                              value={item.free}
                              onChange={(e) =>
                                handleItemChange(
                                  item.id,
                                  "free",
                                  e.target.value
                                )
                              }
                            />
                          ) : item.free > 0 ? (
                            item.free
                          ) : (
                            "-"
                          )}
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
                      (a, b) =>
                        a + (Number(b.qty) || 0) + (Number(b.free) || 0),
                      0
                    )}
                  </span>
                </div>

                <Separator className="my-2" />

                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>LKR {subtotal.toLocaleString()}</span>
                </div>

                <Separator className="my-2" />

                <div className="flex justify-between items-center pt-2">
                  <span className="font-bold text-lg">Grand Total</span>
                  <span
                    className={`font-bold text-2xl ${
                      isEditing ? "text-amber-600" : "text-primary"
                    }`}
                  >
                    LKR {grandTotal.toLocaleString()}
                  </span>
                </div>
              </div>

              {!isEditing && (
                <Button
                  className="w-full h-12 text-lg"
                  variant="outline"
                  onClick={() => router.back()}
                >
                  Back to Orders
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Dialogs for Approve/Reject */}
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
