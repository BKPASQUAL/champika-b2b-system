"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { printCheque, type BankTemplate } from "@/app/lib/cheque-print";

export interface ReprintChequeData {
  payeeName: string;
  amount: number;
  chequeDate: string | null;
  chequeNumber: string | null;
  accountName: string;
}

interface ReprintChequeDialogProps {
  open: boolean;
  onClose: () => void;
  cheque: ReprintChequeData | null;
}

const formatCurrency = (n: number) =>
  new Intl.NumberFormat("en-LK", {
    style: "currency",
    currency: "LKR",
    minimumFractionDigits: 2,
  }).format(n);

export default function ReprintChequeDialog({
  open,
  onClose,
  cheque,
}: ReprintChequeDialogProps) {
  const bankTemplate: BankTemplate = "pan_asia";
  const [acPayeeOnly,  setAcPayeeOnly]  = useState(true);

  const handlePrint = () => {
    if (!cheque) return;
    printCheque(bankTemplate, {
      payeeName:    cheque.payeeName,
      amount:       cheque.amount,
      chequeDate:   cheque.chequeDate ?? new Date().toISOString().split("T")[0],
      chequeNumber: cheque.chequeNumber ?? "",
      accountName:  cheque.accountName,
      acPayeeOnly,
    });
  };

  const handleClose = () => {
    setAcPayeeOnly(true);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Printer className="w-5 h-5 text-amber-600" />
            Print Cheque
          </DialogTitle>
          {cheque && (
            <DialogDescription>
              {cheque.payeeName} · Cheque No. {cheque.chequeNumber} · {formatCurrency(cheque.amount)}
            </DialogDescription>
          )}
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
            <Checkbox
              id="ac-payee-reprint"
              checked={acPayeeOnly}
              onCheckedChange={(v) => setAcPayeeOnly(!!v)}
            />
            <label htmlFor="ac-payee-reprint" className="text-sm font-medium cursor-pointer select-none">
              Print <span className="font-semibold">A/C Payee Only</span> crossing
            </label>
            <span className="ml-auto text-xs text-muted-foreground">
              {acPayeeOnly ? "Two lines printed" : "No crossing"}
            </span>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            onClick={handlePrint}
            disabled={!cheque}
            className="bg-amber-600 hover:bg-amber-700 text-white"
          >
            <Printer className="w-4 h-4 mr-2" />
            Print
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
