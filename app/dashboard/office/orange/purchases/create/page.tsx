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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  discountAmount: number; // Total Discount Amount for this line
  finalPrice: number; // Net Unit Cost
  total: number; // Line Total
}

export default function CreateOrangePurchasePage() {
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
  const [extraDiscountPercent, setExtraDiscountPercent] = useState<number>(0);

  // Items State
  const [items, setItems] = useState<PurchaseItem[]>([]);

  // UI States
  const [productSearchOpen, setProductSearchOpen] = useState(false);

  // Current Item Edit State
  const [currentItem, setCurrentItem] = useState({
    productId: "",
    sku: "",
    quantity: 1,
    freeQuantity: 0,
    mrp: 0,
    sellingPrice: 0,
    unitPrice: 0, // Cost Price
    discountPercent: 0,
    unit: "",
  });

  // --- 1. Get User Context (Orange Agency) ---
  useEffect(() => {
    const user = getUserBusinessContext();
    if (user && user.businessId) {
      setCurrentBusinessId(user.businessId);
      setCurrentBusinessName(user.businessName || "Orange Agency");
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

        if (prodRes.ok) setProducts(await prodRes.json());
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
    if (items.length > 0) {
      const confirmChange = window.confirm(
        "Changing supplier will clear the current items. Continue?"
      );
      if (!confirmChange) return;
      setItems([]);
    }
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
        unitPrice: product.costPrice || 0,
        discountPercent: 0,
        freeQuantity: 0,
        quantity: 1,
        unit: product.unitOfMeasure || "Pcs",
      });
      setProductSearchOpen(false);
    }
  };

  const handleAddItem = () => {
    if (
      !currentItem.productId ||
      currentItem.quantity <= 0 ||
      currentItem.unitPrice < 0
    ) {
      toast.error("Please fill all fields correctly");
      return;
    }

    const product = products.find((p) => p.id === currentItem.productId);
    if (!product) return;

    // Calculations
    const unitDiscountAmount =
      (currentItem.unitPrice * currentItem.discountPercent) / 100;
    const netUnitPrice = currentItem.unitPrice - unitDiscountAmount;

    // Total for this line (Net Unit Price * Qty)
    const total = netUnitPrice * currentItem.quantity;
    const totalDiscountAmount = unitDiscountAmount * currentItem.quantity;

    const newItem: PurchaseItem = {
      id: Date.now().toString(),
      productId: currentItem.productId,
      sku: product.sku,
      productName: product.name,
      quantity: currentItem.quantity,
      freeQuantity: currentItem.freeQuantity,
      unit: currentItem.unit,
      mrp: currentItem.mrp,
      sellingPrice: currentItem.sellingPrice,
      unitPrice: currentItem.unitPrice,
      discountPercent: currentItem.discountPercent,
      discountAmount: totalDiscountAmount,
      finalPrice: netUnitPrice,
      total: total,
    };

    setItems([...items, newItem]);

    // Reset Item Form
    setCurrentItem({
      productId: "",
      sku: "",
      quantity: 1,
      freeQuantity: 0,
      mrp: 0,
      sellingPrice: 0,
      unitPrice: 0,
      discountPercent: 0,
      unit: "",
    });
  };

  const handleRemoveItem = (id: string) => {
    setItems(items.filter((item) => item.id !== id));
  };

  // --- Bill Calculations ---
  // 1. Gross Total (Cost * Qty before discount)
  const totalGross = items.reduce(
    (sum, item) => sum + item.unitPrice * item.quantity,
    0
  );

  // 2. Line Level Discounts
  const totalLineDiscount = items.reduce(
    (sum, item) => sum + item.discountAmount,
    0
  );

  // 3. Subtotal (After line discounts, before extra discount)
  const subtotal = totalGross - totalLineDiscount;

  // 4. Extra Discount Amount (Calculated from Percentage)
  const extraDiscountAmount = (subtotal * extraDiscountPercent) / 100;

  // 5. Final Total (Subtotal - Extra Discount Amount)
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
      extra_discount: extraDiscountAmount, // Saving the calculated amount
      extra_discount_percent: extraDiscountPercent, // Optionally save percent if backend supports
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
      router.push("/dashboard/office/orange/purchases");
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const selectedSupplier = suppliers.find((s) => s.id === supplierId);

  const availableProducts = products.filter((product) => {
    const matchesSupplier =
      !selectedSupplier || product.supplier === selectedSupplier.name;
    return matchesSupplier;
  });

  const getSelectedProductName = () => {
    const product = products.find((p) => p.id === currentItem.productId);
    return product ? `${product.name}` : "Select product";
  };

  const currentLineDiscountAmount =
    ((currentItem.unitPrice * currentItem.discountPercent) / 100) *
    currentItem.quantity;

  if (loadingData) {
    return (
      <div className="flex justify-center items-center h-full min-h-64">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
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
          onClick={() => router.push("/dashboard/office/orange/purchases")}
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight text-orange-900">
            New Bill
          </h1>
          <p className="text-muted-foreground mt-1">
            Create a new bill for {currentBusinessName}
          </p>
        </div>
        <Button
          onClick={handleSavePurchase}
          disabled={items.length === 0 || submitting}
          className="bg-orange-600 hover:bg-orange-700"
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
          <Card className="border-orange-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Factory className="w-4 h-4 text-orange-600" />
                Bill Details
              </CardTitle>
              <CardDescription>
                Supplier and invoice information
              </CardDescription>
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

          {/* 2. Add Items Card - UPDATED DESIGN */}
          <Card>
            <CardHeader>
              <CardTitle>Add Items</CardTitle>
              <CardDescription>
                {supplierId
                  ? `Adding items for ${
                      suppliers.find((s) => s.id === supplierId)?.name
                    }`
                  : "Select a supplier to start"}
              </CardDescription>
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
                        disabled={!supplierId}
                      >
                        <span className="truncate">
                          {currentItem.productId
                            ? getSelectedProductName()
                            : supplierId
                            ? "Select product by Name or SKU"
                            : "Select a supplier first"}
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
                                {supplierId
                                  ? "No items available for this supplier"
                                  : "Select supplier first"}
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

                  {/* MRP */}
                  <div className="col-span-1">
                    <Label className="mb-2 block text-xs">MRP</Label>
                    <Input
                      type="number"
                      value={currentItem.mrp || ""}
                      onChange={(e) =>
                        setCurrentItem({
                          ...currentItem,
                          mrp: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="h-9 text-xs"
                      placeholder="0.00"
                    />
                  </div>

                  {/* Cost Price */}
                  <div className="col-span-1">
                    <Label className="mb-2 block text-xs font-semibold text-blue-600">
                      Cost Price
                    </Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={currentItem.unitPrice || ""}
                      onChange={(e) =>
                        setCurrentItem({
                          ...currentItem,
                          unitPrice: parseFloat(e.target.value) || 0,
                        })
                      }
                      placeholder="Cost"
                      className="h-9 border-blue-200 text-xs"
                    />
                  </div>

                  {/* Quantity */}
                  <div className="col-span-1">
                    <Label className="mb-2 block text-xs">Quantity</Label>
                    <Input
                      type="number"
                      min="1"
                      value={currentItem.quantity}
                      onChange={(e) =>
                        setCurrentItem({
                          ...currentItem,
                          quantity: parseInt(e.target.value) || 1,
                        })
                      }
                      className="h-9 text-xs"
                    />
                  </div>

                  {/* Discount % */}
                  <div className="col-span-1">
                    <Label className="mb-2 block text-xs">Disc %</Label>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={currentItem.discountPercent || ""}
                      onChange={(e) =>
                        setCurrentItem({
                          ...currentItem,
                          discountPercent: parseFloat(e.target.value) || 0,
                        })
                      }
                      placeholder="0%"
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

                  {/* Free Qty */}
                  <div className="col-span-1">
                    <Label className="mb-2 block text-xs text-green-600">
                      Free Qty
                    </Label>
                    <Input
                      type="number"
                      min="0"
                      value={
                        currentItem.freeQuantity > 0
                          ? currentItem.freeQuantity
                          : ""
                      }
                      onChange={(e) =>
                        setCurrentItem({
                          ...currentItem,
                          freeQuantity: parseInt(e.target.value) || 0,
                        })
                      }
                      placeholder="0"
                      className="h-9 border-green-200 text-xs"
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
                      className="w-full h-9 bg-orange-600 hover:bg-orange-700"
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
              {items.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Package className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No items added yet</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-orange-50/50">
                        <TableHead className="text-xs">Code</TableHead>
                        <TableHead className="text-xs">Item Name</TableHead>
                        <TableHead className="text-xs">Unit</TableHead>
                        <TableHead className="text-right text-xs">
                          MRP
                        </TableHead>
                        <TableHead className="text-right text-xs">
                          Selling
                        </TableHead>
                        <TableHead className="text-right text-xs text-blue-600">
                          Cost
                        </TableHead>
                        <TableHead className="text-right text-xs">
                          Qty
                        </TableHead>
                        <TableHead className="text-right text-xs">
                          Disc %
                        </TableHead>
                        <TableHead className="text-right text-xs">
                          Disc Amt
                        </TableHead>
                        <TableHead className="text-right text-xs text-green-600">
                          Free
                        </TableHead>
                        <TableHead className="text-right text-xs font-bold">
                          Total
                        </TableHead>
                        <TableHead className="w-[40px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-mono text-xs">
                            {item.sku}
                          </TableCell>
                          <TableCell className="font-medium text-xs max-w-[120px] truncate">
                            {item.productName}
                          </TableCell>
                          <TableCell className="text-xs">{item.unit}</TableCell>
                          <TableCell className="text-right text-xs">
                            {item.mrp}
                          </TableCell>
                          <TableCell className="text-right text-xs">
                            {item.sellingPrice}
                          </TableCell>
                          <TableCell className="text-right text-xs text-blue-600 font-medium">
                            {item.unitPrice.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right text-xs">
                            {item.quantity}
                          </TableCell>
                          <TableCell className="text-right text-xs">
                            {item.discountPercent > 0
                              ? item.discountPercent + "%"
                              : "-"}
                          </TableCell>
                          <TableCell className="text-right text-xs text-red-500">
                            {item.discountAmount > 0
                              ? item.discountAmount.toFixed(2)
                              : "-"}
                          </TableCell>
                          <TableCell className="text-right text-xs text-green-600 font-medium">
                            {item.freeQuantity > 0 ? item.freeQuantity : "-"}
                          </TableCell>
                          <TableCell className="text-right text-xs font-bold">
                            {item.total.toLocaleString()}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              className="h-6 w-6"
                              onClick={() => handleRemoveItem(item.id)}
                            >
                              <Trash2 className="w-3 h-3 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* RIGHT COLUMN - Summary */}
        <div className="lg:col-span-1">
          <Card className="sticky top-6 border-orange-200 shadow-md">
            <CardHeader className="bg-orange-50/30 pb-4">
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

                {/* Extra Discount Logic */}
                <div className="space-y-2 bg-orange-50 p-3 rounded-md border border-orange-100">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-orange-800">
                      Extra Discount (%)
                    </Label>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      value={
                        extraDiscountPercent > 0 ? extraDiscountPercent : ""
                      }
                      onChange={(e) =>
                        setExtraDiscountPercent(parseFloat(e.target.value) || 0)
                      }
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

                <div className="flex justify-between items-center pt-4 border-t-2 border-orange-100 mt-2">
                  <span className="font-bold text-lg">Net Payable:</span>
                  <span className="text-2xl font-bold text-orange-600">
                    LKR{" "}
                    {Math.max(0, finalTotal).toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                    })}
                  </span>
                </div>
              </div>

              <Button
                onClick={handleSavePurchase}
                className="w-full bg-orange-600 hover:bg-orange-700 mt-4"
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
