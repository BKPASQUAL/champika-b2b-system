"use client";

import React, { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Printer,
  CheckCircle2,
  XCircle,
  Edit,
  Save,
  X,
  User,
  Phone,
  Briefcase,
  AlertTriangle,
  Loader2,
  Package,
  Layers,
  FileText,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { printInvoice } from "@/app/lib/invoice-print";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
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
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { toast } from "sonner";

interface ParsedReturnMeta {
  invoiceNo: string;
  unitPrice: number;
  noteCode: string;
  cleanReason: string;
}

const parseReturnMetadata = (
  reason?: string | null,
  fallbackPrice?: number
): ParsedReturnMeta => {
  let invoiceNo = "-";
  let unitPrice = fallbackPrice || 0;
  let noteCode = "";
  let cleanReason = reason || "";

  if (reason) {
    const invMatch = reason.match(/\[INV:([^\]]+)\]/);
    if (invMatch) {
      invoiceNo = invMatch[1];
      cleanReason = cleanReason.replace(invMatch[0], "").trim();
    }
    const priceMatch = reason.match(/\[PRICE:([\d.]+)\]/);
    if (priceMatch) {
      unitPrice = parseFloat(priceMatch[1]) || unitPrice;
      cleanReason = cleanReason.replace(priceMatch[0], "").trim();
    }
    const noteMatch = reason.match(/\[NOTE:([^\]]+)\]/);
    if (noteMatch) {
      noteCode = noteMatch[1];
      cleanReason = cleanReason.replace(noteMatch[0], "").trim();
    }
    const batchMatch = reason.match(/\[BATCH:([^\]]+)\]/);
    if (batchMatch) {
      cleanReason = cleanReason.replace(batchMatch[0], "").trim();
    }
    const bracketMatch = reason.match(/\[([A-Z0-9_-]+)\]/);
    if (
      invoiceNo === "-" &&
      bracketMatch &&
      !bracketMatch[1].startsWith("PRICE:") &&
      !bracketMatch[1].startsWith("NOTE:") &&
      !bracketMatch[1].startsWith("BATCH:")
    ) {
      invoiceNo = bracketMatch[1];
    }
  }

  return { invoiceNo, unitPrice, noteCode, cleanReason };
};

// This page is shared by the office and admin portals — go back to the right Pending list
const pendingListPath = () =>
  typeof window !== "undefined" && window.location.pathname.startsWith("/dashboard/admin")
    ? "/dashboard/admin/orders/pending"
    : "/dashboard/office/distribution/orders/pending";

export default function ReturnDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [returnRecord, setReturnRecord] = useState<any | null>(null);
  // Other items saved under the same return note (same [NOTE:code])
  const [siblings, setSiblings] = useState<any[]>([]);

  // Edit Mode State
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Editable Form Fields
  const [editQty, setEditQty] = useState<number>(1);
  const [editUnitPrice, setEditUnitPrice] = useState<number>(0);
  const [editReturnType, setEditReturnType] = useState<"Good" | "Damage" | "Exchange">("Good");
  const [editRemarks, setEditRemarks] = useState<string>("");

  // Approval / Rejection States
  const [actionProcessing, setActionProcessing] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [showApproveDialog, setShowApproveDialog] = useState(false);

  // Invoice Bill Viewer Sheet State
  const [showInvoiceSheet, setShowInvoiceSheet] = useState(false);
  const [loadingInvoice, setLoadingInvoice] = useState(false);
  const [fullInvoiceDetails, setFullInvoiceDetails] = useState<any | null>(null);

  // Print Return Note State
  const [isPrinting, setIsPrinting] = useState(false);

  const fetchReturnDetail = async () => {
    if (!id || id === "undefined") {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/inventory/returns/${encodeURIComponent(id)}`);
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || "Return record not found");
      }
      const data = await res.json();
      setReturnRecord(data);

      const meta = parseReturnMetadata(data.reason, data.products?.selling_price);
      setEditQty(Number(data.quantity || 1));
      setEditUnitPrice(meta.unitPrice);
      setEditReturnType(data.return_type || "Good");
      setEditRemarks(meta.cleanReason);

      // Load every item of this return note so it shows like one bill
      setSiblings([]);
      if (meta.noteCode && data.customer_id) {
        const sibRes = await fetch(
          `/api/inventory/returns?noteCode=${encodeURIComponent(meta.noteCode)}&customerId=${data.customer_id}&limit=all`
        );
        if (sibRes.ok) {
          const sibJson = await sibRes.json();
          const rows = (sibJson.data || []).sort((a: any, b: any) =>
            (a.return_number || "").localeCompare(b.return_number || "", undefined, { numeric: true })
          );
          setSiblings(rows);
        }
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to load return note details");
    } finally {
      setLoading(false);
    }
  };

  // Opened from another screen (e.g. Reconcile) with ?edit=1&returnTo=...
  const [returnTo, setReturnTo] = useState<string | null>(null);
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    if (sp.get("edit") === "1") setIsEditing(true);
    const back = sp.get("returnTo");
    if (back && back.startsWith("/dashboard/")) setReturnTo(back);
  }, [id]);

  useEffect(() => {
    fetchReturnDetail();
  }, [id]);

  const meta = parseReturnMetadata(returnRecord?.reason, returnRecord?.products?.selling_price);
  const sourceInvoice = returnRecord?.source_invoice;
  const hasInvoice = meta.invoiceNo && meta.invoiceNo !== "-";

  // All items in this return note (just this one when it was a single-item note)
  const noteItems: any[] =
    returnRecord && siblings.length > 1 && siblings.some((s) => s.id === returnRecord.id)
      ? siblings.map((s) => (s.id === returnRecord.id ? { ...s, ...returnRecord } : s))
      : returnRecord
      ? [returnRecord]
      : [];
  const isMultiItem = noteItems.length > 1;
  const noteNumber =
    isMultiItem && meta.noteCode
      ? `RET-${meta.noteCode}`
      : returnRecord?.return_number || `RET-${id.substring(0, 8)}`;
  const pendingNoteItems = noteItems.filter((it) => it.status === "Pending");

  // Open Invoice Sheet Handler (a specific bill number can be passed for other items in the note)
  const handleOpenInvoice = async (billArg?: unknown) => {
    const billNo = typeof billArg === "string" ? billArg : undefined;
    const ownBill = !billNo || billNo === meta.invoiceNo;
    const invId = ownBill ? sourceInvoice?.id || returnRecord?.invoice_id : undefined;
    const invNo = billNo || meta.invoiceNo;

    if (!invId && (!invNo || invNo === "-")) {
      toast.error("No source invoice associated with this return note");
      return;
    }

    setShowInvoiceSheet(true);
    setLoadingInvoice(true);
    try {
      let targetId = invId;
      if (!targetId && invNo && invNo !== "-") {
        const searchRes = await fetch(`/api/invoices?search=${encodeURIComponent(invNo)}`);
        if (searchRes.ok) {
          const searchData = await searchRes.json();
          const invoicesList = Array.isArray(searchData) ? searchData : (searchData.invoices || []);
          const found = invoicesList.find(
            (i: any) => i.invoice_no === invNo || i.invoiceNo === invNo
          );
          if (found) targetId = found.id;
        }
      }

      if (!targetId) {
        throw new Error(`Could not find invoice record for ${invNo}`);
      }

      const res = await fetch(`/api/invoices/${targetId}`);
      if (!res.ok) throw new Error("Failed to load invoice details");
      const data = await res.json();
      setFullInvoiceDetails(data);
    } catch (err: any) {
      console.error("Error opening invoice:", err);
      toast.error(err.message || "Could not load invoice details");
    } finally {
      setLoadingInvoice(false);
    }
  };

  // Save Edits Handler
  const handleSaveEdits = async () => {
    if (editQty <= 0) {
      toast.error("Quantity must be greater than zero");
      return;
    }
    if (editUnitPrice < 0) {
      toast.error("Unit rate cannot be negative");
      return;
    }

    setSaving(true);
    try {
      const invTag = meta.invoiceNo && meta.invoiceNo !== "-" ? `[INV:${meta.invoiceNo}]` : "";
      const noteTag = meta.noteCode ? `[NOTE:${meta.noteCode}]` : "";
      const priceTag = `[PRICE:${editUnitPrice}]`;
      const combinedReason = `${invTag} ${priceTag} ${noteTag} ${editRemarks}`.trim();

      const targetId = returnRecord?.id || id;
      const res = await fetch(`/api/inventory/returns/${encodeURIComponent(targetId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quantity: editQty,
          unit_price: editUnitPrice,
          return_type: editReturnType,
          reason: combinedReason,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to save edits");
      }

      toast.success("Return note details updated successfully!");
      setIsEditing(false);
      if (returnTo) {
        router.push(returnTo);
        return;
      }
      fetchReturnDetail();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Error saving edits");
    } finally {
      setSaving(false);
    }
  };

  // Approve Handler — approves every pending item in the note
  const handleApprove = async () => {
    setActionProcessing(true);
    try {
      const targets = pendingNoteItems.length > 0 ? pendingNoteItems : [returnRecord];
      let done = 0;
      for (const it of targets) {
        const targetId = it?.id || id;
        const res = await fetch(`/api/inventory/returns/${encodeURIComponent(targetId)}/approve`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "approve" }),
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(
            `${data.error || "Approval failed"}${done > 0 ? ` (${done} of ${targets.length} items approved)` : ""}`
          );
        }
        done++;
      }

      toast.success(
        `Return Note approved! ${returnRecord?.return_type === "Exchange" ? "Exchange sent to Approved Orders — process the replacement items (no payment needed)." : "Routed directly to Loading so driver can collect items from customer."}`
      );
      setShowApproveDialog(false);
      fetchReturnDetail();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to approve return note");
      fetchReturnDetail();
    } finally {
      setActionProcessing(false);
    }
  };

  // Reject Handler — rejects every pending item in the note
  const handleReject = async () => {
    setActionProcessing(true);
    try {
      const targets = pendingNoteItems.length > 0 ? pendingNoteItems : [returnRecord];
      for (const it of targets) {
        const targetId = it?.id || id;
        const res = await fetch(`/api/inventory/returns/${encodeURIComponent(targetId)}/approve`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "reject",
            rejection_reason: rejectionReason,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Rejection failed");
      }

      toast.success(`Return Note rejected.`);
      setShowRejectDialog(false);
      fetchReturnDetail();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to reject return note");
    } finally {
      setActionProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-24">
        <Loader2 className="h-9 w-9 animate-spin text-primary" />
      </div>
    );
  }

  if (!returnRecord) {
    return (
      <div className="p-8 text-center">
        <AlertTriangle className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
        <h2 className="text-xl font-bold">Return Note Not Found</h2>
        <Button
          onClick={() => router.push(pendingListPath())}
          className="mt-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Pending Orders
        </Button>
      </div>
    );
  }

  const displayQty = isEditing ? editQty : Number(returnRecord.quantity || 1);
  const displayUnitPrice = isEditing ? editUnitPrice : meta.unitPrice;
  const currentTotal = displayQty * displayUnitPrice;
  const isPending = pendingNoteItems.length > 0;

  // One line per item in the note; the item opened on this page uses the edit values
  const noteLines = noteItems.map((it) => {
    const isMain = it.id === returnRecord.id;
    const m = parseReturnMetadata(it.reason, it.products?.selling_price);
    const qty = isMain ? displayQty : Number(it.quantity || 0);
    const price = isMain ? displayUnitPrice : m.unitPrice;
    const type: string = isMain ? editReturnType : it.return_type || "Good";
    return { item: it, isMain, meta: m, qty, price, type, total: qty * price };
  });
  const noteTotal = noteLines.reduce((s, l) => s + l.total, 0);
  const noteUnits = noteLines.reduce((s, l) => s + l.qty, 0);
  const otherItemPath = (itemId: string) =>
    `${window.location.pathname.replace(/[^/]+$/, itemId)}?edit=1`;

  const handlePrintReturnNote = async () => {
    if (!returnRecord) return;
    setIsPrinting(true);
    try {
      const returnNo = noteNumber;
      const qty = noteUnits;
      const unitPrice = displayUnitPrice;
      const returnType = isEditing ? editReturnType : (returnRecord.return_type || "Good");
      const productLabel = isMultiItem
        ? `${noteLines.length} items`
        : returnRecord.products?.name || "Product";

      let returnNoteTag = `[RETURN_NOTE: ${returnNo}]`;
      if (returnType === "Exchange") {
        returnNoteTag = `[DAMAGE_EXCHANGE: ${returnNo}]`;
      } else if (returnType === "Damage") {
        returnNoteTag = `[DAMAGE_RETURN: ${returnNo}]`;
      }

      const printData = {
        invoiceNo: returnNo,
        manualInvoiceNo: null,
        date: returnRecord.created_at || new Date().toISOString(),
        salesRep: returnRecord.profiles?.full_name || "Unknown",
        grandTotal: 0,
        totalAmount: 0,
        notes: `${returnNoteTag} ${returnType} Return Note ${returnNo} (${qty} x ${productLabel}). Reason: ${meta.invoiceNo && meta.invoiceNo !== '-' ? `[INV:${meta.invoiceNo}] ` : ''}${isMultiItem ? "" : `[PRICE:${unitPrice}] `}${meta.cleanReason || "Customer return"}. Collect items from customer.`,
        customer: {
          shop: returnRecord.customers?.shop_name || "Unknown Customer",
          name: returnRecord.customers?.owner_name || returnRecord.customers?.shop_name || "",
          address: returnRecord.customers?.address || "",
          phone: returnRecord.customers?.phone || "",
          route: returnRecord.customers?.route || "",
        },
        items: noteLines.map((l) => ({
          sku: l.item.products?.sku || "-",
          productName: l.item.products?.name || "Product",
          unitPrice: l.price,
          quantity: l.qty,
          unit: l.item.products?.unit_of_measure || "Pcs",
          freeQuantity: 0,
          discountPercent: 0,
          total: 0,
        })),
      };

      await printInvoice(printData, "distribution");
    } catch (err: any) {
      console.error("Print error:", err);
      toast.error("Failed to generate return note for printing");
    } finally {
      setIsPrinting(false);
    }
  };

  return (
    <div className="space-y-4 mx-auto pb-20">
      {/* ── TOP HEADER (FULL WIDTH) ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.back()}
            className="h-9 w-9"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-blue-900">
              {isEditing ? "Edit Return Note" : "Return Note Details"}
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-sm text-muted-foreground font-mono">
                Return Note #{noteNumber}
              </p>
              <Badge
                variant={returnRecord.status === "Pending" ? "secondary" : "outline"}
                className="text-xs"
              >
                {returnRecord.status}
              </Badge>
              {editReturnType === "Good" ? (
                <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 font-semibold text-xs">
                  Good Return
                </Badge>
              ) : editReturnType === "Exchange" ? (
                <Badge className="bg-blue-100 text-blue-800 border-blue-300 font-semibold text-xs">
                  Damage Exchange
                </Badge>
              ) : (
                <Badge className="bg-rose-100 text-rose-800 border-rose-300 font-semibold text-xs">
                  Damaged Stock
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons Top Right */}
        <div className="flex gap-2">
          {isEditing ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsEditing(false);
                  setEditQty(Number(returnRecord.quantity || 1));
                  setEditUnitPrice(meta.unitPrice);
                  setEditReturnType(returnRecord.return_type || "Good");
                  setEditRemarks(meta.cleanReason);
                  if (returnTo) router.push(returnTo);
                }}
                disabled={saving}
              >
                <X className="w-4 h-4 mr-2" /> Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSaveEdits}
                disabled={saving}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                Save Changes
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrintReturnNote}
                disabled={isPrinting}
                className="border-slate-300 text-slate-700 hover:bg-slate-50"
              >
                {isPrinting ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Printer className="w-4 h-4 mr-2 text-slate-600" />
                )}
                Print
              </Button>

              {isPending && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsEditing(true)}
                    className="bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 hover:text-blue-800"
                  >
                    <Edit className="w-4 h-4 mr-2" /> Edit Return
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                    onClick={() => setShowRejectDialog(true)}
                    disabled={actionProcessing}
                  >
                    <XCircle className="w-4 h-4 mr-2" /> Reject
                  </Button>
                  <Button
                    size="sm"
                    className="bg-green-600 hover:bg-green-700 text-white"
                    onClick={() => setShowApproveDialog(true)}
                    disabled={actionProcessing}
                  >
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Approve
                  </Button>
                </>
              )}

              {/* Approved returns can still be corrected (e.g. during delivery reconcile) until settled */}
              {returnRecord.status === "Approved" && !(returnRecord.reason || "").includes("[SETTLED_IN_PAYMENT:") && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditing(true)}
                  className="bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 hover:text-blue-800"
                >
                  <Edit className="w-4 h-4 mr-2" /> Edit Return
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── TWO COLUMN MAIN LAYOUT ── */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* LEFT COLUMN (2 Cols) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Customer & Invoice Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Customer & Invoice</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Blue Banner with Return Note Number as primary and Source Invoice with Values */}
              <div className="bg-gradient-to-r from-blue-50 to-blue-100/50 p-4 rounded-lg border border-blue-200">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <Label className="text-xs text-blue-600 font-semibold uppercase tracking-wide">
                      Return Note Number
                    </Label>
                    <div className="text-2xl font-bold text-blue-900 mt-1 font-mono flex items-center gap-2">
                      {noteNumber}
                      <Badge variant="outline" className="text-xs border-blue-300 text-blue-800 bg-white">
                        {isMultiItem ? `Return Note · ${noteLines.length} items` : "Return Note"}
                      </Badge>
                    </div>

                    {/* Show Selected Invoice & Verified Values (Clickable to view invoice bill) */}
                    <div className="flex flex-wrap items-center gap-3 mt-2 text-xs">
                      <span className="text-slate-600 font-medium">Selected Invoice:</span>
                      {hasInvoice ? (
                        <>
                          <button
                            type="button"
                            onClick={handleOpenInvoice}
                            className="inline-flex items-center gap-1.5 font-mono text-xs border border-blue-400 bg-white hover:bg-blue-50 text-blue-800 font-bold px-2.5 py-1 rounded-md shadow-xs transition cursor-pointer hover:border-blue-500"
                            title="Click to view full invoice bill"
                          >
                            <FileText className="w-3.5 h-3.5 text-blue-600" />
                            {meta.invoiceNo}
                            <ExternalLink className="w-3 h-3 text-blue-500" />
                          </button>
                          {sourceInvoice ? (
                            <span className="text-slate-700">
                              (Total: <strong className="text-slate-900 font-semibold">LKR {Number(sourceInvoice.total_amount || 0).toLocaleString()}</strong>
                              {" • "}Due: <strong className="text-red-600 font-semibold">LKR {Number(sourceInvoice.due_amount ?? sourceInvoice.total_amount).toLocaleString()}</strong>
                              {" • "}<span className="text-amber-800 font-medium">{sourceInvoice.status || "Unpaid"}</span>)
                            </span>
                          ) : (
                            <span className="text-blue-700 font-medium">
                              (Originating Bill: {meta.invoiceNo})
                            </span>
                          )}
                        </>
                      ) : (
                        <Badge variant="outline" className="text-xs border-slate-300 text-slate-700 bg-white">
                          Direct Return (No Invoice Selected)
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="text-left sm:text-right space-y-1">
                    <div className="text-xs text-muted-foreground">
                      Batch Note Ref:{" "}
                      <span className="font-mono font-medium text-foreground">
                        {meta.noteCode ? `#${meta.noteCode}` : returnRecord.return_number || `RET-${id.substring(0, 8)}`}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground flex items-center sm:justify-end gap-1">
                      Return Type:{" "}
                      {editReturnType === "Good" ? (
                        <Badge className="ml-1 text-[10px] h-5 bg-emerald-100 text-emerald-800 border-emerald-300 font-semibold">
                          Good Return
                        </Badge>
                      ) : editReturnType === "Exchange" ? (
                        <Badge className="ml-1 text-[10px] h-5 bg-blue-100 text-blue-800 border-blue-300 font-semibold">
                          Damage Exchange
                        </Badge>
                      ) : (
                        <Badge className="ml-1 text-[10px] h-5 bg-rose-100 text-rose-800 border-rose-300 font-semibold">
                          Damaged Stock
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                {/* Customer Box with Outstanding Balance Amount */}
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground font-semibold uppercase">
                    Customer
                  </Label>
                  <div className="p-3 border rounded-lg bg-muted/30 space-y-2">
                    <div className="flex items-start gap-2">
                      <User className="w-4 h-4 text-muted-foreground mt-0.5" />
                      <div>
                        <div className="font-semibold text-slate-900">
                          {returnRecord.customers?.shop_name || "Unknown Customer"}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {returnRecord.customers?.owner_name || returnRecord.customers?.route || "-"}
                        </div>
                        <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                          <Phone className="w-3 h-3" />
                          {returnRecord.customers?.phone || "N/A"}
                        </div>
                      </div>
                    </div>
                    <Separator className="opacity-50" />
                    {/* Customer Outstanding Amount */}
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-muted-foreground font-medium">Customer Balance:</span>
                      <span className="font-bold text-red-600">
                        LKR {Number(returnRecord.customers?.outstanding_balance || 0).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Sales Rep Box */}
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground font-semibold uppercase">
                    Sales Rep
                  </Label>
                  <div className="p-3 border rounded-lg bg-muted/30">
                    <div className="flex items-center gap-2">
                      <Briefcase className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <span className="font-medium text-slate-900 block">
                          {returnRecord.profiles?.full_name || "Sales Rep"}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          Role: {returnRecord.profiles?.role || "Field Sales Rep"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Billing / Return Date */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground font-semibold uppercase">Return Date</Label>
                <div className="text-sm font-medium">
                  {returnRecord.created_at
                    ? new Date(returnRecord.created_at).toLocaleDateString()
                    : "—"}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Return Items Card (Matching Order Items Table) */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Return Items</CardTitle>
                  <CardDescription className="text-xs mt-1">
                    {isEditing
                      ? "Modify quantities, rates, condition or customer remarks below"
                      : `${noteLines.length} item${noteLines.length !== 1 ? "s" : ""} in this return note`}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead className="text-center w-36 text-blue-900 font-semibold">Selected Invoice</TableHead>
                      <TableHead className="text-right w-24">Price</TableHead>
                      <TableHead className="text-center w-20">Qty</TableHead>
                      <TableHead className="text-center w-16 text-muted-foreground">Free</TableHead>
                      <TableHead className="text-center w-16 text-muted-foreground">Disc%</TableHead>
                      <TableHead className="text-right w-28">Total</TableHead>
                      <TableHead className="text-right w-36 text-orange-600">Condition</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {noteLines.map((line, idx) => {
                      const { item, isMain, meta: rowMeta } = line;
                      const rowEditing = isEditing && isMain;
                      const rowHasInvoice = rowMeta.invoiceNo && rowMeta.invoiceNo !== "-";
                      const canEditOther =
                        !isMain &&
                        !isEditing &&
                        (item.status === "Pending" ||
                          (item.status === "Approved" && !(item.reason || "").includes("[SETTLED_IN_PAYMENT:")));
                      return (
                        <TableRow key={item.id} className={rowEditing ? "bg-blue-50/40" : ""}>
                          <TableCell className="text-muted-foreground font-medium">{idx + 1}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2 font-medium text-sm">
                              {item.products?.name || "Return Product Item"}
                              <Badge
                                variant="outline"
                                className="text-[10px] bg-amber-50 text-amber-700 border-amber-200"
                              >
                                Return
                              </Badge>
                              {isMultiItem && item.status !== "Pending" && (
                                <Badge variant="outline" className="text-[10px]">
                                  {item.status}
                                </Badge>
                              )}
                              {canEditOther && (
                                <button
                                  type="button"
                                  onClick={() => router.push(otherItemPath(item.id))}
                                  className="text-blue-600 hover:text-blue-800"
                                  title="Edit this item"
                                >
                                  <Edit className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-xs text-muted-foreground font-mono">
                                {item.products?.sku || "SKU-0001"}
                              </span>
                              {isMultiItem && (
                                <span className="text-[10px] text-muted-foreground font-mono">
                                  {item.return_number}
                                </span>
                              )}
                            </div>
                            {/* Customer Remarks */}
                            {rowEditing ? (
                              <div className="mt-2">
                                <Input
                                  value={editRemarks}
                                  onChange={(e) => setEditRemarks(e.target.value)}
                                  placeholder="Customer remarks / defect reason..."
                                  className="text-xs h-8 bg-white max-w-sm"
                                />
                              </div>
                            ) : (
                              rowMeta.cleanReason && (
                                <div className="text-xs text-muted-foreground mt-1 italic">
                                  Remarks: {rowMeta.cleanReason}
                                </div>
                              )
                            )}
                          </TableCell>

                          {/* Selected Invoice Column (Clickable to view invoice bill) */}
                          <TableCell className="text-center">
                            {rowHasInvoice ? (
                              <div className="inline-flex flex-col items-center">
                                <button
                                  type="button"
                                  onClick={() => handleOpenInvoice(rowMeta.invoiceNo)}
                                  className="inline-flex items-center gap-1 font-mono text-xs border border-blue-300 bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold px-2 py-0.5 rounded shadow-2xs transition cursor-pointer hover:border-blue-400"
                                  title="Click to view original invoice bill"
                                >
                                  <FileText className="w-3 h-3 text-blue-600" />
                                  {rowMeta.invoiceNo}
                                  <ExternalLink className="w-2.5 h-2.5 text-blue-500" />
                                </button>
                                {isMain && sourceInvoice && (
                                  <span className="text-[10px] text-muted-foreground mt-0.5 whitespace-nowrap">
                                    LKR {Number(sourceInvoice.total_amount || 0).toLocaleString()}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground italic">
                                Direct Return
                              </span>
                            )}
                          </TableCell>

                          <TableCell className="text-right font-medium">
                            {rowEditing ? (
                              <Input
                                type="number"
                                min="0"
                                step="any"
                                value={editUnitPrice}
                                onChange={(e) => setEditUnitPrice(parseFloat(e.target.value) || 0)}
                                className="w-24 text-right h-8 ml-auto bg-white font-semibold"
                              />
                            ) : (
                              line.price.toLocaleString()
                            )}
                          </TableCell>

                          <TableCell className="text-center font-medium">
                            {rowEditing ? (
                              <Input
                                type="number"
                                min="1"
                                value={editQty}
                                onChange={(e) => setEditQty(Math.max(1, parseInt(e.target.value) || 1))}
                                className="w-16 text-center h-8 mx-auto bg-white font-semibold"
                              />
                            ) : (
                              line.qty
                            )}
                          </TableCell>

                          <TableCell className="text-center text-muted-foreground">-</TableCell>
                          <TableCell className="text-center text-muted-foreground">-</TableCell>

                          <TableCell className="text-right font-bold text-sm">
                            {line.total.toLocaleString()}
                          </TableCell>

                          <TableCell className="text-right">
                            {rowEditing ? (
                              <Select
                                value={editReturnType}
                                onValueChange={(val: any) => setEditReturnType(val)}
                              >
                                <SelectTrigger className="h-8 text-xs w-36 ml-auto bg-white font-medium">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="Good">Good Return</SelectItem>
                                  <SelectItem value="Damage">Damaged Stock</SelectItem>
                                  <SelectItem value="Exchange">Damage Exchange</SelectItem>
                                </SelectContent>
                              </Select>
                            ) : (
                              <span
                                className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border uppercase tracking-wider ${
                                  line.type === "Good"
                                    ? "bg-green-50 text-green-700 border-green-200"
                                    : line.type === "Exchange"
                                    ? "bg-blue-50 text-blue-700 border-blue-200"
                                    : "bg-red-50 text-red-700 border-red-200"
                                }`}
                              >
                                {line.type === "Good" ? "Good Return" : line.type === "Exchange" ? "Damage Exchange" : "Damaged Stock"}
                              </span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {isMultiItem && (
                      <TableRow className="bg-muted/40 font-semibold">
                        <TableCell colSpan={4} className="text-right text-sm">
                          Total
                        </TableCell>
                        <TableCell className="text-center">{noteUnits}</TableCell>
                        <TableCell colSpan={2} />
                        <TableCell className="text-right text-sm font-bold">
                          {noteTotal.toLocaleString()}
                        </TableCell>
                        <TableCell />
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* RIGHT COLUMN (1 Col) - Return Summary (Just the Amounts) */}
        <div className="lg:col-span-1 space-y-6 sticky top-6 self-start">
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">Return Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2.5">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total Items</span>
                  <span className="font-medium">{noteLines.length}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total Units</span>
                  <span className="font-medium">{noteUnits}</span>
                </div>
                <Separator />
                {!isMultiItem && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Unit Rate</span>
                    <span className="font-medium">
                      LKR {displayUnitPrice.toLocaleString()}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Gross Amount</span>
                  <span className="font-medium">
                    LKR {noteTotal.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-700 font-medium">Subtotal</span>
                  <span className="font-bold">
                    LKR {noteTotal.toLocaleString()}
                  </span>
                </div>

                <Separator className="border-t-2" />
                <div className="flex justify-between items-center pt-1">
                  <span className="font-bold text-lg">Grand Total</span>
                  <span className="font-bold text-2xl text-blue-600">
                    LKR {noteTotal.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between text-xs text-muted-foreground pt-1">
                  <span>Settlement Action</span>
                  <span className="font-semibold text-slate-800">
                    {editReturnType === "Exchange"
                      ? "Direct Replacement Order"
                      : editReturnType === "Good"
                      ? "Customer Return Credit"
                      : "Damage Quarantine Credit"}
                  </span>
                </div>
              </div>

              {/* Warehouse & Inventory Allocation */}
              <div className="mt-4 pt-4 border-t space-y-2.5">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Stock & Allocation
                </p>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Target Warehouse</span>
                  <span className="font-medium text-slate-800">
                    {returnRecord.locations?.name || "Main Warehouse"}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Return Condition</span>
                  <span className={`font-bold ${editReturnType === "Good" ? "text-green-700" : editReturnType === "Exchange" ? "text-blue-700" : "text-amber-700"}`}>
                    {editReturnType === "Good" ? "Good Sellable Stock" : editReturnType === "Exchange" ? "Damage Exchange" : "Damaged / Quarantine"}
                  </span>
                </div>
              </div>

              {!isEditing && (
                <Button
                  className="w-full mt-4"
                  variant="outline"
                  onClick={() => router.push(pendingListPath())}
                >
                  Back to Orders
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── INVOICE VIEWER SHEET DRAWER ── */}
      <Sheet open={showInvoiceSheet} onOpenChange={setShowInvoiceSheet}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto p-6">
          <SheetHeader className="border-b pb-4">
            <div className="flex items-center justify-between">
              <div>
                <SheetTitle className="text-xl font-bold flex items-center gap-2 text-blue-950 font-mono">
                  <FileText className="w-5 h-5 text-blue-600" />
                  Invoice #{fullInvoiceDetails?.invoiceNo || fullInvoiceDetails?.invoice_no || meta.invoiceNo}
                </SheetTitle>
                <p className="text-xs text-muted-foreground mt-1">
                  Original customer invoice bill associated with this return note.
                </p>
              </div>
              {fullInvoiceDetails && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    window.open(
                      `/dashboard/office/distribution/invoices/${fullInvoiceDetails.id || sourceInvoice?.id}`,
                      "_blank"
                    )
                  }
                  className="text-xs h-8"
                >
                  <ExternalLink className="w-3.5 h-3.5 mr-1 text-blue-600" />
                  Open Full Bill
                </Button>
              )}
            </div>
          </SheetHeader>

          {loadingInvoice ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-2" />
              <p className="text-xs">Loading invoice bill details...</p>
            </div>
          ) : fullInvoiceDetails ? (
            <div className="space-y-5 pt-4">
              {/* Invoice Meta */}
              <div className="bg-slate-50 p-4 rounded-lg border space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground uppercase font-semibold">Invoice No</span>
                  <span className="font-mono font-bold text-sm text-slate-900">
                    {fullInvoiceDetails.invoiceNo || fullInvoiceDetails.invoice_no}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground uppercase font-semibold">Invoice Date</span>
                  <span className="text-sm font-medium">
                    {new Date(fullInvoiceDetails.date || fullInvoiceDetails.created_at).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground uppercase font-semibold">Payment Status</span>
                  <Badge
                    className={
                      fullInvoiceDetails.status === "Paid"
                        ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                        : "bg-rose-100 text-rose-800 border-rose-300"
                    }
                  >
                    {fullInvoiceDetails.status}
                  </Badge>
                </div>
              </div>

              {/* Customer & Rep */}
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Bill To</h4>
                <div className="p-3 border rounded-lg bg-slate-50/50">
                  <p className="font-semibold text-sm text-slate-900">
                    {fullInvoiceDetails.customerName || fullInvoiceDetails.customers?.shop_name || "Customer"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Sales Rep: {fullInvoiceDetails.salesRepName || fullInvoiceDetails.sales_rep_name || fullInvoiceDetails.profiles?.full_name || "-"}
                  </p>
                </div>
              </div>

              {/* Invoice Items Table */}
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Invoiced Items</h4>
                <div className="border rounded-md overflow-hidden">
                  <Table>
                    <TableHeader className="bg-slate-50">
                      <TableRow>
                        <TableHead className="text-xs font-semibold">Item</TableHead>
                        <TableHead className="text-center text-xs font-semibold">Qty</TableHead>
                        <TableHead className="text-right text-xs font-semibold">Unit Price</TableHead>
                        <TableHead className="text-right text-xs font-semibold">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(fullInvoiceDetails.items || []).map((item: any, idx: number) => {
                        const isReturnedItem = noteItems.some(
                          (ri) => ri.products?.id === item.productId || ri.products?.sku === item.sku
                        );
                        return (
                          <TableRow key={item.id || idx} className={isReturnedItem ? "bg-amber-50/60" : ""}>
                            <TableCell className="py-2.5">
                              <div className="flex items-center gap-1.5">
                                <p className="text-xs font-medium leading-none text-slate-900">
                                  {item.productName || item.name || item.sku}
                                </p>
                                {isReturnedItem && (
                                  <Badge variant="outline" className="text-[9px] h-4 bg-amber-100 text-amber-800 border-amber-300 font-semibold">
                                    Returned
                                  </Badge>
                                )}
                              </div>
                              <p className="text-[10px] text-muted-foreground font-mono mt-0.5">{item.sku}</p>
                            </TableCell>
                            <TableCell className="text-center py-2.5 text-xs font-medium">
                              {item.quantity || item.qty}
                              {(item.freeQuantity || item.free) > 0 && (
                                <span className="text-[10px] text-emerald-600 block">
                                  +{item.freeQuantity || item.free} free
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="text-right py-2.5 font-mono text-xs">
                              LKR {Number(item.unitPrice || item.price || 0).toLocaleString()}
                            </TableCell>
                            <TableCell className="text-right py-2.5 font-mono text-xs font-semibold">
                              LKR {Number(item.total || 0).toLocaleString()}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* Financial Summary */}
              <div className="border-t pt-4 space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-medium font-mono">
                    LKR {Number(fullInvoiceDetails.totalAmount ?? fullInvoiceDetails.total_amount ?? 0).toLocaleString()}
                  </span>
                </div>
                {(fullInvoiceDetails.extraDiscountAmount || 0) > 0 && (
                  <div className="flex justify-between text-xs text-rose-600">
                    <span>Extra Discount</span>
                    <span className="font-medium font-mono">
                      -LKR {Number(fullInvoiceDetails.extraDiscountAmount).toLocaleString()}
                    </span>
                  </div>
                )}
                <div className="flex justify-between items-center pt-2 border-t border-dashed">
                  <span className="font-bold text-sm">Grand Total</span>
                  <span className="font-bold font-mono text-lg text-blue-600">
                    LKR {Number(fullInvoiceDetails.totalAmount ?? fullInvoiceDetails.total_amount ?? 0).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Paid Amount</span>
                  <span className="font-medium font-mono text-emerald-600">
                    LKR {Number(fullInvoiceDetails.paidAmount ?? fullInvoiceDetails.paid_amount ?? 0).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between text-xs pt-1 border-t">
                  <span className="font-semibold text-slate-700">Due Amount</span>
                  <span className="font-bold font-mono text-rose-600">
                    LKR {Number(fullInvoiceDetails.dueAmount ?? fullInvoiceDetails.due_amount ?? 0).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-10 text-muted-foreground text-sm">
              Invoice details could not be loaded.
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* ── APPROVE CONFIRMATION DIALOG ── */}
      <Dialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-700">
              <CheckCircle2 className="h-5 w-5" />
              Approve Return Note
            </DialogTitle>
            <DialogDescription>
              Confirm acceptance of this return note into inventory and finance.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2 text-sm">
            <div className="p-3 rounded-lg border bg-slate-50 space-y-1.5">
              {isMultiItem ? (
                <div className="space-y-1">
                  {noteLines
                    .filter((l) => l.item.status === "Pending")
                    .map((l) => (
                      <div key={l.item.id} className="flex justify-between gap-2 text-xs">
                        <span className="truncate">{l.item.products?.name}</span>
                        <span className="font-semibold whitespace-nowrap">
                          {l.qty} × LKR {l.price.toLocaleString()}
                        </span>
                      </div>
                    ))}
                </div>
              ) : (
                <>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Product:</span>
                    <span className="font-semibold">{returnRecord.products?.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Quantity & Rate:</span>
                    <span className="font-semibold">
                      {displayQty} Pcs × LKR {displayUnitPrice.toLocaleString()}
                    </span>
                  </div>
                </>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Return Value:</span>
                <span className="font-bold text-blue-600">
                  LKR {noteLines
                    .filter((l) => l.item.status === "Pending")
                    .reduce((s, l) => s + l.total, 0)
                    .toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Return Condition:</span>
                <Badge variant="outline" className="text-xs">
                  {editReturnType === "Good" ? "Good Return" : editReturnType === "Exchange" ? "Damage Exchange" : "Damaged Stock"}
                </Badge>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              {editReturnType === "Exchange"
                ? "This will generate an exchange replacement order routed directly to Checking & Loading."
                : "This will add items back to warehouse stock and create customer return credit for invoice payments."}
            </p>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setShowApproveDialog(false)}
              disabled={actionProcessing}
            >
              Cancel
            </Button>
            <Button
              onClick={handleApprove}
              disabled={actionProcessing}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {actionProcessing ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
              ) : (
                <CheckCircle2 className="h-4 w-4 mr-1.5" />
              )}
              Confirm Approval
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── REJECT DIALOG ── */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-600">
              <XCircle className="h-5 w-5" />
              Reject Return Note
            </DialogTitle>
            <DialogDescription>
              Please provide a reason for rejecting this return note.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Input
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="e.g. Expired return period, serial mismatch, physical damage not covered"
              className="w-full"
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setShowRejectDialog(false)}
              disabled={actionProcessing}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={actionProcessing || !rejectionReason.trim()}
            >
              {actionProcessing ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
              ) : (
                <XCircle className="h-4 w-4 mr-1.5" />
              )}
              Confirm Rejection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
