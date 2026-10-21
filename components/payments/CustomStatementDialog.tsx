"use client";

import React, { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  SlidersHorizontal,
  Download,
  Printer,
  Share2,
  FileText,
  Package,
  CreditCard,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Sparkles,
} from "lucide-react";
import {
  StatementInvoice,
  StatementReportOptions,
  downloadCustomerStatement,
  printCustomerStatement,
  shareCustomerStatement,
  filterStatementInvoices,
  DEFAULT_STATEMENT_OPTIONS,
} from "@/lib/customer-statement-report";

interface CustomStatementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerName: string;
  invoices: StatementInvoice[];
  companyName?: string;
  themeColor?: string; // e.g. "purple" | "orange" | "blue" | "red" | "emerald"
}

export function CustomStatementDialog({
  open,
  onOpenChange,
  customerName,
  invoices,
  companyName = "CHAMPIKA SIERRA",
  themeColor = "purple",
}: CustomStatementDialogProps) {
  // Option States (Default Outstanding: Invoices, Sub-rows, Goods, and Return Cheques only; Pending & Cleared Cheques unchecked)
  const [includeInvoices, setIncludeInvoices] = useState(DEFAULT_STATEMENT_OPTIONS.includeInvoices !== false);
  const [includePaymentSubRows, setIncludePaymentSubRows] = useState(DEFAULT_STATEMENT_OPTIONS.includePaymentSubRows !== false);
  const [includeGoodsSoldToCustomer, setIncludeGoodsSoldToCustomer] = useState(DEFAULT_STATEMENT_OPTIONS.includeGoodsSoldToCustomer !== false);
  const [includeOtherGoodsStock, setIncludeOtherGoodsStock] = useState(DEFAULT_STATEMENT_OPTIONS.includeOtherGoodsStock !== false);
  const [includePendingCheques, setIncludePendingCheques] = useState(Boolean(DEFAULT_STATEMENT_OPTIONS.includePendingCheques));
  const [includeReturnedCheques, setIncludeReturnedCheques] = useState(DEFAULT_STATEMENT_OPTIONS.includeReturnedCheques !== false);
  const [includeClearedCheques, setIncludeClearedCheques] = useState(Boolean(DEFAULT_STATEMENT_OPTIONS.includeClearedCheques));
  const [customTitle, setCustomTitle] = useState("");
  const [customNote, setCustomNote] = useState("");

  // Reset to default outstanding whenever dialog opens
  React.useEffect(() => {
    if (open) {
      applyPreset("outstanding");
      setCustomTitle("");
      setCustomNote("");
    }
  }, [open]);

  // Analyze Customer Data for Badge Counts & Summaries
  const stats = useMemo(() => {
    const activeInvoices = filterStatementInvoices(invoices);
    const totalDue = activeInvoices.reduce((sum, inv) => sum + inv.balance, 0);

    let subRowCount = 0;
    let goodsSoldCount = 0;
    let goodsOtherCount = 0;
    const chequeStatusCounts = {
      pending: 0,
      returned: 0,
      cleared: 0,
    };
    const seenCheques = new Set<string>();

    // Scan all customer invoices for cheques and goods exchange items:
    invoices.forEach((inv) => {
      (inv.payments || []).forEach((p) => {
        const isCheque = p.method?.toLowerCase() === "cheque";
        if (isCheque) {
          const rawNo = (p.chequeNo || "").trim().toLowerCase();
          const key = rawNo || `p_${p.id || Math.random()}`;
          if (!seenCheques.has(key)) {
            seenCheques.add(key);
            const status = (p.chequeStatus || "Pending").toUpperCase();
            if (["RETURNED", "BOUNCED"].includes(status)) {
              chequeStatusCounts.returned++;
            } else if (status === "CLEARED") {
              chequeStatusCounts.cleared++;
            } else {
              chequeStatusCounts.pending++;
            }
          }
        } else {
          const summary = (p.goodsSummary || p.notes || "").toLowerCase();
          if (p.method?.toLowerCase() === "goods" || summary.includes("goods") || summary.includes("exchange")) {
            if (summary.includes("soldtocust") || summary.includes("customerbilled")) {
              goodsSoldCount++;
            } else {
              goodsOtherCount++;
            }
          }
        }
      });
    });

    // Sub-rows belong only under active outstanding invoices:
    activeInvoices.forEach((inv) => {
      (inv.payments || []).forEach((p) => {
        const isCheque = p.method?.toLowerCase() === "cheque";
        if (!isCheque) {
          subRowCount++;
        }
      });
    });

    return {
      activeCount: activeInvoices.length,
      totalDue,
      subRowCount,
      goodsSoldCount,
      goodsOtherCount,
      cheques: chequeStatusCounts,
    };
  }, [invoices]);

  const currentOptions: StatementReportOptions = {
    includeInvoices,
    includePaymentSubRows,
    includeGoodsSoldToCustomer,
    includeOtherGoodsStock,
    includePendingCheques,
    includeReturnedCheques,
    includeClearedCheques,
    customTitle: customTitle.trim() || undefined,
    customNote: customNote.trim() || undefined,
  };

  // Quick Preset Actions
  const applyPreset = (preset: "all" | "outstanding" | "invoicesOnly" | "chequesOnly") => {
    if (preset === "all") {
      setIncludeInvoices(true);
      setIncludePaymentSubRows(true);
      setIncludeGoodsSoldToCustomer(true);
      setIncludeOtherGoodsStock(true);
      setIncludePendingCheques(true);
      setIncludeReturnedCheques(true);
      setIncludeClearedCheques(true);
    } else if (preset === "outstanding") {
      setIncludeInvoices(true);
      setIncludePaymentSubRows(true);
      setIncludeGoodsSoldToCustomer(true);
      setIncludeOtherGoodsStock(true);
      setIncludePendingCheques(false);
      setIncludeReturnedCheques(true);
      setIncludeClearedCheques(false);
    } else if (preset === "invoicesOnly") {
      setIncludeInvoices(true);
      setIncludePaymentSubRows(false);
      setIncludeGoodsSoldToCustomer(false);
      setIncludeOtherGoodsStock(false);
      setIncludePendingCheques(false);
      setIncludeReturnedCheques(false);
      setIncludeClearedCheques(false);
    } else if (preset === "chequesOnly") {
      setIncludeInvoices(false);
      setIncludePaymentSubRows(false);
      setIncludeGoodsSoldToCustomer(false);
      setIncludeOtherGoodsStock(false);
      setIncludePendingCheques(true);
      setIncludeReturnedCheques(true);
      setIncludeClearedCheques(true);
    }
  };

  const handleDownload = () => {
    downloadCustomerStatement(customerName, invoices, companyName, currentOptions);
    onOpenChange(false);
  };

  const handlePrint = () => {
    printCustomerStatement(customerName, invoices, companyName, currentOptions);
    onOpenChange(false);
  };

  const handleShare = () => {
    shareCustomerStatement(customerName, invoices, companyName, currentOptions);
    onOpenChange(false);
  };

  const fmt = (n: number) =>
    n.toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto p-0 gap-0">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-5 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center">
                <SlidersHorizontal className="w-5 h-5 text-indigo-300" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold text-white flex items-center gap-2">
                  Customize Customer Statement
                </DialogTitle>
                <DialogDescription className="text-slate-300 text-xs mt-0.5">
                  Select which tables, settlement details, and options to include for{" "}
                  <span className="font-semibold text-white">{customerName}</span>
                </DialogDescription>
              </div>
            </div>
            <Badge variant="outline" className="bg-red-500/20 text-red-200 border-red-500/40 text-xs px-2.5 py-1">
              Due: LKR {fmt(stats.totalDue)}
            </Badge>
          </div>

          {/* Quick Presets */}
          <div className="flex items-center gap-2 mt-4 pt-3 border-t border-white/10 text-xs">
            <span className="text-slate-400 font-medium flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" /> Quick Presets:
            </span>
            <button
              type="button"
              onClick={() => applyPreset("outstanding")}
              className="px-2.5 py-1 rounded-md bg-white/10 hover:bg-white/20 text-white font-medium transition"
            >
              Default Outstanding
            </button>
            <button
              type="button"
              onClick={() => applyPreset("all")}
              className="px-2.5 py-1 rounded-md bg-white/10 hover:bg-white/20 text-white font-medium transition"
            >
              Include All Tables
            </button>
            <button
              type="button"
              onClick={() => applyPreset("invoicesOnly")}
              className="px-2.5 py-1 rounded-md bg-white/10 hover:bg-white/20 text-white font-medium transition"
            >
              Invoices Only
            </button>
            <button
              type="button"
              onClick={() => applyPreset("chequesOnly")}
              className="px-2.5 py-1 rounded-md bg-white/10 hover:bg-white/20 text-white font-medium transition"
            >
              Cheques Only
            </button>
          </div>
        </div>

        {/* Body Form */}
        <div className="p-5 space-y-4 text-sm">
          {/* Section 1: Invoices Table & Payment Rows */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-3">
            <div className="flex items-center gap-2 font-semibold text-slate-800 text-sm">
              <FileText className="w-4 h-4 text-blue-600" />
              <span>Invoices & Direct Payments</span>
            </div>

            <div className="space-y-2.5 pl-6">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <Checkbox
                  checked={includeInvoices}
                  onCheckedChange={(val) => setIncludeInvoices(Boolean(val))}
                  className="mt-0.5"
                />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-slate-800">Unpaid & Partial Invoices Table</span>
                    <Badge variant="secondary" className="text-[11px]">
                      {stats.activeCount} invoices
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-500">
                    Main balance sheet listing invoice numbers, age overdue, total billed, and balance due.
                  </p>
                </div>
              </label>

              <label className="flex items-start gap-2.5 cursor-pointer">
                <Checkbox
                  checked={includePaymentSubRows && includeInvoices}
                  disabled={!includeInvoices}
                  onCheckedChange={(val) => setIncludePaymentSubRows(Boolean(val))}
                  className="mt-0.5"
                />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-slate-800">Payment History Sub-Rows</span>
                    <Badge variant="secondary" className="text-[11px]">
                      {stats.subRowCount} records
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-500">
                    Detailed sub-lines under each invoice showing cash and bank transfer payment dates and amounts.
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* Section 2: Goods & Product Settlements */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-3">
            <div className="flex items-center gap-2 font-semibold text-slate-800 text-sm">
              <Package className="w-4 h-4 text-purple-600" />
              <span>Goods & Product Exchange Settlements</span>
            </div>

            <div className="space-y-2.5 pl-6">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <Checkbox
                  checked={includeGoodsSoldToCustomer}
                  onCheckedChange={(val) => setIncludeGoodsSoldToCustomer(Boolean(val))}
                  className="mt-0.5"
                />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-slate-800">Goods Returned from Customer Bills</span>
                    <Badge variant="outline" className="text-[11px] bg-emerald-50 text-emerald-700 border-emerald-200">
                      Sold To Customer
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-500">
                    Table 1: Sierra products returned from customer's original bills with unit prices and totals.
                  </p>
                </div>
              </label>

              <label className="flex items-start gap-2.5 cursor-pointer">
                <Checkbox
                  checked={includeOtherGoodsStock}
                  onCheckedChange={(val) => setIncludeOtherGoodsStock(Boolean(val))}
                  className="mt-0.5"
                />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-slate-800">Other Agency Products Received</span>
                    <Badge variant="outline" className="text-[11px] bg-purple-50 text-purple-700 border-purple-200">
                      Other Stock
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-500">
                    Table 2: Products accepted as payment credit but not originally billed to this customer.
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* Section 3: Cheques Details Tables */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-3">
            <div className="flex items-center gap-2 font-semibold text-slate-800 text-sm">
              <CreditCard className="w-4 h-4 text-indigo-600" />
              <span>Cheque Tables (Separated by Clearance Status)</span>
            </div>

            <div className="space-y-2.5 pl-6">
              {/* Pending Cheques */}
              <label className="flex items-start gap-2.5 cursor-pointer">
                <Checkbox
                  checked={includePendingCheques}
                  onCheckedChange={(val) => setIncludePendingCheques(Boolean(val))}
                  className="mt-0.5"
                />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-slate-800 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-amber-600" />
                      Pending / Deposited Cheques Table
                    </span>
                    <Badge variant="outline" className="text-[11px] bg-amber-50 text-amber-700 border-amber-200">
                      {stats.cheques.pending} Pending
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-500">
                    Dedicated table for cheques currently in transit awaiting bank clearance (Amber theme).
                  </p>
                </div>
              </label>

              {/* Returned Cheques */}
              <label className="flex items-start gap-2.5 cursor-pointer">
                <Checkbox
                  checked={includeReturnedCheques}
                  onCheckedChange={(val) => setIncludeReturnedCheques(Boolean(val))}
                  className="mt-0.5"
                />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-slate-800 flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
                      Return / Bounced Cheques Table
                    </span>
                    <Badge variant="outline" className="text-[11px] bg-red-50 text-red-700 border-red-200 font-bold">
                      {stats.cheques.returned} Returned
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-500">
                    Dedicated table for returned or bounced cheques requiring customer settlement (Red alert theme).
                  </p>
                </div>
              </label>

              {/* Cleared Cheques (Optional) */}
              <label className="flex items-start gap-2.5 cursor-pointer">
                <Checkbox
                  checked={includeClearedCheques}
                  onCheckedChange={(val) => setIncludeClearedCheques(Boolean(val))}
                  className="mt-0.5"
                />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-slate-800 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      Cleared Cheques Table (Historical Settled)
                    </span>
                    <Badge variant="outline" className="text-[11px] bg-emerald-50 text-emerald-700 border-emerald-200">
                      {stats.cheques.cleared} Cleared
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-500">
                    Optional: Show historical cheques that have already successfully cleared the bank (Emerald theme).
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* Section 4: Custom Headers & Footers */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-3">
            <span className="font-semibold text-slate-800 text-sm">Custom Document Title & Notes (Optional)</span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pl-1">
              <div>
                <Label htmlFor="customTitle" className="text-xs text-slate-600">
                  Document Header Title
                </Label>
                <Input
                  id="customTitle"
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  placeholder="e.g. CUSTOMER OUTSTANDING STATEMENT"
                  className="text-xs mt-1"
                />
              </div>

              <div>
                <Label htmlFor="customNote" className="text-xs text-slate-600">
                  Custom Footer Note
                </Label>
                <Input
                  id="customNote"
                  value={customNote}
                  onChange={(e) => setCustomNote(e.target.value)}
                  placeholder="e.g. Please arrange payment by Friday."
                  className="text-xs mt-1"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <DialogFooter className="bg-slate-100 p-4 border-t flex items-center justify-between sm:justify-between">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} className="text-slate-600 text-xs">
            Cancel
          </Button>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrint}
              className="text-xs font-medium"
            >
              <Printer className="w-3.5 h-3.5 mr-1 text-slate-600" /> Print
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleShare}
              className="text-xs font-medium text-green-700 border-green-200 hover:bg-green-50"
            >
              <Share2 className="w-3.5 h-3.5 mr-1 text-green-600" /> Share WhatsApp
            </Button>

            <Button
              size="sm"
              onClick={handleDownload}
              className="text-xs font-medium bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
            >
              <Download className="w-3.5 h-3.5 mr-1" /> Download PDF
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
