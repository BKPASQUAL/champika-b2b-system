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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, ArrowRight, ShoppingBag } from "lucide-react";
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
  const [targetProducts, setTargetProducts] = useState<{id: string, name: string, info: string, retailOnly: boolean}[]>([]);
  const [retailOnlyFilter, setRetailOnlyFilter] = useState(true);
  
  // Form State
  const [targetProductId, setTargetProductId] = useState("");
  const [sourceQty, setSourceQty] = useState<number | "">(1);
  const [targetQty, setTargetQty] = useState<number | "">("");

  // New Target Product State
  const [createNew, setCreateNew] = useState(false);
  const [newProductName, setNewProductName] = useState("");
  const [newUnit, setNewUnit] = useState("");
  const [newPrice, setNewPrice] = useState<number | "">("");
  const [newRetailPrice, setNewRetailPrice] = useState<number | "">("");
  const [packSizes, setPackSizes] = useState<{id: string, name: string}[]>([]);

  // Auto-calculate new product price from conversion ratio
  useEffect(() => {
    if (createNew && sourceItem && sourceQty && targetQty && Number(targetQty) > 0) {
      const calculated = (sourceItem.selling_price * Number(sourceQty)) / Number(targetQty);
      setNewPrice(Math.round(calculated * 100) / 100);
    }
  }, [createNew, sourceQty, targetQty, sourceItem]);

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
            info: `SKU: ${p.sku} | Unit: ${p.unitOfMeasure || p.unit_of_measure}${p.retailOnly ? " | Retail Only" : ""}`,
            retailOnly: p.retailOnly ?? false,
          }));
          setTargetProducts(formatted);
        } catch (error) {
          console.error(error);
          toast.error("Failed to load products");
        } finally {
          setLoadingProducts(false);
        }
      };

      const fetchPackSizes = async () => {
        try {
          const res = await fetch("/api/settings/categories?type=pack_size");
          if (!res.ok) throw new Error("Failed to fetch");
          const data = await res.json();
          setPackSizes(data);
        } catch (error) {
          console.error("Failed to load pack sizes", error);
        }
      };
      
      fetchProducts();
      fetchPackSizes();
      
      // Reset form
      setTargetProductId("");
      setSourceQty(1);
      setTargetQty("");
      setRetailOnlyFilter(true);
      setNewProductName("");
      setNewUnit("");
      setNewPrice("");
      setNewRetailPrice("");
      setCreateNew(false);
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
            sellingPrice: Number(newPrice),
            retailPrice: newRetailPrice !== "" ? Number(newRetailPrice) : null,
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
                  <div className="space-y-2">
                    {/* Retail Only filter toggle */}
                    <button
                      type="button"
                      onClick={() => { setRetailOnlyFilter(!retailOnlyFilter); setTargetProductId(""); }}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-md border text-xs font-medium transition-all w-full justify-center ${
                        retailOnlyFilter
                          ? "bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100"
                          : "bg-muted border-border text-muted-foreground hover:bg-muted/80"
                      }`}
                    >
                      <ShoppingBag className="w-3.5 h-3.5" />
                      {retailOnlyFilter ? "Showing Retail Only products" : "Showing all products"}
                      <span className="ml-auto text-[10px] opacity-60">click to toggle</span>
                    </button>
                    <SearchableDropdown
                      options={targetProducts.filter(p =>
                        p.id !== sourceItem.id &&
                        (!retailOnlyFilter || p.retailOnly)
                      )}
                      value={targetProductId}
                      onChange={setTargetProductId}
                      placeholder={retailOnlyFilter ? "Search retail-only products..." : "Search all products..."}
                    />
                    {retailOnlyFilter && targetProducts.filter(p => p.id !== sourceItem.id && p.retailOnly).length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-1">
                        No retail-only products found. Toggle to show all products.
                      </p>
                    )}
                  </div>
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
                      <Select value={newUnit} onValueChange={setNewUnit}>
                        <SelectTrigger className="w-full h-9">
                          <SelectValue placeholder="Select Unit" />
                        </SelectTrigger>
                        <SelectContent className="max-h-[200px]">
                          {packSizes.map((ps) => (
                            <SelectItem key={ps.id} value={ps.name}>
                              {ps.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Selling Price (LKR)</Label>
                      <Input type="number" min="0" value={newPrice} onChange={e => setNewPrice(e.target.value === "" ? "" : Number(e.target.value))} />
                      <p className="text-[10px] text-blue-500">Auto-calculated from qty ratio. Editable.</p>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-purple-700">Retail Price (LKR)</Label>
                    <Input
                      type="number"
                      min="0"
                      value={newRetailPrice}
                      onChange={e => setNewRetailPrice(e.target.value === "" ? "" : Number(e.target.value))}
                      placeholder="e.g. 350.00 — shown in retail walk-in sales"
                      className="border-purple-200 focus-visible:ring-purple-400"
                    />
                    <p className="text-[10px] text-purple-600">This price will be used in the retail portal for this product.</p>
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
