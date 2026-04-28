"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import {
  Printer,
  CheckCircle2,
  RotateCcw,
  Pencil,
  RefreshCw,
  Package,
} from "lucide-react";
import { printCheque, amountToWords, type BankTemplate } from "@/app/lib/cheque-print";

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface UnpaidPurchase {
  id: string;
  purchaseId: string;
  purchaseDate: string;
  arrivalDate: string | null;
  totalAmount: number;
  paidAmount: number;
  paymentStatus: string;
  supplierId: string;
  supplierName: string;
}

export interface CompanyAccount {
  id: string;
  account_name: string;
  account_type: string;
  current_balance: number;
}

interface WriteMultiChequeDialogProps {
  open: boolean;
  onClose: () => void;
  purchases: UnpaidPurchase[];          // the selected invoices
  companyAccounts: CompanyAccount[];
  businessId: string;
  onSuccess: () => void;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

const formatCurrency = (n: number) =>
  new Intl.NumberFormat("en-LK", {
    style: "currency",
    currency: "LKR",
    minimumFractionDigits: 2,
  }).format(n);

type DateMode = "60" | "75" | "manual";

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

function formatDisplayDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-LK", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

// ─── Component ─────────────────────────────────────────────────────────────────

export default function WriteMultiChequeDialog({
  open,
  onClose,
  purchases,
  companyAccounts,
  businessId,
  onSuccess,
}: WriteMultiChequeDialogProps) {
  const totalBalance = purchases.reduce(
    (sum, p) => sum + (p.totalAmount - p.paidAmount),
    0,
  );

  // Supplier name — all selected must be the same supplier (enforced on the parent)
  const supplierName = purchases[0]?.supplierName ?? "";
  const supplierId   = purchases[0]?.supplierId   ?? "";

  const [form, setForm] = useState({
    amount:             "",
    cheque_date:        new Date().toISOString().split("T")[0],
    cheque_number:      "",
    company_account_id: "",
    bank_template:      "pan_asia" as BankTemplate,
    notes:              "",
  });

  const [dateMode,         setDateMode]         = useState<DateMode>("60");
  const [payeeAccountName, setPayeeAccountName] = useState("");
  const [isManualEntry,    setIsManualEntry]    = useState(false);
  const [saveToProfile,    setSaveToProfile]    = useState(false);
  const [loadingSupplier,  setLoadingSupplier]  = useState(false);
  const [acPayeeOnly,      setAcPayeeOnly]      = useState(true);
  const [isSubmitting,     setIsSubmitting]     = useState(false);
  const [savedChequeId,    setSavedChequeId]    = useState<string | null>(null);

  const payableAccounts = companyAccounts.filter((a) =>
    a.account_type.toLowerCase().includes("payable"),
  );
  const accountsToShow = payableAccounts.length > 0 ? payableAccounts : companyAccounts;

  // Reset & fetch supplier bank details when dialog opens
  useEffect(() => {
    if (!open || purchases.length === 0) return;

    setSavedChequeId(null);
    setIsManualEntry(false);
    setSaveToProfile(false);
    setPayeeAccountName("");
    setAcPayeeOnly(true);
    setDateMode("60");

    // Use the latest arrival date across all selected invoices as the base
    const latestBase = purchases.reduce((latest, p) => {
      const base = p.arrivalDate || p.purchaseDate;
      return base > latest ? base : latest;
    }, purchases[0].arrivalDate || purchases[0].purchaseDate);

    const invoiceIds = purchases.map((p) => p.purchaseId).join(", ");
    setForm({
      amount:             totalBalance.toFixed(2),
      cheque_date:        addDays(latestBase, 60),
      cheque_number:      "",
      company_account_id: "",
      bank_template:      "pan_asia" as BankTemplate,
      notes:              `Combined cheque for ${invoiceIds}`,
    });

    setLoadingSupplier(true);
    fetch(`/api/suppliers/${supplierId}`)
      .then((r) => r.json())
      .then((data: { supplier: { bankAccountName?: string; name?: string } }) => {
        const s = data.supplier;
        if (s?.bankAccountName) {
          setPayeeAccountName(s.bankAccountName ?? "");
          setIsManualEntry(false);
        } else {
          setIsManualEntry(true);
        }
      })
      .catch(() => setIsManualEntry(true))
      .finally(() => setLoadingSupplier(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, supplierId]);

  const latestBase = purchases.length > 0
    ? purchases.reduce((latest, p) => {
        const base = p.arrivalDate || p.purchaseDate;
        return base > latest ? base : latest;
      }, purchases[0].arrivalDate || purchases[0].purchaseDate)
    : new Date().toISOString().split("T")[0];

  const handleDateModeChange = (mode: DateMode) => {
    setDateMode(mode);
    if (mode !== "manual") {
      setForm((f) => ({ ...f, cheque_date: addDays(latestBase, parseInt(mode)) }));
    }
  };

  const parsedAmount    = parseFloat(form.amount) || 0;
  const selectedAccount = companyAccounts.find((a) => a.id === form.company_account_id);

  const canSubmit =
    parsedAmount > 0 &&
    form.cheque_date &&
    form.cheque_number.trim() !== "" &&
    form.company_account_id !== "";

  const doPrint = () => {
    if (!form.bank_template) return;
    printCheque(form.bank_template as BankTemplate, {
      payeeName:        supplierName,
      payeeAccountName: payeeAccountName.trim(),
      amount:           parsedAmount,
      chequeDate:       form.cheque_date,
      chequeNumber:     form.cheque_number.trim(),
      accountName:      selectedAccount?.account_name ?? "",
      acPayeeOnly,
    });
  };

  const handleSubmit = async () => {
    if (!canSubmit || purchases.length === 0) return;
    setIsSubmitting(true);

    try {
      // Submit one payment record per invoice, all sharing the same cheque number.
      // The API handles updating each purchase's paid_amount and payment_status.
      const results = await Promise.all(
        purchases.map((purchase) => {
          const invoiceBalance = purchase.totalAmount - purchase.paidAmount;
          return fetch("/api/suppliers/payments", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              purchaseId:   purchase.id,
              supplierId:   purchase.supplierId,
              accountId:    form.company_account_id,
              amount:       invoiceBalance,
              date:         form.cheque_date,
              method:       "cheque",
              chequeNumber: form.cheque_number.trim(),
              chequeDate:   form.cheque_date,
              notes:        form.notes,
              businessId,
            }),
          });
        }),
      );

      const failed = results.filter((r) => !r.ok);
      if (failed.length > 0) {
        throw new Error(`${failed.length} payment(s) failed to record`);
      }

      // Get the first payment ID for reference (for display only)
      const firstData = await results[0].json().catch(() => ({}));
      setSavedChequeId(firstData.id ?? "ok");

      // Optionally save bank details back to supplier profile
      if (saveToProfile && isManualEntry) {
        await fetch(`/api/suppliers/${supplierId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bankAccountName: payeeAccountName.trim() }),
        });
      }

      toast.success(`Cheque recorded for ${purchases.length} invoice(s) — printing now…`);
      onSuccess();
      doPrint();
    } catch (err: any) {
      toast.error(err.message ?? "Error recording combined cheque");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setSavedChequeId(null);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Printer className="w-5 h-5 text-amber-600" />
            Write Combined Cheque
          </DialogTitle>
          <DialogDescription>
            One cheque covering <strong>{purchases.length}</strong> invoice(s) for{" "}
            <strong>{supplierName}</strong>
          </DialogDescription>
        </DialogHeader>

        {/* Invoice summary */}
        <div className="rounded-lg border border-amber-200 bg-amber-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2 border-b border-amber-200">
            <div className="flex items-center gap-2 text-sm font-semibold text-amber-900">
              <Package className="w-4 h-4" />
              Selected Invoices ({purchases.length})
            </div>
            <div className="text-sm font-bold text-amber-900">
              Total: {formatCurrency(totalBalance)}
            </div>
          </div>
          <ScrollArea className="max-h-36">
            <div className="divide-y divide-amber-100">
              {purchases.map((p) => {
                const due = p.totalAmount - p.paidAmount;
                return (
                  <div key={p.id} className="flex items-center justify-between px-4 py-2 text-sm">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs bg-red-50 text-red-700 border border-red-100 px-1.5 py-0.5 rounded">
                          {p.purchaseId}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground flex gap-3">
                        <span>Inv: {new Date(p.purchaseDate).toLocaleDateString()}</span>
                        <span>Arrival: {p.arrivalDate ? new Date(p.arrivalDate).toLocaleDateString() : <span className="italic">Not set</span>}</span>
                      </div>
                    </div>
                    <span className="font-medium text-destructive">{formatCurrency(due)}</span>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </div>

        <div className="space-y-4">
          {/* ── Payee / Supplier bank details ─────────────────────────── */}
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                Pay To (Supplier Bank Details)
              </span>
              {!isManualEntry && !loadingSupplier && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 px-2 text-xs text-slate-500"
                  onClick={() => setIsManualEntry(true)}
                >
                  <Pencil className="w-3 h-3 mr-1" />
                  Edit
                </Button>
              )}
            </div>

            {loadingSupplier ? (
              <p className="text-xs text-muted-foreground">Loading supplier details…</p>
            ) : !isManualEntry ? (
              <div className="text-sm">
                <span className="text-xs text-muted-foreground block">Account Name</span>
                <span className="font-medium">{payeeAccountName || "—"}</span>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="space-y-1">
                  <Label className="text-xs">Account Name</Label>
                  <Input
                    value={payeeAccountName}
                    onChange={(e) => setPayeeAccountName(e.target.value)}
                    placeholder="Supplier account name"
                  />
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <Checkbox
                    id="multi-save-profile"
                    checked={saveToProfile}
                    onCheckedChange={(v) => setSaveToProfile(!!v)}
                  />
                  <label
                    htmlFor="multi-save-profile"
                    className="text-xs text-muted-foreground cursor-pointer"
                  >
                    Save to supplier profile for next time
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* ── Amount ──────────────────────────────────────────────────── */}
          <div className="space-y-1.5">
            <Label>Cheque Amount</Label>
            <div className="flex gap-2">
              <Input
                type="number"
                min="0"
                step="0.01"
                value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                placeholder="0.00"
                className="flex-1"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => setForm((f) => ({ ...f, amount: totalBalance.toFixed(2) }))}
                className="shrink-0 text-amber-700 border-amber-300 hover:bg-amber-50"
              >
                <RefreshCw className="w-3 h-3 mr-1" />
                Use Total
              </Button>
            </div>
            {parsedAmount > 0 && (
              <p className="text-xs text-muted-foreground italic">
                {amountToWords(parsedAmount)}
              </p>
            )}
          </div>

          {/* ── Cheque Date ─────────────────────────────────────────── */}
          <div className="space-y-1.5">
            <Label>Cheque Date</Label>
            <Select value={dateMode} onValueChange={(v) => handleDateModeChange(v as DateMode)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="60">60 days from latest arrival date</SelectItem>
                <SelectItem value="75">75 days from latest arrival date</SelectItem>
                <SelectItem value="manual">Manual entry</SelectItem>
              </SelectContent>
            </Select>
            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 flex justify-between text-xs">
              <span className="text-muted-foreground">Latest arrival date</span>
              <span className="font-medium">{formatDisplayDate(latestBase)}</span>
            </div>
            {dateMode === "manual" ? (
              <Input
                type="date"
                value={form.cheque_date}
                onChange={(e) => setForm((f) => ({ ...f, cheque_date: e.target.value }))}
              />
            ) : (
              <p className="text-xs text-muted-foreground">
                Latest arrival + {dateMode} days
                <span className="mx-1">→</span>
                <span className="font-medium text-foreground">
                  {form.cheque_date ? formatDisplayDate(form.cheque_date) : "—"}
                </span>
              </p>
            )}
          </div>

          {/* ── Cheque Number ────────────────────────────────────────── */}
          <div className="space-y-1.5">
            <Label>Cheque Number</Label>
            <Input
              value={form.cheque_number}
              onChange={(e) => setForm((f) => ({ ...f, cheque_number: e.target.value }))}
              placeholder="From cheque book"
              className="font-mono"
            />
          </div>

          {/* ── Pay From Account ─────────────────────────────────────────── */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>Pay From Account</Label>
              {payableAccounts.length > 0 && (
                <span className="text-xs text-amber-700 font-medium bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                  Accounts Payable
                </span>
              )}
            </div>
            <Select
              value={form.company_account_id}
              onValueChange={(v) => setForm((f) => ({ ...f, company_account_id: v }))}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select account" />
              </SelectTrigger>
              <SelectContent>
                {accountsToShow.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    <div className="flex flex-col">
                      <span>{a.account_name}</span>
                      <span className="text-xs text-muted-foreground">
                        {a.account_type} · {formatCurrency(a.current_balance)}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* ── A/C Payee Only ──────────────────────────────────────────── */}
          <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
            <Checkbox
              id="multi-ac-payee"
              checked={acPayeeOnly}
              onCheckedChange={(v) => setAcPayeeOnly(!!v)}
            />
            <label
              htmlFor="multi-ac-payee"
              className="text-sm font-medium cursor-pointer select-none"
            >
              Print <span className="font-semibold">A/C Payee Only</span> crossing
            </label>
            <span className="ml-auto text-xs text-muted-foreground">
              {acPayeeOnly ? "Two lines printed" : "No crossing"}
            </span>
          </div>

          {/* ── Notes ───────────────────────────────────────────────────── */}
          <div className="space-y-1.5">
            <Label>
              Notes <span className="text-muted-foreground text-xs">(optional)</span>
            </Label>
            <Input
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder="Payment notes"
            />
          </div>
        </div>

        <Separator />

        {/* Success state */}
        {savedChequeId && (
          <div className="flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 px-4 py-3">
            <CheckCircle2 className="w-4 h-4 text-green-700 shrink-0" />
            <div className="text-sm text-green-800">
              <span className="font-semibold">
                {purchases.length} invoice(s) marked as paid — cheque sent to printer.
              </span>{" "}
              <span className="text-green-700">
                Feed the cheque leaf into the rear slot — top edge first, pushed to the left. Add only your signature.
              </span>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleClose}>
            {savedChequeId ? "Close" : "Cancel"}
          </Button>

          {savedChequeId ? (
            <Button
              onClick={doPrint}
              variant="outline"
              className="text-amber-700 border-amber-300 hover:bg-amber-50"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Print Again
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={!canSubmit || isSubmitting}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              <Printer className="w-4 h-4 mr-2" />
              {isSubmitting ? "Saving..." : `Record & Print (${purchases.length} inv.)`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
