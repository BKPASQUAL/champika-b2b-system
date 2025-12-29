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
import { Loader2, Building2 } from "lucide-react";
import {
  Expense,
  ExpenseCategory,
  ExpenseFormData,
} from "@/app/dashboard/admin/expenses/types";
import { toast } from "sonner";
import { BUSINESS_IDS } from "@/app/config/business-constants";

interface ExpenseFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: ExpenseFormData) => Promise<void>;
  initialData?: Expense | null;
}

const CATEGORIES: ExpenseCategory[] = [
  "Fuel",
  "Maintenance",
  "Services",
  "Delivery",
  "Lunch",
  "Breakfast",
  "Dinner",
  "Guest",
  "Foods",
  "Other",
];

const PAYMENT_METHODS = ["Cash", "Card", "Transfer", "Cheque"];

export function ExpenseFormDialog({
  open,
  onOpenChange,
  onSubmit,
  initialData,
}: ExpenseFormDialogProps) {
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState<ExpenseFormData>({
    description: "",
    amount: "",
    category: "Fuel",
    expenseDate: new Date().toISOString().split("T")[0],
    paymentMethod: "Cash",
    referenceNo: "",
    loadId: "", // Not used in Orange
    businessId: BUSINESS_IDS.ORANGE_AGENCY, // Fixed to Orange Agency
  });

  useEffect(() => {
    if (initialData) {
      setFormData({
        description: initialData.description || "",
        amount: initialData.amount,
        category: initialData.category as ExpenseCategory,
        expenseDate: initialData.expenseDate,
        paymentMethod: initialData.paymentMethod,
        referenceNo: initialData.referenceNo || "",
        loadId: "",
        businessId: BUSINESS_IDS.ORANGE_AGENCY,
      });
    } else {
      // Reset form on open new
      setFormData({
        description: "",
        amount: "",
        category: "Fuel",
        expenseDate: new Date().toISOString().split("T")[0],
        paymentMethod: "Cash",
        referenceNo: "",
        loadId: "",
        businessId: BUSINESS_IDS.ORANGE_AGENCY,
      });
    }
  }, [initialData, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.amount) {
      toast.error("Please enter an amount");
      return;
    }

    setLoading(true);
    try {
      await onSubmit(formData);
      onOpenChange(false);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {initialData?.id
              ? "Edit Expense (Orange)"
              : "Add New Expense (Orange)"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          {/* Visual Indicator for Fixed Business */}
          <div className="bg-orange-50 border border-orange-100 rounded-md p-3 flex items-center text-orange-800 text-sm">
            <Building2 className="w-4 h-4 mr-2" />
            <span>
              Recording expense for <strong>Orange Agency</strong>
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Category</Label>
              <Select
                value={formData.category}
                onValueChange={(val) =>
                  setFormData({ ...formData, category: val as ExpenseCategory })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Amount (LKR)</Label>
              <Input
                type="number"
                value={formData.amount}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    amount: parseFloat(e.target.value) || "",
                  })
                }
                placeholder="0.00"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>
              Description{" "}
              <span className="text-muted-foreground font-normal">
                (Optional)
              </span>
            </Label>
            <Input
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              placeholder="e.g. Office supplies"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Date</Label>
              <Input
                type="date"
                value={formData.expenseDate}
                onChange={(e) =>
                  setFormData({ ...formData, expenseDate: e.target.value })
                }
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Payment Method</Label>
              <Select
                value={formData.paymentMethod}
                onValueChange={(val) =>
                  setFormData({ ...formData, paymentMethod: val })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((method) => (
                    <SelectItem key={method} value={method}>
                      {method}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Reference No. (Optional)</Label>
            <Input
              value={formData.referenceNo}
              onChange={(e) =>
                setFormData({ ...formData, referenceNo: e.target.value })
              }
              placeholder="e.g. Bill #559"
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="bg-orange-600 hover:bg-orange-700 text-white"
            >
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {initialData?.id ? "Save Changes" : "Add Expense"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
