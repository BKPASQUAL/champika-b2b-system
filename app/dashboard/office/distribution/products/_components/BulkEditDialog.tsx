"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
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
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Product } from "../types";

type SettingRow = {
  id: string;
  name: string;
  parent_id?: string;
  category_id?: string;
  description?: string;
};

const KEEP = "__keep__";
const NONE = "__none__";

interface BulkEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  products: Product[]; // the selected products
  categories: { id: string; name: string; parent_id?: string }[];
  onSuccess: () => void;
}

// If every product has the same value, return it; otherwise null.
function commonValue(products: Product[], get: (p: Product) => string | undefined) {
  if (products.length === 0) return null;
  const first = (get(products[0]) || "").trim();
  return products.every((p) => (get(p) || "").trim() === first) ? first : null;
}

export function BulkEditDialog({
  open,
  onOpenChange,
  products,
  categories,
  onSuccess,
}: BulkEditDialogProps) {
  const [families, setFamilies] = useState<SettingRow[]>([]);
  const [packSizes, setPackSizes] = useState<SettingRow[]>([]);

  const [catChoice, setCatChoice] = useState(KEEP);
  const [subChoice, setSubChoice] = useState(KEEP);
  const [familyChoice, setFamilyChoice] = useState(KEEP);
  const [packChoice, setPackChoice] = useState(KEEP);
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState(0);

  // Load families & pack sizes when opened; reset choices
  useEffect(() => {
    if (!open) return;
    setCatChoice(KEEP);
    setSubChoice(KEEP);
    setFamilyChoice(KEEP);
    setPackChoice(KEEP);
    setProgress(0);
    const load = (type: string, set: (d: SettingRow[]) => void) =>
      fetch(`/api/settings/categories?type=${type}`)
        .then((r) => r.json())
        .then((d) => Array.isArray(d) && set(d))
        .catch(() => {});
    load("family", setFamilies);
    load("pack_size", setPackSizes);
  }, [open]);

  const commonCategory = useMemo(() => commonValue(products, (p) => p.category), [products]);
  const commonSub = useMemo(() => commonValue(products, (p) => p.subCategory), [products]);

  const catChanged = catChoice !== KEEP;
  const subChanged = subChoice !== KEEP;

  // Category / sub category the products will end up with
  const effectiveCategory = catChanged ? catChoice : commonCategory;
  const effectiveSub = subChanged ? (subChoice === NONE ? "" : subChoice) : catChanged ? "" : commonSub;

  const mainCategories = categories.filter((c) => !c.parent_id);
  const catId = mainCategories.find((c) => c.name === effectiveCategory)?.id;
  const subCategories = categories.filter((c) => c.parent_id && c.parent_id === catId);
  const subId = effectiveSub ? subCategories.find((c) => c.name === effectiveSub)?.id : undefined;

  const familyScopeId = subId || catId;
  const familyOptions = families.filter(
    (f) => !f.parent_id && familyScopeId && f.category_id === familyScopeId,
  );

  // Changing a parent clears the children unless you pick a new one
  const handleCategory = (val: string) => {
    setCatChoice(val);
    setSubChoice(val === KEEP ? KEEP : NONE);
    setFamilyChoice(val === KEEP ? KEEP : NONE);
  };
  const handleSub = (val: string) => {
    setSubChoice(val);
    setFamilyChoice(val === KEEP && !catChanged ? KEEP : NONE);
  };

  const subLocked = !catChanged && commonCategory === null; // mixed categories
  const familyLocked = !familyScopeId || (!catChanged && !subChanged && commonSub === null);

  const buildPayload = () => {
    const payload: Record<string, string> = {};
    if (catChanged) payload.category = catChoice;
    if (catChanged || subChanged) payload.subCategory = effectiveSub || "";
    if (catChanged || subChanged || familyChoice !== KEEP)
      payload.productFamily = familyChoice === KEEP || familyChoice === NONE ? "" : familyChoice;
    if (packChoice !== KEEP) payload.unitOfMeasure = packChoice;
    return payload;
  };

  const payload = buildPayload();
  const hasChanges = Object.keys(payload).length > 0;

  const handleApply = async () => {
    if (!hasChanges || products.length === 0) return;
    setSaving(true);
    setProgress(0);
    let ok = 0;
    let failed = 0;
    // Send in small groups so a big selection doesn't flood the server
    const BATCH = 10;
    for (let i = 0; i < products.length; i += BATCH) {
      const group = products.slice(i, i + BATCH);
      const results = await Promise.allSettled(
        group.map(async (p) => {
          const res = await fetch(`/api/products/${p.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          if (!res.ok) throw new Error();
        }),
      );
      results.forEach((r) => (r.status === "fulfilled" ? ok++ : failed++));
      setProgress(Math.min(i + BATCH, products.length));
    }
    setSaving(false);
    if (ok > 0) toast.success(`Updated ${ok} product${ok !== 1 ? "s" : ""}`);
    if (failed > 0) toast.error(`${failed} product${failed !== 1 ? "s" : ""} failed to update`);
    if (failed === 0) onOpenChange(false);
    onSuccess();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !saving && onOpenChange(o)}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bulk Edit — {products.length} product{products.length !== 1 ? "s" : ""}</DialogTitle>
          <DialogDescription>
            Pick only the fields you want to change. Fields left on &quot;Keep as is&quot; are not touched.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Category */}
          <div className="space-y-1.5">
            <Label>Category</Label>
            <Select value={catChoice} onValueChange={handleCategory} disabled={saving}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={KEEP}>
                  Keep as is{commonCategory ? ` (${commonCategory})` : " (mixed)"}
                </SelectItem>
                {mainCategories.map((c) => (
                  <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Sub Category */}
          <div className="space-y-1.5">
            <Label>Sub Category</Label>
            <Select value={subChoice} onValueChange={handleSub} disabled={saving || subLocked}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {!catChanged && (
                  <SelectItem value={KEEP}>
                    Keep as is{commonSub ? ` (${commonSub})` : commonSub === "" ? " (none)" : " (mixed)"}
                  </SelectItem>
                )}
                <SelectItem value={NONE}>None</SelectItem>
                {subCategories.map((c) => (
                  <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {subLocked && (
              <p className="text-xs text-amber-600">
                Selected products are in different categories — pick a Category first.
              </p>
            )}
          </div>

          {/* Product Family */}
          <div className="space-y-1.5">
            <Label>Product Family</Label>
            <Select value={familyChoice} onValueChange={setFamilyChoice} disabled={saving || familyLocked}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {!catChanged && !subChanged && <SelectItem value={KEEP}>Keep as is</SelectItem>}
                <SelectItem value={NONE}>None</SelectItem>
                {familyOptions.map((f) => (
                  <SelectItem key={f.id} value={f.name}>{f.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {familyLocked && (
              <p className="text-xs text-amber-600">
                Selected products are in different sub categories — pick a Category / Sub Category first.
              </p>
            )}
            {!familyLocked && familyOptions.length === 0 && (
              <p className="text-xs text-muted-foreground">
                No product families set up under {effectiveSub || effectiveCategory} yet.
              </p>
            )}
          </div>

          {/* Pack Size */}
          <div className="space-y-1.5">
            <Label>Pack Size (Unit)</Label>
            <Select value={packChoice} onValueChange={setPackChoice} disabled={saving}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={KEEP}>Keep as is</SelectItem>
                {!packSizes.some((p) => p.name.toLowerCase() === "pcs") && (
                  <SelectItem value="Pcs">Pcs (1 pc)</SelectItem>
                )}
                {packSizes.map((p) => (
                  <SelectItem key={p.id} value={p.name}>
                    {p.name}{p.description ? ` (${p.description} pcs)` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleApply} disabled={saving || !hasChanges}>
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving {progress}/{products.length}
              </>
            ) : (
              `Apply to ${products.length} product${products.length !== 1 ? "s" : ""}`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
