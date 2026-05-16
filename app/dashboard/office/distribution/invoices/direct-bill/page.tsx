"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { invalidatePaymentCaches } from "@/hooks/useCachedFetch";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Save,
  Package,
  Loader2,
  Check,
  ChevronsUpDown,
  AlertTriangle,
  Receipt,
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
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import { BUSINESS_IDS } from "@/app/config/business-constants";
import { getUserBusinessContext } from "@/app/middleware/businessAuth";

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
  originalPrice: number;
  discountPercent: number;
  discountAmount: number;
  total: number;
}

export default function DirectBillPage() {
  const router = useRouter();
  const distributionBusinessId = BUSINESS_IDS.CHAMPIKA_DISTRIBUTION;

  const [loading, setLoading] = useState(true);
  const [stockLoading, setStockLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Current logged-in user acts as the sales rep for direct bills
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [currentUserName, setCurrentUserName] = useState<string>("");

  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<{ id: string; name: string }[]>([]);

  // Form State
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [invoiceDate, setInvoiceDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [invoiceNumber] = useState("CHD-AUTO");

  // Items State
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [extraDiscount, setExtraDiscount] = useState<string>("");

  // Popover States
  const [customerOpen, setCustomerOpen] = useState(false);
  const [productOpen, setProductOpen] = useState(false);

  const [currentItem, setCurrentItem] = useState({
    productId: "",
    sku: "",
    quantity: "",
    freeQuantity: "",
    unit: "",
    mrp: 0,
    unitPrice: 0,
    discountPercent: "",
    stockAvailable: 0,
  });

  const qtyInputRef = useRef<HTMLInputElement>(null);

  // Keyboard shortcut: Shift+F to open product search
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.shiftKey && (e.key === "f" || e.key === "F")) {
        e.preventDefault();
        const triggers = document.querySelectorAll('button[role="combobox"]');
        if (triggers && triggers.length > 1) {
          (triggers[1] as HTMLElement).click();
        }
      }
    };
    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, []);

  // Resolve current logged-in user
  useEffect(() => {
    const user = getUserBusinessContext();
    if (user?.id) {
      setCurrentUserId(user.id);
      setCurrentUserName(user.name || "Distribution Office");
    }
  }, []);

  // Fetch customers
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/customers?businessId=${distributionBusinessId}`);
        const data = await res.json();
        setCustomers(data.map((c: any) => ({ id: c.id, name: c.shopName })));
      } catch {
        toast.error("Failed to load customers");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [distributionBusinessId]);

  // Fetch all active products
  useEffect(() => {
    const fetchProducts = async () => {
      setStockLoading(true);
      try {
        const res = await fetch("/api/products?active=true");
        if (!res.ok) throw new Error();
        const data = await res.json();
        setProducts(
          data
            .filter((p: any) => p.subCategory !== "Retail Exclusive" && !p.retailOnly)
            .map((p: any) => ({
              id: p.id,
              sku: p.sku || "N/A",
              name: p.name,
              selling_price: p.sellingPrice || 0,
              mrp: p.mrp || 0,
              stock_quantity: p.stock || 0,
              unit_of_measure: p.unitOfMeasure || "unit",
            }))
        );
      } catch {
        toast.error("Failed to load products");
        setProducts([]);
      } finally {
        setStockLoading(false);
      }
    };
    fetchProducts();
  }, []);

  // Product Selection
  const handleProductSelect = (productId: string) => {
    const product = products.find((p) => p.id === productId);
    if (!product) return;
    setCurrentItem({
      productId: product.id,
      sku: product.sku,
      quantity: "",
      freeQuantity: "",
      unit: product.unit_of_measure,
      mrp: product.mrp,
      unitPrice: product.selling_price,
      discountPercent: "",
      stockAvailable: product.stock_quantity,
    });
    setTimeout(() => qtyInputRef.current?.focus(), 100);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddItem();
    }
  };

  // Add Item
  const handleAddItem = () => {
    const qty = parseFloat(currentItem.quantity);
    const free = parseFloat(currentItem.freeQuantity) || 0;
    const discPerc = parseFloat(currentItem.discountPercent) || 0;

    if (!currentItem.productId) {
      toast.error("Please select a product");
      return;
    }
    if (!qty || qty <= 0) {
      toast.error("Quantity must be greater than 0");
      return;
    }

    const product = products.find((p) => p.id === currentItem.productId);
    if (!product) return;

    const grossTotal = currentItem.unitPrice * qty;
    const discountAmount = (grossTotal * discPerc) / 100;
    const netTotal = grossTotal - discountAmount;

    const newItem: InvoiceItem = {
      id: Date.now().toString(),
      productId: currentItem.productId,
      sku: product.sku,
      productName: product.name,
      unit: product.unit_of_measure,
      quantity: qty,
      freeQuantity: free,
      mrp: currentItem.mrp,
      unitPrice: currentItem.unitPrice,
      originalPrice: product.selling_price,
      discountPercent: discPerc,
      discountAmount,
      total: netTotal,
    };

    setItems([...items, newItem]);
    setCurrentItem({
      productId: "",
      sku: "",
      quantity: "",
      freeQuantity: "",
      unit: "",
      mrp: 0,
      unitPrice: 0,
      discountPercent: "",
      stockAvailable: 0,
    });
  };

  const handleRemoveItem = (id: string) => {
    setItems(items.filter((item) => item.id !== id));
  };

  // Totals
  const subtotal = items.reduce((sum, item) => sum + item.total, 0);
  const totalItemDiscount = items.reduce((sum, item) => sum + item.discountAmount, 0);
  const grossTotal = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const extraDiscPercVal = parseFloat(extraDiscount) || 0;
  const extraDiscountAmount = (subtotal * extraDiscPercVal) / 100;
  const grandTotal = Math.max(0, subtotal - extraDiscountAmount);

  // Save
  const handleSaveInvoice = async () => {
    if (!customerId) {
      toast.error("Please select a customer.");
      return;
    }
    if (!currentUserId) {
      toast.error("Unable to determine current user. Please re-login.");
      return;
    }
    if (items.length === 0) {
      toast.error("Please add items to the bill.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId: distributionBusinessId,
          customerId,
          salesRepId: currentUserId,
          items,
          invoiceDate,
          subTotal: subtotal,
          extraDiscountPercent: extraDiscPercVal,
          extraDiscountAmount,
          grandTotal,
          orderStatus: "Delivered",  // always Delivered for direct bills
          paymentStatus: "Unpaid",
          paidAmount: 0,
          performedByName: currentUserName,
          performedByEmail: null,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create bill");

      toast.success(`Direct Bill ${data.invoiceNo} created successfully!`);
      invalidatePaymentCaches();
      router.push("/dashboard/office/distribution/invoices");
    } catch (error: any) {
      toast.error(error.message || "Failed to create bill");
    } finally {
      setSubmitting(false);
    }
  };

  const availableProducts = products.filter(
    (p) => !items.some((i) => i.productId === p.id)
  );

  const qtyNum = parseFloat(currentItem.quantity) || 0;
  const discPercNum = parseFloat(currentItem.discountPercent) || 0;
  const currentDiscountAmt = (currentItem.unitPrice * qtyNum * discPercNum) / 100;
  const currentTotal = currentItem.unitPrice * qtyNum - currentDiscountAmt;

  if (loading && customers.length === 0) {
    return (
      <div className="flex justify-center items-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4 mx-auto pb-20">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push("/dashboard/office/distribution/invoices")}
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight text-blue-900">
              Direct Bill
            </h1>
            <Badge className="bg-green-100 text-green-800 border-green-200 text-xs font-semibold">
              Delivered
            </Badge>
          </div>
          <p className="text-muted-foreground mt-1 text-sm">
            Create a direct distribution bill · order status locked to Delivered
          </p>
        </div>
        <Button
          onClick={handleSaveInvoice}
          disabled={items.length === 0 || submitting}
          className="bg-blue-600 hover:bg-blue-700"
        >
          {submitting ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Receipt className="w-4 h-4 mr-2" />
          )}
          Create Bill
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* LEFT COLUMN */}
        <div className="lg:col-span-2 space-y-6">
          {/* 1. Bill Details */}
          <Card>
            <CardHeader>
              <CardTitle>Bill Details</CardTitle>
              <CardDescription>Customer and billing information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {/* Customer */}
                <div className="space-y-2">
                  <Label>Customer <span className="text-red-500">*</span></Label>
                  <Popover open={customerOpen} onOpenChange={setCustomerOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={customerOpen}
                        className="w-full justify-between"
                      >
                        {customerId
                          ? customers.find((c) => c.id === customerId)?.name
                          : "Select Customer"}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Search customer..." />
                        <CommandList>
                          <CommandEmpty>No customer found.</CommandEmpty>
                          <CommandGroup>
                            {customers.map((customer) => (
                              <CommandItem
                                key={customer.id}
                                value={customer.name}
                                onSelect={() => {
                                  setCustomerId(customer.id);
                                  setCustomerOpen(false);
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    customerId === customer.id ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                {customer.name}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Date */}
                <div className="space-y-2">
                  <Label>Bill Date</Label>
                  <Input
                    type="date"
                    value={invoiceDate}
                    onChange={(e) => setInvoiceDate(e.target.value)}
                  />
                </div>
              </div>

              {/* Invoice No (auto) + Order Status (locked) */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Invoice No (Auto-generated)</Label>
                  <Input value={invoiceNumber} disabled className="bg-muted" />
                </div>
                <div className="space-y-2">
                  <Label>Order Status</Label>
                  <div className="flex items-center h-10 px-3 rounded-md border bg-green-50 border-green-200 gap-2">
                    <span className="h-2 w-2 rounded-full bg-green-500 shrink-0" />
                    <span className="text-sm font-medium text-green-800">Delivered</span>
                    <span className="text-xs text-green-600 ml-auto">(Direct bill)</span>
                  </div>
                </div>
              </div>

              {/* Created by (read-only info) */}
              <div className="space-y-2">
                <Label>Created By</Label>
                <Input value={currentUserName || "Loading..."} disabled className="bg-muted" />
              </div>
            </CardContent>
          </Card>

          {/* 2. Add Products */}
          <Card>
            <CardHeader>
              <CardTitle>Add Products</CardTitle>
              <CardDescription>
                Search and add products · <kbd className="text-[10px] bg-muted px-1 rounded">Shift+F</kbd> to open search
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-4 gap-4">
                <div className="col-span-4 space-y-2">
                  <Label>
                    Product{" "}
                    {stockLoading && (
                      <Loader2 className="inline h-3 w-3 animate-spin ml-2" />
                    )}
                  </Label>
                  <Popover open={productOpen} onOpenChange={setProductOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={productOpen}
                        className="w-full justify-between"
                        disabled={stockLoading}
                      >
                        {currentItem.productId
                          ? products.find((p) => p.id === currentItem.productId)?.name
                          : stockLoading
                          ? "Loading products..."
                          : "Select Product"}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Search product..." />
                        <CommandList>
                          <CommandEmpty>No products found.</CommandEmpty>
                          <CommandGroup>
                            {availableProducts.map((product) => (
                              <CommandItem
                                key={product.id}
                                value={product.name}
                                onSelect={() => {
                                  handleProductSelect(product.id);
                                  setProductOpen(false);
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    currentItem.productId === product.id ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                <div className="flex-1">
                                  <div className="font-medium">{product.name}</div>
                                  <div className="text-xs text-muted-foreground">
                                    {product.sku} · Stock: {product.stock_quantity} · LKR {product.selling_price}
                                  </div>
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label>Quantity</Label>
                  <Input
                    ref={qtyInputRef}
                    type="number"
                    min="1"
                    placeholder="Qty"
                    value={currentItem.quantity}
                    onChange={(e) => setCurrentItem({ ...currentItem, quantity: e.target.value })}
                    onKeyDown={handleKeyDown}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Free Qty</Label>
                  <Input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={currentItem.freeQuantity}
                    onChange={(e) => setCurrentItem({ ...currentItem, freeQuantity: e.target.value })}
                    onKeyDown={handleKeyDown}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Unit</Label>
                  <Input value={currentItem.unit || "-"} disabled className="bg-muted" />
                </div>
                <div className="space-y-2">
                  <Label>Stock</Label>
                  <Input
                    value={currentItem.stockAvailable || "-"}
                    disabled
                    className={
                      currentItem.stockAvailable > 0 && currentItem.stockAvailable < 10
                        ? "text-destructive font-bold bg-muted"
                        : "bg-muted"
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label>MRP</Label>
                  <Input
                    type="number"
                    value={currentItem.mrp || ""}
                    onChange={(e) => setCurrentItem({ ...currentItem, mrp: Number(e.target.value) })}
                    onKeyDown={handleKeyDown}
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Unit Price</Label>
                  <Input
                    type="number"
                    value={currentItem.unitPrice || ""}
                    onChange={(e) => setCurrentItem({ ...currentItem, unitPrice: Number(e.target.value) })}
                    onKeyDown={handleKeyDown}
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Discount %</Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    placeholder="0"
                    value={currentItem.discountPercent || ""}
                    onChange={(e) => setCurrentItem({ ...currentItem, discountPercent: e.target.value })}
                    onKeyDown={handleKeyDown}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Total</Label>
                  <Input value={currentTotal.toFixed(2)} disabled className="font-bold bg-muted" />
                </div>
              </div>

              <Button
                onClick={handleAddItem}
                className="w-full bg-blue-600 hover:bg-blue-700"
                disabled={!currentItem.productId}
              >
                <Plus className="w-4 h-4 mr-2" />
                Add to Bill
              </Button>
            </CardContent>
          </Card>

          {/* 3. Items Table */}
          <Card>
            <CardHeader>
              <CardTitle>Bill Items</CardTitle>
              <CardDescription>{items.length} item(s) added</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead className="text-center w-20">Qty</TableHead>
                      <TableHead className="text-center w-20">Free</TableHead>
                      <TableHead className="text-right w-24">Unit Price</TableHead>
                      <TableHead className="text-center w-20">Disc%</TableHead>
                      <TableHead className="text-right w-28">Total</TableHead>
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                          <Package className="w-8 h-8 mx-auto mb-2 opacity-50" />
                          No items added yet
                        </TableCell>
                      </TableRow>
                    ) : (
                      items.map((item, idx) => {
                        const priceChanged = item.unitPrice !== item.originalPrice;
                        const hasDiscount = item.discountPercent > 0;
                        const isModified = priceChanged || hasDiscount;
                        return (
                          <TableRow
                            key={item.id}
                            className={isModified ? "bg-red-50 hover:bg-red-100" : ""}
                          >
                            <TableCell>{idx + 1}</TableCell>
                            <TableCell>
                              <div className="font-medium flex items-center gap-2">
                                {item.productName}
                                {isModified && (
                                  <span className="text-[10px] bg-red-100 text-red-600 border border-red-200 rounded px-1 py-0.5 font-semibold">
                                    Modified
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-muted-foreground">{item.sku}</div>
                            </TableCell>
                            <TableCell className="text-center">{item.quantity} {item.unit}</TableCell>
                            <TableCell className="text-center">{item.freeQuantity || "-"}</TableCell>
                            <TableCell className="text-right">
                              {priceChanged ? (
                                <div>
                                  <div className="font-semibold text-red-600">{item.unitPrice.toLocaleString()}</div>
                                  <div className="text-xs text-muted-foreground line-through">{item.originalPrice.toLocaleString()}</div>
                                </div>
                              ) : (
                                item.unitPrice.toLocaleString()
                              )}
                            </TableCell>
                            <TableCell className="text-center">
                              {hasDiscount ? (
                                <span className="font-semibold text-red-600">{item.discountPercent}%</span>
                              ) : "-"}
                            </TableCell>
                            <TableCell className="text-right font-bold">{item.total.toLocaleString()}</TableCell>
                            <TableCell>
                              <Button variant="ghost" size="icon" onClick={() => handleRemoveItem(item.id)}>
                                <Trash2 className="w-4 h-4 text-destructive" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* RIGHT COLUMN — Summary */}
        <div className="lg:col-span-1">
          <Card className="sticky top-6">
            <CardHeader>
              <CardTitle>Bill Summary</CardTitle>
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
                  <span className="text-muted-foreground">Bill Date:</span>
                  <span className="font-medium">{invoiceDate}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Order Status:</span>
                  <span className="font-semibold text-green-700">Delivered</span>
                </div>
              </div>

              <div className="border-t pt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Items:</span>
                  <span>{items.length}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Gross Total:</span>
                  <span>LKR {grossTotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Item Discounts:</span>
                  <span className="text-destructive">- LKR {totalItemDiscount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm font-medium">
                  <span>Subtotal:</span>
                  <span>LKR {subtotal.toLocaleString()}</span>
                </div>
              </div>

              <div className="border-t pt-4 space-y-3">
                <div className="space-y-2">
                  <Label className="text-xs">Extra Discount %</Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    placeholder="0%"
                    value={extraDiscount}
                    onChange={(e) => setExtraDiscount(e.target.value)}
                  />
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Extra Discount:</span>
                  <span className="text-destructive">- LKR {extraDiscountAmount.toLocaleString()}</span>
                </div>
              </div>

              <div className="border-t pt-4">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-bold">Grand Total:</span>
                  <span className="text-2xl font-bold text-blue-600">
                    LKR {grandTotal.toLocaleString()}
                  </span>
                </div>
              </div>

              <Button
                onClick={handleSaveInvoice}
                disabled={items.length === 0 || submitting}
                className="w-full bg-blue-600 hover:bg-blue-700 mt-2"
                size="lg"
              >
                {submitting ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Receipt className="w-4 h-4 mr-2" />
                )}
                Create Bill
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
