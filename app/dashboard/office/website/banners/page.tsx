"use client";

import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Loader2, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { webApi } from "../_components/api";
import { ImageUploader } from "../_components/ImageUploader";

type Banner = { id?: string; title: string | null; imageUrl: string; link: string | null; sortOrder: number; isActive: boolean };
const empty: Banner = { title: "", imageUrl: "", link: "", sortOrder: 0, isActive: true };

export default function WebsiteBannersPage() {
  const [items, setItems] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<Banner | null>(null);
  const [saving, setSaving] = useState(false);

  const load = () =>
    webApi<Banner[]>("/api/website/banners")
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
      await webApi("/api/website/banners", { method: "POST", json: form });
      toast.success("Banner saved");
      setForm(null);
      load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (b: Banner) => {
    if (!confirm("Delete this banner?")) return;
    try {
      await webApi(`/api/website/banners?id=${b.id}`, { method: "DELETE" });
      load();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Home Page Banners</h2>
          <p className="text-muted-foreground text-sm">Slides at the top of the shop home page. Best size: 1600 × 600.</p>
        </div>
        <Button className="bg-teal-600 hover:bg-teal-700" onClick={() => setForm({ ...empty })}>
          <Plus className="h-4 w-4 mr-1" /> New Banner
        </Button>
      </div>

      {loading && <Loader2 className="h-5 w-5 animate-spin" />}
      {!loading && items.length === 0 && (
        <Card className="p-10 text-center text-muted-foreground">
          <ImageIcon className="h-8 w-8 mx-auto mb-2 opacity-50" /> No banners yet.
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {items.map((b) => (
          <Card key={b.id} className="overflow-hidden">
            <div className="aspect-[8/3] bg-muted">
              <img src={b.imageUrl} alt="" className="h-full w-full object-cover" />
            </div>
            <div className="p-3 flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{b.title || "Untitled"}</p>
                <p className="text-xs text-muted-foreground truncate">{b.link || "No link"} · order {b.sortOrder}</p>
              </div>
              {!b.isActive && <Badge variant="secondary">Hidden</Badge>}
              <Button size="icon" variant="ghost" onClick={() => setForm(b)}><Pencil className="h-4 w-4" /></Button>
              <Button size="icon" variant="ghost" onClick={() => remove(b)}><Trash2 className="h-4 w-4 text-red-600" /></Button>
            </div>
          </Card>
        ))}
      </div>

      <Dialog open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{form?.id ? "Edit Banner" : "New Banner"}</DialogTitle></DialogHeader>
          {form && (
            <div className="space-y-4">
              <div className="space-y-1">
                <Label>Image</Label>
                <ImageUploader max={1} value={form.imageUrl ? [form.imageUrl] : []} onChange={(u) => setForm({ ...form, imageUrl: u[0] ?? "" })} />
              </div>
              <div className="space-y-1">
                <Label>Title (optional)</Label>
                <Input value={form.title ?? ""} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Link when clicked (optional)</Label>
                <Input placeholder="/c/switches or /p/orange-13a-switch" value={form.link ?? ""} onChange={(e) => setForm({ ...form, link: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>Sort order</Label>
                  <Input type="number" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })} />
                </div>
                <div className="flex items-center gap-2 pt-6">
                  <Switch checked={form.isActive} onCheckedChange={(v) => setForm({ ...form, isActive: v })} />
                  <Label>Active</Label>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setForm(null)}>Cancel</Button>
            <Button className="bg-teal-600 hover:bg-teal-700" onClick={save} disabled={saving || !form?.imageUrl}>
              {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />} Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
