"use client";

import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Loader2, Truck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { webApi } from "../_components/api";
import type { WebSupplier } from "../_components/types";

type Form = { id?: string; name: string; phone: string; notes: string; isActive: boolean };
const emptyForm: Form = { name: "", phone: "", notes: "", isActive: true };

export default function WebsiteSuppliersPage() {
  const [items, setItems] = useState<WebSupplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<Form | null>(null);
  const [saving, setSaving] = useState(false);

  const load = () =>
    webApi<WebSupplier[]>("/api/website/suppliers")
      .then(setItems)
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));

  useEffect(() => {
    load();
  }, []);

  const save = async () => {
    if (!form) return;
    setSaving(true);
    try {
      await webApi("/api/website/suppliers", { method: "POST", json: form });
      toast.success("Supplier saved");
      setForm(null);
      load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (s: WebSupplier) => {
    if (!confirm(`Delete "${s.name}"? Its ${s.productCount} products will have no supplier.`)) return;
    try {
      await webApi(`/api/website/suppliers?id=${s.id}`, { method: "DELETE" });
      load();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Suppliers</h2>
          <p className="text-muted-foreground text-sm">Who supplies each website item. Internal only — customers never see this.</p>
        </div>
        <Button className="bg-teal-600 hover:bg-teal-700" onClick={() => setForm({ ...emptyForm })}>
          <Plus className="h-4 w-4 mr-1" /> New Supplier
        </Button>
      </div>

      <Card className="divide-y">
        {loading && <div className="p-6"><Loader2 className="h-5 w-5 animate-spin" /></div>}
        {!loading && items.length === 0 && (
          <div className="p-10 text-center text-muted-foreground">
            <Truck className="h-8 w-8 mx-auto mb-2 opacity-50" />
            No suppliers yet. You can also add them while editing a product.
          </div>
        )}
        {items.map((s) => (
          <div key={s.id} className="flex items-center gap-3 p-3">
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{s.name}</p>
              <p className="text-xs text-muted-foreground">
                {s.phone || "no phone"} · {s.productCount} products
              </p>
            </div>
            {!s.isActive && <Badge variant="secondary">Inactive</Badge>}
            <Button size="icon" variant="ghost" onClick={() => setForm({ id: s.id, name: s.name, phone: s.phone || "", notes: s.notes || "", isActive: s.isActive })}>
              <Pencil className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="ghost" onClick={() => remove(s)}><Trash2 className="h-4 w-4 text-red-600" /></Button>
          </div>
        ))}
      </Card>

      <Dialog open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{form?.id ? "Edit Supplier" : "New Supplier"}</DialogTitle></DialogHeader>
          {form && (
            <div className="space-y-4">
              <div className="space-y-1">
                <Label>Name</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Sierra Cables Plc" />
              </div>
              <div className="space-y-1">
                <Label>Phone</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Notes</Label>
                <Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={form.isActive} onCheckedChange={(v) => setForm({ ...form, isActive: v })} /> Active
              </label>
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
