"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Save, Plus, X, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { resolveWebPrice, type WebPriceRule } from "@/lib/web-pricing-core";
import { webApi, rs } from "../../_components/api";
import { ImageUploader } from "../../_components/ImageUploader";
import { MainProduct, MainProductPicker } from "../../_components/MainProductSearch";
import type { WebBrand, WebCategory, WebFamily, WebProduct, WebSupplier } from "../../_components/types";
import { TaxonomyField } from "../../_components/TaxonomyField";
import { suggestSizeTags } from "@/lib/web-search";
import { detectBrand } from "@/lib/web-brand-detect";

const LIST = "/dashboard/office/website/products";

type Draft = {
  id?: string;
  variantId?: string; // the single sale row behind the product
  name: string;
  shortDescription: string;
  description: string;
  specs: { label: string; value: string }[];
  webCategoryId: string | null;
  webSubCategoryId: string | null;
  webFamilyId: string | null;
  extraCategoryIds: string[];
  tags: string[];
  brandText: string;
  webBrandId: string | null;
  webSubBrandId: string | null;
  webSupplierId: string | null;
  images: string[];
  isPublished: boolean;
  isFeatured: boolean;
  sortOrder: number;
  orderType: "normal" | "special" | "cut";
  leadTime: string;
  // sale info
  productId: string;
  linked: MainProduct | null;
  mrp: string;
  webPrice: string;
  tradePrice: string;
  isAvailable: boolean;
};

const emptyDraft: Draft = {
  name: "", shortDescription: "", description: "", specs: [], webCategoryId: null, webSubCategoryId: null, webFamilyId: null,
  extraCategoryIds: [], tags: [], brandText: "", webBrandId: null, webSubBrandId: null, webSupplierId: null,
  images: [], isPublished: false, isFeatured: false, sortOrder: 0, orderType: "normal", leadTime: "",
  productId: "", linked: null, mrp: "", webPrice: "", tradePrice: "", isAvailable: true,
};

export default function WebsiteProductEditor() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const isNew = params.id === "new";

  const [d, setD] = useState<Draft | null>(isNew ? emptyDraft : null);
  const [categories, setCategories] = useState<WebCategory[]>([]);
  const [brands, setBrands] = useState<WebBrand[]>([]);
  const [families, setFamilies] = useState<WebFamily[]>([]);
  const [suppliers, setSuppliers] = useState<WebSupplier[]>([]);
  const [rules, setRules] = useState<WebPriceRule[]>([]);
  const [saving, setSaving] = useState(false);
  const [tagInput, setTagInput] = useState("");

  useEffect(() => {
    webApi<WebCategory[]>("/api/website/categories").then(setCategories).catch(() => {});
    webApi<WebBrand[]>("/api/website/brands").then(setBrands).catch(() => {});
    webApi<WebFamily[]>("/api/website/families").then(setFamilies).catch(() => {});
    webApi<WebSupplier[]>("/api/website/suppliers").then(setSuppliers).catch(() => {});
    webApi<{ rules: any[] }>("/api/website/price-rules")
      .then((r) =>
        setRules(
          r.rules
            .filter((x) => x.isActive)
            .map((x) => ({ id: x.id, scope: x.scope, scope_value: x.scopeValue, tier: x.tier, method: x.method, value: x.value, priority: x.priority, is_active: true })),
        ),
      )
      .catch(() => {});
    if (!isNew) {
      webApi<WebProduct>(`/api/website/products?id=${params.id}`)
        .then((p) => {
          const v = p.variants[0];
          setD({
            id: p.id,
            variantId: v?.id,
            name: p.name,
            shortDescription: p.shortDescription || "",
            description: p.description || "",
            specs: p.specs,
            webCategoryId: p.webCategoryId,
            webSubCategoryId: p.webSubCategoryId,
            webFamilyId: p.webFamilyId,
            extraCategoryIds: p.extraCategoryIds,
            tags: p.tags,
            brandText: p.brandText || "",
            webBrandId: p.webBrandId,
            webSubBrandId: p.webSubBrandId,
            webSupplierId: p.webSupplierId,
            images: p.images,
            isPublished: p.isPublished,
            isFeatured: p.isFeatured,
            sortOrder: p.sortOrder,
            orderType: p.orderType || "normal",
            leadTime: p.leadTime || "",
            productId: v?.productId || "",
            linked: v
              ? {
                  id: v.productId, sku: v.main.sku, name: v.main.name, brand: v.main.brand, category: v.main.category,
                  subCategory: v.main.subCategory ?? null, productFamily: v.main.productFamily ?? null, subBrand: v.main.subBrand ?? null,
                  supplierName: v.main.supplierName, mrp: v.main.mrp, sellingPrice: 0, costPrice: v.main.costPrice, images: [],
                  unit: v.main.unit ?? null, mainStock: v.main.stock, alreadyOnWebsite: true,
                }
              : null,
            mrp: v?.mrp?.toString() ?? "",
            webPrice: v?.webPrice?.toString() ?? "",
            tradePrice: v?.tradePrice?.toString() ?? "",
            isAvailable: v?.isAvailable ?? true,
          });
        })
        .catch((e) => toast.error(e.message));
    }
  }, [isNew, params.id]);

  // New product: start with the default main category already selected — the
  // first category the website sells (Shop Settings, phase 1 = Wiring Accessories),
  // or the only main category if there is just one.
  useEffect(() => {
    if (!isNew || categories.length === 0) return;
    let cancelled = false;
    webApi<{ allowed: string[] }>("/api/website/main-products?facets=1")
      .catch(() => ({ allowed: [] as string[] }))
      .then(({ allowed }) => {
        if (cancelled) return;
        const mains = categories.filter((c) => !c.parentId);
        const wanted = allowed.map((a) => a.toLowerCase());
        const pick = mains.find((c) => wanted.includes(c.name.toLowerCase())) ?? (mains.length === 1 ? mains[0] : undefined);
        if (pick) setD((cur) => (cur && !cur.webCategoryId ? { ...cur, webCategoryId: pick.id } : cur));
      });
    return () => {
      cancelled = true;
    };
  }, [isNew, categories]);

  if (!d) return <Loader2 className="h-6 w-6 animate-spin text-teal-600" />;

  const set = (patch: Partial<Draft>) => setD((cur) => (cur ? { ...cur, ...patch } : cur));

  const byName = <T extends { name: string }>(a: T, b: T) => a.name.localeCompare(b.name);
  const mainCategories = categories.filter((c) => !c.parentId).sort(byName);
  const catName = (id: string | null) => categories.find((c) => c.id === id)?.name ?? null;
  const brandName = (id: string | null) => brands.find((b) => b.id === id)?.name ?? null;
  // Always selectable: with a parent chosen show only its children, otherwise all
  // children with the parent name as a hint. Picking a child fills in the parent.
  const subCategories = categories
    .filter((c) => c.parentId && (!d.webCategoryId || c.parentId === d.webCategoryId))
    .sort(byName)
    .map((c) => ({ id: c.id, name: c.name, hint: catName(c.parentId) }));
  const familyOptions = families
    .filter((f) => !d.webSubCategoryId || f.webCategoryId === d.webSubCategoryId || !f.webCategoryId)
    .sort(byName)
    .map((f) => ({ id: f.id, name: f.name, hint: f.webCategoryId ? catName(f.webCategoryId) : null }));
  const mainBrands = brands.filter((b) => !b.parentId).sort(byName);
  const subBrands = brands
    .filter((b) => b.parentId && (!d.webBrandId || b.parentId === d.webBrandId))
    .sort(byName)
    .map((b) => ({ id: b.id, name: b.name, hint: brandName(b.parentId) }));
  const newBrand = (id: string, name: string, parentId: string | null): WebBrand => ({
    id, name, slug: "", parentId, logoUrl: null, description: null, sortOrder: 0, isFeatured: true, isActive: true, productCount: 0,
  });

  const preview = (tier: "normal" | "trade") =>
    d.linked
      ? resolveWebPrice(
          {
            mrp: d.mrp === "" ? null : Number(d.mrp),
            web_price: d.webPrice === "" ? null : Number(d.webPrice),
            trade_price: d.tradePrice === "" ? null : Number(d.tradePrice),
            web_category_id: d.webCategoryId,
            web_brand_id: d.webBrandId,
            qty_multiplier: 1,
          },
          { mrp: d.linked.mrp, cost_price: d.linked.costPrice, brand: d.linked.brand, category: d.linked.category },
          tier,
          rules,
        )
      : null;
  const normal = preview("normal");
  const trade = preview("trade");
  const cost = d.linked?.costPrice ?? 0;

  const save = async () => {
    if (!d.productId) return toast.error("Link a main product first");
    setSaving(true);
    try {
      const body = {
        id: d.id,
        name: d.name,
        shortDescription: d.shortDescription,
        description: d.description,
        specs: d.specs,
        webCategoryId: d.webCategoryId,
        webSubCategoryId: d.webSubCategoryId,
        webFamilyId: d.webFamilyId,
        extraCategoryIds: d.extraCategoryIds,
        tags: d.tags,
        brandText: d.brandText,
        webBrandId: d.webBrandId,
        webSubBrandId: d.webSubBrandId,
        webSupplierId: d.webSupplierId,
        images: d.images,
        isPublished: d.isPublished,
        isFeatured: d.isFeatured,
        sortOrder: d.sortOrder,
        orderType: d.orderType,
        leadTime: d.leadTime,
        productId: d.productId,
        variantId: d.variantId,
        mrp: d.mrp,
        webPrice: d.webPrice,
        tradePrice: d.tradePrice,
        isAvailable: d.isAvailable,
      };
      const r = await webApi<{ id: string }>("/api/website/products", { method: "POST", json: body });
      toast.success("Product saved");
      if (isNew) router.replace(`${LIST}/${r.id}`);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const addTag = () => {
    const t = tagInput.trim();
    if (t && !d.tags.includes(t)) set({ tags: [...d.tags, t] });
    setTagInput("");
  };

  // Size spellings found in the name (1/1.13mm → 1/113, 1/044, 1mm²…) not yet added.
  const tagSuggestions = suggestSizeTags(d.name).filter(
    (t) => !d.tags.some((x) => x.toLowerCase() === t.toLowerCase()),
  );

  return (
    <div className="space-y-6 pb-24">
      <div className="flex flex-wrap items-center gap-3">
        <Link href={LIST}><Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button></Link>
        <div className="flex-1 min-w-0">
          <h2 className="text-2xl font-bold tracking-tight truncate">{isNew ? "New Website Product" : d.name}</h2>
          {normal && (
            <p className="text-sm text-muted-foreground">
              Shop shows: {normal.discountPct > 0 && <span className="line-through mr-1">{rs(normal.mrp)}</span>}
              <b>{rs(normal.price)}</b>
              {normal.discountPct > 0 && <span className="text-green-600"> (-{normal.discountPct}%)</span>}
            </p>
          )}
        </div>
        <label className="flex items-center gap-2 text-sm"><Switch checked={d.isPublished} onCheckedChange={(v) => set({ isPublished: v })} /> Published</label>
        <label className="flex items-center gap-2 text-sm"><Switch checked={d.isFeatured} onCheckedChange={(v) => set({ isFeatured: v })} /> Featured</label>
        <Button className="bg-teal-600 hover:bg-teal-700" onClick={save} disabled={saving || !d.name.trim()}>
          {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />} Save
        </Button>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* ── Main product & price ── */}
          <Card>
            <CardHeader><CardTitle className="text-base">Main product & price</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <Label>Linked main product (stock & cost come from here)</Label>
                <MainProductPicker
                  selected={d.linked}
                  onSelect={(p) => {
                    // Pre-select website values whose names match the main item. Anything
                    // not on the website yet shows a "+ Add" suggestion under the field.
                    const find = <T extends { id: string; name: string }>(list: T[], name?: string | null) =>
                      name ? list.find((x) => x.name.toLowerCase() === name.trim().toLowerCase()) : undefined;
                    const mainCat = d.webCategoryId ? null : find(categories.filter((c) => !c.parentId), p.category);
                    const catId = d.webCategoryId ?? mainCat?.id ?? null;
                    const subCat = d.webSubCategoryId ? null : find(categories.filter((c) => c.parentId && c.parentId === catId), p.subCategory);
                    const brand = d.webBrandId ? null : find(brands.filter((b) => !b.parentId), p.brand || detectBrand(p.name, null));
                    const brandId = d.webBrandId ?? brand?.id ?? null;
                    const subBrand = d.webSubBrandId ? null : find(brands.filter((b) => b.parentId && b.parentId === brandId), p.subBrand);
                    set({
                      linked: p,
                      productId: p.id,
                      name: d.name || p.name,
                      webCategoryId: catId,
                      webSubCategoryId: d.webSubCategoryId ?? subCat?.id ?? null,
                      webFamilyId: d.webFamilyId ?? find(families, p.productFamily)?.id ?? null,
                      webBrandId: brandId,
                      brandText: brand?.name ?? d.brandText,
                      webSubBrandId: d.webSubBrandId ?? subBrand?.id ?? null,
                      webSupplierId: find(suppliers, p.supplierName)?.id ?? null,
                      // A different main item brings its own MRP; the same item keeps a typed MRP.
                      mrp: p.id !== d.productId || !d.mrp ? (p.mrp ? String(p.mrp) : "") : d.mrp,
                      images: d.images.length ? d.images : p.images,
                    });
                  }}
                />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 items-start">
                <div className="space-y-1">
                  <Label>MRP</Label>
                  <Input type="number" placeholder={d.linked?.mrp ? String(d.linked.mrp) : ""} value={d.mrp} onChange={(e) => set({ mrp: e.target.value })} />
                  {d.linked?.mrp ? (
                    Number(d.mrp) === Number(d.linked.mrp) ? (
                      <span className="text-[11px] block text-muted-foreground">= main item MRP</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => set({ mrp: String(d.linked!.mrp) })}
                        className="text-[11px] block text-amber-700 hover:underline text-left"
                        title="Use the MRP from the main B2B item"
                      >
                        Main MRP {rs(d.linked.mrp)} · use it
                      </button>
                    )
                  ) : null}
                </div>
                <div className="space-y-1">
                  <Label>Shop price</Label>
                  <Input type="number" placeholder={normal ? String(normal.price) : "auto"} value={d.webPrice} onChange={(e) => set({ webPrice: e.target.value })} />
                  {normal && (
                    <span className={`text-[11px] block ${normal.price < cost ? "text-red-600" : "text-muted-foreground"}`}>
                      = {rs(normal.price)} · margin {rs(normal.price - cost)}
                    </span>
                  )}
                </div>
                <div className="space-y-1">
                  <Label>Trade price</Label>
                  <Input type="number" placeholder={trade ? String(trade.price) : "auto"} value={d.tradePrice} onChange={(e) => set({ tradePrice: e.target.value })} />
                  {trade && <span className="text-[11px] block text-muted-foreground">= {rs(trade.price)}</span>}
                </div>
                <div className="space-y-1">
                  <Label>In stock</Label>
                  <div className="h-9 flex items-center"><Switch checked={d.isAvailable} onCheckedChange={(v) => set({ isAvailable: v })} /></div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">Leave Shop / Trade price empty to use Price Rules. Cost: {rs(cost)}</p>
            </CardContent>
          </Card>

          {/* ── How this item is sold ── */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">How this item is sold</CardTitle>
              <p className="text-xs text-muted-foreground">
                Special order: you buy it from the supplier for this customer. The shop tells the customer you will contact them about an
                advance, and you set the advance on the order. Cut piece: cut to the length ordered (paid like a normal item).
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid sm:grid-cols-3 gap-2">
                {([
                  ["normal", "Normal", "In stock, sold as usual"],
                  ["special", "Special order", "Ordered from the supplier · advance agreed later"],
                  ["cut", "Cut piece", "Cut to length · not returnable"],
                ] as const).map(([key, title, sub]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => set({ orderType: key })}
                    className={`rounded-lg border p-3 text-left transition ${d.orderType === key ? "border-teal-500 bg-teal-50 ring-1 ring-teal-500" : "hover:border-teal-300"}`}
                  >
                    <div className="text-sm font-semibold">{title}</div>
                    <div className="text-xs text-muted-foreground">{sub}</div>
                  </button>
                ))}
              </div>
              {d.orderType === "special" && (
                <div className="space-y-1 max-w-xs">
                  <Label>Delivery time (shown to customers)</Label>
                  <Input value={d.leadTime} maxLength={60} placeholder="e.g. 3–5 days" onChange={(e) => set({ leadTime: e.target.value })} />
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Product page</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <Label>Name</Label>
                <Input placeholder="ACL Fire Guard 1/1.13mm Single Core 1mm² Cable – Brown 100M" value={d.name} onChange={(e) => set({ name: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Short description (under the title)</Label>
                <Textarea rows={2} value={d.shortDescription} onChange={(e) => set({ shortDescription: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Full description</Label>
                <Textarea rows={5} value={d.description} onChange={(e) => set({ description: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Images (first = main)</Label>
                <ImageUploader max={10} value={d.images} onChange={(images) => set({ images })} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">Specifications (bullet points)</CardTitle>
              <Button size="sm" variant="outline" onClick={() => set({ specs: [...d.specs, { label: "", value: "" }] })}>
                <Plus className="h-3 w-3 mr-1" /> Add
              </Button>
            </CardHeader>
            <CardContent className="space-y-2">
              {d.specs.length === 0 && <p className="text-xs text-muted-foreground">e.g. Conductor Area → 1mm² · Voltage → 300/500V</p>}
              {d.specs.map((s, i) => (
                <div key={i} className="flex gap-2">
                  <Input className="w-1/3" placeholder="Label" value={s.label} onChange={(e) => set({ specs: d.specs.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })} />
                  <Input placeholder="Value" value={s.value} onChange={(e) => set({ specs: d.specs.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)) })} />
                  <Button size="icon" variant="ghost" onClick={() => set({ specs: d.specs.filter((_, j) => j !== i) })}><X className="h-4 w-4" /></Button>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Organise</CardTitle>
              <p className="text-xs text-muted-foreground">
                Website-only values. <Sparkles className="h-3 w-3 inline" /> suggestions come from the linked main item.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <TaxonomyField
                label="Main category"
                value={d.webCategoryId}
                options={mainCategories}
                suggestion={d.linked?.category}
                onChange={(id) => {
                  // Keep the sub category only if it belongs to the new main category.
                  const sub = categories.find((c) => c.id === d.webSubCategoryId);
                  set({ webCategoryId: id, webSubCategoryId: sub && sub.parentId === id ? sub.id : null });
                }}
                onCreate={async (name) => {
                  const c = await webApi<any>("/api/website/categories", { method: "POST", json: { name } });
                  setCategories((prev) => [...prev, { id: c.id, name: c.name, parentId: null }]);
                  return { id: c.id, name: c.name };
                }}
              />
              <TaxonomyField
                label="Sub category"
                value={d.webSubCategoryId}
                options={subCategories}
                suggestion={d.linked?.subCategory}
                createHint={catName(d.webCategoryId) ? `in ${catName(d.webCategoryId)}` : undefined}
                onChange={(id) => {
                  // Picking a sub category fills in its main category.
                  const sub = categories.find((c) => c.id === id);
                  set({ webSubCategoryId: id, ...(sub?.parentId ? { webCategoryId: sub.parentId } : {}) });
                }}
                onCreate={async (name) => {
                  if (!d.webCategoryId) throw new Error("Choose the main category first, then add the new sub category");
                  const c = await webApi<any>("/api/website/categories", { method: "POST", json: { name, parentId: d.webCategoryId } });
                  setCategories((prev) => [...prev, { id: c.id, name: c.name, parentId: d.webCategoryId }]);
                  return { id: c.id, name: c.name };
                }}
              />
              <TaxonomyField
                label="Product family"
                value={d.webFamilyId}
                options={familyOptions}
                suggestion={d.linked?.productFamily}
                onChange={(id) => set({ webFamilyId: id })}
                onCreate={async (name) => {
                  const f = await webApi<any>("/api/website/families", { method: "POST", json: { name, webCategoryId: d.webSubCategoryId } });
                  setFamilies((prev) => [...prev, { id: f.id, name: f.name, slug: "", webCategoryId: d.webSubCategoryId, webCategoryName: null, description: null, sortOrder: 0, isActive: true, productCount: 0 }]);
                  return { id: f.id, name: f.name };
                }}
              />
              <div className="border-t" />
              <TaxonomyField
                label="Brand"
                value={d.webBrandId}
                options={mainBrands}
                suggestion={d.linked ? d.linked.brand || detectBrand(d.linked.name, null) : null}
                onChange={(id) => {
                  const sub = brands.find((b) => b.id === d.webSubBrandId);
                  set({ webBrandId: id, webSubBrandId: sub && sub.parentId === id ? sub.id : null, brandText: brandName(id) ?? "" });
                }}
                onCreate={async (name) => {
                  const b = await webApi<any>("/api/website/brands", { method: "POST", json: { name } });
                  setBrands((prev) => [...prev, newBrand(b.id, b.name, null)]);
                  return { id: b.id, name: b.name };
                }}
              />
              <TaxonomyField
                label="Sub brand"
                value={d.webSubBrandId}
                options={subBrands}
                suggestion={d.linked?.subBrand}
                createHint={brandName(d.webBrandId) ? `under ${brandName(d.webBrandId)}` : undefined}
                onChange={(id) => {
                  // Picking a sub brand fills in its brand.
                  const sub = brands.find((b) => b.id === id);
                  set({
                    webSubBrandId: id,
                    ...(sub?.parentId ? { webBrandId: sub.parentId, brandText: brandName(sub.parentId) ?? "" } : {}),
                  });
                }}
                onCreate={async (name) => {
                  if (!d.webBrandId) throw new Error("Choose the brand first, then add the new sub brand");
                  const b = await webApi<any>("/api/website/brands", { method: "POST", json: { name, parentId: d.webBrandId } });
                  setBrands((prev) => [...prev, newBrand(b.id, b.name, d.webBrandId)]);
                  return { id: b.id, name: b.name };
                }}
              />
              <div className="space-y-1">
                <Label>Supplier</Label>
                <div className="h-9 px-3 rounded-md border bg-muted/40 text-sm flex items-center justify-between gap-2">
                  <span className={d.linked?.supplierName ? "truncate" : "text-muted-foreground"}>
                    {d.linked?.supplierName || "— none on main item —"}
                  </span>
                  <span className="text-[10px] text-muted-foreground shrink-0">from main item</span>
                </div>
              </div>
              <div className="border-t" />
              <div className="space-y-1">
                <Label>Also show in</Label>
                <div className="max-h-40 overflow-y-auto border rounded-md p-2 space-y-1">
                  {categories.filter((c) => c.id !== d.webCategoryId).map((c) => (
                    <label key={c.id} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={d.extraCategoryIds.includes(c.id)}
                        onCheckedChange={(v) => set({ extraCategoryIds: v ? [...d.extraCategoryIds, c.id] : d.extraCategoryIds.filter((x) => x !== c.id) })}
                      />
                      {c.parentId ? "— " : ""}{c.name}
                    </label>
                  ))}
                  {categories.length === 0 && <p className="text-xs text-muted-foreground">Create categories first.</p>}
                </div>
              </div>
              <div className="space-y-1">
                <Label>Tags (for search)</Label>
                <div className="flex gap-2">
                  <Input value={tagInput} onChange={(e) => setTagInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTag())} placeholder="e.g. 1.044" />
                  <Button variant="outline" onClick={addTag}>Add</Button>
                </div>
                {tagSuggestions.length > 0 && (
                  <div className="rounded-md border border-dashed border-teal-300 bg-teal-50/50 p-2 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] text-teal-800 flex items-center gap-1">
                        <Sparkles className="h-3 w-3" /> Size spellings customers search
                      </span>
                      <button
                        type="button"
                        className="text-[11px] font-medium text-teal-700 hover:underline"
                        onClick={() => set({ tags: [...d.tags, ...tagSuggestions] })}
                      >
                        + Add all
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {tagSuggestions.map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => set({ tags: [...d.tags, t] })}
                          className="text-xs rounded px-2 py-0.5 border border-teal-200 bg-white text-teal-800 hover:bg-teal-100"
                        >
                          + {t}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <div className="flex flex-wrap gap-1">
                  {d.tags.map((t) => (
                    <span key={t} className="text-xs bg-muted rounded px-2 py-0.5 flex items-center gap-1">
                      {t}
                      <button onClick={() => set({ tags: d.tags.filter((x) => x !== t) })}><X className="h-3 w-3" /></button>
                    </span>
                  ))}
                </div>
              </div>
              <div className="space-y-1">
                <Label>Sort order</Label>
                <Input type="number" value={d.sortOrder} onChange={(e) => set({ sortOrder: Number(e.target.value) })} />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
