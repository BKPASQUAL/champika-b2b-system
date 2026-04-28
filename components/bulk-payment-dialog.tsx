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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { CheckCircle2, AlertCircle, Loader2, Package } from "lucide-react";

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface UnpaidPurchase {
  id: string;
  purchaseId: string;
  purchaseDate: string;
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

interface BulkPaymentDialogProps {
  open: boolean;
  onClose: () => void;
  purchases: UnpaidPurchase[];
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

// ─── Component ─────────────────────────────────────────────────────────────────

export default function BulkPaymentDialog({
  open,
  onClose,
  purchases,
  companyAccounts,
  businessId,
  onSuccess,
}: BulkPaymentDialogProps) {
  const totalBalance = purchases.reduce(
    (sum, p) => sum + (p.totalAmount - p.paidAmount),
    0,
  );

  const supplierName = purchases[0]?.supplierName ?? "";

  const [form, setForm] = useState({
    payment_date:       new Date().toISOString().split("T")[0],
    company_account_id: "",
    payment_method:     "cash",
    cheque_number:      "",
    cheque_date:        new Date().toISOString().split("T")[0],
    notes:              "",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [done,         setDone]         = useState(false);

  // Reset when dialog opens
  useEffect(() => {
    if (!open) return;
    setDone(false);
    const invoiceIds = purchases.map((p) => p.purchaseId).join(", ");
    setForm({
      payment_date:       new Date().toISOString().split("T")[0],
      company_account_id: "",
      payment_method:     "cash",
      cheque_number:      "",
      cheque_date:        new Date().toISOString().split("T")[0],
      notes:              `Bulk payment for ${invoiceIds}`,
    });
  }, [open, purchases]);

  const selectedAccount = companyAccounts.find(
    (a) => a.id === form.company_account_id,
  );

  const isOverdraft =
    selectedAccount &&
    form.payment_method !== "cheque" &&
    selectedAccount.current_balance < totalBalance;

  const canSubmit =
    form.company_account_id !== "" &&
    !isOverdraft &&
    (form.payment_method !== "cheque" || form.cheque_number.trim() !== "");

  const handleSubmit = async () => {
    if (!canSubmit || purchases.length === 0) return;
    setIsSubmitting(true);

    try {
      const results = await Promise.all(
        purchases.map((purchase) => {
          const due = purchase.totalAmount - purchase.paidAmount;
          return fetch("/api/suppliers/payments", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              purchaseId:   purchase.id,
              supplierId:   purchase.supplierId,
              accountId:    form.company_account_id,
              amount:       due,
              date:         form.payment_date,
              method:       form.payment_method,
              chequeNumber: form.payment_method === "cheque" ? form.cheque_number.trim() : undefined,
              chequeDate:   form.payment_method === "cheque" ? form.cheque_date : undefined,
              notes:        form.notes,
              businessId,
            }),
          });
        }),
      );

      const failed = results.filter((r) => !r.ok);
      if (failed.length > 0) {
        throw new Error(`${failed.length} payment(s) failed`);
      }

      toast.success(`${purchases.length} invoice(s) marked as paid!`);
      onSuccess();
      handleClose();
    } catch (err: any) {
      toast.error(err.message ?? "Error recording payments");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setDone(false);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-red-600" />
            Record Bulk Payment
          </DialogTitle>
          <DialogDescription>
            Record one payment covering <strong>{purchases.length}</strong>{" "}
            invoice(s) for <strong>{supplierName}</strong>
          </DialogDescription>
        </DialogHeader>

        {/* Invoice summary */}
        <div className="rounded-lg border border-red-200 bg-red-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2 border-b border-red-200">
            <div className="flex items-center gap-2 text-sm font-semibold text-red-900">
              <Package className="w-4 h-4" />
              Selected Invoices ({purchases.length})
            </div>
            <div className="text-sm font-bold text-red-900">
              Total Due: {formatCurrency(totalBalance)}
            </div>
          </div>
          <ScrollArea className="max-h-36">
            <div className="divide-y divide-red-100">
              {purchases.map((p) => {
                const due = p.totalAmount - p.paidAmount;
                return (
                  <div
                    key={p.id}
                    className="flex items-center justify-between px-4 py-2 text-sm"
                  >
                    <div>
                      <span className="font-mono text-xs bg-red-100 text-red-700 border border-red-200 px-1.5 py-0.5 rounded mr-2">
                        {p.purchaseId}
                      </span>
                      <span className="text-muted-foreground">
                        {new Date(p.purchaseDate).toLocaleDateString()}
                      </span>
                    </div>
                    <span className="font-medium text-destructive">
                      {formatCurrency(due)}
                    </span>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </div>

        <div className="space-y-4">
          {/* Payment Date */}
          <div className="space-y-1.5">
            <Label>Payment Date</Label>
            <Input
              type="date"
              value={form.payment_date}
              onChange={(e) => setForm((f) => ({ ...f, payment_date: e.target.value }))}
            />
          </div>

          {/* Payment Method */}
          <div className="space-y-1.5">
            <Label>Payment Method</Label>
            <Select
              value={form.payment_method}
              onValueChange={(v) => setForm((f) => ({ ...f, payment_method: v }))}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                <SelectItem value="cheque">Cheque</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {form.payment_method === "cheque" && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Cheque Number</Label>
                <Input
                  value={form.cheque_number}
                  onChange={(e) => setForm((f) => ({ ...f, cheque_number: e.target.value }))}
                  placeholder="From cheque book"
                  className="font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Cheque Date</Label>
                <Input
                  type="date"
                  value={form.cheque_date}
                  onChange={(e) => setForm((f) => ({ ...f, cheque_date: e.target.value }))}
                />
              </div>
            </div>
          )}

          {/* From Account */}
          <div className="space-y-1.5">
            <Label>From Account</Label>
            <Select
              value={form.company_account_id}
              onValueChange={(v) => setForm((f) => ({ ...f, company_account_id: v }))}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select account" />
              </SelectTrigger>
              <SelectContent>
                {companyAccounts.map((a) => (
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

          {/* Overdraft Warning */}
          {isOverdraft && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Insufficient Funds</AlertTitle>
              <AlertDescription>
                Account balance ({formatCurrency(selectedAccount!.current_balance)}) is
                less than the total due ({formatCurrency(totalBalance)}).
              </AlertDescription>
            </Alert>
          )}

          {/* Notes */}
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
        {done && (
          <div className="flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 px-4 py-3">
            <CheckCircle2 className="w-4 h-4 text-green-700 shrink-0" />
            <div className="text-sm text-green-800 font-semibold">
              {purchases.length} invoice(s) recorded as paid successfully!
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleClose}>
            {done ? "Close" : "Cancel"}
          </Button>
          {!done && (
            <Button
              onClick={handleSubmit}
              disabled={!canSubmit || isSubmitting}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Recording…
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Record Payment ({purchases.length} inv.) — {formatCurrency(totalBalance)}
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
