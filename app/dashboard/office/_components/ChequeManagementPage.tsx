"use client";

import React, { useState, useMemo, useEffect } from "react";
import { useCachedFetch, invalidatePaymentCaches } from "@/hooks/useCachedFetch";
import { getUserBusinessContext } from "@/app/middleware/businessAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
}: {
  cheque: ChequeRecord;
  actions?: React.ReactNode;
  updatingId: string | null;
}) {
  const isUpdating = cheque.ids.some((id) => updatingId === id);
  return (
    <div className={cn("rounded-lg border bg-white p-3 space-y-2 transition-all", isUpdating && "opacity-60")}>
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-sm font-bold text-gray-800">#{cheque.chequeNo || "—"}</span>
        <span className="text-sm font-bold text-gray-900">{formatCurrency(cheque.amount)}</span>
      </div>
      <p className="text-sm font-medium text-gray-700 truncate">{cheque.customerName}</p>
      <div className="text-xs text-muted-foreground space-y-0.5">
        <p>{cheque.bankCode ? `${cheque.bankCode}${cheque.bankName ? ` – ${cheque.bankName}` : ""}` : "No bank"}</p>
        <div className="flex justify-between items-start gap-1">
          <span>Cheque: {formatDate(cheque.chequeDate)}</span>
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
        {cheque.depositAccountName && (
          <p className="text-[10px] text-blue-600 font-medium">→ {cheque.depositAccountName}</p>
        )}
      </div>
      {actions && (
        <div className="flex gap-1.5 pt-1">
          {isUpdating ? (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" /> Updating…
            </div>
          ) : actions}
        </div>
      )}
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

type ThemeColor = "purple" | "red" | "blue" | "orange";

const THEME: Record<ThemeColor, { header: string; iconWrap: string }> = {
  purple: { header: "text-purple-900", iconWrap: "bg-purple-100 text-purple-600" },
  red:    { header: "text-red-900",    iconWrap: "bg-red-100 text-red-600" },
  blue:   { header: "text-blue-900",   iconWrap: "bg-blue-100 text-blue-600" },
  orange: { header: "text-orange-900", iconWrap: "bg-orange-100 text-orange-600" },
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
  defaultBusinessId: string;
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

  const [businessId, setBusinessId] = useState<string>(defaultBusinessId);

  useEffect(() => {
    const user = getUserBusinessContext();
    setBusinessId(user?.businessId ?? defaultBusinessId);
  }, [defaultBusinessId]);

  const { data: rawPayments = [], loading, refetch } = useCachedFetch<any[]>(
    `/api/payments?businessId=${businessId}`,
    [],
    () => toast.error("Failed to load payments")
  );

  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [dateType, setDateType] = useState<"cheque" | "payment">("cheque");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  const [historySearch, setHistorySearch] = useState("");
  const [historyPage, setHistoryPage] = useState(1);
  const HISTORY_PAGE_SIZE = 10;

  const [actionDialog, setActionDialog] = useState<ActionDialog | null>(null);
  const [depositAccountId, setDepositAccountId] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);

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

    // Group by chequeNo (non-empty); ungrouped (null/empty) stay separate
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

  const pending   = applyFilters(cheques.filter((c) => c.chequeStatus === "Pending"));
  const deposited = applyFilters(cheques.filter((c) => c.chequeStatus === "Deposited"));
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
            {pending.map((c) => (
              <ChequeCard key={c.ids[0]} cheque={c} updatingId={updatingId}
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
            {deposited.map((c) => (
              <ChequeCard key={c.ids[0]} cheque={c} updatingId={updatingId}
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

      {/* Confirmation Dialog */}
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
    </div>
  );
}
