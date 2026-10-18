"use client";

import React, { useState } from "react";
import {
  AlertTriangle,
  Lock,
  Clock,
  ShieldCheck,
  KeyRound,
  Loader2,
  Calendar,
  AlertCircle,
  FileText,
  CheckCircle2,
  Eye,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { CustomerOverdueStatusResult, CustomerUnlockType, OverdueInvoiceDetail } from "@/lib/customer-overdue";

interface InvoiceDetailModalData {
  id: string;
  invoiceNo: string;
  manualInvoiceNo?: string;
  date: string;
  dueDate?: string | null;
  grandTotal: number;
  paidAmount: number;
  dueAmount?: number;
  salesRep?: string;
  paymentMethod?: string;
  customer?: {
    shop?: string;
    name?: string;
    phone?: string;
    address?: string;
  };
  items?: Array<{
    id: string;
    productName: string;
    sku: string;
    unit?: string;
    quantity: number;
    freeQuantity?: number;
    unitPrice: number;
    discountPercent?: number;
    total: number;
  }>;
  payments?: Array<{
    id: string;
    amount: number;
    payment_date: string;
    method: string;
    cheque_no?: string;
  }>;
}

interface CustomerOverdueAlertProps {
  status: CustomerOverdueStatusResult | null;
  loading?: boolean;
  onStatusUpdated?: () => void;
  currentUser?: {
    id?: string;
    name?: string;
    email?: string;
    role?: string;
  } | null;
}

const fmt = (n: number) =>
  n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export function CustomerOverdueAlert({
  status,
  loading,
  onStatusUpdated,
  currentUser,
}: CustomerOverdueAlertProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [unlockType, setUnlockType] = useState<CustomerUnlockType>("one_time");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Invoice Quick View Modal State
  const [viewInvoiceModalOpen, setViewInvoiceModalOpen] = useState(false);
  const [selectedOverdueInv, setSelectedOverdueInv] = useState<OverdueInvoiceDetail | null>(null);
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [invoiceData, setInvoiceData] = useState<InvoiceDetailModalData | null>(null);

  const handleOpenInvoiceView = async (inv: OverdueInvoiceDetail) => {
    setSelectedOverdueInv(inv);
    setViewInvoiceModalOpen(true);
    setInvoiceLoading(true);
    setInvoiceData(null);
    try {
      const res = await fetch(`/api/invoices/${inv.id}`);
      if (res.ok) {
        const data = await res.json();
        setInvoiceData(data);
      } else {
        toast.error("Could not fetch full invoice details");
      }
    } catch (err) {
      console.error("Error fetching invoice preview:", err);
      toast.error("Error loading invoice preview");
    } finally {
      setInvoiceLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-3 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-600 animate-pulse">
        <Loader2 className="h-4 w-4 animate-spin text-slate-500" />
        Checking customer overdue standing & credit rules...
      </div>
    );
  }

  if (!status) return null;

  // Case 1: Active Approved Unlock
  if (status.activeUnlock) {
    const unlockLabel =
      status.activeUnlock.unlockType === "one_time"
        ? "One-Time Invoice Creation"
        : status.activeUnlock.unlockType === "7_days"
        ? "7 Days Temporary Grace Period"
        : "14 Days Temporary Grace Period";

    const formattedExpiry = status.activeUnlock.expiresAt
      ? new Date(status.activeUnlock.expiresAt).toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "Active";

    return (
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-900 shadow-sm">
        <div className="flex items-start gap-2.5">
          <ShieldCheck className="h-5 w-5 mt-0.5 text-emerald-600 shrink-0" />
          <div className="space-y-0.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-sm">
                Admin Temporary Invoicing Unlock Active
              </span>
              <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-normal border-none">
                {unlockLabel}
              </Badge>
            </div>
            <p className="text-xs text-emerald-800">
              Approved by <strong>{status.activeUnlock.approvedByName}</strong> · Valid until:{" "}
              <strong>{formattedExpiry}</strong>. Invoicing is authorized.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Case 2: Customer has 60+ days overdue bills and is BLOCKED
  if (status.hasOverdue && status.isBlocked) {
    const handleRequestSubmit = async () => {
      if (!reason.trim()) {
        toast.error("Please enter a reason for the unlock request");
        return;
      }

      setSubmitting(true);
      try {
        let requesterName = currentUser?.name || "User";
        let requesterEmail = currentUser?.email || "";
        let requesterRole = currentUser?.role || "rep";
        let requesterId = currentUser?.id || "";

        if (typeof window !== "undefined" && !currentUser?.name) {
          const stored = localStorage.getItem("currentUser");
          if (stored) {
            try {
              const u = JSON.parse(stored);
              requesterName = u.fullName || u.name || requesterName;
              requesterEmail = u.email || requesterEmail;
              requesterRole = u.role || requesterRole;
              requesterId = u.id || requesterId;
            } catch {}
          }
        }

        const res = await fetch("/api/customer-unlock-requests", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            customerId: status.customerId,
            customerName: status.customerName,
            requestedBy: requesterId,
            requestedByName: requesterName,
            requestedByEmail: requesterEmail,
            requestedByRole: requesterRole,
            unlockType,
            reason: reason.trim(),
            overdueDetails: {
              totalOverdueAmount: status.totalOverdueAmount,
              oldestDaysOverdue: status.oldestDaysOverdue,
              invoices: status.overdueInvoices,
            },
          }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to submit unlock request");

        toast.success("Unlock request submitted to Admin successfully!");
        setDialogOpen(false);
        setReason("");
        if (onStatusUpdated) onStatusUpdated();
      } catch (err: any) {
        toast.error(err.message || "Failed to submit request");
      } finally {
        setSubmitting(false);
      }
    };

    return (
      <>
        <div className="flex flex-col gap-3 p-4 bg-gradient-to-r from-red-50 to-orange-50 border-2 border-red-400 rounded-xl text-red-950 shadow-sm animate-in fade-in duration-200">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="flex items-start gap-2.5">
              <div className="p-1.5 bg-red-100 text-red-700 rounded-lg shrink-0 mt-0.5">
                <Lock className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-sm tracking-tight text-red-900">
                    INVOICING BLOCKED: Overdue Bills (60d Orange/Sierra | 90d Others)
                  </span>
                  <Badge className="bg-red-600 hover:bg-red-700 text-white font-mono text-xs border-none">
                    LKR {fmt(status.totalOverdueAmount)} Due
                  </Badge>
                  <Badge variant="outline" className="border-red-300 text-red-800 text-[11px] bg-red-100/50">
                    {status.oldestDaysOverdue}+ Days Oldest
                  </Badge>
                </div>
                <p className="text-xs text-red-900/90 leading-relaxed max-w-2xl">
                  This customer has <strong>{status.overdueInvoices.length}</strong> invoice(s) exceeding credit rules (60+ days for Orange & Sierra items, 90+ days for other suppliers). Invoicing and updates are blocked until overdue bills are settled or Admin approves an unlock.
                </p>
              </div>
            </div>

            {/* Action / Status Button */}
            <div className="ml-auto flex items-center gap-2">
              {status.pendingRequest ? (
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-100 border border-amber-300 text-amber-900 rounded-lg text-xs font-medium">
                  <Clock className="h-3.5 w-3.5 text-amber-700 animate-spin" style={{ animationDuration: "3s" }} />
                  <span>Pending Admin Approval ({status.pendingRequest.unlockType.replace("_", " ")})</span>
                </div>
              ) : (
                <Button
                  size="sm"
                  onClick={() => setDialogOpen(true)}
                  className="bg-red-600 hover:bg-red-700 text-white text-xs font-semibold shadow-sm flex items-center gap-1.5 h-8 px-3"
                >
                  <KeyRound className="h-3.5 w-3.5" />
                  Request Admin Unlock
                </Button>
              )}
            </div>
          </div>

          {/* List of Overdue Invoices */}
          {status.overdueInvoices.length > 0 && (
            <div className="mt-1 pt-2.5 border-t border-red-200/80">
              <span className="text-[11px] font-semibold text-red-800 block mb-1.5">
                Overdue Invoices Requiring Settlement:
              </span>
              <div className="flex flex-wrap gap-2">
                {status.overdueInvoices.map((inv) => (
                  <div
                    key={inv.id}
                    className="flex items-center gap-2 px-2.5 py-1.5 bg-white border border-red-200 hover:border-red-300 rounded-lg text-xs font-medium text-slate-800 shadow-xs transition-all group"
                  >
                    <FileText className="h-3.5 w-3.5 text-red-500 shrink-0" />
                    <span className="font-mono text-red-900 font-semibold">{inv.invoiceNo}</span>
                    <span className="text-[11px] text-muted-foreground font-normal">
                      ({inv.invoiceDate})
                    </span>
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-red-100 text-red-800 border-none font-bold">
                      {inv.daysOverdue}d overdue
                    </Badge>
                    {inv.hasOrangeOrSierra ? (
                      <Badge className="text-[10px] px-1.5 py-0 bg-amber-100 text-amber-900 border-amber-300 font-medium">
                        Orange/Sierra (60d)
                      </Badge>
                    ) : (
                      <Badge className="text-[10px] px-1.5 py-0 bg-slate-100 text-slate-800 border-slate-300 font-medium">
                        Other (90d)
                      </Badge>
                    )}
                    {inv.supplierNames && inv.supplierNames.length > 0 && (
                      <span className="text-[10px] text-slate-500 max-w-[130px] truncate" title={inv.supplierNames.join(", ")}>
                        {inv.supplierNames.join(", ")}
                      </span>
                    )}
                    <span className="font-mono text-xs font-bold text-slate-900">
                      LKR {fmt(inv.dueAmount)}
                    </span>

                    {/* View Button */}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleOpenInvoiceView(inv)}
                      className="h-6 px-2 text-[11px] font-semibold text-blue-700 hover:text-blue-900 hover:bg-blue-100/70 ml-1 rounded flex items-center gap-1 border border-blue-200 bg-blue-50/60"
                      title="View invoice details"
                    >
                      <Eye className="h-3 w-3 text-blue-600" />
                      View
                    </Button>

                    {/* Open in new tab link */}
                    <a
                      href={`/invoice/${inv.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Open full printable invoice in new tab"
                      className="text-muted-foreground hover:text-blue-600 p-1 rounded hover:bg-slate-100 transition-colors inline-flex items-center"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Unlock Request Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-red-900">
                <KeyRound className="h-5 w-5 text-red-600" />
                Request Admin Invoicing Unlock
              </DialogTitle>
              <DialogDescription className="text-xs">
                Request temporary authorization from Admin to create invoice(s) for{" "}
                <strong>{status.customerName}</strong> despite overdue balance.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              {/* Overdue Summary Card */}
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs space-y-1.5">
                <div className="flex justify-between items-center text-red-900 font-semibold">
                  <span>Customer Shop:</span>
                  <span>{status.customerName}</span>
                </div>
                <div className="flex justify-between items-center text-red-900 font-semibold">
                  <span>Total 60+ Days Overdue:</span>
                  <span className="font-mono text-sm text-red-700">LKR {fmt(status.totalOverdueAmount)}</span>
                </div>
                <div className="flex justify-between items-center text-slate-700">
                  <span>Overdue Bills Count:</span>
                  <span>{status.overdueInvoices.length} bill(s) (Oldest: {status.oldestDaysOverdue} days)</span>
                </div>
              </div>

              {/* Unlock Type Selection */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold">Select Requested Authorization</Label>
                <Select
                  value={unlockType}
                  onValueChange={(v) => setUnlockType(v as CustomerUnlockType)}
                >
                  <SelectTrigger className="w-full text-xs">
                    <SelectValue placeholder="Select unlock type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="one_time">
                      <div className="flex flex-col text-left py-0.5">
                        <span className="font-medium text-xs">One-Time Invoice Creation</span>
                        <span className="text-[10px] text-muted-foreground">
                          Allows creating exactly 1 invoice; automatically expires once saved
                        </span>
                      </div>
                    </SelectItem>
                    <SelectItem value="7_days">
                      <div className="flex flex-col text-left py-0.5">
                        <span className="font-medium text-xs">7 Days Temporary Unlock</span>
                        <span className="text-[10px] text-muted-foreground">
                          Grace period for sales & deliveries valid for 7 days
                        </span>
                      </div>
                    </SelectItem>
                    <SelectItem value="14_days">
                      <div className="flex flex-col text-left py-0.5">
                        <span className="font-medium text-xs">14 Days Temporary Unlock</span>
                        <span className="text-[10px] text-muted-foreground">
                          Extended grace period valid for 14 days
                        </span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Reason Input */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold flex items-center justify-between">
                  <span>Reason for Request</span>
                  <span className="text-[10px] text-muted-foreground">Required</span>
                </Label>
                <Textarea
                  placeholder="Explain why this customer should be unlocked (e.g. customer promised payment by cheque tomorrow, urgent delivery requested, etc.)"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="text-xs min-h-[90px]"
                />
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDialogOpen(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleRequestSubmit}
                disabled={submitting || !reason.trim()}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  "Submit to Admin"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Invoice Quick View Dialog */}
        <Dialog open={viewInvoiceModalOpen} onOpenChange={setViewInvoiceModalOpen}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader className="border-b pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-red-600" />
                  <DialogTitle className="text-base sm:text-lg font-bold text-slate-900 font-mono">
                    {selectedOverdueInv?.invoiceNo || "Invoice Details"}
                  </DialogTitle>
                  <Badge variant="secondary" className="bg-red-100 text-red-800 border-none font-bold text-xs">
                    {selectedOverdueInv?.daysOverdue} Days Overdue
                  </Badge>
                  {selectedOverdueInv?.hasOrangeOrSierra ? (
                    <Badge className="bg-amber-100 text-amber-900 border-amber-300 font-medium text-xs">
                      Orange/Sierra (60d rule)
                    </Badge>
                  ) : (
                    <Badge className="bg-slate-100 text-slate-800 border-slate-300 font-medium text-xs">
                      Other Suppliers (90d rule)
                    </Badge>
                  )}
                </div>
              </div>
              <DialogDescription className="text-xs text-muted-foreground">
                Detailed statement for {status.customerName}
              </DialogDescription>
            </DialogHeader>

            {invoiceLoading ? (
              <div className="flex flex-col items-center justify-center py-12 space-y-2">
                <Loader2 className="h-7 w-7 animate-spin text-red-600" />
                <span className="text-xs text-slate-500">Loading invoice details...</span>
              </div>
            ) : invoiceData ? (
              <div className="space-y-4 py-2 text-xs">
                {/* Key metadata grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 bg-slate-50 border rounded-lg">
                  <div>
                    <span className="text-muted-foreground block text-[10px] uppercase font-semibold">Invoice Date</span>
                    <span className="font-medium text-slate-900">{invoiceData.date}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[10px] uppercase font-semibold">Due Date</span>
                    <span className="font-medium text-slate-900">{invoiceData.dueDate || selectedOverdueInv?.dueDate || "N/A"}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[10px] uppercase font-semibold">Sales Rep</span>
                    <span className="font-medium text-slate-900 truncate block">{invoiceData.salesRep || "N/A"}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[10px] uppercase font-semibold">Payment Terms</span>
                    <span className="font-medium text-slate-900">{invoiceData.paymentMethod || "Standard"}</span>
                  </div>
                  {selectedOverdueInv?.supplierNames && selectedOverdueInv.supplierNames.length > 0 && (
                    <div className="col-span-2 sm:col-span-4 pt-1.5 border-t border-slate-200/70 flex items-center gap-1.5 text-[11px]">
                      <span className="text-muted-foreground font-semibold">Suppliers:</span>
                      <span className="font-medium text-slate-800">{selectedOverdueInv.supplierNames.join(", ")}</span>
                    </div>
                  )}
                </div>

                {/* Financial Summary */}
                <div className="grid grid-cols-3 gap-2 p-3 bg-red-50/60 border border-red-200 rounded-lg">
                  <div>
                    <span className="text-slate-600 block text-[10px] uppercase font-semibold">Invoice Total</span>
                    <span className="font-bold text-slate-900 text-sm font-mono">
                      LKR {fmt(invoiceData.grandTotal)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-600 block text-[10px] uppercase font-semibold">Paid Amount</span>
                    <span className="font-bold text-emerald-700 text-sm font-mono">
                      LKR {fmt(invoiceData.paidAmount || 0)}
                    </span>
                  </div>
                  <div>
                    <span className="text-red-700 block text-[10px] uppercase font-semibold">Remaining Overdue</span>
                    <span className="font-bold text-red-700 text-sm font-mono">
                      LKR {fmt(selectedOverdueInv?.dueAmount ?? Math.max(0, invoiceData.grandTotal - (invoiceData.paidAmount || 0)))}
                    </span>
                  </div>
                </div>

                {/* Items Table */}
                <div className="space-y-1.5">
                  <h4 className="font-semibold text-slate-900 text-xs flex items-center justify-between">
                    <span>Invoiced Items ({invoiceData.items?.length || 0})</span>
                  </h4>
                  <div className="border rounded-md overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100/80 text-slate-700 font-semibold border-b">
                        <tr>
                          <th className="py-1.5 px-2.5">Item</th>
                          <th className="py-1.5 px-2 text-center">Qty</th>
                          <th className="py-1.5 px-2 text-right">Unit Price</th>
                          <th className="py-1.5 px-2 text-center">Disc%</th>
                          <th className="py-1.5 px-2.5 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {invoiceData.items && invoiceData.items.length > 0 ? (
                          invoiceData.items.map((it, idx) => (
                            <tr key={it.id || idx} className="hover:bg-slate-50/50">
                              <td className="py-1.5 px-2.5">
                                <span className="font-medium text-slate-900 block">{it.productName}</span>
                                <span className="text-[10px] text-muted-foreground font-mono">{it.sku}</span>
                              </td>
                              <td className="py-1.5 px-2 text-center font-medium">
                                {it.quantity} {it.unit || ""}
                                {it.freeQuantity ? (
                                  <span className="text-[10px] text-emerald-600 block">+{it.freeQuantity} free</span>
                                ) : null}
                              </td>
                              <td className="py-1.5 px-2 text-right font-mono">
                                LKR {fmt(it.unitPrice)}
                              </td>
                              <td className="py-1.5 px-2 text-center text-muted-foreground">
                                {it.discountPercent ? `${it.discountPercent}%` : "-"}
                              </td>
                              <td className="py-1.5 px-2.5 text-right font-bold text-slate-900 font-mono">
                                LKR {fmt(it.total)}
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={5} className="py-4 text-center text-muted-foreground">
                              No items recorded for this invoice.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Payments made */}
                {invoiceData.payments && invoiceData.payments.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    <h4 className="font-semibold text-slate-900 text-xs">Payment History</h4>
                    <div className="border rounded-md overflow-hidden">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-emerald-50 text-emerald-900 font-semibold border-b">
                          <tr>
                            <th className="py-1.5 px-2.5">Date</th>
                            <th className="py-1.5 px-2">Method</th>
                            <th className="py-1.5 px-2.5 text-right">Amount</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {invoiceData.payments.map((p) => (
                            <tr key={p.id} className="hover:bg-slate-50/50">
                              <td className="py-1.5 px-2.5 text-muted-foreground">{p.payment_date}</td>
                              <td className="py-1.5 px-2">
                                {p.method} {p.cheque_no ? `(#${p.cheque_no})` : ""}
                              </td>
                              <td className="py-1.5 px-2.5 text-right font-bold text-emerald-700 font-mono">
                                LKR {fmt(p.amount)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* Fallback if fetch failed */
              <div className="p-4 bg-slate-50 border rounded-lg text-xs space-y-2">
                <p className="font-semibold text-slate-900">
                  Invoice: {selectedOverdueInv?.invoiceNo}
                </p>
                <p className="text-muted-foreground">
                  Date: {selectedOverdueInv?.invoiceDate} · Overdue: {selectedOverdueInv?.daysOverdue} days
                </p>
                <p className="font-bold text-red-700 text-sm">
                  Remaining Overdue Amount: LKR {fmt(selectedOverdueInv?.dueAmount || 0)}
                </p>
              </div>
            )}

            <DialogFooter className="border-t pt-3 flex items-center justify-between sm:justify-between w-full">
              {selectedOverdueInv && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  asChild
                  className="gap-1.5 text-xs text-blue-700 border-blue-200 hover:bg-blue-50"
                >
                  <a
                    href={`/invoice/${selectedOverdueInv.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Open Full Printable Page
                  </a>
                </Button>
              )}
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setViewInvoiceModalOpen(false)}
              >
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  // Case 3: Manually blocked without 60+ days overdue
  if (status.isBlocked && !status.hasOverdue) {
    return (
      <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-300 rounded-xl text-red-900 text-xs">
        <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
        <span>
          <strong>Customer Account Blocked:</strong> {status.blockReason || "Customer is blocked by administration. Invoicing is restricted."}
        </span>
      </div>
    );
  }

  return null;
}
