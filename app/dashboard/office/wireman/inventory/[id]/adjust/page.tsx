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
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  ArrowLeft,
  Check,
  ChevronsUpDown,
  Plus,
  Save,
  Trash2,
  AlertCircle,
  Loader2,
  MapPin,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { BUSINESS_IDS } from "@/app/config/business-constants";

// Types
interface Product {
  id: string;
  sku: string;
  name: string;
  category: string;
}

interface PendingAdjustment {
  productId: string;
  productName: string;
  sku: string;
  currentStock: number;
  newStock: number;
  difference: number;
}

export default function WiremanStockAdjustmentPage() {
  const params = useParams();
  const router = useRouter();
  const rawId = params?.id;
  const locationId = Array.isArray(rawId) ? rawId[0] : rawId;

  // Data State
  const [loading, setLoading] = useState(true);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [locationStocks, setLocationStocks] = useState<Record<string, number>>(
    {},
  );
  const [locationName, setLocationName] = useState("");

  // Form State
  const [openCombobox, setOpenCombobox] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [adjustmentValue, setAdjustmentValue] = useState("");
  const [pendingAdjustments, setPendingAdjustments] = useState<
    PendingAdjustment[]
  >([]);
  const [submitting, setSubmitting] = useState(false);

  // 1. Fetch Data on Load
  useEffect(() => {
    const initData = async () => {
      try {
        setLoading(true);

        // Fetch Master Product List (Filtered for Wireman)
        const productsRes = await fetch(
          `/api/inventory?businessId=${BUSINESS_IDS.WIREMAN_AGENCY}`,
        );
        const productsData = await productsRes.json();

        // Fetch Current Location Stock (Filtered for Wireman)
        const stockRes = await fetch(
          `/api/inventory/${locationId}?businessId=${BUSINESS_IDS.WIREMAN_AGENCY}`,
        );
        const stockData = await stockRes.json();

        if (stockData.location) {
          setLocationName(stockData.location.name);
        }

        const stockMap: Record<string, number> = {};
        if (stockData.stocks) {
          stockData.stocks.forEach((s: any) => {
            stockMap[s.id] = s.quantity;
          });
        }

        if (productsData.products) {
          setAllProducts(productsData.products);
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

  // Derived Values
  const selectedProduct = allProducts.find((p) => p.id === selectedProductId);
  const currentStock = selectedProductId
    ? locationStocks[selectedProductId] || 0
    : 0;

  // Handlers
  const handleAddToTable = () => {
    if (!selectedProduct) return toast.error("Select a product first");
    if (adjustmentValue === "") return toast.error("Enter a valid quantity");

    const newQty = parseFloat(adjustmentValue);
    if (isNaN(newQty) || newQty < 0)
      return toast.error("Quantity must be a valid positive number");

    if (pendingAdjustments.some((p) => p.productId === selectedProductId)) {
      toast.error("This product is already in the adjustment list");
      return;
    }

    const difference = newQty - currentStock;

    const newItem: PendingAdjustment = {
      productId: selectedProduct.id,
      productName: selectedProduct.name,
      sku: selectedProduct.sku,
      currentStock: currentStock,
      newStock: newQty,
      difference: difference,
    };

    setPendingAdjustments([...pendingAdjustments, newItem]);
    setAdjustmentValue("");
    setSelectedProductId("");
    setOpenCombobox(false);
  };

  const handleRemoveItem = (id: string) => {
    setPendingAdjustments(pendingAdjustments.filter((p) => p.productId !== id));
  };

  const handleSaveAll = async () => {
    if (pendingAdjustments.length === 0) return toast.error("List is empty");
    if (
      !confirm(`Confirm saving ${pendingAdjustments.length} stock adjustments?`)
    )
      return;

    setSubmitting(true);
    try {
      // ✅ FIX: Map items to the format expected by the API
      const itemsPayload = pendingAdjustments.map((item) => ({
        productId: item.productId,
        newQuantity: item.newStock,
      }));

      // ✅ FIX: Send a single BATCH request
      const res = await fetch("/api/inventory/adjust", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          locationId,
          items: itemsPayload, // The API expects this array
          reason: "Manual Stock Adjustment (Wireman Portal)",
          businessId: BUSINESS_IDS.WIREMAN_AGENCY,
        }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Update failed");

      toast.success("Stock adjustments saved successfully!");
      router.push(`/dashboard/office/wireman/inventory/${locationId}`);
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Failed to save adjustments");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen justify-center items-center">
        <Loader2 className="w-8 h-8 animate-spin text-red-600" />
      </div>
    );
  }

  return (
    <div className="mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 text-red-950">
            Stock Adjustment
          </h1>
          <p className="text-muted-foreground text-sm flex items-center gap-1">
            Update physical stock counts for{" "}
            <span className="font-semibold text-red-600 flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              {locationName || "Location"}
            </span>
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Panel */}
        <Card className="md:col-span-1 h-fit border-red-100">
          <CardHeader>
            <CardTitle className="text-lg">Add Adjustment</CardTitle>
            <CardDescription>
              Select product (Wireman Only) and enter count.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Select Product</label>
              <Popover open={openCombobox} onOpenChange={setOpenCombobox}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={openCombobox}
                    className="w-full justify-between"
                  >
                    {selectedProduct
                      ? `${selectedProduct.sku} - ${selectedProduct.name}`
                      : "Search product..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[300px] p-0">
                  <Command>
                    <CommandInput placeholder="Search SKU or Name..." />
                    <CommandList>
                      <CommandEmpty>No product found.</CommandEmpty>
                      <CommandGroup>
                        {allProducts.map((product) => (
                          <CommandItem
                            key={product.id}
                            value={`${product.name} ${product.sku}`}
                            onSelect={() => {
                              setSelectedProductId(product.id);
                              setOpenCombobox(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                selectedProductId === product.id
                                  ? "opacity-100"
                                  : "opacity-0",
                              )}
                            />
                            <div className="flex flex-col">
                              <span className="font-medium">
                                {product.name}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {product.sku}
                              </span>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <div className="p-3 bg-red-50/50 rounded-lg border border-red-100 text-center space-y-1">
              <span className="text-xs text-red-600/70 uppercase tracking-wide">
                Current System Stock
              </span>
              <div className="text-3xl font-bold text-red-900">
                {selectedProductId ? currentStock : "-"}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">New Physical Stock</label>
              <Input
                type="number"
                placeholder="Enter qty"
                value={adjustmentValue}
                onChange={(e) => setAdjustmentValue(e.target.value)}
                disabled={!selectedProductId}
                className="text-lg font-semibold"
              />
            </div>

            <Button
              className="w-full bg-red-600 hover:bg-red-700 text-white"
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
              <Badge variant="secondary" className="bg-red-100 text-red-800">
                {pendingAdjustments.length} Items
              </Badge>
            )}
          </CardHeader>
          <CardContent>
            {pendingAdjustments.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-muted-foreground border-2 border-dashed rounded-lg bg-muted/10">
                <AlertCircle className="w-10 h-10 mb-2 opacity-20" />
                <p>No items added yet.</p>
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
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingAdjustments.map((item) => (
                      <TableRow key={item.productId}>
                        <TableCell>
                          <div className="font-medium">{item.productName}</div>
                          <div className="text-xs text-muted-foreground">
                            {item.sku}
                          </div>
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {item.currentStock}
                        </TableCell>
                        <TableCell className="text-right font-bold text-red-600">
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
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-red-500 hover:bg-red-50"
                            onClick={() => handleRemoveItem(item.productId)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
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
                className="w-full md:w-auto bg-green-600 hover:bg-green-700 text-white"
                onClick={handleSaveAll}
                disabled={pendingAdjustments.length === 0 || submitting}
              >
                {submitting ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                Adjust All & Save
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
