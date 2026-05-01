"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Percent, AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

interface SelectionDiscountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedIds: string[];
  onSuccess: () => void;
}

function applyChain(base: number, d1: number, d2: number, d3: number) {
  return (
    Math.round(
      base * (1 - d1 / 100) * (1 - d2 / 100) * (1 - d3 / 100) * 100
    ) / 100
  );
}

function DiscountRow({
  label,
  ids,
  values,
  onChange,
}: {
  label: string;
  ids: [string, string, string];
  values: [number, number, number];
  onChange: (i: 0 | 1 | 2, v: number) => void;
}) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold">{label}</p>
      <div className="grid grid-cols-3 gap-2">
        {([0, 1, 2] as const).map((i) => (
          <div key={i} className="space-y-1">
            <Label htmlFor={ids[i]} className="text-xs text-muted-foreground">
              Discount {i + 1} (%)
            </Label>
            <Input
              id={ids[i]}
              type="number"
              step="0.5"
              min="0"
              max="100"
              value={values[i]}
              onChange={(e) => onChange(i, Number(e.target.value))}
              className={values[i] === 0 ? "text-muted-foreground" : ""}
            />
          </div>
        ))}
      </div>
      <p className="text-[11px] text-muted-foreground font-mono">
        = MRP × (1−{values[0]}%) × (1−{values[1]}%) × (1−{values[2]}%)
      </p>
    </div>
  );
}

export function SelectionDiscountDialog({
  open,
  onOpenChange,
  selectedIds,
  onSuccess,
}: SelectionDiscountDialogProps) {
  const [sd, setSd] = useState<[number, number, number]>([0, 0, 0]);
  const [cd, setCd] = useState<[number, number, number]>([0, 0, 0]);
  const [isLoading, setIsLoading] = useState(false);

  const PREVIEW_MRP = 1000;

  const previewSelling = applyChain(PREVIEW_MRP, sd[0], sd[1], sd[2]);
  const previewCost = applyChain(PREVIEW_MRP, cd[0], cd[1], cd[2]);

  const updateSd = (i: 0 | 1 | 2, v: number) =>
    setSd((prev) => { const n = [...prev] as [number, number, number]; n[i] = v; return n; });

  const updateCd = (i: 0 | 1 | 2, v: number) =>
    setCd((prev) => { const n = [...prev] as [number, number, number]; n[i] = v; return n; });

  const handleApply = async () => {
    const allZero = sd.every((v) => v === 0) && cd.every((v) => v === 0);
    if (allZero) {
      toast.error("Enter at least one discount percentage");
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch("/api/products/apply-discount", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productIds: selectedIds,
          sellingDiscounts: sd,
          costDiscounts: cd,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Update failed");

      toast.success(json.message);
      onOpenChange(false);
      setSd([0, 0, 0]);
      setCd([0, 0, 0]);
      onSuccess();
    } catch (err: any) {
      toast.error(err.message || "Failed to apply discount");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Percent className="h-5 w-5 text-purple-600" />
            Apply Discount to Selected
          </DialogTitle>
          <DialogDescription>
            Calculate new selling and cost prices from each product's{" "}
            <strong>MRP</strong> by applying up to 3 chained discounts for{" "}
            <strong>{selectedIds.length}</strong> selected product
            {selectedIds.length !== 1 ? "s" : ""}. Leave unused fields at 0.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* ── Selling discounts ── */}
          <DiscountRow
            label="Selling Price Discounts"
            ids={["sd1", "sd2", "sd3"]}
            values={sd}
            onChange={updateSd}
          />

          <div className="border-t" />

          {/* ── Cost discounts ── */}
          <DiscountRow
            label="Cost Price Discounts"
            ids={["cd1", "cd2", "cd3"]}
            values={cd}
            onChange={updateCd}
          />

          {/* ── Live Preview ── */}
          <div className="rounded-lg border p-3 space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Preview (if MRP = {PREVIEW_MRP.toLocaleString()})
            </p>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">New Selling Price</p>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-muted-foreground text-xs">MRP {PREVIEW_MRP.toLocaleString()}</span>
                  <span>→</span>
                  <Badge variant="secondary" className="font-mono text-green-700 bg-green-50">
                    {previewSelling.toLocaleString("en-LK", { minimumFractionDigits: 2 })}
                  </Badge>
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">New Cost Price</p>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-muted-foreground text-xs">MRP {PREVIEW_MRP.toLocaleString()}</span>
                  <span>→</span>
                  <Badge variant="secondary" className="font-mono text-blue-700 bg-blue-50">
                    {previewCost.toLocaleString("en-LK", { minimumFractionDigits: 2 })}
                  </Badge>
                </div>
              </div>
            </div>
          </div>

          {/* ── Warning ── */}
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <span>
              This will overwrite selling and cost prices for{" "}
              <strong>{selectedIds.length}</strong> product
              {selectedIds.length !== 1 ? "s" : ""}. Price history will be preserved.
            </span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            onClick={handleApply}
            disabled={isLoading || selectedIds.length === 0}
            className="bg-purple-600 hover:bg-purple-700"
          >
            {isLoading ? (
              <><Loader2 className="h-4 w-4 animate-spin mr-2" />Applying…</>
            ) : (
              `Apply to ${selectedIds.length} Product${selectedIds.length !== 1 ? "s" : ""}`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
