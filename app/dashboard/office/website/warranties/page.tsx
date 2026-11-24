"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Pencil, Trash2, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { webApi } from "../_components/api";
import type { WebBrand } from "../_components/types";
import { QUICK_PERIODS, brandLabel, type WarrantyPreset } from "../_components/WarrantyCard";

type Row = WarrantyPreset & { productCount?: number };
const emptyForm: WarrantyPreset = { id: "", name: "", period: "", brandId: null, terms: "" };

export default function WarrantiesPage() {
  const [items, setItems] = useState<Row[]>([]);
  const [brands, setBrands] = useState<WebBrand[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<WarrantyPreset | null>(null);
  const [saving, setSaving] = useState(false);
  const [brandFilter, setBrandFilter] = useState("all");

  const load = () =>
    webApi<{ presets: Row[] }>("/api/website/warranties")
      .then((r) => setItems(r.presets || []))
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));

  useEffect(() => {
    load();
    webApi<WebBrand[]>("/api/website/brands").then(setBrands).catch(() => {});
  }, []);

  const brandOptions = useMemo(() => {
    const byName = (a: WebBrand, b: WebBrand) => a.name.localeCompare(b.name);
    const out: { id: string; label: string }[] = [];
    for (const m of brands.filter((b) => !b.parentId).sort(byName)) {
      out.push({ id: m.id, label: m.name });
      for (const s of brands.filter((b) => b.parentId === m.id).sort(byName)) out.push({ id: s.id, label: `${m.name} › ${s.name}` });
    }
    return out;
  }, [brands]);

  const persist = async (next: WarrantyPreset[], msg: string) => {
    setSaving(true);
    try {
      const strip = next.map(({ id, name, period, brandId, terms }) => ({ id, name, period, brandId, terms }));
      const r = await webApi<{ productsUpdated: number }>("/api/website/warranties", { method: "POST", json: { presets: strip } });
      toast.success(r.productsUpdated ? `${msg} · ${r.productsUpdated} product(s) updated` : msg);
      setForm(null);
      load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const save = () => {
    if (!form) return;
    const row = { ...form, name: form.name.trim(), period: form.period.trim(), terms: form.terms.trim() };
    const next = form.id
      ? items.map((p) => (p.id === form.id ? row : p))
      : [...items, { ...row, id: crypto.randomUUID() }];
    persist(next, "Warranty saved");
  };

  const remove = (p: Row) => {
    if (!confirm(`Delete "${p.name || p.period}"? Products already using it keep their warranty.`)) return;
    persist(items.filter((x) => x.id !== p.id), "Warranty deleted");
  };

  const shown = items
    .filter((p) => brandFilter === "all" || (brandFilter === "none" ? !p.brandId : p.brandId === brandFilter))
    .sort((a, b) => (brandLabel(brands, a.brandId) || "~").localeCompare(brandLabel(brands, b.brandId) || "~") || (a.name || a.period).localeCompare(b.name || b.period));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Warranties</h2>
          <p className="text-muted-foreground text-sm">
            Warranty types with their terms, per brand or model (e.g. Orange Akoya – 5 years, Lifetime). Pick one on each product.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={brandFilter} onValueChange={setBrandFilter}>
            <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All brands</SelectItem>
              <SelectItem value="none">Any brand (general)</SelectItem>
              {brandOptions.map((b) => <SelectItem key={b.id} value={b.id}>{b.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button className="bg-teal-600 hover:bg-teal-700" onClick={() => setForm({ ...emptyForm, brandId: brandFilter !== "all" && brandFilter !== "none" ? brandFilter : null })}>
            <Plus className="h-4 w-4 mr-1" /> New Warranty
          </Button>
        </div>
      </div>

      <Card className="divide-y">
        {loading && <div className="p-6"><Loader2 className="h-5 w-5 animate-spin" /></div>}
        {!loading && shown.length === 0 && (
          <div className="p-10 text-center text-muted-foreground">
            <ShieldCheck className="h-8 w-8 mx-auto mb-2 opacity-50" />
            No warranties yet. Add one like “Lifetime”, “5 years” or “2 years” with its terms.
          </div>
        )}
        {shown.map((p) => (
          <div key={p.id} className="flex items-start gap-3 p-3">
            <ShieldCheck className="h-5 w-5 text-teal-600 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-medium">
                {p.name || p.period} {p.name && <span className="text-muted-foreground font-normal">· {p.period}</span>}
              </p>
              <p className="text-xs text-muted-foreground">
                {brandLabel(brands, p.brandId) || "Any brand"} · {p.productCount ?? 0} products
              </p>
              {p.terms && <p className="text-xs text-muted-foreground mt-1 line-clamp-2 whitespace-pre-line">{p.terms}</p>}
            </div>
            {!p.terms && <Badge variant="secondary">No terms</Badge>}
            <Button size="icon" variant="ghost" onClick={() => setForm({ ...p })}><Pencil className="h-4 w-4" /></Button>
            <Button size="icon" variant="ghost" disabled={saving} onClick={() => remove(p)}><Trash2 className="h-4 w-4 text-red-600" /></Button>
          </div>
        ))}
      </Card>

      <Dialog open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{form?.id ? "Edit Warranty" : "New Warranty"}</DialogTitle></DialogHeader>
          {form && (
            <div className="space-y-4">
              <div className="space-y-1">
                <Label>Name</Label>
                <Input value={form.name} maxLength={80} placeholder="e.g. Orange Akoya – 5 Year Warranty" onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>Warranty period *</Label>
                  <Input value={form.period} maxLength={60} placeholder="e.g. 5 years" onChange={(e) => setForm({ ...form, period: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label>Brand / model</Label>
                  <Select value={form.brandId ?? "none"} onValueChange={(v) => setForm({ ...form, brandId: v === "none" ? null : v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— Any brand —</SelectItem>
                      {brandOptions.map((b) => <SelectItem key={b.id} value={b.id}>{b.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex flex-wrap gap-1">
                {QUICK_PERIODS.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => setForm({ ...form, period: q })}
                    className={`text-[11px] rounded px-2 py-0.5 border ${form.period === q ? "border-teal-500 bg-teal-50 text-teal-800" : "hover:bg-muted"}`}
                  >
                    {q}
                  </button>
                ))}
              </div>
              <div className="space-y-1">
                <Label>Terms &amp; conditions</Label>
                <Textarea
                  rows={7}
                  maxLength={2000}
                  value={form.terms}
                  placeholder={"- Covers manufacturing defects only\n- Keep the bill / invoice for claims\n- Not covered: burns, wrong wiring, physical damage"}
                  onChange={(e) => setForm({ ...form, terms: e.target.value })}
                />
                <p className="text-[11px] text-muted-foreground">
                  Lines starting with “-” show as bullet points on the shop. Editing this updates every product using this warranty.
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setForm(null)}>Cancel</Button>
            <Button className="bg-teal-600 hover:bg-teal-700" onClick={save} disabled={saving || !form?.period.trim()}>
              {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />} Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
