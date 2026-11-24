"use client";

import React, { useState, useEffect, use } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Loader2,
  CheckCircle2,
  Clock,
  Trash2,
  ArrowRightLeft,
  ExternalLink,
  User,
  Calendar,
  Package,
  CreditCard,
  Pencil,
  Printer,
  Download,
  Share2,
} from "lucide-react";
import {
  printQuotation as printQuotationFor,
  printHalfPageQuotation as printHalfPageQuotationFor,
  downloadQuotation as downloadQuotationFor,
  shareQuotation,
} from "@/app/lib/quotation-print";
import { useQuotationPortal } from "../_portal";
import { getUserBusinessContext } from "@/app/middleware/businessAuth";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown, FileCheck, FileMinus } from "lucide-react";

interface QuotationItem {
  productId: string;
  sku: string;
  productName: string;
  quantity: number;
  freeQuantity: number;
  unit: string;
  mrp: number;
  unitPrice: number;
  discountPercent: number;
  discountAmount: number;
  total: number;
  currentStock: number;
  supplier?: string;
  retailOnly?: boolean;
}

interface Quotation {
  id: string;
  quotationNo: string;
  date: string;
  subTotal: number;
  extraDiscountPercent: number;
  extraDiscountAmount: number;
  grandTotal: number;
  paymentType: string;
  status: string;
  notes?: string;
  convertedInvoiceId?: string;
  convertedInvoiceNo?: string;
  convertedAt?: string;
  createdAt: string;
  customerId: string;
  customerName: string;
  customerOwner?: string;
  customerPhone?: string;
  items: QuotationItem[];
}

export default function QuotationViewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const qp = useQuotationPortal();
  const printQuotation = (qid: string, showBranding = true) => printQuotationFor(qid, qp.division, showBranding);
  const printHalfPageQuotation = (qid: string, showBranding = true) => printHalfPageQuotationFor(qid, qp.division, showBranding);
  const downloadQuotation = (qid: string, showBranding = true) => downloadQuotationFor(qid, qp.division, showBranding);
  const [showConvertDialog, setShowConvertDialog] = useState(false);
  const [convertPayment, setConvertPayment] = useState("Cash");
  const [converting, setConverting] = useState(false);

  const [quotation, setQuotation] = useState<Quotation | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [sharing, setSharing] = useState(false);
  const autoActionTriggeredRef = React.useRef(false);

  // Auto-trigger print or download when redirected from creation page
  useEffect(() => {
    if (loading || !quotation) return;
    if (autoActionTriggeredRef.current) return;
    autoActionTriggeredRef.current = true;
    const act = searchParams.get("print");
    if (act === "true") {
      printQuotation(id);
    } else if (act === "half") {
      printHalfPageQuotation(id);
    } else if (searchParams.get("download") === "true") {
      downloadQuotation(id);
    }
  }, [loading, quotation, id, searchParams]);

  /** Message sent with the shared PDF — quotation no, customer, items and the total. */
  const shareMessage = (showBranding: boolean) => {
    if (!quotation) return undefined;
    const money = (n: number) =>
      Number(n || 0).toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const units = quotation.items.reduce((s, i) => s + Number(i.quantity || 0), 0);
    const isBk = qp.division === "website";
    const from = !showBranding ? "" : isBk ? " from BK Wiring බඩු කඩේ" : " from Champika Hardware";
    return [
      `Quotation ${quotation.quotationNo}${from}`,
      `Customer: ${quotation.customerName}`,
      `Items: ${quotation.items.length} (${units} units)`,
      quotation.extraDiscountAmount > 0 ? `Discount: ${isBk ? "Rs" : "LKR"} ${money(quotation.extraDiscountAmount)}` : "",
      `*Total: ${isBk ? "Rs" : "LKR"} ${money(quotation.grandTotal)}*`,
      "Valid for 7 days.",
      showBranding && isBk ? "Call / WhatsApp 076-2873921 · bkwiringbadukade.lk" : "",
    ]
      .filter(Boolean)
      .join("\n");
  };

  const handleSharePdf = (showBranding: boolean = true) =>
    shareQuotation(id, qp.division, quotation?.quotationNo || "", setSharing, showBranding, shareMessage(showBranding));

  useEffect(() => {
    const fetchQuotation = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/quotations/${id}`);
        if (!res.ok) throw new Error("Failed to load quotation");
        const data = await res.json();
        setQuotation(data);
      } catch {
        toast.error("Failed to load quotation");
        router.push(qp.basePath);
      } finally {
        setLoading(false);
      }
    };
    fetchQuotation();
  }, [id, router]);

  const handleConvertToBill = () => {
    if (qp.convertMode === "api") {
      setConvertPayment(quotation?.paymentType === "Credit" ? "Credit" : "Cash");
      setShowConvertDialog(true);
      return;
    }
    router.push(`/dashboard/office/retail/walkin-sales?quotationId=${id}`);
  };

  // Website portal: create the invoice straight from the quotation (stock comes off Retail).
  const handleConvertViaApi = async () => {
    setConverting(true);
    try {
      const user = getUserBusinessContext();
      const res = await fetch(`/api/quotations/${id}/convert`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentType: convertPayment, userId: user?.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Convert failed");
      toast.success(`Invoice ${data.invoiceNo} created`);
      router.push(qp.invoicePath(data.invoiceId));
    } catch (err: any) {
      toast.error(err.message || "Convert failed");
    } finally {
      setConverting(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/quotations/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Delete failed");
      }
      toast.success("Quotation deleted");
      router.push(qp.basePath);
    } catch (err: any) {
      toast.error(err.message || "Delete failed");
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-green-600" />
      </div>
    );
  }

  if (!quotation) return null;

  const isActive = quotation.status === "Active";
  const isConverted = quotation.status === "Converted";

  const supplierBorderClass = (item: QuotationItem) => {
    if (item.retailOnly) return "border-l-4 border-l-emerald-500";
    const sup = (item.supplier || "").toLowerCase();
    if (sup.includes("sierra")) return "border-l-4 border-l-purple-500";
    if (sup.includes("wireman")) return "border-l-4 border-l-red-500";
    if (sup.includes("orange")) return "border-l-4 border-l-orange-500";
    return "border-l-4 border-l-slate-200";
  };

  return (
    <div className="space-y-6 pb-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push(qp.basePath)}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold tracking-tight">{quotation.quotationNo}</h1>
            {isConverted ? (
              <Badge className="bg-green-100 text-green-700 border-green-200 gap-1">
                <CheckCircle2 className="w-3 h-3" /> Converted
              </Badge>
            ) : (
              <Badge className="bg-amber-100 text-amber-700 border-amber-200 gap-1">
                <Clock className="w-3 h-3" /> Active
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground text-sm mt-0.5">
            Created {new Date(quotation.createdAt).toLocaleDateString()}
            {isConverted && quotation.convertedAt && (
              <> · Converted {new Date(quotation.convertedAt).toLocaleDateString()}</>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {isConverted && quotation.convertedInvoiceId && (
            <Button variant="outline" size="sm" onClick={() => router.push(qp.invoicePath(quotation.convertedInvoiceId!))}>
              <ExternalLink className="w-4 h-4 mr-2" />
              View Invoice {quotation.convertedInvoiceNo}
            </Button>
          )}
          {/* Print Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Printer className="w-4 h-4 mr-1.5 text-muted-foreground" />
                <span>Print</span>
                <ChevronDown className="w-3.5 h-3.5 ml-1 opacity-70" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="text-xs text-muted-foreground">Print Options</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => printQuotation(id, true)} className="cursor-pointer">
                <FileCheck className="w-4 h-4 mr-2 text-green-600" />
                <div className="flex flex-col">
                  <span className="font-semibold text-xs">Print A4 (With Branding)</span>
                  <span className="text-[10px] text-muted-foreground">Champika Hardware Header</span>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => printQuotation(id, false)} className="cursor-pointer">
                <FileMinus className="w-4 h-4 mr-2 text-slate-600" />
                <div className="flex flex-col">
                  <span className="font-semibold text-xs">Print A4 (Without Branding)</span>
                  <span className="text-[10px] text-muted-foreground">Plain / Neutral Format</span>
                </div>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => printHalfPageQuotation(id, true)} className="cursor-pointer">
                <FileCheck className="w-4 h-4 mr-2 text-green-600" />
                <div className="flex flex-col">
                  <span className="font-semibold text-xs">Print A5 (With Branding)</span>
                  <span className="text-[10px] text-muted-foreground">Champika Hardware Header</span>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => printHalfPageQuotation(id, false)} className="cursor-pointer">
                <FileMinus className="w-4 h-4 mr-2 text-slate-600" />
                <div className="flex flex-col">
                  <span className="font-semibold text-xs">Print A5 (Without Branding)</span>
                  <span className="text-[10px] text-muted-foreground">Plain / Neutral Format</span>
                </div>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Download PDF Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Download className="w-4 h-4 mr-1.5 text-muted-foreground" />
                <span>Download PDF</span>
                <ChevronDown className="w-3.5 h-3.5 ml-1 opacity-70" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="text-xs text-muted-foreground">Download Options</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => downloadQuotation(id, true)} className="cursor-pointer">
                <FileCheck className="w-4 h-4 mr-2 text-green-600" />
                <div className="flex flex-col">
                  <span className="font-semibold text-xs">With Champika Branding</span>
                  <span className="text-[10px] text-muted-foreground">Full Logo &amp; Header</span>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => downloadQuotation(id, false)} className="cursor-pointer">
                <FileMinus className="w-4 h-4 mr-2 text-slate-600" />
                <div className="flex flex-col">
                  <span className="font-semibold text-xs">Without Branding</span>
                  <span className="text-[10px] text-muted-foreground">Plain / Neutral Format</span>
                </div>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Share PDF Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="bg-green-50 border-green-200 text-green-700 hover:bg-green-100 hover:text-green-800"
                disabled={sharing}
              >
                {sharing ? (
                  <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                ) : (
                  <Share2 className="w-4 h-4 mr-1.5" />
                )}
                <span>{sharing ? "Sharing…" : "Share PDF"}</span>
                <ChevronDown className="w-3.5 h-3.5 ml-1 opacity-70" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="text-xs text-muted-foreground">Share Options</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handleSharePdf(true)} className="cursor-pointer">
                <FileCheck className="w-4 h-4 mr-2 text-green-600" />
                <div className="flex flex-col">
                  <span className="font-semibold text-xs">Share (With Branding)</span>
                  <span className="text-[10px] text-muted-foreground">With Champika Header</span>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleSharePdf(false)} className="cursor-pointer">
                <FileMinus className="w-4 h-4 mr-2 text-slate-600" />
                <div className="flex flex-col">
                  <span className="font-semibold text-xs">Share (Without Branding)</span>
                  <span className="text-[10px] text-muted-foreground">Plain / Neutral Format</span>
                </div>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {isActive && (
            <>
              <Button variant="outline" size="sm" onClick={() => setShowDeleteDialog(true)} className="text-destructive hover:text-destructive">
                <Trash2 className="w-4 h-4 mr-2" /> Delete
              </Button>
              <Button variant="outline" size="sm" onClick={() => router.push(`${qp.basePath}/${id}/edit`)}>
                <Pencil className="w-4 h-4 mr-2" /> Edit
              </Button>
              <Button
                size="sm"
                onClick={handleConvertToBill}
                className="bg-green-600 hover:bg-green-700"
              >
                <ArrowRightLeft className="w-4 h-4 mr-2" />
                Convert to Bill
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Converted banner */}
      {isConverted && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
          <div>
            <p className="font-semibold text-green-800 text-sm">This quotation has been converted to an invoice.</p>
            {quotation.convertedInvoiceNo && (
              <p className="text-xs text-green-700 mt-0.5">Invoice: <span className="font-mono font-bold">{quotation.convertedInvoiceNo}</span></p>
            )}
          </div>
          {quotation.convertedInvoiceId && (
            <Button size="sm" variant="outline" className="ml-auto border-green-300 text-green-700 hover:bg-green-100"
              onClick={() => router.push(qp.invoicePath(quotation.convertedInvoiceId!))}>
              Open Invoice <ExternalLink className="w-3 h-3 ml-1" />
            </Button>
          )}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left: Items */}
        <div className="lg:col-span-2 space-y-6">
          {/* Customer & details */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Quotation Details</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-muted-foreground flex items-center gap-1"><User className="w-3 h-3" /> Customer</p>
                <p className="font-semibold text-sm mt-0.5">{quotation.customerName}</p>
                {quotation.customerOwner && <p className="text-xs text-muted-foreground">{quotation.customerOwner}</p>}
              </div>
              <div>
                <p className="text-xs text-muted-foreground flex items-center gap-1"><Calendar className="w-3 h-3" /> Date</p>
                <p className="font-semibold text-sm mt-0.5">{quotation.date}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground flex items-center gap-1"><CreditCard className="w-3 h-3" /> Payment</p>
                <p className={cn("font-semibold text-sm mt-0.5", quotation.paymentType === "Cash" ? "text-green-600" : "text-orange-600")}>
                  {quotation.paymentType === "Cash" ? "💵 Cash" : "📋 Credit"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground flex items-center gap-1"><Package className="w-3 h-3" /> Items</p>
                <p className="font-semibold text-sm mt-0.5">{quotation.items.length} product{quotation.items.length !== 1 ? "s" : ""}</p>
              </div>
            </CardContent>
          </Card>

          {/* Items table */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Items</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/50">
                    <TableHead>#</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-center">Qty</TableHead>
                    <TableHead className="text-center">Stock Now</TableHead>
                    <TableHead className="text-right">Unit Price</TableHead>
                    <TableHead className="text-right">Disc %</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {quotation.items.map((item, idx) => (
                    <TableRow key={idx} className={supplierBorderClass(item)}>
                      <TableCell className="text-xs text-muted-foreground">{idx + 1}</TableCell>
                      <TableCell>
                        <div className="font-medium text-sm">{item.productName}</div>
                        <div className="text-xs text-muted-foreground font-mono">{item.sku}</div>
                        {item.freeQuantity > 0 && (
                          <div className="text-xs text-green-600">+{item.freeQuantity} free</div>
                        )}
                      </TableCell>
                      <TableCell className="text-center font-mono">{item.quantity} {item.unit}</TableCell>
                      <TableCell className="text-center">
                        <span className={cn("font-mono text-xs font-semibold", item.currentStock === 0 ? "text-red-500" : item.currentStock < item.quantity ? "text-amber-500" : "text-green-600")}>
                          {item.currentStock}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">LKR {item.unitPrice.toLocaleString()}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{item.discountPercent > 0 ? `${item.discountPercent}%` : "—"}</TableCell>
                      <TableCell className="text-right font-semibold">LKR {item.total.toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  {quotation.extraDiscountAmount > 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-right text-sm text-muted-foreground">
                        Subtotal
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        LKR {quotation.subTotal.toLocaleString()}
                      </TableCell>
                    </TableRow>
                  )}
                  {quotation.extraDiscountPercent > 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-right text-sm text-red-500">
                        Extra Discount ({quotation.extraDiscountPercent}%)
                      </TableCell>
                      <TableCell className="text-right font-medium text-red-500">
                        − LKR {quotation.extraDiscountAmount.toLocaleString()}
                      </TableCell>
                    </TableRow>
                  )}
                  <TableRow className="bg-slate-50">
                    <TableCell colSpan={6} className="text-right font-bold text-base">Grand Total</TableCell>
                    <TableCell className="text-right font-black text-green-700 text-lg">
                      LKR {quotation.grandTotal.toLocaleString()}
                    </TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </CardContent>
          </Card>

          {quotation.notes && (
            <Card>
              <CardContent className="py-3">
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold mb-1">Notes</p>
                <p className="text-sm">{quotation.notes}</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right: Summary + Convert */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Totals</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span>LKR {quotation.subTotal.toLocaleString()}</span>
              </div>
              {quotation.extraDiscountAmount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Extra Discount ({quotation.extraDiscountPercent}%)</span>
                  <span className="text-red-500">− LKR {quotation.extraDiscountAmount.toLocaleString()}</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between font-bold text-lg">
                <span>Grand Total</span>
                <span className="text-green-700">LKR {quotation.grandTotal.toLocaleString()}</span>
              </div>
            </CardContent>
          </Card>

          {isActive && (
            <Card className="border-green-200 bg-green-50/30">
              <CardContent className="py-4 space-y-3">
                <p className="text-sm font-semibold text-green-800">Ready to finalise?</p>
                <p className="text-xs text-muted-foreground">
                  {qp.convertMode === "api"
                    ? "Converting will create a BK Wiring invoice and deduct stock from Retail."
                    : "Converting will create a retail invoice and deduct stock."}
                </p>
                <Button
                  className="w-full bg-green-600 hover:bg-green-700 font-bold"
                  onClick={handleConvertToBill}
                >
                  <ArrowRightLeft className="w-4 h-4 mr-2" />
                  Convert to Bill
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Stock alert */}
          {isActive && quotation.items.some((i) => i.currentStock < i.quantity) && (
            <Card className="border-amber-200 bg-amber-50">
              <CardContent className="py-3">
                <p className="text-xs font-semibold text-amber-800 mb-1.5">Stock Warning</p>
                {quotation.items
                  .filter((i) => i.currentStock < i.quantity)
                  .map((i, idx) => (
                    <div key={idx} className="text-xs text-amber-700 flex justify-between">
                      <span className="truncate">{i.productName}</span>
                      <span className="shrink-0 ml-2">Need {i.quantity}, Have {i.currentStock}</span>
                    </div>
                  ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Convert Dialog (website portal) */}
      <Dialog open={showConvertDialog} onOpenChange={setShowConvertDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Create invoice?</DialogTitle>
            <DialogDescription>
              <strong>{quotation.quotationNo}</strong> · LKR {quotation.grandTotal.toLocaleString()} for {quotation.customerName}.
              Stock is deducted when the invoice is created.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-2">
            {["Cash", "Credit"].map((pt) => (
              <Button
                key={pt}
                type="button"
                variant={convertPayment === pt ? "default" : "outline"}
                onClick={() => setConvertPayment(pt)}
              >
                {pt === "Cash" ? "💵 Cash (paid now)" : "📋 Credit (pay later)"}
              </Button>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConvertDialog(false)}>Cancel</Button>
            <Button className="bg-green-600 hover:bg-green-700" onClick={handleConvertViaApi} disabled={converting}>
              {converting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ArrowRightLeft className="w-4 h-4 mr-2" />}
              Create Invoice
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Quotation?</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{quotation.quotationNo}</strong>? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
