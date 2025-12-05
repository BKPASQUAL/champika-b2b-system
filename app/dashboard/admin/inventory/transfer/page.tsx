// app/dashboard/admin/inventory/transfer/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
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
import {
  ArrowLeft,
  ArrowRight,
  Loader2,
  Plus,
  X,
  Package,
  Warehouse,
  CheckCircle2,
  ArrowRightLeft,
  Search,
  Truck,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

// --- Interfaces (Kept exactly same) ---
interface Location {
  id: string;
  name: string;
}

interface Product {
  id: string;
  sku: string;
  name: string;
  category?: string;
  brand?: string;
  available_quantity: number;
}

interface TransferItem {
  productId: string;
  productName: string;
  sku: string;
  category?: string;
  quantity: number;
  availableQuantity: number;
}

export default function BulkStockTransferPage() {
  const router = useRouter();

  // --- State (Kept exactly same) ---
  const [locations, setLocations] = useState<Location[]>([]);
  const [sourceId, setSourceId] = useState("");
  const [destId, setDestId] = useState("");
  const [reason, setReason] = useState("");

  const [sourceProducts, setSourceProducts] = useState<Product[]>([]);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [quantity, setQuantity] = useState("");

  const [transferItems, setTransferItems] = useState<TransferItem[]>([]);

  const [loading, setLoading] = useState(true);
  const [stockLoading, setStockLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // --- Effects & Fetch Logic (Kept exactly same) ---
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
  }, [sourceId]);

  const fetchLocations = async () => {
    try {
      const res = await fetch("/api/settings/locations");
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
        available_quantity: stock.quantity,
      }));

      setSourceProducts(products);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setStockLoading(false);
    }
  };

  // --- Handlers (Kept exactly same) ---
  const handleAddProduct = () => {
    if (!selectedProductId) {
      toast.error("Please select a product");
      return;
    }

    const qty = parseInt(quantity, 10);
    if (isNaN(qty) || qty <= 0) {
      toast.error("Please enter a valid quantity");
      return;
    }

    const product = sourceProducts.find((p) => p.id === selectedProductId);
    if (!product) return;

    if (qty > product.available_quantity) {
      toast.error(
        `Maximum available quantity is ${product.available_quantity}`
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
      toast.success("Product quantity updated");
    } else {
      const newItem: TransferItem = {
        productId: product.id,
        productName: product.name,
        sku: product.sku,
        category: product.category,
        quantity: qty,
        availableQuantity: product.available_quantity,
      };
      setTransferItems([...transferItems, newItem]);
      toast.success("Product added to transfer list");
    }

    setSelectedProductId("");
    setQuantity("");
  };

  const handleRemoveItem = (productId: string) => {
    setTransferItems(
      transferItems.filter((item) => item.productId !== productId)
    );
    toast.success("Product removed from transfer list");
  };

  const handleSubmit = async () => {
    if (!sourceId || !destId) {
      toast.error("Please select source and destination locations");
      return;
    }
    if (transferItems.length === 0) {
      toast.error("Please add at least one product to transfer");
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
        reason: reason || "Bulk Stock Transfer",
      };

      const res = await fetch("/api/inventory/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Transfer failed");

      toast.success(
        `Successfully transferred ${transferItems.length} product(s)`
      );
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
  const totalItems = transferItems.reduce(
    (sum, item) => sum + item.quantity,
    0
  );

  if (loading && locations.length === 0) {
    return (
      <div className="flex justify-center items-center h-screen bg-gray-50/50">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  // --- New Design Layout ---
  return (
    <div className=" bg-gray-50/50 pb-20">
      {/* Top Navigation Bar */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="container max-w-6xl mx-auto py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => router.back()}>
              <ArrowLeft className="w-5 h-5 text-gray-500" />
            </Button>
            <div>
              <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <Truck className="w-5 h-5" /> Stock Transfer
              </h1>
              <p className="text-sm text-gray-500">
                Move inventory between warehouses
              </p>
            </div>
            <div className="ml-auto flex items-center gap-3">
              <Button
                variant="outline"
                onClick={() => router.push("/dashboard/admin/inventory")}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={
                  submitting ||
                  !sourceId ||
                  !destId ||
                  transferItems.length === 0
                }
              >
                {submitting && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Confirm Transfer
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="container  mx-auto py-8 space-y-8">
        {/* Step 1: Configuration Card */}
        <Card className="shadow-sm border-0 ring-1 ring-gray-200">
          <CardHeader>
            <CardTitle className="text-lg font-medium flex items-center gap-2">
              <span className="bg-primary/10 text-primary w-6 h-6 rounded-full flex items-center justify-center text-xs">
                1
              </span>
              Transfer Route & Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="bg-gray-50/80 p-6 rounded-xl border border-dashed border-gray-200">
              <div className="flex flex-col md:flex-row items-center gap-6">
                {/* Source */}
                <div className="flex-1 w-full space-y-2">
                  <Label className="text-xs font-semibold uppercase text-gray-500 tracking-wider">
                    From Location
                  </Label>
                  <Select value={sourceId} onValueChange={setSourceId}>
                    <SelectTrigger className="h-12 w-full bg-white border-gray-300 shadow-sm text-base">
                      <div className="flex items-center gap-3">
                        <Warehouse className="w-4 h-4 text-gray-400" />
                        <SelectValue placeholder="Select Source" />
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      {locations.map((loc) => (
                        <SelectItem
                          key={loc.id}
                          value={loc.id}
                          className="py-3"
                        >
                          <span className="font-medium">{loc.name}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Arrow Divider */}
                <div className="flex items-center justify-center pt-6">
                  <div className="bg-white p-2 rounded-full border shadow-sm">
                    <ArrowRight className="w-5 h-5 text-primary" />
                  </div>
                </div>

                {/* Destination */}
                <div className="flex-1 w-full space-y-2">
                  <Label className="text-xs font-semibold uppercase text-gray-500 tracking-wider">
                    To Location
                  </Label>
                  <Select
                    value={destId}
                    onValueChange={setDestId}
                    disabled={!sourceId}
                  >
                    <SelectTrigger className="h-12 w-full bg-white border-gray-300 shadow-sm text-base">
                      <div className="flex items-center gap-3">
                        <Warehouse className="w-4 h-4 text-gray-400" />
                        <SelectValue placeholder="Select Destination" />
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      {locations
                        .filter((l) => l.id !== sourceId)
                        .map((loc) => (
                          <SelectItem
                            key={loc.id}
                            value={loc.id}
                            className="py-3"
                          >
                            <span className="font-medium">{loc.name}</span>
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Reference Note</Label>
                <Input
                  placeholder="e.g. Weekly Restock #442"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="h-11"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Step 2: Add Products */}
        {sourceId && (
          <Card className="shadow-sm border-0 ring-1 ring-gray-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-medium flex items-center gap-2">
                <span className="bg-primary/10 text-primary w-6 h-6 rounded-full flex items-center justify-center text-xs">
                  2
                </span>
                Add Products
              </CardTitle>
              <CardDescription>
                Select items from available inventory
              </CardDescription>
            </CardHeader>
            <CardContent>
              {stockLoading ? (
                <div className="py-8 flex flex-col items-center justify-center text-gray-500">
                  <Loader2 className="w-6 h-6 animate-spin mb-2" />
                  Loading inventory...
                </div>
              ) : sourceProducts.length === 0 ? (
                <div className="py-8 flex flex-col items-center justify-center bg-gray-50 rounded-lg border border-dashed">
                  <Package className="w-8 h-8 text-gray-300 mb-2" />
                  <p className="text-gray-500">
                    No stock available at this location
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Unified Input Bar */}
                  <div className="flex flex-col md:flex-row gap-4 items-start md:items-end bg-gray-50/50 p-4 rounded-xl border">
                    <div className="flex-1 w-full space-y-2">
                      <Label className="text-xs font-semibold uppercase text-gray-500">
                        Select Product
                      </Label>
                      <Select
                        value={selectedProductId}
                        onValueChange={setSelectedProductId}
                      >
                        <SelectTrigger className="h-12 bg-white w-full">
                          <div className="flex items-center gap-2 text-left">
                            <Search className="w-4 h-4 text-gray-400" />
                            <SelectValue placeholder="Search product..." />
                          </div>
                        </SelectTrigger>
                        <SelectContent className="max-h-[300px]">
                          {sourceProducts.map((product) => (
                            <SelectItem key={product.id} value={product.id}>
                              <div className="flex items-center justify-between w-[var(--radix-select-trigger-width)] pr-4">
                                <div className="flex flex-col text-left">
                                  <span className="font-medium">
                                    {product.name}
                                  </span>
                                  <span className="text-xs text-gray-400">
                                    {product.sku}
                                  </span>
                                </div>
                                <Badge variant="secondary" className="ml-2">
                                  {product.available_quantity} avl
                                </Badge>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="w-full md:w-32 space-y-2">
                      <Label className="text-xs font-semibold uppercase text-gray-500">
                        Qty
                      </Label>
                      <Input
                        type="number"
                        className="h-12 bg-white text-center text-lg font-medium"
                        placeholder="0"
                        value={quantity}
                        onChange={(e) => setQuantity(e.target.value)}
                        onKeyDown={(e) =>
                          e.key === "Enter" && handleAddProduct()
                        }
                        max={selectedProduct?.available_quantity}
                      />
                    </div>

                    <Button
                      size="lg"
                      className="h-12 w-full md:w-auto px-6"
                      onClick={handleAddProduct}
                      disabled={!selectedProductId || !quantity}
                    >
                      <Plus className="w-5 h-5 mr-2" /> Add
                    </Button>
                  </div>

                  {/* Selected Product Preview (Helper) */}
                  {selectedProduct && (
                    <div className="flex items-center justify-between px-4 py-2 bg-blue-50/50 border border-blue-100 rounded-lg text-sm text-blue-700">
                      <span className="font-medium">
                        {selectedProduct.name}
                      </span>
                      <span>
                        Max Available:{" "}
                        <strong>{selectedProduct.available_quantity}</strong>
                      </span>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Step 3: Review Table */}
        {transferItems.length > 0 && (
          <Card className="shadow-md border-0 ring-1 ring-gray-200 overflow-hidden">
            <CardHeader className="bg-gray-50/50 border-b">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-medium">
                  Review Items
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-red-500 hover:text-red-600 hover:bg-red-50"
                  onClick={() => setTransferItems([])}
                >
                  Clear All
                </Button>
              </div>
            </CardHeader>

            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40%]">Product</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead className="text-center">Stock</TableHead>
                    <TableHead className="text-right">Transfer Qty</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transferItems.map((item) => (
                    <TableRow
                      key={item.productId}
                      className="hover:bg-gray-50/50"
                    >
                      <TableCell>
                        <div className="font-medium text-gray-900">
                          {item.productName}
                        </div>
                        {item.category && (
                          <div className="text-xs text-gray-500">
                            {item.category}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <code className="text-xs bg-gray-100 px-2 py-1 rounded border">
                          {item.sku}
                        </code>
                      </TableCell>
                      <TableCell className="text-center text-gray-500">
                        {item.availableQuantity}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge
                          variant="outline"
                          className="text-base px-3 py-0.5 border-gray-400 font-bold"
                        >
                          {item.quantity}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveItem(item.productId)}
                          className="h-8 w-8 text-gray-400 hover:text-red-600"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Summary Footer */}
            <div className="bg-gray-50 border-t p-4 flex justify-end items-center gap-6">
              <div className="text-sm text-gray-500">
                Total Products:{" "}
                <span className="font-medium text-gray-900">
                  {transferItems.length}
                </span>
              </div>
              <div className="text-sm text-gray-500">
                Total Quantity:{" "}
                <span className="font-bold text-lg text-primary ml-2">
                  {totalItems}
                </span>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
