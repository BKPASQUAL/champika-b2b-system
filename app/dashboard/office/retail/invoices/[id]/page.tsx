"use client";

import React, { useState, useEffect, use } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
  Share2,
  RefreshCw,
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
import { printInvoice, downloadInvoice } from "../print-utils";
import { shareInvoice } from "@/app/lib/invoice-print";
import { CancelInvoiceButton } from "@/components/ui/CancelInvoiceButton";

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

export default function RetailViewInvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [invoice, setInvoice] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);

  // History State
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyLogs, setHistoryLogs] = useState<InvoiceHistory[]>([]);

  // Returns State
  const [returnsLoading, setReturnsLoading] = useState(true);
  const [returns, setReturns] = useState<ReturnRecord[]>([]);

  // Share state
  const [sharing, setSharing] = useState(false);

  const fetchInvoice = async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const res = await fetch(`/api/invoices/${id}`);
      if (!res.ok) throw new Error("Failed to load invoice");
      const data = await res.json();
      setInvoice(data);
    } catch (error) {
      toast.error("Error loading invoice details");
      if (!silent) router.push("/dashboard/office/retail/invoices");
    } finally {
      if (!silent) setLoading(false);
      else setRefreshing(false);
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

  useEffect(() => {
    fetchInvoice();
    fetchReturns();
  }, [id, router]);

  // Auto-trigger print or download when redirected from "Save & Print / Save & Download"
  useEffect(() => {
    if (loading || !invoice) return;
    if (searchParams.get("print") === "true") {
      printInvoice(id);
    } else if (searchParams.get("download") === "true") {
      downloadInvoice(id);
    }
  }, [loading, invoice]);

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

  const handleSharePdf = () =>
    shareInvoice(id, "retail", invoice?.invoiceNo || "", setSharing);

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
      <div className="flex justify-center items-center py-16">
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
  // Use the DB-stored paidAmount (correctly updated on cheque reversals) as the authoritative value
  const totalPaid = Number(invoice.paidAmount ?? 0);

  // 3. Current Invoice Total (Net Amount from DB)
  const netTotal = invoice.grandTotal;

  // 4. Extra Discount Amount
  const extraDiscountAmount = invoice.extraDiscountAmount || 0;

  // 5. Subtotal (Net Total + Extra Discount)
  // This reconstructs the total BEFORE the extra bill-wise discount was applied
  const subTotalBeforeExtraDiscount = netTotal + extraDiscountAmount;

  // 6. Balance Due (Net Total - Paid)
  const balanceDue = netTotal - totalPaid;

  // 7. Items Totals
  const totalItemsQty = invoice.items.reduce(
    (acc: number, item: any) => acc + item.quantity,
    0
  );
  const totalFreeQty = invoice.items.reduce(
    (acc: number, item: any) => acc + item.freeQuantity,
    0
  );

  return (
    <div className="min-h-screen bg-muted/40">
      <div className="mx-auto space-y-6 px-2 sm:px-0">
        {/* --- Top Header Section --- */}
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 rounded-full bg-background shrink-0"
                onClick={() => router.push("/dashboard/office/retail/invoices")}
              >
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <h1 className="text-lg sm:text-xl lg:text-2xl font-bold tracking-tight text-foreground">
                Invoice {invoice.invoiceNo}
              </h1>
              {renderOrderStatusBadge(invoice.orderStatus || "Pending")}
            </div>
            <p className="text-sm text-muted-foreground sm:ml-11">
              {new Date(invoice.date).toLocaleDateString(undefined, {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 lg:shrink-0">
            {/* Refresh Button */}
            <Button
              variant="outline"
              size="sm"
              className="bg-background"
              onClick={() => { fetchInvoice(true); fetchReturns(); }}
              disabled={refreshing}
            >
              <RefreshCw className={`w-4 h-4 sm:mr-2 text-muted-foreground ${refreshing ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">{refreshing ? "Refreshing…" : "Refresh"}</span>
            </Button>

            {/* History Sheet */}
            <Sheet>
              <SheetTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={fetchHistory}
                  className="bg-background"
                >
                  <History className="w-4 h-4 sm:mr-2 text-muted-foreground" />
                  <span className="hidden sm:inline">History</span>
                </Button>
              </SheetTrigger>
              <SheetContent className="sm:max-w-md">
                <SheetHeader>
                  <SheetTitle>Audit History</SheetTitle>
                </SheetHeader>
                <div className="mt-6 space-y-6">
                  {historyLoading ? (
                    <div className="flex justify-center items-center py-16">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
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
              <Printer className="w-4 h-4 sm:mr-2 text-muted-foreground" />
              <span className="hidden sm:inline">Print</span>
            </Button>

            {/* Share PDF Button */}
            <Button
              variant="outline"
              size="sm"
              className="bg-green-50 border-green-200 text-green-700 hover:bg-green-100 hover:text-green-800 cursor-pointer"
              onClick={handleSharePdf}
              disabled={sharing}
            >
              {sharing ? (
                <Loader2 className="w-4 h-4 sm:mr-2 animate-spin" />
              ) : (
                <Share2 className="w-4 h-4 sm:mr-2" />
              )}
              <span className="hidden sm:inline">{sharing ? "Sharing…" : "Share"}</span>
            </Button>

            <CancelInvoiceButton
              id={id}
              invoiceNo={invoice?.invoiceNo || ""}
              orderStatus={invoice?.orderStatus || ""}
              onSuccess={() => { fetchInvoice(true); fetchReturns(); }}
            />

            <Button
              size="sm"
              onClick={() =>
                router.push(`/dashboard/office/retail/invoices/${id}/edit`)
              }
            >
              <Edit className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Edit Invoice</span>
            </Button>
          </div>
        </div>

        {/* --- Main Content Grid --- */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* LEFT COLUMN (Details & Items) */}
          <div className="lg:col-span-2 space-y-6 min-w-0">
            {/* Stakeholders Card */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Card className="shadow-sm border-l-4 border-l-blue-500">
                <CardHeader className="pb-1 pt-3 px-3">
                  <CardDescription className="text-[10px] font-semibold uppercase tracking-wider text-blue-600">
                    Bill To
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex items-start gap-2 px-3 pb-3">
                  <Avatar className="h-8 w-8 shrink-0 border bg-blue-50 text-blue-600">
                    <AvatarFallback className="text-xs">
                      {getInitials(invoice.customer?.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="space-y-0.5 min-w-0">
                    <h3 className="font-semibold text-sm leading-snug truncate">
                      {invoice.customer?.shop}
                    </h3>
                    <p className="text-xs text-muted-foreground truncate">
                      {invoice.customer?.name}
                    </p>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Phone className="w-3 h-3 shrink-0" />
                      <span className="truncate">{invoice.customer?.phone || "N/A"}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-sm border-l-4 border-l-green-500">
                <CardHeader className="pb-1 pt-3 px-3">
                  <CardDescription className="text-[10px] font-semibold uppercase tracking-wider text-green-600">
                    Bill From
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex items-start gap-2 px-3 pb-3">
                  <Avatar className="h-8 w-8 shrink-0 border bg-green-50 text-green-600">
                    <AvatarFallback className="text-xs">CH</AvatarFallback>
                  </Avatar>
                  <div className="space-y-0.5 min-w-0">
                    <h3 className="font-semibold text-sm leading-snug">
                      Champika Hardware
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Retail Division
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
                {/* Mobile card layout */}
                <div className="sm:hidden divide-y">
                  {invoice.items.map((item: any) => (
                    <div key={item.id} className="p-4 space-y-3">
                      {/* Product name row */}
                      <div className="flex items-start gap-3">
                        <div className="h-8 w-8 rounded bg-slate-100 flex items-center justify-center text-slate-400 shrink-0">
                          <Package className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-sm text-foreground leading-snug">
                            {item.productName}
                          </p>
                          <p className="text-xs font-mono text-muted-foreground mt-0.5">
                            {item.sku}
                          </p>
                        </div>
                      </div>
                      {/* Price detail grid */}
                      <div className="grid grid-cols-2 gap-x-4 gap-y-2 pl-11 text-sm">
                        <div>
                          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Qty</p>
                          <p className="font-medium">{item.quantity} <span className="text-xs text-muted-foreground">{item.unit}</span></p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Unit Price</p>
                          <p className="font-mono text-sm">{item.unitPrice.toLocaleString("en-LK", { minimumFractionDigits: 2 })}</p>
                        </div>
                        {item.freeQuantity > 0 && (
                          <div>
                            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Free</p>
                            <Badge variant="secondary" className="px-1.5 h-5 text-[10px]">{item.freeQuantity}</Badge>
                          </div>
                        )}
                        {item.discountAmount > 0 && (
                          <div>
                            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Discount</p>
                            <p className="font-mono text-sm text-red-500">-{item.discountAmount.toLocaleString()}</p>
                          </div>
                        )}
                      </div>
                      {/* Total row */}
                      <div className="pl-11 flex justify-between items-center border-t pt-2">
                        <span className="text-xs text-muted-foreground uppercase tracking-wide">Line Total</span>
                        <span className="font-bold font-mono text-sm">
                          LKR {item.total.toLocaleString("en-LK", { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  ))}
                  <div className="px-4 py-3 bg-slate-50/50 flex justify-between items-center">
                    <span className="font-semibold text-sm">Total ({totalItemsQty} items)</span>
                    <span className="font-bold font-mono text-base">
                      LKR {netTotal.toLocaleString("en-LK", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                {/* Desktop table layout */}
                <div className="hidden sm:block overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50/50 hover:bg-slate-50/50">
                        <TableHead className="w-[35%] pl-6">Product Details</TableHead>
                        <TableHead className="text-center w-[10%]">Qty</TableHead>
                        <TableHead className="text-center w-[10%]">Free</TableHead>
                        <TableHead className="text-right w-[15%]">Price</TableHead>
                        <TableHead className="text-right w-[15%]">Discount</TableHead>
                        <TableHead className="text-right w-[15%] pr-6">Total</TableHead>
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
                            <span className="text-xs text-muted-foreground ml-1">{item.unit}</span>
                          </TableCell>
                          <TableCell className="text-center">
                            {item.freeQuantity > 0 ? (
                              <Badge variant="secondary" className="px-1.5 h-5 text-[10px]">
                                {item.freeQuantity}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground text-sm">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            {item.unitPrice.toLocaleString("en-LK", { minimumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs text-red-500">
                            {item.discountAmount > 0 ? `-${item.discountAmount.toLocaleString()}` : "-"}
                          </TableCell>
                          <TableCell className="text-right pr-6 font-mono font-medium text-sm">
                            {item.total.toLocaleString("en-LK", { minimumFractionDigits: 2 })}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                    <TableFooter className="bg-slate-50/50">
                      <TableRow>
                        <TableCell className="pl-6 font-semibold">Total</TableCell>
                        <TableCell className="text-center font-semibold">{totalItemsQty}</TableCell>
                        <TableCell className="text-center font-semibold">
                          {totalFreeQty > 0 ? totalFreeQty : "-"}
                        </TableCell>
                        <TableCell colSpan={3} className="text-right pr-6 font-bold font-mono text-base">
                          LKR {netTotal.toLocaleString("en-LK", { minimumFractionDigits: 2 })}
                        </TableCell>
                      </TableRow>
                    </TableFooter>
                  </Table>
                </div>
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
                  {/* Mobile card layout */}
                  <div className="sm:hidden divide-y">
                    {returns.map((ret) => {
                      const itemValue = ret.quantity * (ret.products?.selling_price || 0);
                      return (
                        <div key={ret.id} className="p-4 space-y-3">
                          <div className="flex justify-between items-start gap-2">
                            <div>
                              <p className="text-xs text-muted-foreground">Return #</p>
                              <p className="font-mono text-xs font-semibold text-foreground">{ret.return_number}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-xs text-muted-foreground">Date</p>
                              <p className="text-xs font-medium">{new Date(ret.created_at).toLocaleDateString()}</p>
                            </div>
                          </div>
                          <div className="flex gap-2 bg-slate-50 p-2.5 rounded-md border text-xs">
                            <div className="min-w-0 flex-1">
                              <p className="font-medium text-slate-800 truncate">{ret.products?.name}</p>
                              <p className="font-mono text-[10px] text-muted-foreground mt-0.5">{ret.products?.sku}</p>
                            </div>
                            <Badge variant="outline" className={cn("text-[9px] h-4.5 px-1.5 self-start shrink-0", 
                              ret.return_type === "Good" ? "text-green-600 bg-green-50 border-green-200" : "text-red-600 bg-red-50 border-red-200"
                            )}>{ret.return_type}</Badge>
                          </div>
                          <div className="flex justify-between items-center text-xs pl-1">
                            <span className="text-muted-foreground">Quantity</span>
                            <span className="font-bold text-red-600">-{ret.quantity}</span>
                          </div>
                          {ret.reason && (
                            <div className="text-[11px] text-muted-foreground pl-1 border-l-2 border-slate-200 italic">
                              {ret.reason.replace(`[${invoice.invoiceNo}]`, "").trim() || "-"}
                            </div>
                          )}
                          <div className="flex justify-between items-center pt-2 border-t text-xs">
                            <span className="text-muted-foreground uppercase tracking-wide">Refund Value</span>
                            <span className="font-bold font-mono">
                              LKR {itemValue.toLocaleString("en-LK", { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                    <div className="px-4 py-3 bg-orange-50/20 flex flex-col gap-1 border-t">
                      <div className="text-[10px] text-muted-foreground">Processed by: {returns[0]?.profiles?.full_name}</div>
                      <div className="flex justify-between items-center">
                        <span className="font-semibold text-sm text-orange-800">Total Refunded</span>
                        <span className="font-bold font-mono text-sm text-orange-800">
                          LKR {totalRefunded.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Desktop table layout */}
                  <div className="hidden sm:block overflow-x-auto">
                    <Table className="min-w-[700px]">
                      <TableHeader>
                        <TableRow className="bg-orange-50/30 hover:bg-orange-50/30">
                          <TableHead className="pl-6 whitespace-nowrap">Return #</TableHead>
                          <TableHead className="whitespace-nowrap">Date</TableHead>
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
                  </div>
                </CardContent>
                <CardFooter className="hidden sm:flex bg-orange-50/30 border-t py-3 flex-row justify-between gap-1">
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
                  <>
                    {/* Mobile card layout */}
                    <div className="sm:hidden divide-y">
                      {paymentsList.map((pay) => {
                        const isReturned = pay.cheque_status === "Returned";
                        const isCheque = pay.method?.toLowerCase() === "cheque";
                        return (
                          <div key={pay.id} className={cn("p-4 space-y-2.5", isReturned && "bg-red-50/40")}>
                            <div className="flex justify-between items-start">
                              <div>
                                <p className="text-[10px] uppercase font-semibold tracking-wider text-muted-foreground">Date</p>
                                <p className="text-sm font-medium text-slate-800">{new Date(pay.payment_date).toLocaleDateString()}</p>
                              </div>
                              <Badge variant="secondary" className="font-normal text-xs">{pay.method}</Badge>
                            </div>
                            {isCheque && (
                              <div className="bg-slate-50 p-2.5 rounded-md border text-xs space-y-1">
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Cheque No:</span>
                                  <span className={cn("font-mono font-medium", isReturned && "line-through text-gray-400")}>{pay.cheque_no}</span>
                                </div>
                                {pay.cheque_date && (
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">Due Date:</span>
                                    <span>{new Date(pay.cheque_date).toLocaleDateString()}</span>
                                  </div>
                                )}
                                {pay.cheque_status && (
                                  <div className="flex justify-between items-center pt-1 border-t">
                                    <span className="text-muted-foreground">Status:</span>
                                    <Badge variant="outline" className={cn("text-[9px] h-4.5 px-1.5 border",
                                      pay.cheque_status === "Cleared" ? "bg-green-50 text-green-700 border-green-200" :
                                      pay.cheque_status === "Returned" ? "bg-red-50 text-red-700 border-red-200" :
                                      pay.cheque_status === "Bounced" ? "bg-red-50 text-red-600 border-red-200" :
                                      pay.cheque_status === "Deposited" ? "bg-blue-50 text-blue-700 border-blue-200" :
                                      "bg-amber-50 text-amber-700 border-amber-200"
                                    )}>{pay.cheque_status}</Badge>
                                  </div>
                                )}
                              </div>
                            )}
                            <div className="flex justify-between items-center pt-2 border-t text-xs">
                              <span className="text-muted-foreground uppercase tracking-wide">Amount</span>
                              <div className="text-right">
                                <span className={cn("font-bold font-mono text-sm", isReturned && "line-through text-gray-400")}>
                                  LKR {Number(pay.amount).toLocaleString("en-LK", { minimumFractionDigits: 2 })}
                                </span>
                                {isReturned && <p className="text-[9px] text-red-500 font-semibold leading-none mt-0.5">Reversed</p>}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      <div className="px-4 py-3 bg-emerald-50/20 flex justify-between items-center border-t">
                        <span className="font-semibold text-sm text-emerald-800">Total Paid</span>
                        <span className="font-bold font-mono text-base text-emerald-800">
                          LKR {totalPaid.toLocaleString("en-LK", { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>

                    {/* Desktop table layout */}
                    <div className="hidden sm:block overflow-x-auto">
                      <Table className="min-w-[600px]">
                        <TableHeader>
                          <TableRow className="bg-emerald-50/30 hover:bg-emerald-50/30">
                            <TableHead className="pl-6 whitespace-nowrap">Date</TableHead>
                            <TableHead>Method</TableHead>
                            <TableHead>Reference / Cheque</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right pr-6">Amount</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {paymentsList.map((pay) => {
                            const isReturned = pay.cheque_status === "Returned";
                            const isCheque = pay.method?.toLowerCase() === "cheque";
                            return (
                              <TableRow key={pay.id} className={isReturned ? "bg-red-50/40 hover:bg-red-50/60" : "hover:bg-emerald-50/10"}>
                                <TableCell className="pl-6 text-sm">{new Date(pay.payment_date).toLocaleDateString()}</TableCell>
                                <TableCell className="text-sm">
                                  <Badge variant="secondary" className="font-normal text-xs">{pay.method}</Badge>
                                </TableCell>
                                <TableCell className="text-sm text-muted-foreground">
                                  {isCheque ? (
                                    <div className="flex flex-col">
                                      <span className={`font-mono text-xs font-medium ${isReturned ? "line-through text-gray-400" : "text-foreground"}`}>{pay.cheque_no}</span>
                                      {pay.cheque_date && <span className="text-[10px]">Due: {new Date(pay.cheque_date).toLocaleDateString()}</span>}
                                    </div>
                                  ) : "-"}
                                </TableCell>
                                <TableCell>
                                  {isCheque && pay.cheque_status ? (
                                    <Badge variant="outline" className={`text-[10px] px-1.5 border ${
                                      pay.cheque_status === "Cleared" ? "bg-green-50 text-green-700 border-green-200" :
                                      pay.cheque_status === "Returned" ? "bg-red-50 text-red-700 border-red-200" :
                                      pay.cheque_status === "Bounced" ? "bg-red-50 text-red-600 border-red-200" :
                                      pay.cheque_status === "Deposited" ? "bg-blue-50 text-blue-700 border-blue-200" :
                                      "bg-amber-50 text-amber-700 border-amber-200"
                                    }`}>{pay.cheque_status}</Badge>
                                  ) : <span className="text-xs text-muted-foreground">—</span>}
                                </TableCell>
                                <TableCell className="text-right pr-6 font-mono font-medium">
                                  <span className={isReturned ? "line-through text-gray-400" : ""}>
                                    LKR {Number(pay.amount).toLocaleString("en-LK", { minimumFractionDigits: 2 })}
                                  </span>
                                  {isReturned && <p className="text-[10px] text-red-500 font-medium">Reversed</p>}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                        <TableFooter className="bg-emerald-50/30">
                          <TableRow>
                            <TableCell colSpan={4} className="pl-6 text-emerald-700 font-medium text-right">Total Paid</TableCell>
                            <TableCell className="pr-6 text-right font-bold font-mono text-emerald-700">
                              LKR {totalPaid.toLocaleString("en-LK", { minimumFractionDigits: 2 })}
                            </TableCell>
                          </TableRow>
                        </TableFooter>
                      </Table>
                    </div>
                  </>
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
                {/* ✅ UPDATED: Totals Section */}
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    Subtotal (Gross)
                  </span>
                  <span className="font-medium font-mono">
                    LKR{" "}
                    {subTotalBeforeExtraDiscount.toLocaleString("en-LK", {
                      minimumFractionDigits: 2,
                    })}
                  </span>
                </div>

                {/* ✅ UPDATED: Extra Discount */}
                {extraDiscountAmount > 0 && (
                  <div className="flex justify-between text-sm text-red-600">
                    <span className="flex items-center gap-1">
                      Extra Discount{" "}
                      {invoice.extraDiscountPercent > 0 &&
                        `(${invoice.extraDiscountPercent}%)`}
                    </span>
                    <span className="font-medium font-mono">
                      - LKR{" "}
                      {extraDiscountAmount.toLocaleString("en-LK", {
                        minimumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                )}

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
