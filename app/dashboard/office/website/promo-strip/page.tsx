"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Pencil, Trash2, Loader2, Megaphone, ArrowUp, ArrowDown } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { webApi } from "../_components/api";
import { ImageUploader } from "../_components/ImageUploader";

type LinkType = "category" | "brand" | "product" | "url";
type BadgeMode = "none" | "auto" | "text";
type BadgeColor = "red" | "orange" | "green" | "blue";
type Promo = {
  id?: string;
  title: string;
  imageUrl: string | null;
  linkType: LinkType;
  linkValue: string;
  badgeMode: BadgeMode;
  badgeText: string | null;
  badgeColor: BadgeColor;
  sortOrder: number;
  isActive: boolean;
  endsAt: string | null;
};
type Option = { slug: string; name: string; imageUrl: string | null };

const empty: Promo = {
  title: "",
  imageUrl: null,
  linkType: "category",
  linkValue: "",
  badgeMode: "text",
  badgeText: "",
  badgeColor: "red",
  sortOrder: 0,
  isActive: true,
  endsAt: null,
};

// Same colours as the shop strip.
const BADGE_BG: Record<BadgeColor, string> = {
  red: "bg-red-600",
  orange: "bg-orange-500",
  green: "bg-emerald-600",
  blue: "bg-blue-600",
};

const LINK_LABEL: Record<LinkType, string> = { category: "Category", brand: "Brand", product: "Product", url: "Other link" };

export default function PromoStripPage() {
  const [items, setItems] = useState<Promo[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<Promo | null>(null);
  const [saving, setSaving] = useState(false);
  const [cats, setCats] = useState<Option[]>([]);
  const [brands, setBrands] = useState<Option[]>([]);
  const [prodQ, setProdQ] = useState("");
  const [prods, setProds] = useState<Option[]>([]);

  const load = () =>
    webApi<Promo[]>("/api/website/promo-strip")
      .then(setItems)
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));

  useEffect(() => {
    load();
    webApi<any[]>("/api/website/categories")
      .then((r) => {
        const byId = new Map(r.map((c) => [c.id, c]));
        setCats(
          r
            .filter((c) => c.isActive !== false)
            .map((c) => ({ slug: c.slug, name: c.parentId ? `${byId.get(c.parentId)?.name ?? ""} › ${c.name}` : c.name, imageUrl: c.imageUrl }))
            .sort((a, b) => a.name.localeCompare(b.name)),
        );
      })
      .catch(() => {});
    webApi<any[]>("/api/website/brands")
      .then((r) => {
        const byId = new Map(r.map((b) => [b.id, b]));
        setBrands(
          r
            .filter((b) => b.isActive !== false)
            .map((b) => ({ slug: b.slug, name: b.parentId ? `${byId.get(b.parentId)?.name ?? ""} › ${b.name}` : b.name, imageUrl: b.logoUrl }))
            .sort((a, b) => a.name.localeCompare(b.name)),
        );
      })
      .catch(() => {});
  }, []);

  // Product search for "Product" links.
  useEffect(() => {
    if (form?.linkType !== "product") return;
    const t = setTimeout(() => {
      webApi<any[]>(`/api/website/products?status=published&search=${encodeURIComponent(prodQ)}`)
        .then((r) => setProds(r.slice(0, 30).map((p) => ({ slug: p.slug, name: p.name, imageUrl: p.images?.[0] ?? null }))))
        .catch(() => {});
    }, 300);
    return () => clearTimeout(t);
  }, [prodQ, form?.linkType]);

  const options = form?.linkType === "category" ? cats : form?.linkType === "brand" ? brands : form?.linkType === "product" ? prods : [];
  const picked = useMemo(() => options.find((o) => o.slug === form?.linkValue), [options, form?.linkValue]);

  const choose = (slug: string) => {
    if (!form) return;
    const o = options.find((x) => x.slug === slug);
    const plainName = o?.name.split(" › ").pop() || "";
    setForm({ ...form, linkValue: slug, title: form.title || plainName.slice(0, 40) });
  };

  const save = async () => {
    if (!form) return;
    setSaving(true);
    try {
      await webApi("/api/website/promo-strip", { method: "POST", json: form });
      toast.success("Promotion saved");
      setForm(null);
      load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (p: Promo) => {
    if (!confirm(`Delete "${p.title}"?`)) return;
    try {
      await webApi(`/api/website/promo-strip?id=${p.id}`, { method: "DELETE" });
      load();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  // Swap places with the item above / below.
  const move = async (idx: number, dir: -1 | 1) => {
    const other = items[idx + dir];
    if (!other) return;
    const list = items.map((p, i) => ({ ...p, sortOrder: i * 10 }));
    [list[idx].sortOrder, list[idx + dir].sortOrder] = [list[idx + dir].sortOrder, list[idx].sortOrder];
    try {
      await Promise.all([list[idx], list[idx + dir]].map((p) => webApi("/api/website/promo-strip", { method: "POST", json: { ...p, endsAt: p.endsAt?.slice(0, 10) ?? null } })));
      load();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const imgFor = (p: Promo) =>
    p.imageUrl || (p.linkType === "category" ? cats : p.linkType === "brand" ? brands : prods).find((o) => o.slug === p.linkValue)?.imageUrl || null;
  const expired = (p: Promo) => !!p.endsAt && new Date(p.endsAt).getTime() < Date.now();
  const badgeOf = (p: Promo) => (p.badgeMode === "text" ? p.badgeText : p.badgeMode === "auto" ? "Up to X% OFF" : null);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Home Promo Strip</h2>
          <p className="text-sm text-muted-foreground">
            The black row of round pictures under the shop menu. Only the promotions you add here are shown. With none, the strip is hidden.
          </p>
        </div>
        <Button
          className="bg-teal-600 hover:bg-teal-700"
          onClick={() => setForm({ ...empty, sortOrder: (items.at(-1)?.sortOrder ?? 0) + 10 })}
        >
          <Plus className="mr-1 h-4 w-4" /> New Promotion
        </Button>
      </div>

      {/* Live preview of the strip */}
      <Card className="overflow-hidden p-0">
        <div className="flex items-center gap-1 overflow-x-auto bg-black px-4 py-3 text-white">
          <div className="mr-3 shrink-0 rounded-lg bg-white/10 px-4 py-2 text-[13px] font-bold leading-tight">
            Special
            <div className="text-xs font-semibold text-slate-300">Offers</div>
          </div>
          {items.filter((p) => p.isActive && !expired(p)).map((p) => (
            <StripBubble key={p.id} p={p} img={imgFor(p)} badge={badgeOf(p)} />
          ))}
        </div>
        <p className="px-4 py-2 text-xs text-muted-foreground">Preview. &quot;Auto&quot; badges show the biggest discount in that category or brand on the shop.</p>
      </Card>

      {loading && <Loader2 className="h-5 w-5 animate-spin" />}
      {!loading && items.length === 0 && (
        <Card className="p-10 text-center text-muted-foreground">
          <Megaphone className="mx-auto mb-2 h-8 w-8 opacity-50" />
          No promotions yet, so the strip is hidden on the shop.
        </Card>
      )}

      <div className="space-y-2">
        {items.map((p, idx) => (
          <Card key={p.id} className="flex items-center gap-3 p-3">
            <div className="flex flex-col">
              <Button size="icon" variant="ghost" className="h-6 w-6" disabled={idx === 0} onClick={() => move(idx, -1)}>
                <ArrowUp className="h-3.5 w-3.5" />
              </Button>
              <Button size="icon" variant="ghost" className="h-6 w-6" disabled={idx === items.length - 1} onClick={() => move(idx, 1)}>
                <ArrowDown className="h-3.5 w-3.5" />
              </Button>
            </div>
            <div className="h-12 w-12 shrink-0 overflow-hidden rounded-full bg-slate-900 ring-2 ring-slate-200">
              {p.imageUrl && <img src={p.imageUrl} alt="" className="h-full w-full object-cover" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{p.title}</p>
              <p className="truncate text-xs text-muted-foreground">
                {LINK_LABEL[p.linkType]}: {p.linkValue}
                {p.endsAt && ` · ends ${new Date(p.endsAt).toLocaleDateString("en-LK")}`}
              </p>
            </div>
            {badgeOf(p) && <span className={`rounded px-2 py-0.5 text-[11px] font-extrabold text-white ${BADGE_BG[p.badgeColor]}`}>{badgeOf(p)}</span>}
            {!p.isActive && <Badge variant="secondary">Hidden</Badge>}
            {p.isActive && expired(p) && <Badge variant="secondary">Ended</Badge>}
            <Button size="icon" variant="ghost" onClick={() => setForm({ ...p, endsAt: p.endsAt?.slice(0, 10) ?? null })}>
              <Pencil className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="ghost" onClick={() => remove(p)}>
              <Trash2 className="h-4 w-4 text-red-600" />
            </Button>
          </Card>
        ))}
      </div>

      <Dialog open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{form?.id ? "Edit Promotion" : "New Promotion"}</DialogTitle>
          </DialogHeader>
          {form && (
            <div className="space-y-4">
              <div className="grid grid-cols-[140px_1fr] gap-3">
                <div className="space-y-1">
                  <Label>Opens</Label>
                  <Select value={form.linkType} onValueChange={(v) => setForm({ ...form, linkType: v as LinkType, linkValue: "" })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(LINK_LABEL) as LinkType[]).map((k) => (
                        <SelectItem key={k} value={k}>
                          {LINK_LABEL[k]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>{form.linkType === "url" ? "Link" : `Choose ${LINK_LABEL[form.linkType].toLowerCase()}`}</Label>
                  {form.linkType === "url" ? (
                    <Input placeholder="/products?sort=newest or https://…" value={form.linkValue} onChange={(e) => setForm({ ...form, linkValue: e.target.value })} />
                  ) : (
                    <>
                      {form.linkType === "product" && (
                        <Input className="mb-2" placeholder="Search products…" value={prodQ} onChange={(e) => setProdQ(e.target.value)} />
                      )}
                      <Select value={form.linkValue || undefined} onValueChange={choose}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select…" />
                        </SelectTrigger>
                        <SelectContent>
                          {form.linkValue && !picked && <SelectItem value={form.linkValue}>{form.linkValue}</SelectItem>}
                          {options.map((o) => (
                            <SelectItem key={o.slug} value={o.slug}>
                              {o.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </>
                  )}
                </div>
              </div>

              <div className="space-y-1">
                <Label>Name under the picture</Label>
                <Input maxLength={40} placeholder="e.g. Cables & Wires" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </div>

              <div className="space-y-1">
                <Label>Picture (optional)</Label>
                <p className="text-xs text-muted-foreground">Leave empty to use the {form.linkType === "brand" ? "brand logo" : "category picture"}. A square picture looks best.</p>
                <ImageUploader max={1} value={form.imageUrl ? [form.imageUrl] : []} onChange={(u) => setForm({ ...form, imageUrl: u[0] ?? null })} />
              </div>

              <div className="space-y-2 rounded-lg border p-3">
                <Label>Badge</Label>
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      ["text", "My text (e.g. 27% OFF)"],
                      ["auto", "Auto: biggest discount"],
                      ["none", "No badge"],
                    ] as [BadgeMode, string][]
                  ).map(([k, l]) => (
                    <Button
                      key={k}
                      type="button"
                      size="sm"
                      variant={form.badgeMode === k ? "default" : "outline"}
                      className={form.badgeMode === k ? "bg-teal-600 hover:bg-teal-700" : ""}
                      onClick={() => setForm({ ...form, badgeMode: k })}
                      disabled={k === "auto" && form.linkType === "url"}
                    >
                      {l}
                    </Button>
                  ))}
                </div>
                {form.badgeMode === "text" && (
                  <Input maxLength={14} placeholder="27% OFF" value={form.badgeText ?? ""} onChange={(e) => setForm({ ...form, badgeText: e.target.value })} />
                )}
                {form.badgeMode === "auto" && (
                  <p className="text-xs text-muted-foreground">Shows e.g. &quot;UP TO 27%&quot; from the current shop prices. It updates by itself when prices change.</p>
                )}
                {form.badgeMode !== "none" && (
                  <div className="flex items-center gap-2 pt-1">
                    <span className="text-xs text-muted-foreground">Colour</span>
                    {(Object.keys(BADGE_BG) as BadgeColor[]).map((c) => (
                      <button
                        key={c}
                        type="button"
                        aria-label={c}
                        onClick={() => setForm({ ...form, badgeColor: c })}
                        className={`h-6 w-6 rounded-full ${BADGE_BG[c]} ${form.badgeColor === c ? "ring-2 ring-offset-2 ring-slate-900" : ""}`}
                      />
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>Ends on (optional)</Label>
                  <Input type="date" value={form.endsAt ?? ""} onChange={(e) => setForm({ ...form, endsAt: e.target.value || null })} />
                </div>
                <div className="flex items-center gap-2 pt-6">
                  <Switch checked={form.isActive} onCheckedChange={(v) => setForm({ ...form, isActive: v })} />
                  <Label>Show on shop</Label>
                </div>
              </div>

              <div className="flex items-center gap-3 rounded-lg bg-black p-3">
                <StripBubble p={form} img={imgFor(form)} badge={badgeOf(form)} />
                <span className="text-xs text-slate-400">Preview</span>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setForm(null)}>
              Cancel
            </Button>
            <Button className="bg-teal-600 hover:bg-teal-700" onClick={save} disabled={saving || !form?.title || !form?.linkValue}>
              {saving && <Loader2 className="mr-1 h-4 w-4 animate-spin" />} Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** One round picture of the strip, with its badge. */
function StripBubble({ p, img, badge }: { p: Promo; img: string | null; badge: string | null }) {
  return (
    <div className="flex w-[84px] shrink-0 flex-col items-center gap-1.5 text-center">
      <span className="relative">
        <span className={`flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-slate-800 ring-2 ${badge ? "ring-red-500" : "ring-white/10"}`}>
          {img && <img src={img} alt="" className="h-full w-full object-cover" />}
        </span>
        {badge && (
          <span className={`absolute -bottom-1.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded px-1.5 py-px text-[9px] font-extrabold uppercase text-white ${BADGE_BG[p.badgeColor]}`}>
            {badge}
          </span>
        )}
      </span>
      <span className="mt-1 line-clamp-2 text-[11px] font-bold leading-tight text-slate-200">{p.title || "Name"}</span>
    </div>
  );
}
