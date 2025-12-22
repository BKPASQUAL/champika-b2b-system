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

// Constants
import { BUSINESS_IDS } from "@/app/config/business-constants";

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
  businessId?: string;
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
  unitPrice: number;
  discountPercent: number;
  discountAmount: number;
  finalPrice: number;
  total: number;
}

export default function DistributionCreatePurchasePage() {
  const router = useRouter();
  const CURRENT_BUSINESS_ID = BUSINESS_IDS.CHAMPIKA_DISTRIBUTION;

  const [loadingData, setLoadingData] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Data States
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  // Form States
  const [supplierId, setSupplierId] = useState<string | null>(null);
  const [businessId] = useState<string>(CURRENT_BUSINESS_ID);

  const [purchaseDate, setPurchaseDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [arrivalDate, setArrivalDate] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");

  // ✅ Extra Discount Percent (String to allow empty state)
  const [extraDiscountPercent, setExtraDiscountPercent] = useState<string>("");

  // Items State
  const [items, setItems] = useState<PurchaseItem[]>([]);

  // UI States
  const [productSearchOpen, setProductSearchOpen] = useState(false);

  // Current Item Edit State
  const [currentItem, setCurrentItem] = useState({
    productId: "",
    sku: "",
    quantity: "", // Empty by default
    freeQuantity: 0,
    mrp: 0,
    sellingPrice: 0,
    unitPrice: 0,
    discountPercent: 0,
    unit: "",
  });

  // --- Fetch Data on Mount ---
  useEffect(() => {
    const loadData = async () => {
      try {
        const [prodRes, supRes] = await Promise.all([
          fetch("/api//products?active=true"),
          fetch("/api/suppliers"),
        ]);

        if (prodRes.ok) setProducts(await prodRes.json());
        if (supRes.ok) {
          const allSuppliers = await supRes.json();
          const distributionSuppliers = allSuppliers.filter(
            (s: Supplier) => s.businessId === CURRENT_BUSINESS_ID
          );
          setSuppliers(distributionSuppliers);
        }
      } catch (error) {
        toast.error("Failed to load initial data");
      } finally {
        setLoadingData(false);
      }
    };

    loadData();
  }, [CURRENT_BUSINESS_ID]);

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

    setCurrentItem({
      productId: "",
      sku: "",
      quantity: "",
      freeQuantity: 0,
      mrp: 0,
      sellingPrice: 0,
      unitPrice: 0,
      discountPercent: 0,
      unit: "",
    });
  };

  const handleProductSelect = (productId: string) => {
    const product = products.find((p) => p.id === productId);
    if (product) {
      const selling = product.sellingPrice || 0;
      const cost = product.costPrice || 0;

      setCurrentItem({
        ...currentItem,
        productId: productId,
        sku: product.sku,
        mrp: product.mrp,
        sellingPrice: selling,
        unitPrice: cost,
        discountPercent: 0,
        freeQuantity: 0,
        quantity: "",
        unit: product.unitOfMeasure || "Pcs",
      });
      setProductSearchOpen(false);
    }
  };

  const handleUnitPriceChange = (newPrice: number) => {
    setCurrentItem({ ...currentItem, unitPrice: newPrice });
  };

  const handleDiscountChange = (newDiscount: number) => {
    setCurrentItem({
      ...currentItem,
      discountPercent: Math.max(0, Math.min(100, newDiscount)),
    });
  };

  const handleAddItem = () => {
    const qty = parseFloat(currentItem.quantity);

    if (
      !currentItem.productId ||
      !qty ||
      qty <= 0 ||
      currentItem.unitPrice < 0
    ) {
      toast.error("Please fill all fields correctly");
      return;
    }

    const product = products.find((p) => p.id === currentItem.productId);
    if (!product) return;

    const unitDiscountAmount =
      (currentItem.unitPrice * currentItem.discountPercent) / 100;
    const netUnitPrice = currentItem.unitPrice - unitDiscountAmount;

    const total = netUnitPrice * qty;
    const totalDiscountAmount = unitDiscountAmount * qty;

    const newItem: PurchaseItem = {
      id: Date.now().toString(),
      productId: currentItem.productId,
      sku: product.sku,
      productName: product.name,
      quantity: qty,
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

    setCurrentItem({
      productId: "",
      sku: "",
      quantity: "",
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

  // --- Calculations ---
  const subtotal = items.reduce((sum, item) => sum + item.total, 0);
  const itemsTotalDiscount = items.reduce(
    (sum, item) => sum + item.discountAmount,
    0
  );
  const totalGross = items.reduce(
    (sum, item) => sum + item.unitPrice * item.quantity,
    0
  );

  // ✅ Parse discount PERCENTAGE
  const discountPercentVal = parseFloat(extraDiscountPercent) || 0;

  // ✅ Calculate Amount: (Subtotal * Percent) / 100
  const extraDiscountAmount = (subtotal * discountPercentVal) / 100;

  // Net Payable
  const netPayable = Math.max(0, subtotal - extraDiscountAmount);

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

    setSubmitting(true);

    const purchasePayload = {
      supplier_id: supplierId,
      business_id: businessId,
      purchase_date: purchaseDate,
      arrival_date: arrivalDate || "",
      invoice_number: invoiceNumber || "",
      extra_discount: extraDiscountAmount, // ✅ Sending Amount to backend
      total_amount: netPayable,
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

      toast.success("Purchase Order Created Successfully!");
      router.push("/dashboard/office/distribution/purchases");
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const selectedSupplier = suppliers.find((s) => s.id === supplierId);

  const availableProducts = products.filter((product) => {
    const notInItems = !items.some((item) => item.productId === product.id);
    const matchesSupplier =
      !selectedSupplier || product.supplier === selectedSupplier.name;
    return notInItems && matchesSupplier;
  });

  const getSelectedProductName = () => {
    const product = products.find((p) => p.id === currentItem.productId);
    return product ? `${product.name}` : "Select product";
  };

  const qtyNum = parseFloat(currentItem.quantity) || 0;
  const currentDiscountAmount =
    ((currentItem.unitPrice * currentItem.discountPercent) / 100) * qtyNum;

  if (loadingData) {
    return (
      <div className="flex justify-center items-center h-full min-h-64">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        <p className="text-lg text-muted-foreground">Loading suppliers...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 mx-auto pb-10">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={() =>
            router.push("/dashboard/office/distribution/purchases")
          }
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight">
            New Distribution Purchase
          </h1>
          <p className="text-muted-foreground mt-1">
            Create a new purchase order for Champika Hardware - Distribution
          </p>
        </div>
        <Button
          onClick={handleSavePurchase}
          disabled={items.length === 0 || submitting}
        >
          {submitting ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Save className="w-4 h-4 mr-2" />
          )}
          Save Purchase
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* LEFT COLUMN - Forms */}
        <div className="lg:col-span-2 space-y-3">
          {/* 1. Purchase Details Card */}
          <Card>
            <CardHeader>
              <CardTitle>Purchase Details</CardTitle>
              <CardDescription>
                Select a supplier and enter invoice information.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Supplier (Distribution Only)</Label>
                  <Select
                    value={supplierId || ""}
                    onValueChange={handleSupplierChange}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select Supplier" />
                    </SelectTrigger>
                    <SelectContent>
                      {suppliers.length === 0 ? (
                        <SelectItem value="none" disabled>
                          No suppliers found for Distribution
                        </SelectItem>
                      ) : (
                        suppliers.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.name}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="date">Purchase Date</Label>
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
                    placeholder="Supplier's invoice/bill number"
                    value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="arrivalDate">Delivered Date</Label>
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
              <CardDescription>
                {supplierId
                  ? `Select products from ${
                      suppliers.find((s) => s.id === supplierId)?.name
                    }`
                  : "Select a supplier to see available products"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Row 1: Product Search */}
                <div className="w-full">
                  <Label htmlFor="product" className="mb-2 block">
                    Item Name / Search Product
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
                            : "Please select a supplier first"}
                        </span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[500px] p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Search product by name or SKU..." />
                        <CommandList>
                          <CommandEmpty>
                            No product found for this supplier.
                          </CommandEmpty>
                          <CommandGroup>
                            {availableProducts.length === 0 ? (
                              <div className="p-4 text-center text-sm text-muted-foreground">
                                {supplierId
                                  ? "No items available for this supplier"
                                  : "Select a supplier to view items"}
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
                                      Code: {product.sku} | MRP: {product.mrp}
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

                {/* Row 2: Item Details */}
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 items-end">
                  <div className="col-span-1">
                    <Label className="mb-2 block text-xs">Item Code</Label>
                    <Input
                      value={currentItem.sku || ""}
                      disabled
                      className="h-9 bg-muted"
                      placeholder="Auto"
                    />
                  </div>

                  <div className="col-span-1">
                    <Label className="mb-2 block text-xs">Unit</Label>
                    <Input
                      value={currentItem.unit || ""}
                      disabled
                      className="h-9 bg-muted"
                      placeholder="Unit"
                    />
                  </div>

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
                      className="h-9"
                      placeholder="0.00"
                    />
                  </div>

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
                        handleUnitPriceChange(parseFloat(e.target.value) || 0)
                      }
                      placeholder="Cost Price"
                      className="h-9 border-blue-200"
                    />
                  </div>

                  <div className="col-span-1">
                    <Label className="mb-2 block text-xs">Quantity</Label>
                    <Input
                      type="number"
                      min="1"
                      value={currentItem.quantity}
                      onChange={(e) =>
                        setCurrentItem({
                          ...currentItem,
                          quantity: e.target.value,
                        })
                      }
                      className="h-9"
                      placeholder="Qty"
                    />
                  </div>

                  <div className="col-span-1">
                    <Label className="mb-2 block text-xs">Discount (%)</Label>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={currentItem.discountPercent || ""}
                      onChange={(e) =>
                        handleDiscountChange(parseFloat(e.target.value) || 0)
                      }
                      placeholder="0%"
                      className="h-9"
                    />
                  </div>

                  <div className="col-span-1">
                    <Label className="mb-2 block text-xs">D. Amount</Label>
                    <Input
                      value={
                        currentDiscountAmount > 0
                          ? currentDiscountAmount.toFixed(2)
                          : ""
                      }
                      disabled
                      className="h-9 bg-muted"
                      placeholder="0.00"
                    />
                  </div>

                  <div className="col-span-1">
                    <Label className="mb-2 block text-xs text-green-600">
                      Free Item Qty
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
                      className="h-9 border-green-200"
                    />
                  </div>

                  <div className="col-span-1">
                    <Label className="mb-2 block text-xs">Selling Price</Label>
                    <Input
                      type="number"
                      min="0"
                      value={currentItem.sellingPrice || ""}
                      onChange={(e) =>
                        setCurrentItem({
                          ...currentItem,
                          sellingPrice: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="h-9"
                    />
                  </div>

                  <div className="col-span-1">
                    <Button
                      onClick={handleAddItem}
                      className="w-full h-9"
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
            <CardHeader>
              <CardTitle>Purchase Items</CardTitle>
              <CardDescription>
                List of items added to this order
              </CardDescription>
            </CardHeader>
            <CardContent>
              {items.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Package className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No items added yet</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item Code</TableHead>
                        <TableHead>Item Name</TableHead>
                        <TableHead className="text-center">Unit</TableHead>
                        <TableHead className="text-right">Cost Price</TableHead>
                        <TableHead className="text-right">Qty</TableHead>
                        <TableHead className="text-right">Disc(%)</TableHead>
                        <TableHead className="text-right">D. Amount</TableHead>
                        <TableHead className="text-right text-green-600">
                          Free
                        </TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead className="w-[50px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-mono text-xs">
                            {item.sku}
                          </TableCell>
                          <TableCell
                            className="font-medium text-sm max-w-[150px] truncate"
                            title={item.productName}
                          >
                            {item.productName}
                          </TableCell>
                          <TableCell className="text-center text-xs text-muted-foreground">
                            {item.unit}
                          </TableCell>
                          <TableCell className="text-right text-blue-600">
                            {item.unitPrice.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right">
                            {item.quantity}
                          </TableCell>
                          <TableCell className="text-right">
                            {item.discountPercent > 0
                              ? item.discountPercent.toFixed(1) + "%"
                              : "-"}
                          </TableCell>
                          <TableCell className="text-right text-red-500">
                            {item.discountAmount > 0
                              ? item.discountAmount.toFixed(2)
                              : "-"}
                          </TableCell>
                          <TableCell className="text-right text-green-600 font-medium">
                            {item.freeQuantity > 0 ? item.freeQuantity : "-"}
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
                              <Trash2 className="w-4 h-4 text-destructive" />
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
          <Card className="sticky top-6">
            <CardHeader>
              <CardTitle>Purchase Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Business:</span>
                  <span className="font-medium">Distribution</span>
                </div>

                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Supplier:</span>
                  <span className="font-medium">
                    {suppliers.find((s) => s.id === supplierId)?.name ||
                      "Not selected"}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Date:</span>
                  <span className="font-medium">
                    {new Date(purchaseDate).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Invoice #:</span>
                  <span className="font-medium">
                    {invoiceNumber || "Not set"}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Payment:</span>
                  <span className="font-medium capitalize text-red-600">
                    Unpaid
                  </span>
                </div>
              </div>

              <div className="border-t pt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Gross Cost:</span>
                  <span>LKR {totalGross.toLocaleString()}</span>
                </div>
                {itemsTotalDiscount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      Total Discount:
                    </span>
                    <span className="text-green-600">
                      - LKR {itemsTotalDiscount.toLocaleString()}
                    </span>
                  </div>
                )}

                {/* ✅ Extra Discount Input (PERCENTAGE) */}
                <div className="flex justify-between items-center text-sm pt-2">
                  <div className="flex flex-col">
                    <span className="text-muted-foreground">
                      Extra Discount (%)
                    </span>
                    {extraDiscountAmount > 0 && (
                      <span className="text-xs text-green-600">
                        - LKR{" "}
                        {extraDiscountAmount.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                        })}
                      </span>
                    )}
                  </div>
                  <div className="w-32">
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={extraDiscountPercent}
                      onChange={(e) => setExtraDiscountPercent(e.target.value)}
                      className="h-8 text-right font-medium"
                      placeholder="0%"
                    />
                  </div>
                </div>

                <div className="flex justify-between items-center pt-4 border-t">
                  <span className="font-semibold">Net Payable:</span>
                  <span className="text-2xl font-bold text-primary">
                    LKR {netPayable.toLocaleString()}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground pt-2">
                  This is what you will pay to the supplier
                </p>
              </div>

              <Button
                onClick={handleSavePurchase}
                className="w-full"
                size="lg"
                disabled={items.length === 0 || submitting}
              >
                {submitting ? (
                  "Processing..."
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Create Purchase Order
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
