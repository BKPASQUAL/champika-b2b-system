"use client";

import React, { useState, useMemo, useEffect } from "react";
import { useCachedFetch, invalidatePaymentCaches, invalidateFinanceCaches } from "@/hooks/useCachedFetch";
import { getUserBusinessContext } from "@/app/middleware/businessAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Search,
  RefreshCw,
  Clock,
  Banknote,
  CheckCircle,
  XCircle,
  AlertTriangle,
  CreditCard,
  History,
  Loader2,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  Sparkles,
  Upload,
  FileText,
  Check,
  AlertCircle,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// ─── Types ─────────────────────────────────────────────────────────────────────

type ChequeStatus = "Pending" | "Deposited" | "Cleared" | "Bounced" | "Returned";
type ActionType = "deposit" | "pass" | "return";

interface ChequeRecord {
  ids: string[];           // all payment IDs sharing this cheque number
  paymentDate: string;
  chequeDate: string | null;
  chequeNo: string | null;
  customerName: string;
  invoiceNos: string[];    // all invoice numbers covered by this cheque
  bankName: string | null;
  bankCode: string | null;
  amount: number;          // total across all invoices
  chequeStatus: ChequeStatus;
  depositAccountName: string | null;
  depositAccountId: string | null;
}

interface ActionDialog {
  cheque: ChequeRecord;
  type: ActionType;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

const formatCurrency = (n: number) =>
  new Intl.NumberFormat("en-LK", { style: "currency", currency: "LKR", minimumFractionDigits: 0 }).format(n);

const formatDate = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";

const STATUS_CONFIG: Record<ChequeStatus, {
  label: string; bg: string; text: string; border: string;
  icon: React.ComponentType<{ className?: string }>;
}> = {
  Pending:   { label: "Pending",   bg: "bg-amber-50",  text: "text-amber-700",  border: "border-amber-200",  icon: Clock },
  Deposited: { label: "Deposited", bg: "bg-blue-50",   text: "text-blue-700",   border: "border-blue-200",   icon: Banknote },
  Cleared:   { label: "Cleared",   bg: "bg-green-50",  text: "text-green-700",  border: "border-green-200",  icon: CheckCircle },
  Bounced:   { label: "Bounced",   bg: "bg-red-50",    text: "text-red-700",    border: "border-red-200",    icon: XCircle },
  Returned:  { label: "Returned",  bg: "bg-gray-100",  text: "text-gray-600",   border: "border-gray-300",   icon: AlertTriangle },
};

function StatusBadge({ status }: { status: ChequeStatus }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.Pending;
  const Icon = cfg.icon;
  return (
    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium border", cfg.bg, cfg.text, cfg.border)}>
      <Icon className="w-3 h-3" />
      {cfg.label}
    </span>
  );
}

// ─── Cheque Summary ────────────────────────────────────────────────────────────

function ChequeSummary({ cheque }: { cheque: ChequeRecord }) {
  return (
    <div className="rounded-lg border bg-gray-50 p-3 space-y-2 text-sm">
      <div className="flex items-center justify-between">
        <span className="font-mono font-bold text-gray-800">#{cheque.chequeNo || "—"}</span>
        <span className="font-bold text-gray-900 text-base">{formatCurrency(cheque.amount)}</span>
      </div>
      <p className="font-medium text-gray-700">{cheque.customerName}</p>
      <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
        <span>Bank: {cheque.bankCode ? `${cheque.bankCode}${cheque.bankName ? ` – ${cheque.bankName}` : ""}` : "—"}</span>
        <span>
          {cheque.invoiceNos.length > 1
            ? `Invoices: ${cheque.invoiceNos.join(", ")}`
            : `Invoice: ${cheque.invoiceNos[0] ?? "N/A"}`}
        </span>
        <span>Cheque Date: {formatDate(cheque.chequeDate)}</span>
        <span>Received: {formatDate(cheque.paymentDate)}</span>
      </div>
      {cheque.ids.length > 1 && (
        <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
          {cheque.ids.length} invoices — Total: {formatCurrency(cheque.amount)}
        </div>
      )}
      {cheque.depositAccountName && (
        <div className="flex items-center gap-2 pt-1 border-t border-gray-200 mt-1">
          <Banknote className="h-3.5 w-3.5 text-blue-500 shrink-0" />
          <span className="text-xs text-blue-700 font-medium">
            Deposited to: <span className="font-semibold">{cheque.depositAccountName}</span>
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Cheque Card ───────────────────────────────────────────────────────────────

function ChequeCard({
  cheque,
  actions,
  updatingId,
  selected,
  onToggle,
}: {
  cheque: ChequeRecord;
  actions?: React.ReactNode;
  updatingId: string | null;
  selected?: boolean;
  onToggle?: () => void;
}) {
  const isUpdating = cheque.ids.some((id) => updatingId === id);

  // Urgency calculation based on cheque date
  const today = new Date().toISOString().split("T")[0];
  const cd = cheque.chequeDate;
  const daysLeft = cd
    ? Math.ceil((new Date(cd).getTime() - new Date(today).getTime()) / 86_400_000)
    : null;
  const isPending   = cheque.chequeStatus === "Pending";
  const isDeposited = cheque.chequeStatus === "Deposited";
  const actionable  = isPending || isDeposited;
  const isOverdue   = actionable && daysLeft !== null && daysLeft < 0;
  const isDueToday  = actionable && daysLeft === 0;
  const isDueSoon   = actionable && daysLeft !== null && daysLeft > 0 && daysLeft <= 3;

  return (
    <div className={cn(
      "rounded-lg border bg-white overflow-hidden transition-all",
      isUpdating && "opacity-60",
      selected     && "border-blue-400 ring-1 ring-blue-300",
      !selected && isOverdue   && "border-red-300",
      !selected && isDueToday  && "border-orange-300",
      !selected && isDueSoon   && "border-amber-300",
    )}>
      {/* Urgency banner */}
      {isOverdue && (
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500 text-white">
          <AlertTriangle className="h-3 w-3 shrink-0" />
          <span className="text-[11px] font-bold flex-1">
            {isPending ? "Deposit overdue" : "Pass overdue"}
          </span>
          <span className="text-[10px] opacity-90">{Math.abs(daysLeft!)}d past due</span>
        </div>
      )}
      {isDueToday && (
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-500 text-white">
          <AlertTriangle className="h-3 w-3 shrink-0" />
          <span className="text-[11px] font-bold">
            {isPending ? "Deposit today" : "Pass today"}
          </span>
        </div>
      )}
      {isDueSoon && (
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border-b border-amber-200">
          <Clock className="h-3 w-3 text-amber-600 shrink-0" />
          <span className="text-[11px] text-amber-700 font-medium">
            {isPending ? `Deposit in ${daysLeft}d` : `Pass in ${daysLeft}d`}
          </span>
        </div>
      )}

      <div className="p-3 space-y-2">
        {/* Header row */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {onToggle && (
              <Checkbox
                checked={selected}
                onCheckedChange={onToggle}
                className="shrink-0"
                aria-label={`Select cheque ${cheque.chequeNo}`}
              />
            )}
            <span className="font-mono text-sm font-bold text-gray-800">#{cheque.chequeNo || "—"}</span>
          </div>
          <span className="text-sm font-bold text-gray-900">{formatCurrency(cheque.amount)}</span>
        </div>

        <p className="text-sm font-medium text-gray-700 truncate">{cheque.customerName}</p>

        <div className="text-xs text-muted-foreground space-y-0.5">
          <p>{cheque.bankCode ? `${cheque.bankCode}${cheque.bankName ? ` – ${cheque.bankName}` : ""}` : "No bank"}</p>
          <div className="flex justify-between items-start gap-1">
            <span className={cn(
              isOverdue  && "text-red-600 font-semibold",
              isDueToday && "text-orange-600 font-semibold",
            )}>
              Cheque: {formatDate(cheque.chequeDate)}
            </span>
            {cheque.invoiceNos.length > 1 ? (
              <span className="font-mono text-[10px] bg-amber-50 text-amber-700 border border-amber-200 rounded px-1">
                {cheque.invoiceNos.length} invoices
              </span>
            ) : (
              <span className="font-mono text-[10px] bg-gray-100 text-gray-500 rounded px-1">
                {cheque.invoiceNos[0] ?? "N/A"}
              </span>
            )}
          </div>
        </div>

        {/* Deposit account — prominent box */}
        {cheque.depositAccountName && (
          <div className="flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1.5">
            <Banknote className="h-3.5 w-3.5 text-blue-500 shrink-0" />
            <div className="min-w-0">
              <p className="text-[9px] font-semibold text-blue-500 uppercase tracking-wide leading-none mb-0.5">Deposit Account</p>
              <p className="text-xs font-bold text-blue-800 truncate">{cheque.depositAccountName}</p>
            </div>
          </div>
        )}

        {actions && (
          <div className="flex gap-1.5 pt-0.5">
            {isUpdating ? (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" /> Updating…
              </div>
            ) : actions}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Section Column ────────────────────────────────────────────────────────────

function SectionColumn({
  title, count, total, headerBg, headerText, borderColor, icon: Icon, children, empty,
}: {
  title: string; count: number; total: number;
  headerBg: string; headerText: string; borderColor: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode; empty: string;
}) {
  return (
    <div className={cn("flex flex-col rounded-xl border-2 overflow-hidden", borderColor)}>
      <div className={cn("px-4 py-3 flex items-center justify-between", headerBg)}>
        <div className="flex items-center gap-2">
          <Icon className={cn("h-4 w-4", headerText)} />
          <h3 className={cn("font-semibold text-sm", headerText)}>{title}</h3>
        </div>
        <div className="text-right">
          <p className={cn("text-lg font-bold tabular-nums", headerText)}>{count}</p>
          <p className={cn("text-[10px] font-medium", headerText)}>{formatCurrency(total)}</p>
        </div>
      </div>
      <div className="flex-1 p-3 space-y-2 min-h-[120px] bg-gray-50/50 overflow-y-auto max-h-[600px]">
        {count === 0 ? (
          <div className="flex flex-col items-center justify-center h-24 text-muted-foreground gap-1">
            <CreditCard className="h-6 w-6 opacity-20" />
            <p className="text-xs">{empty}</p>
          </div>
        ) : children}
      </div>
    </div>
  );
}

// ─── Theme ─────────────────────────────────────────────────────────────────────

type ThemeColor = "purple" | "red" | "blue" | "orange" | "gray";

const THEME: Record<ThemeColor, { header: string; iconWrap: string }> = {
  purple: { header: "text-purple-900", iconWrap: "bg-purple-100 text-purple-600" },
  red:    { header: "text-red-900",    iconWrap: "bg-red-100 text-red-600" },
  blue:   { header: "text-blue-900",   iconWrap: "bg-blue-100 text-blue-600" },
  orange: { header: "text-orange-900", iconWrap: "bg-orange-100 text-orange-600" },
  gray:   { header: "text-gray-900",   iconWrap: "bg-gray-100 text-gray-600" },
};

// ─── Confirm Action Dialog ─────────────────────────────────────────────────────

const ACTION_META: Record<ActionType, {
  title: string;
  description: string;
  confirmLabel: string;
  confirmClass: string;
}> = {
  deposit: {
    title: "Mark Cheque as Deposited",
    description: "Select the bank account where this cheque will be deposited.",
    confirmLabel: "Mark Deposited",
    confirmClass: "bg-blue-600 hover:bg-blue-700",
  },
  pass: {
    title: "Clear / Pass Cheque",
    description: "Confirm that the cheque has cleared. The deposit account balance will be updated.",
    confirmLabel: "Confirm Pass",
    confirmClass: "bg-green-600 hover:bg-green-700",
  },
  return: {
    title: "Return Cheque",
    description: "This will mark the cheque as returned. The payment will need to be resolved separately.",
    confirmLabel: "Confirm Return",
    confirmClass: "bg-red-600 hover:bg-red-700",
  },
};

function ConfirmActionDialog({
  dialog,
  bankAccounts,
  depositAccountId,
  setDepositAccountId,
  onConfirm,
  onClose,
  confirming,
}: {
  dialog: ActionDialog;
  bankAccounts: any[];
  depositAccountId: string;
  setDepositAccountId: (id: string) => void;
  onConfirm: () => void;
  onClose: () => void;
  confirming: boolean;
}) {
  const meta = ACTION_META[dialog.type];

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{meta.title}</DialogTitle>
          <DialogDescription>{meta.description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <ChequeSummary cheque={dialog.cheque} />

          {/* Deposit: account selector */}
          {dialog.type === "deposit" && (
            <div className="space-y-2">
              <Label>Deposit Account <span className="text-red-500">*</span></Label>
              <Select value={depositAccountId} onValueChange={setDepositAccountId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select account…" />
                </SelectTrigger>
                <SelectContent>
                  {bankAccounts.length === 0 ? (
                    <SelectItem value="__none" disabled>No accounts found</SelectItem>
                  ) : (
                    bankAccounts.map((acc) => (
                      <SelectItem key={acc.id} value={acc.id}>
                        {acc.account_name}
                        {acc.account_type ? ` (${acc.account_type})` : ""}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Pass / Return: show the deposit account read-only */}
          {(dialog.type === "pass" || dialog.type === "return") && dialog.cheque.depositAccountName && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 flex items-center gap-2">
              <Banknote className="h-4 w-4 text-blue-500 shrink-0" />
              <div className="text-sm">
                <p className="text-blue-600 text-xs font-medium uppercase tracking-wide">Deposit Account</p>
                <p className="font-semibold text-blue-800">{dialog.cheque.depositAccountName}</p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={confirming}>Cancel</Button>
          <Button
            className={meta.confirmClass}
            onClick={onConfirm}
            disabled={confirming || (dialog.type === "deposit" && !depositAccountId)}
          >
            {confirming ? <Loader2 className="h-4 w-4 animate-spin" /> : meta.confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export interface ChequeManagementPageProps {
  defaultBusinessId?: string;   // omit for admin (fetches all)
  portalName: string;
  themeColor: ThemeColor;
  Icon: React.ComponentType<{ className?: string }>;
}

export function ChequeManagementPage({
  defaultBusinessId,
  portalName,
  themeColor,
  Icon,
}: ChequeManagementPageProps) {
  const t = THEME[themeColor];

  const [businessId, setBusinessId] = useState<string | null>(defaultBusinessId ?? null);

  useEffect(() => {
    if (!defaultBusinessId) return;   // admin — no context override
    const user = getUserBusinessContext();
    setBusinessId(user?.businessId ?? defaultBusinessId);
  }, [defaultBusinessId]);

  const paymentsUrl = businessId
    ? `/api/payments?businessId=${businessId}`
    : `/api/payments`;

  const { data: rawPayments = [], loading, refetch } = useCachedFetch<any[]>(
    paymentsUrl,
    [],
    () => toast.error("Failed to load payments")
  );

  useEffect(() => {
    const handler = () => refetch();
    window.addEventListener("b2b:payment-mutated", handler);
    return () => window.removeEventListener("b2b:payment-mutated", handler);
  }, [refetch]);

  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [dateType, setDateType] = useState<"cheque" | "payment">("cheque");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  const [historySearch, setHistorySearch] = useState("");
  const [historyPage, setHistoryPage] = useState(1);
  const HISTORY_PAGE_SIZE = 10;

  const [actionDialog, setActionDialog] = useState<ActionDialog | null>(null);
  const [depositAccountId, setDepositAccountId] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);

  // ─── Bulk selection state ──────────────────────────────────────────────────
  const [selectedPendingKeys, setSelectedPendingKeys] = useState<Set<string>>(new Set());
  const [selectedDepositedKeys, setSelectedDepositedKeys] = useState<Set<string>>(new Set());

  // Bulk deposit dialog (for pending → deposited)
  const [isBulkDepositOpen, setIsBulkDepositOpen] = useState(false);
  const [bulkDepositAccId, setBulkDepositAccId] = useState("");

  // Bulk pass dialog (for deposited → cleared)
  const [isBulkPassOpen, setIsBulkPassOpen] = useState(false);

  const [bulkConfirming, setBulkConfirming] = useState(false);

  // ─── AI Reconciliation State ───────────────────────────────────────────────
  const [isReconcileOpen, setIsReconcileOpen] = useState(false);
  const [reconcileFile, setReconcileFile] = useState<File | null>(null);
  const [reconcileLoading, setReconcileLoading] = useState(false);
  const [reconcileLoadingStatus, setReconcileLoadingStatus] = useState("");
  const [reconcileStep, setReconcileStep] = useState<"upload" | "loading" | "results">("upload");
  const [extractedTransactions, setExtractedTransactions] = useState<any[]>([]);
  const [isDemoMode, setIsDemoMode] = useState(false);
  
  // Confirmed matched payment IDs
  const [confirmedMatchIds, setConfirmedMatchIds] = useState<Set<string>>(new Set());
  const [matchedPaymentStatuses, setMatchedPaymentStatuses] = useState<Record<string, ChequeStatus>>({}); // paymentId -> Cleared | Returned
  
  // Deposit accounts for pending items
  const [reconcileDefaultAccountId, setReconcileDefaultAccountId] = useState("");
  const [specificDepositAccounts, setSpecificDepositAccounts] = useState<Record<string, string>>({}); // paymentId -> bankAccountId
  const [reconcileApplying, setReconcileApplying] = useState(false);


  const handleProcessStatement = async () => {
    if (!reconcileFile) {
      toast.error("Please select a statement PDF file first.");
      return;
    }

    setReconcileStep("loading");
    setReconcileLoading(true);
    setReconcileLoadingStatus("Uploading statement PDF...");

    try {
      const fd = new FormData();
      fd.append("file", reconcileFile);
      if (businessId) {
        fd.append("businessId", businessId);
      }

      setReconcileLoadingStatus("AI is extracting cheque transactions...");
      const res = await fetch("/api/cheques/reconcile", {
        method: "POST",
        body: fd,
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to process statement");
      }

      const resData = await res.json();
      setExtractedTransactions(resData.transactions || []);
      setIsDemoMode(!!resData.isDemo);

      // Pre-select matches
      const systemMatches = cheques.filter(
        (c) => c.chequeStatus === "Pending" || c.chequeStatus === "Deposited"
      );

      const newConfirmed = new Set<string>();
      const initialStatuses: Record<string, ChequeStatus> = {};
      const initialAccounts: Record<string, string> = {};

      resData.transactions.forEach((tx: any) => {
        let found: ChequeRecord | undefined;
        
        // Match strictly by Cheque Number AND Amount AND Date range (within 14 days)
        found = systemMatches.find((c) => {
          const cleanSysNo = (c.chequeNo || "").trim().replace(/^0+/, "");
          const cleanTxNo = (tx.chequeNo || "").trim().replace(/^0+/, "");
          const isChqNoMatch = cleanSysNo && cleanTxNo && 
            (cleanSysNo === cleanTxNo || cleanSysNo.includes(cleanTxNo) || cleanTxNo.includes(cleanSysNo));
          if (!isChqNoMatch) return false;

          const isAmountMatch = Math.abs(c.amount - tx.amount) < 0.1;
          if (!isAmountMatch) return false;

          if (c.chequeDate && tx.date) {
            const sysDate = new Date(c.chequeDate).getTime();
            const txDate = new Date(tx.date).getTime();
            const daysDiff = Math.abs(sysDate - txDate) / (1000 * 60 * 60 * 24);
            return daysDiff <= 14;
          }

          return true;
        });

        if (found) {
          found.ids.forEach((id) => {
            newConfirmed.add(id);
            initialStatuses[id] = tx.status || "Cleared";
            if (found?.depositAccountId) {
              initialAccounts[id] = found.depositAccountId;
            }
          });
        }
      });

      setConfirmedMatchIds(newConfirmed);
      setMatchedPaymentStatuses(initialStatuses);
      setSpecificDepositAccounts(initialAccounts);
      setReconcileStep("results");
    } catch (err: any) {
      toast.error(err.message || "Failed to analyze bank statement.");
      setReconcileStep("upload");
    } finally {
      setReconcileLoading(false);
    }
  };

  const handleApplyReconciliation = async () => {
    if (confirmedMatchIds.size === 0) {
      toast.error("No matches confirmed.");
      return;
    }

    const pendingClearedMatchIds = Array.from(confirmedMatchIds).filter((id) => {
      const pay = rawPayments.find((p: any) => p.id === id);
      const targetStatus = matchedPaymentStatuses[id] || "Cleared";
      return pay && pay.cheque_status === "Pending" && targetStatus === "Cleared";
    });

    for (const id of pendingClearedMatchIds) {
      const resolvedAccId = specificDepositAccounts[id] || reconcileDefaultAccountId;
      if (!resolvedAccId || resolvedAccId === "__none") {
        toast.error("Please specify a deposit account for all cleared pending cheques.");
        return;
      }
    }

    setReconcileApplying(true);
    let successCount = 0;
    let failCount = 0;

    try {
      await Promise.all(
        Array.from(confirmedMatchIds).map(async (id) => {
          try {
            const targetStatus = matchedPaymentStatuses[id] || "Cleared";
            const resolvedAccId = specificDepositAccounts[id] || reconcileDefaultAccountId;
            
            const body: Record<string, string> = { chequeStatus: targetStatus };
            if (targetStatus === "Cleared" && resolvedAccId && resolvedAccId !== "__none") {
              body.depositAccountId = resolvedAccId;
            }

            const r = await fetch(`/api/payments/${id}/status`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(body),
            });

            if (!r.ok) throw new Error("Failed");
            successCount++;
          } catch {
            failCount++;
          }
        })
      );

      if (successCount > 0) {
        toast.success(`Successfully reconciled ${successCount} cheque(s).`);
      }
      if (failCount > 0) {
        toast.error(`Failed to reconcile ${failCount} cheque(s).`);
      }

      setIsReconcileOpen(false);
      setReconcileFile(null);
      setReconcileStep("upload");
      setExtractedTransactions([]);
      
      invalidatePaymentCaches();
      invalidateFinanceCaches();
      refetch();
    } catch (err) {
      toast.error("Reconciliation process failed.");
    } finally {
      setReconcileApplying(false);
    }
  };

  useEffect(() => {
    fetch("/api/finance/accounts?active=true")
      .then((r) => (r.ok ? r.json() : []))
      .then((data: any[]) =>
        setBankAccounts(
          data.filter((a) => {
            const type = (a.account_type || "").toLowerCase();
            return (
              type === "bank" ||
              type === "savings" ||
              type === "current" ||
              type === "cash" ||
              type === "cash on hand" ||
              type === "wallet"
            );
          })
        )
      )
      .catch(() => {});
  }, []);

  const cheques: ChequeRecord[] = useMemo(() => {
    const payments = rawPayments.filter(
      (p: any) => p.payment_method?.toLowerCase() === "cheque"
    );

    const groups = new Map<string, any[]>();
    const ungrouped: any[] = [];

    for (const p of payments) {
      const no = p.cheque_number?.trim();
      if (no) {
        if (!groups.has(no)) groups.set(no, []);
        groups.get(no)!.push(p);
      } else {
        ungrouped.push(p);
      }
    }

    const fromGroup = (items: any[]): ChequeRecord => {
      const first = items[0];
      return {
        ids: items.map((p) => p.id),
        paymentDate: first.payment_date,
        chequeDate: first.cheque_date ?? null,
        chequeNo: first.cheque_number ?? null,
        customerName: first.customers?.name || "Unknown",
        invoiceNos: items.map((p) => p.invoices?.invoice_no || "N/A"),
        bankName: first.banks?.bank_name ?? null,
        bankCode: first.banks?.bank_code ?? null,
        amount: items.reduce((s, p) => s + Number(p.amount), 0),
        chequeStatus: (first.cheque_status as ChequeStatus) || "Pending",
        depositAccountName: first.company_accounts?.account_name ?? null,
        depositAccountId: first.deposit_account_id ?? null,
      };
    };

    const grouped = Array.from(groups.values()).map(fromGroup);
    const singles = ungrouped.map((p) => fromGroup([p]));
    return [...grouped, ...singles];
  }, [rawPayments]);

  // ─── Matching algorithm for AI Reconciliation ──────────────────────────────
  const matchedReconciliation = useMemo(() => {
    if (extractedTransactions.length === 0) return { matched: [], unmatched: [] };

    const matched: any[] = [];
    const unmatched: any[] = [];

    // Copy system cheques that are Pending or Deposited
    const matchableCheques = cheques.filter(
      (c) => c.chequeStatus === "Pending" || c.chequeStatus === "Deposited"
    );

    const matchedSystemIds = new Set<string>();

    for (const tx of extractedTransactions) {
      let found: ChequeRecord | undefined;

      // Match strictly by Cheque Number AND Amount AND Date range (within 14 days)
      found = matchableCheques.find((c) => {
        if (c.ids.some(id => matchedSystemIds.has(id))) return false;

        const cleanSysNo = (c.chequeNo || "").trim().replace(/^0+/, "");
        const cleanTxNo = (tx.chequeNo || "").trim().replace(/^0+/, "");
        const isChqNoMatch = cleanSysNo && cleanTxNo && 
          (cleanSysNo === cleanTxNo || cleanSysNo.includes(cleanTxNo) || cleanTxNo.includes(cleanSysNo));
        if (!isChqNoMatch) return false;

        const isAmountMatch = Math.abs(c.amount - tx.amount) < 0.1;
        if (!isAmountMatch) return false;

        if (c.chequeDate && tx.date) {
          const sysDate = new Date(c.chequeDate).getTime();
          const txDate = new Date(tx.date).getTime();
          const daysDiff = Math.abs(sysDate - txDate) / (1000 * 60 * 60 * 24);
          return daysDiff <= 14;
        }

        return true;
      });

      if (found) {
        found.ids.forEach((id) => matchedSystemIds.add(id));
        matched.push({
          extracted: tx,
          system: found,
          suggestedStatus: tx.status || "Cleared",
        });
      } else {
        unmatched.push(tx);
      }
    }

    return { matched, unmatched };
  }, [extractedTransactions, cheques]);

  const applyFilters = (list: ChequeRecord[]) =>
    list.filter((c) => {
      if (search) {
        const q = search.toLowerCase();
        if (
          !c.customerName.toLowerCase().includes(q) &&
          !c.chequeNo?.toLowerCase().includes(q) &&
          !c.invoiceNos.some((inv) => inv.toLowerCase().includes(q)) &&
          !c.bankName?.toLowerCase().includes(q) &&
          !c.bankCode?.toLowerCase().includes(q)
        )
          return false;
      }
      const df = dateType === "cheque" ? c.chequeDate : c.paymentDate;
      if (dateFrom && df && df < dateFrom) return false;
      if (dateTo && df && df > dateTo) return false;
      return true;
    });

  const sortByDate = (list: ChequeRecord[]) =>
    [...list].sort((a, b) => {
      const da = a.chequeDate ? new Date(a.chequeDate).getTime() : (sortDir === "asc" ? Infinity : -Infinity);
      const db = b.chequeDate ? new Date(b.chequeDate).getTime() : (sortDir === "asc" ? Infinity : -Infinity);
      return sortDir === "asc" ? da - db : db - da;
    });

  const pending   = sortByDate(applyFilters(cheques.filter((c) => c.chequeStatus === "Pending")));
  const deposited = sortByDate(applyFilters(cheques.filter((c) => c.chequeStatus === "Deposited")));
  const cleared   = applyFilters(cheques.filter((c) => c.chequeStatus === "Cleared"));

  const totalPending   = pending.reduce((s, c) => s + c.amount, 0);
  const totalDeposited = deposited.reduce((s, c) => s + c.amount, 0);
  const totalCleared   = cleared.reduce((s, c) => s + c.amount, 0);

  const clearedPreview = useMemo(
    () => [...cleared].sort((a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime()).slice(0, 4),
    [cleared]
  );

  const historySorted = useMemo(
    () =>
      [...cheques]
        .sort((a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime())
        .filter((c) => {
          if (!historySearch) return true;
          const q = historySearch.toLowerCase();
          return (
            c.customerName.toLowerCase().includes(q) ||
            c.chequeNo?.toLowerCase().includes(q) ||
            c.invoiceNos.some((inv) => inv.toLowerCase().includes(q)) ||
            c.bankName?.toLowerCase().includes(q) ||
            c.bankCode?.toLowerCase().includes(q)
          );
        }),
    [cheques, historySearch]
  );

  const historyTotalPages = Math.max(1, Math.ceil(historySorted.length / HISTORY_PAGE_SIZE));
  const historyPageStart = (historyPage - 1) * HISTORY_PAGE_SIZE;
  const historyPageItems = historySorted.slice(historyPageStart, historyPageStart + HISTORY_PAGE_SIZE);
  const historyPageTotal = historyPageItems.reduce((s, c) => s + c.amount, 0);

  const openAction = (cheque: ChequeRecord, type: ActionType) => {
    setDepositAccountId("");
    setActionDialog({ cheque, type });
  };

  const updateStatus = async (ids: string[], status: ChequeStatus, accountId?: string) => {
    setUpdatingId(ids[0]);
    try {
      const body: Record<string, string> = { chequeStatus: status };
      if (accountId) body.depositAccountId = accountId;

      await Promise.all(
        ids.map((id) =>
          fetch(`/api/payments/${id}/status`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          }).then((r) => { if (!r.ok) throw new Error("Failed"); })
        )
      );
      toast.success(`Cheque marked as ${status}`);
      invalidatePaymentCaches();
      invalidateFinanceCaches();
      refetch();
    } catch {
      toast.error("Failed to update status");
    } finally {
      setUpdatingId(null);
    }
  };

  const handleConfirm = async () => {
    if (!actionDialog) return;
    const { cheque, type } = actionDialog;

    if (type === "deposit" && !depositAccountId) {
      toast.error("Please select a deposit account");
      return;
    }

    const statusMap: Record<ActionType, ChequeStatus> = {
      deposit: "Deposited",
      pass: "Cleared",
      return: "Returned",
    };

    setConfirming(true);
    setActionDialog(null);
    await updateStatus(
      cheque.ids,
      statusMap[type],
      type === "deposit" ? depositAccountId : undefined
    );
    setConfirming(false);
  };

  // ─── Bulk deposit handler ──────────────────────────────────────────────────
  const handleBulkDeposit = async () => {
    if (!bulkDepositAccId) return;
    setBulkConfirming(true);
    try {
      const selectedCheques = pending.filter((c) => selectedPendingKeys.has(c.ids[0]));
      await Promise.all(
        selectedCheques.flatMap((c) =>
          c.ids.map((id) =>
            fetch(`/api/payments/${id}/status`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ chequeStatus: "Deposited", depositAccountId: bulkDepositAccId }),
            }).then((r) => { if (!r.ok) throw new Error("Failed"); })
          )
        )
      );
      toast.success(`${selectedCheques.length} cheque(s) marked as Deposited`);
      setSelectedPendingKeys(new Set());
      setIsBulkDepositOpen(false);
      invalidatePaymentCaches();
      invalidateFinanceCaches();
      refetch();
    } catch {
      toast.error("Failed to deposit some cheques");
    } finally {
      setBulkConfirming(false);
    }
  };

  // ─── Bulk pass handler ─────────────────────────────────────────────────────
  const handleBulkPass = async () => {
    setBulkConfirming(true);
    try {
      const selectedCheques = deposited.filter((c) => selectedDepositedKeys.has(c.ids[0]));
      await Promise.all(
        selectedCheques.flatMap((c) =>
          c.ids.map((id) =>
            fetch(`/api/payments/${id}/status`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ chequeStatus: "Cleared" }),
            }).then((r) => { if (!r.ok) throw new Error("Failed"); })
          )
        )
      );
      toast.success(`${selectedCheques.length} cheque(s) cleared`);
      setSelectedDepositedKeys(new Set());
      setIsBulkPassOpen(false);
      invalidatePaymentCaches();
      invalidateFinanceCaches();
      refetch();
    } catch {
      toast.error("Failed to clear some cheques");
    } finally {
      setBulkConfirming(false);
    }
  };

  // ─── Bulk selection totals ─────────────────────────────────────────────────
  const selectedPendingCheques  = pending.filter((c) => selectedPendingKeys.has(c.ids[0]));
  const selectedDepositedCheques = deposited.filter((c) => selectedDepositedKeys.has(c.ids[0]));
  const bulkPendingTotal   = selectedPendingCheques.reduce((s, c) => s + c.amount, 0);
  const bulkDepositedTotal = selectedDepositedCheques.reduce((s, c) => s + c.amount, 0);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={cn("flex h-10 w-10 items-center justify-center rounded-lg", t.iconWrap)}>
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <h1 className={cn("text-3xl font-bold tracking-tight", t.header)}>Cheque Management</h1>
            <p className="text-muted-foreground text-sm">{portalName} — Track and clear customer cheques</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsReconcileOpen(true)}
            className="gap-2 border-indigo-200 text-indigo-700 hover:bg-indigo-50 dark:border-indigo-900/50 dark:text-indigo-400 dark:hover:bg-indigo-950/30"
          >
            <Sparkles className="h-4 w-4 text-indigo-500" />
            AI Reconciliation
          </Button>
          <Button variant="outline" size="sm" onClick={() => setIsHistoryOpen(true)} className="gap-2">
            <History className="h-4 w-4" />
            History
          </Button>
          <Button variant="outline" size="icon" onClick={refetch} disabled={loading}>
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          </Button>
        </div>
      </div>

      {/* Search + Date Filters */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search customer, cheque no, invoice, bank…"
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={dateType} onValueChange={(v) => setDateType(v as "cheque" | "payment")}>
            <SelectTrigger className="w-[145px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="cheque">Cheque Date</SelectItem>
              <SelectItem value="payment">Received Date</SelectItem>
            </SelectContent>
          </Select>
          <Input type="date" className="w-[148px]" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          <span className="text-muted-foreground text-sm shrink-0">to</span>
          <Input type="date" className="w-[148px]" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 shrink-0"
            onClick={() => setSortDir((d) => d === "asc" ? "desc" : "asc")}
            title="Toggle cheque date sort order"
          >
            <ArrowUpDown className="h-3.5 w-3.5" />
            {sortDir === "asc" ? "Earliest first" : "Latest first"}
          </Button>
          {(dateFrom || dateTo || search) && (
            <Button variant="ghost" size="sm" onClick={() => { setSearch(""); setDateFrom(""); setDateTo(""); }}>
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* Loading */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Pending */}
          <SectionColumn
            title="Pending"
            count={pending.length}
            total={totalPending}
            headerBg="bg-amber-50"
            headerText="text-amber-700"
            borderColor="border-amber-200"
            icon={Clock}
            empty="No pending cheques"
          >
            {/* Pending — selection bar */}
            {pending.length > 0 && (
              <div className="flex items-center justify-between px-0.5 pb-2 border-b border-amber-100 mb-1">
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={selectedPendingKeys.size === pending.length && pending.length > 0}
                    onCheckedChange={() => {
                      if (selectedPendingKeys.size === pending.length) {
                        setSelectedPendingKeys(new Set());
                      } else {
                        setSelectedPendingKeys(new Set(pending.map((c) => c.ids[0])));
                      }
                    }}
                    aria-label="Select all pending"
                  />
                  <span className="text-xs text-amber-600 font-medium">
                    {selectedPendingKeys.size > 0
                      ? `${selectedPendingKeys.size} selected · ${formatCurrency(bulkPendingTotal)}`
                      : "Select all"}
                  </span>
                </div>
                {selectedPendingKeys.size > 0 && (
                  <Button
                    size="sm"
                    className="h-6 text-[11px] bg-blue-600 hover:bg-blue-700 gap-1 px-2"
                    onClick={() => { setBulkDepositAccId(""); setIsBulkDepositOpen(true); }}
                  >
                    <Banknote className="h-3 w-3" />
                    Deposit ({selectedPendingKeys.size})
                  </Button>
                )}
              </div>
            )}
            {pending.map((c) => (
              <ChequeCard
                key={c.ids[0]}
                cheque={c}
                updatingId={updatingId}
                selected={selectedPendingKeys.has(c.ids[0])}
                onToggle={() => {
                  setSelectedPendingKeys((prev) => {
                    const next = new Set(prev);
                    next.has(c.ids[0]) ? next.delete(c.ids[0]) : next.add(c.ids[0]);
                    return next;
                  });
                }}
                actions={
                  <Button
                    size="sm"
                    className="h-7 text-xs w-full bg-blue-600 hover:bg-blue-700 gap-1"
                    onClick={() => openAction(c, "deposit")}
                  >
                    <Banknote className="h-3 w-3" />
                    Mark Deposited
                  </Button>
                }
              />
            ))}
          </SectionColumn>

          {/* Deposited */}
          <SectionColumn
            title="Deposited"
            count={deposited.length}
            total={totalDeposited}
            headerBg="bg-blue-50"
            headerText="text-blue-700"
            borderColor="border-blue-200"
            icon={Banknote}
            empty="No deposited cheques"
          >
            {/* Deposited — selection bar */}
            {deposited.length > 0 && (
              <div className="flex items-center justify-between px-0.5 pb-2 border-b border-blue-100 mb-1">
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={selectedDepositedKeys.size === deposited.length && deposited.length > 0}
                    onCheckedChange={() => {
                      if (selectedDepositedKeys.size === deposited.length) {
                        setSelectedDepositedKeys(new Set());
                      } else {
                        setSelectedDepositedKeys(new Set(deposited.map((c) => c.ids[0])));
                      }
                    }}
                    aria-label="Select all deposited"
                  />
                  <span className="text-xs text-blue-600 font-medium">
                    {selectedDepositedKeys.size > 0
                      ? `${selectedDepositedKeys.size} selected · ${formatCurrency(bulkDepositedTotal)}`
                      : "Select all"}
                  </span>
                </div>
                {selectedDepositedKeys.size > 0 && (
                  <Button
                    size="sm"
                    className="h-6 text-[11px] bg-green-600 hover:bg-green-700 gap-1 px-2"
                    onClick={() => setIsBulkPassOpen(true)}
                  >
                    <CheckCircle className="h-3 w-3" />
                    Pass ({selectedDepositedKeys.size})
                  </Button>
                )}
              </div>
            )}
            {deposited.map((c) => (
              <ChequeCard
                key={c.ids[0]}
                cheque={c}
                updatingId={updatingId}
                selected={selectedDepositedKeys.has(c.ids[0])}
                onToggle={() => {
                  setSelectedDepositedKeys((prev) => {
                    const next = new Set(prev);
                    next.has(c.ids[0]) ? next.delete(c.ids[0]) : next.add(c.ids[0]);
                    return next;
                  });
                }}
                actions={
                  <>
                    <Button
                      size="sm"
                      className="h-7 text-xs flex-1 bg-green-600 hover:bg-green-700 gap-1"
                      onClick={() => openAction(c, "pass")}
                    >
                      <CheckCircle className="h-3 w-3" />
                      Pass
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs flex-1 border-red-200 text-red-600 hover:bg-red-50 gap-1"
                      onClick={() => openAction(c, "return")}
                    >
                      <XCircle className="h-3 w-3" />
                      Return
                    </Button>
                  </>
                }
              />
            ))}
          </SectionColumn>

          {/* Cleared */}
          <SectionColumn
            title="Cleared"
            count={cleared.length}
            total={totalCleared}
            headerBg="bg-green-50"
            headerText="text-green-700"
            borderColor="border-green-200"
            icon={CheckCircle}
            empty="No cleared cheques"
          >
            {clearedPreview.map((c) => (
              <ChequeCard key={c.ids[0]} cheque={c} updatingId={updatingId} />
            ))}
            {cleared.length > 4 && (
              <button
                className="w-full text-xs text-green-700 font-medium hover:underline py-1"
                onClick={() => { setHistorySearch(""); setHistoryPage(1); setIsHistoryOpen(true); }}
              >
                + {cleared.length - 4} more — View All in History
              </button>
            )}
          </SectionColumn>
        </div>
      )}

      {/* Single Confirmation Dialog */}
      {actionDialog && (
        <ConfirmActionDialog
          dialog={actionDialog}
          bankAccounts={bankAccounts}
          depositAccountId={depositAccountId}
          setDepositAccountId={setDepositAccountId}
          onConfirm={handleConfirm}
          onClose={() => setActionDialog(null)}
          confirming={confirming}
        />
      )}

      {/* Bulk Deposit Dialog */}
      {isBulkDepositOpen && (
        <Dialog open onOpenChange={(open) => { if (!open) setIsBulkDepositOpen(false); }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Deposit {selectedPendingKeys.size} Cheques</DialogTitle>
              <DialogDescription>
                Select one deposit account for all selected cheques.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-1">
              {/* Selected cheques summary */}
              <div className="rounded-lg border bg-gray-50 p-3 space-y-1.5 max-h-44 overflow-y-auto">
                {selectedPendingCheques.map((c) => (
                  <div key={c.ids[0]} className="flex items-center justify-between gap-2 text-sm">
                    <span className="font-mono font-bold text-gray-700">#{c.chequeNo || "—"}</span>
                    <span className="text-gray-500 truncate flex-1 text-xs">{c.customerName}</span>
                    <span className="font-semibold text-gray-800 shrink-0">{formatCurrency(c.amount)}</span>
                  </div>
                ))}
                <div className="border-t border-gray-200 pt-1.5 flex justify-between font-bold text-sm">
                  <span className="text-gray-600">Total</span>
                  <span className="text-gray-900">{formatCurrency(bulkPendingTotal)}</span>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Deposit Account <span className="text-red-500">*</span></Label>
                <Select value={bulkDepositAccId} onValueChange={setBulkDepositAccId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select account…" />
                  </SelectTrigger>
                  <SelectContent>
                    {bankAccounts.length === 0 ? (
                      <SelectItem value="__none" disabled>No accounts found</SelectItem>
                    ) : (
                      bankAccounts.map((acc) => (
                        <SelectItem key={acc.id} value={acc.id}>
                          {acc.account_name}
                          {acc.account_type ? ` (${acc.account_type})` : ""}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsBulkDepositOpen(false)} disabled={bulkConfirming}>
                Cancel
              </Button>
              <Button
                className="bg-blue-600 hover:bg-blue-700"
                onClick={handleBulkDeposit}
                disabled={bulkConfirming || !bulkDepositAccId}
              >
                {bulkConfirming
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : `Deposit ${selectedPendingKeys.size} Cheques`}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Bulk Pass Dialog */}
      {isBulkPassOpen && (
        <Dialog open onOpenChange={(open) => { if (!open) setIsBulkPassOpen(false); }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Pass / Clear {selectedDepositedKeys.size} Cheques</DialogTitle>
              <DialogDescription>
                Confirm all selected cheques have cleared. Deposit account balances will be updated.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-1">
              <div className="rounded-lg border bg-gray-50 p-3 space-y-1.5 max-h-44 overflow-y-auto">
                {selectedDepositedCheques.map((c) => (
                  <div key={c.ids[0]} className="flex items-center justify-between gap-2 text-sm">
                    <span className="font-mono font-bold text-gray-700">#{c.chequeNo || "—"}</span>
                    <span className="text-gray-500 truncate flex-1 text-xs">{c.customerName}</span>
                    <span className="font-semibold text-gray-800 shrink-0">{formatCurrency(c.amount)}</span>
                  </div>
                ))}
                <div className="border-t border-gray-200 pt-1.5 flex justify-between font-bold text-sm">
                  <span className="text-gray-600">Total</span>
                  <span className="text-green-700">{formatCurrency(bulkDepositedTotal)}</span>
                </div>
              </div>
              {selectedDepositedCheques.some((c) => c.depositAccountName) && (
                <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700">
                  Each cheque will be cleared to its assigned deposit account.
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsBulkPassOpen(false)} disabled={bulkConfirming}>
                Cancel
              </Button>
              <Button
                className="bg-green-600 hover:bg-green-700"
                onClick={handleBulkPass}
                disabled={bulkConfirming}
              >
                {bulkConfirming
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : `Confirm Pass ${selectedDepositedKeys.size} Cheques`}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* History Sheet */}
      <Sheet open={isHistoryOpen} onOpenChange={(open) => { setIsHistoryOpen(open); if (!open) { setHistorySearch(""); setHistoryPage(1); } }}>
        <SheetContent side="right" className="w-full sm:max-w-md flex flex-col">
          <SheetHeader className="shrink-0">
            <SheetTitle className="flex items-center gap-2">
              <History className="h-4 w-4" />
              Cheque History
            </SheetTitle>
            <SheetDescription>{portalName} — all {cheques.length} cheques</SheetDescription>
          </SheetHeader>

          {/* Status summary */}
          <div className="shrink-0 grid grid-cols-5 gap-1.5 py-3 border-b">
            {(["Pending", "Deposited", "Cleared", "Bounced", "Returned"] as ChequeStatus[]).map((s) => {
              const count = cheques.filter((c) => c.chequeStatus === s).length;
              const cfg = STATUS_CONFIG[s];
              const StatusIcon = cfg.icon;
              return (
                <div key={s} className={cn("rounded-lg border p-1.5 text-center", cfg.bg, cfg.border)}>
                  <StatusIcon className={cn("h-3 w-3 mx-auto mb-0.5", cfg.text)} />
                  <p className={cn("text-base font-bold tabular-nums", cfg.text)}>{count}</p>
                  <p className={cn("text-[9px] leading-tight", cfg.text)}>{cfg.label}</p>
                </div>
              );
            })}
          </div>

          {/* Search */}
          <div className="shrink-0 relative py-2">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search customer, cheque no, invoice, bank…"
              className="pl-8 h-8 text-sm"
              value={historySearch}
              onChange={(e) => { setHistorySearch(e.target.value); setHistoryPage(1); }}
            />
          </div>

          {/* Page info + total */}
          <div className="shrink-0 flex items-center justify-between text-xs text-muted-foreground pb-1 border-b">
            <span>
              {historySorted.length === 0
                ? "No results"
                : `Showing ${historyPageStart + 1}–${Math.min(historyPageStart + HISTORY_PAGE_SIZE, historySorted.length)} of ${historySorted.length}`}
            </span>
            <span className="font-semibold text-gray-700">
              Page total: {formatCurrency(historyPageTotal)}
            </span>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto py-2 space-y-2">
            {historyPageItems.map((c) => (
              <div key={c.ids[0]} className="rounded-lg border bg-white p-3 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-sm font-bold text-gray-800">#{c.chequeNo || "—"}</span>
                  <StatusBadge status={c.chequeStatus} />
                </div>
                <p className="text-sm font-medium text-gray-700">{c.customerName}</p>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{c.bankCode || "—"}</span>
                  <span className="font-bold text-gray-800">{formatCurrency(c.amount)}</span>
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Received: {formatDate(c.paymentDate)}</span>
                  <span>Cheque: {formatDate(c.chequeDate)}</span>
                </div>
                {c.depositAccountName && (
                  <p className="text-[10px] text-blue-600 font-medium">→ {c.depositAccountName}</p>
                )}
                <div className="flex items-center justify-between pt-0.5">
                  {c.invoiceNos.length > 1 ? (
                    <span className="font-mono text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5">
                      {c.invoiceNos.length} invoices
                    </span>
                  ) : (
                    <span className="font-mono text-[10px] text-gray-400 bg-gray-100 rounded px-1.5 py-0.5">
                      {c.invoiceNos[0] ?? "N/A"}
                    </span>
                  )}
                  {(c.chequeStatus === "Pending" || c.chequeStatus === "Deposited") && (
                    <div className="flex gap-1">
                      {c.chequeStatus === "Pending" && (
                        <Button
                          size="sm"
                          className="h-6 text-[10px] bg-blue-600 hover:bg-blue-700"
                          onClick={() => { setIsHistoryOpen(false); setTimeout(() => openAction(c, "deposit"), 150); }}
                        >
                          Deposit
                        </Button>
                      )}
                      {c.chequeStatus === "Deposited" && (
                        <>
                          <Button
                            size="sm"
                            className="h-6 text-[10px] bg-green-600 hover:bg-green-700"
                            onClick={() => { setIsHistoryOpen(false); setTimeout(() => openAction(c, "pass"), 150); }}
                          >
                            Pass
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-6 text-[10px] border-red-200 text-red-600 hover:bg-red-50"
                            onClick={() => { setIsHistoryOpen(false); setTimeout(() => openAction(c, "return"), 150); }}
                          >
                            Return
                          </Button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {historySorted.length === 0 && (
              <div className="flex flex-col items-center justify-center h-40 text-muted-foreground gap-2">
                <CreditCard className="h-8 w-8 opacity-20" />
                <p className="text-sm">{historySearch ? "No matching cheques" : "No cheques yet"}</p>
              </div>
            )}
          </div>

          {/* Pagination */}
          {historyTotalPages > 1 && (
            <div className="shrink-0 flex items-center justify-between gap-2 pt-2 border-t">
              <Button
                variant="outline"
                size="sm"
                className="gap-1"
                disabled={historyPage === 1}
                onClick={() => setHistoryPage((p) => p - 1)}
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Prev
              </Button>
              <span className="text-xs text-muted-foreground">
                Page {historyPage} / {historyTotalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="gap-1"
                disabled={historyPage === historyTotalPages}
                onClick={() => setHistoryPage((p) => p + 1)}
              >
                Next
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* AI Reconciliation Dialog */}
      <Dialog open={isReconcileOpen} onOpenChange={(open) => {
        if (!open && !reconcileLoading && !reconcileApplying) {
          setIsReconcileOpen(false);
          setReconcileFile(null);
          setReconcileStep("upload");
          setExtractedTransactions([]);
        }
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-6">
          <DialogHeader className="shrink-0 pb-2 border-b">
            <DialogTitle className="flex items-center gap-2 text-xl font-bold">
              <Sparkles className="h-5 w-5 text-indigo-500 animate-pulse" />
              AI Cheque Reconciliation
            </DialogTitle>
            <DialogDescription>
              Upload a bank statement PDF to automatically extract cheque transactions and match them with system records.
            </DialogDescription>
          </DialogHeader>

          {/* Step 1: Upload */}
          {reconcileStep === "upload" && (
            <div className="flex-1 overflow-y-auto py-6 space-y-6">
              {/* File Dropzone */}
              <div
                className={cn(
                  "border-2 border-dashed border-gray-200 rounded-xl p-8 text-center bg-gray-50/50 hover:bg-gray-50 transition-all cursor-pointer flex flex-col items-center justify-center min-h-[200px]",
                  reconcileFile && "border-indigo-300 bg-indigo-50/20"
                )}
                onClick={() => document.getElementById("reconcile-file-upload")?.click()}
              >
                <input
                  id="reconcile-file-upload"
                  type="file"
                  accept=".pdf"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null;
                    if (file) setReconcileFile(file);
                  }}
                />
                
                {reconcileFile ? (
                  <div className="space-y-3">
                    <div className="p-3 bg-indigo-100 text-indigo-600 rounded-full w-12 h-12 flex items-center justify-center mx-auto">
                      <FileText className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-800 truncate max-w-md mx-auto">{reconcileFile.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{(reconcileFile.size / 1024 / 1024).toFixed(2)} MB</p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs border-red-200 text-red-600 hover:bg-red-50"
                      onClick={(e) => {
                        e.stopPropagation();
                        setReconcileFile(null);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-1" />
                      Remove
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="p-3 bg-gray-100 text-gray-400 rounded-full w-12 h-12 flex items-center justify-center mx-auto">
                      <Upload className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-700">Click or drag bank statement PDF here</p>
                      <p className="text-xs text-muted-foreground mt-1">Supports PDF format up to 10MB</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Demo Mode Notice */}
              <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-4 flex gap-3">
                <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="text-xs text-amber-800 space-y-1">
                  <p className="font-semibold">Demo / Sandbox Mode Information</p>
                  <p className="leading-relaxed">
                    If your <code className="bg-amber-100 px-1 py-0.5 rounded font-mono">GEMINI_API_KEY</code> environment variable is not configured in <code className="bg-amber-100 px-1 py-0.5 rounded font-mono">.env.local</code>, the system automatically runs a database-backed simulator. The simulator extracts pending/deposited cheques from your system to show a realistic match result.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Loading */}
          {reconcileStep === "loading" && (
            <div className="flex-1 flex flex-col items-center justify-center py-12 space-y-4">
              <Loader2 className="h-10 w-10 animate-spin text-indigo-600" />
              <div className="text-center">
                <p className="text-sm font-medium text-gray-800">{reconcileLoadingStatus}</p>
                <p className="text-xs text-muted-foreground mt-1">This will only take a moment...</p>
              </div>
            </div>
          )}

          {/* Step 3: Results */}
          {reconcileStep === "results" && (
            <div className="flex-1 overflow-y-auto py-4 space-y-6 min-h-0">
              {/* Demo Mode Banner */}
              {isDemoMode && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 flex items-center gap-2 text-xs text-amber-800">
                  <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
                  <span><strong>Demo Mode Active:</strong> Showing simulated bank statement extraction matched with real database cheques.</span>
                </div>
              )}

              {/* Match Overview Stats */}
              <div className="grid grid-cols-3 gap-4">
                <div className="rounded-lg border p-3 bg-green-50/50 border-green-200 text-center">
                  <p className="text-xs text-green-600 font-medium">Matches Found</p>
                  <p className="text-2xl font-bold text-green-700 mt-1">{matchedReconciliation.matched.length}</p>
                </div>
                <div className="rounded-lg border p-3 bg-amber-50/50 border-amber-200 text-center">
                  <p className="text-xs text-amber-600 font-medium">Unmatched Statement Rows</p>
                  <p className="text-2xl font-bold text-amber-700 mt-1">{matchedReconciliation.unmatched.length}</p>
                </div>
                <div className="rounded-lg border p-3 bg-indigo-50/50 border-indigo-200 text-center">
                  <p className="text-xs text-indigo-600 font-medium">Auto-Confirmed</p>
                  <p className="text-2xl font-bold text-indigo-700 mt-1">{confirmedMatchIds.size}</p>
                </div>
              </div>

              {/* Default Deposit Account Selector (if there are matches) */}
              {matchedReconciliation.matched.length > 0 && (
                <div className="rounded-lg border bg-gray-50 p-4 space-y-2">
                  <Label className="text-xs font-bold text-gray-700">Default Deposit Account</Label>
                  <p className="text-xs text-muted-foreground">Select a default bank account to clear pending cheques into. Individual matches can be overridden.</p>
                  <Select value={reconcileDefaultAccountId} onValueChange={setReconcileDefaultAccountId}>
                    <SelectTrigger className="w-full bg-white">
                      <SelectValue placeholder="Select deposit account..." />
                    </SelectTrigger>
                    <SelectContent>
                      {bankAccounts.length === 0 ? (
                        <SelectItem value="__none" disabled>No active bank accounts</SelectItem>
                      ) : (
                        bankAccounts.map((acc) => (
                          <SelectItem key={acc.id} value={acc.id}>
                            {acc.account_name} {acc.account_type ? `(${acc.account_type})` : ""}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Matched Cheques List */}
              <div className="space-y-3">
                <h3 className="font-semibold text-sm text-gray-800 flex items-center gap-1.5">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  Matched Cheque Transactions ({matchedReconciliation.matched.length})
                </h3>
                
                {matchedReconciliation.matched.length === 0 ? (
                  <div className="border border-dashed rounded-lg p-6 text-center text-xs text-muted-foreground">
                    No matching pending or deposited cheques found in system.
                  </div>
                ) : (
                  <div className="border rounded-lg overflow-hidden divide-y bg-white">
                    {matchedReconciliation.matched.map((m, index) => {
                      const sysRecord = m.system as ChequeRecord;
                      const tx = m.extracted;
                      const isSelected = sysRecord.ids.some(id => confirmedMatchIds.has(id));
                      const primaryId = sysRecord.ids[0];
                      const currentStatus = sysRecord.chequeStatus;
                      const targetStatus = matchedPaymentStatuses[primaryId] || "Cleared";

                      const needsAccount = currentStatus === "Pending" && targetStatus === "Cleared";

                      return (
                        <div key={index} className={cn("p-4 transition-colors", !isSelected && "bg-gray-50/40 opacity-70")}>
                          <div className="flex items-start gap-3 justify-between">
                            <div className="mt-1">
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={(checked) => {
                                  setConfirmedMatchIds((prev) => {
                                    const next = new Set(prev);
                                    if (checked) {
                                      sysRecord.ids.forEach(id => next.add(id));
                                    } else {
                                      sysRecord.ids.forEach(id => next.delete(id));
                                    }
                                    return next;
                                  });
                                }}
                              />
                            </div>

                            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                              {/* Left: Statement Transaction */}
                              <div className="space-y-1">
                                <p className="font-bold text-gray-500 uppercase tracking-wide text-[10px]">Statement Transaction</p>
                                <p className="font-mono font-semibold text-gray-800 flex items-center gap-1">
                                  #{tx.chequeNo || "Unknown"}
                                  <span className={cn(
                                    "px-1.5 py-0.5 rounded text-[10px] font-bold",
                                    tx.status === "Returned" ? "bg-red-50 text-red-700 border border-red-100" : "bg-green-50 text-green-700 border border-green-100"
                                  )}>
                                    {tx.status || "Cleared"}
                                  </span>
                                </p>
                                <p className="text-gray-600 italic">"{tx.description}"</p>
                                <p className="text-muted-foreground">Amount: <span className="font-bold text-gray-800">{formatCurrency(tx.amount)}</span> · Date: {formatDate(tx.date)}</p>
                              </div>

                              {/* Right: Database Match */}
                              <div className="space-y-1 border-t md:border-t-0 md:border-l border-gray-100 md:pl-4">
                                <p className="font-bold text-indigo-500 uppercase tracking-wide text-[10px]">Database Cheque Match</p>
                                <p className="font-semibold text-gray-800 truncate">{sysRecord.customerName}</p>
                                <p className="text-muted-foreground flex justify-between">
                                  <span>Amount: <span className="font-bold text-gray-800">{formatCurrency(sysRecord.amount)}</span></span>
                                  <span>Date: {formatDate(sysRecord.chequeDate)}</span>
                                </p>
                                <p className="text-muted-foreground">
                                  Current Status: <StatusBadge status={currentStatus} />
                                </p>
                              </div>
                            </div>
                          </div>

                          {isSelected && (
                            <div className="mt-3 pt-3 border-t border-gray-100 flex flex-wrap items-center gap-4 justify-end text-xs">
                              <div className="flex items-center gap-2">
                                <Label className="text-xs text-muted-foreground">Reconcile Status:</Label>
                                <Select
                                  value={targetStatus}
                                  onValueChange={(val) => {
                                    setMatchedPaymentStatuses((prev) => ({
                                      ...prev,
                                      ...sysRecord.ids.reduce((a, id) => ({ ...a, [id]: val }), {}),
                                    }));
                                  }}
                                >
                                  <SelectTrigger className="h-7 w-[110px] bg-white text-xs py-0">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="Cleared" className="text-xs">Cleared</SelectItem>
                                    <SelectItem value="Returned" className="text-xs">Returned</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>

                              {needsAccount && (
                                <div className="flex items-center gap-2">
                                  <Label className="text-xs text-muted-foreground">Deposit Account:</Label>
                                  <Select
                                    value={specificDepositAccounts[primaryId] || reconcileDefaultAccountId}
                                    onValueChange={(val) => {
                                      setSpecificDepositAccounts((prev) => ({
                                        ...prev,
                                        ...sysRecord.ids.reduce((a, id) => ({ ...a, [id]: val }), {}),
                                      }));
                                    }}
                                  >
                                    <SelectTrigger className="h-7 w-[180px] bg-white text-xs py-0">
                                      <SelectValue placeholder="Use default account..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {bankAccounts.map((acc) => (
                                        <SelectItem key={acc.id} value={acc.id} className="text-xs">
                                          {acc.account_name}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Unmatched Statement Transactions */}
              <div className="space-y-3">
                <h3 className="font-semibold text-sm text-gray-800 flex items-center gap-1.5">
                  <AlertCircle className="h-4 w-4 text-amber-500" />
                  Unmatched Statement Transactions ({matchedReconciliation.unmatched.length})
                </h3>
                
                {matchedReconciliation.unmatched.length === 0 ? (
                  <div className="border border-dashed rounded-lg p-4 text-center text-xs text-muted-foreground">
                    All transactions in the statement were successfully matched with system cheques.
                  </div>
                ) : (
                  <div className="border rounded-lg divide-y bg-white overflow-hidden text-xs">
                    {matchedReconciliation.unmatched.map((tx, index) => (
                      <div key={index} className="p-3 flex justify-between items-start bg-gray-50/30 gap-4">
                        <div className="space-y-0.5">
                          <p className="font-mono font-semibold text-gray-700 flex items-center gap-1.5">
                            #{tx.chequeNo || "No Cheque No"}
                            <span className={cn(
                              "px-1.5 py-0.2 rounded text-[9px] font-bold border",
                              tx.status === "Returned" ? "bg-red-50 text-red-700 border-red-100" : "bg-green-50 text-green-700 border-green-100"
                            )}>
                              {tx.status}
                            </span>
                          </p>
                          <p className="text-muted-foreground italic text-[11px]">"{tx.description}"</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-bold text-gray-800">{formatCurrency(tx.amount)}</p>
                          <p className="text-muted-foreground text-[10px]">{formatDate(tx.date)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Footer */}
          <DialogFooter className="shrink-0 pt-4 border-t gap-2">
            {reconcileStep === "upload" && (
              <>
                <Button variant="outline" onClick={() => setIsReconcileOpen(false)}>Cancel</Button>
                <Button
                  className="bg-indigo-600 hover:bg-indigo-700 gap-1.5"
                  onClick={handleProcessStatement}
                  disabled={!reconcileFile || reconcileLoading}
                >
                  <Sparkles className="h-4 w-4" />
                  Process Statement
                </Button>
              </>
            )}

            {reconcileStep === "loading" && (
              <Button variant="outline" disabled>Processing...</Button>
            )}

            {reconcileStep === "results" && (
              <>
                <Button
                  variant="outline"
                  onClick={() => {
                    setReconcileStep("upload");
                    setExtractedTransactions([]);
                  }}
                  disabled={reconcileApplying}
                >
                  Back
                </Button>
                <Button
                  className="bg-green-600 hover:bg-green-700 gap-1.5"
                  onClick={handleApplyReconciliation}
                  disabled={confirmedMatchIds.size === 0 || reconcileApplying}
                >
                  {reconcileApplying ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Applying...
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4" />
                      Apply Reconciliation ({confirmedMatchIds.size})
                    </>
                  )}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
