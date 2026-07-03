"use client";

import React, { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
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
} from "lucide-react";
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

  const [quotation, setQuotation] = useState<Quotation | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

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
        router.push("/dashboard/office/retail/quotations");
      } finally {
        setLoading(false);
      }
    };
    fetchQuotation();
  }, [id, router]);

  const handleConvertToBill = () => {
    router.push(`/dashboard/office/retail/walkin-sales?quotationId=${id}`);
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
      router.push("/dashboard/office/retail/quotations");
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
        <Button variant="ghost" size="icon" onClick={() => router.push("/dashboard/office/retail/quotations")}>
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
            <Button variant="outline" size="sm" onClick={() => router.push(`/dashboard/office/retail/invoices/${quotation.convertedInvoiceId}`)}>
              <ExternalLink className="w-4 h-4 mr-2" />
              View Invoice {quotation.convertedInvoiceNo}
            </Button>
          )}
          {isActive && (
            <>
              <Button variant="outline" size="sm" onClick={() => setShowDeleteDialog(true)} className="text-destructive hover:text-destructive">
                <Trash2 className="w-4 h-4 mr-2" /> Delete
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
              onClick={() => router.push(`/dashboard/office/retail/invoices/${quotation.convertedInvoiceId}`)}>
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
                <p className="text-xs text-muted-foreground">Converting will create a retail invoice and deduct stock.</p>
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
