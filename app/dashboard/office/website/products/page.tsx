"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Pencil, Trash2, Loader2, Search, Download, Package, AlertTriangle, Star } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { webApi, rs } from "../_components/api";
import { MainProduct, useMainFacets, useMainProductSearch } from "../_components/MainProductSearch";
import type { WebBrand, WebCategory, WebProduct } from "../_components/types";

const BASE = "/dashboard/office/website/products";

export default function WebsiteProductsPage() {
  const [items, setItems] = useState<WebProduct[]>([]);
  const [categories, setCategories] = useState<WebCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("all");
  const [brandId, setBrandId] = useState("all");
  const [brands, setBrands] = useState<WebBrand[]>([]);
  const [status, setStatus] = useState("all");
  const [importOpen, setImportOpen] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    const qs = new URLSearchParams();
    if (search) qs.set("search", search);
    if (categoryId !== "all") qs.set("categoryId", categoryId);
    if (brandId !== "all") qs.set("brandId", brandId);
    if (status !== "all") qs.set("status", status);
    webApi<WebProduct[]>(`/api/website/products?${qs}`)
      .then(setItems)
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, [search, categoryId, brandId, status]);

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [load]);

  useEffect(() => {
    webApi<WebCategory[]>("/api/website/categories").then(setCategories).catch(() => {});
    webApi<WebBrand[]>("/api/website/brands").then(setBrands).catch(() => {});
    // Opened from a brand card: /products?brand=<id>
    const fromBrand = new URLSearchParams(window.location.search).get("brand");
    if (fromBrand) setBrandId(fromBrand);
  }, []);

  const patch = async (body: Record<string, unknown>, optimistic: (list: WebProduct[]) => WebProduct[]) => {
    setItems(optimistic);
    try {
      await webApi("/api/website/products", { method: "PATCH", json: body });
    } catch (e: any) {
      toast.error(e.message);
      load();
    }
  };

  const setStock = (p: WebProduct, isAvailable: boolean) =>
    patch({ ids: [p.id], isAvailable }, (list) =>
      list.map((x) => (x.id === p.id ? { ...x, variants: x.variants.map((v) => ({ ...v, isAvailable })) } : x)),
    );

  const setFlag = (p: WebProduct, field: "isPublished" | "isFeatured", value: boolean) =>
    patch({ ids: [p.id], [field]: value }, (list) => list.map((x) => (x.id === p.id ? { ...x, [field]: value } : x)));

  const remove = async (p: WebProduct) => {
    if (!confirm(`Delete "${p.name}" from the website? (The main product is not touched.)`)) return;
    try {
      await webApi(`/api/website/products?id=${p.id}`, { method: "DELETE" });
      toast.success("Deleted");
      load();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Website Products</h2>
          <p className="text-muted-foreground text-sm max-w-2xl">
            Each website product is linked to one main product for stock & cost. Customers never see stock numbers.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            <Download className="h-4 w-4 mr-1" /> Import from main products
          </Button>
          <Link href={`${BASE}/new`}>
            <Button className="bg-teal-600 hover:bg-teal-700">
              <Plus className="h-4 w-4 mr-1" /> New Product
            </Button>
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="h-4 w-4 absolute left-2.5 top-2.5 text-muted-foreground" />
          <Input className="pl-8" placeholder="Search website products" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={categoryId} onValueChange={setCategoryId}>
          <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            <SelectItem value="none">No category</SelectItem>
            {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={brandId} onValueChange={setBrandId}>
          <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All brands</SelectItem>
            <SelectItem value="none">No brand</SelectItem>
            {brands.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All status</SelectItem>
            <SelectItem value="published">Published</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="unavailable">Out of stock</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs text-muted-foreground">
            <tr>
              <th className="text-left p-3">Product</th>
              <th className="text-left p-3">Brand</th>
              <th className="text-left p-3">Category</th>
              <th className="text-right p-3">MRP</th>
              <th className="text-right p-3">Shop price</th>
              <th className="text-right p-3">Trade price</th>
              <th className="text-right p-3">Cost / margin</th>
              <th className="text-right p-3">Main stock</th>
              <th className="text-center p-3">In stock</th>
              <th className="text-center p-3">Published</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading && <tr><td colSpan={11} className="p-6"><Loader2 className="h-5 w-5 animate-spin" /></td></tr>}
            {!loading && items.length === 0 && (
              <tr>
                <td colSpan={11} className="p-10 text-center text-muted-foreground">
                  <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  No website products. Use “Import from main products” to start quickly.
                </td>
              </tr>
            )}
            {items.map((p) => {
              const v = p.variants[0];
              if (!v) return null;
              const margin = v.normalPrice.price - v.unitCost;
              const marginPct = v.normalPrice.price > 0 ? (margin / v.normalPrice.price) * 100 : 0;
              return (
                <tr key={p.id} className="hover:bg-muted/30">
                  <td className="p-3">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded bg-muted overflow-hidden shrink-0">
                        {p.images[0] && <img src={p.images[0]} alt="" className="h-full w-full object-cover" />}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium truncate max-w-[300px] flex items-center gap-1">
                          {p.isFeatured && <Star className="h-3 w-3 fill-amber-400 text-amber-400 shrink-0" />}
                          {p.name}
                        </p>
                        <p className="text-xs text-muted-foreground truncate max-w-[300px]">↳ {v.main.sku} · {v.main.name}</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-3 text-xs">{p.webBrandName || <span className="text-amber-600">no brand</span>}</td>
                  <td className="p-3 text-xs">{p.webCategoryName || <span className="text-muted-foreground">—</span>}</td>
                  <td className="p-3 text-right">{rs(v.normalPrice.mrp)}</td>
                  <td className="p-3 text-right">
                    <span className="font-semibold">{rs(v.normalPrice.price)}</span>
                    {v.normalPrice.discountPct > 0 && <span className="text-green-600 text-xs ml-1">-{v.normalPrice.discountPct}%</span>}
                  </td>
                  <td className="p-3 text-right">{rs(v.tradePriceResolved.price)}</td>
                  <td className="p-3 text-right">
                    {rs(v.unitCost)}
                    <span className={`block text-xs ${margin < 0 ? "text-red-600" : "text-green-700"}`}>
                      {rs(margin)} ({marginPct.toFixed(0)}%)
                    </span>
                    {(v.normalPrice.clampedToCost || v.tradePriceResolved.clampedToCost) && (
                      <span className="text-[10px] text-amber-600 flex items-center justify-end gap-0.5">
                        <AlertTriangle className="h-3 w-3" /> rule below cost
                      </span>
                    )}
                  </td>
                  <td className={`p-3 text-right ${v.main.stock <= 0 ? "text-red-600 font-medium" : ""}`}>{v.main.stock}</td>
                  <td className="p-3 text-center"><Switch checked={v.isAvailable} onCheckedChange={(val) => setStock(p, val)} /></td>
                  <td className="p-3 text-center"><Switch checked={p.isPublished} onCheckedChange={(val) => setFlag(p, "isPublished", val)} /></td>
                  <td className="p-3 whitespace-nowrap">
                    <Link href={`${BASE}/${p.id}`}><Button size="icon" variant="ghost"><Pencil className="h-4 w-4" /></Button></Link>
                    <Button size="icon" variant="ghost" onClick={() => remove(p)}><Trash2 className="h-4 w-4 text-red-600" /></Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      <ImportDialog open={importOpen} onOpenChange={setImportOpen} categories={categories} onDone={load} />
    </div>
  );
}

function ImportDialog({
  open,
  onOpenChange,
  categories,
  onDone,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  categories: WebCategory[];
  onDone: () => void;
}) {
  const [search, setSearch] = useState("");
  const [picked, setPicked] = useState<MainProduct[]>([]);
  const [categoryId, setCategoryId] = useState("none");
  const [publish, setPublish] = useState(false);
  const [busy, setBusy] = useState(false);
  const [subCategory, setSubCategory] = useState("");
  const facets = useMainFacets(open);

  // Default "Put into website category" to the main category the website sells (phase 1: Wiring Accessories).
  useEffect(() => {
    if (!open || categoryId !== "none") return;
    const mains = categories.filter((c) => !c.parentId);
    const wanted = facets.allowed.map((a) => a.toLowerCase());
    const pick = mains.find((c) => wanted.includes(c.name.toLowerCase())) ?? (mains.length === 1 ? mains[0] : undefined);
    if (pick) setCategoryId(pick.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, categories, facets.allowed]);
  const { results, loading } = useMainProductSearch(open ? search : "", 100, subCategory);

  const isPicked = (id: string) => picked.some((p) => p.id === id);
  const toggle = (p: MainProduct) => setPicked((prev) => (isPicked(p.id) ? prev.filter((x) => x.id !== p.id) : [...prev, p]));
  const selectable = results.filter((p) => !p.alreadyOnWebsite);
  const allPicked = selectable.length > 0 && selectable.every((p) => isPicked(p.id));

  const run = async () => {
    setBusy(true);
    try {
      const r = await webApi<{ created: number }>("/api/website/products/import", {
        method: "POST",
        json: { productIds: picked.map((p) => p.id), webCategoryId: categoryId === "none" ? null : categoryId, publish },
      });
      toast.success(`${r.created} products added`);
      setPicked([]);
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
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader><DialogTitle>Import from main products</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">
          Each ticked item becomes its own website product (name, brand, sub brand, supplier, MRP and images copied).
        </p>
        <p className="text-xs rounded-md bg-teal-50 border border-teal-200 text-teal-800 px-2 py-1">
          Showing only: <b>{facets.allowed.length ? facets.allowed.join(", ") : "all categories"}</b> — change in Shop Settings.
        </p>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="h-4 w-4 absolute left-2.5 top-2.5 text-muted-foreground" />
            <Input className="pl-8" placeholder="Search e.g. 1/113" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={subCategory || "all"} onValueChange={(v) => setSubCategory(v === "all" ? "" : v)}>
            <SelectTrigger className="w-[210px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All sub categories</SelectItem>
              {facets.subCategories.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1 min-h-[200px] overflow-y-auto border rounded-md divide-y">
          {selectable.length > 0 && (
            <label className="flex items-center gap-2 p-2 bg-muted/40 text-xs font-medium sticky top-0 z-10">
              <Checkbox
                checked={allPicked}
                onCheckedChange={(v) =>
                  setPicked((prev) =>
                    v ? [...prev, ...selectable.filter((p) => !prev.some((x) => x.id === p.id))] : prev.filter((x) => !selectable.some((p) => p.id === x.id)),
                  )
                }
              />
              Select all shown ({selectable.length})
            </label>
          )}
          {loading && <div className="p-3"><Loader2 className="h-4 w-4 animate-spin" /></div>}
          {results.map((p) => (
            <label key={p.id} className={`flex items-center gap-2 p-2 text-sm ${p.alreadyOnWebsite ? "opacity-50" : "cursor-pointer hover:bg-muted/40"}`}>
              <Checkbox disabled={p.alreadyOnWebsite} checked={isPicked(p.id)} onCheckedChange={() => toggle(p)} />
              <div className="flex-1 min-w-0">
                <p className="truncate">{p.name}</p>
                <p className="text-xs text-muted-foreground">
                  {p.sku} · {p.brand || "-"} · {p.unit || ""} · MRP {rs(p.mrp)} · Stock {p.mainStock}
                </p>
              </div>
              {p.alreadyOnWebsite && <Badge variant="secondary">On website</Badge>}
            </label>
          ))}
        </div>
        <div className="grid sm:grid-cols-2 gap-4 items-end">
          <div className="space-y-1">
            <Label>Put into website category</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— None —</SelectItem>
                {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <label className="flex items-center gap-2 text-sm pb-2">
            <Switch checked={publish} onCheckedChange={setPublish} /> Publish immediately
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button className="bg-teal-600 hover:bg-teal-700" disabled={busy || picked.length === 0} onClick={run}>
            {busy && <Loader2 className="h-4 w-4 mr-1 animate-spin" />} Import {picked.length} products
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
