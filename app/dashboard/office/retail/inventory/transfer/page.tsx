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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
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
  ChevronsUpDown,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { BUSINESS_IDS } from "@/app/config/business-constants";

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
  supplier?: string;
  retailOnly?: boolean;
  available_quantity: number;
  unit: string;
  raw_qty: number;
  raw_damaged: number;
}

interface TransferItem {
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  availableQuantity: number;
  unit: string;
}

export default function RetailStockTransferPage() {
  const router = useRouter();

  const [locations, setLocations] = useState<Location[]>([]);
  const [sourceId, setSourceId] = useState("");
  const [destId, setDestId] = useState("");
  const [reason, setReason] = useState("");
  const [transferDate, setTransferDate] = useState(new Date().toISOString().split("T")[0]);
  const [transferType, setTransferType] = useState<"Good" | "Damage">("Good");

  const [sourceProducts, setSourceProducts] = useState<Product[]>([]);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [transferItems, setTransferItems] = useState<TransferItem[]>([]);

  const [loading, setLoading] = useState(true);
  const [stockLoading, setStockLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [productOpen, setProductOpen] = useState(false);

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
  }, [sourceId, transferType]);

  const fetchLocations = async () => {
    try {
      const res = await fetch(`/api/settings/locations?businessId=${BUSINESS_IDS.CHAMPIKA_RETAIL}`);
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
        supplier: stock.supplier_name || "",
        retailOnly: stock.retail_only ?? false,
        available_quantity:
          transferType === "Good"
            ? Number(stock.quantity || 0)
            : Number(stock.damagedQuantity || 0),
        raw_qty: Number(stock.quantity || 0),
        raw_damaged: Number(stock.damagedQuantity || 0),
        unit: stock.unit_of_measure || "Units",
      }));

      setSourceProducts(products.filter((p: any) => p.available_quantity > 0));
      setSelectedProductId("");
      setTransferItems([]);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setStockLoading(false);
    }
  };

  const handleAddProduct = () => {
    if (!selectedProductId) return toast.error("Please select a product");

    const qty = parseFloat(quantity);
    if (isNaN(qty) || qty <= 0) return toast.error("Please enter a valid quantity");

    const product = sourceProducts.find((p) => p.id === selectedProductId);
    if (!product) return;

    if (qty > product.available_quantity) {
      return toast.error(`Max available is ${product.available_quantity} ${product.unit}`);
    }

    const existingIndex = transferItems.findIndex((item) => item.productId === selectedProductId);
    if (existingIndex >= 0) {
      const updatedItems = [...transferItems];
      updatedItems[existingIndex].quantity = qty;
      setTransferItems(updatedItems);
      toast.success("Quantity updated");
    } else {
      setTransferItems([...transferItems, {
        productId: product.id,
        productName: product.name,
        sku: product.sku,
        quantity: qty,
        availableQuantity: product.available_quantity,
        unit: product.unit,
      }]);
      toast.success("Added to list");
    }

    setSelectedProductId("");
    setQuantity("");
  };

  const handleRemoveItem = (productId: string) =>
    setTransferItems(transferItems.filter((i) => i.productId !== productId));

  const handleSubmit = async () => {
    if (!sourceId || !destId) return toast.error("Select source and destination");
    if (transferItems.length === 0) return toast.error("Add products to transfer");
    if (!transferDate) return toast.error("Select a transfer date");

    setSubmitting(true);
    try {
      const res = await fetch("/api/inventory/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceLocationId: sourceId,
          destLocationId: destId,
          items: transferItems.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
          })),
          reason: reason || `Stock Transfer (${transferType})`,
          transferDate,
          transferType,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Transfer failed");
      toast.success("Transfer completed successfully");
      router.push("/dashboard/office/retail/inventory");
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const selectedProduct = sourceProducts.find((p) => p.id === selectedProductId);

  if (loading && locations.length === 0) {
    return (
      <div className="flex justify-center items-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-green-600" />
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
              onClick={() => router.back()}
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <h1 className="text-3xl font-bold tracking-tight text-green-950">
              Stock Transfer
            </h1>
          </div>
          <p className="text-muted-foreground mt-1 ml-8">
            Move inventory between Champika Retail locations.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.push("/dashboard/office/retail/inventory")}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            className="bg-green-600 hover:bg-green-700 text-white"
            disabled={submitting || !sourceId || !destId || transferItems.length === 0}
          >
            {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Truck className="mr-2 h-4 w-4" />}
            Confirm Transfer
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* LEFT: Controls */}
        <div className="lg:col-span-2 space-y-6">
          {/* Transfer Details */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <MapPin className="w-4 h-4 text-green-600" /> Transfer Details
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
                  <Select value={destId} onValueChange={setDestId} disabled={!sourceId}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select Destination" />
                    </SelectTrigger>
                    <SelectContent>
                      {locations.filter((l) => l.id !== sourceId).map((loc) => (
                        <SelectItem key={loc.id} value={loc.id}>
                          {loc.name} {loc.isMain ? "(Main)" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2 pt-2">
                <Label>Stock Condition</Label>
                <RadioGroup
                  value={transferType}
                  onValueChange={(val: "Good" | "Damage") => setTransferType(val)}
                  className="flex gap-4"
                >
                  <div className="flex items-center space-x-2 border rounded-md p-3 w-full cursor-pointer hover:bg-muted/50">
                    <RadioGroupItem value="Good" id="good" />
                    <Label htmlFor="good" className="cursor-pointer flex-1">Good Stock</Label>
                    <Package className="w-4 h-4 text-green-600" />
                  </div>
                  <div className="flex items-center space-x-2 border rounded-md p-3 w-full cursor-pointer hover:bg-muted/50">
                    <RadioGroupItem value="Damage" id="damage" />
                    <Label htmlFor="damage" className="cursor-pointer flex-1">Damaged / Returns</Label>
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
                    placeholder="e.g. Shelf Restock"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Product Selection */}
          <Card className={!sourceId ? "opacity-60 pointer-events-none" : ""}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Package className="w-4 h-4 text-green-600" /> Select Products
              </CardTitle>
            </CardHeader>
            <CardContent>
              {stockLoading ? (
                <div className="flex justify-center items-center py-16">
                  <Loader2 className="h-8 w-8 animate-spin text-green-600" />
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Product search */}
                  <div className="space-y-2">
                    <Label>Product ({transferType})</Label>
                    <Popover open={productOpen} onOpenChange={setProductOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={productOpen}
                          className="w-full justify-between font-normal"
                        >
                          {selectedProductId
                            ? sourceProducts.find((p) => p.id === selectedProductId)?.name
                            : sourceProducts.length === 0
                            ? `No ${transferType} stock available`
                            : "Search product by name or SKU..."}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start" side="bottom" avoidCollisions={false}>
                        <Command>
                          <CommandInput placeholder="Type name or SKU..." />
                          <CommandList>
                            <CommandEmpty>No products found.</CommandEmpty>
                            <CommandGroup>
                              {sourceProducts.map((p) => {
                                const isSierra = (p.supplier || "").toLowerCase().includes("sierra");
                                const isWireman = (p.supplier || "").toLowerCase().includes("wireman");
                                const isOrange = (p.supplier || "").toLowerCase().includes("orange");
                                const isRetailOnly = p.retailOnly;

                                let borderClass = "border-l-4 border-slate-300";
                                let tagLabel = "";
                                let tagClass = "bg-slate-100 text-slate-700 border-slate-200";

                                if (isRetailOnly) {
                                  borderClass = "border-l-4 border-emerald-500";
                                  tagLabel = "Retail Only";
                                  tagClass = "bg-emerald-100 text-emerald-800 border-emerald-200";
                                } else if (isSierra) {
                                  borderClass = "border-l-4 border-purple-500";
                                  tagLabel = "Sierra";
                                  tagClass = "bg-purple-100 text-purple-700 border-purple-200";
                                } else if (isWireman) {
                                  borderClass = "border-l-4 border-red-500";
                                  tagLabel = "Wireman";
                                  tagClass = "bg-red-100 text-red-700 border-red-200";
                                } else if (isOrange) {
                                  borderClass = "border-l-4 border-orange-500";
                                  tagLabel = "Orange";
                                  tagClass = "bg-orange-100 text-orange-700 border-orange-200";
                                }

                                return (
                                  <CommandItem
                                    key={p.id}
                                    value={`${p.name} ${p.sku} ${p.supplier || ""}`}
                                    onSelect={() => {
                                      setSelectedProductId(p.id);
                                      setProductOpen(false);
                                    }}
                                    className={cn("flex items-center gap-2 px-3 py-2", borderClass)}
                                  >
                                    <Check
                                      className={cn(
                                        "h-4 w-4 shrink-0",
                                        selectedProductId === p.id ? "opacity-100" : "opacity-0"
                                      )}
                                    />
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center justify-between gap-2">
                                        <span className="font-semibold text-slate-900 truncate">{p.name}</span>
                                        <div className="flex items-center gap-1.5 shrink-0">
                                          {tagLabel && (
                                            <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full border", tagClass)}>
                                              {tagLabel}
                                            </span>
                                          )}
                                          <Badge
                                            variant={transferType === "Good" ? "secondary" : "destructive"}
                                            className="text-[10px]"
                                          >
                                            {p.available_quantity} {p.unit}
                                          </Badge>
                                        </div>
                                      </div>
                                      <div className="text-xs text-muted-foreground font-mono mt-0.5">{p.sku}</div>
                                    </div>
                                  </CommandItem>
                                );
                              })}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>

                  {/* Qty + Add on same line */}
                  <div className="flex gap-2 items-end">
                    <div className="flex-1 space-y-2">
                      <Label>Quantity</Label>
                      <Input
                        type="number"
                        placeholder="Enter qty"
                        value={quantity}
                        onChange={(e) => setQuantity(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleAddProduct()}
                        disabled={!selectedProductId}
                      />
                    </div>
                    <Button
                      onClick={handleAddProduct}
                      className="bg-green-600 hover:bg-green-700 shrink-0"
                      disabled={!selectedProductId || !quantity}
                    >
                      <Plus className="w-4 h-4 mr-1" /> Add to List
                    </Button>
                  </div>

                  {selectedProduct && (
                    <div className={`text-sm px-3 py-2 rounded border flex flex-wrap justify-between gap-2 ${
                      transferType === "Good"
                        ? "bg-green-50 border-green-100 text-green-700"
                        : "bg-red-50 border-red-100 text-red-600"
                    }`}>
                      <span className="font-medium">{selectedProduct.name}</span>
                      <span>Available: <strong>{selectedProduct.available_quantity} {selectedProduct.unit}</strong></span>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* RIGHT: Transfer List */}
        <div className="space-y-6">
          <Card className="h-full flex flex-col">
            <CardHeader className="border-b pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  <ClipboardList className="w-4 h-4 text-green-600" /> Transfer List
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
                  <Badge variant="outline" className="mt-2">{transferType} Mode</Badge>
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
                            <div className="font-medium text-sm">{item.productName}</div>
                            <div className="text-xs text-muted-foreground">{item.sku}</div>
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
