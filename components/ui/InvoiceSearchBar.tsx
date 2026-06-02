"use client";

import React, { useState } from "react";
import {
  Search,
  Loader2,
  ExternalLink,
  FileSearch,
  X,
  Calendar,
  User,
  CreditCard,
  CheckCircle2,
  Clock,
  Package,
  FileText,
  Banknote,
  Phone,
  Undo2,
  Percent,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import Link from "next/link";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface InvoiceSearchBarProps {
  businessId?: string;
  repId?: string;
  portalInvoicePath: string; // e.g. "/dashboard/admin/invoices"
}

// ---------------------------------------------------------------------------
// Main search bar
// ---------------------------------------------------------------------------

export function InvoiceSearchBar({
  businessId,
  repId,
  portalInvoicePath,
}: InvoiceSearchBarProps) {
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [result, setResult] = useState<any | null>(null);
  const [returns, setReturns] = useState<any[]>([]);
  const [notFound, setNotFound] = useState(false);
  const [searchedTerm, setSearchedTerm] = useState("");

  const handleSearch = async () => {
    const term = query.trim();
    if (!term) return;

    setSearching(true);
    setResult(null);
    setReturns([]);
    setNotFound(false);
    setSearchedTerm(term);

    try {
      const url = businessId
        ? `/api/invoices?businessId=${businessId}`
        : repId
        ? `/api/invoices?repId=${repId}`
        : `/api/invoices`;

      const res = await fetch(url);
      if (!res.ok) throw new Error("fetch failed");
      const invoices: any[] = await res.json();

      const lower = term.toLowerCase();
      const match = invoices.find(
        (inv) =>
          inv.invoiceNo?.toLowerCase() === lower ||
          inv.manualInvoiceNo?.toLowerCase() === lower ||
          inv.invoiceNo?.toLowerCase().includes(lower) ||
          inv.manualInvoiceNo?.toLowerCase().includes(lower)
      );

      if (!match) {
        setNotFound(true);
        return;
      }

      const [detailRes, returnsRes] = await Promise.all([
        fetch(`/api/invoices/${match.id}`),
        fetch(`/api/invoices/${match.id}/returns`),
      ]);
      if (!detailRes.ok) throw new Error("detail fetch failed");
      const detail = await detailRes.json();
      const returnsData = returnsRes.ok ? await returnsRes.json() : [];
      setResult(detail);
      setReturns(returnsData);
    } catch {
      setNotFound(true);
    } finally {
      setSearching(false);
    }
  };

  const handleInputClick = () => {
    setQuery("");
    setResult(null);
    setReturns([]);
    setNotFound(false);
    setSearchedTerm("");
  };

  return (
    <div className="space-y-4">
      {/* Search bar */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Search by invoice number (e.g. CHD-0001, CHR-0001)…"
                value={query}
                onClick={handleInputClick}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSearch();
                }}
                className="pl-9 pr-8"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => {
                    setQuery("");
                    setResult(null);
                    setReturns([]);
                    setNotFound(false);
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <Button onClick={handleSearch} disabled={searching || !query.trim()}>
              {searching ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Search className="h-4 w-4 mr-2" />
                  Search
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Not found */}
      {notFound && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="py-10 text-center">
            <FileSearch className="h-10 w-10 mx-auto text-amber-400 mb-3" />
            <p className="font-semibold text-gray-800">No invoice found</p>
            <p className="text-sm text-muted-foreground mt-1">
              No invoice matches{" "}
              <span className="font-mono font-medium">"{searchedTerm}"</span>
            </p>
          </CardContent>
        </Card>
      )}

      {/* Full inline invoice detail */}
      {result && (
        <FullInvoiceDetail
          invoice={result}
          returns={returns}
          portalInvoicePath={portalInvoicePath}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function lkr(amount: number) {
  return `LKR ${amount.toLocaleString("en-LK", { minimumFractionDigits: 2 })}`;
}

function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return "—";
  }
}

function getInitials(name: string) {
  return (name || "?")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();
}

function OrderStatusBadge({ status }: { status: string }) {
  const cls: Record<string, string> = {
    Pending: "bg-yellow-50 text-yellow-700 border-yellow-200",
    Processing: "bg-blue-50 text-blue-700 border-blue-200",
    Loading: "bg-indigo-50 text-indigo-700 border-indigo-200",
    "In Transit": "bg-purple-50 text-purple-700 border-purple-200",
    Delivered: "bg-emerald-50 text-emerald-700 border-emerald-200",
    Completed: "bg-teal-50 text-teal-700 border-teal-200",
    Cancelled: "bg-red-50 text-red-700 border-red-200",
  };
  const icons: Record<string, any> = {
    Pending: Clock,
    Processing: Package,
    Loading: Package,
    "In Transit": Package,
    Delivered: CheckCircle2,
    Completed: CheckCircle2,
    Cancelled: FileText,
  };
  const Icon = icons[status] || FileText;
  return (
    <Badge
      variant="outline"
      className={cn("px-3 py-1 gap-1.5", cls[status] || "bg-gray-50")}
    >
      <Icon className="w-3.5 h-3.5" />
      {status}
    </Badge>
  );
}

// ---------------------------------------------------------------------------
// Full invoice detail — mirrors the [id] page layout
// ---------------------------------------------------------------------------

function FullInvoiceDetail({
  invoice,
  returns,
  portalInvoicePath,
}: {
  invoice: any;
  returns: any[];
  portalInvoicePath: string;
}) {
  const items: any[] = invoice.items || [];
  const paymentsList: any[] = invoice.payments || [];

  // ── Calculations (same as [id] page) ──────────────────────────────────────
  const totalRefunded = returns.reduce(
    (acc, r) => acc + r.quantity * (r.products?.selling_price || 0),
    0
  );
  const totalPaid = paymentsList.reduce(
    (acc, p) => acc + Number(p.amount || 0),
    0
  );
  const netTotal = invoice.grandTotal || invoice.totalAmount || 0;
  const grossTotal = netTotal + totalRefunded;
  const extraDiscountAmt = invoice.extraDiscountAmount || 0;
  const originalItemsTotal = grossTotal + extraDiscountAmt;
  const balanceDue = netTotal - totalPaid;
  const totalItemsQty = items.reduce((acc, i) => acc + i.quantity, 0);
  const totalFreeQty = items.reduce((acc, i) => acc + i.freeQuantity, 0);

  // ── Supplier summary ───────────────────────────────────────────────────────
  const supplierMap: Record<string, { qty: number; total: number }> = {};
  items.forEach((item) => {
    const key = item.supplier || item.brand || "Unknown";
    if (!supplierMap[key]) supplierMap[key] = { qty: 0, total: 0 };
    supplierMap[key].qty += item.quantity || 0;
    supplierMap[key].total += item.total || 0;
  });
  const supplierEntries = Object.entries(supplierMap);

  return (
    <div className="min-h-screen bg-muted/40 rounded-lg p-4 sm:p-6 space-y-8">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-2xl font-bold tracking-tight">
              Invoice {invoice.invoiceNo}
            </h2>
            {invoice.manualInvoiceNo &&
              invoice.manualInvoiceNo !== invoice.invoiceNo && (
                <span className="text-sm text-muted-foreground font-mono">
                  ({invoice.manualInvoiceNo})
                </span>
              )}
            <OrderStatusBadge status={invoice.orderStatus || "Pending"} />
          </div>
          <p className="text-sm text-muted-foreground">
            Created on {fmtDate(invoice.date || invoice.createdAt)}
          </p>
        </div>

        <Link href={`${portalInvoicePath}/${invoice.id}`}>
          <Button className="gap-2 shrink-0">
            <ExternalLink className="h-4 w-4" />
            Open Full Details
          </Button>
        </Link>
      </div>

      {/* ── Main 2-column grid ──────────────────────────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* LEFT column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Bill To + Sales Rep */}
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
                    {getInitials(invoice.customer?.name || invoice.customerName)}
                  </AvatarFallback>
                </Avatar>
                <div className="space-y-1">
                  <h3 className="font-semibold text-base leading-none">
                    {invoice.customer?.shop || invoice.customerName || "—"}
                  </h3>
                  {invoice.customer?.name && (
                    <p className="text-sm text-muted-foreground">
                      {invoice.customer.name}
                    </p>
                  )}
                  <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1">
                    <Phone className="w-3 h-3" />
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
                    {invoice.salesRep || invoice.salesRepName || "—"}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Authorized Agent
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Line Items */}
          <Card className="shadow-sm overflow-hidden">
            <CardHeader className="bg-slate-50/50 border-b py-4">
              <div className="flex justify-between items-center">
                <CardTitle className="text-lg font-semibold">
                  Line Items
                </CardTitle>
                <Badge variant="outline" className="font-normal">
                  {items.length} Items
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table className="min-w-[640px]">
                  <TableHeader>
                    <TableRow className="bg-slate-50/50 hover:bg-slate-50/50">
                      <TableHead className="w-[35%] pl-6">
                        Product Details
                      </TableHead>
                      <TableHead className="text-center w-[10%]">Qty</TableHead>
                      <TableHead className="text-center w-[10%]">Free</TableHead>
                      <TableHead className="text-right w-[15%]">Price</TableHead>
                      <TableHead className="text-center w-[10%]">Disc.</TableHead>
                      <TableHead className="text-right w-[20%] pr-6">
                        Total
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item: any, idx: number) => (
                      <TableRow key={item.id || idx} className="hover:bg-muted/30">
                        <TableCell className="pl-6 py-4">
                          <div className="flex items-start gap-3">
                            <div className="h-8 w-8 rounded bg-slate-100 flex items-center justify-center text-slate-400 shrink-0">
                              <Package className="w-4 h-4" />
                            </div>
                            <div>
                              <p className="font-medium text-sm">
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
                        <TableCell className="text-center text-sm">
                          {item.discountPercent > 0 ? (
                            <div className="flex flex-col items-center">
                              <span className="font-medium text-red-600 bg-red-50 px-1.5 rounded text-xs">
                                -{item.discountPercent}%
                              </span>
                              {item.discountAmount > 0 && (
                                <span className="text-[10px] text-muted-foreground mt-0.5">
                                  {item.discountAmount.toLocaleString("en-LK", {
                                    maximumFractionDigits: 0,
                                  })}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
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
                      <TableCell colSpan={3} className="text-right pr-6">
                        <span className="text-xs text-muted-foreground uppercase mr-2">
                          Items Subtotal:
                        </span>
                        <span className="font-bold font-mono text-base">
                          LKR{" "}
                          {items
                            .reduce((s: number, i: any) => s + i.total, 0)
                            .toLocaleString("en-LK", {
                              minimumFractionDigits: 2,
                            })}
                        </span>
                      </TableCell>
                    </TableRow>
                  </TableFooter>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Items by Supplier */}
          {supplierEntries.length > 0 && (
            <Card className="shadow-sm overflow-hidden">
              <CardHeader className="bg-slate-50/50 border-b py-4">
                <CardTitle className="text-lg font-semibold">
                  Items by Supplier
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50/50 hover:bg-slate-50/50">
                      <TableHead className="pl-6">Supplier</TableHead>
                      <TableHead className="text-center">Qty</TableHead>
                      <TableHead className="text-right pr-6">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {supplierEntries.map(([name, s]) => (
                      <TableRow key={name} className="hover:bg-muted/30">
                        <TableCell className="pl-6 font-medium text-sm">
                          {name}
                        </TableCell>
                        <TableCell className="text-center text-sm">
                          {s.qty}
                        </TableCell>
                        <TableCell className="text-right pr-6 font-mono text-sm">
                          LKR{" "}
                          {s.total.toLocaleString("en-LK", {
                            minimumFractionDigits: 2,
                          })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Returns & Adjustments */}
          {returns.length > 0 && (
            <Card className="shadow-sm border-l-4 border-l-orange-500 overflow-hidden">
              <CardHeader className="bg-orange-50/50 border-b py-4">
                <div className="flex justify-between items-center">
                  <CardTitle className="text-lg font-semibold flex items-center gap-2">
                    <Undo2 className="h-5 w-5 text-orange-600" />
                    Returns & Adjustments
                  </CardTitle>
                  <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-200 border-none">
                    {returns.length} Record(s)
                  </Badge>
                </div>
                <CardDescription>
                  Items returned against this invoice.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
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
                      {returns.map((ret: any) => (
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
                          <TableCell className="pr-6 text-xs text-muted-foreground max-w-[150px] truncate">
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
                    {paymentsList.map((pay: any) => (
                      <TableRow key={pay.id} className="hover:bg-emerald-50/10">
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
                          {pay.method?.toLowerCase() === "cheque" ||
                          pay.cheque_no ? (
                            <div className="flex flex-col gap-0.5">
                              {pay.cheque_no && (
                                <span className="font-mono text-xs font-medium text-foreground">
                                  {pay.cheque_no}
                                </span>
                              )}
                              {pay.cheque_date && (
                                <span className="text-[10px]">
                                  Due:{" "}
                                  {new Date(
                                    pay.cheque_date
                                  ).toLocaleDateString()}
                                </span>
                              )}
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

        {/* RIGHT column */}
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
                      ? "default"
                      : totalPaid > 0
                      ? "secondary"
                      : "destructive"
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

          {/* Payment Details */}
          <Card className="shadow-sm border-t-4 border-t-primary">
            <CardHeader className="bg-muted/20 pb-4">
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-primary" />
                Payment Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-6">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Items Subtotal</span>
                <span className="font-medium font-mono">
                  LKR{" "}
                  {originalItemsTotal.toLocaleString("en-LK", {
                    minimumFractionDigits: 2,
                  })}
                </span>
              </div>

              {extraDiscountAmt > 0 && (
                <div className="flex justify-between text-sm text-red-600">
                  <span className="flex items-center gap-1">
                    <Percent className="w-3 h-3" /> Discount (
                    {invoice.extraDiscountPercent}%)
                  </span>
                  <span className="font-medium font-mono">
                    - LKR{" "}
                    {extraDiscountAmt.toLocaleString("en-LK", {
                      minimumFractionDigits: 2,
                    })}
                  </span>
                </div>
              )}

              <Separator className="my-2 bg-slate-100" />

              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal (Gross)</span>
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

              <Separator className="my-2" />

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
                <span
                  className={cn(
                    "font-bold text-2xl font-mono tracking-tight",
                    balanceDue > 0 ? "text-red-600" : "text-emerald-600"
                  )}
                >
                  LKR{" "}
                  {Math.max(0, balanceDue).toLocaleString("en-LK", {
                    minimumFractionDigits: 2,
                  })}
                </span>
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

          {/* Open Full Details button (bottom of right column) */}
          <Link href={`${portalInvoicePath}/${invoice.id}`} className="block">
            <Button className="w-full gap-2">
              <ExternalLink className="h-4 w-4" />
              Open Full Details
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
