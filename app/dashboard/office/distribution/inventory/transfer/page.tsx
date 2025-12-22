"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  ArrowLeft,
  Loader2,
  Plus,
  X,
  Package,
  MapPin,
  ClipboardList,
  Truck,
  CalendarIcon,
  Search,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { BUSINESS_IDS } from "@/app/config/business-constants";

// --- Interfaces ---
// FIX: Added 'isMain' to the interface to resolve TypeScript error
interface Location {
  id: string;
  name: string;
  isMain?: boolean;
}

interface Product {
  id: string;
  sku: string;
  name: string;
  category?: string;
  brand?: string;
  available_quantity: number;
  unit: string;
  // Store raw values to re-calc on toggle
  raw_qty: number;
  raw_damaged: number;
}

interface TransferItem {
  productId: string;
  productName: string;
  sku: string;
  category?: string;
  quantity: number;
  availableQuantity: number;
  unit: string;
}

export default function StockTransferPage() {
  const router = useRouter();

  // --- State ---
  const [locations, setLocations] = useState<Location[]>([]);
  const [sourceId, setSourceId] = useState("");
  const [destId, setDestId] = useState("");
  const [reason, setReason] = useState("");
  const [transferDate, setTransferDate] = useState(
    new Date().toISOString().split("T")[0]
  );

  // New State: Transfer Type
  const [transferType, setTransferType] = useState<"Good" | "Damage">("Good");

  const [sourceProducts, setSourceProducts] = useState<Product[]>([]);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [quantity, setQuantity] = useState("");

  const [transferItems, setTransferItems] = useState<TransferItem[]>([]);

  const [loading, setLoading] = useState(true);
  const [stockLoading, setStockLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // --- Effects ---
  useEffect(() => {
    fetchLocations();
  }, []);

  useEffect(() => {
    if (sourceId) {
      fetchSourceStock();
    } else {
      setSourceProducts([]);
      setTransferItems([]);
      setSelectedProductId("");
      setQuantity("");
    }
  }, [sourceId, transferType]); // Re-fetch/Re-calc when type changes

  // --- Fetch Data ---
  const fetchLocations = async () => {
    try {
      // Pass businessId to filter: Main Warehouse + Distribution Locations
      const res = await fetch(
        `/api/settings/locations?businessId=${BUSINESS_IDS.CHAMPIKA_DISTRIBUTION}`
      );
      if (!res.ok) throw new Error("Failed to load locations");
      const data = await res.json();
      setLocations(data);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchSourceStock = async () => {
    setStockLoading(true);
    try {
      const res = await fetch(`/api/inventory/${sourceId}`);
      if (!res.ok) throw new Error("Failed to load stock data");
      const data = await res.json();

      const products = data.stocks.map((stock: any) => ({
        id: stock.id,
        sku: stock.sku,
        name: stock.name,
        category: stock.category,
        brand: stock.brand,
        // FIX: Map using 'damagedQuantity' (from API) not 'damaged_quantity'
        available_quantity:
          transferType === "Good"
            ? Number(stock.quantity || 0)
            : Number(stock.damagedQuantity || 0),
        raw_qty: Number(stock.quantity || 0),
        raw_damaged: Number(stock.damagedQuantity || 0),
        unit: stock.unit_of_measure || "Units",
      }));

      // Filter out items with 0 stock for the selected type to clean up the list
      const availableProducts = products.filter(
        (p: any) => p.available_quantity > 0
      );

      setSourceProducts(availableProducts);
      // Clear selection if type changes to prevent stale data
      setSelectedProductId("");
      setTransferItems([]);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setStockLoading(false);
    }
  };

  // --- Handlers ---
  const handleAddProduct = () => {
    if (!selectedProductId) {
      toast.error("Please select a product");
      return;
    }

    const qty = parseFloat(quantity);
    if (isNaN(qty) || qty <= 0) {
      toast.error("Please enter a valid quantity");
      return;
    }

    const product = sourceProducts.find((p) => p.id === selectedProductId);
    if (!product) return;

    if (qty > product.available_quantity) {
      toast.error(
        `Max available is ${product.available_quantity} ${product.unit}`
      );
      return;
    }

    const existingIndex = transferItems.findIndex(
      (item) => item.productId === selectedProductId
    );

    if (existingIndex >= 0) {
      const updatedItems = [...transferItems];
      updatedItems[existingIndex].quantity = qty;
      setTransferItems(updatedItems);
      toast.success("Quantity updated");
    } else {
      setTransferItems([
        ...transferItems,
        {
          productId: product.id,
          productName: product.name,
          sku: product.sku,
          category: product.category,
          quantity: qty,
          availableQuantity: product.available_quantity,
          unit: product.unit,
        },
      ]);
      toast.success("Added to list");
    }

    setSelectedProductId("");
    setQuantity("");
  };

  const handleRemoveItem = (productId: string) => {
    setTransferItems(transferItems.filter((i) => i.productId !== productId));
  };

  const handleSubmit = async () => {
    if (!sourceId || !destId) {
      toast.error("Select source and destination");
      return;
    }
    if (transferItems.length === 0) {
      toast.error("Add products to transfer");
      return;
    }
    if (!transferDate) {
      toast.error("Select a transfer date");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        sourceLocationId: sourceId,
        destLocationId: destId,
        items: transferItems.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
        })),
        reason: reason || `Stock Transfer (${transferType})`,
        transferDate: transferDate,
        transferType: transferType, // Send type to API
      };

      const res = await fetch("/api/inventory/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Transfer failed");

      toast.success("Transfer completed successfully");
      router.push("/dashboard/admin/inventory");
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const selectedProduct = sourceProducts.find(
    (p) => p.id === selectedProductId
  );

  if (loading && locations.length === 0) {
    return (
      <div className="flex justify-center p-10">
        <Loader2 className="animate-spin h-8 w-8 text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 1. Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="-ml-2 h-8 w-8 text-muted-foreground"
              onClick={() => router.back()}
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <h1 className="text-3xl font-bold tracking-tight">
              Stock Transfer
            </h1>
          </div>
          <p className="text-muted-foreground mt-1 ml-8">
            Move inventory between warehouses and locations (Distribution).
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => router.push("/dashboard/admin/inventory")}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={
              submitting || !sourceId || !destId || transferItems.length === 0
            }
          >
            {submitting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Truck className="mr-2 h-4 w-4" />
            )}
            Confirm Transfer
          </Button>
        </div>
      </div>

      {/* 2. Main Grid Content */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* LEFT COLUMN: Controls */}
        <div className="lg:col-span-2 space-y-6">
          {/* A. Route & Date Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <MapPin className="w-4 h-4 text-primary" /> Transfer Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>From Location</Label>
                  <Select value={sourceId} onValueChange={setSourceId}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select Source" />
                    </SelectTrigger>
                    <SelectContent>
                      {locations.map((loc) => (
                        <SelectItem key={loc.id} value={loc.id}>
                          {loc.name} {loc.isMain ? "(Main)" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>To Location</Label>
                  <Select
                    value={destId}
                    onValueChange={setDestId}
                    disabled={!sourceId}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select Destination" />
                    </SelectTrigger>
                    <SelectContent>
                      {locations
                        .filter((l) => l.id !== sourceId)
                        .map((loc) => (
                          <SelectItem key={loc.id} value={loc.id}>
                            {loc.name} {loc.isMain ? "(Main)" : ""}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Transfer Type Selector */}
              <div className="space-y-2 pt-2">
                <Label>Stock Condition</Label>
                <RadioGroup
                  defaultValue="Good"
                  value={transferType}
                  onValueChange={(val: "Good" | "Damage") =>
                    setTransferType(val)
                  }
                  className="flex gap-4"
                >
                  <div className="flex items-center space-x-2 border rounded-md p-3 w-full cursor-pointer hover:bg-muted/50">
                    <RadioGroupItem value="Good" id="good" />
                    <Label htmlFor="good" className="cursor-pointer flex-1">
                      Good Stock
                    </Label>
                    <Package className="w-4 h-4 text-green-600" />
                  </div>
                  <div className="flex items-center space-x-2 border rounded-md p-3 w-full cursor-pointer hover:bg-muted/50">
                    <RadioGroupItem value="Damage" id="damage" />
                    <Label htmlFor="damage" className="cursor-pointer flex-1">
                      Damaged / Returns
                    </Label>
                    <AlertTriangle className="w-4 h-4 text-red-600" />
                  </div>
                </RadioGroup>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Transfer Date</Label>
                  <div className="relative">
                    <Input
                      type="date"
                      className="w-full pl-10"
                      value={transferDate}
                      onChange={(e) => setTransferDate(e.target.value)}
                    />
                    <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Reference / Reason</Label>
                  <Input
                    placeholder="e.g. Weekly Restock"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* B. Add Product Card */}
          <Card className={!sourceId ? "opacity-60 pointer-events-none" : ""}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Package className="w-4 h-4 text-primary" /> Select Products
              </CardTitle>
            </CardHeader>
            <CardContent>
              {stockLoading ? (
                <div className="flex justify-center py-4 text-muted-foreground">
                  <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading
                  stock...
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex flex-col md:flex-row gap-4 items-end">
                    <div className="flex-1 w-full space-y-2">
                      <Label>Product ({transferType})</Label>
                      <Select
                        value={selectedProductId}
                        onValueChange={setSelectedProductId}
                      >
                        <SelectTrigger className="w-full">
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Search className="w-4 h-4" />
                            <SelectValue placeholder="Search product..." />
                          </div>
                        </SelectTrigger>
                        <SelectContent className="max-h-[300px]">
                          {sourceProducts.length === 0 ? (
                            <div className="p-2 text-sm text-center text-muted-foreground">
                              No {transferType} Stock Available
                            </div>
                          ) : (
                            sourceProducts.map((p) => (
                              <SelectItem key={p.id} value={p.id}>
                                <div className="flex justify-between w-full gap-4">
                                  <span>{p.name}</span>
                                  <Badge
                                    variant={
                                      transferType === "Good"
                                        ? "secondary"
                                        : "destructive"
                                    }
                                    className="text-xs"
                                  >
                                    {p.available_quantity} {p.unit} avl
                                  </Badge>
                                </div>
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="w-full md:w-32 space-y-2">
                      <Label>Quantity</Label>
                      <Input
                        type="number"
                        className="w-full"
                        placeholder="0"
                        value={quantity}
                        onChange={(e) => setQuantity(e.target.value)}
                        onKeyDown={(e) =>
                          e.key === "Enter" && handleAddProduct()
                        }
                      />
                    </div>
                    <Button
                      onClick={handleAddProduct}
                      disabled={!selectedProductId || !quantity}
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>

                  {selectedProduct && (
                    <div
                      className={`text-sm px-3 py-2 rounded border flex justify-between ${
                        transferType === "Good"
                          ? "bg-blue-50 border-blue-100 text-blue-600"
                          : "bg-red-50 border-red-100 text-red-600"
                      }`}
                    >
                      <span>
                        Selected: <strong>{selectedProduct.name}</strong>
                      </span>
                      <span>
                        Available ({transferType}):{" "}
                        {selectedProduct.available_quantity}{" "}
                        {selectedProduct.unit}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* RIGHT COLUMN: Review Table */}
        <div className="space-y-6">
          <Card className="h-full flex flex-col">
            <CardHeader className="border-b pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  <ClipboardList className="w-4 h-4 text-primary" /> Transfer
                  List
                </CardTitle>
                {transferItems.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-destructive"
                    onClick={() => setTransferItems([])}
                  >
                    Clear
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="flex-1 p-0 overflow-hidden min-h-[300px]">
              {transferItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                  <Package className="w-10 h-10 opacity-20 mb-2" />
                  <p>No items added yet</p>
                  <Badge variant="outline" className="mt-2">
                    {transferType} Mode
                  </Badge>
                </div>
              ) : (
                <div className="max-h-[500px] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="pl-4">Item</TableHead>
                        <TableHead className="text-right">Qty</TableHead>
                        <TableHead className="w-10"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transferItems.map((item) => (
                        <TableRow key={item.productId}>
                          <TableCell className="pl-4 py-3">
                            <div className="font-medium text-sm">
                              {item.productName}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {item.sku}
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {item.quantity}{" "}
                            <span className="text-xs text-muted-foreground font-normal ml-0.5">
                              {item.unit}
                            </span>
                          </TableCell>
                          <TableCell className="pr-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-muted-foreground hover:text-destructive"
                              onClick={() => handleRemoveItem(item.productId)}
                            >
                              <X className="w-3 h-3" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>

            {/* Footer Summary */}
            <div className="p-4 border-t bg-muted/20">
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Total Items</span>
                <span className="font-bold text-lg">
                  {transferItems.reduce((acc, i) => acc + i.quantity, 0)}
                </span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
