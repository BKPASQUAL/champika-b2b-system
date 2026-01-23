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
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Camera, Upload, X, Loader2, Plus, Save } from "lucide-react";
import { Product, ProductFormData } from "../types";
import { toast } from "sonner";

// Updated hook to support refreshing data
const useSettings = (type: string) => {
  const [data, setData] = useState<
    { id: string; name: string; parent_id?: string; category_id?: string }[]
  >([]);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    fetch(`/api/settings/categories?type=${type}`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setData(data);
      })
      .catch((err) => console.error(err));
  }, [type, version]);

  const refresh = () => setVersion((prev) => prev + 1);

  return { data, refresh };
};

interface ProductDialogsProps {
  isAddDialogOpen: boolean;
  setIsAddDialogOpen: (open: boolean) => void;
  formData: ProductFormData;
  setFormData: (data: ProductFormData) => void;
  onSave: () => void;
  selectedProduct: Product | null;
  isDeleteDialogOpen: boolean;
  setIsDeleteDialogOpen: (open: boolean) => void;
  onDeleteConfirm: () => void;
  categories: { id: string; name: string; parent_id?: string }[];
}

export function ProductDialogs({
  isAddDialogOpen,
  setIsAddDialogOpen,
  formData,
  setFormData,
  onSave,
  selectedProduct,
  isDeleteDialogOpen,
  setIsDeleteDialogOpen,
  onDeleteConfirm,
  categories,
}: ProductDialogsProps) {
  // Settings Data
  const { data: brands } = useSettings("brand");
  const { data: models } = useSettings("model");
  const { data: specs, refresh: refreshSpecs } = useSettings("spec");

  // --- Filtering Logic ---
  const mainCategories = categories.filter((c) => !c.parent_id);
  const selectedCatObj = mainCategories.find(
    (c) => c.name === formData.category,
  );
  const selectedCatId = selectedCatObj?.id;

  const subCategories = categories.filter(
    (c) => c.parent_id && c.parent_id === selectedCatId,
  );

  const selectedSubCatObj = subCategories.find(
    (c) => c.name === formData.subCategory,
  );
  const selectedSubCatId = selectedSubCatObj?.id;

  const mainBrands = brands.filter((b) => !b.parent_id);
  const selectedBrandId = mainBrands.find((b) => b.name === formData.brand)?.id;
  const subBrands = brands.filter(
    (b) => b.parent_id && b.parent_id === selectedBrandId,
  );

  const categoryModels = models.filter((m) => {
    if (m.parent_id) return false;
    if (selectedSubCatId) {
      return m.category_id === selectedSubCatId;
    }
    return m.category_id === selectedCatId;
  });

  const selectedModelId = categoryModels.find(
    (m) => m.name.trim() === formData.modelType?.trim(),
  )?.id;

  const subModels = models.filter((m) => {
    const isChild = m.parent_id && m.parent_id === selectedModelId;
    if (!isChild) return false;
    if (selectedSubCatId && m.category_id) {
      return m.category_id === selectedSubCatId;
    }
    return true;
  });

  const selectedSubModelId = subModels.find(
    (m) => m.name.trim() === formData.subModel?.trim(),
  )?.id;

  const effectiveModelId =
    selectedSubModelId || selectedModelId || selectedSubCatId || selectedCatId;

  const categorySpecs = specs.filter((s) => {
    if (selectedSubModelId && s.parent_id === selectedSubModelId) return true;
    if (selectedModelId && s.parent_id === selectedModelId) return true;
    if (selectedSubCatId && s.parent_id === selectedSubCatId) return true;
    if (selectedCatId && s.parent_id === selectedCatId) return true;
    return false;
  });

  // --- Add New Spec Logic ---
  const [isAddingSpec, setIsAddingSpec] = useState(false);
  const [newSpecName, setNewSpecName] = useState("");
  const [isSavingSpec, setIsSavingSpec] = useState(false);

  const handleAddSpec = async () => {
    if (!newSpecName.trim() || !effectiveModelId) return;

    setIsSavingSpec(true);
    try {
      const res = await fetch("/api/settings/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newSpecName.trim(),
          type: "spec",
          parent_id: effectiveModelId,
          category_id: selectedSubCatId || selectedCatId,
        }),
      });

      if (!res.ok) throw new Error("Failed to create spec");

      toast.success("Specification added successfully");
      refreshSpecs();
      setNewSpecName("");
      setIsAddingSpec(false);
      setFormData({ ...formData, sizeSpec: newSpecName.trim() });
    } catch (error) {
      console.error(error);
      toast.error("Failed to add specification");
    } finally {
      setIsSavingSpec(false);
    }
  };

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
                <DialogTitle className="text-red-900 flex items-center gap-3">
                  {selectedProduct
                    ? "Edit Wireman Product"
                    : "Add Wireman Product"}
                  {/* ✅ SKU is displayed here as a badge in Edit mode, removed from input grid */}
                  {selectedProduct && formData.sku && (
                    <span className="text-sm font-mono bg-slate-100 text-slate-600 px-2 py-0.5 rounded border">
                      {formData.sku}
                    </span>
                  )}
                </DialogTitle>
                <DialogDescription>
                  Details for Wireman Agency exclusive product.
                </DialogDescription>
              </div>

              <div className="flex items-center space-x-2 border p-2 rounded-lg bg-red-50/50">
                <Switch
                  id="active-mode"
                  checked={formData.isActive}
                  onCheckedChange={(val) =>
                    setFormData({ ...formData, isActive: val })
                  }
                  className="data-[state=checked]:bg-red-600"
                />
                <Label htmlFor="active-mode" className="cursor-pointer text-xs">
                  {formData.isActive ? "Active" : "Inactive"}
                </Label>
              </div>
            </div>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-4 py-4">
            {/* ✅ Product Name & Company Code on SAME LINE */}
            <div className="col-span-1 space-y-2">
              <Label>Product Name *</Label>
              <Input
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="e.g. Wireman PVC Pipe 20mm"
              />
            </div>

            <div className="col-span-1 space-y-2">
              <Label>Company Code (Optional)</Label>
              <Input
                value={formData.companyCode}
                onChange={(e) =>
                  setFormData({ ...formData, companyCode: e.target.value })
                }
                placeholder="e.g. CMP-001"
                className="font-mono"
              />
            </div>

            {/* Category Selection */}
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
                onValueChange={(val) =>
                  setFormData({
                    ...formData,
                    subCategory: val === "none" ? "" : val,
                    modelType: "",
                    subModel: "",
                    sizeSpec: "",
                  })
                }
                disabled={!formData.category}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select Sub Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">
                    <span className="italic text-muted-foreground">None</span>
                  </SelectItem>
                  {subCategories.map((c) => (
                    <SelectItem key={c.id} value={c.name}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Brand */}
            <div className="space-y-2">
              <Label>Brand</Label>
              <Select
                value={formData.brand}
                onValueChange={(val) =>
                  setFormData({
                    ...formData,
                    brand: val === "none" ? "" : val,
                    subBrand: "",
                  })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select Brand" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {mainBrands.map((b) => (
                    <SelectItem key={b.id} value={b.name}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Sub Brand */}
            <div className="space-y-2">
              <Label>Sub Brand</Label>
              <Select
                value={formData.subBrand}
                onValueChange={(val) =>
                  setFormData({
                    ...formData,
                    subBrand: val === "none" ? "" : val,
                  })
                }
                disabled={!formData.brand}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select Sub Brand" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {subBrands.map((b) => (
                    <SelectItem key={b.id} value={b.name}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Model */}
            <div className="space-y-2">
              <Label>Model</Label>
              <Select
                value={formData.modelType}
                onValueChange={(val) =>
                  setFormData({
                    ...formData,
                    modelType: val === "none" ? "" : val,
                    subModel: "",
                    sizeSpec: "",
                  })
                }
                disabled={!formData.category}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select Model" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {categoryModels.length > 0 ? (
                    categoryModels.map((m) => (
                      <SelectItem key={m.id} value={m.name}>
                        {m.name}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="no-models" disabled>
                      No models for this selection
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Sub Model */}
            <div className="space-y-2">
              <Label>Sub Model</Label>
              <Select
                value={formData.subModel}
                onValueChange={(val) =>
                  setFormData({
                    ...formData,
                    subModel: val === "none" ? "" : val,
                  })
                }
                disabled={!formData.modelType}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select Sub Model" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {subModels.map((m) => (
                    <SelectItem key={m.id} value={m.name}>
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Specification */}
            <div className="col-span-1 space-y-2">
              <div className="flex items-center justify-between">
                <Label>Specification</Label>
                {formData.category && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs text-blue-600 hover:text-blue-800"
                    onClick={() => {
                      setIsAddingSpec(!isAddingSpec);
                      setNewSpecName("");
                    }}
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    {isAddingSpec ? "Cancel" : "Add New"}
                  </Button>
                )}
              </div>

              {isAddingSpec ? (
                <div className="flex gap-2">
                  <Input
                    value={newSpecName}
                    onChange={(e) => setNewSpecName(e.target.value)}
                    placeholder={`New spec`}
                    className="h-9"
                  />
                  <Button
                    size="sm"
                    onClick={handleAddSpec}
                    disabled={!newSpecName.trim() || isSavingSpec}
                  >
                    {isSavingSpec ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              ) : (
                <Select
                  value={formData.sizeSpec}
                  onValueChange={(val) =>
                    setFormData({
                      ...formData,
                      sizeSpec: val === "none" ? "" : val,
                    })
                  }
                  disabled={!formData.category}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select Spec" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {categorySpecs.length > 0 ? (
                      categorySpecs.map((s) => (
                        <SelectItem key={s.id} value={s.name}>
                          {s.name}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="no-specs" disabled>
                        No specs found
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Pricing Section */}
            <div className="col-span-2 grid grid-cols-3 gap-4 border-t pt-4">
              <div className="space-y-2">
                <Label>MRP (LKR)</Label>
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
                <Label>Selling Price (LKR)</Label>
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
                  className="border-green-200 focus-visible:ring-green-400"
                />
              </div>
              <div className="space-y-2">
                <Label>Cost Price (LKR)</Label>
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

            {/* Stock Section */}
            <div className="col-span-2 grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Unit</Label>
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
                    <SelectItem value="Pcs">Pcs</SelectItem>
                    <SelectItem value="Box">Box</SelectItem>
                    <SelectItem value="Set">Set</SelectItem>
                    <SelectItem value="Meters">Meters</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Initial Stock</Label>
                <Input
                  type="number"
                  value={formData.stock}
                  disabled={!!selectedProduct}
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
                  <Camera className="w-4 h-4" /> Images
                </Label>
                <span className="text-xs text-muted-foreground">
                  {formData.images.length}/6
                </span>
              </div>
              <div className="grid grid-cols-6 gap-3">
                {showUpload && (
                  <div
                    className="aspect-square rounded-lg border-2 border-dashed flex flex-col items-center justify-center cursor-pointer hover:bg-red-50 transition-all"
                    onClick={() => !uploading && fileInputRef.current?.click()}
                  >
                    {uploading ? (
                      <Loader2 className="animate-spin text-red-600" />
                    ) : (
                      <Upload className="text-red-400" />
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
                      alt="Product"
                      className="w-full h-full object-cover"
                    />
                    <button
                      onClick={() => removeImage(index)}
                      className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                {emptySlots.map((_, i) => (
                  <div
                    key={`empty-${i}`}
                    className="aspect-square rounded-lg border-2 border-dashed border-muted-foreground/10"
                  />
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsAddDialogOpen(false)}
              disabled={isSavingSpec}
            >
              Cancel
            </Button>
            <Button
              onClick={onSave}
              disabled={uploading || isSavingSpec}
              className="bg-red-600 hover:bg-red-700"
            >
              {selectedProduct ? "Update Product" : "Save Product"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Product?</DialogTitle>
            <DialogDescription>
              This will permanently remove this item from the Wireman catalog.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDeleteDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={onDeleteConfirm}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
