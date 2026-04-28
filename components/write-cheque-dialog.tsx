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
import { toast } from "sonner";
import { Printer, RefreshCw, CheckCircle2, RotateCcw, Pencil } from "lucide-react";
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

interface SupplierBankDetails {
  bankAccountName: string | null;
  bankAccountNumber: string | null;
  bankName: string | null;
}

interface WriteChequeDialogProps {
  open: boolean;
  onClose: () => void;
  purchase: UnpaidPurchase | null;
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

type DateMode = "60" | "75" | "manual";

// ─── Component ─────────────────────────────────────────────────────────────────

export default function WriteChequeDialog({
  open,
  onClose,
  purchase,
  companyAccounts,
  businessId,
  onSuccess,
}: WriteChequeDialogProps) {
  const balanceDue = purchase ? purchase.totalAmount - purchase.paidAmount : 0;

  const [form, setForm] = useState({
    amount:             "",
    cheque_date:        new Date().toISOString().split("T")[0],
    cheque_number:      "",
    company_account_id: "",
    bank_template:      "pan_asia" as BankTemplate,
    notes:              "",
  });

  // Supplier bank detail fields
  const [payeeAccountName, setPayeeAccountName] = useState("");
  const [isManualEntry,    setIsManualEntry]    = useState(false);
  const [saveToProfile,      setSaveToProfile]       = useState(false);
  const [loadingSupplier,    setLoadingSupplier]     = useState(false);

  const [dateMode,        setDateMode]        = useState<DateMode>("60");
  const [acPayeeOnly,     setAcPayeeOnly]     = useState(true);
  const [isSubmitting,    setIsSubmitting]    = useState(false);
  const [savedPaymentId,  setSavedPaymentId]  = useState<string | null>(null);

  // Only show Accounts Payable accounts; fall back to all if none exist
  const payableAccounts = companyAccounts.filter((a) =>
    a.account_type.toLowerCase().includes("payable")
  );
  const accountsToShow = payableAccounts.length > 0 ? payableAccounts : companyAccounts;

  // Reset and fetch supplier bank details when a new purchase is selected
  useEffect(() => {
    if (!purchase || !open) return;

    setSavedPaymentId(null);
    setIsManualEntry(false);
    setSaveToProfile(false);
    setPayeeAccountName("");
    setAcPayeeOnly(true);
    setDateMode("60");
    const baseDate = purchase.arrivalDate || purchase.purchaseDate;
    setForm({
      amount:             (purchase.totalAmount - purchase.paidAmount).toFixed(2),
      cheque_date:        addDays(baseDate, 60),
      cheque_number:      "",
      company_account_id: "",
      bank_template:      "pan_asia" as BankTemplate,
      notes:              `Cheque payment for ${purchase.purchaseId}`,
    });

    // Fetch supplier bank details
    setLoadingSupplier(true);
    fetch(`/api/suppliers/${purchase.supplierId}`)
      .then((r) => r.json())
      .then((data: { supplier: SupplierBankDetails & { name: string } }) => {
        const s = data.supplier;
        if (s?.bankAccountName) {
          setPayeeAccountName(s.bankAccountName ?? "");
          setIsManualEntry(false);
        } else {
          // No bank details saved yet — start in manual mode
          setIsManualEntry(true);
        }
      })
      .catch(() => setIsManualEntry(true))
      .finally(() => setLoadingSupplier(false));
  }, [purchase, open]);

  const parsedAmount    = parseFloat(form.amount) || 0;
  const selectedAccount = companyAccounts.find((a) => a.id === form.company_account_id);

  const canSubmit =
    parsedAmount > 0 &&
    form.cheque_date &&
    form.cheque_number.trim() !== "" &&
    form.company_account_id !== "";

  const handleDateModeChange = (mode: DateMode) => {
    setDateMode(mode);
    if (mode !== "manual" && purchase) {
      const baseDate = purchase.arrivalDate || purchase.purchaseDate;
      setForm((f) => ({ ...f, cheque_date: addDays(baseDate, parseInt(mode)) }));
    }
  };

  const handleUseTotal = () =>
    setForm((f) => ({ ...f, amount: balanceDue.toFixed(2) }));

  const doPrint = () => {
    if (!purchase || !form.bank_template) return;
    printCheque(form.bank_template as BankTemplate, {
      payeeName:        purchase.supplierName,
      payeeAccountName: payeeAccountName.trim(),
      amount:           parsedAmount,
      chequeDate:       form.cheque_date,
      chequeNumber:     form.cheque_number.trim(),
      accountName:      selectedAccount?.account_name ?? "",
      acPayeeOnly,
    });
  };

  const handleSubmit = async () => {
    if (!purchase || !canSubmit) return;
    setIsSubmitting(true);

    try {
      // 1. Save cheque payment
      const res = await fetch("/api/suppliers/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          purchaseId:   purchase.id,
          supplierId:   purchase.supplierId,
          accountId:    form.company_account_id,
          amount:       parsedAmount,
          date:         form.cheque_date,
          method:       "cheque",
          chequeNumber: form.cheque_number.trim(),
          chequeDate:   form.cheque_date,
          notes:        form.notes,
          businessId,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Payment failed");
      }

      const data = await res.json();
      setSavedPaymentId(data.id);

      // 2. Optionally save bank details back to supplier profile
      if (saveToProfile && isManualEntry) {
        await fetch(`/api/suppliers/${purchase.supplierId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            bankAccountName: payeeAccountName.trim(),
          }),
        });
      }

      toast.success("Cheque recorded — printing now…");
      onSuccess();

      // 3. Auto-print
      doPrint();
    } catch (err: any) {
      toast.error(err.message ?? "Error recording cheque");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setSavedPaymentId(null);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Printer className="w-5 h-5 text-amber-600" />
            Write Cheque
          </DialogTitle>
          {purchase && (
            <DialogDescription>
              {purchase.supplierName} · {purchase.purchaseId}
            </DialogDescription>
          )}
        </DialogHeader>

        {/* Balance summary */}
        {purchase && (
          <div className="flex items-center justify-between rounded-lg bg-amber-50 border border-amber-200 px-4 py-3">
            <div className="text-sm text-amber-800">
              <span className="font-medium">Balance Due: </span>
              <span className="font-bold text-base">{formatCurrency(balanceDue)}</span>
            </div>
            <Badge variant="outline" className="text-amber-700 border-amber-300 bg-amber-50 capitalize">
              {purchase.paymentStatus}
            </Badge>
          </div>
        )}

        <div className="space-y-4 py-1">

          {/* ── Payee / Supplier bank details ─────────────────────── */}
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
              /* Auto-filled read-only display */
              <div className="text-sm">
                <span className="text-xs text-muted-foreground block">Account Name</span>
                <span className="font-medium">{payeeAccountName || "—"}</span>
              </div>
            ) : (
              /* Manual entry fields */
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
                    id="save-profile"
                    checked={saveToProfile}
                    onCheckedChange={(v) => setSaveToProfile(!!v)}
                  />
                  <label htmlFor="save-profile" className="text-xs text-muted-foreground cursor-pointer">
                    Save to supplier profile for next time
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* ── Amount ──────────────────────────────────────────────── */}
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
                onClick={handleUseTotal}
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
                <SelectItem value="60">60 days from invoice date</SelectItem>
                <SelectItem value="75">75 days from invoice date</SelectItem>
                <SelectItem value="manual">Manual entry</SelectItem>
              </SelectContent>
            </Select>
            {purchase && (
              <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Invoice Date</span>
                  <span className="font-medium">{formatDisplayDate(purchase.purchaseDate)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Arrival Date</span>
                  <span className="font-medium">
                    {purchase.arrivalDate ? formatDisplayDate(purchase.arrivalDate) : <span className="text-slate-400">Not set</span>}
                  </span>
                </div>
              </div>
            )}
            {dateMode === "manual" ? (
              <Input
                type="date"
                value={form.cheque_date}
                onChange={(e) => setForm((f) => ({ ...f, cheque_date: e.target.value }))}
              />
            ) : (
              <p className="text-xs text-muted-foreground">
                Arrival date + {dateMode} days
                <span className="mx-1">→</span>
                <span className="font-medium text-foreground">{form.cheque_date ? formatDisplayDate(form.cheque_date) : "—"}</span>
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

          {/* ── Pay From Account (Accounts Payable) ─────────────────── */}
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

          {/* ── A/C Payee Only ──────────────────────────────────────── */}
          <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
            <Checkbox
              id="ac-payee-only"
              checked={acPayeeOnly}
              onCheckedChange={(v) => setAcPayeeOnly(!!v)}
            />
            <label htmlFor="ac-payee-only" className="text-sm font-medium cursor-pointer select-none">
              Print <span className="font-semibold">A/C Payee Only</span> crossing
            </label>
            <span className="ml-auto text-xs text-muted-foreground">
              {acPayeeOnly ? "Two lines printed" : "No crossing"}
            </span>
          </div>

          {/* ── Notes ───────────────────────────────────────────────── */}
          <div className="space-y-1.5">
            <Label>Notes <span className="text-muted-foreground text-xs">(optional)</span></Label>
            <Input
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder="Payment notes"
            />
          </div>
        </div>

        <Separator />

        {/* Success state */}
        {savedPaymentId && (
          <div className="flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 px-4 py-3">
            <CheckCircle2 className="w-4 h-4 text-green-700 shrink-0" />
            <div className="text-sm text-green-800">
              <span className="font-semibold">Cheque recorded and sent to printer.</span>
              <span className="text-green-700"> Feed the cheque leaf into the rear slot — top edge first, pushed to the left. Add only your signature.</span>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleClose}>
            {savedPaymentId ? "Close" : "Cancel"}
          </Button>

          {savedPaymentId ? (
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
              {isSubmitting ? "Saving..." : "Record & Print"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
