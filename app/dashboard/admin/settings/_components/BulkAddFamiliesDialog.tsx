"use client";

// Popup to add many Product Families to one sub category (or category) at once.

import React, { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Layers, Loader2, Plus, X } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

interface Item {
  id: string;
  name: string;
  parent_id?: string | null;
  category_id?: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Sub category (or category) to pre-select; null lets the user pick */
  scopeId: string | null;
  onCreated?: () => void;
}

const getJson = (url: string) =>
  fetch(url)
    .then((r) => (r.ok ? r.json() : []))
    .then((d) => (Array.isArray(d) ? d : []))
    .catch(() => []);

export function BulkAddFamiliesDialog({ open, onOpenChange, scopeId, onCreated }: Props) {
  const [loading, setLoading] = useState(false);
  const [cats, setCats] = useState<Item[]>([]);
  const [families, setFamilies] = useState<Item[]>([]);
  const [catId, setCatId] = useState("");
  const [subId, setSubId] = useState("");
  const [names, setNames] = useState<string[]>(["", "", ""]);
  const [saving, setSaving] = useState(false);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  // Load lists and pre-select the scope each time the popup opens
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [c, f] = await Promise.all([
        getJson("/api/settings/categories?type=category"),
        getJson("/api/settings/categories?type=family"),
      ]);
      if (cancelled) return;
      setCats(c);
      setFamilies(f);
      const scope = c.find((x: Item) => x.id === scopeId);
      if (scope?.parent_id) {
        setCatId(scope.parent_id);
        setSubId(scope.id);
      } else {
        setCatId(scope?.id || "");
        setSubId("");
      }
      setNames(["", "", ""]);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, scopeId]);

  const mainCats = useMemo(
    () => cats.filter((c) => !c.parent_id).sort((a, b) => a.name.localeCompare(b.name)),
    [cats],
  );
  const subCats = useMemo(
    () => cats.filter((c) => c.parent_id === catId).sort((a, b) => a.name.localeCompare(b.name)),
    [cats, catId],
  );

  // Families go on the sub category; only a category with no sub categories holds them directly
  const targetId = subId || (catId && subCats.length === 0 ? catId : "");
  const target = cats.find((c) => c.id === targetId);
  const existing = families.filter((f) => !f.parent_id && f.category_id === targetId);
  const existingLower = new Set(existing.map((f) => f.name.trim().toLowerCase()));

  const cleaned = Array.from(
    new Map(
      names
        .map((n) => n.trim())
        .filter(Boolean)
        .map((n) => [n.toLowerCase(), n] as const),
    ).values(),
  );
  const toAdd = cleaned.filter((n) => !existingLower.has(n.toLowerCase()));
  const alreadyThere = cleaned.length - toAdd.length;

  const setName = (i: number, v: string) =>
    setNames((ns) => ns.map((n, j) => (j === i ? v : n)));

  const addLine = (focus = true) => {
    setNames((ns) => [...ns, ""]);
    if (focus) setTimeout(() => inputs.current[names.length]?.focus(), 0);
  };

  const removeLine = (i: number) =>
    setNames((ns) => (ns.length === 1 ? [""] : ns.filter((_, j) => j !== i)));

  // Pasting several lines fills several rows
  const onPaste = (i: number, e: React.ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData("text");
    if (!/[\r\n]/.test(text)) return;
    e.preventDefault();
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    setNames((ns) => {
      const before = ns.slice(0, i);
      const after = ns.slice(i + 1).filter((n) => n.trim());
      return [...before, ...lines, ...after, ""];
    });
  };

  const save = async () => {
    if (!targetId) {
      toast.error(subCats.length ? "Choose a sub category" : "Choose a category");
      return;
    }
    if (toAdd.length === 0) {
      toast.error(alreadyThere ? "These families already exist" : "Type at least one family name");
      return;
    }
    setSaving(true);
    const failed: string[] = [];
    for (const name of toAdd) {
      const res = await fetch("/api/settings/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, type: "family", category_id: targetId }),
      }).catch(() => null);
      if (!res || !res.ok) failed.push(name);
    }
    setSaving(false);

    const ok = toAdd.length - failed.length;
    if (ok) onCreated?.();
    if (failed.length === 0) {
      toast.success(`${ok} product famil${ok === 1 ? "y" : "ies"} added to ${target?.name}`);
      onOpenChange(false);
    } else {
      toast.error(`${ok} added. Could not add: ${failed.join(", ")}`);
      setNames([...failed, ""]);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !saving && onOpenChange(o)}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-green-600" />
            Add Product Families
          </DialogTitle>
          <DialogDescription>
            Add several families to the same sub category in one go.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-7 w-7 animate-spin text-primary" />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-5 py-1 pr-1">
            {/* Where they go */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Category *</Label>
                <Select
                  value={catId}
                  onValueChange={(v) => {
                    setCatId(v);
                    setSubId("");
                  }}
                  disabled={saving}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {mainCats.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Sub Category {subCats.length > 0 && "*"}</Label>
                <Select
                  value={subId}
                  onValueChange={setSubId}
                  disabled={saving || !catId || subCats.length === 0}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue
                      placeholder={catId && subCats.length === 0 ? "No sub categories" : "Select sub category"}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {subCats.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Already there */}
            {targetId && existing.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground">
                  Already in {target?.name} ({existing.length}):
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {existing.map((f) => (
                    <span
                      key={f.id}
                      className="text-xs px-2 py-0.5 rounded-md bg-green-50 text-green-800 border border-green-200 dark:bg-green-950/30 dark:text-green-300 dark:border-green-900"
                    >
                      {f.name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* New names */}
            <div className="space-y-2">
              <Label className="text-xs">
                New family names{" "}
                <span className="text-muted-foreground font-normal">
                  (press Enter for the next line, or paste a list)
                </span>
              </Label>
              {names.map((n, i) => {
                const dup = n.trim() && existingLower.has(n.trim().toLowerCase());
                return (
                  <div key={i} className="flex items-center gap-2">
                    <span className="w-5 text-xs text-muted-foreground text-right">{i + 1}</span>
                    <Input
                      ref={(el) => {
                        inputs.current[i] = el;
                      }}
                      value={n}
                      onChange={(e) => setName(i, e.target.value)}
                      onPaste={(e) => onPaste(i, e)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          if (i === names.length - 1) addLine();
                          else inputs.current[i + 1]?.focus();
                        }
                      }}
                      placeholder={i === 0 ? "e.g. House Wire" : i === 1 ? "e.g. Flexible Cable" : "Family name"}
                      className={dup ? "border-amber-400 focus-visible:ring-amber-300" : ""}
                      disabled={saving}
                    />
                    <button
                      type="button"
                      onClick={() => removeLine(i)}
                      disabled={saving}
                      className="h-8 w-8 shrink-0 rounded flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-muted"
                      title="Remove line"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                );
              })}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => addLine()}
                disabled={saving}
                className="w-full border-dashed"
              >
                <Plus className="h-4 w-4 mr-1.5" />
                Add Line
              </Button>
              {alreadyThere > 0 && (
                <p className="text-xs text-amber-600">
                  {alreadyThere} name{alreadyThere > 1 ? "s are" : " is"} already in this sub category
                  and will be skipped.
                </p>
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button
            onClick={save}
            disabled={saving || loading || !targetId || toAdd.length === 0}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Adding...
              </>
            ) : (
              `Add ${toAdd.length || ""} Famil${toAdd.length === 1 ? "y" : "ies"}`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
