"use client";

import React, { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Printer,
  FileText,
  Calendar,
  User,
  History,
  Edit,
  Loader2,
  Phone,
  CheckCircle2,
  Clock,
  Package,
  CreditCard,
  Building2,
  Banknote,
  AlertCircle,
  Truck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
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
  TableFooter,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// --- Types ---
// Assuming similar structure to Purchase interface but focused on View details
interface PurchaseDetail {
  id: string;
  purchaseId: string;
  invoiceNo?: string;
  purchaseDate: string;
  arrivalDate?: string;
  status: "Ordered" | "Received" | "Cancelled";
  paymentStatus: "Paid" | "Unpaid" | "Partial";
  totalAmount: number;
  paidAmount: number;
  supplier: {
    name: string;
    contactPerson?: string;
    phone?: string;
    email?: string;
    address?: string;
  };
  business?: {
    name: string;
  };
  items: {
    id: string;
    productName: string;
    sku: string;
    quantity: number;
    unit: string;
    unitCost: number; // Cost Price
    discount: number; // Discount Amount
    totalCost: number; // Final Line Total
    freeQuantity?: number;
  }[];
}

export default function ViewPurchasePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [purchase, setPurchase] = useState<PurchaseDetail | null>(null);

  useEffect(() => {
    const fetchPurchase = async () => {
      try {
        const res = await fetch(`/api/purchases/${id}`); // Ensure you have this API endpoint
        if (!res.ok) throw new Error("Failed to load purchase order");
        const data = await res.json();

        // Map API response to UI structure if needed, or use directly if matches
        setPurchase({
          ...data,
          // Ensure supplier object structure matches if API returns flat fields
          supplier: data.supplier || { name: data.supplierName },
          items: data.items || [],
        });
      } catch (error) {
        toast.error("Error loading purchase details");
        // Fallback or redirect
        // router.push("/dashboard/admin/purchases");
      } finally {
        setLoading(false);
      }
    };

    fetchPurchase();
  }, [id, router]);

  const getInitials = (name: string) => {
    return name
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .substring(0, 2)
      .toUpperCase();
  };

  const renderStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      Ordered: "bg-blue-50 text-blue-700 border-blue-200",
      Received: "bg-green-50 text-green-700 border-green-200",
      Cancelled: "bg-red-50 text-red-700 border-red-200",
    };

    const icons: Record<string, any> = {
      Ordered: Clock,
      Received: CheckCircle2,
      Cancelled: AlertCircle,
    };

    const Icon = icons[status] || FileText;

    return (
      <Badge
        variant="outline"
        className={`px-3 py-1 gap-1.5 ${styles[status] || "bg-gray-50"}`}
      >
        <Icon className="w-3.5 h-3.5" />
        {status}
      </Badge>
    );
  };

  const handlePrint = () => {
    window.print(); // Simple browser print for now, or implement PDF gen
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[80vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!purchase)
    return <div className="p-8 text-center">Purchase not found.</div>;

  // --- Calculations ---
  const balanceDue = purchase.totalAmount - purchase.paidAmount;
  const totalItemsQty = purchase.items.reduce(
    (acc, item) => acc + item.quantity,
    0
  );
  const totalFreeQty = purchase.items.reduce(
    (acc, item) => acc + (item.freeQuantity || 0),
    0
  );

  return (
    <div className="min-h-screen bg-muted/40 pb-20">
      <div className="mx-auto space-y-8">
        {/* --- Top Header Section --- */}
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 rounded-full bg-background"
                onClick={() => router.back()}
              >
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                Purchase Order {purchase.purchaseId}
              </h1>
              {renderStatusBadge(purchase.status)}
            </div>
            <div className="flex flex-col ml-11 gap-1">
              <p className="text-sm text-muted-foreground">
                Created on{" "}
                {new Date(purchase.purchaseDate).toLocaleDateString(undefined, {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </p>
              {purchase.invoiceNo && (
                <p className="text-xs font-mono text-muted-foreground">
                  Vendor Invoice: {purchase.invoiceNo}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 ml-11 md:ml-0 print:hidden">
            <Button
              variant="outline"
              size="sm"
              className="bg-background"
              onClick={handlePrint}
            >
              <Printer className="w-4 h-4 mr-2 text-muted-foreground" /> Print
            </Button>

            {/* Only allow edit if not cancelled/received or implement specific logic */}
            {purchase.status === "Ordered" && (
              <Button
                size="sm"
                onClick={
                  () => router.push(`/dashboard/admin/purchases/${id}/edit`) // Assuming Edit Page exists
                }
              >
                <Edit className="w-4 h-4 mr-2" /> Edit Order
              </Button>
            )}
          </div>
        </div>

        {/* --- Main Content Grid --- */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* LEFT COLUMN (Details & Items) */}
          <div className="lg:col-span-2 space-y-6">
            {/* Stakeholders Card */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Supplier Info */}
              <Card className="shadow-sm border-l-4 border-l-blue-500">
                <CardHeader className="pb-2">
                  <CardDescription className="text-xs font-semibold uppercase tracking-wider text-blue-600">
                    Vendor / Supplier
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex items-start gap-4">
                  <Avatar className="h-10 w-10 border bg-blue-50 text-blue-600">
                    <AvatarFallback>
                      {getInitials(purchase.supplier?.name || "Unknown")}
                    </AvatarFallback>
                  </Avatar>
                  <div className="space-y-1">
                    <h3 className="font-semibold text-base leading-none">
                      {purchase.supplier?.name}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {purchase.supplier?.contactPerson || "No Contact Person"}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1">
                      <Phone className="w-3 h-3" />{" "}
                      <span>{purchase.supplier?.phone || "N/A"}</span>
                    </div>
                    {purchase.supplier?.address && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {purchase.supplier.address}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Business / Receiver Info */}
              <Card className="shadow-sm">
                <CardHeader className="pb-2">
                  <CardDescription className="text-xs font-semibold uppercase tracking-wider">
                    Purchasing Business
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex items-start gap-4">
                  <Avatar className="h-10 w-10 border">
                    <AvatarFallback>
                      <Building2 className="w-5 h-5 text-muted-foreground" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="space-y-1">
                    <h3 className="font-semibold text-base leading-none">
                      {purchase.business?.name || "Champika Hardware"}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Authorized Purchase
                    </p>
                    {purchase.arrivalDate && (
                      <div className="flex items-center gap-2 text-xs text-green-600 mt-2 bg-green-50 px-2 py-1 rounded w-fit">
                        <Truck className="w-3 h-3" />
                        <span>
                          Expected:{" "}
                          {new Date(purchase.arrivalDate).toLocaleDateString()}
                        </span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Line Items Table */}
            <Card className="shadow-sm overflow-hidden">
              <CardHeader className="bg-slate-50/50 border-b py-4">
                <div className="flex justify-between items-center">
                  <CardTitle className="text-lg font-semibold">
                    Purchase Items
                  </CardTitle>
                  <Badge variant="outline" className="font-normal">
                    {purchase.items.length} Items
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50/50 hover:bg-slate-50/50">
                      <TableHead className="w-[40%] pl-6">
                        Product Details
                      </TableHead>
                      <TableHead className="text-center w-[10%]">Qty</TableHead>
                      <TableHead className="text-center w-[10%]">
                        Free
                      </TableHead>
                      <TableHead className="text-right w-[15%]">
                        Unit Cost
                      </TableHead>
                      <TableHead className="text-center w-[10%]">
                        Disc.
                      </TableHead>
                      <TableHead className="text-right w-[15%] pr-6">
                        Total
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {purchase.items.map((item: any) => (
                      <TableRow key={item.id} className="hover:bg-muted/30">
                        <TableCell className="pl-6 py-4">
                          <div className="flex items-start gap-3">
                            <div className="h-8 w-8 rounded bg-slate-100 flex items-center justify-center text-slate-400 shrink-0">
                              <Package className="w-4 h-4" />
                            </div>
                            <div>
                              <p className="font-medium text-sm text-foreground">
                                {item.productName}
                              </p>
                              <p className="text-xs font-mono text-muted-foreground mt-0.5">
                                {item.sku}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="font-medium">{item.quantity}</span>
                          <span className="text-xs text-muted-foreground ml-1">
                            {item.unit}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          {item.freeQuantity > 0 ? (
                            <Badge
                              variant="secondary"
                              className="px-1.5 h-5 text-[10px]"
                            >
                              {item.freeQuantity}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-sm">
                              -
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {item.unitCost.toLocaleString("en-LK", {
                            minimumFractionDigits: 2,
                          })}
                        </TableCell>
                        {/* Discount Amount Column */}
                        <TableCell className="text-center text-sm text-red-500">
                          {item.discount > 0
                            ? `-${item.discount.toLocaleString()}`
                            : "-"}
                        </TableCell>
                        <TableCell className="text-right pr-6 font-mono font-medium text-sm">
                          {item.totalCost.toLocaleString("en-LK", {
                            minimumFractionDigits: 2,
                          })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  <TableFooter className="bg-slate-50/50">
                    <TableRow>
                      <TableCell className="pl-6 font-semibold">
                        Total Qty
                      </TableCell>
                      <TableCell className="text-center font-semibold">
                        {totalItemsQty}
                      </TableCell>
                      <TableCell className="text-center font-semibold">
                        {totalFreeQty > 0 ? totalFreeQty : "-"}
                      </TableCell>
                      <TableCell colSpan={3} className="text-right pr-6">
                        <span className="text-xs text-muted-foreground uppercase mr-2">
                          Total Cost:
                        </span>
                        <span className="font-bold font-mono text-base">
                          LKR{" "}
                          {purchase.totalAmount.toLocaleString("en-LK", {
                            minimumFractionDigits: 2,
                          })}
                        </span>
                      </TableCell>
                    </TableRow>
                  </TableFooter>
                </Table>
              </CardContent>
            </Card>
          </div>

          {/* RIGHT COLUMN (Summary) */}
          <div className="space-y-6">
            <Card className="shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                  Order Metadata
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">PO Number</span>
                  <span className="text-sm font-mono bg-slate-100 px-2 py-0.5 rounded text-slate-700">
                    {purchase.purchaseId}
                  </span>
                </div>
                <Separator />
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Date Created</span>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="w-3.5 h-3.5" />
                    {new Date(purchase.purchaseDate).toLocaleDateString()}
                  </div>
                </div>
                <Separator />
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Payment Status</span>
                  <Badge
                    variant={
                      balanceDue <= 0
                        ? "default" // Paid
                        : purchase.paidAmount > 0
                        ? "secondary" // Partial
                        : "destructive" // Unpaid
                    }
                    className="rounded-full px-3"
                  >
                    {purchase.paymentStatus}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm border-t-4 border-t-primary sticky top-6">
              <CardHeader className="bg-muted/20 pb-4">
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-primary" />
                  Payment Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 pt-6">
                {/* Total Cost */}
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total Cost</span>
                  <span className="font-medium font-mono">
                    LKR{" "}
                    {purchase.totalAmount.toLocaleString("en-LK", {
                      minimumFractionDigits: 2,
                    })}
                  </span>
                </div>

                {purchase.paidAmount > 0 && (
                  <div className="flex justify-between text-sm text-emerald-600">
                    <span className="flex items-center gap-1">
                      <Banknote className="w-3 h-3" /> Paid Amount
                    </span>
                    <span className="font-medium font-mono">
                      - LKR{" "}
                      {purchase.paidAmount.toLocaleString("en-LK", {
                        minimumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                )}

                <Separator className="my-2" />

                <div className="flex justify-between items-end pb-2">
                  <span className="font-bold text-lg">Balance Due</span>
                  <div className="text-right">
                    <span
                      className={cn(
                        "block font-bold text-2xl font-mono tracking-tight",
                        balanceDue > 0 ? "text-red-600" : "text-emerald-600"
                      )}
                    >
                      LKR{" "}
                      {Math.max(0, balanceDue).toLocaleString("en-LK", {
                        minimumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
