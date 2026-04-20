"use client";

import React, { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Printer,
  FileText,
  Calendar,
  User,
  Phone,
  MapPin,
  CheckCircle2,
  Clock,
  Package,
  CreditCard,
  Banknote,
  Percent,
  Loader2,
  Truck,
  Share2,
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
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { printInvoice, downloadInvoice, shareInvoice } from "@/app/lib/invoice-print";

interface PaymentRecord {
  id: string;
  amount: number;
  payment_date: string;
  method: string;
  cheque_no?: string;
  cheque_status?: string;
  cheque_date?: string;
}

export default function RepInvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [invoice, setInvoice] = useState<any>(null);

  // Share state
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    if (!id) return;
    const fetchInvoice = async () => {
      try {
        const res = await fetch(`/api/invoices/${id}`);
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `HTTP ${res.status}`);
        }
        const data = await res.json();
        setInvoice(data);
      } catch (err: any) {
        console.error("Invoice load error:", err);
        toast.error(`Failed to load invoice: ${err.message}`);
        router.push("/dashboard/rep/invoices");
      } finally {
        setLoading(false);
      }
    };
    fetchInvoice();
  }, [id, router]);

  const handleSharePdf = () =>
    shareInvoice(id, "distribution", invoice?.invoiceNo || "", setSharing);

  const getInitials = (name: string) =>
    (name || "?")
      .split(" ")
      .map((n) => n[0])
      .join("")
      .substring(0, 2)
      .toUpperCase();

  const renderDeliveryBadge = (status: string) => {
    const styles: Record<string, string> = {
      Pending: "bg-yellow-50 text-yellow-700 border-yellow-200",
      Processing: "bg-blue-50 text-blue-700 border-blue-200",
      Checking: "bg-purple-50 text-purple-700 border-purple-200",
      Loading: "bg-indigo-50 text-indigo-700 border-indigo-200",
      "In Transit": "bg-purple-50 text-purple-700 border-purple-200",
      Delivered: "bg-emerald-50 text-emerald-700 border-emerald-200",
      Completed: "bg-teal-50 text-teal-700 border-teal-200",
      Cancelled: "bg-red-50 text-red-700 border-red-200",
    };
    const icons: Record<string, any> = {
      Pending: Clock,
      Processing: Package,
      Checking: Package,
      Loading: Package,
      "In Transit": Truck,
      Delivered: CheckCircle2,
      Completed: CheckCircle2,
      Cancelled: FileText,
    };
    const Icon = icons[status] || Truck;
    return (
      <Badge variant="outline" className={`px-3 py-1 gap-1.5 ${styles[status] || "bg-gray-50"}`}>
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
  const paymentsList: PaymentRecord[] = invoice.payments || [];
  const totalPaid = paymentsList.reduce((acc, p) => acc + Number(p.amount), 0);
  const netTotal = invoice.grandTotal || 0;
  const extraDiscountAmount = invoice.extraDiscountAmount || 0;
  const subTotalGross = invoice.items.reduce((sum: number, i: any) => sum + i.total, 0);
  const balanceDue = netTotal - totalPaid;

  const totalItemsQty = invoice.items.reduce((acc: number, item: any) => acc + item.quantity, 0);
  const totalFreeQty = invoice.items.reduce((acc: number, item: any) => acc + (item.freeQuantity || 0), 0);

  const dueDate = invoice.dueDate;

  // Days since the invoice was billed
  const billedDaysAgo = (() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const billed = new Date(invoice.date); billed.setHours(0, 0, 0, 0);
    const diff = Math.round((today.getTime() - billed.getTime()) / 86400000);
    if (diff === 0) return "Today";
    if (diff === 1) return "Yesterday";
    return `${diff} days ago`;
  })();

  const paymentStatusLabel = balanceDue <= 0 ? "Paid" : totalPaid > 0 ? "Partial" : "Unpaid";

  return (
    <div className="bg-muted/40 min-h-full">
      <div className="space-y-8">

        {/* ── Top Header ── */}
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
          <div className="space-y-1">
            <div className="flex items-center gap-3 flex-wrap">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 rounded-full bg-background shrink-0"
                onClick={() => router.push("/dashboard/rep/invoices")}
              >
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <h1 className="text-2xl font-bold tracking-tight">
                Invoice {invoice.invoiceNo}
              </h1>
              {renderDeliveryBadge(invoice.orderStatus || "Pending")}
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

          <div className="flex items-center gap-2 ml-11 md:ml-0 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              className="bg-background"
              onClick={() => downloadInvoice(id)}
            >
              <Printer className="w-4 h-4 mr-2 text-muted-foreground" />
              Download
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="bg-background"
              onClick={() => printInvoice(id)}
            >
              <Printer className="w-4 h-4 mr-2 text-muted-foreground" />
              Print
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
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Share2 className="w-4 h-4 mr-2" />
              )}
              {sharing ? "Sharing…" : "Share"}
            </Button>
          </div>
        </div>

        {/* ── Main 3-col grid ── */}
        <div className="grid gap-6 lg:grid-cols-3">

          {/* ── LEFT COLUMN (spans 2) ── */}
          <div className="lg:col-span-2 space-y-6">

            {/* Stakeholders */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="shadow-sm border-l-4 border-l-blue-500">
                <CardHeader className="pb-2">
                  <CardDescription className="text-xs font-semibold uppercase tracking-wider text-blue-600">
                    Bill To
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex items-start gap-4">
                  <Avatar className="h-10 w-10 border bg-blue-50 text-blue-600 shrink-0">
                    <AvatarFallback>{getInitials(invoice.customer?.name || invoice.customer?.shop)}</AvatarFallback>
                  </Avatar>
                  <div className="space-y-1 min-w-0">
                    <h3 className="font-semibold text-base leading-none">{invoice.customer?.shop}</h3>
                    {invoice.customer?.name && invoice.customer.name !== invoice.customer.shop && (
                      <p className="text-sm text-muted-foreground">{invoice.customer.name}</p>
                    )}
                    {invoice.customer?.phone && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground pt-1">
                        <Phone className="w-3 h-3 shrink-0" />
                        <span>{invoice.customer.phone}</span>
                      </div>
                    )}
                    {invoice.customer?.address && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <MapPin className="w-3 h-3 shrink-0" />
                        <span>{invoice.customer.address}</span>
                      </div>
                    )}
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
                  <Avatar className="h-10 w-10 border shrink-0">
                    <AvatarFallback>
                      <User className="w-5 h-5 text-muted-foreground" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="space-y-1">
                    <h3 className="font-semibold text-base leading-none">{invoice.salesRep}</h3>
                    <p className="text-xs text-muted-foreground">Authorized Agent</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Line Items Table */}
            <Card className="shadow-sm overflow-hidden">
              <CardHeader className="bg-slate-50/50 border-b py-4">
                <div className="flex justify-between items-center">
                  <CardTitle className="text-lg font-semibold">Line Items</CardTitle>
                  <Badge variant="outline" className="font-normal">
                    {invoice.items.length} Items
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50/50 hover:bg-slate-50/50">
                        <TableHead className="w-[35%] pl-6">Product Details</TableHead>
                        <TableHead className="text-center w-[10%]">Qty</TableHead>
                        <TableHead className="text-center w-[10%]">Free</TableHead>
                        <TableHead className="text-right w-[15%]">Price</TableHead>
                        <TableHead className="text-center w-[10%]">Disc.</TableHead>
                        <TableHead className="text-right w-[20%] pr-6">Total</TableHead>
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
                                <p className="font-medium text-sm text-foreground">{item.productName}</p>
                                <p className="text-xs font-mono text-muted-foreground mt-0.5">{item.sku}</p>
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
                            {(item.unitPrice || 0).toLocaleString("en-LK", { minimumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell className="text-center text-sm">
                            {item.discountPercent > 0 ? (
                              <div className="flex flex-col items-center">
                                <span className="font-medium text-red-600 bg-red-50 px-1.5 rounded text-xs">
                                  -{item.discountPercent}%
                                </span>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right pr-6 font-mono font-medium text-sm">
                            {(item.total || 0).toLocaleString("en-LK", { minimumFractionDigits: 2 })}
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
                        <TableCell colSpan={3} className="text-right pr-6">
                          <span className="text-xs text-muted-foreground uppercase mr-2">Items Subtotal:</span>
                          <span className="font-bold font-mono text-base">
                            LKR {subTotalGross.toLocaleString("en-LK", { minimumFractionDigits: 2 })}
                          </span>
                        </TableCell>
                      </TableRow>
                    </TableFooter>
                  </Table>
                </div>
              </CardContent>
            </Card>

            {/* Payment History */}
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
                        <TableHead className="text-right pr-6">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paymentsList.map((pay) => (
                        <TableRow key={pay.id} className="hover:bg-emerald-50/10">
                          <TableCell className="pl-6 text-sm">
                            {new Date(pay.payment_date).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="font-normal text-xs">
                              {pay.method}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {pay.method === "Cheque" ? (
                              <div className="flex flex-col">
                                <span className="font-mono text-xs font-medium text-foreground">
                                  {pay.cheque_no}
                                </span>
                                {pay.cheque_date && (
                                  <span className="text-[10px]">
                                    Due: {new Date(pay.cheque_date).toLocaleDateString()}
                                  </span>
                                )}
                                {pay.cheque_status && (
                                  <span className="text-[10px] italic">({pay.cheque_status})</span>
                                )}
                              </div>
                            ) : "-"}
                          </TableCell>
                          <TableCell className="text-right pr-6 font-mono font-medium">
                            LKR {Number(pay.amount).toLocaleString("en-LK", { minimumFractionDigits: 2 })}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                    <TableFooter className="bg-emerald-50/30">
                      <TableRow>
                        <TableCell colSpan={3} className="pl-6 text-emerald-700 font-medium text-right">
                          Total Paid
                        </TableCell>
                        <TableCell className="pr-6 text-right font-bold font-mono text-emerald-700">
                          LKR {totalPaid.toLocaleString("en-LK", { minimumFractionDigits: 2 })}
                        </TableCell>
                      </TableRow>
                    </TableFooter>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>

          {/* ── RIGHT COLUMN ── */}
          <div className="space-y-6">

            {/* Invoice Metadata */}
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
                  <span className="text-sm font-medium">Invoice Date</span>
                  <div className="flex flex-col items-end gap-0.5">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="w-3.5 h-3.5" />
                      {new Date(invoice.date).toLocaleDateString("en-GB", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </div>
                    <span className="text-[10px] font-medium text-blue-600">{billedDaysAgo}</span>
                  </div>
                </div>
                <Separator />
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Payment Status</span>
                  <Badge
                    variant={balanceDue <= 0 ? "default" : totalPaid > 0 ? "secondary" : "destructive"}
                    className="rounded-full px-3"
                  >
                    {paymentStatusLabel}
                  </Badge>
                </div>
                <Separator />
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Delivery Status</span>
                  {renderDeliveryBadge(invoice.orderStatus || "Pending")}
                </div>
              </CardContent>
            </Card>

            {/* Payment Summary — sticky */}
            <Card className="shadow-sm border-t-4 border-t-primary sticky top-6">
              <CardHeader className="bg-muted/20 pb-4">
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-primary" />
                  Payment Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 pt-6">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal (Gross)</span>
                  <span className="font-medium font-mono">
                    LKR {subTotalGross.toLocaleString("en-LK", { minimumFractionDigits: 2 })}
                  </span>
                </div>

                {extraDiscountAmount > 0 && (
                  <div className="flex justify-between text-sm text-red-600">
                    <span className="flex items-center gap-1">
                      <Percent className="w-3 h-3" /> Discount ({invoice.extraDiscountPercent}%)
                    </span>
                    <span className="font-medium font-mono">
                      - LKR {extraDiscountAmount.toLocaleString("en-LK", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                )}

                <Separator className="my-2 bg-slate-100" />

                <div className="flex justify-between text-sm">
                  <span className="font-medium text-slate-700">Net Invoice Amount</span>
                  <span className="font-bold font-mono text-slate-700">
                    LKR {netTotal.toLocaleString("en-LK", { minimumFractionDigits: 2 })}
                  </span>
                </div>

                {totalPaid > 0 && (
                  <div className="flex justify-between text-sm text-emerald-600 mt-2">
                    <span className="flex items-center gap-1">
                      <Banknote className="w-3 h-3" /> Paid
                    </span>
                    <span className="font-medium font-mono">
                      - LKR {totalPaid.toLocaleString("en-LK", { minimumFractionDigits: 2 })}
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
                      LKR {Math.max(0, balanceDue).toLocaleString("en-LK", { minimumFractionDigits: 2 })}
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
