"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Printer,
  Download,
  Copy,
  Share2,
  Trash2,
  Loader2,
  Building2,
  Calendar,
  Phone,
  Mail,
  MapPin,
  CheckCircle2,
  FileText,
  MessageSquare,
  FileSpreadsheet,
  Calculator,
  ShieldCheck,
  Pencil,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import {
  copyEstimateItemsAsText,
  downloadPurchaseEstimatePdf,
  printPurchaseEstimate,
  shareViaWhatsApp,
} from "@/app/lib/purchase-estimate-print";

interface PurchaseEstimateDetailProps {
  id: string;
  baseRoute: string; // e.g. "/dashboard/office/orange/purchase-estimates"
  businessName: string;
  themeColor?: "orange" | "blue" | "emerald" | "slate";
}

const fmt = (val: number) =>
  new Intl.NumberFormat("en-LK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(val || 0);

export function PurchaseEstimateDetail({
  id,
  baseRoute,
  businessName,
  themeColor = "orange",
}: PurchaseEstimateDetailProps) {
  const router = useRouter();
  const [estimate, setEstimate] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const colorStyles = {
    orange: {
      primary: "bg-orange-600 hover:bg-orange-700 text-white",
      border: "border-orange-200",
      accent: "text-orange-600",
      header: "text-orange-950",
    },
    blue: {
      primary: "bg-blue-600 hover:bg-blue-700 text-white",
      border: "border-blue-200",
      accent: "text-blue-600",
      header: "text-blue-950",
    },
    emerald: {
      primary: "bg-emerald-600 hover:bg-emerald-700 text-white",
      border: "border-emerald-200",
      accent: "text-emerald-600",
      header: "text-emerald-950",
    },
    slate: {
      primary: "bg-slate-800 hover:bg-slate-900 text-white",
      border: "border-slate-200",
      accent: "text-slate-700",
      header: "text-slate-950",
    },
  }[themeColor];

  const fetchEstimate = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/purchase-estimates/${id}`);
      if (!res.ok) throw new Error("Estimate not found");
      const data = await res.json();
      setEstimate(data);
    } catch (err: any) {
      toast.error(err.message || "Failed to load estimate");
      router.push(baseRoute);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEstimate();
  }, [id]);

  const handleStatusChange = async (newStatus: string) => {
    setUpdatingStatus(true);
    try {
      const res = await fetch(`/api/purchase-estimates/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error("Failed to update status");
      setEstimate((prev: any) => ({ ...prev, status: newStatus }));
      toast.success(`Estimate status marked as ${newStatus}`);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this estimate?")) return;
    try {
      const res = await fetch(`/api/purchase-estimates/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete estimate");
      toast.success("Estimate deleted successfully");
      router.push(baseRoute);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-3 text-sm text-muted-foreground">
          Loading purchase estimate details...
        </span>
      </div>
    );
  }

  if (!estimate) return null;

  const items = estimate.items || [];
  const supplier = estimate.supplier || {};
  const totalBilledQty = items.reduce(
    (s: number, it: any) => s + (Number(it.quantity) || 0),
    0
  );
  const totalFreeQty = items.reduce(
    (s: number, it: any) => s + (Number(it.freeQuantity) || 0),
    0
  );

  const statusColors: Record<string, string> = {
    Saved: "bg-slate-100 text-slate-700 border-slate-300",
    Finalized: "bg-blue-100 text-blue-800 border-blue-300",
    Ordered: "bg-green-100 text-green-800 border-green-300",
    Cancelled: "bg-red-100 text-red-800 border-red-300",
  };

  return (
    <div className="space-y-4 w-full pb-16">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push(baseRoute)}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className={`text-2xl md:text-3xl font-extrabold tracking-tight ${colorStyles.header} font-mono`}>
                {estimate.estimateNumber}
              </h1>
              <Badge
                variant="outline"
                className={`text-xs ${statusColors[estimate.status] || "bg-slate-100"}`}
              >
                {estimate.status}
              </Badge>
            </div>
            <p className="text-muted-foreground text-xs md:text-sm mt-0.5">
              {businessName} • Order Planning & Price Quotation
            </p>
          </div>
        </div>

        {/* Action Buttons Toolbar */}
        <div className="flex items-center flex-wrap gap-2">
          {/* Status Dropdown */}
          <div className="w-36">
            <Select
              value={estimate.status}
              onValueChange={handleStatusChange}
              disabled={updatingStatus}
            >
              <SelectTrigger className="h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Saved">Saved / Draft</SelectItem>
                <SelectItem value="Finalized">Finalized</SelectItem>
                <SelectItem value="Ordered">Ordered</SelectItem>
                <SelectItem value="Cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Copy Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 text-xs border-blue-200 text-blue-700 hover:bg-blue-50">
                <Copy className="w-3.5 h-3.5 mr-1 text-blue-600" /> Copy Order
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onClick={() => copyEstimateItemsAsText(estimate, "whatsapp")}>
                <MessageSquare className="w-4 h-4 mr-2 text-green-600" />
                <span>Copy for WhatsApp</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => copyEstimateItemsAsText(estimate, "bullet")}>
                <Copy className="w-4 h-4 mr-2 text-blue-600" />
                <span>Copy Item Names & Qty</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => copyEstimateItemsAsText(estimate, "portal_tab")}>
                <FileSpreadsheet className="w-4 h-4 mr-2 text-indigo-600" />
                <span>Copy for Portal (Tab Separated)</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Edit Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push(`${baseRoute}/${estimate.id}/edit`)}
            className="h-9 text-xs border-blue-200 text-blue-700 hover:bg-blue-50"
          >
            <Pencil className="w-3.5 h-3.5 mr-1 text-blue-600" /> Edit
          </Button>

          {/* PDF Download */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => downloadPurchaseEstimatePdf(estimate)}
            className="h-9 text-xs border-emerald-200 text-emerald-700 hover:bg-emerald-50"
          >
            <Download className="w-3.5 h-3.5 mr-1 text-emerald-600" /> PDF Download
          </Button>

          {/* Print */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => printPurchaseEstimate(estimate)}
            className="h-9 text-xs"
          >
            <Printer className="w-3.5 h-3.5 mr-1" /> Print
          </Button>

          {/* WhatsApp Share */}
          <Button
            size="sm"
            onClick={() => shareViaWhatsApp(estimate)}
            className="h-9 text-xs bg-green-600 hover:bg-green-700 text-white"
          >
            <Share2 className="w-3.5 h-3.5 mr-1" /> WhatsApp
          </Button>

          {/* Delete */}
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={handleDelete}
            title="Delete"
            className="text-slate-400 hover:text-red-500"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Info Banner */}
      <div className="bg-blue-50/70 border border-blue-200 rounded-lg p-3 text-xs text-blue-900 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0" />
          <span>
            <strong>Quotation Only Notice:</strong> This purchase estimate is stored for price estimation, budget planning, and sharing with supplier. <em>No inventory stock has been added.</em>
          </span>
        </div>
      </div>

      {/* Meta Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Supplier Card */}
        <Card className="shadow-xs">
          <CardHeader className="py-2.5 px-4 bg-slate-50/70 border-b">
            <CardTitle className="text-xs font-semibold text-slate-700 uppercase flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-slate-500" /> Supplier Details
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-1 text-xs">
            <div className="font-bold text-sm text-slate-900">{estimate.supplierName}</div>
            {supplier.contactPerson && (
              <p className="text-slate-600">Contact: {supplier.contactPerson}</p>
            )}
            {supplier.phone && (
              <p className="text-slate-600 flex items-center gap-1">
                <Phone className="w-3 h-3 text-slate-400" /> {supplier.phone}
              </p>
            )}
            {supplier.email && (
              <p className="text-slate-600 flex items-center gap-1">
                <Mail className="w-3 h-3 text-slate-400" /> {supplier.email}
              </p>
            )}
            {supplier.address && (
              <p className="text-slate-600 flex items-center gap-1">
                <MapPin className="w-3 h-3 text-slate-400" /> {supplier.address}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Estimate Details */}
        <Card className="shadow-xs">
          <CardHeader className="py-2.5 px-4 bg-slate-50/70 border-b">
            <CardTitle className="text-xs font-semibold text-slate-700 uppercase flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-500" /> Estimate Metadata
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Estimate Date:</span>
              <span className="font-medium">
                {new Date(estimate.estimateDate).toLocaleDateString("en-GB")}
              </span>
            </div>
            {estimate.arrivalDate && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Expected Date:</span>
                <span className="font-medium">
                  {new Date(estimate.arrivalDate).toLocaleDateString("en-GB")}
                </span>
              </div>
            )}
            {estimate.referenceNo && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Supplier Ref #:</span>
                <span className="font-mono font-medium">{estimate.referenceNo}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Created On:</span>
              <span>{new Date(estimate.createdAt).toLocaleDateString("en-GB")}</span>
            </div>
          </CardContent>
        </Card>

        {/* Quantity Summary Card */}
        <Card className="shadow-xs">
          <CardHeader className="py-2.5 px-4 bg-slate-50/70 border-b">
            <CardTitle className="text-xs font-semibold text-slate-700 uppercase flex items-center gap-1.5">
              <Calculator className="w-3.5 h-3.5 text-slate-500" /> Quantities & Items
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total Unique Items:</span>
              <span className="font-bold">{items.length} products</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total Billed Units:</span>
              <span className="font-bold">{totalBilledQty} units</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Free Units:</span>
              <span className="font-bold text-green-700">
                {totalFreeQty > 0 ? `+${totalFreeQty} units` : "None"}
              </span>
            </div>
            <div className="flex justify-between pt-1 border-t">
              <span className="text-muted-foreground">Grand Total Units:</span>
              <span className="font-extrabold text-slate-900">
                {totalBilledQty + totalFreeQty} units
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Items Table Card */}
      <Card className="shadow-xs overflow-hidden">
        <CardHeader className="py-3 px-4 bg-slate-50/80 border-b">
          <CardTitle className="text-sm font-semibold flex items-center justify-between">
            <span>Item Price Breakdown</span>
            <span className="text-xs font-normal text-muted-foreground">
              {items.length} items
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50/60">
              <TableRow>
                <TableHead className="w-[40px] text-center">#</TableHead>
                <TableHead className="w-[140px]">Code</TableHead>
                <TableHead>Product Description</TableHead>
                <TableHead className="text-right w-[110px]">Cost Price</TableHead>
                <TableHead className="text-center w-[80px]">Qty</TableHead>
                <TableHead className="text-center w-[80px]">Free</TableHead>
                <TableHead className="text-center w-[70px]">Unit</TableHead>
                <TableHead className="text-right w-[90px]">Disc %</TableHead>
                <TableHead className="text-right w-[140px]">Line Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((it: any, idx: number) => (
                <TableRow key={it.id || idx} className="text-xs hover:bg-slate-50/50">
                  <TableCell className="text-center font-mono text-muted-foreground">
                    {idx + 1}
                  </TableCell>
                  <TableCell className="font-mono font-bold text-slate-900">
                    {it.sku || "-"}
                  </TableCell>
                  <TableCell className="font-medium text-slate-900">
                    {it.productName}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    Rs. {fmt(it.unitPrice)}
                  </TableCell>
                  <TableCell className="text-center font-bold">
                    {it.quantity}
                  </TableCell>
                  <TableCell className="text-center font-bold text-green-700">
                    {it.freeQuantity ? `+${it.freeQuantity}` : "-"}
                  </TableCell>
                  <TableCell className="text-center text-slate-500">
                    {it.unit || "Pcs"}
                  </TableCell>
                  <TableCell className="text-right text-red-600">
                    {it.discountPercent ? `${it.discountPercent}%` : "-"}
                  </TableCell>
                  <TableCell className="text-right font-mono font-bold text-slate-950">
                    Rs. {fmt(it.total)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Bottom Summary Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Notes Card */}
        <Card className="shadow-xs">
          <CardHeader className="py-2.5 px-4 bg-slate-50/70 border-b">
            <CardTitle className="text-xs font-semibold text-slate-700 uppercase">
              Notes & Inquiries
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 text-xs text-slate-700">
            {estimate.notes ? (
              <p className="whitespace-pre-wrap">{estimate.notes}</p>
            ) : (
              <p className="text-muted-foreground italic">
                No notes or instructions attached to this estimate.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Financial Totals Card */}
        <Card className="shadow-xs border-slate-300">
          <CardHeader className="py-2.5 px-4 bg-slate-50/70 border-b">
            <CardTitle className="text-xs font-semibold text-slate-700 uppercase">
              Financial Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-2 text-xs">
            {estimate.grossTotal !== estimate.subTotal && (
              <>
                <div className="flex justify-between text-muted-foreground">
                  <span>Gross Total:</span>
                  <span className="font-mono">Rs. {fmt(estimate.grossTotal)}</span>
                </div>
                <div className="flex justify-between text-red-600">
                  <span>Line Item Discounts:</span>
                  <span className="font-mono">-Rs. {fmt(estimate.lineDiscountTotal)}</span>
                </div>
              </>
            )}

            <div className="flex justify-between font-medium pt-1 border-t">
              <span>Subtotal:</span>
              <span className="font-mono">Rs. {fmt(estimate.subTotal)}</span>
            </div>

            {estimate.extraDiscountAmount > 0 && (
              <div className="flex justify-between text-red-600 font-medium">
                <span>
                  Extra Cash Discount ({estimate.extraDiscountPercent}%):
                </span>
                <span className="font-mono">
                  -Rs. {fmt(estimate.extraDiscountAmount)}
                </span>
              </div>
            )}

            <div className="flex justify-between items-baseline pt-3 border-t-2 border-slate-300 mt-2">
              <span className="text-sm font-bold text-slate-900">
                Estimated Net Total:
              </span>
              <span className="text-xl font-extrabold font-mono text-slate-950">
                Rs. {fmt(estimate.totalAmount)}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
