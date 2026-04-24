// app/dashboard/office/wireman/payments/_components/PaymentDialogs.tsx
"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Payment, ChequeStatus } from "../types";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { invalidatePaymentCaches } from "@/hooks/useCachedFetch";

interface PaymentDialogsProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  selectedPayment: Payment | null;
  onUpdate: () => void;
}

export function PaymentDialogs({
  isOpen,
  setIsOpen,
  selectedPayment,
  onUpdate,
}: PaymentDialogsProps) {
  const [status, setStatus] = useState<ChequeStatus>("Pending");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (selectedPayment && selectedPayment.chequeStatus) {
      setStatus(selectedPayment.chequeStatus);
    }
  }, [selectedPayment]);

  const handleSave = async () => {
    if (!selectedPayment) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/payments/${selectedPayment.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chequeStatus: status }),
      });

      if (!res.ok) throw new Error("Failed to update status");

      toast.success("Cheque status updated");
      invalidatePaymentCaches();
      onUpdate();
      setIsOpen(false);
    } catch (error) {
      toast.error("Error updating status");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Update Cheque Status</DialogTitle>
          <DialogDescription>
            Change the clearing status for Cheque #
            <span className="font-mono font-bold text-gray-900">
              {selectedPayment?.chequeNo}
            </span>
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label className="text-right">Amount</Label>
            <div className="col-span-3 font-bold">
              LKR {selectedPayment?.amount.toLocaleString()}
            </div>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="status" className="text-right">
              Status
            </Label>
            <Select
              value={status}
              onValueChange={(val) => setStatus(val as ChequeStatus)}
            >
              <SelectTrigger className="col-span-3">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Pending">Pending</SelectItem>
                <SelectItem value="Cleared">
                  Cleared (Funds Received)
                </SelectItem>
                <SelectItem value="Bounced">
                  Bounced (Insufficient Funds)
                </SelectItem>
                <SelectItem value="Returned">Returned</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={loading}
            className="bg-red-600 hover:bg-red-700"
          >
            {loading ? "Updating..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Payment View Dialog ───────────────────────────────────────────────────────
interface PaymentViewDialogProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  payment: Payment | null;
}

const CHEQUE_STATUS_STYLES: Record<string, string> = {
  Pending: "bg-amber-100 text-amber-700 border-amber-200",
  Cleared: "bg-green-100 text-green-700 border-green-200",
  Bounced: "bg-red-100 text-red-700 border-red-200",
  Returned: "bg-gray-100 text-gray-700 border-gray-200",
};

export function PaymentViewDialog({ isOpen, setIsOpen, payment }: PaymentViewDialogProps) {
  if (!payment) return null;

  const isCheque = payment.method?.toLowerCase() === "cheque";

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>Payment Details</DialogTitle>
          <DialogDescription>
            Invoice: <span className="font-mono font-bold text-gray-900">{payment.invoiceNo}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 py-2 text-sm">
          {payment.chequeStatus === "Returned" && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 flex items-center gap-2 text-sm text-red-700 font-medium">
              ⚠ This cheque was returned — the payment has been reversed and the invoice balance restored.
            </div>
          )}
          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-0.5">Customer</p>
              <p className="font-semibold">{payment.customerName}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-0.5">Amount</p>
              <p className={`font-bold ${payment.chequeStatus === "Returned" ? "line-through text-gray-400" : "text-gray-800"}`}>
                LKR {payment.amount.toLocaleString()}
              </p>
              {payment.chequeStatus === "Returned" && (
                <p className="text-xs text-red-500 font-medium">Reversed</p>
              )}
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-0.5">Payment Date</p>
              <p>{payment.date ? new Date(payment.date).toLocaleDateString() : "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-0.5">Method</p>
              <Badge variant="secondary" className="font-normal">{payment.method}</Badge>
            </div>
          </div>

          {isCheque && (
            <div className="mt-1 rounded-lg border border-blue-100 bg-blue-50 p-3 grid grid-cols-2 gap-x-4 gap-y-3">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-0.5">Cheque No</p>
                <p className="font-mono font-semibold text-blue-800">{payment.chequeNo || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-0.5">Cheque Date</p>
                <p className="font-semibold text-blue-800">
                  {payment.chequeDate ? new Date(payment.chequeDate).toLocaleDateString() : "—"}
                </p>
              </div>
              <div className="col-span-2">
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-1">Cheque Status</p>
                {payment.chequeStatus ? (
                  <Badge variant="outline" className={`border ${CHEQUE_STATUS_STYLES[payment.chequeStatus] || ""}`}>
                    {payment.chequeStatus}
                  </Badge>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
