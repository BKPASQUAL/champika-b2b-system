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
  MapPin,
  Mail,
  Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// --- Types ---
interface PurchaseItem {
  id: string;
  productName: string;
  sku: string;
  quantity: number;
  unit: string;
  unitCost: number; // Cost Price
  discount: number; // Discount Amount
  totalCost: number; // Final Line Total
  freeQuantity?: number;
}

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
  notes?: string;
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
  items: PurchaseItem[];
  payments?: any[];
}

export default function OrangeViewBillPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [bill, setBill] = useState<PurchaseDetail | null>(null);

  // History State
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    const fetchBill = async () => {
      try {
        const res = await fetch(`/api/purchases/${id}`);
        if (!res.ok) throw new Error("Failed to load bill");
        const data = await res.json();

        setBill({
          ...data,
          supplier: data.supplier || { name: data.supplierName },
          items: data.items || [],
        });
      } catch (error) {
        toast.error("Error loading bill details");
        router.push("/dashboard/office/orange/purchases");
      } finally {
        setLoading(false);
      }
    };

    fetchBill();
  }, [id, router]);

  const fetchHistory = async () => {
    setHistoryLoading(true);
    setTimeout(() => {
      setHistoryLoading(false);
    }, 500);
  };

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
    window.print();
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[80vh]">
        <Loader2 className="h-8 w-8 animate-spin text-orange-600" />
      </div>
    );
  }

  if (!bill) return null;

  // --- Calculations ---
  const balanceDue = bill.totalAmount - bill.paidAmount;
  const totalItemsQty = bill.items.reduce(
    (acc, item) => acc + item.quantity,
    0
  );
  const totalFreeQty = bill.items.reduce(
    (acc, item) => acc + (item.freeQuantity || 0),
    0
  );
  const paymentsList = bill.payments || [];

  return (
    <div className="bg-muted/40 min-h-screen pb-10">
      <div className="mx-auto space-y-8">
        {/* --- Top Header Section --- */}
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 rounded-full bg-background"
                onClick={() =>
                  router.push("/dashboard/office/orange/purchases")
                }
              >
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                Bill {bill.purchaseId}
              </h1>
              {renderStatusBadge(bill.status)}
            </div>
            <div className="flex flex-col ml-11 gap-1">
              <p className="text-sm text-muted-foreground">
                Issued on{" "}
                {new Date(bill.purchaseDate).toLocaleDateString(undefined, {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </p>
              {bill.invoiceNo && (
                <span className="text-xs font-mono bg-orange-100 text-orange-800 px-2 py-0.5 rounded w-fit">
                  Vendor Ref: {bill.invoiceNo}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 ml-11 md:ml-0 print:hidden">
            {/* History Sheet */}
            <Sheet>
              <SheetTrigger asChild>
                {/* <Button
                  variant="outline"
                  size="sm"
                  onClick={fetchHistory}
                  className="bg-background"
                >
                  <History className="w-4 h-4 mr-2 text-muted-foreground" />{" "}
                  History
                </Button> */}
              </SheetTrigger>
              <SheetContent className="sm:max-w-md">
                <SheetHeader>
                  <SheetTitle>Audit History</SheetTitle>
                </SheetHeader>
                <div className="mt-6 text-center text-muted-foreground text-sm border-2 border-dashed rounded-lg py-8">
                  Audit logs for purchases coming soon.
                </div>
              </SheetContent>
            </Sheet>

            {/* <Button
              variant="outline"
              size="sm"
              className="bg-background"
              onClick={handlePrint}
            >
              <Printer className="w-4 h-4 mr-2 text-muted-foreground" /> Print
            </Button> */}

            {/* {bill.status === "Ordered" && (
              <Button
                size="sm"
                className="bg-orange-600 hover:bg-orange-700 text-white"
                onClick={() =>
                  router.push(`/dashboard/office/orange/purchases/${id}/edit`)
                }
              >
                <Edit className="w-4 h-4 mr-2" /> Edit Bill
              </Button>
            )} */}
          </div>
        </div>

        {/* --- Main Content Grid --- */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* LEFT COLUMN */}
          <div className="lg:col-span-2 space-y-6">
            {/* Stakeholders Card */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Supplier Card */}
              <Card className="shadow-sm border-l-4 border-l-blue-500">
                <CardHeader className="pb-2">
                  <CardDescription className="text-xs font-semibold uppercase tracking-wider text-blue-600">
                    Vendor / Supplier
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex items-start gap-4">
                  <Avatar className="h-10 w-10 border bg-blue-50 text-blue-600">
                    <AvatarFallback>
                      {getInitials(bill.supplier.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="space-y-1">
                    <h3 className="font-semibold text-base leading-none">
                      {bill.supplier.name}
                    </h3>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <User className="w-3 h-3" />
                      <span>
                        {bill.supplier.contactPerson || "No Contact Info"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1">
                      <Phone className="w-3 h-3" />
                      <span>{bill.supplier.phone || "N/A"}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Receiver (Orange) Card */}
              <Card className="shadow-sm border-l-4 border-l-orange-500">
                <CardHeader className="pb-2">
                  <CardDescription className="text-xs font-semibold uppercase tracking-wider text-orange-600">
                    Bill To
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex items-start gap-4">
                  <Avatar className="h-10 w-10 border bg-orange-50 text-orange-600">
                    <AvatarFallback>
                      <Building2 className="w-5 h-5" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="space-y-1">
                    <h3 className="font-semibold text-base leading-none">
                      {bill.business?.name || "Orange Agency"}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Authorized Purchase
                    </p>
                    {bill.arrivalDate && (
                      <div className="flex items-center gap-1 text-xs text-green-600 mt-1">
                        <Truck className="w-3 h-3" />
                        <span>
                          Expected:{" "}
                          {new Date(bill.arrivalDate).toLocaleDateString()}
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
                    {bill.items.length} Items
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50/50 hover:bg-slate-50/50">
                      <TableHead className="w-[35%] pl-6">
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
                      <TableHead className="text-right w-[20%] pr-6">
                        Total
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bill.items.map((item) => (
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
                          {item.freeQuantity && item.freeQuantity > 0 ? (
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
                          {bill.totalAmount.toLocaleString("en-LK", {
                            minimumFractionDigits: 2,
                          })}
                        </span>
                      </TableCell>
                    </TableRow>
                  </TableFooter>
                </Table>
              </CardContent>
            </Card>

            {/* Payment History Section */}
            <Card className="shadow-sm border-l-4 border-l-emerald-500 overflow-hidden">
              <CardHeader className="bg-emerald-50/50 border-b py-4">
                <div className="flex justify-between items-center">
                  <CardTitle className="text-lg font-semibold flex items-center gap-2">
                    <Banknote className="h-5 w-5 text-emerald-600" />
                    Payment History
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {paymentsList.length === 0 ? (
                  // If no detailed list, show summary based on paidAmount
                  bill.paidAmount > 0 ? (
                    <div className="p-6">
                      <div className="flex justify-between items-center bg-emerald-50 p-4 rounded-md border border-emerald-100">
                        <div>
                          <p className="font-semibold text-emerald-800">
                            Total Paid Amount
                          </p>
                          <p className="text-xs text-emerald-600">
                            Detailed records not available
                          </p>
                        </div>
                        <div className="text-xl font-bold font-mono text-emerald-700">
                          LKR{" "}
                          {bill.paidAmount.toLocaleString("en-LK", {
                            minimumFractionDigits: 2,
                          })}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-8 text-center text-muted-foreground text-sm">
                      No payments recorded for this bill yet.
                    </div>
                  )
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-emerald-50/30 hover:bg-emerald-50/30">
                        <TableHead className="pl-6">Date</TableHead>
                        <TableHead>Method</TableHead>
                        <TableHead>Reference</TableHead>
                        <TableHead className="text-right pr-6">
                          Amount
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paymentsList.map((pay: any, idx: number) => (
                        <TableRow key={idx} className="hover:bg-emerald-50/10">
                          <TableCell className="pl-6 text-sm">
                            {new Date(
                              pay.payment_date || pay.created_at
                            ).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="text-sm">
                            <Badge
                              variant="secondary"
                              className="font-normal text-xs"
                            >
                              {pay.payment_method || "Unknown"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {pay.reference || pay.notes || "-"}
                          </TableCell>
                          <TableCell className="text-right pr-6 font-mono font-medium">
                            LKR{" "}
                            {Number(pay.amount).toLocaleString("en-LK", {
                              minimumFractionDigits: 2,
                            })}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>

          {/* RIGHT COLUMN */}
          <div className="space-y-6">
            <Card className="shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                  Bill Metadata
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Bill / PO No</span>
                  <span className="text-sm font-mono bg-slate-100 px-2 py-0.5 rounded text-slate-700">
                    {bill.purchaseId}
                  </span>
                </div>

                {/* --- ADDED: Explicit Supplier Invoice Display --- */}
                {bill.invoiceNo && (
                  <>
                    <Separator />
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">
                        Supplier Invoice
                      </span>
                      <span className="text-sm font-mono bg-orange-50 text-orange-700 px-2 py-0.5 rounded border border-orange-100">
                        {bill.invoiceNo}
                      </span>
                    </div>
                  </>
                )}
                {/* ----------------------------------------------- */}

                <Separator />
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Date Issued</span>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="w-3.5 h-3.5" />
                    {new Date(bill.purchaseDate).toLocaleDateString()}
                  </div>
                </div>
                <Separator />
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Payment Status</span>
                  <Badge
                    variant={
                      balanceDue <= 0
                        ? "default" // Paid
                        : bill.paidAmount > 0
                        ? "secondary" // Partial
                        : "destructive" // Unpaid
                    }
                    className="rounded-full px-3"
                  >
                    {bill.paymentStatus}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm border-t-4 border-t-orange-600 sticky top-6">
              <CardHeader className="bg-muted/20 pb-4">
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-orange-600" />
                  Payment Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 pt-6">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Bill Total</span>
                  <span className="font-medium font-mono">
                    LKR{" "}
                    {bill.totalAmount.toLocaleString("en-LK", {
                      minimumFractionDigits: 2,
                    })}
                  </span>
                </div>

                {bill.paidAmount > 0 && (
                  <div className="flex justify-between text-sm text-emerald-600 mt-2">
                    <span className="flex items-center gap-1">
                      <Banknote className="w-3 h-3" /> Paid
                    </span>
                    <span className="font-medium font-mono">
                      - LKR{" "}
                      {bill.paidAmount.toLocaleString("en-LK", {
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

                {bill.notes && (
                  <div className="bg-amber-50 border border-amber-100 rounded-md p-3 text-sm text-amber-800">
                    <p className="font-semibold text-xs uppercase tracking-wider mb-1 flex items-center gap-1">
                      <FileText className="w-3 h-3" /> Notes
                    </p>
                    {bill.notes}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
