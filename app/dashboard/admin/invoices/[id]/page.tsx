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
  Undo2,
  Banknote,
  AlertCircle,
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
import { printInvoice } from "../print-utils";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// --- Interfaces ---
interface InvoiceHistory {
  id: string;
  changedAt: string;
  changedBy: string;
  reason: string;
  previousTotal: number;
}

interface ReturnRecord {
  id: string;
  return_number: string;
  created_at: string;
  quantity: number;
  return_type: string;
  reason: string;
  products: {
    name: string;
    sku: string;
    selling_price: number;
  };
  profiles: {
    full_name: string;
  };
}

interface PaymentRecord {
  id: string;
  amount: number;
  payment_date: string;
  method: string;
  cheque_no?: string;
  cheque_status?: string;
  cheque_date?: string;
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

  // Returns State
  const [returnsLoading, setReturnsLoading] = useState(true);
  const [returns, setReturns] = useState<ReturnRecord[]>([]);

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

    const fetchReturns = async () => {
      try {
        const res = await fetch(`/api/invoices/${id}/returns`);
        if (res.ok) {
          const data = await res.json();
          setReturns(data);
        }
      } catch (error) {
        console.error("Failed to fetch returns");
      } finally {
        setReturnsLoading(false);
      }
    };

    fetchInvoice();
    fetchReturns();
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
      Pending: "bg-yellow-50 text-yellow-700 border-yellow-200",
      Processing: "bg-blue-50 text-blue-700 border-blue-200",
      Loading: "bg-indigo-50 text-indigo-700 border-indigo-200",
      "In Transit": "bg-purple-50 text-purple-700 border-purple-200",
      Delivered: "bg-emerald-50 text-emerald-700 border-emerald-200",
      Cancelled: "bg-red-50 text-red-700 border-red-200",
    };

    const icons: Record<string, any> = {
      Pending: Clock,
      Processing: Package,
      Loading: Package,
      "In Transit": Package,
      Delivered: CheckCircle2,
      Cancelled: Package,
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

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[80vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!invoice) return null;

  // --- Calculations ---

  // 1. Total Refunded Value
  const totalRefunded = returns.reduce((acc, r) => {
    return acc + r.quantity * (r.products?.selling_price || 0);
  }, 0);

  // 2. Payments
  const paymentsList: PaymentRecord[] = invoice.payments || [];
  const totalPaid = paymentsList.reduce((acc, p) => acc + Number(p.amount), 0);

  // 3. Current Invoice Total (Net Amount from DB)
  const netTotal = invoice.grandTotal;

  // 4. Gross Total (Net + Returns)
  const grossTotal = netTotal + totalRefunded;

  // 5. Balance Due (Net Total - Paid)
  const balanceDue = netTotal - totalPaid;

  // 6. Items Totals
  const totalItemsQty = invoice.items.reduce(
    (acc: number, item: any) => acc + item.quantity,
    0
  );
  const totalFreeQty = invoice.items.reduce(
    (acc: number, item: any) => acc + item.freeQuantity,
    0
  );

  return (
    <div className="min-h-screen bg-muted/40  ">
      <div className="mx-auto space-y-8 ">
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
            {/* Stakeholders Card */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                  </div>
                </CardContent>
              </Card>

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
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Line Items Table */}
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
                  <TableFooter className="bg-slate-50/50">
                    <TableRow>
                      <TableCell className="pl-6 font-semibold">
                        Total
                      </TableCell>
                      <TableCell className="text-center font-semibold">
                        {totalItemsQty}
                      </TableCell>
                      <TableCell className="text-center font-semibold">
                        {totalFreeQty > 0 ? totalFreeQty : "-"}
                      </TableCell>
                      <TableCell
                        colSpan={2}
                        className="text-right pr-6 font-bold font-mono text-base"
                      >
                        LKR{" "}
                        {netTotal.toLocaleString("en-LK", {
                          minimumFractionDigits: 2,
                        })}
                      </TableCell>
                    </TableRow>
                  </TableFooter>
                </Table>
              </CardContent>
            </Card>

            {/* Returns & Adjustments Section */}
            {returns.length > 0 && (
              <Card className="shadow-sm border-l-4 border-l-orange-500 overflow-hidden">
                <CardHeader className="bg-orange-50/50 border-b py-4">
                  <div className="flex justify-between items-center">
                    <CardTitle className="text-lg font-semibold flex items-center gap-2">
                      <Undo2 className="h-5 w-5 text-orange-600" />
                      Returns & Adjustments
                    </CardTitle>
                    <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-200 border-none">
                      {returns.length} Record(s) found
                    </Badge>
                  </div>
                  <CardDescription>
                    Items returned against this invoice. These items have been
                    deducted from the invoice quantity.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-orange-50/30 hover:bg-orange-50/30">
                        <TableHead className="pl-6">Return #</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Product</TableHead>
                        <TableHead className="text-center">Type</TableHead>
                        <TableHead className="text-right">Qty</TableHead>
                        <TableHead className="pr-6">Reason</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {returns.map((ret) => (
                        <TableRow
                          key={ret.id}
                          className="hover:bg-orange-50/10"
                        >
                          <TableCell className="pl-6 font-mono text-xs font-medium">
                            {ret.return_number}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {new Date(ret.created_at).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            <div className="font-medium text-sm">
                              {ret.products?.name}
                            </div>
                            <div className="text-[10px] text-muted-foreground">
                              {ret.products?.sku}
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[10px] h-5 px-1.5",
                                ret.return_type === "Good"
                                  ? "text-green-600 bg-green-50 border-green-200"
                                  : "text-red-600 bg-red-50 border-red-200"
                              )}
                            >
                              {ret.return_type}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-bold text-sm">
                            -{ret.quantity}
                          </TableCell>
                          <TableCell
                            className="pr-6 text-xs text-muted-foreground max-w-[150px] truncate"
                            title={ret.reason}
                          >
                            {ret.reason
                              ?.replace(`[${invoice.invoiceNo}]`, "")
                              .trim() || "-"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
                <CardFooter className="bg-orange-50/30 border-t py-3 flex justify-between">
                  <div className="text-xs text-muted-foreground">
                    Processed by: {returns[0]?.profiles?.full_name}
                  </div>
                  <div className="text-sm font-medium text-orange-700">
                    Total Value of Returns: LKR{" "}
                    {totalRefunded.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                    })}
                  </div>
                </CardFooter>
              </Card>
            )}

            {/* Payment History Section */}
            <Card className="shadow-sm border-l-4 border-l-emerald-500 overflow-hidden">
              <CardHeader className="bg-emerald-50/50 border-b py-4">
                <div className="flex justify-between items-center">
                  <CardTitle className="text-lg font-semibold flex items-center gap-2">
                    <Banknote className="h-5 w-5 text-emerald-600" />
                    Payment History
                  </CardTitle>
                  <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border-none">
                    {paymentsList.length} Payment(s)
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {paymentsList.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground text-sm">
                    No payments recorded for this invoice yet.
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-emerald-50/30 hover:bg-emerald-50/30">
                        <TableHead className="pl-6">Date</TableHead>
                        <TableHead>Method</TableHead>
                        <TableHead>Reference / Cheque</TableHead>
                        <TableHead className="text-right pr-6">
                          Amount
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paymentsList.map((pay) => (
                        <TableRow
                          key={pay.id}
                          className="hover:bg-emerald-50/10"
                        >
                          <TableCell className="pl-6 text-sm">
                            {new Date(pay.payment_date).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="text-sm">
                            <Badge
                              variant="secondary"
                              className="font-normal text-xs"
                            >
                              {pay.method}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {pay.method === "Cheque" ? (
                              <div className="flex flex-col">
                                <span className="font-mono text-xs font-medium text-foreground">
                                  {pay.cheque_no}
                                </span>
                                <span className="text-[10px]">
                                  Due:{" "}
                                  {new Date(
                                    pay.cheque_date!
                                  ).toLocaleDateString()}
                                </span>
                                {pay.cheque_status && (
                                  <span className="text-[10px] italic">
                                    ({pay.cheque_status})
                                  </span>
                                )}
                              </div>
                            ) : (
                              "-"
                            )}
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
                    <TableFooter className="bg-emerald-50/30">
                      <TableRow>
                        <TableCell
                          colSpan={3}
                          className="pl-6 text-emerald-700 font-medium text-right"
                        >
                          Total Paid
                        </TableCell>
                        <TableCell className="pr-6 text-right font-bold font-mono text-emerald-700">
                          LKR{" "}
                          {totalPaid.toLocaleString("en-LK", {
                            minimumFractionDigits: 2,
                          })}
                        </TableCell>
                      </TableRow>
                    </TableFooter>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>

          {/* RIGHT COLUMN (Summary) */}
          <div className="space-y-6">
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
                  <Badge
                    variant={
                      balanceDue <= 0
                        ? "default" // Paid
                        : totalPaid > 0
                        ? "secondary" // Partial
                        : "destructive" // Unpaid
                    }
                    className="rounded-full px-3"
                  >
                    {balanceDue <= 0
                      ? "Paid"
                      : totalPaid > 0
                      ? "Partial"
                      : "Unpaid"}
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
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    Subtotal (Gross)
                  </span>
                  <span className="font-medium font-mono">
                    LKR{" "}
                    {grossTotal.toLocaleString("en-LK", {
                      minimumFractionDigits: 2,
                    })}
                  </span>
                </div>

                <div className="flex justify-between text-sm text-orange-600">
                  <span className="flex items-center gap-1">
                    <Undo2 className="w-3 h-3" /> Returns
                  </span>
                  <span className="font-medium font-mono">
                    - LKR{" "}
                    {totalRefunded.toLocaleString("en-LK", {
                      minimumFractionDigits: 2,
                    })}
                  </span>
                </div>

                <Separator className="my-2 bg-slate-100" />

                <div className="flex justify-between text-sm">
                  <span className="font-medium text-slate-700">
                    Net Invoice Amount
                  </span>
                  <span className="font-bold font-mono text-slate-700">
                    LKR{" "}
                    {netTotal.toLocaleString("en-LK", {
                      minimumFractionDigits: 2,
                    })}
                  </span>
                </div>

                {totalPaid > 0 && (
                  <div className="flex justify-between text-sm text-emerald-600 mt-2">
                    <span className="flex items-center gap-1">
                      <Banknote className="w-3 h-3" /> Paid
                    </span>
                    <span className="font-medium font-mono">
                      - LKR{" "}
                      {totalPaid.toLocaleString("en-LK", {
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
