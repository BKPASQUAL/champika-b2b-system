// app/dashboard/admin/invoices/create/page.tsx
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

// --- Types ---

interface Product {
  id: string;
  sku: string;
  name: string;
  selling_price: number;
  mrp: number;
  stock_quantity: number;
  unit_of_measure: string;
}

interface InvoiceItem {
  id: string;
  productId: string;
  sku: string;
  productName: string;
  quantity: number;
  freeQuantity: number;
  unit: string;
  mrp: number;
  unitPrice: number;
  discountPercent: number;
  discountAmount: number;
  total: number;
}

// --- Mock Data ---

const MOCK_PRODUCTS: Product[] = [
  {
    id: "P1",
    sku: "SKU-001",
    name: "Copper Wire 2.5mm",
    selling_price: 180,
    mrp: 200,
    stock_quantity: 500,
    unit_of_measure: "m",
  },
  {
    id: "P2",
    sku: "SKU-002",
    name: "PVC Pipe 4 inch",
    selling_price: 850,
    mrp: 900,
    stock_quantity: 120,
    unit_of_measure: "unit",
  },
  {
    id: "P3",
    sku: "SKU-003",
    name: "Cement 50kg",
    selling_price: 2900,
    mrp: 3000,
    stock_quantity: 45,
    unit_of_measure: "bag",
  },
  {
    id: "P4",
    sku: "SKU-004",
    name: "Orange Switch",
    selling_price: 450,
    mrp: 480,
    stock_quantity: 0,
    unit_of_measure: "unit",
  },
];

const MOCK_CUSTOMERS = [
  { id: "C1", name: "Saman Electronics" },
  { id: "C2", name: "City Hardware" },
  { id: "C3", name: "Lanka Traders" },
];

const MOCK_REPS = [
  { id: "R1", name: "Ajith Bandara" },
  { id: "R2", name: "Chathura Perera" },
  { id: "R3", name: "Dilshan Silva" },
];

export default function CreateInvoicePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  // Data State
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<{ id: string; name: string }[]>(
    []
  );
  const [reps, setReps] = useState<{ id: string; name: string }[]>([]);

  // Form State
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [invoiceDate, setInvoiceDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [invoiceNumber, setInvoiceNumber] = useState("INV-NEW");
  const [salesRepId, setSalesRepId] = useState<string>(""); // Added Sales Rep State

  // Extra Discount State
  const [extraDiscount, setExtraDiscount] = useState<number>(0);

  // Item State
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [productSearchOpen, setProductSearchOpen] = useState(false);

  // Current Item State
  const [currentItem, setCurrentItem] = useState({
    productId: "",
    sku: "",
    quantity: 1,
    freeQuantity: 0,
    unit: "",
    mrp: 0,
    unitPrice: 0,
    discountPercent: 0,
    stockAvailable: 0,
  });

  useEffect(() => {
    setTimeout(() => {
      setProducts(MOCK_PRODUCTS);
      setCustomers(MOCK_CUSTOMERS);
      setReps(MOCK_REPS);
      setLoading(false);
    }, 500);
  }, []);

  // --- Handlers ---

  const handleProductSelect = (productId: string) => {
    const product = products.find((p) => p.id === productId);
    if (product) {
      setCurrentItem({
        ...currentItem,
        productId: productId,
        sku: product.sku,
        mrp: product.mrp,
        unitPrice: product.selling_price,
        stockAvailable: product.stock_quantity,
        unit: product.unit_of_measure,
        quantity: 1,
        freeQuantity: 0,
        discountPercent: 0,
      });
      setProductSearchOpen(false);
    }
  };

  const handleDiscountChange = (newDiscount: number) => {
    setCurrentItem({
      ...currentItem,
      discountPercent: Math.min(100, Math.max(0, newDiscount)),
    });
  };

  const handleAddItem = () => {
    if (!currentItem.productId || currentItem.quantity <= 0) {
      alert("Please select a valid product and quantity.");
      return;
    }

    const totalReqQty = currentItem.quantity + currentItem.freeQuantity;
    if (totalReqQty > currentItem.stockAvailable) {
      alert(`Insufficient stock! Available: ${currentItem.stockAvailable}`);
      return;
    }

    const product = products.find((p) => p.id === currentItem.productId);
    if (!product) return;

    const grossTotal = currentItem.unitPrice * currentItem.quantity;
    const discountAmount = (grossTotal * currentItem.discountPercent) / 100;
    const netTotal = grossTotal - discountAmount;

    const newItem: InvoiceItem = {
      id: Date.now().toString(),
      productId: currentItem.productId,
      sku: product.sku,
      productName: product.name,
      unit: product.unit_of_measure,
      quantity: currentItem.quantity,
      freeQuantity: currentItem.freeQuantity,
      mrp: currentItem.mrp,
      unitPrice: currentItem.unitPrice,
      discountPercent: currentItem.discountPercent,
      discountAmount: discountAmount,
      total: netTotal,
    };

    setItems([...items, newItem]);

    setCurrentItem({
      productId: "",
      sku: "",
      quantity: 1,
      freeQuantity: 0,
      unit: "",
      mrp: 0,
      unitPrice: 0,
      discountPercent: 0,
      stockAvailable: 0,
    });
  };

  const handleRemoveItem = (id: string) => {
    setItems(items.filter((item) => item.id !== id));
  };

  const handleSaveInvoice = () => {
    if (!customerId) {
      alert("Please select a customer.");
      return;
    }
    if (!salesRepId) {
      alert("Please select a sales representative.");
      return;
    }
    if (items.length === 0) {
      alert("Please add items to the invoice.");
      return;
    }

    setLoading(true);

    const invoiceData = {
      customerId,
      salesRepId,
      items,
      invoiceNumber,
      subTotal: subtotal,
      extraDiscountPercent: extraDiscount,
      extraDiscountAmount: extraDiscountAmount,
      grandTotal: grandTotal,
    };

    console.log("Saving Invoice...", invoiceData);

    setTimeout(() => {
      setLoading(false);
      alert("Invoice Created Successfully!");
      router.push("/dashboard/admin/invoices");
    }, 1000);
  };

  // --- Totals Calculation ---
  const subtotal = items.reduce((sum, item) => sum + item.total, 0);
  const totalItemDiscount = items.reduce(
    (sum, item) => sum + item.discountAmount,
    0
  );
  const grossTotal = items.reduce(
    (sum, item) => sum + item.unitPrice * item.quantity,
    0
  );

  // Extra Discount Calculation
  const extraDiscountAmount = (subtotal * extraDiscount) / 100;
  const grandTotal = subtotal - extraDiscountAmount;

  const availableProducts = products.filter(
    (p) => !items.some((i) => i.productId === p.id)
  );

  const getSelectedProductName = () => {
    const p = products.find((prod) => prod.id === currentItem.productId);
    return p ? `${p.name}` : "Select product";
  };

  const currentDiscountAmt =
    (currentItem.unitPrice *
      currentItem.quantity *
      currentItem.discountPercent) /
    100;

  if (loading && products.length === 0) {
    return (
      <div className="flex justify-center items-center h-full min-h-64">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        <p className="text-lg text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 mx-auto">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push("/dashboard/admin/invoices")}
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight">
            New Customer Invoice
          </h1>
          <p className="text-muted-foreground mt-1">
            Create a new bill for a customer
          </p>
        </div>
        <Button
          onClick={handleSaveInvoice}
          disabled={items.length === 0 || loading}
        >
          {loading ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Save className="w-4 h-4 mr-2" />
          )}
          Save Invoice
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* LEFT COLUMN */}
        <div className="lg:col-span-2 space-y-6">
          {/* 1. Invoice Details */}
          <Card>
            <CardHeader>
              <CardTitle>Invoice Details</CardTitle>
              <CardDescription>
                Customer and billing information
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Customer</Label>
                  <Select
                    value={customerId || ""}
                    onValueChange={setCustomerId}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select Customer" />
                    </SelectTrigger>
                    <SelectContent>
                      {customers.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Invoice Date</Label>
                  <Input
                    type="date"
                    value={invoiceDate}
                    onChange={(e) => setInvoiceDate(e.target.value)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Invoice No (Auto)</Label>
                  <Input value={invoiceNumber} disabled className="bg-muted" />
                </div>

                {/* Replaced Due Date with Sales Representative Dropdown */}
                <div className="space-y-2">
                  <Label>Sales Representative</Label>
                  <Select value={salesRepId} onValueChange={setSalesRepId}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select Representative" />
                    </SelectTrigger>
                    <SelectContent>
                      {reps.map((r) => (
                        <SelectItem key={r.id} value={r.id}>
                          {r.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 2. Add Items */}
          <Card>
            <CardHeader>
              <CardTitle>Add Items</CardTitle>
              <CardDescription>Select products to bill</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="w-full">
                  <Label className="mb-2 block">Product Search</Label>
                  <Popover
                    open={productSearchOpen}
                    onOpenChange={setProductSearchOpen}
                  >
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        className="w-full justify-between"
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
                        <CommandInput placeholder="Search product..." />
                        <CommandList>
                          <CommandEmpty>No product found.</CommandEmpty>
                          <CommandGroup>
                            {availableProducts.length === 0 ? (
                              <div className="p-4 text-center text-sm text-muted-foreground">
                                All products added
                              </div>
                            ) : (
                              availableProducts.map((product) => (
                                <CommandItem
                                  key={product.id}
                                  value={`${product.name} ${product.sku}`}
                                  onSelect={() =>
                                    handleProductSelect(product.id)
                                  }
                                  disabled={product.stock_quantity === 0}
                                  className={
                                    product.stock_quantity === 0
                                      ? "opacity-50"
                                      : ""
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
                                      Code: {product.sku} | Stock:{" "}
                                      {product.stock_quantity}{" "}
                                      {product.unit_of_measure}
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

                {/* Input Row */}
                <div className="grid grid-cols-2 md:grid-cols-6 gap-3 items-end">
                  <div className="col-span-1">
                    <Label className="mb-2 block text-xs">Code</Label>
                    <Input
                      value={currentItem.sku}
                      disabled
                      className="h-9 bg-muted"
                      placeholder="Auto"
                    />
                  </div>
                  <div className="col-span-1">
                    <Label className="mb-2 block text-xs">MRP</Label>
                    <Input
                      value={currentItem.mrp}
                      disabled
                      className="h-9 bg-muted"
                    />
                  </div>
                  <div className="col-span-1">
                    <Label className="mb-2 block text-xs font-semibold text-blue-600">
                      Price
                    </Label>
                    <Input
                      type="number"
                      value={currentItem.unitPrice}
                      onChange={(e) =>
                        setCurrentItem({
                          ...currentItem,
                          unitPrice: parseFloat(e.target.value) || 0,
                        })
                      }
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
                    <Label className="mb-2 block text-xs">Unit</Label>
                    <Input
                      value={currentItem.unit}
                      disabled
                      className="h-9 bg-muted"
                      placeholder="Unit"
                    />
                  </div>

                  <div className="col-span-1">
                    <Label className="mb-2 block text-xs text-muted-foreground">
                      Stock: {currentItem.stockAvailable}
                    </Label>
                    <Input
                      value={currentItem.stockAvailable}
                      disabled
                      className="h-9 bg-muted"
                    />
                  </div>

                  <div className="col-span-1">
                    <Label className="mb-2 block text-xs">Disc (%)</Label>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      value={currentItem.discountPercent}
                      onChange={(e) =>
                        handleDiscountChange(parseFloat(e.target.value) || 0)
                      }
                      className="h-9"
                    />
                  </div>
                  <div className="col-span-1">
                    <Label className="mb-2 block text-xs">D. Amount</Label>
                    <Input
                      value={currentDiscountAmt.toFixed(2)}
                      disabled
                      className="h-9 bg-muted"
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
                          freeQuantity: parseInt(e.target.value) || 0,
                        })
                      }
                      className="h-9 border-green-200"
                    />
                  </div>
                  <div className="col-span-3 md:col-span-3">
                    <Button
                      onClick={handleAddItem}
                      className="w-full h-9"
                      disabled={!currentItem.productId}
                    >
                      <Plus className="w-4 h-4 mr-2" /> Add Item
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 3. Item List Table */}
          <Card>
            <CardHeader>
              <CardTitle>Invoice Items</CardTitle>
              <CardDescription>Items included in this bill</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Code</TableHead>
                      <TableHead>Item Name</TableHead>
                      <TableHead className="text-right">Unit</TableHead>
                      <TableHead className="text-right">MRP</TableHead>
                      <TableHead className="text-right">Price</TableHead>
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
                          colSpan={10}
                          className="text-center py-8 text-muted-foreground"
                        >
                          No items added
                        </TableCell>
                      </TableRow>
                    ) : (
                      items.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-mono text-xs">
                            {item.sku}
                          </TableCell>
                          <TableCell className="font-medium">
                            {item.productName}
                          </TableCell>
                          <TableCell className="text-right">
                            {item.unit}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {item.mrp}
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
                            {item.discountPercent > 0
                              ? `${item.discountPercent}%`
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
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* RIGHT COLUMN */}
        <div className="lg:col-span-1">
          <Card className="sticky top-6">
            <CardHeader>
              <CardTitle>Invoice Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Customer:</span>
                  <span className="font-medium">
                    {customers.find((c) => c.id === customerId)?.name || "-"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Date:</span>
                  <span className="font-medium">{invoiceDate}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status:</span>
                  <span className="text-red-600 font-medium">Unpaid</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Items:</span>
                  <span className="font-medium">{items.length}</span>
                </div>
              </div>

              <div className="border-t pt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Gross Total:</span>
                  <span>LKR {grossTotal.toLocaleString()}</span>
                </div>
                {totalItemDiscount > 0 && (
                  <div className="flex justify-between text-sm text-green-600">
                    <span>Item Discount:</span>
                    <span>- LKR {totalItemDiscount.toLocaleString()}</span>
                  </div>
                )}

                <div className="flex justify-between text-sm font-medium pt-1">
                  <span>Subtotal:</span>
                  <span>LKR {subtotal.toLocaleString()}</span>
                </div>

                {/* Extra Discount Section */}
                <div className="flex items-center justify-between text-sm pt-2">
                  <span className="text-muted-foreground">Extra Disc (%):</span>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={extraDiscount}
                    onChange={(e) =>
                      setExtraDiscount(parseFloat(e.target.value) || 0)
                    }
                    className="w-20 h-8 text-right"
                  />
                </div>
                {extraDiscount > 0 && (
                  <div className="flex justify-between text-sm text-green-600">
                    <span>Extra Disc Amt:</span>
                    <span>
                      - LKR{" "}
                      {extraDiscountAmount.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                )}

                {/* Final Grand Total */}
                <div className="flex justify-between items-center pt-2 border-t mt-2">
                  <span className="font-bold text-lg">Grand Total:</span>
                  <span className="font-bold text-2xl text-primary">
                    LKR{" "}
                    {grandTotal.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                </div>
              </div>

              <Button
                onClick={handleSaveInvoice}
                className="w-full h-12 text-lg"
                disabled={items.length === 0 || loading}
              >
                {loading ? "Processing..." : "Create Invoice"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
