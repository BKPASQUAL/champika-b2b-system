"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { useCachedFetch } from "@/hooks/useCachedFetch";
import { toast } from "sonner";
import {
  ArrowLeft,
  Search,
  ChevronRight,
  ChevronLeft,
  Check,
  Upload,
  X,
  Loader2,
  Package,
  Tag,
  ImageIcon,
  ListChecks,
  Layers,
  Plus,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Product {
  id: string;
  sku: string;
  name: string;
  category: string;
  subCategory?: string;
  brand?: string;
  sizeSpec?: string;
  supplier: string;
  mrp: number;
  images: string[];
  retailOnly?: boolean;
}

interface CategoryItem {
  id: string;
  name: string;
  parent_id?: string;
  category_id?: string;
}

interface VariantConfig {
  productId: string;
  isNew: boolean;
  originalName: string;
  brand: string;
  sizeSpec: string;
  mrp: string;
  sellingPrice: string;
  supplier: string;
  companyImageFile: File | null;
  variantImageFile: File | null;
  images: string[];
  companyImagePreview: string;
  variantImagePreview: string;
}

// ─── Search Utilities ─────────────────────────────────────────────────────────

const NUMBER_WORDS: Record<string, string> = {
  "0": "zero", "1": "one", "2": "two", "3": "three", "4": "four",
  "5": "five", "6": "six", "7": "seven", "8": "eight", "9": "nine",
  "10": "ten", "11": "eleven", "12": "twelve", "13": "thirteen",
  "14": "fourteen", "15": "fifteen", "16": "sixteen", "17": "seventeen",
  "18": "eighteen", "19": "nineteen", "20": "twenty", "24": "twenty four",
  "30": "thirty", "40": "forty", "50": "fifty", "100": "hundred",
};
const WORD_NUMBERS: Record<string, string> = Object.fromEntries(
  Object.entries(NUMBER_WORDS).map(([n, w]) => [w, n])
);

function normNum(s: string): string {
  return s.replace(/[/.,\-]/g, "");
}

function tokenVariants(t: string): string[] {
  const vs = new Set<string>([t]);
  const n = normNum(t);
  if (n !== t) vs.add(n);
  if (NUMBER_WORDS[t]) vs.add(NUMBER_WORDS[t]);
  if (WORD_NUMBERS[t]) vs.add(WORD_NUMBERS[t]);
  Object.entries(NUMBER_WORDS).forEach(([num, word]) => {
    if (word.includes(t)) { vs.add(word); vs.add(num); }
    if (num.startsWith(t)) { vs.add(num); vs.add(word); }
  });
  return Array.from(vs);
}

function tokenMatches(token: string, fields: string[]): boolean {
  const variants = tokenVariants(token);
  return fields.some((f) => {
    const fl = f.toLowerCase();
    const fn = normNum(fl);
    return variants.some((v) => fl.includes(v) || fn.includes(normNum(v)));
  });
}

function nameScore(name: string, tokens: string[]): number {
  if (!tokens.length) return 0;
  const nl = name.toLowerCase();
  const nn = normNum(nl);
  const full = tokens.join(" ");
  const fullN = normNum(full);
  if (nl === full) return 100;
  if (nn === fullN) return 90;
  if (nl.startsWith(full)) return 80;
  if (nn.startsWith(fullN)) return 70;
  const hits = tokens.filter((t) => {
    const vs = tokenVariants(t);
    return vs.some((v) => nl.includes(v) || nn.includes(normNum(v)));
  }).length;
  return (hits / tokens.length) * 50;
}

// ─── Settings Hook ────────────────────────────────────────────────────────────

const useSettings = (type: string) => {
  const [data, setData] = useState<CategoryItem[]>([]);
  useEffect(() => {
    fetch(`/api/settings/categories?type=${type}`)
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d)) setData(d); })
      .catch(() => {});
  }, [type]);
  return data;
};

// ─── Step Config ──────────────────────────────────────────────────────────────

const STEPS = [
  { label: "Select Items", description: "Pick or create variants", icon: ListChecks },
  { label: "Group Info", description: "Base name & category", icon: Tag },
  { label: "Configure Items", description: "Brand, spec, price & images", icon: Package },
  { label: "Summary", description: "Review & save", icon: Check },
];

function makeNewVariant(tempId: string): VariantConfig {
  return {
    productId: tempId,
    isNew: true,
    originalName: "",
    brand: "",
    sizeSpec: "",
    mrp: "",
    sellingPrice: "",
    supplier: "",
    companyImageFile: null,
    variantImageFile: null,
    images: [],
    companyImagePreview: "",
    variantImagePreview: "",
  };
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdvancedProductPage() {
  const router = useRouter();

  // Remote data
  const { data: products = [], loading: loadingProducts } = useCachedFetch<Product[]>("/api/products", []);
  const { data: categories = [] } = useCachedFetch<CategoryItem[]>("/api/settings/categories?type=category", []);
  const { data: rawSuppliers = [] } = useCachedFetch<{ id: string; name: string }[]>("/api/suppliers", []);
  const { data: settingSuppliers = [] } = useCachedFetch<{ id: string; name: string }[]>(
    "/api/settings/categories?type=supplier", []
  );
  const brands = useSettings("brand");
  const specs = useSettings("spec");

  const suppliers = useMemo(
    () =>
      [{ id: "orange-orel", name: "Orange (Orel Corporation)" }, ...rawSuppliers, ...settingSuppliers].filter(
        (v, i, a) => a.findIndex((t) => t.name === v.name) === i
      ),
    [rawSuppliers, settingSuppliers]
  );

  // Wizard state
  const [step, setStep] = useState(0);
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [newItemIds, setNewItemIds] = useState<string[]>([]);            // temp IDs for brand-new products
  const [baseName, setBaseName] = useState("");
  const [category, setCategory] = useState("");
  const [subCategory, setSubCategory] = useState("");
  const [variants, setVariants] = useState<Record<string, VariantConfig>>({});
  const [saving, setSaving] = useState(false);

  const companyImgRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const variantImgRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // All IDs (existing selected + brand-new)
  const allIds = useMemo(
    () => [...Array.from(selectedIds), ...newItemIds],
    [selectedIds, newItemIds]
  );

  // Category cascading
  const mainCategories = useMemo(() => categories.filter((c) => !c.parent_id), [categories]);
  const selectedCatObj = useMemo(() => mainCategories.find((c) => c.name === category), [mainCategories, category]);
  const subCategories = useMemo(
    () => categories.filter((c) => c.parent_id === selectedCatObj?.id),
    [categories, selectedCatObj]
  );

  // Already-grouped products (have sizeSpec set), organized by base name
  const existingGroups = useMemo(() => {
    const grouped: Record<string, Product[]> = {};
    products
      .filter((p) => p.sizeSpec)
      .forEach((p) => {
        const key =
          p.sizeSpec && p.name.endsWith(p.sizeSpec)
            ? p.name.slice(0, p.name.length - p.sizeSpec.length).trim()
            : p.name;
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(p);
      });
    return Object.entries(grouped)
      .map(([key, prods]) => ({ key, products: prods }))
      .sort((a, b) => a.key.localeCompare(b.key));
  }, [products]);

  // Filtered + relevance-sorted product list for Step 0
  const filteredProducts = useMemo(() => {
    const tokens = search.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const base = products.filter((p) => !p.retailOnly);
    if (!tokens.length) return base;
    const matched = base.filter((p) =>
      tokens.every((token) =>
        tokenMatches(token, [p.name, p.category, p.sku, p.supplier, p.brand ?? "", p.sizeSpec ?? "", p.subCategory ?? ""])
      )
    );
    return matched.sort((a, b) => nameScore(b.name, tokens) - nameScore(a.name, tokens));
  }, [products, search]);

  // Sync existing-product variant configs when selection changes
  useEffect(() => {
    setVariants((prev) => {
      const next: Record<string, VariantConfig> = { ...prev };
      // Add new entries for newly selected products
      selectedIds.forEach((id) => {
        if (!next[id]) {
          const p = products.find((x) => x.id === id);
          if (!p) return;
          next[id] = {
            productId: id,
            isNew: false,
            originalName: p.name,
            brand: p.brand ?? "",
            sizeSpec: p.sizeSpec ?? "",
            mrp: String(p.mrp ?? ""),
            sellingPrice: "",
            supplier: p.supplier ?? "",
            companyImageFile: null,
            variantImageFile: null,
            images: p.images ?? [],
            companyImagePreview: p.images?.[0] ?? "",
            variantImagePreview: p.images?.[1] ?? "",
          };
        }
      });
      // Remove deselected products (but keep new items)
      Object.keys(next).forEach((id) => {
        if (!next[id].isNew && !selectedIds.has(id)) delete next[id];
      });
      return next;
    });
  }, [selectedIds, products]);

  const getGeneratedName = (v: VariantConfig) =>
    [v.brand, baseName.trim(), v.sizeSpec].filter(Boolean).join(" ");

  const updateVariant = (id: string, updates: Partial<VariantConfig>) =>
    setVariants((prev) => ({ ...prev, [id]: { ...prev[id], ...updates } }));

  const toggleSelect = (id: string) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const addNewItem = () => {
    const tempId = `new-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setNewItemIds((prev) => [...prev, tempId]);
    setVariants((prev) => ({ ...prev, [tempId]: makeNewVariant(tempId) }));
  };

  const removeNewItem = (tempId: string) => {
    setNewItemIds((prev) => prev.filter((id) => id !== tempId));
    setVariants((prev) => {
      const { [tempId]: _, ...rest } = prev;
      return rest;
    });
  };

  const handleImageSelect = (id: string, type: "company" | "variant", file: File) => {
    const preview = URL.createObjectURL(file);
    if (type === "company") updateVariant(id, { companyImageFile: file, companyImagePreview: preview });
    else updateVariant(id, { variantImageFile: file, variantImagePreview: preview });
  };

  const clearImage = (id: string, type: "company" | "variant") => {
    if (type === "company") {
      updateVariant(id, { companyImageFile: null, companyImagePreview: "" });
      if (companyImgRefs.current[id]) companyImgRefs.current[id]!.value = "";
    } else {
      updateVariant(id, { variantImageFile: null, variantImagePreview: "" });
      if (variantImgRefs.current[id]) variantImgRefs.current[id]!.value = "";
    }
  };

  const uploadImage = async (file: File): Promise<string> => {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    if (!res.ok) throw new Error("Upload failed");
    return (await res.json()).url as string;
  };

  const canNext = () => {
    if (step === 0) return allIds.length > 0;
    if (step === 1) return baseName.trim() !== "" && category !== "";
    if (step === 2)
      return allIds.every((id) => {
        const v = variants[id];
        return v && v.mrp !== "" && v.supplier !== "";
      });
    return true;
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const results = await Promise.allSettled(
        allIds.map(async (id) => {
          const v = variants[id];
          const finalImages = [...v.images];

          if (v.companyImageFile) finalImages[0] = await uploadImage(v.companyImageFile);
          else if (v.companyImagePreview) finalImages[0] = v.companyImagePreview;

          if (v.variantImageFile) finalImages[1] = await uploadImage(v.variantImageFile);
          else if (v.variantImagePreview) finalImages[1] = v.variantImagePreview;

          const cleanImages = finalImages.filter(Boolean);
          const generatedName = getGeneratedName(v);

          if (v.isNew) {
            const res = await fetch("/api/products", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                name: generatedName,
                brand: v.brand || undefined,
                sizeSpec: v.sizeSpec || undefined,
                category,
                subCategory: subCategory || undefined,
                mrp: Number(v.mrp) || 0,
                sellingPrice: Number(v.sellingPrice) || Number(v.mrp) || 0,
                costPrice: 0,
                supplier: v.supplier,
                images: cleanImages,
                stock: 0,
                minStock: 0,
              }),
            });
            if (!res.ok) {
              const d = await res.json();
              throw new Error(d.error ?? "Create failed");
            }
          } else {
            const res = await fetch(`/api/products/${id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                name: generatedName,
                brand: v.brand || undefined,
                sizeSpec: v.sizeSpec || undefined,
                category,
                subCategory: subCategory || undefined,
                mrp: Number(v.mrp) || 0,
                supplier: v.supplier,
                images: cleanImages,
              }),
            });
            if (!res.ok) {
              const d = await res.json();
              throw new Error(d.error ?? "Update failed");
            }
          }
        })
      );

      const failed = results.filter((r) => r.status === "rejected") as PromiseRejectedResult[];
      if (failed.length > 0) {
        toast.error(`${failed.length} item(s) failed: ${failed.map((r) => r.reason?.message).join("; ")}`);
      } else {
        const newCount = newItemIds.length;
        const updCount = Array.from(selectedIds).length;
        const parts = [];
        if (updCount) parts.push(`${updCount} updated`);
        if (newCount) parts.push(`${newCount} created`);
        toast.success(parts.join(", ") + " successfully");
        router.push("/dashboard/office/distribution/products");
      }
    } catch {
      toast.error("Failed to save products");
    } finally {
      setSaving(false);
    }
  };

  // ─── Shared card renderer (steps 2 & 3 reuse same data) ──────────────────

  const renderConfigCard = (id: string) => {
    const v = variants[id];
    if (!v) return null;
    const generatedName = getGeneratedName(v);

    return (
      <Card key={id}>
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-0.5">
                {v.isNew ? (
                  <Badge className="text-xs bg-green-100 text-green-700 border-green-300 h-5">
                    <Sparkles className="w-2.5 h-2.5 mr-1" /> NEW
                  </Badge>
                ) : (
                  <span className="text-xs text-muted-foreground">Original: {v.originalName}</span>
                )}
              </div>
              <p className={`text-sm font-semibold truncate ${generatedName ? "text-blue-700" : "text-muted-foreground italic"}`}>
                {generatedName || "Fill brand & spec to preview name"}
              </p>
            </div>
            {(v.companyImagePreview || v.variantImagePreview) && (
              <div className="flex gap-1.5 shrink-0">
                {v.companyImagePreview && (
                  <img src={v.companyImagePreview} alt="Company" className="w-10 h-10 rounded border object-cover" />
                )}
                {v.variantImagePreview && (
                  <img src={v.variantImagePreview} alt="Variant" className="w-10 h-10 rounded border object-cover" />
                )}
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Brand + Spec */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Brand</Label>
              <Select value={v.brand} onValueChange={(val) => updateVariant(id, { brand: val })}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Select brand" /></SelectTrigger>
                <SelectContent>
                  {brands.filter((b) => !b.parent_id).map((b) => (
                    <SelectItem key={b.id} value={b.name}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Specification <span className="text-red-500">*</span></Label>
              <Select value={v.sizeSpec} onValueChange={(val) => updateVariant(id, { sizeSpec: val })}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Select spec" /></SelectTrigger>
                <SelectContent>
                  {specs.map((s) => (
                    <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* MRP + Selling Price */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">MRP (Rs.) <span className="text-red-500">*</span></Label>
              <Input className="h-9" type="number" placeholder="0.00" value={v.mrp}
                onChange={(e) => updateVariant(id, { mrp: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">
                Selling Price (Rs.)
                {v.isNew && <span className="text-muted-foreground ml-1">(defaults to MRP)</span>}
              </Label>
              <Input className="h-9" type="number" placeholder={v.mrp || "0.00"} value={v.sellingPrice}
                onChange={(e) => updateVariant(id, { sellingPrice: e.target.value })} />
            </div>
          </div>

          {/* Supplier */}
          <div className="space-y-1">
            <Label className="text-xs">Supplier <span className="text-red-500">*</span></Label>
            <Select value={v.supplier} onValueChange={(val) => updateVariant(id, { supplier: val })}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Select supplier" /></SelectTrigger>
              <SelectContent>
                {suppliers.map((s) => (
                  <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Images */}
          <div className="grid grid-cols-2 gap-3">
            {(["company", "variant"] as const).map((type) => {
              const preview = type === "company" ? v.companyImagePreview : v.variantImagePreview;
              const refs = type === "company" ? companyImgRefs : variantImgRefs;
              return (
                <div key={type} className="space-y-1.5">
                  <Label className="text-xs flex items-center gap-1">
                    <ImageIcon className="w-3 h-3" />
                    {type === "company" ? "Company Image" : "Variant Image"}
                  </Label>
                  <div className="flex items-center gap-3 p-3 border rounded-lg bg-gray-50">
                    {preview ? (
                      <div className="relative w-14 h-14 rounded border overflow-hidden shrink-0">
                        <img src={preview} alt={type} className="w-full h-full object-cover" />
                        <button type="button" onClick={() => clearImage(id, type)}
                          className="absolute top-0 right-0 bg-red-500 text-white rounded-bl-md w-5 h-5 flex items-center justify-center">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <div className="w-14 h-14 rounded border-2 border-dashed bg-white flex items-center justify-center shrink-0">
                        <ImageIcon className="w-5 h-5 text-gray-300" />
                      </div>
                    )}
                    <Button type="button" variant="outline" size="sm" onClick={() => refs.current[id]?.click()}>
                      <Upload className="w-3.5 h-3.5 mr-1.5" /> Upload
                    </Button>
                    <input
                      ref={(el) => { refs.current[id] = el; }}
                      type="file" accept="image/*" className="hidden"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageSelect(id, type, f); }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    );
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm"
          onClick={() => router.push("/dashboard/office/distribution/products")} className="gap-2">
          <ArrowLeft className="w-4 h-4" /> Back to Products
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Layers className="w-6 h-6 text-blue-600" />
            Advanced Product Management
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Select existing products and/or create new variants — then apply brand, spec, pricing and images as a group.
          </p>
        </div>
      </div>

      {/* Step Indicator */}
      <div className="flex items-stretch gap-0 rounded-xl border overflow-hidden">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          const isComplete = i < step;
          const isActive = i === step;
          return (
            <div key={i} className={`flex-1 flex items-center gap-3 px-5 py-4 border-r last:border-r-0 transition-colors ${
              isComplete ? "bg-green-50 border-b-2 border-b-green-500"
                : isActive ? "bg-blue-50 border-b-2 border-b-blue-600" : "bg-white"
            }`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                isComplete ? "bg-green-500 text-white" : isActive ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-400"
              }`}>
                {isComplete ? <Check className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
              </div>
              <div>
                <p className={`text-sm font-semibold ${isActive ? "text-blue-700" : isComplete ? "text-green-700" : "text-gray-400"}`}>
                  {s.label}
                </p>
                <p className="text-xs text-muted-foreground">{s.description}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Step Content */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">

          {/* ── STEP 0: Select Items ─────────────────────────────────────── */}
          {step === 0 && (
            <>
              {/* Select existing products */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Select Existing Products</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Choose products already in the system that belong to this group.
                  </p>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by name, SKU, brand, spec… (e.g. 1/113, 113mm Brown)"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="pl-9"
                    />
                  </div>

                  <div className="border rounded-lg divide-y max-h-80 overflow-y-auto">
                    {loadingProducts && (
                      <div className="flex items-center justify-center py-8 gap-2 text-sm text-muted-foreground">
                        <Loader2 className="w-4 h-4 animate-spin" /> Loading…
                      </div>
                    )}
                    {!loadingProducts && filteredProducts.length === 0 && (
                      <div className="py-8 text-center text-sm text-muted-foreground">No products found</div>
                    )}
                    {filteredProducts.map((p) => (
                      <label key={p.id} className={`flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/40 transition-colors ${
                        selectedIds.has(p.id) ? "bg-blue-50" : ""
                      }`}>
                        <Checkbox checked={selectedIds.has(p.id)} onCheckedChange={() => toggleSelect(p.id)} />
                        {p.images?.[0] && (
                          <img src={p.images[0]} alt={p.name} className="w-9 h-9 rounded object-cover border shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{p.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {p.sku} · {p.category}
                            {p.brand ? ` · ${p.brand}` : ""}
                            {p.sizeSpec ? ` · ${p.sizeSpec}` : ""}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-semibold">Rs.{p.mrp}</p>
                          <p className="text-xs text-muted-foreground">{p.supplier}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Add new variants */}
              <Card className="border-dashed border-2">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-green-600" />
                    Add New Variants
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Create brand-new product entries that don't exist yet — they'll be saved when you finish the wizard.
                  </p>
                </CardHeader>
                <CardContent className="space-y-2">
                  {newItemIds.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-2">No new variants added yet.</p>
                  )}
                  {newItemIds.map((id, idx) => (
                    <div key={id} className="flex items-center gap-3 px-4 py-3 rounded-lg border bg-green-50 border-green-200">
                      <div className="w-7 h-7 rounded-full bg-green-500 text-white flex items-center justify-center shrink-0 text-xs font-bold">
                        {idx + 1}
                      </div>
                      <p className="text-sm font-medium text-green-800 flex-1">New Variant #{idx + 1}</p>
                      <Badge variant="outline" className="text-xs text-green-700 border-green-400">To Create</Badge>
                      <button type="button" onClick={() => removeNewItem(id)}
                        className="text-red-400 hover:text-red-600 transition-colors">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  <Button variant="outline" className="w-full mt-2" onClick={addNewItem}>
                    <Plus className="w-4 h-4 mr-2" /> Add New Variant
                  </Button>
                </CardContent>
              </Card>

              {/* Existing groups reference */}
              {existingGroups.length > 0 && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Layers className="w-4 h-4 text-violet-600" />
                      Existing Product Groups
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Products already grouped via Advanced Product Management.
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-3 p-0 pb-4">
                    {existingGroups.map(({ key, products: groupProds }) => (
                      <div key={key} className="border-t first:border-t-0">
                        <div className="flex items-center gap-2 px-6 py-2.5 bg-violet-50">
                          <Layers className="w-3.5 h-3.5 text-violet-600 shrink-0" />
                          <span className="text-sm font-semibold text-violet-900 flex-1">{key}</span>
                          <span className="text-xs text-violet-600 font-medium">
                            {groupProds.length} variant{groupProds.length !== 1 ? "s" : ""}
                          </span>
                        </div>
                        <div className="divide-y">
                          {groupProds.map((p) => (
                            <div key={p.id} className="flex items-center gap-3 px-6 py-2">
                              {p.images?.[0] ? (
                                <img src={p.images[0]} alt={p.name} className="w-8 h-8 rounded object-cover border shrink-0" />
                              ) : (
                                <div className="w-8 h-8 rounded border bg-muted flex items-center justify-center shrink-0">
                                  <span className="text-[9px] text-muted-foreground">No img</span>
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{p.name}</p>
                                <p className="text-xs text-muted-foreground">{p.supplier}</p>
                              </div>
                              {p.sizeSpec && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-blue-100 text-blue-700 shrink-0">
                                  {p.sizeSpec}
                                </span>
                              )}
                              <span className="text-xs text-muted-foreground shrink-0">Rs.{p.mrp}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </>
          )}

          {/* ── STEP 1: Group Info ───────────────────────────────────────── */}
          {step === 1 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Product Group Information</CardTitle>
                <p className="text-sm text-muted-foreground">
                  The final name for each item will be:{" "}
                  <span className="font-semibold text-foreground">Brand + Base Name + Specification</span>
                </p>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm">
                  <span className="font-semibold text-amber-800">Example: </span>
                  <span className="text-amber-700">
                    Base name <strong>"One Gang Switch"</strong> + brand <strong>"Orange"</strong> + spec <strong>"White"</strong>
                    {" "}→ <strong>Orange One Gang Switch White</strong>
                  </span>
                </div>
                <div className="space-y-1.5">
                  <Label>Base Name <span className="text-red-500">*</span></Label>
                  <Input placeholder="e.g. One Gang Switch, Two Gang Socket…"
                    value={baseName} onChange={(e) => setBaseName(e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Category <span className="text-red-500">*</span></Label>
                    <Select value={category} onValueChange={(v) => { setCategory(v); setSubCategory(""); }}>
                      <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                      <SelectContent>
                        {mainCategories.map((c) => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Sub-Category</Label>
                    <Select value={subCategory} onValueChange={setSubCategory} disabled={subCategories.length === 0}>
                      <SelectTrigger>
                        <SelectValue placeholder={subCategories.length === 0 ? "None available" : "Select sub-category"} />
                      </SelectTrigger>
                      <SelectContent>
                        {subCategories.map((c) => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ── STEP 2: Configure Items ──────────────────────────────────── */}
          {step === 2 && (
            <div className="space-y-4">
              {allIds.map((id) => renderConfigCard(id))}
            </div>
          )}

          {/* ── STEP 3: Summary ─────────────────────────────────────────── */}
          {step === 3 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Review Before Saving</CardTitle>
                <p className="text-sm text-muted-foreground">
                  {Array.from(selectedIds).length > 0 && `${Array.from(selectedIds).length} existing product(s) will be updated. `}
                  {newItemIds.length > 0 && `${newItemIds.length} new product(s) will be created.`}
                </p>
              </CardHeader>
              <CardContent>
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left px-4 py-2.5 font-medium text-xs text-muted-foreground w-6"></th>
                        <th className="text-left px-4 py-2.5 font-medium text-xs text-muted-foreground">Name</th>
                        <th className="text-left px-4 py-2.5 font-medium text-xs text-muted-foreground">Spec</th>
                        <th className="text-right px-4 py-2.5 font-medium text-xs text-muted-foreground">MRP</th>
                        <th className="text-left px-4 py-2.5 font-medium text-xs text-muted-foreground">Supplier</th>
                        <th className="text-center px-4 py-2.5 font-medium text-xs text-muted-foreground">Imgs</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {allIds.map((id) => {
                        const v = variants[id];
                        if (!v) return null;
                        const name = getGeneratedName(v);
                        const hasCompanyImg = !!(v.companyImageFile || v.companyImagePreview);
                        const hasVariantImg = !!(v.variantImageFile || v.variantImagePreview);
                        return (
                          <tr key={id} className="hover:bg-muted/30">
                            <td className="px-3 py-3">
                              {v.isNew ? (
                                <span title="New product" className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-green-100">
                                  <Sparkles className="w-3 h-3 text-green-600" />
                                </span>
                              ) : (
                                <span title="Existing product" className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-100">
                                  <Package className="w-3 h-3 text-blue-600" />
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <p className="font-medium leading-tight">{name || "—"}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {v.isNew ? "will be created" : `was: ${v.originalName}`}
                              </p>
                            </td>
                            <td className="px-4 py-3 text-xs">{v.sizeSpec || "—"}</td>
                            <td className="px-4 py-3 text-right font-semibold">Rs.{v.mrp || "0"}</td>
                            <td className="px-4 py-3 text-xs">{v.supplier || "—"}</td>
                            <td className="px-4 py-3">
                              <div className="flex items-center justify-center gap-1.5">
                                <span className={`w-2 h-2 rounded-full ${hasCompanyImg ? "bg-green-500" : "bg-gray-300"}`} title="Company img" />
                                <span className={`w-2 h-2 rounded-full ${hasVariantImg ? "bg-green-500" : "bg-gray-300"}`} title="Variant img" />
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* ── Right Sidebar ─────────────────────────────────────────────── */}
        <div className="space-y-4">
          <Card className="sticky top-4">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Group Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div className="p-2 bg-blue-50 rounded-lg text-center">
                  <p className="text-lg font-bold text-blue-700">{Array.from(selectedIds).length}</p>
                  <p className="text-xs text-blue-600">Existing</p>
                </div>
                <div className="p-2 bg-green-50 rounded-lg text-center">
                  <p className="text-lg font-bold text-green-700">{newItemIds.length}</p>
                  <p className="text-xs text-green-600">New</p>
                </div>
              </div>

              {baseName && (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Base Name</p>
                  <p className="font-medium">{baseName}</p>
                </div>
              )}
              {category && (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Category</p>
                  <p className="font-medium">{category}{subCategory ? ` › ${subCategory}` : ""}</p>
                </div>
              )}

              {step >= 1 && baseName && allIds.length > 0 && (
                <div className="space-y-1.5 pt-1 border-t">
                  <p className="text-xs text-muted-foreground">All Items</p>
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {allIds.map((id) => {
                      const v = variants[id];
                      if (!v) return null;
                      const name = getGeneratedName(v);
                      return (
                        <div key={id} className="flex items-center gap-2">
                          <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${name ? "bg-green-500" : "bg-amber-400"}`} />
                          <p className="text-xs truncate">{name || (v.isNew ? "New Variant" : v.originalName)}</p>
                          {v.isNew && <Sparkles className="w-3 h-3 text-green-500 shrink-0" />}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick selection chips (Step 0) */}
          {step === 0 && allIds.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">In Group ({allIds.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-1.5">
                  {Array.from(selectedIds).map((id) => {
                    const p = products.find((x) => x.id === id);
                    return (
                      <Badge key={id} variant="secondary"
                        className="cursor-pointer text-xs hover:bg-red-100 hover:text-red-700"
                        onClick={() => toggleSelect(id)}>
                        {p?.name ?? id} ×
                      </Badge>
                    );
                  })}
                  {newItemIds.map((id, idx) => (
                    <Badge key={id}
                      className="cursor-pointer text-xs bg-green-100 text-green-700 border-green-300 hover:bg-red-100 hover:text-red-700"
                      onClick={() => removeNewItem(id)}>
                      <Sparkles className="w-2.5 h-2.5 mr-1" /> New #{idx + 1} ×
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Navigation Footer */}
      <div className="flex justify-between items-center py-4 border-t">
        <Button variant="outline" disabled={saving}
          onClick={() => step === 0 ? router.push("/dashboard/office/distribution/products") : setStep((s) => s - 1)}>
          <ChevronLeft className="w-4 h-4 mr-1" />
          {step === 0 ? "Cancel" : "Back"}
        </Button>

        <span className="text-xs text-muted-foreground">Step {step + 1} of {STEPS.length}</span>

        {step < STEPS.length - 1 ? (
          <Button onClick={() => setStep((s) => s + 1)} disabled={!canNext()}>
            Next <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        ) : (
          <Button onClick={handleSave} disabled={saving || allIds.length === 0}>
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Save {allIds.length} Product{allIds.length !== 1 ? "s" : ""}
          </Button>
        )}
      </div>
    </div>
  );
}
