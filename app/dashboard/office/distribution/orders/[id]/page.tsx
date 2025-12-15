"use client";

import React, { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Printer,
  CheckCircle2,
  User,
  Phone,
  Briefcase,
  Loader2,
  XCircle,
  Edit,
  Save,
  X,
  Trash2,
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

interface OrderItem {
  id: string;
  sku: string;
  name: string;
  unit: string;
  price: number;
  qty: number;
  free: number;
  discountPercent: number;
  discountAmount: number;
  total: number;
  productId?: string;
}

export default function ViewOrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const [order, setOrder] = useState<any>(null);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  // Edit Mode State
  const [isEditing, setIsEditing] = useState(false);

  // Dialog States
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [showSaveConfirmDialog, setShowSaveConfirmDialog] = useState(false); // New State for Save Dialog

  // --- 1. Fetch Order Data ---
  const fetchOrderDetails = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/orders/${id}`);

      if (!res.ok) throw new Error("Failed to load order");

      const data = await res.json();
      setOrder(data);

      const mappedItems = data.items.map((item: any) => {
        const grossAmount = item.price * item.qty;
        const netAmount = item.total;
        const discountAmount = Math.max(0, grossAmount - netAmount);
        const discountPercent =
          grossAmount > 0 ? (discountAmount / grossAmount) * 100 : 0;

        return {
          ...item,
          discountPercent: parseFloat(discountPercent.toFixed(2)),
          discountAmount: discountAmount,
        };
      });

      setItems(mappedItems);
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
          const gross = updatedItem.price * updatedItem.qty;
          const discountAmt = (gross * updatedItem.discountPercent) / 100;
          updatedItem.discountAmount = discountAmt;
          updatedItem.total = gross - discountAmt;
          return updatedItem;
        }
        return item;
      })
    );
  };

  const handleRemoveItem = (itemId: string) => {
    setItems((prevItems) => prevItems.filter((item) => item.id !== itemId));
    toast.info("Item removed. Click 'Save Changes' to apply.");
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

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to update order");
      }

      toast.success("Order updated successfully!");
      setIsEditing(false);
      fetchOrderDetails();
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Failed to save changes");
    } finally {
      setProcessing(false);
      setShowSaveConfirmDialog(false); // Close the dialog
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
    } catch (error: any) {
      toast.error(error.message || "Failed to update status");
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
    } catch (error: any) {
      toast.error(error.message || "Failed to cancel order");
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

  const totalItemGross = items.reduce(
    (acc, item) => acc + item.price * item.qty,
    0
  );
  const totalItemDiscounts = items.reduce(
    (acc, item) => acc + item.discountAmount,
    0
  );
  const subtotal = items.reduce((acc, item) => acc + item.total, 0);
  const finalGrandTotal = isEditing ? subtotal : order.totalAmount;
  const extraDiscountAmount = Math.max(0, subtotal - finalGrandTotal);
  const extraDiscountPercent =
    subtotal > 0 ? (extraDiscountAmount / subtotal) * 100 : 0;

  return (
    <div className="space-y-6 mx-auto pb-10">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.back()}
            className="h-9 w-9"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight">
                {isEditing ? "Edit Order" : "Order Details"}
              </h1>
              <Badge
                variant={order.status === "Pending" ? "secondary" : "outline"}
                className="font-medium"
              >
                {order.status}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              Order #{order.orderId} •{" "}
              {new Date(order.date).toLocaleDateString()}
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          {isEditing ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsEditing(false);
                  fetchOrderDetails();
                }}
                disabled={processing}
              >
                <X className="w-4 h-4 mr-2" /> Cancel
              </Button>
              <Button
                size="sm"
                onClick={() => setShowSaveConfirmDialog(true)} // Open Confirmation Dialog
                disabled={processing}
                className="bg-green-600 hover:bg-green-700"
              >
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
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.print()}
              >
                <Printer className="w-4 h-4 mr-2" /> Print
              </Button>

              {order.status === "Pending" && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsEditing(true)}
                    className="bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 hover:text-blue-800"
                  >
                    <Edit className="w-4 h-4 mr-2" /> Edit Order
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                    onClick={() => setShowRejectDialog(true)}
                    disabled={processing}
                  >
                    <XCircle className="w-4 h-4 mr-2" /> Reject
                  </Button>
                  <Button
                    size="sm"
                    className="bg-green-600 hover:bg-green-700 text-white"
                    onClick={() => setShowApproveDialog(true)}
                    disabled={processing}
                  >
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Approve
                  </Button>
                </>
              )}
            </>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader className="">
              <CardTitle className="text-lg">Customer & Invoice</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-gradient-to-r from-blue-50 to-blue-100/50 p-4 rounded-lg border border-blue-200">
                <div className="flex justify-between items-center">
                  <div>
                    <Label className="text-xs text-blue-600 font-semibold uppercase tracking-wide">
                      Invoice Number
                    </Label>
                    <div className="text-2xl font-bold text-blue-900 mt-1 font-mono">
                      {order.invoiceNo || "N/A"}
                    </div>
                  </div>
                  <div className="text-right space-y-1">
                    <div className="text-xs text-muted-foreground">
                      Order ID:{" "}
                      <span className="font-mono font-medium text-foreground">
                        {order.orderId}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Payment:{" "}
                      <Badge
                        variant={
                          order.paymentStatus === "Paid"
                            ? "default"
                            : "destructive"
                        }
                        className="ml-1 text-[10px] h-5"
                      >
                        {order.paymentStatus}
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground font-semibold uppercase">
                    Customer
                  </Label>
                  <div className="p-3 border rounded-lg bg-muted/30">
                    <div className="flex items-start gap-2">
                      <User className="w-4 h-4 text-muted-foreground mt-0.5" />
                      <div>
                        <div className="font-semibold">
                          {order.customer?.shopName || "Unknown"}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {order.customer?.name}
                        </div>
                        <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                          <Phone className="w-3 h-3" />
                          {order.customer?.phone || "N/A"}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground font-semibold uppercase">
                    Sales Rep
                  </Label>
                  <div className="p-3 border rounded-lg bg-muted/30">
                    <div className="flex items-center gap-2">
                      <Briefcase className="w-4 h-4 text-muted-foreground" />
                      <span className="font-medium">{order.salesRep}</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Order Items</CardTitle>
                  <CardDescription className="text-xs mt-1">
                    {isEditing
                      ? "Modify quantities, prices or discounts"
                      : `${items.length} items in this order`}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="w-[80px]">SKU</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead className="text-right w-[70px]">
                        Unit
                      </TableHead>
                      <TableHead className="text-right w-[100px]">
                        Price
                      </TableHead>
                      <TableHead className="text-center w-[80px]">
                        Qty
                      </TableHead>
                      <TableHead className="text-center w-[70px] text-green-600">
                        Free
                      </TableHead>
                      <TableHead className="text-center w-[90px]">
                        Discount
                      </TableHead>
                      <TableHead className="text-right w-[110px]">
                        Total
                      </TableHead>
                      {isEditing && (
                        <TableHead className="w-[50px]"></TableHead>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={isEditing ? 9 : 8}
                          className="text-center py-8 text-muted-foreground"
                        >
                          No items in this order
                        </TableCell>
                      </TableRow>
                    ) : (
                      items.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-mono text-xs text-muted-foreground">
                            {item.sku}
                          </TableCell>
                          <TableCell className="font-medium text-sm">
                            {item.name}
                          </TableCell>
                          <TableCell className="text-right text-xs text-muted-foreground">
                            {item.unit}
                          </TableCell>
                          <TableCell className="text-right">
                            {isEditing ? (
                              <Input
                                type="number"
                                className="w-20 text-right h-8 ml-auto text-sm px-1"
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
                              <span className="text-sm">
                                {item.price.toLocaleString()}
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            {isEditing ? (
                              <Input
                                type="number"
                                className="w-14 text-center h-8 mx-auto text-sm font-medium px-1"
                                value={item.qty}
                                onChange={(e) =>
                                  handleItemChange(
                                    item.id,
                                    "qty",
                                    e.target.value
                                  )
                                }
                              />
                            ) : (
                              <span className="font-medium">{item.qty}</span>
                            )}
                          </TableCell>
                          <TableCell className="text-center text-green-600">
                            {isEditing ? (
                              <Input
                                type="number"
                                className="w-14 text-center h-8 mx-auto text-sm border-green-200 focus:border-green-500 px-1"
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
                              <span className="font-medium">{item.free}</span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            {isEditing ? (
                              <div className="flex items-center justify-center gap-1">
                                <Input
                                  type="number"
                                  className="w-12 text-center h-8 text-sm px-1"
                                  value={item.discountPercent}
                                  onChange={(e) =>
                                    handleItemChange(
                                      item.id,
                                      "discountPercent",
                                      e.target.value
                                    )
                                  }
                                />
                                <span className="text-xs text-muted-foreground">
                                  %
                                </span>
                              </div>
                            ) : (
                              <div className="flex flex-col items-center">
                                {item.discountPercent > 0 ? (
                                  <>
                                    <span className="text-xs font-medium text-red-500">
                                      {item.discountPercent}%
                                    </span>
                                    <span className="text-[10px] text-muted-foreground">
                                      (-{item.discountAmount.toLocaleString()})
                                    </span>
                                  </>
                                ) : (
                                  <span className="text-muted-foreground">
                                    -
                                  </span>
                                )}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-bold text-sm">
                            {item.total.toLocaleString()}
                          </TableCell>
                          {isEditing && (
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                                onClick={() => handleRemoveItem(item.id)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </TableCell>
                          )}
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-1">
          <Card className="sticky top-6">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">Order Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2.5">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total Items</span>
                  <span className="font-medium">{items.length}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total Units</span>
                  <span className="font-medium">
                    {items.reduce(
                      (a, b) =>
                        a + (Number(b.qty) || 0) + (Number(b.free) || 0),
                      0
                    )}
                  </span>
                </div>
                <Separator />
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Gross Amount</span>
                  <span className="font-medium">
                    LKR {totalItemGross.toLocaleString()}
                  </span>
                </div>
                {totalItemDiscounts > 0 && (
                  <div className="flex justify-between text-sm text-red-600">
                    <span>Item Discounts</span>
                    <span>- LKR {totalItemDiscounts.toLocaleString()}</span>
                  </div>
                )}
                <Separator className="opacity-50" />
                <div className="flex justify-between text-sm">
                  <span className="text-slate-700 font-medium">Subtotal</span>
                  <span className="font-bold">
                    LKR {subtotal.toLocaleString()}
                  </span>
                </div>
                {extraDiscountAmount > 0 && (
                  <div className="flex justify-between text-sm text-red-600">
                    <span>
                      Extra Discount{" "}
                      <span className="text-xs ml-1 bg-red-50 px-1 rounded">
                        ({extraDiscountPercent.toFixed(1)}%)
                      </span>
                    </span>
                    <span>- LKR {extraDiscountAmount.toLocaleString()}</span>
                  </div>
                )}
                <Separator className="border-t-2" />
                <div className="flex justify-between items-center pt-1">
                  <span className="font-bold text-lg">Grand Total</span>
                  <span className="font-bold text-2xl text-primary">
                    LKR {finalGrandTotal.toLocaleString()}
                  </span>
                </div>
              </div>
              {!isEditing && (
                <Button
                  className="w-full mt-4"
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

      {/* Approve Dialog */}
      <AlertDialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Approve Order</AlertDialogTitle>
            <AlertDialogDescription>
              Confirm approval of order #{order.orderId}? This will move it to{" "}
              <strong>Processing</strong> status.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
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

      {/* Reject Dialog */}
      <AlertDialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject Order</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to reject order #{order.orderId}? This will
              mark it as <strong>Cancelled</strong>.
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

      {/* Save Confirmation Dialog */}
      <AlertDialog
        open={showSaveConfirmDialog}
        onOpenChange={setShowSaveConfirmDialog}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Save Changes</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to save the changes to this order? This
              action will update the order details.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={saveChanges}
              className="bg-green-600 hover:bg-green-700"
            >
              Save Changes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
