"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SearchableDropdown } from "@/components/ui/searchable-dropdown";
import {
  ArrowLeft,
  Plus,
  Save,
  Trash2,
  AlertCircle,
  Loader2,
  MapPin,
  AlertTriangle,
  RotateCcw,
  Pencil,
  ShieldAlert,
  Layers,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Product {
  id: string;
  sku: string;
  name: string;
  category?: string;
  unitOfMeasure?: string;
  images?: string[];
  costPrice?: number;
}

interface PendingDamageAdjustment {
  productId: string;
  productName: string;
  sku: string;
  unitOfMeasure?: string;
  images?: string[];
  currentDamagedStock: number;
  newDamagedStock: number;
  difference: number;
  itemReason: string;
}

export default function AdminDamageAdjustmentPage() {
  const router = useRouter();

  // Locations & Selection
  const [locations, setLocations] = useState<{ id: string; name: string }[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState("");
  const [loading, setLoading] = useState(true);
  const [stockLoading, setStockLoading] = useState(false);

  // Products and Damaged Stocks
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [damagedStocks, setDamagedStocks] = useState<Record<string, number>>({});
  const [goodStocks, setGoodStocks] = useState<Record<string, number>>({});

  // Form State
  const [selectedProductId, setSelectedProductId] = useState("");
  const [adjustmentValue, setAdjustmentValue] = useState("");
  const [addMode, setAddMode] = useState<"set" | "add" | "subtract">("set");
  const [itemNote, setItemNote] = useState("");
  const [generalReason, setGeneralReason] = useState("Physical Damaged Stock Audit (Admin)");
  const [pendingAdjustments, setPendingAdjustments] = useState<PendingDamageAdjustment[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // Dialogs
  const [editDialog, setEditDialog] = useState<{
    open: boolean;
    productId: string;
    productName: string;
    editValue: string;
    editNote: string;
  }>({ open: false, productId: "", productName: "", editValue: "", editNote: "" });

  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({ open: false, title: "", message: "", onConfirm: () => {} });

  const showConfirm = (title: string, message: string, onConfirm: () => void) =>
    setConfirmDialog({ open: true, title, message, onConfirm });

  // 1. Fetch Locations on load
  useEffect(() => {
    const fetchLocations = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/settings/locations`);
        if (!res.ok) throw new Error("Failed to load locations");
        const data = await res.json();
        setLocations(data);
        if (data.length > 0) {
          setSelectedLocationId(data[0].id);
        }
      } catch (err: any) {
        toast.error(err.message || "Failed to load locations");
      } finally {
        setLoading(false);
      }
    };
    fetchLocations();
  }, []);

  // 2. Fetch Stock when location changes
  useEffect(() => {
    if (!selectedLocationId) return;

    const fetchStocks = async () => {
      try {
        setStockLoading(true);
        const [productsRes, stockRes] = await Promise.all([
          fetch(`/api/inventory`),
          fetch(`/api/inventory/${selectedLocationId}?includeAll=true`),
        ]);

        const productsData = await productsRes.json();
        const stockData = await stockRes.json();

        const damagedMap: Record<string, number> = {};
        const goodMap: Record<string, number> = {};

        if (stockData.stocks) {
          stockData.stocks.forEach((s: any) => {
            damagedMap[s.id] = Number(s.damagedQuantity ?? s.damaged_quantity ?? 0);
            goodMap[s.id] = Number(s.quantity || 0);
          });
        }

        if (productsData.products) {
          setAllProducts(
            productsData.products.map((p: any) => ({
              ...p,
              unitOfMeasure: p.unit_of_measure || "Pcs",
              costPrice: p.actual_cost_price || p.cost_price || 0,
            }))
          );
        }

        setDamagedStocks(damagedMap);
        setGoodStocks(goodMap);
        setPendingAdjustments([]);
        setSelectedProductId("");
        setAdjustmentValue("");
      } catch (err: any) {
        console.error(err);
        toast.error("Failed to load location inventory");
      } finally {
        setStockLoading(false);
      }
    };

    fetchStocks();
  }, [selectedLocationId]);

  const selectedProduct = allProducts.find((p) => p.id === selectedProductId);
  const currentDamaged = selectedProductId ? (damagedStocks[selectedProductId] ?? 0) : 0;
  const currentGood = selectedProductId ? (goodStocks[selectedProductId] ?? 0) : 0;

  const handleAddToList = () => {
    if (!selectedProduct) return toast.error("Select a product first");
    if (adjustmentValue === "") return toast.error("Enter a valid quantity");

    const enteredQty = parseFloat(adjustmentValue);
    if (isNaN(enteredQty) || enteredQty < 0)
      return toast.error("Quantity must be a valid positive number");

    if (pendingAdjustments.some((p) => p.productId === selectedProductId)) {
      return toast.error("This product is already in the pending adjustment list");
    }

    let finalQty = enteredQty;
    if (addMode === "add") {
      finalQty = currentDamaged + enteredQty;
    } else if (addMode === "subtract") {
      finalQty = Math.max(0, currentDamaged - enteredQty);
    }

    const newItem: PendingDamageAdjustment = {
      productId: selectedProduct.id,
      productName: selectedProduct.name,
      sku: selectedProduct.sku,
      unitOfMeasure: selectedProduct.unitOfMeasure,
      images: selectedProduct.images,
      currentDamagedStock: currentDamaged,
      newDamagedStock: finalQty,
      difference: finalQty - currentDamaged,
      itemReason: itemNote || generalReason || "Physical Damaged Stock Correction",
    };

    setPendingAdjustments([...pendingAdjustments, newItem]);
    setAdjustmentValue("");
    setSelectedProductId("");
    setItemNote("");
  };

  const handleRemoveItem = (id: string) => {
    setPendingAdjustments(pendingAdjustments.filter((p) => p.productId !== id));
  };

  const openEditDialog = (item: PendingDamageAdjustment) => {
    setEditDialog({
      open: true,
      productId: item.productId,
      productName: item.productName,
      editValue: String(item.newDamagedStock),
      editNote: item.itemReason,
    });
  };

  const handleEditSave = () => {
    const newQty = parseFloat(editDialog.editValue);
    if (isNaN(newQty) || newQty < 0) return toast.error("Quantity must be a valid positive number");

    setPendingAdjustments(
      pendingAdjustments.map((p) =>
        p.productId === editDialog.productId
          ? {
              ...p,
              newDamagedStock: newQty,
              difference: newQty - p.currentDamagedStock,
              itemReason: editDialog.editNote,
            }
          : p
      )
    );
    setEditDialog((d) => ({ ...d, open: false }));
  };

  const handleSaveAll = () => {
    if (pendingAdjustments.length === 0) return toast.error("No adjustments to save");

    const locName = locations.find((l) => l.id === selectedLocationId)?.name || "Location";

    showConfirm(
      "Confirm Damaged Stock Adjustments",
      `Save ${pendingAdjustments.length} damaged stock adjustment(s) for ${locName}? This will directly update damaged stock levels and record an audit entry.`,
      async () => {
        setSubmitting(true);
        try {
          const payload = {
            locationId: selectedLocationId,
            reason: generalReason,
            items: pendingAdjustments.map((item) => ({
              productId: item.productId,
              newDamagedQuantity: item.newDamagedStock,
              itemReason: item.itemReason,
            })),
          };

          const res = await fetch("/api/inventory/damage/adjust", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });

          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "Failed to save adjustments");

          toast.success("Damaged stock adjusted successfully!");
          router.push("/dashboard/admin/inventory/damage");
        } catch (err: any) {
          console.error(err);
          toast.error(err.message || "Adjustment failed");
        } finally {
          setSubmitting(false);
        }
      }
    );
  };

  const handleZeroAllDamaged = () => {
    const itemsWithDamage = allProducts.filter((p) => (damagedStocks[p.id] || 0) > 0);
    if (itemsWithDamage.length === 0) return toast.info("No damaged stock recorded in this location.");

    showConfirm(
      "Clear All Damaged Stock (Zero Out)",
      `This will set damaged stock to 0 for all ${itemsWithDamage.length} damaged item(s) in this location (e.g. after write-off or disposal).`,
      async () => {
        setSubmitting(true);
        try {
          const payload = {
            locationId: selectedLocationId,
            reason: "Damaged Stock Write-off / Cleared to 0",
            items: itemsWithDamage.map((p) => ({
              productId: p.id,
              newDamagedQuantity: 0,
              itemReason: "Write-off / Disposed to 0",
            })),
          };

          const res = await fetch("/api/inventory/damage/adjust", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });

          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "Failed to clear damaged stock");

          const newDamagedMap = { ...damagedStocks };
          itemsWithDamage.forEach((p) => {
            newDamagedMap[p.id] = 0;
          });
          setDamagedStocks(newDamagedMap);
          setPendingAdjustments([]);
          toast.success("All damaged stock cleared successfully!");
        } catch (err: any) {
          toast.error(err.message || "Failed to clear damaged stock");
        } finally {
          setSubmitting(false);
        }
      }
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-slate-800" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="-ml-2 h-8 w-8 text-muted-foreground"
              onClick={() => router.push("/dashboard/admin/inventory/damage")}
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
              <ShieldAlert className="w-7 h-7 text-slate-800" />
              Adjust Damaged Stock (Admin)
            </h1>
          </div>
          <p className="text-muted-foreground mt-1 ml-8">
            Global physical audit, write-offs, and count corrections for damaged items across all locations.
          </p>
        </div>

        <Button
          variant="outline"
          className="border-red-300 text-red-700 hover:bg-red-50"
          onClick={handleZeroAllDamaged}
          disabled={submitting || stockLoading}
        >
          <RotateCcw className="w-4 h-4 mr-2" />
          Clear / Write-Off All Damaged
        </Button>
      </div>

      {/* Location Selector Card */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-1.5 text-slate-700">
                <MapPin className="w-4 h-4 text-slate-800" /> Target Location
              </label>
              <Select value={selectedLocationId} onValueChange={setSelectedLocationId}>
                <SelectTrigger className="w-full font-medium">
                  <SelectValue placeholder="Select Location" />
                </SelectTrigger>
                <SelectContent>
                  {locations.map((loc) => (
                    <SelectItem key={loc.id} value={loc.id}>
                      {loc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-1.5 text-slate-700">
                <Layers className="w-4 h-4 text-slate-800" /> Batch Adjustment Reason
              </label>
              <Input
                placeholder="e.g. Annual Audit, Transport Damage Re-count, Disposal"
                value={generalReason}
                onChange={(e) => setGeneralReason(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Adjust Form & Pending Table */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Form */}
        <Card className="md:col-span-1 h-fit">
          <CardHeader>
            <CardTitle className="text-lg">Damaged Item Adjustment</CardTitle>
            <CardDescription>Select product and enter count.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {stockLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-slate-800" />
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Select Product</label>
                  <SearchableDropdown
                    options={allProducts
                      .filter((p) => !pendingAdjustments.some((a) => a.productId === p.id))
                      .map((p) => ({
                        id: p.id,
                        name: p.name,
                        info: `${p.sku} | Damaged: ${damagedStocks[p.id] || 0}`,
                      }))}
                    value={selectedProductId}
                    onChange={setSelectedProductId}
                    placeholder="Search product..."
                  />
                </div>

                {/* Product Snapshot */}
                <div className="rounded-lg border bg-slate-50/70 p-3 flex gap-3 items-start">
                  <div className="shrink-0">
                    {selectedProduct?.images?.[0] ? (
                      <img
                        src={selectedProduct.images[0]}
                        alt={selectedProduct?.name}
                        className="w-16 h-16 rounded-lg object-cover border border-slate-200 shadow-sm"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-lg border border-slate-200 bg-white flex items-center justify-center">
                        <span className="text-muted-foreground text-[10px] text-center">No img</span>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0 space-y-1">
                    <span className="text-sm font-semibold text-slate-800 leading-tight block truncate">
                      {selectedProduct?.name ?? "—"}
                    </span>
                    <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200">
                      <div>
                        <span className="text-[10px] text-muted-foreground uppercase tracking-wide">
                          Current Damaged
                        </span>
                        <div className="text-xl font-bold leading-none text-red-600">
                          {selectedProductId ? currentDamaged : "—"}
                        </div>
                      </div>
                      <div>
                        <span className="text-[10px] text-muted-foreground uppercase tracking-wide">
                          Good Stock
                        </span>
                        <div className="text-xl font-bold leading-none text-slate-700">
                          {selectedProductId ? currentGood : "—"}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Mode toggle */}
                <div className="flex rounded-md border overflow-hidden text-xs font-semibold">
                  <button
                    type="button"
                    className={cn(
                      "flex-1 py-2 transition-colors",
                      addMode === "set" ? "bg-slate-900 text-white" : "bg-muted text-muted-foreground hover:bg-muted/70"
                    )}
                    onClick={() => setAddMode("set")}
                  >
                    Set Count
                  </button>
                  <button
                    type="button"
                    className={cn(
                      "flex-1 py-2 transition-colors",
                      addMode === "add" ? "bg-slate-900 text-white" : "bg-muted text-muted-foreground hover:bg-muted/70"
                    )}
                    onClick={() => setAddMode("add")}
                  >
                    + Add Damaged
                  </button>
                  <button
                    type="button"
                    className={cn(
                      "flex-1 py-2 transition-colors",
                      addMode === "subtract" ? "bg-slate-900 text-white" : "bg-muted text-muted-foreground hover:bg-muted/70"
                    )}
                    onClick={() => setAddMode("subtract")}
                  >
                    - Write Off
                  </button>
                </div>

                {/* Quantity Input */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    {addMode === "set"
                      ? "New Damaged Stock Count"
                      : addMode === "add"
                      ? "Units to Add to Damaged"
                      : "Units to Write Off / Reduce"}
                  </label>
                  <Input
                    type="number"
                    placeholder="Enter qty"
                    value={adjustmentValue}
                    onChange={(e) => setAdjustmentValue(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAddToList()}
                    disabled={!selectedProductId}
                    className="text-lg font-semibold"
                  />
                  {selectedProductId && adjustmentValue !== "" && !isNaN(parseFloat(adjustmentValue)) && (
                    <p className="text-xs text-slate-700 font-medium">
                      Result Damaged:{" "}
                      <span className="font-bold">
                        {addMode === "set"
                          ? parseFloat(adjustmentValue)
                          : addMode === "add"
                          ? currentDamaged + parseFloat(adjustmentValue)
                          : Math.max(0, currentDamaged - parseFloat(adjustmentValue))}
                      </span>{" "}
                      units
                    </p>
                  )}
                </div>

                {/* Specific item note */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-600">Item Reason / Note</label>
                  <Input
                    placeholder="e.g. Scratched during count, Disposed"
                    value={itemNote}
                    onChange={(e) => setItemNote(e.target.value)}
                    disabled={!selectedProductId}
                  />
                </div>

                <Button
                  className="w-full bg-slate-900 hover:bg-slate-800 text-white"
                  onClick={handleAddToList}
                  disabled={!selectedProductId || adjustmentValue === ""}
                >
                  <Plus className="w-4 h-4 mr-2" /> Add to List
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        {/* Right Table */}
        <Card className="md:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="text-lg">Pending Damaged Stock Adjustments</CardTitle>
              <CardDescription>Review adjustments before applying.</CardDescription>
            </div>
            {pendingAdjustments.length > 0 && (
              <Badge variant="secondary" className="bg-slate-100 text-slate-800">
                {pendingAdjustments.length} Items
              </Badge>
            )}
          </CardHeader>
          <CardContent>
            {pendingAdjustments.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground border-2 border-dashed rounded-lg bg-slate-50/50">
                <AlertCircle className="w-10 h-10 mb-2 opacity-30 text-slate-500" />
                <p className="font-medium">No adjustments in list</p>
                <p className="text-xs">Select products on the left to queue damaged stock adjustments.</p>
              </div>
            ) : (
              <div className="border rounded-md overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-100/60">
                      <TableHead>Product</TableHead>
                      <TableHead className="text-right">Current Damaged</TableHead>
                      <TableHead className="text-right">New Damaged</TableHead>
                      <TableHead className="text-right">Diff</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead className="w-[80px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingAdjustments.map((item) => (
                      <TableRow key={item.productId}>
                        <TableCell>
                          <div className="font-medium">{item.productName}</div>
                          <div className="text-xs text-muted-foreground font-mono">{item.sku}</div>
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground font-medium">
                          {item.currentDamagedStock}
                        </TableCell>
                        <TableCell className="text-right font-bold text-red-600">
                          {item.newDamagedStock}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge
                            variant="outline"
                            className={
                              item.difference > 0
                                ? "text-red-700 border-red-300 bg-red-50"
                                : item.difference < 0
                                ? "text-green-700 border-green-300 bg-green-50"
                                : "text-slate-600 border-slate-300 bg-slate-50"
                            }
                          >
                            {item.difference > 0 ? `+${item.difference}` : item.difference}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[150px] truncate">
                          {item.itemReason}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-slate-800 hover:bg-slate-100"
                              onClick={() => openEditDialog(item)}
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-red-500 hover:bg-red-50"
                              onClick={() => handleRemoveItem(item.productId)}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            <div className="mt-6 flex justify-end">
              <Button
                size="lg"
                className="w-full md:w-auto bg-slate-900 hover:bg-slate-800 text-white"
                onClick={handleSaveAll}
                disabled={pendingAdjustments.length === 0 || submitting}
              >
                {submitting ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                Save Damaged Stock Adjustments
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Current Damaged Stock Overview Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-red-600" />
              Current Damaged Inventory ({locations.find((l) => l.id === selectedLocationId)?.name || "Location"})
            </CardTitle>
            <CardDescription>
              All products that currently have non-zero damaged units in this warehouse.
            </CardDescription>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <span className="text-xs text-muted-foreground block">Total Damaged Units</span>
              <span className="text-xl font-bold text-red-600">
                {allProducts
                  .reduce((sum, p) => sum + (damagedStocks[p.id] || 0), 0)
                  .toLocaleString()}
              </span>
            </div>
            <div className="text-right border-l pl-4">
              <span className="text-xs text-muted-foreground block">Total Damaged Value</span>
              <span className="text-xl font-bold text-slate-900">
                LKR{" "}
                {allProducts
                  .reduce(
                    (sum, p) =>
                      sum + (damagedStocks[p.id] || 0) * (p.costPrice || 0),
                    0
                  )
                  .toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {allProducts.filter((p) => (damagedStocks[p.id] || 0) > 0).length === 0 ? (
            <div className="text-center py-8 text-muted-foreground border rounded-md bg-muted/10">
              <p className="font-medium text-green-700">No damaged stock recorded in this location.</p>
              <p className="text-xs text-muted-foreground">All items are at 0 damaged units.</p>
            </div>
          ) : (
            <div className="border rounded-md overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-100/60">
                    <TableHead>Product Name</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead className="text-right font-semibold text-red-600">Damaged Units</TableHead>
                    <TableHead className="text-right">Good Stock</TableHead>
                    <TableHead className="text-right">Damaged Value</TableHead>
                    <TableHead className="text-right">Quick Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allProducts
                    .filter((p) => (damagedStocks[p.id] || 0) > 0)
                    .map((p) => {
                      const dmg = damagedStocks[p.id] || 0;
                      const good = goodStocks[p.id] || 0;
                      const val = dmg * (p.costPrice || 0);
                      return (
                        <TableRow key={p.id}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              {p.images?.[0] ? (
                                <img
                                  src={p.images[0]}
                                  alt={p.name}
                                  className="w-8 h-8 rounded object-cover border"
                                />
                              ) : null}
                              <span>{p.name}</span>
                            </div>
                          </TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">
                            {p.sku}
                          </TableCell>
                          <TableCell className="text-right font-bold text-red-600 text-base">
                            {dmg}
                          </TableCell>
                          <TableCell className="text-right font-medium text-slate-700">
                            {good}
                          </TableCell>
                          <TableCell className="text-right font-medium text-slate-900">
                            LKR {val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1.5">
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs border-slate-300 text-slate-700 hover:bg-slate-100"
                                onClick={() => {
                                  setSelectedProductId(p.id);
                                  setAdjustmentValue(String(dmg));
                                  setAddMode("set");
                                  window.scrollTo({ top: 0, behavior: "smooth" });
                                }}
                              >
                                Adjust
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs border-red-200 text-red-600 hover:bg-red-50"
                                onClick={() => {
                                  if (pendingAdjustments.some((a) => a.productId === p.id)) {
                                    toast.error("Already in pending adjustment list");
                                    return;
                                  }
                                  setPendingAdjustments([
                                    ...pendingAdjustments,
                                    {
                                      productId: p.id,
                                      productName: p.name,
                                      sku: p.sku,
                                      unitOfMeasure: p.unitOfMeasure,
                                      images: p.images,
                                      currentDamagedStock: dmg,
                                      newDamagedStock: 0,
                                      difference: -dmg,
                                      itemReason: "Write-off / Disposed to 0",
                                    },
                                  ]);
                                  toast.success(`Added ${p.name} (Zero out) to pending adjustments`);
                                }}
                              >
                                Zero Out
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={editDialog.open} onOpenChange={(open) => setEditDialog((d) => ({ ...d, open }))}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="w-4 h-4 text-slate-800" />
              Edit Damaged Quantity
            </DialogTitle>
            <DialogDescription className="text-sm pt-1">
              {editDialog.productName}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium">New Damaged Count</label>
              <Input
                type="number"
                className="mt-1 text-lg font-semibold"
                value={editDialog.editValue}
                onChange={(e) => setEditDialog((d) => ({ ...d, editValue: e.target.value }))}
                onKeyDown={(e) => e.key === "Enter" && handleEditSave()}
                autoFocus
              />
            </div>
            <div>
              <label className="text-sm font-medium">Reason / Note</label>
              <Input
                className="mt-1"
                value={editDialog.editNote}
                onChange={(e) => setEditDialog((d) => ({ ...d, editNote: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setEditDialog((d) => ({ ...d, open: false }))}>
              Cancel
            </Button>
            <Button className="bg-slate-900 hover:bg-slate-800 text-white" onClick={handleEditSave}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Dialog */}
      <Dialog open={confirmDialog.open} onOpenChange={(open) => setConfirmDialog((p) => ({ ...p, open }))}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-slate-800" />
              {confirmDialog.title}
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground pt-1">
              {confirmDialog.message}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setConfirmDialog((p) => ({ ...p, open: false }))}>
              Cancel
            </Button>
            <Button
              className="bg-slate-900 hover:bg-slate-800 text-white"
              onClick={() => {
                setConfirmDialog((p) => ({ ...p, open: false }));
                confirmDialog.onConfirm();
              }}
            >
              Confirm & Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
