"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, CreditCard, Banknote, Building2 } from "lucide-react";
import { toast } from "sonner";
import { getUserBusinessContext } from "@/app/middleware/businessAuth";

interface RecordPaymentDialogProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  invoice: any; // The selected invoice object
  onPaymentSuccess: () => void;
}

export function RecordPaymentDialog({
  isOpen,
  setIsOpen,
  invoice,
  onPaymentSuccess,
}: RecordPaymentDialogProps) {
  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState<any[]>([]);

  // Form State
  const [amount, setAmount] = useState<string>("");
  const [method, setMethod] = useState<string>("cash");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");

  // Method Specific State
  const [depositAccountId, setDepositAccountId] = useState<string>("");
  const [chequeNo, setChequeNo] = useState("");
  const [chequeDate, setChequeDate] = useState("");

  // 1. Fetch Company Accounts (for depositing Cash/Transfers)
  useEffect(() => {
    if (isOpen) {
      // Reset form when opening
      setAmount(invoice?.dueAmount?.toString() || "");
      setMethod("cash");
      setNotes("");
      setChequeNo("");
      setChequeDate("");

      const fetchAccounts = async () => {
        try {
          const user = getUserBusinessContext();
          const businessId = user?.businessId;

          // Fetch accounts linked to this business
          const res = await fetch(
            `/api/finance/accounts?businessId=${businessId}`
          );
          if (res.ok) {
            const data = await res.json();
            // Filter for accounts that can accept deposits (Cash/Bank)
            setAccounts(data.filter((a: any) => a.is_active));
          }
        } catch (error) {
          console.error("Failed to load accounts", error);
        }
      };
      fetchAccounts();
    }
  }, [isOpen, invoice]);

  const handleSubmit = async () => {
    if (!amount || Number(amount) <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }
    if (Number(amount) > invoice.dueAmount) {
      toast.error(`Amount exceeds due balance (LKR ${invoice.dueAmount})`);
      return;
    }
    if ((method === "cash" || method === "bank") && !depositAccountId) {
      toast.error("Please select a deposit account");
      return;
    }
    if (method === "cheque" && (!chequeNo || !chequeDate)) {
      toast.error("Cheque number and date are required");
      return;
    }

    setLoading(true);

    try {
      const payload = {
        orderId: invoice.orderId, // API requires orderId to link everything
        amount: Number(amount),
        date: date,
        method: method,
        notes: notes,
        depositAccountId:
          method === "cash" || method === "bank" ? depositAccountId : null,
        chequeNo: method === "cheque" ? chequeNo : null,
        chequeDate: method === "cheque" ? chequeDate : null,
      };

      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Payment failed");
      }

      toast.success("Payment recorded successfully!");
      onPaymentSuccess();
      setIsOpen(false);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  if (!invoice) return null;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Record Payment</DialogTitle>
          <div className="text-sm text-muted-foreground mt-1">
            Invoice:{" "}
            <span className="font-mono text-gray-900">{invoice.invoiceNo}</span>
            <br />
            Customer:{" "}
            <span className="font-medium text-gray-900">
              {invoice.customerName}
            </span>
          </div>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Amount & Date */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Amount (LKR) *</Label>
              <Input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                max={invoice.dueAmount}
              />
              <p className="text-[10px] text-red-600 font-medium text-right">
                Due: {invoice.dueAmount.toLocaleString()}
              </p>
            </div>
            <div className="space-y-2">
              <Label>Payment Date</Label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
          </div>

          {/* Payment Method */}
          <div className="space-y-2">
            <Label>Payment Method</Label>
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">
                  <div className="flex items-center">
                    <Banknote className="w-4 h-4 mr-2" /> Cash
                  </div>
                </SelectItem>
                <SelectItem value="cheque">
                  <div className="flex items-center">
                    <CreditCard className="w-4 h-4 mr-2" /> Cheque
                  </div>
                </SelectItem>
                <SelectItem value="bank">
                  <div className="flex items-center">
                    <Building2 className="w-4 h-4 mr-2" /> Bank Transfer
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Conditional Fields: Cheque Details */}
          {method === "cheque" && (
            <div className="grid grid-cols-2 gap-4 bg-slate-50 p-3 rounded-md border">
              <div className="space-y-2">
                <Label>Cheque No *</Label>
                <Input
                  placeholder="xxxxxx"
                  value={chequeNo}
                  onChange={(e) => setChequeNo(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Cheque Date *</Label>
                <Input
                  type="date"
                  value={chequeDate}
                  onChange={(e) => setChequeDate(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* Conditional Fields: Deposit Account (Cash/Bank) */}
          {(method === "cash" || method === "bank") && (
            <div className="space-y-2">
              <Label>Deposit To Account *</Label>
              <Select
                value={depositAccountId}
                onValueChange={setDepositAccountId}
              >
                <SelectTrigger className="bg-green-50 border-green-200">
                  <SelectValue placeholder="Select Company Account" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((acc) => (
                    <SelectItem key={acc.id} value={acc.id}>
                      {acc.bank_name} - {acc.account_number} ({acc.account_type}
                      )
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Notes */}
          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea
              placeholder="Any additional details..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="resize-none h-20"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={loading}
            className="bg-red-600 hover:bg-red-700"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              "Record Payment"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
