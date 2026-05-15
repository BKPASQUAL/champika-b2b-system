"use client";

import React, { useState, useEffect, use } from "react";
import { useOrderLock } from "@/hooks/useOrderLock";
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
  Printer,
} from "lucide-react";
import { printOrder } from "@/app/lib/order-html";
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

  useOrderLock(id);

  const [order, setOrder] = useState<any>(null);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [lastCheckedInvoice, setLastCheckedInvoice] = useState<string | null>(null);

  useEffect(() => {
    setLastCheckedInvoice(localStorage.getItem("checking_last_invoice"));
  }, []);

  // --- Edit Mode State ---
  const [isEditing, setIsEditing] = useState(false);
  const [deletedItemIds, setDeletedItemIds] = useState<string[]>([]);

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
    setDeletedItemIds((prev) => [...prev, itemId]);
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
          deletedItemIds: deletedItemIds,
          totalAmount: newTotalAmount,
        }),
      });

      if (!res.ok) throw new Error("Failed to update order");

      toast.success("Order Updated Successfully!");
      setIsEditing(false);
      setDeletedItemIds([]);
      fetchOrder();
    } catch (error: any) {
      toast.error(error.message || "Failed to save changes");
    } finally {
      setProcessing(false);
    }
  };

  const cancelEditing = () => {
    setIsEditing(false);
    setDeletedItemIds([]);
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
      toast.error(`Please verify all items first. ${checkedCount}/${totalItems} checked.`);
      return;
    }

    setConfirmContent({
      title: "Pass Quality Control",
      description:
        "Are you sure you want to mark this order as Verified and move it to the Loading stage?",
    });
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

      if (order?.invoiceNo) {
        localStorage.setItem("checking_last_invoice", order.invoiceNo);
      }
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
      <div className="flex justify-center items-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!order) return null;

  return (
    <div className="pb-24 lg:pb-0">
      {/* --- Header Section --- */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b pb-2">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="shrink-0" onClick={() => router.back()}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2 flex-wrap">
              Checking Order
              <Badge className="bg-purple-600 hover:bg-purple-700 text-xs px-2">
                {order.orderId}
              </Badge>
            </h1>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="flex items-center gap-1.5 font-mono font-bold text-purple-700 bg-purple-50 border border-purple-200 px-2.5 py-0.5 rounded text-sm">
                <FileText className="h-3.5 w-3.5" />
                {order.invoiceNo || "N/A"}
              </span>
              {lastCheckedInvoice && lastCheckedInvoice !== order.invoiceNo && (
                <span className="flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded font-medium">
                  <CheckCircle2 className="h-3 w-3" />
                  Last checked: <span className="font-mono font-bold">{lastCheckedInvoice}</span>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Header Actions & Stats */}
        <div className="flex items-center gap-2 lg:w-auto">
          <Button variant="outline" size="sm" className="shrink-0" onClick={() => printOrder(order, items)}>
            <Printer className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">Print</span>
          </Button>
          <div className="grid grid-cols-4 gap-1 sm:gap-3 bg-slate-50 px-2 py-2 sm:p-3 rounded-lg border border-slate-100 flex-1 min-w-0">
            <div className="flex items-center gap-1 sm:gap-2 min-w-0">
              <div className="hidden sm:flex p-1.5 bg-white rounded-md border shadow-sm text-slate-500 shrink-0">
                <FileText className="w-3.5 h-3.5" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-[9px] sm:text-xs text-muted-foreground uppercase tracking-wide truncate">Invoice</span>
                <span className="font-semibold text-[10px] sm:text-sm text-slate-900 truncate">{order.invoiceNo || "N/A"}</span>
              </div>
            </div>
            <div className="flex items-center gap-1 sm:gap-2 min-w-0">
              <div className="hidden sm:flex p-1.5 bg-white rounded-md border shadow-sm text-slate-500 shrink-0">
                <Calendar className="w-3.5 h-3.5" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-[9px] sm:text-xs text-muted-foreground uppercase tracking-wide">Date</span>
                <span className="font-semibold text-[10px] sm:text-sm text-slate-900">{new Date(order.date).toLocaleDateString()}</span>
              </div>
            </div>
            <div className="flex items-center gap-1 sm:gap-2 min-w-0">
              <div className="hidden sm:flex p-1.5 bg-white rounded-md border shadow-sm text-slate-500 shrink-0">
                <Briefcase className="w-3.5 h-3.5" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-[9px] sm:text-xs text-muted-foreground uppercase tracking-wide">Rep</span>
                <span className="font-semibold text-[10px] sm:text-sm text-slate-900 truncate">{order.salesRep}</span>
              </div>
            </div>
            <div className="flex items-center gap-1 sm:gap-2 min-w-0">
              <div className="hidden sm:flex p-1.5 bg-white rounded-md border shadow-sm text-slate-500 shrink-0">
                <Package className="w-3.5 h-3.5" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-[9px] sm:text-xs text-muted-foreground uppercase tracking-wide">Qty</span>
                <span className="font-bold text-sm sm:text-lg leading-none text-primary">{totalQuantity}</span>
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
                      <TableHead>
                        Product Details
                      </TableHead>
                      <TableHead className="text-center w-20 sm:w-[120px]">
                        Qty
                      </TableHead>
                      <TableHead className="text-center w-[60px] sm:w-[100px]">
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
                            <div className="flex items-start gap-2 sm:gap-4 py-1">
                              {/* IMAGE RENDERING */}
                              <div className="h-9 w-9 sm:h-14 sm:w-14 rounded-md border bg-white flex items-center justify-center overflow-hidden shrink-0 shadow-sm">
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
                                    "font-semibold text-xs sm:text-base transition-all truncate",
                                    isChecked && !isEditing
                                      ? "text-slate-500 line-through decoration-slate-400"
                                      : "text-slate-900"
                                  )}
                                >
                                  {item.name}
                                </span>
                                <div className="flex items-center gap-1 flex-wrap">
                                  <span className="text-xs text-muted-foreground font-mono bg-slate-100 px-1.5 py-0.5 rounded">
                                    {item.sku}
                                  </span>
                                  <span className="text-xs text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                                    {item.unit}
                                  </span>
                                  <span className="text-xs text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                                    Rs. {item.price.toFixed(2)}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            {isEditing ? (
                              <div className="flex items-center gap-1 justify-center">
                                <Input
                                  type="number"
                                  min="1"
                                  className="w-20 text-center h-8"
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
                                <span className="text-xs text-muted-foreground shrink-0">{item.unit}</span>
                              </div>
                            ) : (
                              <div
                                className={cn(
                                  "flex items-center justify-center font-bold text-xl",
                                  isChecked
                                    ? "text-slate-400"
                                    : "text-slate-900"
                                )}
                              >
                                {item.qty}{" "}
                                <span className="text-xs font-normal text-muted-foreground ml-1">({item.unit})</span>
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            {isEditing ? (
                              <div className="flex items-center gap-1 justify-center">
                                <Input
                                  type="number"
                                  min="0"
                                  className="w-16 text-center h-8 border-green-200 focus:border-green-500"
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
                              </div>
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
              "hidden lg:block lg:sticky lg:top-6 shadow-md border-purple-200 bg-purple-50/30",
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
                disabled={processing || isEditing || !areAllItemsChecked}
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

      {/* --- Mobile Sticky Action Bar --- */}
      <div className="lg:hidden fixed bottom-0 inset-x-0 z-20 bg-background border-t shadow-lg px-4 py-3">
        {isEditing ? (
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={cancelEditing} disabled={processing}>
              <X className="w-4 h-4 mr-2" /> Cancel
            </Button>
            <Button className="flex-1 bg-green-600 hover:bg-green-700" onClick={() => setIsSaveConfirmOpen(true)} disabled={processing}>
              {processing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Save Changes
            </Button>
          </div>
        ) : (
          <Button
            size="lg"
            className="w-full h-11 font-semibold bg-purple-600 hover:bg-purple-700 text-white"
            onClick={handleCompleteChecking}
            disabled={processing || !areAllItemsChecked}
          >
            {processing ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <ShieldCheck className="w-5 h-5 mr-2" />}
            Pass Quality Control
          </Button>
        )}
      </div>
    </div>
  );
}
