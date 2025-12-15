"use client";

import React, { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ClipboardCheck,
  Loader2,
  MapPin,
  Phone,
  ImageIcon,
  Calendar,
  Briefcase,
  CheckCircle2,
  AlertTriangle,
  Package,
  ShieldCheck,
  Edit,
  Save,
  X,
  Trash2,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface OrderItem {
  id: string;
  productId: string;
  sku: string;
  name: string;
  unit: string;
  image: string | null;
  price: number;
  qty: number;
  free: number;
  total: number;
}

export default function CheckOrderPage({
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

  // --- Edit Mode State ---
  const [isEditing, setIsEditing] = useState(false);

  // State to track checked items for QC
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});

  // --- Dialog States ---
  const [isConfirmOpen, setIsConfirmOpen] = useState(false); // For "Pass QC"
  const [isSaveConfirmOpen, setIsSaveConfirmOpen] = useState(false); // For "Save Changes"

  const [confirmContent, setConfirmContent] = useState({
    title: "",
    description: "",
  });

  const fetchOrder = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/orders/${id}`);
      if (!res.ok) throw new Error("Failed to load order");
      const data = await res.json();
      setOrder(data);
      setItems(data.items);
    } catch (error) {
      toast.error("Could not fetch order data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrder();
  }, [id]);

  // --- QC Logic (Checkboxes) ---
  const toggleItemCheck = (itemId: string) => {
    if (isEditing) return; // Disable checking while editing
    setCheckedItems((prev) => ({
      ...prev,
      [itemId]: !prev[itemId],
    }));
  };

  const toggleSelectAll = () => {
    if (isEditing) return;
    if (areAllItemsChecked) {
      setCheckedItems({});
    } else {
      const allChecked: Record<string, boolean> = {};
      items.forEach((item) => {
        allChecked[item.id] = true;
      });
      setCheckedItems(allChecked);
    }
  };

  // --- Editing Logic ---
  const handleItemChange = (
    itemId: string,
    field: "qty" | "free",
    value: string
  ) => {
    const numValue = Math.max(0, parseInt(value) || 0);

    setItems((prevItems) =>
      prevItems.map((item) => {
        if (item.id === itemId) {
          const updatedItem = { ...item, [field]: numValue };
          // Recalculate total
          updatedItem.total = updatedItem.price * updatedItem.qty;
          return updatedItem;
        }
        return item;
      })
    );
  };

  const handleRemoveItem = (itemId: string) => {
    setItems((prev) => prev.filter((i) => i.id !== itemId));
    const newChecked = { ...checkedItems };
    delete newChecked[itemId];
    setCheckedItems(newChecked);
    toast.info("Item removed. Save changes to apply.");
  };

  const saveOrderChanges = async () => {
    setProcessing(true);
    setIsSaveConfirmOpen(false);

    // Recalculate Grand Total
    const newTotalAmount = items.reduce((acc, item) => acc + item.total, 0);

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

      toast.success("Order Updated Successfully!");
      setIsEditing(false);
      fetchOrder();
    } catch (error: any) {
      toast.error(error.message || "Failed to save changes");
    } finally {
      setProcessing(false);
    }
  };

  const cancelEditing = () => {
    setIsEditing(false);
    fetchOrder();
  };

  // --- Calculations ---
  const totalItems = items.length;
  const checkedCount = Object.values(checkedItems).filter(Boolean).length;
  const progressPercentage =
    totalItems > 0 ? (checkedCount / totalItems) * 100 : 0;
  const areAllItemsChecked = totalItems > 0 && checkedCount === totalItems;
  const totalQuantity = items.reduce((acc, i) => acc + i.qty + i.free, 0);

  // --- Status Update Logic ---
  const handleCompleteChecking = () => {
    if (isEditing) {
      toast.warning("Please save or cancel your changes first.");
      return;
    }

    if (!areAllItemsChecked) {
      setConfirmContent({
        title: "Incomplete QC",
        description: `You have only verified ${checkedCount}/${totalItems} items. Are you sure you want to proceed anyway?`,
      });
    } else {
      setConfirmContent({
        title: "Pass Quality Control",
        description:
          "Are you sure you want to mark this order as Verified and move it to the Loading stage?",
      });
    }
    setIsConfirmOpen(true);
  };

  const confirmStatusUpdate = async () => {
    setIsConfirmOpen(false);
    setProcessing(true);

    try {
      const res = await fetch(`/api/orders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "Loading" }),
      });

      if (!res.ok) throw new Error("Failed to update order");

      toast.success("QC Passed! Order moved to Loading.");
      router.push("/dashboard/office/distribution/orders/checking");
    } catch (error) {
      toast.error("Something went wrong");
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center h-[calc(100vh-200px)]">
        <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground animate-pulse">
          Loading Order Details...
        </p>
      </div>
    );
  }

  if (!order) return null;

  return (
    <div className="">
      {/* --- Header Section --- */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6 border-b pb-2">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-3 flex-wrap">
              Checking Order
              <Badge className="bg-purple-600 hover:bg-purple-700 text-sm px-2.5">
                {order.orderId}
              </Badge>
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Perform quality control checks before loading.
            </p>
          </div>
        </div>

        {/* Header Actions & Stats */}
        <div className="flex flex-col sm:flex-row gap-4 w-full xl:w-auto">
          {/* Stats Grid - 4 Columns */}
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-lg border border-slate-100 flex-1">
            {/* Invoice No */}
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white rounded-md border shadow-sm text-slate-500">
                <FileText className="w-4 h-4" />
              </div>
              <div className="flex flex-col">
                <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                  Invoice No
                </span>
                <span className="font-semibold text-sm text-slate-900">
                  {order.invoiceNo || "N/A"}
                </span>
              </div>
            </div>

            {/* Date */}
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white rounded-md border shadow-sm text-slate-500">
                <Calendar className="w-4 h-4" />
              </div>
              <div className="flex flex-col">
                <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                  Date
                </span>
                <span className="font-semibold text-sm text-slate-900">
                  {new Date(order.date).toLocaleDateString()}
                </span>
              </div>
            </div>

            {/* Sales Rep */}
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white rounded-md border shadow-sm text-slate-500">
                <Briefcase className="w-4 h-4" />
              </div>
              <div className="flex flex-col">
                <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                  Sales Rep
                </span>
                <span className="font-semibold text-sm text-slate-900">
                  {order.salesRep}
                </span>
              </div>
            </div>

            {/* Total Qty */}
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white rounded-md border shadow-sm text-slate-500">
                <Package className="w-4 h-4" />
              </div>
              <div className="flex flex-col">
                <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                  Total Qty
                </span>
                <span className="font-bold text-lg leading-none text-primary">
                  {totalQuantity}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3 mt-6 bh">
        {/* --- LEFT COLUMN: QC Checklist --- */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="">
            <CardHeader className="pb-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <CardTitle className="flex items-center gap-2">
                    <ClipboardCheck className="w-5 h-5 text-purple-600" />
                    QC Checklist
                  </CardTitle>
                  <CardDescription>
                    {isEditing
                      ? "Correct item quantities or remove items."
                      : "Verify items against the packing list."}
                  </CardDescription>
                </div>

                {/* Actions: Edit / Save / Progress */}
                <div className="flex items-center gap-2">
                  {isEditing ? (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={cancelEditing}
                        disabled={processing}
                      >
                        <X className="w-4 h-4 mr-2" /> Cancel
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => setIsSaveConfirmOpen(true)}
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
                        onClick={() => setIsEditing(true)}
                      >
                        <Edit className="w-4 h-4 mr-2" /> Edit Order
                      </Button>
                      {/* Progress Bar */}
                      <div className="w-[120px] hidden sm:flex flex-col gap-1 ml-4">
                        <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                          <div
                            className="h-full bg-purple-600 transition-all duration-500 ease-out"
                            style={{ width: `${progressPercentage}%` }}
                          />
                        </div>
                        <div className="text-[10px] text-center text-muted-foreground">
                          {checkedCount} / {totalItems} Verified
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50/50">
                      <TableHead className="w-[50px] text-center">
                        {!isEditing && (
                          <Checkbox
                            checked={areAllItemsChecked}
                            onCheckedChange={toggleSelectAll}
                            aria-label="Select all"
                            className={cn(
                              "translate-y-[2px] w-5 h-5 border-2",
                              areAllItemsChecked
                                ? "border-purple-600 bg-purple-600"
                                : "border-slate-400"
                            )}
                          />
                        )}
                      </TableHead>
                      <TableHead className="min-w-[200px]">
                        Product Details
                      </TableHead>
                      <TableHead className="text-center w-[120px]">
                        Quantity
                      </TableHead>
                      <TableHead className="text-center w-[100px]">
                        Free
                      </TableHead>
                      {isEditing && (
                        <TableHead className="w-[50px]"></TableHead>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item) => {
                      const isChecked = checkedItems[item.id] || false;
                      return (
                        <TableRow
                          key={item.id}
                          className={cn(
                            "transition-colors",
                            !isEditing && "cursor-pointer",
                            isChecked && !isEditing
                              ? "bg-slate-50"
                              : "hover:bg-slate-50/50"
                          )}
                          onClick={() => !isEditing && toggleItemCheck(item.id)}
                        >
                          <TableCell className="text-center">
                            {!isEditing && (
                              <Checkbox
                                checked={isChecked}
                                onCheckedChange={() => toggleItemCheck(item.id)}
                                onClick={(e) => e.stopPropagation()}
                                className={cn(
                                  "w-6 h-6 border-2",
                                  isChecked
                                    ? "border-purple-600 data-[state=checked]:bg-purple-600"
                                    : "border-slate-300"
                                )}
                              />
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-start gap-4 py-1">
                              {/* IMAGE RENDERING */}
                              <div className="h-14 w-14 rounded-md border bg-white flex items-center justify-center overflow-hidden shrink-0 shadow-sm">
                                {item.image ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={item.image}
                                    alt={item.name}
                                    className={cn(
                                      "h-full w-full object-cover transition-opacity",
                                      isChecked && !isEditing
                                        ? "opacity-50 grayscale"
                                        : "opacity-100"
                                    )}
                                  />
                                ) : (
                                  <ImageIcon className="h-6 w-6 text-slate-300" />
                                )}
                              </div>
                              <div className="flex flex-col gap-0.5 min-w-0">
                                <span
                                  className={cn(
                                    "font-semibold text-base transition-all truncate",
                                    isChecked && !isEditing
                                      ? "text-slate-500 line-through decoration-slate-400"
                                      : "text-slate-900"
                                  )}
                                >
                                  {item.name}
                                </span>
                                <span className="text-xs text-muted-foreground font-mono bg-slate-100 px-1.5 py-0.5 rounded w-fit">
                                  {item.sku}
                                </span>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            {isEditing ? (
                              <Input
                                type="number"
                                min="1"
                                className="w-20 text-center h-8 mx-auto"
                                value={item.qty}
                                onChange={(e) =>
                                  handleItemChange(
                                    item.id,
                                    "qty",
                                    e.target.value
                                  )
                                }
                                onClick={(e) => e.stopPropagation()}
                              />
                            ) : (
                              <div
                                className={cn(
                                  "flex items-center justify-center font-bold text-xl",
                                  isChecked
                                    ? "text-slate-400"
                                    : "text-slate-900"
                                )}
                              >
                                {item.qty}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            {isEditing ? (
                              <Input
                                type="number"
                                min="0"
                                className="w-16 text-center h-8 mx-auto border-green-200 focus:border-green-500"
                                value={item.free}
                                onChange={(e) =>
                                  handleItemChange(
                                    item.id,
                                    "free",
                                    e.target.value
                                  )
                                }
                                onClick={(e) => e.stopPropagation()}
                              />
                            ) : item.free > 0 ? (
                              <Badge
                                variant="secondary"
                                className={cn(
                                  "font-bold",
                                  isChecked
                                    ? "bg-slate-200 text-slate-500"
                                    : "bg-green-100 text-green-700 border-green-200"
                                )}
                              >
                                +{item.free}
                              </Badge>
                            ) : (
                              <span className="text-slate-300 font-medium">
                                -
                              </span>
                            )}
                          </TableCell>

                          {/* Delete Button (Edit Mode Only) */}
                          {isEditing && (
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRemoveItem(item.id);
                                }}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </TableCell>
                          )}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* --- RIGHT COLUMN: Info & Actions --- */}
        <div className="lg:col-span-1 space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                Customer Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col gap-1">
                <span className="text-lg font-bold">
                  {order.customer?.shopName}
                </span>
                <span className="text-sm text-muted-foreground">
                  {order.customer?.name}
                </span>
              </div>
              <Separator />
              <div className="space-y-3 text-sm">
                <div className="flex items-start gap-3">
                  <MapPin className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
                  <div className="flex flex-col">
                    <span className="font-medium">Route / Area</span>
                    <span className="text-muted-foreground">
                      {order.customer?.route}
                    </span>
                    <span className="text-xs text-muted-foreground mt-0.5">
                      {order.customer?.address}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Phone className="w-4 h-4 text-purple-600 shrink-0" />
                  <div className="flex flex-col">
                    <span className="font-medium">Contact</span>
                    <span className="text-muted-foreground">
                      {order.customer?.phone}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card
            className={cn(
              "lg:sticky lg:top-6 shadow-md border-purple-200 bg-purple-50/30",
              isEditing && "opacity-50 pointer-events-none"
            )}
          >
            <CardHeader>
              <CardTitle className="text-purple-700">QC Completed?</CardTitle>
              <CardDescription>
                Once verified, move the order to the <strong>Loading</strong>{" "}
                stage.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                size="lg"
                className="w-full h-12 text-base font-semibold shadow-lg bg-purple-600 hover:bg-purple-700 text-white"
                onClick={handleCompleteChecking}
                disabled={processing || isEditing}
              >
                {processing ? (
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                ) : (
                  <ShieldCheck className="w-5 h-5 mr-2" />
                )}
                Pass Quality Control
              </Button>
            </CardContent>
            {!areAllItemsChecked && !isEditing && (
              <CardFooter className="pb-4 pt-0">
                <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-md w-full border border-amber-100">
                  <AlertTriangle className="w-3 h-3" />
                  <span>
                    {totalItems - checkedCount} items pending verification
                  </span>
                </div>
              </CardFooter>
            )}
          </Card>
        </div>
      </div>

      {/* --- Confirmation Alert Dialog (QC Pass) --- */}
      <AlertDialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmContent.title}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmContent.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setIsConfirmOpen(false)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmStatusUpdate}
              className="bg-purple-600 hover:bg-purple-700"
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* --- Save Confirmation Dialog (New) --- */}
      <AlertDialog open={isSaveConfirmOpen} onOpenChange={setIsSaveConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Save Changes?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to save the changes to this order? This will
              update the inventory and invoice amount.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setIsSaveConfirmOpen(false)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={saveOrderChanges}
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
