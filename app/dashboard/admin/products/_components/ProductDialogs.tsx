// app/dashboard/admin/products/_components/ProductDialogs.tsx
"use client";

import { useState, useEffect } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Product, ProductFormData } from "../types";

// Helper hook to fetch classification settings (Brands, Categories, etc.)
const useSettings = (type: string) => {
  const [data, setData] = useState<
    { id: string; name: string; parent_id?: string }[]
  >([]);
  useEffect(() => {
    fetch(`/api/settings/categories?type=${type}`)
      .then((res) => res.json())
      .then((data) => setData(data))
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
  isDeleteDialogOpen: boolean;
  setIsDeleteDialogOpen: (open: boolean) => void;
  onDeleteConfirm: () => void;
  suppliers: { id: string; name: string }[];
  categories: { id: string; name: string; parent_id?: string }[]; // <--- Added this
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
  suppliers,
  categories, // <--- Destructure this
}: ProductDialogsProps) {
  // 1. Fetch Dynamic Dropdown Data
  // const categories = useSettings("category"); // <--- Removed internal fetch
  const brands = useSettings("brand");
  const models = useSettings("model");
  const specs = useSettings("spec");

  // 2. Filter Sub-lists based on parent selection
  const mainCategories = categories.filter((c) => !c.parent_id);
  const selectedCatId = mainCategories.find(
    (c) => c.name === formData.category
  )?.id;
  const subCategories = categories.filter(
    (c) => c.parent_id && c.parent_id === selectedCatId
  );

  const mainBrands = brands.filter((b) => !b.parent_id);
  const selectedBrandId = mainBrands.find((b) => b.name === formData.brand)?.id;
  const subBrands = brands.filter(
    (b) => b.parent_id && b.parent_id === selectedBrandId
  );

  return (
    <>
      {/* Add/Edit Product Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedProduct ? "Edit Product" : "Add New Product"}
            </DialogTitle>
            <DialogDescription>
              Fill in the details below to{" "}
              {selectedProduct ? "update the" : "create a"} product.
            </DialogDescription>
          </DialogHeader>

          {/* Simple Grid Layout: 2 Inputs Per Line */}
          <div className="grid grid-cols-2 gap-4 py-4">
            {/* Product Name - Full Width */}
            <div className="col-span-2 space-y-2">
              <Label>Product Name *</Label>
              <Input
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="e.g. SuperBright LED Bulb 9W"
              />
            </div>

            {/* Row 1: Category & Sub Category */}
            <div className="space-y-2">
              <Label>Category *</Label>
              <Select
                value={formData.category}
                onValueChange={(val) =>
                  setFormData({ ...formData, category: val, subCategory: "" })
                }
              >
                {/* Added className="w-full" to ensure same width as Input */}
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
                  setFormData({ ...formData, subCategory: val })
                }
                disabled={!formData.category || subCategories.length === 0}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select Sub Category" />
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

            {/* Row 2: Brand & Sub Brand */}
            <div className="space-y-2">
              <Label>Brand</Label>
              <Select
                value={formData.brand}
                onValueChange={(val) =>
                  setFormData({ ...formData, brand: val, subBrand: "" })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select Brand" />
                </SelectTrigger>
                <SelectContent>
                  {mainBrands.map((b) => (
                    <SelectItem key={b.id} value={b.name}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Sub Brand / Series</Label>
              <Select
                value={formData.subBrand}
                onValueChange={(val) =>
                  setFormData({ ...formData, subBrand: val })
                }
                disabled={!formData.brand || subBrands.length === 0}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select Sub Brand" />
                </SelectTrigger>
                <SelectContent>
                  {subBrands.map((b) => (
                    <SelectItem key={b.id} value={b.name}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Row 3: Model & Specs */}
            <div className="space-y-2">
              <Label>Model / Type</Label>
              <Select
                value={formData.modelType}
                onValueChange={(val) =>
                  setFormData({ ...formData, modelType: val })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select Model" />
                </SelectTrigger>
                <SelectContent>
                  {models.map((m) => (
                    <SelectItem key={m.id} value={m.name}>
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Size / Specification</Label>
              <Select
                value={formData.sizeSpec}
                onValueChange={(val) =>
                  setFormData({ ...formData, sizeSpec: val })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select Spec" />
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

            {/* Row 4: Supplier */}
            <div className="col-span-2 space-y-2">
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
                  {suppliers.map((sup) => (
                    <SelectItem key={sup.id} value={sup.name}>
                      {sup.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Row 5: Pricing */}
            <div className="space-y-2">
              <Label>Cost Price (LKR)</Label>
              <Input
                type="number"
                min="0"
                value={formData.costPrice}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    costPrice: parseFloat(e.target.value) || 0,
                  })
                }
              />
            </div>

            <div className="space-y-2">
              <Label>MRP (LKR) *</Label>
              <Input
                type="number"
                min="0"
                value={formData.mrp}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    mrp: parseFloat(e.target.value) || 0,
                  })
                }
              />
            </div>

            {/* Row 6: Selling & Stock */}
            <div className="space-y-2">
              <Label>Selling Price (LKR)</Label>
              <Input
                type="number"
                min="0"
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
              <Label>Current Stock</Label>
              <Input
                type="number"
                min="0"
                value={formData.stock}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    stock: parseInt(e.target.value) || 0,
                  })
                }
              />
            </div>

            {/* Row 7: Alerts */}
            <div className="space-y-2">
              <Label>Low Stock Alert Level</Label>
              <Input
                type="number"
                min="0"
                value={formData.minStock}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    minStock: parseInt(e.target.value) || 0,
                  })
                }
              />
            </div>

            {/* Empty div to balance grid if needed */}
            <div className="space-y-2"></div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={onSave}>
              {selectedProduct ? "Update Product" : "Save Product"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Product?</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete{" "}
              <strong>{selectedProduct?.name}</strong>? This action cannot be
              undone.
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
