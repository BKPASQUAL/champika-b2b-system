"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Pencil, Trash2, Loader2, Tags, Wand2, Star } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { webApi } from "../_components/api";
import { ImageUploader } from "../_components/ImageUploader";
import type { WebBrand } from "../_components/types";

type Form = { id?: string; name: string; parentId: string | null; logoUrl: string | null; description: string; sortOrder: number; isFeatured: boolean; isActive: boolean };
const emptyForm: Form = { name: "", parentId: null, logoUrl: null, description: "", sortOrder: 0, isFeatured: true, isActive: true };

type Suggestion = { id: string; name: string; mainName: string | null; currentBrand: string | null; suggested: string | null };

export default function WebsiteBrandsPage() {
  const [items, setItems] = useState<WebBrand[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<Form | null>(null);
  const [saving, setSaving] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);

  const load = () =>
    webApi<WebBrand[]>("/api/website/brands")
      .then(setItems)
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));

  useEffect(() => {
    load();
  }, []);

  const toForm = (b: WebBrand): Form => ({
    id: b.id, name: b.name, parentId: b.parentId, logoUrl: b.logoUrl, description: b.description || "",
    sortOrder: b.sortOrder, isFeatured: b.isFeatured, isActive: b.isActive,
  });

  const save = async () => {
    if (!form) return;
    setSaving(true);
    try {
      await webApi("/api/website/brands", { method: "POST", json: form });
      toast.success("Brand saved");
      setForm(null);
      load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (b: WebBrand) => {
    if (!confirm(`Delete brand "${b.name}"? Its ${b.productCount} products will have no brand.`)) return;
    try {
      await webApi(`/api/website/brands?id=${b.id}`, { method: "DELETE" });
      load();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Brands</h2>
          <p className="text-muted-foreground text-sm">
            Each brand gets its own page on the shop and a logo in “Shop by Brand”. Every website product belongs to one brand.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setAssignOpen(true)}>
            <Wand2 className="h-4 w-4 mr-1" /> Auto-assign brands
          </Button>
          <Button className="bg-teal-600 hover:bg-teal-700" onClick={() => setForm({ ...emptyForm })}>
            <Plus className="h-4 w-4 mr-1" /> New Brand
          </Button>
        </div>
      </div>

      {loading && <Loader2 className="h-5 w-5 animate-spin" />}
      {!loading && items.length === 0 && (
        <Card className="p-10 text-center text-muted-foreground">
          <Tags className="h-8 w-8 mx-auto mb-2 opacity-50" />
          No brands yet. Click “Auto-assign brands” to create them from your website products.
        </Card>
      )}

      <div className="grid gap-4 grid-cols-2 md:grid-cols-3 xl:grid-cols-5">
        {items.filter((b) => !b.parentId).map((b) => (
          <Card key={b.id} className={`overflow-hidden ${b.isActive ? "" : "opacity-50"}`}>
            <div className="aspect-[3/2] bg-white border-b flex items-center justify-center p-4">
              {b.logoUrl ? (
                <img src={b.logoUrl} alt={b.name} className="max-h-full max-w-full object-contain" />
              ) : (
                <span className="text-2xl font-bold text-muted-foreground">{b.name}</span>
              )}
            </div>
            <div className="p-3 space-y-2">
              <div className="flex items-center gap-1">
                <p className="font-semibold truncate flex-1">{b.name}</p>
                {b.isFeatured && <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />}
              </div>
              <Link href={`/dashboard/office/website/products?brand=${b.id}`} className="text-xs text-muted-foreground">
                {b.productCount} products
              </Link>
              {!b.logoUrl && <Badge variant="secondary" className="ml-2 text-[10px]">no logo</Badge>}
              <div className="flex flex-wrap gap-1 pt-1">
                {items.filter((s) => s.parentId === b.id).map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setForm(toForm(s))}
                    className="inline-flex items-center gap-1.5 text-[11px] rounded-full border px-2 py-0.5 hover:bg-muted"
                    title={s.description ? `${s.name}: ${s.description}` : "Edit sub brand (image & description)"}
                  >
                    {s.logoUrl && (
                      <img src={s.logoUrl} alt="" className="h-3.5 w-3.5 rounded-full object-cover border" />
                    )}
                    <span>{s.name}</span>
                    <span className="text-muted-foreground">{s.productCount}</span>
                  </button>
                ))}
                <button
                  onClick={() => setForm({ ...emptyForm, parentId: b.id, isFeatured: false })}
                  className="text-[11px] rounded-full border border-dashed px-2 py-0.5 text-teal-700 hover:bg-teal-50"
                >
                  + sub brand
                </button>
              </div>
              <div className="flex justify-end">
                <Button size="icon" variant="ghost" onClick={() => setForm(toForm(b))}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" onClick={() => remove(b)}><Trash2 className="h-4 w-4 text-red-600" /></Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Dialog open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {form?.parentId ? (form.id ? "Edit Sub Brand" : "New Sub Brand") : form?.id ? "Edit Brand" : "New Brand"}
            </DialogTitle>
          </DialogHeader>
          {form && (
            <div className="space-y-4">
              <div className="space-y-1">
                <Label>Name</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={form.parentId ? "e.g. Fire Guard" : "e.g. ACL"} />
              </div>
              <div className="space-y-1">
                <Label>Sub brand of</Label>
                <Select
                  value={form.parentId ?? "none"}
                  onValueChange={(v) => setForm({ ...form, parentId: v === "none" ? null : v })}
                  disabled={!!form.id && items.some((s) => s.parentId === form.id)}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Main brand (not a sub brand) —</SelectItem>
                    {items.filter((b) => !b.parentId && b.id !== form.id).map((b) => (
                      <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>{form.parentId ? "Sub-brand / Range Image (shown in Compare Brands)" : "Brand Logo / Image"}</Label>
                <ImageUploader max={1} value={form.logoUrl ? [form.logoUrl] : []} onChange={(u) => setForm({ ...form, logoUrl: u[0] ?? null })} />
              </div>
              <div className="space-y-1">
                <Label>
                  {form.parentId
                    ? "About this sub-brand / range (shown when viewing range details in Compare Brands)"
                    : "About the brand (shown on brand page & Compare Brands details)"}
                </Label>
                <Textarea
                  rows={3}
                  placeholder={
                    form.parentId
                      ? "e.g. Premium frameless polycarbonate switches with fire-retardant housing and 10-year warranty…"
                      : "e.g. Leading Sri Lankan manufacturer of SLS-certified cables and electrical accessories…"
                  }
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-3 gap-4 items-end">
                <div className="space-y-1">
                  <Label>Sort order</Label>
                  <Input type="number" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })} />
                </div>
                <label className="flex items-center gap-2 text-sm pb-2">
                  <Switch checked={form.isFeatured} onCheckedChange={(v) => setForm({ ...form, isFeatured: v })} /> On home page
                </label>
                <label className="flex items-center gap-2 text-sm pb-2">
                  <Switch checked={form.isActive} onCheckedChange={(v) => setForm({ ...form, isActive: v })} /> Active
                </label>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setForm(null)}>Cancel</Button>
            <Button className="bg-teal-600 hover:bg-teal-700" onClick={save} disabled={saving || !form?.name.trim()}>
              {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />} Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AutoAssignDialog open={assignOpen} onOpenChange={setAssignOpen} onDone={load} />
    </div>
  );
}

function AutoAssignDialog({ open, onOpenChange, onDone }: { open: boolean; onOpenChange: (o: boolean) => void; onDone: () => void }) {
  const [rows, setRows] = useState<(Suggestion & { pick: string; on: boolean })[]>([]);
  const [onlyMissing, setOnlyMissing] = useState(true);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    webApi<Suggestion[]>(`/api/website/brands/assign${onlyMissing ? "?onlyMissing=1" : ""}`)
      .then((list) =>
        setRows(
          list.map((s) => ({
            ...s,
            pick: s.suggested || s.currentBrand || "",
            on: !!s.suggested && s.suggested !== s.currentBrand,
          })),
        ),
      )
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, [open, onlyMissing]);

  const chosen = rows.filter((r) => r.on && r.pick.trim());
  const newBrands = [...new Set(chosen.map((r) => r.pick.trim()))];

  const apply = async () => {
    setBusy(true);
    try {
      await webApi("/api/website/brands/assign", {
        method: "POST",
        json: { assignments: chosen.map((r) => ({ webProductId: r.id, brandName: r.pick.trim() })) },
      });
      toast.success(`Brand set on ${chosen.length} products`);
      onOpenChange(false);
      onDone();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[92vh] flex flex-col">
        <DialogHeader><DialogTitle>Auto-assign brands</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">
          The brand is read from the first word of each linked main product name (e.g. “Ruhunu 1/113mm…” → Ruhunu). Correct any
          wrong ones, untick rows to skip, then apply. Missing brands are created automatically.
        </p>
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={onlyMissing} onCheckedChange={setOnlyMissing} /> Only products without a brand
        </label>
        <div className="flex-1 min-h-[240px] overflow-y-auto border rounded-md divide-y">
          {loading && <div className="p-3"><Loader2 className="h-4 w-4 animate-spin" /></div>}
          {!loading && rows.length === 0 && <p className="p-4 text-sm text-muted-foreground">Nothing to assign.</p>}
          {rows.map((r, i) => (
            <div key={r.id} className="flex items-center gap-2 p-2 text-sm">
              <Checkbox checked={r.on} onCheckedChange={(v) => setRows(rows.map((x, j) => (j === i ? { ...x, on: !!v } : x)))} />
              <div className="flex-1 min-w-0">
                <p className="truncate">{r.name}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {r.mainName && r.mainName !== r.name ? `main: ${r.mainName} · ` : ""}now: {r.currentBrand || "none"}
                </p>
              </div>
              <Input
                className="h-8 w-40"
                value={r.pick}
                onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, pick: e.target.value, on: true } : x)))}
              />
            </div>
          ))}
        </div>
        <DialogFooter className="items-center">
          <span className="text-xs text-muted-foreground mr-auto">
            {chosen.length} products · brands: {newBrands.slice(0, 8).join(", ")}{newBrands.length > 8 ? "…" : ""}
          </span>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button className="bg-teal-600 hover:bg-teal-700" disabled={busy || chosen.length === 0} onClick={apply}>
            {busy && <Loader2 className="h-4 w-4 mr-1 animate-spin" />} Apply to {chosen.length}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
