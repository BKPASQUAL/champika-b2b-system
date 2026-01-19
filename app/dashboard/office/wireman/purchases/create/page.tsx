"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Save,
  Loader2,
  Factory,
  RefreshCcw,
  X,
  Search,
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
  unitPrice: number;
  discountPercent: number;
  discountAmount: number;
  finalPrice: number;
  total: number;
}

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
    null,
  );
  const [currentBusinessName, setCurrentBusinessName] = useState<string>("");

  // Data States
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  // Form States
  const [supplierId, setSupplierId] = useState<string | null>(null);
  const [purchaseDate, setPurchaseDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [arrivalDate, setArrivalDate] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");

  const [extraDiscountPercent, setExtraDiscountPercent] = useState<
    number | string
  >("");

  // Items State
  const [items, setItems] = useState<PurchaseItem[]>([]);

  // --- Custom Dropdown State ---
  const [searchTerm, setSearchTerm] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Current Item Edit State
  const [currentItem, setCurrentItem] = useState<{
    productId: string;
    sku: string;
    quantity: number | string;
    freeQuantity: number | string;
    mrp: number;
    sellingPrice: number;
    unitPrice: number | string;
    discountPercent: number | string;
    unit: string;
  }>({
    productId: "",
    sku: "",
    quantity: "",
    freeQuantity: "",
    mrp: 0,
    sellingPrice: 0,
    unitPrice: "",
    discountPercent: "",
    unit: "",
  });

  // --- 1. Get User Context ---
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

  // --- 2. Fetch Data Function ---
  const loadData = async () => {
    if (!currentBusinessId) return;
    setLoadingData(true);
    try {
      const [prodRes, supRes] = await Promise.all([
        fetch("/api/products?active=true"),
        fetch(`/api/suppliers?businessId=${currentBusinessId}`),
      ]);

      if (prodRes.ok) {
        const allProducts: Product[] = await prodRes.json();
        setProducts(allProducts);
      } else {
        toast.error("Failed to load products");
      }

      if (supRes.ok) {
        const supplierData = await supRes.json();
        setSuppliers(supplierData);
        if (supplierData.length === 1) setSupplierId(supplierData[0].id);
      }
    } catch (error) {
      toast.error("Failed to load data");
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentBusinessId]);

  // --- Close Dropdown on Click Outside ---
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // --- Handlers ---
  const handleSupplierChange = (newSupplierId: string) =>
    setSupplierId(newSupplierId);

  const handleProductSelect = (product: Product) => {
    setCurrentItem({
      ...currentItem,
      productId: product.id,
      sku: product.sku,
      mrp: product.mrp || 0,
      sellingPrice: product.sellingPrice || 0,
      unitPrice: product.costPrice > 0 ? product.costPrice : "",
      discountPercent: "",
      freeQuantity: "",
      quantity: "",
      unit: product.unitOfMeasure || "Pcs",
    });
    setSearchTerm(product.name); // Set input text to selected product
    setIsDropdownOpen(false); // Close dropdown
  };

  const handleAddItem = () => {
    const qty = parseNumber(currentItem.quantity);
    const unitPrice = parseNumber(currentItem.unitPrice);

    if (!currentItem.productId || qty <= 0) {
      toast.error("Please enter a valid quantity");
      return;
    }
    if (unitPrice < 0) {
      toast.error("Invalid Cost Price");
      return;
    }

    const product = products.find((p) => p.id === currentItem.productId);
    if (!product) return;

    const discountPct = parseNumber(currentItem.discountPercent);
    const freeQty = parseNumber(currentItem.freeQuantity);
    const unitDiscountAmount = (unitPrice * discountPct) / 100;
    const netUnitPrice = unitPrice - unitDiscountAmount;
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

    // Reset Form
    setCurrentItem({
      productId: "",
      sku: "",
      quantity: "",
      freeQuantity: "",
      mrp: 0,
      sellingPrice: 0,
      unitPrice: "",
      discountPercent: "",
      unit: "",
    });
    setSearchTerm(""); // Reset Search
  };

  const handleRemoveItem = (id: string) =>
    setItems(items.filter((item) => item.id !== id));

  const totalGross = items.reduce(
    (sum, item) => sum + item.unitPrice * item.quantity,
    0,
  );
  const totalLineDiscount = items.reduce(
    (sum, item) => sum + item.discountAmount,
    0,
  );
  const subtotal = totalGross - totalLineDiscount;
  const extraDiscountAmount =
    (subtotal * parseNumber(extraDiscountPercent)) / 100;
  const finalTotal = subtotal - extraDiscountAmount;

  const handleSavePurchase = async () => {
    if (items.length === 0) return toast.error("Add at least one item");
    if (!supplierId) return toast.error("Select a supplier");
    if (!currentBusinessId) return toast.error("Business context missing");

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

  // Filter products for dropdown
  const filteredProducts = products.filter((p) => {
    const searchLower = searchTerm.toLowerCase();
    const inList = items.some((i) => i.productId === p.id);
    if (inList) return false; // Hide if already added

    // Show all if search is empty and focused, or filter by name/sku/supplier
    if (searchTerm === "") return true;

    return (
      p.name.toLowerCase().includes(searchLower) ||
      p.sku.toLowerCase().includes(searchLower) ||
      (p.supplier && p.supplier.toLowerCase().includes(searchLower))
    );
  });

  const currentLineDiscountAmount =
    ((parseNumber(currentItem.unitPrice) *
      parseNumber(currentItem.discountPercent)) /
      100) *
    parseNumber(currentItem.quantity);

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
        {/* LEFT COLUMN */}
        <div className="lg:col-span-2 space-y-3">
          <Card className="border-red-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Factory className="w-4 h-4 text-red-600" /> Bill Details
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

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Add Items</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={loadData}
                className="text-xs"
              >
                <RefreshCcw className="w-3 h-3 mr-1" /> Refresh
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* --- CUSTOM NORMAL SEARCHABLE DROPDOWN --- */}
                <div className="w-full relative" ref={dropdownRef}>
                  <Label className="mb-2 block">
                    Product Search ({products.length} products loaded)
                  </Label>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Type product name or SKU..."
                      className="pl-8"
                      value={searchTerm}
                      onChange={(e) => {
                        setSearchTerm(e.target.value);
                        setIsDropdownOpen(true);
                      }}
                      onFocus={() => setIsDropdownOpen(true)}
                    />
                    {searchTerm && (
                      <button
                        onClick={() => {
                          setSearchTerm("");
                          setCurrentItem((prev) => ({
                            ...prev,
                            productId: "",
                          }));
                        }}
                        className="absolute right-2 top-2.5 text-muted-foreground hover:text-black"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {isDropdownOpen && (
                    <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-y-auto">
                      {filteredProducts.length === 0 ? (
                        <div className="p-3 text-sm text-center text-gray-500">
                          No products found
                        </div>
                      ) : (
                        filteredProducts.map((product) => (
                          <div
                            key={product.id}
                            className="p-2 hover:bg-red-50 cursor-pointer border-b border-gray-50 last:border-0"
                            onClick={() => handleProductSelect(product)}
                          >
                            <div className="font-medium text-sm">
                              {product.name}
                            </div>
                            <div className="text-xs text-gray-500 flex justify-between">
                              <span>{product.sku}</span>
                              <span>{product.supplier || "No Supplier"}</span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
                {/* ----------------------- */}

                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 items-end">
                  <div className="col-span-1">
                    <Label className="mb-2 block text-xs">Item Code</Label>
                    <Input
                      value={currentItem.sku || ""}
                      disabled
                      className="h-9 bg-muted text-xs"
                      placeholder="Auto"
                    />
                  </div>
                  <div className="col-span-1">
                    <Label className="mb-2 block text-xs">Unit</Label>
                    <Input
                      value={currentItem.unit || ""}
                      disabled
                      className="h-9 bg-muted text-xs"
                      placeholder="Unit"
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
                      value={currentItem.unitPrice}
                      onChange={(e) =>
                        setCurrentItem({
                          ...currentItem,
                          unitPrice:
                            e.target.value === ""
                              ? ""
                              : parseFloat(e.target.value),
                        })
                      }
                      className="h-9 border-blue-200 text-xs"
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
                          quantity:
                            e.target.value === ""
                              ? ""
                              : parseInt(e.target.value),
                        })
                      }
                      className="h-9 text-xs"
                    />
                  </div>
                  <div className="col-span-1">
                    <Label className="mb-2 block text-xs text-green-600">
                      Free Qty
                    </Label>
                    <Input
                      type="number"
                      min="0"
                      value={currentItem.freeQuantity}
                      onChange={(e) =>
                        setCurrentItem({
                          ...currentItem,
                          freeQuantity:
                            e.target.value === ""
                              ? ""
                              : parseInt(e.target.value),
                        })
                      }
                      className="h-9 border-green-200 text-xs"
                    />
                  </div>
                  <div className="col-span-1">
                    <Label className="mb-2 block text-xs">Disc %</Label>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={currentItem.discountPercent}
                      onChange={(e) =>
                        setCurrentItem({
                          ...currentItem,
                          discountPercent:
                            e.target.value === ""
                              ? ""
                              : parseFloat(e.target.value),
                        })
                      }
                      className="h-9 text-xs"
                    />
                  </div>
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

          {/* Table */}
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
                <div className="flex justify-between text-sm font-medium border-t border-dashed pt-2">
                  <span>Subtotal:</span>
                  <span>LKR {subtotal.toLocaleString()}</span>
                </div>
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
                      onChange={(e) =>
                        setExtraDiscountPercent(
                          e.target.value === ""
                            ? ""
                            : parseFloat(e.target.value),
                        )
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
                    <Save className="w-4 h-4 mr-2" /> Confirm Bill
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
