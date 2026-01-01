"use client";

import { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch"; // Import Switch
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Camera, Upload, X, Loader2 } from "lucide-react";
import { Product, ProductFormData } from "../types";
import { toast } from "sonner";

// Helper hook to fetch settings
const useSettings = (type: string) => {
  const [data, setData] = useState<
    { id: string; name: string; parent_id?: string; category_id?: string }[]
  >([]);

  useEffect(() => {
    fetch(`/api/settings/categories?type=${type}`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setData(data);
      })
      .catch((err) => console.error(err));
  }, [type]);

  return data;
};

interface ProductDialogsProps {
  isAddDialogOpen: boolean;
  setIsAddDialogOpen: (open: boolean) => void;
  formData: ProductFormData;
  setFormData: (data: ProductFormData) => void;
  onSave: () => void;
  selectedProduct: Product | null;
  suppliers: { id: string; name: string }[];
  categories: { id: string; name: string; parent_id?: string }[];
}

export function ProductDialogs({
  isAddDialogOpen,
  setIsAddDialogOpen,
  formData,
  setFormData,
  onSave,
  selectedProduct,
  suppliers,
  categories,
}: ProductDialogsProps) {
  // --- 1. Fetch Configuration Data ---
  const brands = useSettings("brand");
  const models = useSettings("model");
  const specs = useSettings("spec");

  // --- 2. Filter Hierarchies ---

  // Category Logic
  const mainCategories = categories.filter((c) => !c.parent_id);
  const selectedCatId = mainCategories.find(
    (c) => c.name === formData.category
  )?.id;
  const subCategories = categories.filter(
    (c) => c.parent_id && c.parent_id === selectedCatId
  );

  // Brand Logic (remains independent)
  const mainBrands = brands.filter((b) => !b.parent_id);
  const selectedBrandId = mainBrands.find((b) => b.name === formData.brand)?.id;
  const subBrands = brands.filter(
    (b) => b.parent_id && b.parent_id === selectedBrandId
  );

  // Model Logic - Filter by Category
  const categoryModels = models.filter((m) => {
    return !m.parent_id && m.category_id === selectedCatId;
  });

  const selectedModelId = categoryModels.find(
    (m) => m.name.trim() === formData.modelType?.trim()
  )?.id;

  const subModels = models.filter(
    (m) => m.parent_id && m.parent_id === selectedModelId
  );

  // Specification Logic - Filter by Category
  const categorySpecs = specs.filter((s) => {
    return s.category_id === selectedCatId;
  });

  // Image Upload Logic
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    if (formData.images.length + files.length > 6) {
      toast.error("Maximum 6 images allowed");
      return;
    }
    setUploading(true);
    const uploadedUrls: string[] = [];
    try {
      for (const file of Array.from(files)) {
        const uploadData = new FormData();
        uploadData.append("file", file);
        const res = await fetch("/api/upload", {
          method: "POST",
          body: uploadData,
        });
        if (!res.ok) throw new Error("Upload failed");
        const data = await res.json();
        uploadedUrls.push(data.url);
      }
      setFormData({
        ...formData,
        images: [...formData.images, ...uploadedUrls],
      });
      toast.success("Images uploaded");
    } catch (error) {
      toast.error("Failed to upload image");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removeImage = (index: number) => {
    const newImages = formData.images.filter((_, i) => i !== index);
    setFormData({ ...formData, images: newImages });
  };

  const maxImages = 6;
  const showUpload = formData.images.length < maxImages;
  const emptySlotsCount =
    maxImages - formData.images.length - (showUpload ? 1 : 0);
  const emptySlots = Array.from({ length: Math.max(0, emptySlotsCount) });

  return (
    <>
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="max-w-3xl  overflow-y-auto">
          <DialogHeader>
            <div className="flex justify-between items-center pr-8">
              <div>
                <DialogTitle>
                  {selectedProduct ? "Edit Product" : "Add New Product"}
                </DialogTitle>
              </div>

              {/* --- ACTIVE STATUS TOGGLE --- */}
              <div className="flex items-center space-x-2 border p-2 rounded-lg bg-muted/50">
                <Switch
                  id="active-mode"
                  checked={formData.isActive}
                  onCheckedChange={(val) =>
                    setFormData({ ...formData, isActive: val })
                  }
                />
                <Label htmlFor="active-mode" className="cursor-pointer">
                  {formData.isActive ? "Active Product" : "Inactive (Hidden)"}
                </Label>
              </div>
            </div>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-4 py-4">
            {/* --- ITEM CODE (SKU) INPUT --- */}
            {/* Show first in Edit mode. Hidden in Add mode. */}
            {selectedProduct && (
              <div className="col-span-1 space-y-2">
                <Label>Item Code (SKU)</Label>
                <Input
                  value={formData.sku}
                  disabled
                  placeholder="Auto-generated"
                  className="font-mono bg-muted"
                />
              </div>
            )}

            {/* Product Name */}
            {/* Full width in Add mode (col-span-2). Half width in Edit mode (col-span-1) to sit next to SKU. */}
            <div
              className={`${
                selectedProduct ? "col-span-1" : "col-span-2"
              } space-y-2`}
            >
              <Label>Product Name *</Label>
              <Input
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="e.g. SuperBright LED Bulb 9W"
              />
            </div>

            {/* Categories */}
            <div className="space-y-2">
              <Label>Category *</Label>
              <Select
                value={formData.category}
                onValueChange={(val) => {
                  setFormData({
                    ...formData,
                    category: val,
                    subCategory: "",
                    modelType: "",
                    subModel: "",
                    sizeSpec: "",
                  });
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select Category" />
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
            <div className="space-y-2">
              <Label>Sub Category</Label>
              <Select
                value={formData.subCategory}
                onValueChange={(val) => {
                  if (val === "none") {
                    setFormData({ ...formData, subCategory: "" });
                  } else {
                    setFormData({ ...formData, subCategory: val });
                  }
                }}
                disabled={!formData.category}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select Sub Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">
                    <span className="text-muted-foreground italic">None</span>
                  </SelectItem>
                  {subCategories.map((c) => (
                    <SelectItem key={c.id} value={c.name}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Brands */}
            <div className="space-y-2">
              <Label>Brand</Label>
              <Select
                value={formData.brand}
                onValueChange={(val) => {
                  if (val === "none") {
                    setFormData({ ...formData, brand: "", subBrand: "" });
                  } else {
                    setFormData({ ...formData, brand: val, subBrand: "" });
                  }
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select Brand" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">
                    <span className="text-muted-foreground italic">None</span>
                  </SelectItem>
                  {mainBrands.map((b) => (
                    <SelectItem key={b.id} value={b.name}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Sub Brand</Label>
              <Select
                value={formData.subBrand}
                onValueChange={(val) => {
                  if (val === "none") {
                    setFormData({ ...formData, subBrand: "" });
                  } else {
                    setFormData({ ...formData, subBrand: val });
                  }
                }}
                disabled={!formData.brand}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select Sub Brand" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">
                    <span className="text-muted-foreground italic">None</span>
                  </SelectItem>
                  {subBrands.map((b) => (
                    <SelectItem key={b.id} value={b.name}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Models - Filtered by Category */}
            <div className="space-y-2">
              <Label>Model</Label>
              <Select
                value={formData.modelType}
                onValueChange={(val) => {
                  if (val === "none") {
                    setFormData({ ...formData, modelType: "", subModel: "" });
                  } else {
                    setFormData({ ...formData, modelType: val, subModel: "" });
                  }
                }}
                disabled={!formData.category}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select Model" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">
                    <span className="text-muted-foreground italic">None</span>
                  </SelectItem>
                  {categoryModels.length > 0 ? (
                    categoryModels.map((m) => (
                      <SelectItem key={m.id} value={m.name}>
                        {m.name}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="no-models" disabled>
                      <span className="text-muted-foreground italic">
                        No models for this category
                      </span>
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Sub Model</Label>
              <Select
                key={`${selectedModelId || "loading"}-${subModels.length}`}
                value={formData.subModel}
                onValueChange={(val) => {
                  if (val === "none") {
                    setFormData({ ...formData, subModel: "" });
                  } else {
                    setFormData({ ...formData, subModel: val });
                  }
                }}
                disabled={!formData.modelType}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select Sub Model" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">
                    <span className="text-muted-foreground italic">None</span>
                  </SelectItem>
                  {subModels.map((m) => (
                    <SelectItem key={m.id} value={m.name}>
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Specification - Filtered by Category */}
            <div className="space-y-2">
              <Label>Specification</Label>
              <Select
                value={formData.sizeSpec}
                onValueChange={(val) => {
                  if (val === "none") {
                    setFormData({ ...formData, sizeSpec: "" });
                  } else {
                    setFormData({ ...formData, sizeSpec: val });
                  }
                }}
                disabled={!formData.category}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select Spec" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">
                    <span className="text-muted-foreground italic">None</span>
                  </SelectItem>
                  {categorySpecs.length > 0 ? (
                    categorySpecs.map((s) => (
                      <SelectItem key={s.id} value={s.name}>
                        {s.name}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="no-specs" disabled>
                      <span className="text-muted-foreground italic">
                        No specifications for this category
                      </span>
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Supplier */}
            <div className="space-y-2">
              <Label>Supplier *</Label>
              <Select
                value={formData.supplier}
                onValueChange={(val) =>
                  setFormData({ ...formData, supplier: val })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select Supplier" />
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

            {/* Pricing */}
            <div className="col-span-2 grid grid-cols-3 gap-4 border-t pt-4">
              <div className="space-y-2">
                <Label>MRP</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.mrp}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      mrp: parseFloat(e.target.value) || 0,
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Selling Price</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.sellingPrice}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      sellingPrice: parseFloat(e.target.value) || 0,
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Cost Price</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.costPrice}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      costPrice: parseFloat(e.target.value) || 0,
                    })
                  }
                />
              </div>
            </div>

            {/* Stock */}
            <div className="col-span-2 grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Unit of Measure</Label>
                <Select
                  value={formData.unitOfMeasure}
                  onValueChange={(val) =>
                    setFormData({ ...formData, unitOfMeasure: val })
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Pcs">Pieces</SelectItem>
                    <SelectItem value="Box">Box</SelectItem>
                    <SelectItem value="Set">Set</SelectItem>
                    <SelectItem value="Roll">Roll</SelectItem>
                    <SelectItem value="Pkt">Packet</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* ✅ Initial Stock: Disabled when editing (selectedProduct exists) */}
              <div className="space-y-2">
                <Label>Initial Stock </Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.stock}
                  disabled={!!selectedProduct} // Disable if editing
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      stock: parseFloat(e.target.value) || 0,
                    })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>Min Stock Alert</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.minStock}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      minStock: parseFloat(e.target.value) || 0,
                    })
                  }
                />
              </div>
            </div>

            {/* Images */}
            <div className="col-span-2 space-y-3 pt-4 border-t mt-2">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-2">
                  <Camera className="w-4 h-4" /> Product Images
                </Label>
                <span className="text-xs text-muted-foreground">
                  {formData.images.length}/6
                </span>
              </div>
              <div className="grid grid-cols-6 gap-3">
                {showUpload && (
                  <div
                    className="aspect-square rounded-lg border-2 border-dashed border-muted-foreground/25 flex flex-col items-center justify-center cursor-pointer hover:bg-muted/50 hover:border-muted-foreground/50 transition-all"
                    onClick={() => !uploading && fileInputRef.current?.click()}
                  >
                    {uploading ? (
                      <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                    ) : (
                      <>
                        <Upload className="w-5 h-5 text-muted-foreground mb-1" />
                        <span className="text-[10px] font-medium text-muted-foreground">
                          Add
                        </span>
                      </>
                    )}
                    <input
                      type="file"
                      ref={fileInputRef}
                      className="hidden"
                      accept="image/*"
                      multiple
                      onChange={handleImageUpload}
                      disabled={uploading}
                    />
                  </div>
                )}
                {formData.images.map((imgSrc, index) => (
                  <div
                    key={index}
                    className="aspect-square rounded-lg border bg-muted relative group overflow-hidden"
                  >
                    <img
                      src={imgSrc}
                      alt={`Product ${index}`}
                      className="w-full h-full object-cover"
                    />
                    <button
                      onClick={() => removeImage(index)}
                      className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                {emptySlots.map((_, i) => (
                  <div
                    key={`empty-${i}`}
                    className="aspect-square rounded-lg border-2 border-dashed border-muted-foreground/10 bg-muted/10"
                  />
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={onSave} disabled={uploading}>
              {selectedProduct ? "Update Product" : "Save Product"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
