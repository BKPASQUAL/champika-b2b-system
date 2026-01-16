"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Save,
  Package,
  Loader2,
  Check,
  ChevronsUpDown,
  Factory,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
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
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { getUserBusinessContext } from "@/app/middleware/businessAuth";

// --- Types ---

interface Product {
  id: string;
  sku: string;
  name: string;
  sellingPrice: number;
  costPrice: number;
  mrp: number;
  stock: number;
  unitOfMeasure: string;
  supplier: string;
}

interface Supplier {
  id: string;
  name: string;
}

interface PurchaseItem {
  id: string;
  productId: string;
  sku: string;
  productName: string;
  quantity: number;
  freeQuantity: number;
  unit: string;
  mrp: number;
  sellingPrice: number;
  unitPrice: number; // Cost Price
  discountPercent: number;
  discountAmount: number;
  finalPrice: number;
  total: number;
}

// Helper to safely parse input
const parseNumber = (val: string | number) => {
  if (val === "" || val === undefined || val === null) return 0;
  return Number(val);
};

export default function CreateWiremanPurchasePage() {
  const router = useRouter();
  const [loadingData, setLoadingData] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Context State
  const [currentBusinessId, setCurrentBusinessId] = useState<string | null>(
    null
  );
  const [currentBusinessName, setCurrentBusinessName] = useState<string>("");

  // Data States
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  // Form States
  const [supplierId, setSupplierId] = useState<string | null>(null);
  const [purchaseDate, setPurchaseDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [arrivalDate, setArrivalDate] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");

  // Extra Discount State (Percentage)
  const [extraDiscountPercent, setExtraDiscountPercent] = useState<
    number | string
  >("");

  // Items State
  const [items, setItems] = useState<PurchaseItem[]>([]);

  // UI States
  const [productSearchOpen, setProductSearchOpen] = useState(false);

  // Current Item Edit State
  // ✅ Changed types to allow empty string ""
  const [currentItem, setCurrentItem] = useState<{
    productId: string;
    sku: string;
    quantity: number | string;
    freeQuantity: number | string;
    mrp: number;
    sellingPrice: number;
    unitPrice: number | string; // Cost Price
    discountPercent: number | string;
    unit: string;
  }>({
    productId: "",
    sku: "",
    quantity: "", // ✅ Default Empty
    freeQuantity: "", // ✅ Default Empty
    mrp: 0,
    sellingPrice: 0,
    unitPrice: "", // ✅ Default Empty
    discountPercent: "", // ✅ Default Empty
    unit: "",
  });

  // --- 1. Get User Context (Wireman Agency) ---
  useEffect(() => {
    const user = getUserBusinessContext();
    if (user && user.businessId) {
      setCurrentBusinessId(user.businessId);
      setCurrentBusinessName(user.businessName || "Wireman Agency");
    } else {
      toast.error("Business context not found. Please log in again.");
      router.push("/login");
    }
  }, [router]);

  // --- 2. Fetch Data ---
  useEffect(() => {
    if (!currentBusinessId) return;

    const loadData = async () => {
      try {
        const [prodRes, supRes] = await Promise.all([
          fetch("/api/products?active=true"),
          fetch(`/api/suppliers?businessId=${currentBusinessId}`),
        ]);

        if (prodRes.ok) {
          const allProducts: Product[] = await prodRes.json();
          // Filter specifically for Wireman products
          const wiremanProducts = allProducts.filter((p) =>
            p.supplier?.toLowerCase().includes("wireman")
          );
          setProducts(wiremanProducts);
        }

        if (supRes.ok) {
          const supplierData = await supRes.json();
          setSuppliers(supplierData);

          if (supplierData.length === 1) {
            setSupplierId(supplierData[0].id);
          }
        }
      } catch (error) {
        toast.error("Failed to load initial data");
      } finally {
        setLoadingData(false);
      }
    };

    loadData();
  }, [currentBusinessId]);

  // --- Handlers ---

  const handleSupplierChange = (newSupplierId: string) => {
    setSupplierId(newSupplierId);
  };

  const handleProductSelect = (productId: string) => {
    const product = products.find((p) => p.id === productId);
    if (product) {
      setCurrentItem({
        ...currentItem,
        productId: productId,
        sku: product.sku,
        mrp: product.mrp || 0,
        sellingPrice: product.sellingPrice || 0,
        // ✅ Pre-fill cost price if available, else empty
        unitPrice: product.costPrice > 0 ? product.costPrice : "",
        discountPercent: "", // ✅ Empty
        freeQuantity: "", // ✅ Empty
        quantity: "", // ✅ Empty
        unit: product.unitOfMeasure || "Pcs",
      });
      setProductSearchOpen(false);
    }
  };

  const handleAddItem = () => {
    const qty = parseNumber(currentItem.quantity);
    const unitPrice = parseNumber(currentItem.unitPrice);

    if (!currentItem.productId || qty <= 0) {
      toast.error("Please enter a valid quantity");
      return;
    }

    // Allow unit price 0? Maybe warn, but proceed.
    // Generally cost shouldn't be 0
    if (unitPrice < 0) {
      toast.error("Invalid Cost Price");
      return;
    }

    const product = products.find((p) => p.id === currentItem.productId);
    if (!product) return;

    // Calculations
    const discountPct = parseNumber(currentItem.discountPercent);
    const freeQty = parseNumber(currentItem.freeQuantity);

    const unitDiscountAmount = (unitPrice * discountPct) / 100;
    const netUnitPrice = unitPrice - unitDiscountAmount;

    // Total for this line (Net Unit Price * Qty)
    const total = netUnitPrice * qty;
    const totalDiscountAmount = unitDiscountAmount * qty;

    const newItem: PurchaseItem = {
      id: Date.now().toString(),
      productId: currentItem.productId,
      sku: product.sku,
      productName: product.name,
      quantity: qty,
      freeQuantity: freeQty,
      unit: currentItem.unit,
      mrp: currentItem.mrp,
      sellingPrice: currentItem.sellingPrice,
      unitPrice: unitPrice,
      discountPercent: discountPct,
      discountAmount: totalDiscountAmount,
      finalPrice: netUnitPrice,
      total: total,
    };

    setItems([...items, newItem]);

    // Reset Item Form to Empty
    setCurrentItem({
      productId: "",
      sku: "",
      quantity: "", // ✅ Reset to Empty
      freeQuantity: "", // ✅ Reset to Empty
      mrp: 0,
      sellingPrice: 0,
      unitPrice: "", // ✅ Reset to Empty
      discountPercent: "", // ✅ Reset to Empty
      unit: "",
    });
  };

  const handleRemoveItem = (id: string) => {
    setItems(items.filter((item) => item.id !== id));
  };

  // --- Bill Calculations ---
  const totalGross = items.reduce(
    (sum, item) => sum + item.unitPrice * item.quantity,
    0
  );

  const totalLineDiscount = items.reduce(
    (sum, item) => sum + item.discountAmount,
    0
  );

  const subtotal = totalGross - totalLineDiscount;

  const extraDiscountAmount =
    (subtotal * parseNumber(extraDiscountPercent)) / 100;

  const finalTotal = subtotal - extraDiscountAmount;

  // --- Save Purchase ---
  const handleSavePurchase = async () => {
    if (items.length === 0) {
      toast.error("Add at least one item");
      return;
    }
    if (!supplierId) {
      toast.error("Select a supplier");
      return;
    }
    if (!currentBusinessId) {
      toast.error("Business context missing");
      return;
    }

    setSubmitting(true);

    const purchasePayload = {
      supplier_id: supplierId,
      business_id: currentBusinessId,
      purchase_date: purchaseDate,
      arrival_date: arrivalDate || "",
      invoice_number: invoiceNumber || "",
      total_amount: finalTotal,
      extra_discount: extraDiscountAmount,
      extra_discount_percent: parseNumber(extraDiscountPercent),
      items: items,
    };

    try {
      const res = await fetch("/api/purchases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(purchasePayload),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Failed to create purchase");

      toast.success("Bill Created Successfully!");
      router.push("/dashboard/office/wireman/purchases");
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Filter Wireman products to prevent duplicates in list
  const availableProducts = products.filter((product) => {
    const notInItems = !items.some((item) => item.productId === product.id);
    return notInItems;
  });

  const getSelectedProductName = () => {
    const product = products.find((p) => p.id === currentItem.productId);
    return product ? `${product.name}` : "Select product";
  };

  // Helper for live calc in form
  const liveCost = parseNumber(currentItem.unitPrice);
  const liveQty = parseNumber(currentItem.quantity);
  const liveDisc = parseNumber(currentItem.discountPercent);
  const currentLineDiscountAmount = ((liveCost * liveDisc) / 100) * liveQty;

  if (loadingData) {
    return (
      <div className="flex justify-center items-center h-full min-h-64">
        <Loader2 className="h-6 w-6 animate-spin mr-2 text-red-600" />
        <p className="text-lg text-muted-foreground">Loading catalogs...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 mx-auto pb-10">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push("/dashboard/office/wireman/purchases")}
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight text-red-900">
            New Bill
          </h1>
          <p className="text-muted-foreground mt-1">
            Create a new bill for {currentBusinessName}
          </p>
        </div>
        <Button
          onClick={handleSavePurchase}
          disabled={items.length === 0 || submitting}
          className="bg-red-600 hover:bg-red-700"
        >
          {submitting ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Save className="w-4 h-4 mr-2" />
          )}
          Save Bill
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* LEFT COLUMN - Forms */}
        <div className="lg:col-span-2 space-y-3">
          {/* 1. Bill Details Card */}
          <Card className="border-red-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Factory className="w-4 h-4 text-red-600" />
                Bill Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Supplier</Label>
                  <Select
                    value={supplierId || ""}
                    onValueChange={handleSupplierChange}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select Supplier" />
                    </SelectTrigger>
                    <SelectContent>
                      {suppliers.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="date">Bill Date</Label>
                  <Input
                    id="date"
                    type="date"
                    value={purchaseDate}
                    onChange={(e) => setPurchaseDate(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="invoice">Invoice Number</Label>
                  <Input
                    id="invoice"
                    placeholder="Enter Invoice No"
                    value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="arrivalDate">Arrival Date</Label>
                  <Input
                    id="arrivalDate"
                    type="date"
                    value={arrivalDate}
                    onChange={(e) => setArrivalDate(e.target.value)}
                    placeholder="Select date"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 2. Add Items Card */}
          <Card>
            <CardHeader>
              <CardTitle>Add Items</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Row 1: Product Search */}
                <div className="w-full">
                  <Label htmlFor="product" className="mb-2 block">
                    Product Name / Search
                  </Label>
                  <Popover
                    open={productSearchOpen}
                    onOpenChange={setProductSearchOpen}
                  >
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={productSearchOpen}
                        className="w-full h-10 justify-between"
                      >
                        <span className="truncate">
                          {currentItem.productId
                            ? getSelectedProductName()
                            : "Select product by Name or SKU"}
                        </span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[600px] p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Search product by name or SKU..." />
                        <CommandList>
                          <CommandEmpty>No active product found.</CommandEmpty>
                          <CommandGroup>
                            {availableProducts.length === 0 ? (
                              <div className="p-4 text-center text-sm text-muted-foreground">
                                No products available.
                              </div>
                            ) : (
                              availableProducts.map((product) => (
                                <CommandItem
                                  key={product.id}
                                  value={`${product.name} ${product.sku} ${product.id}`}
                                  onSelect={() =>
                                    handleProductSelect(product.id)
                                  }
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      currentItem.productId === product.id
                                        ? "opacity-100"
                                        : "opacity-0"
                                    )}
                                  />
                                  <div className="flex flex-col">
                                    <span className="font-medium">
                                      {product.name}
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                      Code: {product.sku} | Cost:{" "}
                                      {product.costPrice}
                                    </span>
                                  </div>
                                </CommandItem>
                              ))
                            )}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Row 2: Item Details - 5 Column Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 items-end">
                  {/* Item Code */}
                  <div className="col-span-1">
                    <Label className="mb-2 block text-xs">Item Code</Label>
                    <Input
                      value={currentItem.sku || ""}
                      disabled
                      className="h-9 bg-muted text-xs"
                      placeholder="Auto"
                    />
                  </div>

                  {/* Unit */}
                  <div className="col-span-1">
                    <Label className="mb-2 block text-xs">Unit</Label>
                    <Input
                      value={currentItem.unit || ""}
                      disabled
                      className="h-9 bg-muted text-xs"
                      placeholder="Unit"
                    />
                  </div>

                  {/* Cost Price - ✅ Allow Empty */}
                  <div className="col-span-1">
                    <Label className="mb-2 block text-xs font-semibold text-blue-600">
                      Cost Price
                    </Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="Cost" // Placeholder
                      value={currentItem.unitPrice}
                      onChange={(e) => {
                        const val = e.target.value;
                        setCurrentItem({
                          ...currentItem,
                          unitPrice: val === "" ? "" : parseFloat(val),
                        });
                      }}
                      className="h-9 border-blue-200 text-xs"
                    />
                  </div>

                  {/* Quantity - ✅ Allow Empty */}
                  <div className="col-span-1">
                    <Label className="mb-2 block text-xs">Quantity</Label>
                    <Input
                      type="number"
                      min="1"
                      placeholder="Qty" // Placeholder
                      value={currentItem.quantity}
                      onChange={(e) => {
                        const val = e.target.value;
                        setCurrentItem({
                          ...currentItem,
                          quantity: val === "" ? "" : parseInt(val),
                        });
                      }}
                      className="h-9 text-xs"
                    />
                  </div>

                  {/* Free Qty - ✅ Allow Empty */}
                  <div className="col-span-1">
                    <Label className="mb-2 block text-xs text-green-600">
                      Free Qty
                    </Label>
                    <Input
                      type="number"
                      min="0"
                      placeholder="0"
                      value={currentItem.freeQuantity}
                      onChange={(e) => {
                        const val = e.target.value;
                        setCurrentItem({
                          ...currentItem,
                          freeQuantity: val === "" ? "" : parseInt(val),
                        });
                      }}
                      className="h-9 border-green-200 text-xs"
                    />
                  </div>

                  {/* Discount % - ✅ Allow Empty */}
                  <div className="col-span-1">
                    <Label className="mb-2 block text-xs">Disc %</Label>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      placeholder="0%"
                      value={currentItem.discountPercent}
                      onChange={(e) => {
                        const val = e.target.value;
                        setCurrentItem({
                          ...currentItem,
                          discountPercent: val === "" ? "" : parseFloat(val),
                        });
                      }}
                      className="h-9 text-xs"
                    />
                  </div>

                  {/* Discount Amount (Display Only) */}
                  <div className="col-span-1">
                    <Label className="mb-2 block text-xs text-muted-foreground">
                      Disc Amt
                    </Label>
                    <Input
                      value={
                        currentLineDiscountAmount > 0
                          ? currentLineDiscountAmount.toFixed(2)
                          : ""
                      }
                      disabled
                      className="h-9 bg-muted text-xs"
                      placeholder="0.00"
                    />
                  </div>

                  {/* Selling Price */}
                  <div className="col-span-1">
                    <Label className="mb-2 block text-xs">Selling Price</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={currentItem.sellingPrice || ""}
                      onChange={(e) =>
                        setCurrentItem({
                          ...currentItem,
                          sellingPrice: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="h-9 text-xs"
                    />
                  </div>

                  {/* Add Button */}
                  <div className="col-span-1">
                    <Button
                      onClick={handleAddItem}
                      className="w-full h-9 bg-red-600 hover:bg-red-700"
                      disabled={!currentItem.productId}
                    >
                      <Plus className="w-4 h-4 mr-2" /> Add
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 3. Items List Table */}
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-red-50/50">
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-right">Cost</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Free</TableHead>
                    <TableHead className="text-right">Disc</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        className="text-center py-8 text-muted-foreground"
                      >
                        No items added
                      </TableCell>
                    </TableRow>
                  ) : (
                    items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <div className="font-medium">{item.productName}</div>
                          <div className="text-xs text-muted-foreground">
                            {item.sku}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          {item.unitPrice}
                        </TableCell>
                        <TableCell className="text-right">
                          {item.quantity}
                        </TableCell>
                        <TableCell className="text-right text-green-600">
                          {item.freeQuantity || "-"}
                        </TableCell>
                        <TableCell className="text-right text-red-500">
                          {item.discountAmount > 0
                            ? item.discountAmount.toFixed(2)
                            : "-"}
                        </TableCell>
                        <TableCell className="text-right font-bold">
                          {item.total.toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => handleRemoveItem(item.id)}
                          >
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        {/* RIGHT COLUMN - Summary */}
        <div className="lg:col-span-1">
          <Card className="sticky top-6 border-red-200 shadow-md">
            <CardHeader className="bg-red-50/30 pb-4">
              <CardTitle className="text-lg">Bill Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-6">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Supplier:</span>
                  <span className="font-medium">
                    {suppliers.find((s) => s.id === supplierId)?.name || "None"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Date:</span>
                  <span className="font-medium">
                    {new Date(purchaseDate).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Invoice #:</span>
                  <span className="font-medium">{invoiceNumber || "-"}</span>
                </div>
              </div>

              <div className="border-t pt-4 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Gross Cost:</span>
                  <span>LKR {totalGross.toLocaleString()}</span>
                </div>

                {totalLineDiscount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      Line Discounts:
                    </span>
                    <span className="text-red-500">
                      - LKR {totalLineDiscount.toLocaleString()}
                    </span>
                  </div>
                )}

                <div className="flex justify-between text-sm font-medium border-t border-dashed pt-2">
                  <span>Subtotal:</span>
                  <span>LKR {subtotal.toLocaleString()}</span>
                </div>

                {/* Extra Discount Logic - ✅ Allow Empty */}
                <div className="space-y-2 bg-red-50 p-3 rounded-md border border-red-100">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-red-800">
                      Extra Discount (%)
                    </Label>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      value={extraDiscountPercent}
                      onChange={(e) => {
                        const val = e.target.value;
                        setExtraDiscountPercent(
                          val === "" ? "" : parseFloat(val)
                        );
                      }}
                      placeholder="0%"
                      className="h-7 w-20 text-right text-xs bg-white"
                    />
                  </div>
                  {extraDiscountAmount > 0 && (
                    <div className="flex justify-between text-xs text-red-600 font-medium">
                      <span>Amount:</span>
                      <span>
                        - LKR{" "}
                        {extraDiscountAmount.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex justify-between items-center pt-4 border-t-2 border-red-100 mt-2">
                  <span className="font-bold text-lg">Net Payable:</span>
                  <span className="text-2xl font-bold text-red-600">
                    LKR{" "}
                    {Math.max(0, finalTotal).toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                    })}
                  </span>
                </div>
              </div>

              <Button
                onClick={handleSavePurchase}
                className="w-full bg-red-600 hover:bg-red-700 mt-4"
                size="lg"
                disabled={items.length === 0 || submitting}
              >
                {submitting ? (
                  "Processing..."
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Confirm Bill
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
