"use client";

import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Loader2, Layers } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { webApi } from "../_components/api";
import type { WebCategory, WebFamily } from "../_components/types";

type Form = { id?: string; name: string; webCategoryId: string | null; description: string; sortOrder: number; isActive: boolean };
const emptyForm: Form = { name: "", webCategoryId: null, description: "", sortOrder: 0, isActive: true };

export default function ProductFamiliesPage() {
  const [items, setItems] = useState<WebFamily[]>([]);
  const [categories, setCategories] = useState<WebCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<Form | null>(null);
  const [saving, setSaving] = useState(false);

  const load = () =>
    webApi<WebFamily[]>("/api/website/families")
      .then(setItems)
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));

  useEffect(() => {
    load();
    webApi<WebCategory[]>("/api/website/categories").then(setCategories).catch(() => {});
  }, []);

  const catLabel = (c: WebCategory) => {
    const parent = categories.find((p) => p.id === c.parentId);
    return parent ? `${parent.name} › ${c.name}` : c.name;
  };

  const save = async () => {
    if (!form) return;
    setSaving(true);
    try {
      await webApi("/api/website/families", { method: "POST", json: form });
      toast.success("Family saved");
      setForm(null);
      load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (f: WebFamily) => {
    if (!confirm(`Delete "${f.name}"? Its ${f.productCount} products will have no family.`)) return;
    try {
      await webApi(`/api/website/families?id=${f.id}`, { method: "DELETE" });
      load();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Product Families</h2>
          <p className="text-muted-foreground text-sm">Groups inside a sub category, e.g. Cables & Wires › Single solid Cables.</p>
        </div>
        <Button className="bg-teal-600 hover:bg-teal-700" onClick={() => setForm({ ...emptyForm })}>
          <Plus className="h-4 w-4 mr-1" /> New Family
        </Button>
      </div>

      <Card className="divide-y">
        {loading && <div className="p-6"><Loader2 className="h-5 w-5 animate-spin" /></div>}
        {!loading && items.length === 0 && (
          <div className="p-10 text-center text-muted-foreground">
            <Layers className="h-8 w-8 mx-auto mb-2 opacity-50" />
            No families yet. You can also add them while editing a product.
          </div>
        )}
        {items.map((f) => (
          <div key={f.id} className="flex items-center gap-3 p-3">
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{f.name}</p>
              <p className="text-xs text-muted-foreground">
                {f.webCategoryName ? `in ${f.webCategoryName}` : "any category"} · {f.productCount} products
              </p>
            </div>
            {!f.isActive && <Badge variant="secondary">Hidden</Badge>}
            <Button size="icon" variant="ghost" onClick={() => setForm({ id: f.id, name: f.name, webCategoryId: f.webCategoryId, description: f.description || "", sortOrder: f.sortOrder, isActive: f.isActive })}>
              <Pencil className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="ghost" onClick={() => remove(f)}><Trash2 className="h-4 w-4 text-red-600" /></Button>
          </div>
        ))}
      </Card>

      <Dialog open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{form?.id ? "Edit Family" : "New Family"}</DialogTitle></DialogHeader>
          {form && (
            <div className="space-y-4">
              <div className="space-y-1">
                <Label>Name</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Single solid Cables" />
              </div>
              <div className="space-y-1">
                <Label>Belongs to (sub category)</Label>
                <Select value={form.webCategoryId ?? "none"} onValueChange={(v) => setForm({ ...form, webCategoryId: v === "none" ? null : v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Any category —</SelectItem>
                    {categories.map((c) => <SelectItem key={c.id} value={c.id}>{catLabel(c)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Description</Label>
                <Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4 items-end">
                <div className="space-y-1">
                  <Label>Sort order</Label>
                  <Input type="number" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })} />
                </div>
                <label className="flex items-center gap-2 text-sm pb-2">
                  <Switch checked={form.isActive} onCheckedChange={(v) => setForm({ ...form, isActive: v })} /> Show on website
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
    </div>
  );
}
