"use client";

import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, ArrowRight } from "lucide-react";
import { SearchableDropdown } from "@/components/ui/searchable-dropdown";
import { RetailStockItem } from "./StockTable";

interface StockConversionModalProps {
  isOpen: boolean;
  onClose: () => void;
  sourceItem: RetailStockItem | null;
  onSuccess: () => void;
  userId: string;
}

export function StockConversionModal({
  isOpen,
  onClose,
  sourceItem,
  onSuccess,
  userId,
}: StockConversionModalProps) {
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [targetProducts, setTargetProducts] = useState<{id: string, name: string, info: string}[]>([]);
  
  // Form State
  const [targetProductId, setTargetProductId] = useState("");
  const [sourceQty, setSourceQty] = useState<number | "">(1);
  const [targetQty, setTargetQty] = useState<number | "">("");

  // New Target Product State
  const [createNew, setCreateNew] = useState(false);
  const [newProductName, setNewProductName] = useState("");
  const [newUnit, setNewUnit] = useState("Meter");
  const [newPrice, setNewPrice] = useState<number | "">("");

  // Fetch target products
  useEffect(() => {
    if (isOpen) {
      const fetchProducts = async () => {
        setLoadingProducts(true);
        try {
          const res = await fetch("/api/products");
          if (!res.ok) throw new Error("Failed to fetch");
          const data = await res.json();
          // Map to dropdown format
          const formatted = data.map((p: any) => ({
            id: p.id,
            name: p.name,
            info: `SKU: ${p.sku} | Unit: ${p.unit_of_measure}`,
          }));
          setTargetProducts(formatted);
        } catch (error) {
          console.error(error);
          toast.error("Failed to load products");
        } finally {
          setLoadingProducts(false);
        }
      };
      
      fetchProducts();
      
      // Reset form
      setTargetProductId("");
      setSourceQty(1);
      setTargetQty("");
    }
  }, [isOpen]);

  const handleSubmit = async () => {
    if (!sourceItem) return;
    
    if (createNew) {
      if (!newProductName.trim()) {
        toast.error("Please provide a name for the new target product");
        return;
      }
      if (!newUnit.trim()) {
        toast.error("Please provide a unit for the new target product");
        return;
      }
      if (newPrice === "" || newPrice < 0) {
        toast.error("Please provide a valid selling price");
        return;
      }
    } else {
      if (!targetProductId) {
        toast.error("Please select a target sub-product");
        return;
      }
    }
    if (!sourceQty || sourceQty <= 0) {
      toast.error("Source quantity must be greater than 0");
      return;
    }
    if (!targetQty || targetQty <= 0) {
      toast.error("Target quantity must be greater than 0");
      return;
    }
    if (sourceQty > sourceItem.stock_quantity) {
      toast.error(`You only have ${sourceItem.stock_quantity} available`);
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/retail/stock-conversion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          sourceProductId: sourceItem.id,
          targetProductId: createNew ? undefined : targetProductId,
          sourceQuantity: Number(sourceQty),
          targetQuantity: Number(targetQty),
          createNewProduct: createNew,
          newProductDetails: createNew ? {
            name: newProductName,
            unitOfMeasure: newUnit,
            sellingPrice: Number(newPrice)
          } : undefined
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to convert stock");

      toast.success("Stock converted successfully!");
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error(error);
      toast.error(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Convert Stock Unit</DialogTitle>
          <DialogDescription>
            Unpack a bulk product to increment the stock of a retail sub-product.
          </DialogDescription>
        </DialogHeader>

        {sourceItem && (
          <div className="space-y-6 py-4">
            {/* Source Product */}
            <div className="p-4 bg-muted rounded-md border">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-semibold text-muted-foreground">Source Box/Coil</span>
              </div>
              <div className="font-medium text-lg">{sourceItem.name}</div>
              <div className="text-sm text-muted-foreground">SKU: {sourceItem.sku}</div>
              <div className="mt-2 text-sm">
                Available Stock: <span className="font-bold text-blue-600">{sourceItem.stock_quantity} {sourceItem.unit_of_measure}</span>
              </div>
            </div>

            <div className="flex justify-center">
              <ArrowRight className="text-muted-foreground w-6 h-6 rotate-90 md:rotate-0" />
            </div>

            {/* Target Product Selection */}
            <div className="space-y-4">
              <div className="flex justify-between items-center mb-1">
                <Label>Target Retail Product</Label>
                <div className="flex items-center space-x-2">
                  <input 
                    type="checkbox" 
                    id="createNew" 
                    checked={createNew} 
                    onChange={(e) => setCreateNew(e.target.checked)}
                    className="rounded border-gray-300 w-4 h-4 cursor-pointer"
                  />
                  <Label htmlFor="createNew" className="text-xs font-normal cursor-pointer text-blue-600 hover:text-blue-800">
                    Create New Instead
                  </Label>
                </div>
              </div>

              {!createNew ? (
                loadingProducts ? (
                  <div className="flex items-center text-sm text-muted-foreground h-10 px-3 border rounded-md">
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Loading products...
                  </div>
                ) : (
                  <SearchableDropdown
                    options={targetProducts.filter(p => p.id !== sourceItem.id)}
                    value={targetProductId}
                    onChange={setTargetProductId}
                    placeholder="Search sub-product to add stock to..."
                  />
                )
              ) : (
                <div className="p-3 border border-blue-200 rounded-md space-y-3 bg-blue-50/30">
                  <span className="text-xs font-semibold text-muted-foreground block mb-1">New Item (copies category/brand/supplier from source)</span>
                  <div className="space-y-1 text-sm">
                    <Input 
                      placeholder="e.g. Wire - Per Meter" 
                      value={newProductName} 
                      onChange={(e) => setNewProductName(e.target.value)} 
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Unit</Label>
                      <Input placeholder="e.g. Meter" value={newUnit} onChange={e => setNewUnit(e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Selling Price (LKR)</Label>
                      <Input type="number" min="0" value={newPrice} onChange={e => setNewPrice(e.target.value === "" ? "" : Number(e.target.value))} />
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Qty to Deduct (Source)</Label>
                  <Input
                    type="number"
                    min="1"
                    max={sourceItem.stock_quantity}
                    value={sourceQty}
                    onChange={(e) => setSourceQty(e.target.value === "" ? "" : Number(e.target.value))}
                    placeholder="e.g. 1"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Qty to Add (Target)</Label>
                  <Input
                    type="number"
                    min="1"
                    value={targetQty}
                    onChange={(e) => setTargetQty(e.target.value === "" ? "" : Number(e.target.value))}
                    placeholder="e.g. 100"
                  />
                </div>
              </div>
              
              <p className="text-xs text-muted-foreground mt-2">
                Example: Deducting 1 Wire Coil to add 100 Meters.
              </p>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting || !sourceItem}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Converting...
              </>
            ) : (
              "Confirm Conversion"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
