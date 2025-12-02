"use client";

import React, { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Printer,
  FileText,
  Calendar,
  User,
  MapPin,
  History,
  Edit,
  Loader2,
  Phone,
  Building2,
  CheckCircle2,
  Clock,
  Package,
  CreditCard,
  Mail,
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
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { printInvoice } from "../print-utils";
import { toast } from "sonner";

// --- Interfaces ---
interface InvoiceHistory {
  id: string;
  changedAt: string;
  changedBy: string;
  reason: string;
  previousTotal: number;
}

export default function ViewInvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [invoice, setInvoice] = useState<any>(null);

  // History State
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyLogs, setHistoryLogs] = useState<InvoiceHistory[]>([]);

  useEffect(() => {
    const fetchInvoice = async () => {
      try {
        const res = await fetch(`/api/invoices/${id}`);
        if (!res.ok) throw new Error("Failed to load invoice");
        const data = await res.json();
        setInvoice(data);
      } catch (error) {
        toast.error("Error loading invoice details");
        router.push("/dashboard/admin/invoices");
      } finally {
        setLoading(false);
      }
    };
    fetchInvoice();
  }, [id, router]);

  const fetchHistory = async () => {
    setHistoryLoading(true);
    try {
      const res = await fetch(`/api/invoices/${id}/history`);
      if (res.ok) {
        const data = await res.json();
        setHistoryLogs(data);
      }
    } catch (error) {
      console.error("Failed to fetch history");
    } finally {
      setHistoryLoading(false);
    }
  };

  const getInitials = (name: string) => {
    return name
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .substring(0, 2)
      .toUpperCase();
  };

  const renderOrderStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      Pending:
        "bg-yellow-50 text-yellow-700 border-yellow-200 hover:bg-yellow-50",
      Processing: "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-50",
      Loading:
        "bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-50",
      "In Transit":
        "bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-50",
      Delivered:
        "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-50",
      Cancelled: "bg-red-50 text-red-700 border-red-200 hover:bg-red-50",
    };

    const icons: Record<string, any> = {
      Pending: Clock,
      Processing: Package,
      Loading: Package,
      "In Transit": Truck, // Assuming you import Truck
      Delivered: CheckCircle2,
      Cancelled: X, // Assuming you import X
    };

    // Import icons or use generic fallback
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

  // Fix imports for badge icons if needed (Truck, X were not in original import list)
  const Truck = Package; // Fallback
  const X = Package; // Fallback

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[80vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!invoice) return null;

  return (
    <div className="min-h-screen bg-muted/40 -m-6 p-6">
      {" "}
      {/* Full background styling */}
      <div className=" mx-auto space-y-8">
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
                Invoice {invoice.invoiceNo}
              </h1>
              {renderOrderStatusBadge(invoice.orderStatus || "Pending")}
            </div>
            <p className="text-sm text-muted-foreground ml-11">
              Created on{" "}
              {new Date(invoice.date).toLocaleDateString(undefined, {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </p>
          </div>

          <div className="flex items-center gap-2 ml-11 md:ml-0">
            {/* History Sheet */}
            <Sheet>
              <SheetTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={fetchHistory}
                  className="bg-background"
                >
                  <History className="w-4 h-4 mr-2 text-muted-foreground" />{" "}
                  History
                </Button>
              </SheetTrigger>
              <SheetContent className="sm:max-w-md">
                <SheetHeader>
                  <SheetTitle>Audit History</SheetTitle>
                </SheetHeader>
                <div className="mt-6 space-y-6">
                  {historyLoading ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="animate-spin text-muted-foreground" />
                    </div>
                  ) : historyLogs.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
                      No modifications recorded.
                    </div>
                  ) : (
                    <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:w-0.5 before:bg-slate-200">
                      {historyLogs.map((log) => (
                        <div key={log.id} className="relative flex gap-4">
                          <div
                            className="absolute left-0 mt-1.5 w-2.5 h-2.5 rounded-full bg-white border-2 border-blue-500 z-10"
                            style={{ marginLeft: "15px" }}
                          ></div>
                          <div className="ml-10 w-full space-y-2">
                            <div className="flex justify-between items-center">
                              <span className="font-semibold text-sm">
                                {log.changedBy}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {new Date(log.changedAt).toLocaleString()}
                              </span>
                            </div>
                            <div className="bg-slate-50 p-3 rounded-md border text-sm">
                              <p className="text-slate-700 font-medium">
                                {log.reason}
                              </p>
                              <div className="mt-2 pt-2 border-t border-slate-200 text-xs font-mono text-slate-500">
                                Snapshot Total: LKR{" "}
                                {log.previousTotal.toLocaleString()}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </SheetContent>
            </Sheet>

            <Button
              variant="outline"
              size="sm"
              className="bg-background"
              onClick={() => printInvoice(id)}
            >
              <Printer className="w-4 h-4 mr-2 text-muted-foreground" /> Print
            </Button>

            <Button
              size="sm"
              onClick={() =>
                router.push(`/dashboard/admin/invoices/${id}/edit`)
              }
            >
              <Edit className="w-4 h-4 mr-2" /> Edit Invoice
            </Button>
          </div>
        </div>

        {/* --- Main Content Grid --- */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* LEFT COLUMN (Details & Items) */}
          <div className="lg:col-span-2 space-y-6">
            {/* 1. Stakeholders Card (Customer & Rep) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Customer Card */}
              <Card className="shadow-sm border-l-4 border-l-blue-500">
                <CardHeader className="pb-2">
                  <CardDescription className="text-xs font-semibold uppercase tracking-wider text-blue-600">
                    Bill To
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex items-start gap-4">
                  <Avatar className="h-10 w-10 border bg-blue-50 text-blue-600">
                    <AvatarFallback>
                      {getInitials(invoice.customer?.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="space-y-1">
                    <h3 className="font-semibold text-base leading-none">
                      {invoice.customer?.shop}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {invoice.customer?.name}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1">
                      <Phone className="w-3 h-3" />{" "}
                      <span>{invoice.customer?.phone || "N/A"}</span>
                    </div>
                    <div className="flex items-start gap-2 text-xs text-muted-foreground">
                      <MapPin className="w-3 h-3 mt-0.5" />{" "}
                      <span className="line-clamp-2">
                        {invoice.customer?.address || "No Address"}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Sales Rep Card */}
              <Card className="shadow-sm">
                <CardHeader className="pb-2">
                  <CardDescription className="text-xs font-semibold uppercase tracking-wider">
                    Sales Representative
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex items-start gap-4">
                  <Avatar className="h-10 w-10 border">
                    <AvatarFallback>
                      <User className="w-5 h-5 text-muted-foreground" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="space-y-1">
                    <h3 className="font-semibold text-base leading-none">
                      {invoice.salesRep}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Authorized Agent
                    </p>
                    <Badge
                      variant="secondary"
                      className="mt-1 font-normal text-xs"
                    >
                      Employee ID:{" "}
                      {invoice.salesRepId
                        ? invoice.salesRepId.substring(0, 8)
                        : "---"}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* 2. Items Table */}
            <Card className="shadow-sm overflow-hidden">
              <CardHeader className="bg-slate-50/50 border-b py-4">
                <div className="flex justify-between items-center">
                  <CardTitle className="text-lg font-semibold">
                    Line Items
                  </CardTitle>
                  <Badge variant="outline" className="font-normal">
                    {invoice.items.length} Items
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
                      <TableHead className="text-center w-[15%]">Qty</TableHead>
                      <TableHead className="text-center w-[10%]">
                        Free
                      </TableHead>
                      <TableHead className="text-right w-[15%]">
                        Price
                      </TableHead>
                      <TableHead className="text-right w-[20%] pr-6">
                        Total
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoice.items.map((item: any) => (
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
                          {item.unitPrice.toLocaleString("en-LK", {
                            minimumFractionDigits: 2,
                          })}
                        </TableCell>
                        <TableCell className="text-right pr-6 font-mono font-medium text-sm">
                          {item.total.toLocaleString("en-LK", {
                            minimumFractionDigits: 2,
                          })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
              {/* Optional footer for table stats if needed */}
            </Card>
          </div>

          {/* RIGHT COLUMN (Summary) */}
          <div className="space-y-6">
            {/* Metadata Card */}
            <Card className="shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                  Invoice Metadata
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Invoice No</span>
                  <span className="text-sm font-mono bg-slate-100 px-2 py-0.5 rounded text-slate-700">
                    {invoice.invoiceNo}
                  </span>
                </div>
                <Separator />
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Date Issued</span>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="w-3.5 h-3.5" />
                    {invoice.date}
                  </div>
                </div>
                <Separator />
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Payment Status</span>
                  {/* Assuming payment status is available or default to Unpaid logic */}
                  <Badge
                    variant={
                      invoice.paidAmount >= invoice.totalAmount
                        ? "default"
                        : "destructive"
                    }
                    className="rounded-full px-3"
                  >
                    {invoice.status ||
                      (invoice.paidAmount >= invoice.totalAmount
                        ? "Paid"
                        : "Unpaid")}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* Financial Summary */}
            <Card className="shadow-sm border-t-4 border-t-primary sticky top-6">
              <CardHeader className="bg-muted/20 pb-4">
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-primary" />
                  Payment Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 pt-6">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-medium font-mono">
                    LKR {invoice.grandTotal.toFixed(2)}
                  </span>
                </div>

                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Discount</span>
                  <span className="text-emerald-600 font-medium font-mono">
                    - LKR 0.00
                  </span>
                </div>

                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Tax</span>
                  <span className="text-muted-foreground font-mono">
                    LKR 0.00
                  </span>
                </div>

                <Separator className="my-2" />

                <div className="flex justify-between items-end pb-2">
                  <span className="font-bold text-lg">Total Due</span>
                  <div className="text-right">
                    <span className="block font-bold text-2xl text-primary font-mono tracking-tight">
                      LKR{" "}
                      {invoice.grandTotal.toLocaleString("en-LK", {
                        minimumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                </div>

                {invoice.notes && (
                  <div className="bg-amber-50 border border-amber-100 rounded-md p-3 text-sm text-amber-800">
                    <p className="font-semibold text-xs uppercase tracking-wider mb-1 flex items-center gap-1">
                      <FileText className="w-3 h-3" /> Notes
                    </p>
                    {invoice.notes}
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
