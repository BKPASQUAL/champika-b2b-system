"use client";

import React, { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  PackageCheck,
  Loader2,
  MapPin,
  Phone,
  ImageIcon,
  Calendar,
  Briefcase,
  CheckCircle2,
  AlertTriangle,
  Package,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function ProcessOrderPage({
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

  // State to track checked items for packing
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});

  useEffect(() => {
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
    fetchOrder();
  }, [id, router]);

  const toggleItemCheck = (itemId: string) => {
    setCheckedItems((prev) => ({
      ...prev,
      [itemId]: !prev[itemId],
    }));
  };

  const totalItems = items.length;
  const packedCount = Object.values(checkedItems).filter(Boolean).length;
  const progressPercentage =
    totalItems > 0 ? (packedCount / totalItems) * 100 : 0;
  const areAllItemsChecked = totalItems > 0 && packedCount === totalItems;

  // --- NEW: Toggle Select All Function ---
  const toggleSelectAll = () => {
    if (areAllItemsChecked) {
      // If all are currently checked, uncheck everything
      setCheckedItems({});
    } else {
      // Otherwise, check everything
      const allChecked: Record<string, boolean> = {};
      items.forEach((item) => {
        allChecked[item.id] = true;
      });
      setCheckedItems(allChecked);
    }
  };

  // Calculate total quantity for the header
  const totalQuantity = items.reduce((acc, i) => acc + i.qty + i.free, 0);

  const handleCompleteProcessing = async () => {
    if (!areAllItemsChecked) {
      if (
        !confirm(
          `You have only packed ${packedCount}/${totalItems} items. Proceed anyway?`
        )
      )
        return;
    } else {
      if (!confirm("Finish packing and move to Checking stage?")) return;
    }

    setProcessing(true);
    try {
      const res = await fetch(`/api/orders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "Checking" }),
      });

      if (!res.ok) throw new Error("Failed to update order");

      toast.success("Order moved to Checking!");
      router.push("/dashboard/admin/orders/processing");
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
    <div className="space-y-6 mx-auto pb-10">
      {/* --- Header Section --- */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 border-b pb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-3">
              Packing Order
              <Badge className="bg-blue-600 hover:bg-blue-700 text-sm px-2.5">
                {order.orderId}
              </Badge>
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Verify items and quantities before marking as ready for QC.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-6 md:gap-8 bg-slate-50 p-4 rounded-lg border border-slate-100">
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
          <Separator orientation="vertical" className="h-8 hidden md:block" />
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
          <Separator orientation="vertical" className="h-8 hidden md:block" />
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

      <div className="grid gap-6 lg:grid-cols-3">
        {/* --- LEFT COLUMN: Picking List --- */}
        <div className="lg:col-span-2 space-y-6">
          {/* Progress Card */}
          <Card className="bg-slate-50/50 border-slate-200">
            <CardContent className="pt-6">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-slate-700">
                  Packing Progress
                </span>
                <span className="text-sm font-bold text-slate-900">
                  {packedCount} / {totalItems} Items
                </span>
              </div>
              <div className="h-3 w-full bg-slate-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500 transition-all duration-500 ease-out"
                  style={{ width: `${progressPercentage}%` }}
                />
              </div>
            </CardContent>
          </Card>

          {/* Items Table Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PackageCheck className="w-5 h-5 text-primary" />
                Item Checklist
              </CardTitle>
              <CardDescription>
                Check off items as you pack them into the box.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50/50">
                      {/* --- MODIFIED: Select All Header --- */}
                      <TableHead className="w-[50px] text-center">
                        <Checkbox
                          checked={areAllItemsChecked}
                          onCheckedChange={toggleSelectAll}
                          aria-label="Select all"
                          className={cn(
                            "translate-y-[2px] w-5 h-5 border-2",
                            areAllItemsChecked
                              ? "border-green-600 bg-green-600 data-[state=checked]:bg-green-600 data-[state=checked]:border-green-600"
                              : "border-slate-400"
                          )}
                        />
                      </TableHead>
                      <TableHead>Product Details</TableHead>
                      <TableHead className="text-center w-[120px]">
                        Quantity
                      </TableHead>
                      <TableHead className="text-center w-[100px]">
                        Free
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item) => {
                      const isChecked = checkedItems[item.id] || false;
                      return (
                        <TableRow
                          key={item.id}
                          className={cn(
                            "cursor-pointer transition-colors",
                            isChecked ? "bg-slate-50" : "hover:bg-slate-50/50"
                          )}
                          onClick={() => toggleItemCheck(item.id)}
                        >
                          <TableCell className="text-center">
                            <Checkbox
                              checked={isChecked}
                              onCheckedChange={() => toggleItemCheck(item.id)}
                              onClick={(e) => e.stopPropagation()}
                              className={cn(
                                "w-6 h-6 border-2 data-[state=checked]:bg-green-600 data-[state=checked]:border-green-600",
                                isChecked
                                  ? "border-green-600"
                                  : "border-slate-300"
                              )}
                            />
                          </TableCell>
                          <TableCell>
                            <div className="flex items-start gap-4 py-1">
                              <div className="h-14 w-14 rounded-md border bg-white flex items-center justify-center overflow-hidden shrink-0 shadow-sm">
                                {item.image ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={item.image}
                                    alt={item.name}
                                    className={cn(
                                      "h-full w-full object-cover transition-opacity",
                                      isChecked
                                        ? "opacity-50 grayscale"
                                        : "opacity-100"
                                    )}
                                  />
                                ) : (
                                  <ImageIcon className="h-6 w-6 text-slate-300" />
                                )}
                              </div>
                              <div className="flex flex-col gap-0.5">
                                <span
                                  className={cn(
                                    "font-semibold text-base transition-all",
                                    isChecked
                                      ? "text-slate-500 line-through decoration-slate-400"
                                      : "text-slate-900"
                                  )}
                                >
                                  {item.name}
                                </span>
                                <span className="text-xs text-muted-foreground font-mono bg-slate-100 px-1.5 py-0.5 rounded w-fit">
                                  {item.sku}
                                </span>
                                <span className="text-xs text-muted-foreground mt-0.5">
                                  Unit: {item.unit}
                                </span>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <div
                              className={cn(
                                "flex items-center justify-center font-bold text-xl",
                                isChecked ? "text-slate-400" : "text-slate-900"
                              )}
                            >
                              {item.qty}
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            {item.free > 0 ? (
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
                  <MapPin className="w-4 h-4 text-primary shrink-0 mt-0.5" />
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
                  <Phone className="w-4 h-4 text-primary shrink-0" />
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

          <Card className="lg:sticky lg:top-6 shadow-md border-primary/20 bg-primary/5">
            <CardHeader>
              <CardTitle className="text-primary">Ready to Complete?</CardTitle>
              <CardDescription>
                Once all items are packed, move the order to the{" "}
                <strong>Checking</strong> stage.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                size="lg"
                className="w-full h-12 text-base font-semibold shadow-lg"
                onClick={handleCompleteProcessing}
                disabled={processing}
              >
                {processing ? (
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-5 h-5 mr-2" />
                )}
                Complete Packing
              </Button>
            </CardContent>
            {!areAllItemsChecked && (
              <CardFooter className="pb-4 pt-0">
                <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-md w-full border border-amber-100">
                  <AlertTriangle className="w-3 h-3" />
                  <span>
                    {totalItems - packedCount} items remaining to pack
                  </span>
                </div>
              </CardFooter>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
