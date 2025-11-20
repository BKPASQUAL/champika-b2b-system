// app/dashboard/admin/purchases/create/page.tsx
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

// Interfaces specific to the form logic
interface Product {
  id: string;
  sku: string;
  name: string;
  unit_price: number;
  selling_price?: number;
  cost_price?: number;
  mrp: number;
  stock_quantity: number;
  unit_of_measure: string;
}

interface PurchaseItem {
  id: string;
  productId: string;
  sku: string; // Added Item Code
  productName: string;
  quantity: number;
  freeQuantity: number; // Added Free Qty
  unit: string;
  mrp: number;
  sellingPrice: number;
  unitPrice: number; // Renamed from costPrice for display
  discountPercent: number;
  discountAmount: number;
  finalPrice: number;
  total: number;
  mrpChanged: boolean;
  sellingPriceChanged: boolean;
}

// Mock Data for frontend-only demonstration
const MOCK_PRODUCTS: Product[] = [
  {
    id: "P1",
    sku: "SKU-001",
    name: "Copper Wire 2.5mm",
    unit_price: 150,
    selling_price: 150,
    cost_price: 120,
    mrp: 150,
    stock_quantity: 500,
    unit_of_measure: "m",
  },
  {
    id: "P2",
    sku: "SKU-002",
    name: "PVC Pipe 4 inch",
    unit_price: 800,
    selling_price: 800,
    cost_price: 650,
    mrp: 800,
    stock_quantity: 120,
    unit_of_measure: "unit",
  },
  {
    id: "P3",
    sku: "SKU-003",
    name: "Cement 50kg",
    unit_price: 2800,
    selling_price: 2750,
    cost_price: 2600,
    mrp: 2800,
    stock_quantity: 45,
    unit_of_measure: "bag",
  },
];

const MOCK_SUPPLIERS = [
  { id: "S1", name: "Sierra Cables Ltd" },
  { id: "S2", name: "Lanka Builders Pvt Ltd" },
  { id: "S3", name: "Colombo Cement Corp" },
];

export default function CreatePurchasePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [supplierId, setSupplierId] = useState<string | null>(null);
  const [suppliers, setSuppliers] = useState<{ id: string; name: string }[]>(
    []
  );

  // Product search state
  const [productSearchOpen, setProductSearchOpen] = useState(false);

  const [purchaseDate, setPurchaseDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [arrivalDate, setArrivalDate] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");

  const [items, setItems] = useState<PurchaseItem[]>([]);

  // Current Item State
  const [currentItem, setCurrentItem] = useState({
    productId: "",
    sku: "",
    quantity: 1,
    freeQuantity: 0,
    mrp: 0,
    sellingPrice: 0,
    unitPrice: 0, // This is the Cost Price/Unit Price
    discountPercent: 0,
  });

  useEffect(() => {
    // Simulating data fetching
    setTimeout(() => {
      setProducts(MOCK_PRODUCTS);
      setSuppliers(MOCK_SUPPLIERS);
      if (MOCK_SUPPLIERS.length > 0) {
        setSupplierId(MOCK_SUPPLIERS[0].id);
      }
      setLoading(false);
    }, 500);
  }, []);

  const handleProductSelect = (productId: string) => {
    const product = products.find((p) => p.id === productId);
    if (product) {
      const sellingPrice = product.selling_price || product.unit_price;
      const unitPrice = product.cost_price || 0;

      const autoDiscount =
        unitPrice > 0 && product.mrp > 0
          ? ((product.mrp - unitPrice) / product.mrp) * 100
          : 0;

      setCurrentItem({
        ...currentItem,
        productId: productId,
        sku: product.sku,
        mrp: product.mrp,
        sellingPrice: sellingPrice,
        unitPrice: unitPrice,
        discountPercent: autoDiscount,
        freeQuantity: 0, // Reset free qty
        quantity: 1,
      });

      setProductSearchOpen(false);
    }
  };

  const handleUnitPriceChange = (newPrice: number) => {
    const newDiscount =
      currentItem.mrp > 0
        ? ((currentItem.mrp - newPrice) / currentItem.mrp) * 100
        : 0;

    setCurrentItem({
      ...currentItem,
      unitPrice: newPrice,
      discountPercent: Math.max(0, Math.min(100, newDiscount)),
    });
  };

  const handleDiscountChange = (newDiscount: number) => {
    const newUnitPrice =
      currentItem.mrp - (currentItem.mrp * newDiscount) / 100;

    setCurrentItem({
      ...currentItem,
      discountPercent: newDiscount,
      unitPrice: Math.max(0, newUnitPrice),
    });
  };

  const handleAddItem = () => {
    if (
      !currentItem.productId ||
      currentItem.quantity <= 0 ||
      currentItem.unitPrice < 0
    ) {
      alert("Please fill all item details with valid quantities and prices");
      return;
    }

    const product = products.find((p) => p.id === currentItem.productId);
    if (!product) return;

    // Calculations
    const total = currentItem.unitPrice * currentItem.quantity;
    const originalSellingPrice = product.selling_price || product.unit_price;

    // Discount Amount per unit * quantity
    const unitDiscountAmount =
      (currentItem.mrp * currentItem.discountPercent) / 100;
    const totalDiscountAmount = unitDiscountAmount * currentItem.quantity;

    const newItem: PurchaseItem = {
      id: Date.now().toString(),
      productId: currentItem.productId,
      sku: product.sku,
      productName: product.name,
      quantity: currentItem.quantity,
      freeQuantity: currentItem.freeQuantity,
      unit: product.unit_of_measure,
      mrp: currentItem.mrp,
      sellingPrice: currentItem.sellingPrice,
      unitPrice: currentItem.unitPrice,
      discountPercent: currentItem.discountPercent,
      discountAmount: totalDiscountAmount,
      finalPrice: currentItem.unitPrice,
      total: total,
      mrpChanged: currentItem.mrp !== product.mrp,
      sellingPriceChanged: currentItem.sellingPrice !== originalSellingPrice,
    };

    setItems([...items, newItem]);

    // Reset form
    setCurrentItem({
      productId: "",
      sku: "",
      quantity: 1,
      freeQuantity: 0,
      mrp: 0,
      sellingPrice: 0,
      unitPrice: 0,
      discountPercent: 0,
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
  const totalBeforeDiscount = items.reduce(
    (sum, item) => sum + item.mrp * item.quantity,
    0
  );

  const handleSavePurchase = async () => {
    if (items.length === 0) {
      alert("Please add at least one item");
      return;
    }
    if (!supplierId) {
      alert("Supplier not found");
      return;
    }

    setLoading(true);

    const purchaseData = {
      supplier_id: supplierId,
      purchase_date: purchaseDate,
      arrival_date: arrivalDate || null,
      invoice_number: invoiceNumber || null,
      payment_status: "Unpaid",
      items: items.map((item) => ({
        ...item,
        // Logic to handle backend: Usually free items are added to quantity or handled separately
        total_quantity: item.quantity + item.freeQuantity,
      })),
      subtotal: subtotal,
      total_amount: subtotal,
    };

    console.log("Saving Purchase Data:", purchaseData);

    setTimeout(() => {
      setLoading(false);
      alert("Purchase Order Created Successfully!");
      router.push("/dashboard/admin/purchases");
    }, 1000);
  };

  const availableProducts = products.filter(
    (product) => !items.some((item) => item.productId === product.id)
  );

  // Get selected product name for display
  const getSelectedProductName = () => {
    const product = products.find((p) => p.id === currentItem.productId);
    return product ? `${product.name}` : "Select product";
  };

  // Calculate Discount Amount for display in input section
  const currentDiscountAmount =
    ((currentItem.mrp * currentItem.discountPercent) / 100) *
    currentItem.quantity;

  if (loading && products.length === 0) {
    return (
      <div className="flex justify-center items-center h-full min-h-64">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        <p className="text-lg text-muted-foreground">Loading data...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4  mx-auto pb-10">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push("/dashboard/admin/purchases")}
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight">
            New Purchase Order
          </h1>
          <p className="text-muted-foreground mt-1">
            Create a new purchase order
          </p>
        </div>
        <Button
          onClick={handleSavePurchase}
          disabled={items.length === 0 || loading}
        >
          {loading ? (
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
                Supplier and invoice information
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Supplier</Label>
                  <Select
                    value={supplierId || ""}
                    onValueChange={setSupplierId}
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
                  <Label htmlFor="date">Purchase Date</Label>
                  <Input
                    id="date"
                    type="date"
                    value={purchaseDate}
                    onChange={(e) => setPurchaseDate(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
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
                Search and add products to the list
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
                      >
                        <span className="truncate">
                          {currentItem.productId
                            ? getSelectedProductName()
                            : "Select product by Name or SKU"}
                        </span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[500px] p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Search product by name or SKU..." />
                        <CommandList>
                          <CommandEmpty>No product found.</CommandEmpty>
                          <CommandGroup>
                            {availableProducts.length === 0 ? (
                              <div className="p-4 text-center text-sm text-muted-foreground">
                                All products have been added
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
                    <Label className="mb-2 block text-xs">MRP</Label>
                    <Input
                      type="number"
                      value={currentItem.mrp || ""}
                      disabled
                      className="h-9 bg-muted"
                      placeholder="0.00"
                    />
                  </div>

                  <div className="col-span-1">
                    <Label className="mb-2 block text-xs font-semibold text-blue-600">
                      Unit Price
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
                      value={
                        currentItem.discountPercent > 0
                          ? currentItem.discountPercent.toFixed(2)
                          : ""
                      }
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

                  <div className="col-span-1 lg:col-span-2">
                    <Button
                      onClick={handleAddItem}
                      className="w-full h-9"
                      disabled={availableProducts.length === 0}
                    >
                      <Plus className="w-4 h-4 mr-2" /> Add Item
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
                        <TableHead className="text-right">MRP</TableHead>
                        <TableHead className="text-right">Unit Price</TableHead>
                        <TableHead className="text-right">Qty</TableHead>
                        <TableHead className="text-right">Disc(%)</TableHead>
                        <TableHead className="text-right">D. Amount</TableHead>
                        <TableHead className="text-right text-green-600">
                          Free Qty
                        </TableHead>
                        <TableHead className="text-right">
                          Selling Price
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
                          <TableCell className="text-right">
                            {item.mrp.toLocaleString()}
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
                          <TableCell className="text-right">
                            {item.sellingPrice.toLocaleString()}
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
                {arrivalDate && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Delivered:</span>
                    <span className="font-medium">
                      {new Date(arrivalDate).toLocaleDateString()}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Items:</span>
                  <span className="font-medium">{items.length}</span>
                </div>
              </div>

              <div className="border-t pt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    Gross Value (MRP):
                  </span>
                  <span>LKR {totalBeforeDiscount.toLocaleString()}</span>
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
                  <span className="font-semibold">Total Cost:</span>
                  <span className="text-2xl font-bold text-primary">
                    LKR {subtotal.toLocaleString()}
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
                disabled={items.length === 0 || loading}
              >
                {loading ? (
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
