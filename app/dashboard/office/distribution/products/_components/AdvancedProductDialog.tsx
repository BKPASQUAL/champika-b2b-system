"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
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
} from "lucide-react";
import { Product } from "../types";

interface CategoryItem {
  id: string;
  name: string;
  parent_id?: string;
  category_id?: string;
}

interface VariantConfig {
  productId: string;
  originalName: string;
  brand: string;
  sizeSpec: string;
  mrp: string;
  supplier: string;
  companyImageFile: File | null;
  variantImageFile: File | null;
  images: string[];
  companyImagePreview: string;
  variantImagePreview: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  products: Product[];
  categories: CategoryItem[];
  suppliers: { id: string; name: string }[];
  onSuccess: () => void;
}

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

const STEPS = [
  { label: "Select Items", icon: ListChecks },
  { label: "Group Info", icon: Tag },
  { label: "Configure Items", icon: Package },
  { label: "Summary", icon: Check },
];

export function AdvancedProductDialog({
  open,
  onOpenChange,
  products,
  categories,
  suppliers,
  onSuccess,
}: Props) {
  const [step, setStep] = useState(0);
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [baseName, setBaseName] = useState("");
  const [category, setCategory] = useState("");
  const [subCategory, setSubCategory] = useState("");
  const [variants, setVariants] = useState<Record<string, VariantConfig>>({});
  const [saving, setSaving] = useState(false);
  const companyImgRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const variantImgRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const brands = useSettings("brand");
  const specs = useSettings("spec");

  const mainCategories = useMemo(
    () => categories.filter((c) => !c.parent_id),
    [categories]
  );
  const selectedCatObj = useMemo(
    () => mainCategories.find((c) => c.name === category),
    [mainCategories, category]
  );
  const subCategories = useMemo(
    () => categories.filter((c) => c.parent_id === selectedCatObj?.id),
    [categories, selectedCatObj]
  );

  const filteredProducts = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return products.filter((p) => !p.retailOnly);
    return products.filter(
      (p) =>
        !p.retailOnly &&
        (p.name.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q) ||
          (p.brand ?? "").toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q))
    );
  }, [products, search]);

  // Build/preserve variant configs when selection changes
  useEffect(() => {
    setVariants((prev) => {
      const next: Record<string, VariantConfig> = {};
      selectedIds.forEach((id) => {
        const p = products.find((x) => x.id === id);
        if (!p) return;
        next[id] = prev[id] ?? {
          productId: id,
          originalName: p.name,
          brand: p.brand ?? "",
          sizeSpec: p.sizeSpec ?? "",
          mrp: String(p.mrp ?? ""),
          supplier: p.supplier ?? "",
          companyImageFile: null,
          variantImageFile: null,
          images: p.images ?? [],
          companyImagePreview: p.images?.[0] ?? "",
          variantImagePreview: p.images?.[1] ?? "",
        };
      });
      return next;
    });
  }, [selectedIds, products]);

  const getGeneratedName = (v: VariantConfig) =>
    [v.brand, baseName.trim(), v.sizeSpec].filter(Boolean).join(" ");

  const updateVariant = (id: string, updates: Partial<VariantConfig>) =>
    setVariants((prev) => ({ ...prev, [id]: { ...prev[id], ...updates } }));

  const handleImageSelect = (
    id: string,
    type: "company" | "variant",
    file: File
  ) => {
    const preview = URL.createObjectURL(file);
    if (type === "company") {
      updateVariant(id, { companyImageFile: file, companyImagePreview: preview });
    } else {
      updateVariant(id, { variantImageFile: file, variantImagePreview: preview });
    }
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
    const data = await res.json();
    return data.url as string;
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const entries = Array.from(selectedIds);
      const results = await Promise.allSettled(
        entries.map(async (id) => {
          const v = variants[id];
          const finalImages = [...v.images];

          if (v.companyImageFile) {
            const url = await uploadImage(v.companyImageFile);
            finalImages[0] = url;
          } else if (v.companyImagePreview && !finalImages[0]) {
            finalImages[0] = v.companyImagePreview;
          }

          if (v.variantImageFile) {
            const url = await uploadImage(v.variantImageFile);
            finalImages[1] = url;
          } else if (v.variantImagePreview && !finalImages[1]) {
            finalImages[1] = v.variantImagePreview;
          }

          const cleanImages = finalImages.filter(Boolean);

          const res = await fetch(`/api/products/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: getGeneratedName(v),
              brand: v.brand || undefined,
              sizeSpec: v.sizeSpec || undefined,
              category: category || undefined,
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
        })
      );

      const failed = results.filter((r) => r.status === "rejected");
      if (failed.length > 0) {
        const msgs = (failed as PromiseRejectedResult[]).map((r) => r.reason?.message).join("; ");
        toast.error(`${failed.length} item(s) failed: ${msgs}`);
      } else {
        toast.success(`${entries.length} product(s) updated successfully`);
        onSuccess();
        handleClose();
      }
    } catch {
      toast.error("Failed to save products");
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setStep(0);
    setSearch("");
    setSelectedIds(new Set());
    setBaseName("");
    setCategory("");
    setSubCategory("");
    setVariants({});
    onOpenChange(false);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const canNext = () => {
    if (step === 0) return selectedIds.size > 0;
    if (step === 1) return baseName.trim() !== "" && category !== "";
    if (step === 2)
      return Array.from(selectedIds).every((id) => {
        const v = variants[id];
        return v && v.mrp !== "" && v.supplier !== "";
      });
    return true;
  };

  const selectedProducts = products.filter((p) => selectedIds.has(p.id));

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl flex flex-col" style={{ maxHeight: "88vh" }}>
        <DialogHeader className="shrink-0">
          <DialogTitle className="text-lg font-semibold">
            Advanced Product Management
          </DialogTitle>
        </DialogHeader>

        {/* Step Indicator */}
        <div className="flex items-center shrink-0 mb-2">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            return (
              <div key={i} className="flex items-center">
                <div
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    i < step
                      ? "bg-green-100 text-green-700"
                      : i === step
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 text-gray-400"
                  }`}
                >
                  {i < step ? (
                    <Check className="w-3 h-3" />
                  ) : (
                    <Icon className="w-3 h-3" />
                  )}
                  <span>{s.label}</span>
                </div>
                {i < STEPS.length - 1 && (
                  <ChevronRight className="w-4 h-4 text-gray-300 mx-1" />
                )}
              </div>
            );
          })}
        </div>

        {/* Step Content */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {/* STEP 0: Select Items */}
          {step === 0 && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Select existing products to combine into a product group.
              </p>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, category, brand, SKU…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>

              {selectedIds.size > 0 && (
                <div className="flex flex-wrap gap-1 p-2 bg-blue-50 rounded-lg border border-blue-200">
                  <span className="text-xs text-blue-600 font-medium mr-1">
                    Selected ({selectedIds.size}):
                  </span>
                  {Array.from(selectedIds).map((id) => {
                    const p = products.find((x) => x.id === id);
                    return (
                      <Badge
                        key={id}
                        variant="secondary"
                        className="text-xs cursor-pointer hover:bg-red-100"
                        onClick={() => toggleSelect(id)}
                      >
                        {p?.name ?? id} ×
                      </Badge>
                    );
                  })}
                </div>
              )}

              <div className="border rounded-lg divide-y max-h-80 overflow-y-auto">
                {filteredProducts.length === 0 && (
                  <div className="py-8 text-center text-sm text-muted-foreground">
                    No products found
                  </div>
                )}
                {filteredProducts.map((p) => (
                  <label
                    key={p.id}
                    className={`flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/50 transition-colors ${
                      selectedIds.has(p.id) ? "bg-blue-50" : ""
                    }`}
                  >
                    <Checkbox
                      checked={selectedIds.has(p.id)}
                      onCheckedChange={() => toggleSelect(p.id)}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{p.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {p.sku} · {p.category}
                        {p.brand ? ` · ${p.brand}` : ""}
                        {p.sizeSpec ? ` · ${p.sizeSpec}` : ""}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs font-medium">MRP: Rs.{p.mrp}</p>
                      <p className="text-xs text-muted-foreground">{p.supplier}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* STEP 1: Group Info */}
          {step === 1 && (
            <div className="space-y-5">
              <p className="text-sm text-muted-foreground">
                Set the common base name and category for this product group. The
                final product name will be:{" "}
                <span className="font-medium text-foreground">
                  Brand + Base Name + Specification
                </span>
              </p>

              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm">
                <span className="font-medium text-amber-800">Example: </span>
                <span className="text-amber-700">
                  If you type "One Gang Switch" as base name, select brand
                  "Orange" and spec "White" → product becomes{" "}
                  <strong>Orange One Gang Switch White</strong>
                </span>
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label>
                    Base Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    placeholder="e.g. One Gang Switch, Two Gang Socket…"
                    value={baseName}
                    onChange={(e) => setBaseName(e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>
                      Category <span className="text-red-500">*</span>
                    </Label>
                    <Select
                      value={category}
                      onValueChange={(v) => {
                        setCategory(v);
                        setSubCategory("");
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        {mainCategories.map((c) => (
                          <SelectItem key={c.id} value={c.name}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label>Sub-Category</Label>
                    <Select
                      value={subCategory}
                      onValueChange={setSubCategory}
                      disabled={subCategories.length === 0}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select sub-category" />
                      </SelectTrigger>
                      <SelectContent>
                        {subCategories.map((c) => (
                          <SelectItem key={c.id} value={c.name}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <div className="p-3 bg-gray-50 rounded-lg border">
                <p className="text-xs text-muted-foreground mb-2 font-medium">
                  Selected items ({selectedIds.size}):
                </p>
                <div className="flex flex-wrap gap-1">
                  {selectedProducts.map((p) => (
                    <Badge key={p.id} variant="outline" className="text-xs">
                      {p.name}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Configure Items */}
          {step === 2 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Configure brand, specification, price, supplier, and images for
                each item.
              </p>

              {Array.from(selectedIds).map((id) => {
                const v = variants[id];
                if (!v) return null;
                const generatedName = getGeneratedName(v);

                return (
                  <div
                    key={id}
                    className="border rounded-lg p-4 space-y-4 bg-gray-50/50"
                  >
                    {/* Header */}
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-xs text-muted-foreground">
                          Original: {v.originalName}
                        </p>
                        <p className="text-sm font-semibold text-blue-700 mt-0.5">
                          {generatedName || (
                            <span className="text-muted-foreground italic">
                              (fill brand/spec to preview name)
                            </span>
                          )}
                        </p>
                      </div>
                    </div>

                    {/* Brand + Spec Row */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Brand</Label>
                        <Select
                          value={v.brand}
                          onValueChange={(val) =>
                            updateVariant(id, { brand: val })
                          }
                        >
                          <SelectTrigger className="h-8 text-sm">
                            <SelectValue placeholder="Select brand" />
                          </SelectTrigger>
                          <SelectContent>
                            {brands
                              .filter((b) => !b.parent_id)
                              .map((b) => (
                                <SelectItem key={b.id} value={b.name}>
                                  {b.name}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1">
                        <Label className="text-xs">
                          Specification{" "}
                          <span className="text-red-500">*</span>
                        </Label>
                        <Select
                          value={v.sizeSpec}
                          onValueChange={(val) =>
                            updateVariant(id, { sizeSpec: val })
                          }
                        >
                          <SelectTrigger className="h-8 text-sm">
                            <SelectValue placeholder="Select spec" />
                          </SelectTrigger>
                          <SelectContent>
                            {specs.map((s) => (
                              <SelectItem key={s.id} value={s.name}>
                                {s.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* MRP + Supplier Row */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">
                          MRP (Rs.) <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          className="h-8 text-sm"
                          type="number"
                          placeholder="0.00"
                          value={v.mrp}
                          onChange={(e) =>
                            updateVariant(id, { mrp: e.target.value })
                          }
                        />
                      </div>

                      <div className="space-y-1">
                        <Label className="text-xs">
                          Supplier <span className="text-red-500">*</span>
                        </Label>
                        <Select
                          value={v.supplier}
                          onValueChange={(val) =>
                            updateVariant(id, { supplier: val })
                          }
                        >
                          <SelectTrigger className="h-8 text-sm">
                            <SelectValue placeholder="Select supplier" />
                          </SelectTrigger>
                          <SelectContent>
                            {suppliers.map((s) => (
                              <SelectItem key={s.id} value={s.name}>
                                {s.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Images Row */}
                    <div className="grid grid-cols-2 gap-3">
                      {/* Company Image */}
                      <div className="space-y-1">
                        <Label className="text-xs flex items-center gap-1">
                          <ImageIcon className="w-3 h-3" /> Company Image
                        </Label>
                        <div className="flex items-center gap-2">
                          {v.companyImagePreview ? (
                            <div className="relative w-12 h-12 rounded border overflow-hidden">
                              <img
                                src={v.companyImagePreview}
                                alt="Company"
                                className="w-full h-full object-cover"
                              />
                              <button
                                type="button"
                                onClick={() => clearImage(id, "company")}
                                className="absolute top-0 right-0 bg-red-500 text-white rounded-bl w-4 h-4 flex items-center justify-center"
                              >
                                <X className="w-2.5 h-2.5" />
                              </button>
                            </div>
                          ) : (
                            <div className="w-12 h-12 rounded border border-dashed bg-gray-100 flex items-center justify-center">
                              <ImageIcon className="w-4 h-4 text-gray-400" />
                            </div>
                          )}
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() =>
                              companyImgRefs.current[id]?.click()
                            }
                          >
                            <Upload className="w-3 h-3 mr-1" /> Upload
                          </Button>
                          <input
                            ref={(el) => {
                              companyImgRefs.current[id] = el;
                            }}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) handleImageSelect(id, "company", f);
                            }}
                          />
                        </div>
                      </div>

                      {/* Variant Image */}
                      <div className="space-y-1">
                        <Label className="text-xs flex items-center gap-1">
                          <ImageIcon className="w-3 h-3" /> Variant Image
                        </Label>
                        <div className="flex items-center gap-2">
                          {v.variantImagePreview ? (
                            <div className="relative w-12 h-12 rounded border overflow-hidden">
                              <img
                                src={v.variantImagePreview}
                                alt="Variant"
                                className="w-full h-full object-cover"
                              />
                              <button
                                type="button"
                                onClick={() => clearImage(id, "variant")}
                                className="absolute top-0 right-0 bg-red-500 text-white rounded-bl w-4 h-4 flex items-center justify-center"
                              >
                                <X className="w-2.5 h-2.5" />
                              </button>
                            </div>
                          ) : (
                            <div className="w-12 h-12 rounded border border-dashed bg-gray-100 flex items-center justify-center">
                              <ImageIcon className="w-4 h-4 text-gray-400" />
                            </div>
                          )}
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() =>
                              variantImgRefs.current[id]?.click()
                            }
                          >
                            <Upload className="w-3 h-3 mr-1" /> Upload
                          </Button>
                          <input
                            ref={(el) => {
                              variantImgRefs.current[id] = el;
                            }}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) handleImageSelect(id, "variant", f);
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* STEP 3: Summary */}
          {step === 3 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Review all items before saving. Each product below will be
                updated with its new name, pricing, supplier, and images.
              </p>

              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                  <div>
                    <span className="text-muted-foreground">Base Name: </span>
                    <span className="font-medium">{baseName}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Category: </span>
                    <span className="font-medium">
                      {category}
                      {subCategory ? ` > ${subCategory}` : ""}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">
                      Total Products:{" "}
                    </span>
                    <span className="font-medium">{selectedIds.size}</span>
                  </div>
                </div>
              </div>

              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium text-xs text-muted-foreground">
                        New Name
                      </th>
                      <th className="text-left px-3 py-2 font-medium text-xs text-muted-foreground">
                        Spec
                      </th>
                      <th className="text-right px-3 py-2 font-medium text-xs text-muted-foreground">
                        MRP
                      </th>
                      <th className="text-left px-3 py-2 font-medium text-xs text-muted-foreground">
                        Supplier
                      </th>
                      <th className="text-center px-3 py-2 font-medium text-xs text-muted-foreground">
                        Images
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {Array.from(selectedIds).map((id) => {
                      const v = variants[id];
                      if (!v) return null;
                      const name = getGeneratedName(v);
                      const hasCompanyImg = !!(
                        v.companyImageFile || v.companyImagePreview
                      );
                      const hasVariantImg = !!(
                        v.variantImageFile || v.variantImagePreview
                      );
                      return (
                        <tr key={id} className="hover:bg-muted/30">
                          <td className="px-3 py-2.5">
                            <p className="font-medium leading-tight">{name || "—"}</p>
                            <p className="text-xs text-muted-foreground">
                              was: {v.originalName}
                            </p>
                          </td>
                          <td className="px-3 py-2.5 text-xs">{v.sizeSpec || "—"}</td>
                          <td className="px-3 py-2.5 text-right font-medium">
                            Rs.{v.mrp || "0"}
                          </td>
                          <td className="px-3 py-2.5 text-xs">{v.supplier || "—"}</td>
                          <td className="px-3 py-2.5 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <span
                                className={`w-2 h-2 rounded-full ${hasCompanyImg ? "bg-green-500" : "bg-gray-300"}`}
                                title="Company image"
                              />
                              <span
                                className={`w-2 h-2 rounded-full ${hasVariantImg ? "bg-green-500" : "bg-gray-300"}`}
                                title="Variant image"
                              />
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Navigation Footer */}
        <div className="flex justify-between items-center pt-4 border-t shrink-0">
          <Button
            variant="outline"
            onClick={() => (step === 0 ? handleClose() : setStep((s) => s - 1))}
            disabled={saving}
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            {step === 0 ? "Cancel" : "Back"}
          </Button>

          <span className="text-xs text-muted-foreground">
            Step {step + 1} of {STEPS.length}
          </span>

          {step < STEPS.length - 1 ? (
            <Button onClick={() => setStep((s) => s + 1)} disabled={!canNext()}>
              Next <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          ) : (
            <Button onClick={handleSave} disabled={saving || selectedIds.size === 0}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save {selectedIds.size} Product{selectedIds.size !== 1 ? "s" : ""}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
