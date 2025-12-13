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
  unitPrice: number;
  discountPercent: number;
  discountAmount: number;
  finalPrice: number;
  total: number;
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
    unitPrice: 0,
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
          fetch("/api/products"),
          // ✅ Fetch suppliers only for this business (Orange Agency)
          fetch(`/api/suppliers?businessId=${currentBusinessId}`),
        ]);

        if (prodRes.ok) setProducts(await prodRes.json());
        if (supRes.ok) {
          const supplierData = await supRes.json();
          setSuppliers(supplierData);

          // ✅ Auto-select Orel Corporation if it's the only one
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
        quantity: 1,
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

    const unitDiscountAmount =
      (currentItem.unitPrice * currentItem.discountPercent) / 100;
    const netUnitPrice = currentItem.unitPrice - unitDiscountAmount;

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

  const subtotal = items.reduce((sum, item) => sum + item.total, 0);
  const totalDiscount = items.reduce(
    (sum, item) => sum + item.discountAmount,
    0
  );
  const totalGross = items.reduce(
    (sum, item) => sum + item.unitPrice * item.quantity,
    0
  );

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
      business_id: currentBusinessId, // ✅ Auto-Save Orange Agency ID
      purchase_date: purchaseDate,
      arrival_date: arrivalDate || "",
      invoice_number: invoiceNumber || "",
      total_amount: subtotal,
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
    const notInItems = !items.some((item) => item.productId === product.id);
    const matchesSupplier =
      !selectedSupplier || product.supplier === selectedSupplier.name;
    return notInItems && matchesSupplier;
  });

  const getSelectedProductName = () => {
    const product = products.find((p) => p.id === currentItem.productId);
    return product ? `${product.name}` : "Select product";
  };

  const currentDiscountAmount =
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
          {/* 1. Purchase Details Card */}
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
                {/* ✅ Supplier Selection (Auto-filled usually) */}
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
                  {suppliers.length === 0 && (
                    <p className="text-xs text-red-500">
                      No suppliers linked to this business.
                    </p>
                  )}
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
              <CardDescription>
                Add products from{" "}
                {selectedSupplier ? selectedSupplier.name : "the catalog"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Row 1: Product Search */}
                <div className="w-full">
                  <Label htmlFor="product" className="mb-2 block">
                    Product Name
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
                            ? "Select product..."
                            : "Select a supplier first"}
                        </span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[500px] p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Search product..." />
                        <CommandList>
                          <CommandEmpty>No product found.</CommandEmpty>
                          <CommandGroup>
                            {availableProducts.length === 0 ? (
                              <div className="p-4 text-center text-sm text-muted-foreground">
                                No items available.
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
                          quantity: parseInt(e.target.value) || 1,
                        })
                      }
                      className="h-9"
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
                      className="h-9 border-green-200"
                    />
                  </div>

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
                        <TableHead>Code</TableHead>
                        <TableHead>Item Name</TableHead>
                        <TableHead className="text-right">Cost</TableHead>
                        <TableHead className="text-right">Qty</TableHead>
                        <TableHead className="text-right">Disc</TableHead>
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
                          <TableCell className="font-medium text-sm max-w-[150px] truncate">
                            {item.productName}
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
          <Card className="sticky top-6 border-orange-200 shadow-md">
            <CardHeader className="bg-orange-50/30 pb-4">
              <CardTitle className="text-lg">Bill Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-6">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Supplier:</span>
                  <span className="font-medium">
                    {suppliers.find((s) => s.id === supplierId)?.name || "None"}
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
                  <span className="font-medium">{invoiceNumber || "-"}</span>
                </div>
              </div>

              <div className="border-t pt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Gross Cost:</span>
                  <span>LKR {totalGross.toLocaleString()}</span>
                </div>
                {totalDiscount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      Total Discount:
                    </span>
                    <span className="text-green-600">
                      - LKR {totalDiscount.toLocaleString()}
                    </span>
                  </div>
                )}
                <div className="flex justify-between items-center pt-2 border-t">
                  <span className="font-semibold text-lg">Net Payable:</span>
                  <span className="text-2xl font-bold text-orange-600">
                    LKR {subtotal.toLocaleString()}
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
