// app/dashboard/admin/products/_components/ProductDialogs.tsx
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
import { Product, ProductFormData } from "../types";

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
}: ProductDialogsProps) {
  return (
    <>
      {/* Add/Edit Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedProduct ? "Edit Product" : "Add New Product"}
            </DialogTitle>
            <DialogDescription>
              {selectedProduct ? "Update info" : "Enter details"}
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-4">
            <div className="col-span-2 space-y-2">
              <Label>Product Name *</Label>
              <Input
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Category *</Label>
              <Input
                value={formData.category}
                onChange={(e) =>
                  setFormData({ ...formData, category: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Supplier *</Label>
              <Input
                value={formData.supplier}
                onChange={(e) =>
                  setFormData({ ...formData, supplier: e.target.value })
                }
              />
            </div>
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
            <div className="col-span-2 space-y-2 border-t pt-4">
              <Label>Default Selling Price (LKR)</Label>
              <Input
                type="number"
                min="0"
                placeholder="Leave empty to use MRP"
                value={formData.sellingPrice || ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    sellingPrice: parseFloat(e.target.value) || 0,
                  })
                }
              />
              <p className="text-xs text-muted-foreground">
                Discount:{" "}
                {formData.mrp > 0
                  ? (
                      ((formData.mrp - formData.sellingPrice) / formData.mrp) *
                      100
                    ).toFixed(1)
                  : 0}
                % off MRP
              </p>
            </div>
            <div className="space-y-2">
              <Label>Current Stock *</Label>
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
            <div className="space-y-2">
              <Label>Min Stock Level *</Label>
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={onSave}>
              {selectedProduct ? "Update" : "Add"}
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
              Are you sure you want to delete {selectedProduct?.name}? This
              action cannot be undone.
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
