"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
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
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
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
import { BUSINESS_IDS } from "@/app/config/business-constants";

interface Product {
  id: string;
  sku: string;
  name: string;
  category: string;
  supplier?: string;
}

const AGENCY_KEYWORDS = ["orange", "orel", "sierra", "wireman"];
const isAgencyProduct = (p: Product) =>
  AGENCY_KEYWORDS.some((kw) => p.supplier?.toLowerCase().includes(kw));

interface PendingAdjustment {
  productId: string;
  productName: string;
  sku: string;
  currentStock: number;
  newStock: number;
  difference: number;
}

export default function StockAdjustmentPage() {
  const params = useParams();
  const router = useRouter();
  const rawId = params?.id;
  const locationId = Array.isArray(rawId) ? rawId[0] : rawId;

  const [loading, setLoading] = useState(true);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [locationStocks, setLocationStocks] = useState<Record<string, number>>({});
  const [locationName, setLocationName] = useState("");

  const [selectedProductId, setSelectedProductId] = useState("");
  const [adjustmentValue, setAdjustmentValue] = useState("");
  const [addMode, setAddMode] = useState<"set" | "add">("set");
  const [pendingAdjustments, setPendingAdjustments] = useState<PendingAdjustment[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [zeroOutUnlisted, setZeroOutUnlisted] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [editDialog, setEditDialog] = useState<{ open: boolean; productId: string; productName: string; editValue: string }>({
    open: false, productId: "", productName: "", editValue: "",
  });
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean; title: string; message: string; onConfirm: () => void;
  }>({ open: false, title: "", message: "", onConfirm: () => {} });

  const showConfirm = (title: string, message: string, onConfirm: () => void) =>
    setConfirmDialog({ open: true, title, message, onConfirm });

  useEffect(() => {
    const initData = async () => {
      try {
        setLoading(true);
        const [productsRes, fullProductsRes, stockRes] = await Promise.all([
          fetch(`/api/inventory?businessId=${BUSINESS_IDS.CHAMPIKA_DISTRIBUTION}`),
          fetch("/api/products?active=true"),
          fetch(`/api/inventory/${locationId}?businessId=${BUSINESS_IDS.CHAMPIKA_DISTRIBUTION}`),
        ]);
        const productsData = await productsRes.json();
        const fullProductsData = fullProductsRes.ok ? await fullProductsRes.json() : [];
        const stockData = await stockRes.json();

        if (stockData.location) setLocationName(stockData.location.name);

        const stockMap: Record<string, number> = {};
        if (stockData.stocks) {
          stockData.stocks.forEach((s: any) => { stockMap[s.id] = s.quantity; });
        }

        // Merge supplier info from full product list
        const supplierMap: Record<string, string> = {};
        if (Array.isArray(fullProductsData)) {
          fullProductsData.forEach((p: any) => { if (p.supplier) supplierMap[p.id] = p.supplier; });
        }

        if (productsData.products) {
          setAllProducts(
            productsData.products.map((p: Product) => ({
              ...p,
              supplier: supplierMap[p.id] || "",
            }))
          );
        }
        setLocationStocks(stockMap);
      } catch (error) {
        console.error(error);
        toast.error("Failed to load initialization data");
      } finally {
        setLoading(false);
      }
    };
    if (locationId) initData();
  }, [locationId]);

  const selectedProduct = allProducts.find((p) => p.id === selectedProductId);
  const currentStock = selectedProductId ? locationStocks[selectedProductId] || 0 : 0;

  const handleAddToTable = () => {
    if (!selectedProduct) return toast.error("Select a product first");
    if (adjustmentValue === "") return toast.error("Enter a valid quantity");

    const enteredQty = parseFloat(adjustmentValue);
    if (isNaN(enteredQty) || enteredQty < 0) return toast.error("Quantity must be a valid positive number");
    if (pendingAdjustments.some((p) => p.productId === selectedProductId)) {
      toast.error("This product is already in the adjustment list");
      return;
    }

    const finalQty = addMode === "add" ? currentStock + enteredQty : enteredQty;
    setPendingAdjustments([
      ...pendingAdjustments,
      {
        productId: selectedProduct.id,
        productName: selectedProduct.name,
        sku: selectedProduct.sku,
        currentStock,
        newStock: finalQty,
        difference: finalQty - currentStock,
      },
    ]);
    setAdjustmentValue("");
    setSelectedProductId("");
  };

  const handleRemoveItem = (id: string) => {
    setPendingAdjustments(pendingAdjustments.filter((p) => p.productId !== id));
  };

  const openEditDialog = (item: PendingAdjustment) => {
    setEditDialog({ open: true, productId: item.productId, productName: item.productName, editValue: String(item.newStock) });
  };

  const handleEditSave = () => {
    const newQty = parseFloat(editDialog.editValue);
    if (isNaN(newQty) || newQty < 0) return toast.error("Quantity must be a valid positive number");
    setPendingAdjustments(pendingAdjustments.map((p) =>
      p.productId === editDialog.productId
        ? { ...p, newStock: newQty, difference: newQty - p.currentStock }
        : p
    ));
    setEditDialog((d) => ({ ...d, open: false }));
  };

  // Non-agency products with stock not already in the pending list
  // Agency products (Orange/Orel/Sierra/Wireman) are always protected from bulk zeroing
  const unlistedWithStock = allProducts.filter(
    (p) =>
      !isAgencyProduct(p) &&
      (locationStocks[p.id] || 0) > 0 &&
      !pendingAdjustments.some((a) => a.productId === p.id),
  );

  const agencyWithStock = allProducts.filter(
    (p) => isAgencyProduct(p) && (locationStocks[p.id] || 0) > 0,
  );

  const handleZeroAll = () => {
    const stockedNonAgency = allProducts.filter(
      (p) => !isAgencyProduct(p) && (locationStocks[p.id] || 0) > 0
    );
    if (stockedNonAgency.length === 0) return toast.info("No non-agency products have stock to zero.");

    showConfirm(
      "Zero All & Start Fresh",
      `This will zero ${stockedNonAgency.length} non-agency product(s) in ${locationName}. Orange / Sierra / Wireman items (${agencyWithStock.length} with stock) will NOT be touched.`,
      async () => {
        setResetting(true);
        try {
          const itemsPayload = stockedNonAgency.map((p) => ({ productId: p.id, newQuantity: 0 }));
          const res = await fetch("/api/inventory/adjust", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              locationId,
              items: itemsPayload,
              reason: "Fresh Count Reset — non-agency stock zeroed before manual count (Distribution Portal)",
              businessId: BUSINESS_IDS.CHAMPIKA_DISTRIBUTION,
            }),
          });
          const result = await res.json();
          if (!res.ok) throw new Error(result.error || "Reset failed");

          const newStockMap = { ...locationStocks };
          stockedNonAgency.forEach((p) => { newStockMap[p.id] = 0; });
          setLocationStocks(newStockMap);
          setPendingAdjustments([]);
          toast.success(`${stockedNonAgency.length} non-agency products zeroed. Agency items untouched.`);
        } catch (error: any) {
          toast.error(error.message || "Failed to reset stock");
        } finally {
          setResetting(false);
        }
      }
    );
  };

  const handleSaveAll = () => {
    if (pendingAdjustments.length === 0) return toast.error("List is empty");

    const zeroCount = zeroOutUnlisted ? unlistedWithStock.length : 0;
    const totalCount = pendingAdjustments.length + zeroCount;
    const confirmMsg =
      zeroOutUnlisted && zeroCount > 0
        ? `Save ${pendingAdjustments.length} adjustment(s) and zero out ${zeroCount} unlisted non-agency product(s). Total: ${totalCount} items will be updated.`
        : `Save ${pendingAdjustments.length} stock adjustment(s) to ${locationName}.`;

    showConfirm("Confirm Adjustments", confirmMsg, async () => {
      setSubmitting(true);
      try {
        const itemsPayload = pendingAdjustments.map((item) => ({
          productId: item.productId,
          newQuantity: item.newStock,
        }));

        if (zeroOutUnlisted) {
          unlistedWithStock.forEach((p) => {
            itemsPayload.push({ productId: p.id, newQuantity: 0 });
          });
        }

        const res = await fetch("/api/inventory/adjust", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            locationId,
            items: itemsPayload,
            reason: zeroOutUnlisted
              ? "Full Stock Count — unlisted items zeroed (Distribution Portal)"
              : "Manual Stock Adjustment (Distribution Portal)",
            businessId: BUSINESS_IDS.CHAMPIKA_DISTRIBUTION,
          }),
        });

        if (!res.ok) throw new Error("Update failed");

        toast.success("Stock adjustments saved successfully!");
        router.push(`/dashboard/office/distribution/inventory/${locationId}`);
      } catch (error) {
        toast.error("Failed to save adjustments");
      } finally {
        setSubmitting(false);
      }
    });
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            Stock Adjustment
          </h1>
          <p className="text-muted-foreground text-sm flex items-center gap-1">
            Update physical stock counts for{" "}
            {locationName ? (
              <span className="font-semibold text-blue-600 flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                {locationName}
              </span>
            ) : (
              "location"
            )}
            .
          </p>
        </div>
        <Button
          variant="outline"
          className="border-blue-300 text-blue-700 hover:bg-blue-50"
          onClick={handleZeroAll}
          disabled={resetting}
        >
          {resetting ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <RotateCcw className="w-4 h-4 mr-2" />
          )}
          Zero All & Start Fresh
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Panel */}
        <Card className="md:col-span-1 h-fit">
          <CardHeader>
            <CardTitle className="text-lg">Add Adjustment</CardTitle>
            <CardDescription>Select product and enter real count.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Select Product</label>
              <SearchableDropdown
                options={allProducts
                  .filter((p) => !pendingAdjustments.some((a) => a.productId === p.id))
                  .map((p) => ({ id: p.id, name: p.name, info: p.sku }))}
                value={selectedProductId}
                onChange={setSelectedProductId}
                placeholder="Search product..."
              />
            </div>

            <div className="p-3 bg-muted/30 rounded-lg border text-center space-y-1">
              <span className="text-xs text-muted-foreground uppercase tracking-wide">
                Current System Stock
              </span>
              <div className="text-3xl font-bold text-slate-800">
                {selectedProductId ? currentStock : "-"}
              </div>
            </div>

            <div className="flex rounded-md border overflow-hidden text-sm font-medium">
              <button
                type="button"
                className={cn("flex-1 py-2 transition-colors", addMode === "set" ? "bg-blue-600 text-white" : "bg-muted text-muted-foreground hover:bg-muted/70")}
                onClick={() => setAddMode("set")}
              >
                Set
              </button>
              <button
                type="button"
                className={cn("flex-1 py-2 transition-colors", addMode === "add" ? "bg-blue-600 text-white" : "bg-muted text-muted-foreground hover:bg-muted/70")}
                onClick={() => setAddMode("add")}
              >
                Add to Current
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">
                {addMode === "add" ? "Qty to Add" : "New Physical Stock"}
              </label>
              <Input
                type="number"
                placeholder="Enter qty"
                value={adjustmentValue}
                onChange={(e) => setAdjustmentValue(e.target.value)}
                disabled={!selectedProductId}
                className="text-lg font-semibold"
              />
              {addMode === "add" && selectedProductId && adjustmentValue !== "" && !isNaN(parseFloat(adjustmentValue)) && (
                <p className="text-xs text-blue-700 font-medium">
                  Result: {currentStock} + {parseFloat(adjustmentValue)} = <span className="font-bold">{currentStock + parseFloat(adjustmentValue)}</span>
                </p>
              )}
            </div>

            <Button
              className="w-full bg-blue-600 hover:bg-blue-700"
              onClick={handleAddToTable}
              disabled={!selectedProductId || adjustmentValue === ""}
            >
              <Plus className="w-4 h-4 mr-2" /> Add to List
            </Button>
          </CardContent>
        </Card>

        {/* Right Panel */}
        <Card className="md:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="text-lg">Pending Adjustments</CardTitle>
              <CardDescription>Review changes before saving.</CardDescription>
            </div>
            {pendingAdjustments.length > 0 && (
              <Badge variant="secondary">{pendingAdjustments.length} Items</Badge>
            )}
          </CardHeader>
          <CardContent>
            {pendingAdjustments.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-muted-foreground border-2 border-dashed rounded-lg bg-muted/10">
                <AlertCircle className="w-10 h-10 mb-2 opacity-20" />
                <p>No items added yet.</p>
                <p className="text-xs">Search and add items from the left.</p>
              </div>
            ) : (
              <div className="border rounded-md overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Product</TableHead>
                      <TableHead className="text-right">System</TableHead>
                      <TableHead className="text-right">Physical</TableHead>
                      <TableHead className="text-right">Diff</TableHead>
                      <TableHead className="w-[90px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingAdjustments.map((item) => (
                      <TableRow key={item.productId}>
                        <TableCell>
                          <div className="font-medium">{item.productName}</div>
                          <div className="text-xs text-muted-foreground">{item.sku}</div>
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {item.currentStock}
                        </TableCell>
                        <TableCell className="text-right font-bold text-blue-600">
                          {item.newStock}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge
                            variant="outline"
                            className={
                              item.difference < 0
                                ? "text-red-600 border-red-200 bg-red-50"
                                : "text-green-600 border-green-200 bg-green-50"
                            }
                          >
                            {item.difference > 0 ? "+" : ""}
                            {item.difference}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-blue-500 hover:bg-blue-50"
                              onClick={() => openEditDialog(item)}
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-red-500 hover:bg-red-50"
                              onClick={() => handleRemoveItem(item.productId)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {/* Zero-out toggle */}
            <div className="mt-6 rounded-lg border border-blue-200 bg-blue-50 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-blue-600" />
                  <Label htmlFor="zero-unlisted-dist" className="font-semibold text-blue-800 cursor-pointer">
                    Zero out all unlisted products
                  </Label>
                </div>
                <Switch
                  id="zero-unlisted-dist"
                  checked={zeroOutUnlisted}
                  onCheckedChange={setZeroOutUnlisted}
                />
              </div>
              <p className="text-xs text-blue-700">
                When ON, non-agency products with stock <strong>not</strong> in your list will be set to <strong>0</strong> on save.
                Orange / Sierra / Wireman items are <strong>always protected</strong>.
                {zeroOutUnlisted && unlistedWithStock.length > 0 && (
                  <span className="ml-1 font-bold text-red-700">
                    {unlistedWithStock.length} non-agency product(s) will be zeroed.
                  </span>
                )}
                {zeroOutUnlisted && agencyWithStock.length > 0 && (
                  <span className="ml-1 text-blue-700 font-medium">
                    {agencyWithStock.length} agency item(s) skipped.
                  </span>
                )}
                {zeroOutUnlisted && unlistedWithStock.length === 0 && (
                  <span className="ml-1 text-green-700 font-medium">
                    All non-agency stocked products are already in your list.
                  </span>
                )}
              </p>
            </div>

            <div className="mt-4 flex justify-end">
              <Button
                size="lg"
                className="w-full md:w-auto bg-green-600 hover:bg-green-700 text-white"
                onClick={handleSaveAll}
                disabled={pendingAdjustments.length === 0 || submitting}
              >
                {submitting ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                {zeroOutUnlisted && unlistedWithStock.length > 0
                  ? `Adjust All & Zero ${unlistedWithStock.length} Others`
                  : "Adjust All & Save"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={editDialog.open} onOpenChange={(open) => setEditDialog((d) => ({ ...d, open }))}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="w-4 h-4 text-blue-600" />
              Edit Stock Quantity
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground pt-1">
              {editDialog.productName}
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <label className="text-sm font-medium">New Physical Stock</label>
            <Input
              type="number"
              className="mt-2 text-lg font-semibold"
              value={editDialog.editValue}
              onChange={(e) => setEditDialog((d) => ({ ...d, editValue: e.target.value }))}
              onKeyDown={(e) => e.key === "Enter" && handleEditSave()}
              autoFocus
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setEditDialog((d) => ({ ...d, open: false }))}>
              Cancel
            </Button>
            <Button className="bg-blue-600 hover:bg-blue-700 text-white" onClick={handleEditSave}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmDialog.open} onOpenChange={(open) => setConfirmDialog((p) => ({ ...p, open }))}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-blue-600" />
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
              className="bg-blue-600 hover:bg-blue-700 text-white"
              onClick={() => {
                setConfirmDialog((p) => ({ ...p, open: false }));
                confirmDialog.onConfirm();
              }}
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
