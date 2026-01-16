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
