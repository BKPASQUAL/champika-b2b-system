"use client";

import { useState, useEffect } from "react";
import { XCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { getUserBusinessContext } from "@/app/middleware/businessAuth";

interface Props {
  id: string;
  invoiceNo: string;
  orderStatus: string;
  onSuccess: () => void;
}

export function CancelInvoiceButton({ id, invoiceNo, orderStatus, onSuccess }: Props) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const user = getUserBusinessContext();
    setIsAdmin(user?.role === "admin");
  }, []);

  if (!isAdmin || orderStatus === "Cancelled") return null;

  const handleCancel = async () => {
    setLoading(true);
    try {
      const user = getUserBusinessContext();
      const res = await fetch(`/api/invoices/${id}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user?.id, reason }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to cancel invoice");
      }
      toast.success("Invoice cancelled and stock restored");
      onSuccess();
    } catch (error: any) {
      toast.error(error.message || "Failed to cancel invoice");
    } finally {
      setLoading(false);
      setOpen(false);
      setReason("");
    }
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="bg-background text-orange-600 border-orange-200 hover:bg-orange-50 hover:text-orange-700"
      >
        <XCircle className="w-4 h-4 sm:mr-2" />
        <span className="hidden sm:inline">Cancel Invoice</span>
      </Button>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-orange-600">
              <XCircle className="h-5 w-5" />
              Cancel Invoice {invoiceNo}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  This will mark the invoice as <strong>Cancelled</strong> and
                  reverse all stock deductions.
                </p>
                <p className="font-medium text-slate-700">The following will happen:</p>
                <ul className="list-disc list-inside text-sm space-y-1 text-slate-600">
                  <li>All items will be restocked back to inventory</li>
                  <li>Outstanding customer balance reduced by the unpaid amount</li>
                  <li>Existing payment records will be kept</li>
                  <li>Invoice status will be set to Cancelled</li>
                </ul>
                <div className="pt-2">
                  <label className="text-sm font-medium text-slate-700 block mb-1">
                    Reason for cancellation (optional)
                  </label>
                  <input
                    type="text"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="e.g. Customer request, damaged goods..."
                    className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                  />
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Back</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancel}
              disabled={loading}
              className="bg-orange-600 hover:bg-orange-700 focus:ring-orange-600"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Cancelling…
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <XCircle className="h-4 w-4" />
                  Yes, Cancel Invoice
                </span>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
