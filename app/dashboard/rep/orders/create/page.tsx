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
  User,
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

interface OrderItem {
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

interface UserData {
  id: string;
  name: string;
  email: string;
  role: string;
}

export default function CreateOrderPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Data State
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<{ id: string; name: string }[]>(
    []
  );

  // User State (For actual login info)
  const [currentUser, setCurrentUser] = useState<UserData | null>(null);

  // Form State
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [orderDate, setOrderDate] = useState(
    new Date().toISOString().split("T")[0]
  );

  // Items State
  const [items, setItems] = useState<OrderItem[]>([]);
  const [extraDiscount, setExtraDiscount] = useState<number>(0);

  // Popover States
  const [customerOpen, setCustomerOpen] = useState(false);
  const [productOpen, setProductOpen] = useState(false);

  // Current Item Being Added
  const [currentItem, setCurrentItem] = useState({
    productId: "",
    sku: "",
    quantity: 0, // CHANGED: Initialized to 0 so it shows as empty
    freeQuantity: 0,
    unit: "",
    mrp: 0,
    unitPrice: 0,
    discountPercent: 0,
    stockAvailable: 0,
  });

  // --- Fetch Data on Mount ---
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // 1. Load Current User from Local Storage
        if (typeof window !== "undefined") {
          const storedUser = localStorage.getItem("currentUser");
          if (storedUser) {
            setCurrentUser(JSON.parse(storedUser));
          }
        }

        // 2. Fetch Products
        const productsRes = await fetch("/api/products");
        const productsData = await productsRes.json();
        setProducts(
          productsData.map((p: any) => ({
            id: p.id,
            sku: p.sku,
            name: p.name,
            selling_price: p.sellingPrice,
            mrp: p.mrp,
            stock_quantity: p.stock,
            unit_of_measure: p.unitOfMeasure || "unit",
          }))
        );

        // 3. Fetch Customers
        const customersRes = await fetch("/api/customers");
        const customersData = await customersRes.json();
        setCustomers(
          customersData.map((c: any) => ({
            id: c.id,
            name: c.shopName,
          }))
        );
      } catch (error) {
        console.error("Error fetching data:", error);
        toast.error("Failed to load data");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // --- Product Selection Handler ---
  const handleProductSelect = (productId: string) => {
    const product = products.find((p) => p.id === productId);
    if (!product) return;

    setCurrentItem({
      productId: product.id,
      sku: product.sku,
      quantity: 0, // CHANGED: Reset to 0 on selection
      freeQuantity: 0,
      unit: product.unit_of_measure,
      mrp: product.mrp,
      unitPrice: product.selling_price,
      discountPercent: 0,
      stockAvailable: product.stock_quantity,
    });
    setProductOpen(false);
  };

  // --- Add Item to Order ---
  const handleAddItem = () => {
    if (!currentItem.productId) {
      toast.error("Please select a product");
      return;
    }

    if (currentItem.quantity <= 0) {
      toast.error("Quantity must be at least 1");
      return;
    }

    const totalReqQty = currentItem.quantity + currentItem.freeQuantity;
    if (totalReqQty > currentItem.stockAvailable) {
      toast.error(
        `Insufficient stock! Available: ${currentItem.stockAvailable}`
      );
      return;
    }

    const product = products.find((p) => p.id === currentItem.productId);
    if (!product) return;

    const grossTotal = currentItem.unitPrice * currentItem.quantity;
    const discountAmount = (grossTotal * currentItem.discountPercent) / 100;
    const netTotal = grossTotal - discountAmount;

    const newItem: OrderItem = {
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

    // Reset Item Form
    setCurrentItem({
      productId: "",
      sku: "",
      quantity: 0, // CHANGED: Reset to 0 after adding
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

  const handleSaveOrder = async () => {
    if (!customerId) {
      toast.error("Please select a customer.");
      return;
    }
    if (items.length === 0) {
      toast.error("Please add items to the order.");
      return;
    }
    if (!currentUser?.id) {
      toast.error("User session invalid. Please re-login.");
      return;
    }

    setSubmitting(true);

    const orderData = {
      customerId,
      salesRepId: currentUser.id, // <--- USING ACTUAL LOGIN ID
      invoiceDate: orderDate,
      orderStatus: "Pending",
      items,
      subTotal: subtotal,
      extraDiscountPercent: extraDiscount,
      extraDiscountAmount: extraDiscountAmount,
      grandTotal: grandTotal,
      notes: "Created via Rep Portal",
    };

    try {
      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(orderData),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to place order");
      }

      toast.success("Order Placed Successfully!");
      router.push("/dashboard/rep");
    } catch (error: any) {
      toast.error(error.message || "Failed to create order");
    } finally {
      setSubmitting(false);
    }
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

  const extraDiscountAmount = (subtotal * extraDiscount) / 100;
  const grandTotal = subtotal - extraDiscountAmount;

  const availableProducts = products.filter(
    (p) => !items.some((i) => i.productId === p.id)
  );

  const currentDiscountAmt =
    (currentItem.unitPrice *
      currentItem.quantity *
      currentItem.discountPercent) /
    100;

  if (loading) {
    return (
      <div className="flex justify-center items-center h-full min-h-64">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        <p className="text-lg text-muted-foreground">Loading Catalog...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 mx-auto pb-10">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push("/dashboard/rep")}
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight">New Sales Order</h1>
          <p className="text-muted-foreground mt-1">
            Create a new order for your customer
          </p>
        </div>
        <Button
          onClick={handleSaveOrder}
          disabled={items.length === 0 || submitting}
          className="bg-black hover:bg-gray-800 text-white"
        >
          {submitting ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Save className="w-4 h-4 mr-2" />
          )}
          Place Order
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* LEFT COLUMN */}
        <div className="lg:col-span-2 space-y-6">
          {/* 1. Order Details */}
          <Card>
            <CardHeader>
              <CardTitle>Customer Details</CardTitle>
              <CardDescription>
                Select the customer for this order
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Customer Select */}
                <div className="space-y-2">
                  <Label>Select Customer</Label>
                  <Popover open={customerOpen} onOpenChange={setCustomerOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={customerOpen}
                        className="w-full justify-between h-11"
                      >
                        {customerId
                          ? customers.find((c) => c.id === customerId)?.name
                          : "Search Customer..."}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      className="w-[var(--radix-popover-trigger-width)] p-0"
                      align="start"
                    >
                      <Command className="bg-blue-50">
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
                                className="data-[selected=true]:bg-blue-50 data-[selected=true]:text-blue-900"
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    customerId === customer.id
                                      ? "opacity-100"
                                      : "opacity-0"
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

                {/* Order Date */}
                <div className="space-y-2">
                  <Label>Order Date</Label>
                  <Input
                    type="date"
                    value={orderDate}
                    onChange={(e) => setOrderDate(e.target.value)}
                    className="h-11"
                  />
                </div>
              </div>

              {/* Dynamic User Info Row */}
              <div className="grid grid-cols-2 gap-4 pt-2">
                <div className="flex items-center gap-3 p-3 rounded-md border bg-muted/20">
                  <User className="h-5 w-5 text-muted-foreground" />
                  <div className="flex flex-col">
                    <span className="text-xs text-muted-foreground uppercase">
                      Sales Rep
                    </span>
                    {/* Display Real User Name */}
                    <span className="font-medium text-sm">
                      {currentUser ? currentUser.name : "Loading..."}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-md border bg-muted/20">
                  <Package className="h-5 w-5 text-muted-foreground" />
                  <div className="flex flex-col">
                    <span className="text-xs text-muted-foreground uppercase">
                      Order Status
                    </span>
                    <span className="font-medium text-sm text-yellow-600">
                      Pending Approval
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 2. Add Items */}
          <Card>
            <CardHeader>
              <CardTitle>Add Products</CardTitle>
              <CardDescription>Select items from the catalog</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Product Selection */}
              <div className="space-y-2">
                <Label>Product</Label>
                <Popover open={productOpen} onOpenChange={setProductOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={productOpen}
                      className="w-full justify-between h-11"
                    >
                      {currentItem.productId
                        ? products.find((p) => p.id === currentItem.productId)
                            ?.name
                        : "Select Product"}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    className="w-[var(--radix-popover-trigger-width)] p-0"
                    align="start"
                  >
                    <Command className="bg-blue-50">
                      <CommandInput placeholder="Search product by name or SKU..." />
                      <CommandList>
                        <CommandEmpty>No product found.</CommandEmpty>
                        <CommandGroup>
                          {availableProducts.map((product) => (
                            <CommandItem
                              key={product.id}
                              value={product.name}
                              onSelect={() => {
                                handleProductSelect(product.id);
                              }}
                              className="data-[selected=true]:bg-blue-50 data-[selected=true]:text-blue-900"
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  currentItem.productId === product.id
                                    ? "opacity-100"
                                    : "opacity-0"
                                )}
                              />
                              <div className="flex-1">
                                <div className="font-medium">
                                  {product.name}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {product.sku} • Stock:{" "}
                                  {product.stock_quantity} • LKR{" "}
                                  {product.selling_price}
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

              {/* Quantity & Pricing Inputs */}
              <div className="grid grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label>Quantity</Label>
                  <Input
                    type="number"
                    min="1"
                    className="h-10"
                    placeholder="0"
                    value={
                      currentItem.quantity === 0 ? "" : currentItem.quantity
                    }
                    onChange={(e) =>
                      setCurrentItem({
                        ...currentItem,
                        quantity: Number(e.target.value),
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Free Qty</Label>
                  <Input
                    type="number"
                    min="0"
                    className="h-10"
                    placeholder="0"
                    value={
                      currentItem.freeQuantity === 0
                        ? ""
                        : currentItem.freeQuantity
                    }
                    onChange={(e) =>
                      setCurrentItem({
                        ...currentItem,
                        freeQuantity: Number(e.target.value),
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Unit</Label>
                  <Input
                    value={currentItem.unit || "-"}
                    disabled
                    className="bg-muted h-10"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Stock</Label>
                  <Input
                    value={currentItem.stockAvailable || "-"}
                    disabled
                    className={
                      currentItem.stockAvailable > 0 &&
                      currentItem.stockAvailable < 10
                        ? "text-destructive font-bold bg-muted h-10"
                        : "bg-muted h-10"
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label>Unit Price</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={
                      currentItem.unitPrice === 0 ? "" : currentItem.unitPrice
                    }
                    onChange={(e) =>
                      setCurrentItem({
                        ...currentItem,
                        unitPrice: Number(e.target.value),
                      })
                    }
                    placeholder="0.00"
                    className="h-10"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Discount %</Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={
                      currentItem.discountPercent === 0
                        ? ""
                        : currentItem.discountPercent
                    }
                    onChange={(e) =>
                      setCurrentItem({
                        ...currentItem,
                        discountPercent: Number(e.target.value),
                      })
                    }
                    placeholder="0"
                    className="h-10"
                  />
                </div>
                <div className="space-y-2 col-span-2">
                  <Label>Line Total</Label>
                  <Input
                    value={(
                      currentItem.unitPrice * currentItem.quantity -
                      currentDiscountAmt
                    ).toFixed(2)}
                    disabled
                    className="font-bold bg-muted h-10 text-right"
                  />
                </div>
              </div>

              <Button
                onClick={handleAddItem}
                className="w-full h-11 text-base bg-black hover:bg-gray-800 text-white"
                disabled={!currentItem.productId}
              >
                <Plus className="w-5 h-5 mr-2" />
                Add to Order
              </Button>
            </CardContent>
          </Card>

          {/* 3. Items Table */}
          <Card>
            <CardHeader>
              <CardTitle>Order Items</CardTitle>
              <CardDescription>{items.length} item(s) added</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead className="text-center w-20">Qty</TableHead>
                      <TableHead className="text-center w-20">Free</TableHead>
                      <TableHead className="text-right w-24">Price</TableHead>
                      <TableHead className="text-center w-16">Disc%</TableHead>
                      <TableHead className="text-right w-28">Total</TableHead>
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={7}
                          className="text-center text-muted-foreground py-8"
                        >
                          <Package className="w-8 h-8 mx-auto mb-2 opacity-50" />
                          No items added yet
                        </TableCell>
                      </TableRow>
                    ) : (
                      items.map((item, idx) => (
                        <TableRow key={item.id}>
                          <TableCell>
                            <div className="font-medium">
                              {item.productName}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {item.sku}
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            {item.quantity}
                          </TableCell>
                          <TableCell className="text-center">
                            {item.freeQuantity || "-"}
                          </TableCell>
                          <TableCell className="text-right">
                            {item.unitPrice.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-center">
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
              <CardTitle>Summary</CardTitle>
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
                  <span className="font-medium">{orderDate}</span>
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
                  <span className="text-muted-foreground">Discounts:</span>
                  <span className="text-destructive">
                    - LKR {totalItemDiscount.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between text-sm font-medium">
                  <span>Subtotal:</span>
                  <span>LKR {subtotal.toLocaleString()}</span>
                </div>
              </div>

              <div className="border-t pt-4 space-y-3">
                <div className="space-y-2">
                  <Label className="text-xs ">Extra Discount %</Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={extraDiscount === 0 ? "" : extraDiscount}
                    onChange={(e) => setExtraDiscount(Number(e.target.value))}
                    className="h-9 text-end"
                    placeholder="0"
                  />
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Extra Discount:</span>
                  <span className="text-destructive">
                    - LKR {extraDiscountAmount.toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="border-t pt-4">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-bold">Grand Total:</span>
                  <span className="text-2xl font-bold text-primary">
                    LKR {grandTotal.toLocaleString()}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
