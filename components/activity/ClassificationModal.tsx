"use client";

import React, { useState } from "react";
import { Loader2, ClipboardList, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

// ─── Types ─────────────────────────────────────────────────────────────────────

export type ClassificationActionType =
  | "invoice_created"
  | "retail_invoice"
  | "distribution_invoice"
  | "rep_order"
  | "payment_made"
  | "agency_invoice";

interface QuestionDef {
  key: string;
  label: string;
  type: "select" | "text";
  options?: string[];
  required?: boolean;
}

interface ClassificationModalProps {
  isOpen: boolean;
  actionType: ClassificationActionType;
  activityRecordId: string | null;
  entityNo?: string;
  customerName?: string;
  amount?: number;
  onClose: () => void;
}

// ─── Question definitions per action type ─────────────────────────────────────

const QUESTIONS: Record<ClassificationActionType, QuestionDef[]> = {
  invoice_created: [
    {
      key: "sale_type",
      label: "What type of sale is this?",
      type: "select",
      options: ["Regular Sale", "Credit Sale", "Cash Sale", "Walk-in Sale", "Promotional Sale"],
      required: true,
    },
    {
      key: "discount_applied",
      label: "Was a special discount applied?",
      type: "select",
      options: ["No", "Yes — Regular Discount", "Yes — Special Negotiation"],
    },
    {
      key: "delivery_method",
      label: "Delivery method?",
      type: "select",
      options: ["Direct Delivery", "Customer Pickup", "Via Agent", "Courier"],
    },
  ],
  distribution_invoice: [
    {
      key: "distribution_type",
      label: "Distribution type?",
      type: "select",
      options: ["Regular Distribution", "Special Order", "Emergency Supply", "Return / Credit"],
      required: true,
    },
    {
      key: "credit_extended",
      label: "Was credit extended?",
      type: "select",
      options: ["No — Cash on Delivery", "Yes — 30 Days Credit", "Yes — 60 Days Credit", "Yes — Custom Terms"],
    },
    {
      key: "priority",
      label: "Priority level?",
      type: "select",
      options: ["Normal", "Urgent", "Scheduled"],
    },
    {
      key: "remarks",
      label: "Remarks (optional)",
      type: "text",
    },
  ],
  retail_invoice: [
    {
      key: "sale_category",
      label: "Type of retail sale?",
      type: "select",
      options: ["Regular Sale", "Bulk Purchase", "Walk-in", "Phone Order", "Online Order"],
      required: true,
    },
    {
      key: "payment_terms",
      label: "Payment terms agreed?",
      type: "select",
      options: ["Cash on Delivery", "Paid in Full", "Credit 30 Days", "Credit 60 Days", "Advance Paid"],
    },
    {
      key: "discount_reason",
      label: "Special discount reason (if any)",
      type: "text",
    },
  ],
  rep_order: [
    {
      key: "order_category",
      label: "Order category?",
      type: "select",
      options: ["New Customer Order", "Repeat Order", "Promotional Order", "Sample Order"],
      required: true,
    },
    {
      key: "visit_type",
      label: "Customer contact type?",
      type: "select",
      options: ["Scheduled Visit", "Walk-in", "Phone Order", "WhatsApp Order"],
    },
    {
      key: "payment_negotiated",
      label: "Payment type negotiated?",
      type: "select",
      options: ["Cash", "Credit", "Cheque", "Advance"],
    },
  ],
  payment_made: [
    {
      key: "payment_nature",
      label: "Nature of this payment?",
      type: "select",
      options: ["Full Settlement", "Partial Payment", "Advance Payment", "Credit Balance Usage"],
      required: true,
    },
    {
      key: "negotiation",
      label: "Was there any amount negotiation?",
      type: "select",
      options: ["No", "Yes — Minor Adjustment", "Yes — Significant Discount Given"],
    },
    {
      key: "collected_by",
      label: "Collected by (name/role)?",
      type: "text",
    },
    {
      key: "remarks",
      label: "Remarks (optional)",
      type: "text",
    },
  ],
  agency_invoice: [
    {
      key: "agency_type",
      label: "Agency distribution type?",
      type: "select",
      options: ["Regular Supply", "Special Order", "Urgent Dispatch", "Return Processing"],
      required: true,
    },
    {
      key: "credit_extended",
      label: "Was credit extended?",
      type: "select",
      options: ["No — Cash", "Yes — Standard Terms", "Yes — Extended Terms"],
    },
    {
      key: "remarks",
      label: "Remarks (optional)",
      type: "text",
    },
  ],
};

const ACTION_LABELS: Record<ClassificationActionType, string> = {
  invoice_created: "Invoice Created",
  distribution_invoice: "Distribution Invoice",
  retail_invoice: "Retail Invoice",
  rep_order: "Rep Order",
  payment_made: "Payment Made",
  agency_invoice: "Agency Invoice",
};

// ─── Component ─────────────────────────────────────────────────────────────────

export function ClassificationModal({
  isOpen,
  actionType,
  activityRecordId,
  entityNo,
  customerName,
  amount,
  onClose,
}: ClassificationModalProps) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const questions = QUESTIONS[actionType] ?? [];

  const handleAnswer = (key: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    // Validate required
    const missing = questions
      .filter((q) => q.required && !answers[q.key]?.trim())
      .map((q) => q.label);

    if (missing.length > 0) {
      toast.error(`Please answer: ${missing[0]}`);
      return;
    }

    if (!activityRecordId) {
      // No record ID yet — just close (record was already created server-side)
      toast.success("Classification saved!");
      setSaved(true);
      setTimeout(onClose, 800);
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/activity-records/${activityRecordId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ classification: answers }),
      });

      if (!res.ok) throw new Error("Failed to save classification");

      toast.success("Classification saved!");
      setSaved(true);
      setTimeout(onClose, 800);
    } catch {
      toast.error("Could not save classification. You can close and continue.");
    } finally {
      setSaving(false);
    }
  };

  const handleDismiss = () => {
    setAnswers({});
    setSaved(false);
    onClose();
  };

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat("en-LK", {
      style: "currency",
      currency: "LKR",
      minimumFractionDigits: 2,
    }).format(n);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleDismiss()}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-1">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
              {saved ? (
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              ) : (
                <ClipboardList className="h-5 w-5 text-primary" />
              )}
            </div>
            <div>
              <DialogTitle className="text-base">
                Classify this {ACTION_LABELS[actionType]}
              </DialogTitle>
              <DialogDescription className="text-xs mt-0.5">
                Help keep records organised — takes less than 30 seconds.
              </DialogDescription>
            </div>
          </div>

          {/* Context summary */}
          <div className="rounded-lg border bg-muted/40 px-4 py-2.5 mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm">
            {entityNo && (
              <span>
                <span className="text-muted-foreground">Ref: </span>
                <span className="font-mono font-medium">{entityNo}</span>
              </span>
            )}
            {customerName && (
              <span>
                <span className="text-muted-foreground">Customer: </span>
                <span className="font-medium">{customerName}</span>
              </span>
            )}
            {amount !== undefined && (
              <span>
                <span className="text-muted-foreground">Amount: </span>
                <span className="font-medium text-primary">
                  {formatCurrency(amount)}
                </span>
              </span>
            )}
          </div>
        </DialogHeader>

        {/* Questions */}
        <div className="space-y-4 py-2">
          {questions.map((q) => (
            <div key={q.key} className="space-y-1.5">
              <Label className="text-sm font-medium">
                {q.label}
                {q.required && (
                  <span className="text-destructive ml-1">*</span>
                )}
              </Label>
              {q.type === "select" && q.options ? (
                <Select
                  value={answers[q.key] ?? ""}
                  onValueChange={(v) => handleAnswer(q.key, v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select an option…" />
                  </SelectTrigger>
                  <SelectContent>
                    {q.options.map((opt) => (
                      <SelectItem key={opt} value={opt}>
                        {opt}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  placeholder="Type here…"
                  value={answers[q.key] ?? ""}
                  onChange={(e) => handleAnswer(q.key, e.target.value)}
                />
              )}
            </div>
          ))}
        </div>

        <DialogFooter className="gap-2 sm:gap-2 flex-col sm:flex-row">
          <Button variant="ghost" onClick={handleDismiss} disabled={saving}>
            Skip for now
          </Button>
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving…
              </>
            ) : saved ? (
              <>
                <CheckCircle2 className="h-4 w-4" />
                Saved!
              </>
            ) : (
              <>
                <ClipboardList className="h-4 w-4" />
                Save Classification
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
