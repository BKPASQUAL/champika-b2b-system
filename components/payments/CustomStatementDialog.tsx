// components/payments/CustomStatementDialog.tsx
"use client";

import React, { useState, useMemo, useEffect } from "react";
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
  RotateCcw,
} from "lucide-react";
import { cn } from "@/lib/utils";
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
  themeColor?: string; // "purple" | "orange" | "blue" | "red" | "emerald"
}

type PresetKey = "outstanding" | "all" | "invoicesOnly" | "chequesOnly" | "custom";

export function CustomStatementDialog({
  open,
  onOpenChange,
  customerName,
  invoices,
  companyName = "CHAMPIKA SIERRA",
  themeColor = "purple",
}: CustomStatementDialogProps) {
  // Option States (Default: Invoices, Sub-rows, Goods, and Return Cheques; Pending & Cleared Cheques unchecked)
  const [includeInvoices, setIncludeInvoices] = useState(DEFAULT_STATEMENT_OPTIONS.includeInvoices !== false);
  const [includePaymentSubRows, setIncludePaymentSubRows] = useState(DEFAULT_STATEMENT_OPTIONS.includePaymentSubRows !== false);
  const [includeGoodsSoldToCustomer, setIncludeGoodsSoldToCustomer] = useState(DEFAULT_STATEMENT_OPTIONS.includeGoodsSoldToCustomer !== false);
  const [includeOtherGoodsStock, setIncludeOtherGoodsStock] = useState(DEFAULT_STATEMENT_OPTIONS.includeOtherGoodsStock !== false);
  const [includePendingCheques, setIncludePendingCheques] = useState(Boolean(DEFAULT_STATEMENT_OPTIONS.includePendingCheques));
  const [includeReturnedCheques, setIncludeReturnedCheques] = useState(DEFAULT_STATEMENT_OPTIONS.includeReturnedCheques !== false);
  const [includeClearedCheques, setIncludeClearedCheques] = useState(Boolean(DEFAULT_STATEMENT_OPTIONS.includeClearedCheques));
  const [customTitle, setCustomTitle] = useState("");
  const [customNote, setCustomNote] = useState("");
  const [activePreset, setActivePreset] = useState<PresetKey>("outstanding");

  // Reset to default outstanding whenever dialog opens
  useEffect(() => {
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

    invoices.forEach((inv) => {
      (inv.payments || []).forEach((p) => {
        const isCheque = p.method?.toLowerCase() === "cheque" || Boolean(p.chequeNo && p.chequeNo.trim());
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

    activeInvoices.forEach((inv) => {
      (inv.payments || []).forEach((p) => {
        const isCheque = p.method?.toLowerCase() === "cheque" || Boolean(p.chequeNo && p.chequeNo.trim());
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
  const applyPreset = (preset: "outstanding" | "all" | "invoicesOnly" | "chequesOnly") => {
    setActivePreset(preset);
    if (preset === "outstanding") {
      setIncludeInvoices(true);
      setIncludePaymentSubRows(true);
      setIncludeGoodsSoldToCustomer(true);
      setIncludeOtherGoodsStock(true);
      setIncludePendingCheques(false);
      setIncludeReturnedCheques(true);
      setIncludeClearedCheques(false);
    } else if (preset === "all") {
      setIncludeInvoices(true);
      setIncludePaymentSubRows(true);
      setIncludeGoodsSoldToCustomer(true);
      setIncludeOtherGoodsStock(true);
      setIncludePendingCheques(true);
      setIncludeReturnedCheques(true);
      setIncludeClearedCheques(true);
    } else if (preset === "invoicesOnly") {
      setIncludeInvoices(true);
      setIncludePaymentSubRows(true);
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
      <DialogContent className="sm:max-w-2xl max-h-[88vh] flex flex-col p-0 gap-0 overflow-hidden rounded-2xl shadow-xl border border-slate-200">
        {/* Header matching Champika clean design */}
        <DialogHeader className="p-4 sm:p-5 pb-3 border-b bg-white shrink-0 pr-12 text-left">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-purple-100 flex items-center justify-center shrink-0">
              <SlidersHorizontal className="w-4 h-4 text-purple-700" />
            </div>
            <div>
              <DialogTitle className="text-base sm:text-lg font-bold text-slate-900">
                Customize Customer Statement
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Select which tables and settlement details to include in the statement
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Scrollable Content Body */}
        <div className="overflow-y-auto px-4 sm:px-6 py-4 flex-1 space-y-4 min-h-0 bg-slate-50/40">
          {/* Customer & Due Banner */}
          <div className="p-3 bg-purple-50/70 border border-purple-200/80 rounded-xl flex items-center justify-between gap-3 text-xs">
            <div className="min-w-0">
              <span className="text-slate-500">Customer: </span>
              <span className="font-semibold text-slate-900 truncate block sm:inline">
                {customerName}
              </span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-slate-500 hidden sm:inline">Total Due:</span>
              <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 font-bold px-2 py-0.5">
                LKR {fmt(stats.totalDue)}
              </Badge>
            </div>
          </div>

          {/* Quick Presets Pills */}
          <div className="bg-white p-1.5 rounded-xl border border-slate-200 flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-slate-400 font-medium px-2 py-1 flex items-center gap-1 shrink-0">
              <Sparkles className="w-3.5 h-3.5 text-purple-600" /> Presets:
            </span>
            <button
              type="button"
              onClick={() => applyPreset("outstanding")}
              className={cn(
                "px-2.5 py-1 rounded-lg font-medium transition-all shrink-0",
                activePreset === "outstanding"
                  ? "bg-purple-100 text-purple-800 font-semibold shadow-2xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              )}
            >
              Default Outstanding
            </button>
            <button
              type="button"
              onClick={() => applyPreset("all")}
              className={cn(
                "px-2.5 py-1 rounded-lg font-medium transition-all shrink-0",
                activePreset === "all"
                  ? "bg-purple-100 text-purple-800 font-semibold shadow-2xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              )}
            >
              Include All Tables
            </button>
            <button
              type="button"
              onClick={() => applyPreset("invoicesOnly")}
              className={cn(
                "px-2.5 py-1 rounded-lg font-medium transition-all shrink-0",
                activePreset === "invoicesOnly"
                  ? "bg-purple-100 text-purple-800 font-semibold shadow-2xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              )}
            >
              Invoices Only
            </button>
            <button
              type="button"
              onClick={() => applyPreset("chequesOnly")}
              className={cn(
                "px-2.5 py-1 rounded-lg font-medium transition-all shrink-0",
                activePreset === "chequesOnly"
                  ? "bg-purple-100 text-purple-800 font-semibold shadow-2xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              )}
            >
              Cheques Only
            </button>
          </div>

          {/* Section 1: Invoices & Direct Payments */}
          <div className="bg-white rounded-xl border border-slate-200 p-3 sm:p-4 space-y-2.5">
            <div className="flex items-center gap-2 font-semibold text-slate-900 text-xs sm:text-sm">
              <FileText className="w-4 h-4 text-blue-600" />
              <span>Invoices & Direct Payments</span>
            </div>

            <div className="space-y-2">
              {/* Unpaid & Partial Invoices */}
              <div
                onClick={() => {
                  setIncludeInvoices(!includeInvoices);
                  setActivePreset("custom");
                }}
                className={cn(
                  "flex items-center justify-between p-2.5 rounded-lg border transition-all cursor-pointer",
                  includeInvoices
                    ? "bg-blue-50/30 border-blue-200/80 shadow-2xs"
                    : "bg-slate-50 border-slate-200/60 opacity-60"
                )}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Checkbox
                    checked={includeInvoices}
                    onCheckedChange={(val) => {
                      setIncludeInvoices(Boolean(val));
                      setActivePreset("custom");
                    }}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <div className="min-w-0">
                    <span className="font-medium text-xs sm:text-sm text-slate-800 block">
                      Unpaid & Partial Invoices Table
                    </span>
                    <span className="text-[11px] text-slate-500 hidden sm:block">
                      Invoice numbers, overdue age, total billed, and balance due
                    </span>
                  </div>
                </div>
                <Badge variant="secondary" className="text-xs shrink-0 font-semibold ml-2">
                  {stats.activeCount} invoices
                </Badge>
              </div>

              {/* Payment History Sub-Rows */}
              <div
                onClick={() => {
                  if (includeInvoices) {
                    setIncludePaymentSubRows(!includePaymentSubRows);
                    setActivePreset("custom");
                  }
                }}
                className={cn(
                  "flex items-center justify-between p-2.5 rounded-lg border transition-all",
                  !includeInvoices ? "opacity-40 cursor-not-allowed bg-slate-50 border-slate-200" : "cursor-pointer",
                  includePaymentSubRows && includeInvoices
                    ? "bg-blue-50/30 border-blue-200/80 shadow-2xs"
                    : "bg-slate-50 border-slate-200/60 opacity-60"
                )}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Checkbox
                    checked={includePaymentSubRows && includeInvoices}
                    disabled={!includeInvoices}
                    onCheckedChange={(val) => {
                      setIncludePaymentSubRows(Boolean(val));
                      setActivePreset("custom");
                    }}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <div className="min-w-0">
                    <span className="font-medium text-xs sm:text-sm text-slate-800 block">
                      Payment History Sub-Rows
                    </span>
                    <span className="text-[11px] text-slate-500 hidden sm:block">
                      Cash and bank payment dates & amounts under each invoice
                    </span>
                  </div>
                </div>
                <Badge variant="secondary" className="text-xs shrink-0 font-semibold ml-2">
                  {stats.subRowCount} records
                </Badge>
              </div>
            </div>
          </div>

          {/* Section 2: Goods & Product Settlements */}
          <div className="bg-white rounded-xl border border-slate-200 p-3 sm:p-4 space-y-2.5">
            <div className="flex items-center gap-2 font-semibold text-slate-900 text-xs sm:text-sm">
              <Package className="w-4 h-4 text-purple-600" />
              <span>Goods & Product Exchange Settlements</span>
            </div>

            <div className="space-y-2">
              {/* Goods Sold to Customer */}
              <div
                onClick={() => {
                  setIncludeGoodsSoldToCustomer(!includeGoodsSoldToCustomer);
                  setActivePreset("custom");
                }}
                className={cn(
                  "flex items-center justify-between p-2.5 rounded-lg border transition-all cursor-pointer",
                  includeGoodsSoldToCustomer
                    ? "bg-purple-50/30 border-purple-200/80 shadow-2xs"
                    : "bg-slate-50 border-slate-200/60 opacity-60"
                )}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Checkbox
                    checked={includeGoodsSoldToCustomer}
                    onCheckedChange={(val) => {
                      setIncludeGoodsSoldToCustomer(Boolean(val));
                      setActivePreset("custom");
                    }}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <div className="min-w-0">
                    <span className="font-medium text-xs sm:text-sm text-slate-800 block">
                      Goods Returned from Customer Bills
                    </span>
                    <span className="text-[11px] text-slate-500 hidden sm:block">
                      Original customer products returned with unit prices and totals
                    </span>
                  </div>
                </div>
                <Badge variant="outline" className="text-[11px] bg-emerald-50 text-emerald-700 border-emerald-200 shrink-0 font-medium ml-2">
                  Sold to Customer {stats.goodsSoldCount > 0 ? `(${stats.goodsSoldCount})` : ""}
                </Badge>
              </div>

              {/* Other Stock Products */}
              <div
                onClick={() => {
                  setIncludeOtherGoodsStock(!includeOtherGoodsStock);
                  setActivePreset("custom");
                }}
                className={cn(
                  "flex items-center justify-between p-2.5 rounded-lg border transition-all cursor-pointer",
                  includeOtherGoodsStock
                    ? "bg-purple-50/30 border-purple-200/80 shadow-2xs"
                    : "bg-slate-50 border-slate-200/60 opacity-60"
                )}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Checkbox
                    checked={includeOtherGoodsStock}
                    onCheckedChange={(val) => {
                      setIncludeOtherGoodsStock(Boolean(val));
                      setActivePreset("custom");
                    }}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <div className="min-w-0">
                    <span className="font-medium text-xs sm:text-sm text-slate-800 block">
                      Other Agency Products Received
                    </span>
                    <span className="text-[11px] text-slate-500 hidden sm:block">
                      Products accepted as credit not originally billed to this customer
                    </span>
                  </div>
                </div>
                <Badge variant="outline" className="text-[11px] bg-purple-50 text-purple-700 border-purple-200 shrink-0 font-medium ml-2">
                  Other Stock {stats.goodsOtherCount > 0 ? `(${stats.goodsOtherCount})` : ""}
                </Badge>
              </div>
            </div>
          </div>

          {/* Section 3: Cheque Tables */}
          <div className="bg-white rounded-xl border border-slate-200 p-3 sm:p-4 space-y-2.5">
            <div className="flex items-center gap-2 font-semibold text-slate-900 text-xs sm:text-sm">
              <CreditCard className="w-4 h-4 text-indigo-600" />
              <span>Cheque Tables (Clearance Status)</span>
            </div>

            <div className="space-y-2">
              {/* Return / Bounced Cheques (Default ON) */}
              <div
                onClick={() => {
                  setIncludeReturnedCheques(!includeReturnedCheques);
                  setActivePreset("custom");
                }}
                className={cn(
                  "flex items-center justify-between p-2.5 rounded-lg border transition-all cursor-pointer",
                  includeReturnedCheques
                    ? "bg-red-50/30 border-red-200 shadow-2xs"
                    : "bg-slate-50 border-slate-200/60 opacity-60"
                )}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Checkbox
                    checked={includeReturnedCheques}
                    onCheckedChange={(val) => {
                      setIncludeReturnedCheques(Boolean(val));
                      setActivePreset("custom");
                    }}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <div className="min-w-0">
                    <span className="font-medium text-xs sm:text-sm text-slate-800 flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-red-600 shrink-0" />
                      Return / Bounced Cheques Table
                    </span>
                    <span className="text-[11px] text-slate-500 hidden sm:block">
                      Bounced cheques requiring urgent customer re-settlement
                    </span>
                  </div>
                </div>
                <Badge variant="outline" className="text-[11px] bg-red-50 text-red-700 border-red-200 font-bold shrink-0 ml-2">
                  {stats.cheques.returned} Returned
                </Badge>
              </div>

              {/* Pending / Deposited Cheques (Default OFF) */}
              <div
                onClick={() => {
                  setIncludePendingCheques(!includePendingCheques);
                  setActivePreset("custom");
                }}
                className={cn(
                  "flex items-center justify-between p-2.5 rounded-lg border transition-all cursor-pointer",
                  includePendingCheques
                    ? "bg-amber-50/30 border-amber-200 shadow-2xs"
                    : "bg-slate-50 border-slate-200/60 opacity-60"
                )}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Checkbox
                    checked={includePendingCheques}
                    onCheckedChange={(val) => {
                      setIncludePendingCheques(Boolean(val));
                      setActivePreset("custom");
                    }}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <div className="min-w-0">
                    <span className="font-medium text-xs sm:text-sm text-slate-800 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      Pending / Deposited Cheques Table
                    </span>
                    <span className="text-[11px] text-slate-500 hidden sm:block">
                      Cheques in transit awaiting bank clearance (Optional)
                    </span>
                  </div>
                </div>
                <Badge variant="outline" className="text-[11px] bg-amber-50 text-amber-700 border-amber-200 font-medium shrink-0 ml-2">
                  {stats.cheques.pending} Pending
                </Badge>
              </div>

              {/* Cleared Cheques (Default OFF) */}
              <div
                onClick={() => {
                  setIncludeClearedCheques(!includeClearedCheques);
                  setActivePreset("custom");
                }}
                className={cn(
                  "flex items-center justify-between p-2.5 rounded-lg border transition-all cursor-pointer",
                  includeClearedCheques
                    ? "bg-emerald-50/30 border-emerald-200 shadow-2xs"
                    : "bg-slate-50 border-slate-200/60 opacity-60"
                )}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Checkbox
                    checked={includeClearedCheques}
                    onCheckedChange={(val) => {
                      setIncludeClearedCheques(Boolean(val));
                      setActivePreset("custom");
                    }}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <div className="min-w-0">
                    <span className="font-medium text-xs sm:text-sm text-slate-800 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      Cleared Cheques Table (Historical Settled)
                    </span>
                    <span className="text-[11px] text-slate-500 hidden sm:block">
                      Historical cheques that already cleared the bank (Optional)
                    </span>
                  </div>
                </div>
                <Badge variant="outline" className="text-[11px] bg-emerald-50 text-emerald-700 border-emerald-200 font-medium shrink-0 ml-2">
                  {stats.cheques.cleared} Cleared
                </Badge>
              </div>
            </div>
          </div>

          {/* Section 4: Optional Notes & Header */}
          <div className="bg-white rounded-xl border border-slate-200 p-3 sm:p-4 space-y-2.5">
            <span className="font-semibold text-slate-900 text-xs sm:text-sm block">
              Custom Document Title & Notes (Optional)
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="customTitle" className="text-xs text-slate-600">
                  Document Header Title
                </Label>
                <Input
                  id="customTitle"
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  placeholder="e.g. CUSTOMER OUTSTANDING STATEMENT"
                  className="h-8 text-xs mt-1"
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
                  className="h-8 text-xs mt-1"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions — Fixed at bottom, always visible without scrolling */}
        <DialogFooter className="bg-white p-3 sm:p-4 border-t flex flex-row items-center justify-between gap-2 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-slate-600 hover:text-slate-900 text-xs"
          >
            Cancel
          </Button>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrint}
              className="text-xs font-medium text-slate-700 border-slate-300 hover:bg-slate-50"
            >
              <Printer className="w-3.5 h-3.5 mr-1 text-slate-600" /> Print
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleShare}
              className="text-xs font-medium text-emerald-700 border-emerald-300 hover:bg-emerald-50"
            >
              <Share2 className="w-3.5 h-3.5 mr-1 text-emerald-600" /> Share
            </Button>

            <Button
              size="sm"
              onClick={handleDownload}
              className="text-xs font-medium bg-purple-700 hover:bg-purple-800 text-white shadow-xs"
            >
              <Download className="w-3.5 h-3.5 mr-1" /> Download PDF
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
