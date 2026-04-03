"use client";

import React, { useState, useEffect, useRef } from "react";
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
  AlertTriangle,
  UserPlus,
  MapPin,
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  const [outOfStockOverride, setOutOfStockOverride] = useState(false);
  const [canCreateCustomer, setCanCreateCustomer] = useState(false);
  const [userBusinessId, setUserBusinessId] = useState<string | null>(null);

  // New Customer Dialog
  const [newCustomerOpen, setNewCustomerOpen] = useState(false);
  const [creatingCustomer, setCreatingCustomer] = useState(false);
  const [routes, setRoutes] = useState<{ id: string; name: string }[]>([]);
  const [newCustomer, setNewCustomer] = useState({
    shopName: "",
    ownerName: "",
    phone: "",
    email: "",
    address: "",
    route: "",
    creditLimit: 0,
    status: "Active",
  });

  // Data State
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<{ id: string; name: string }[]>([]);

  // User State
  const [currentUser, setCurrentUser] = useState<UserData | null>(null);

  // Form State
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [orderDate, setOrderDate] = useState(
    new Date().toISOString().split("T")[0]
  );

  // Items State
  const [items, setItems] = useState<OrderItem[]>([]);
  const [extraDiscount, setExtraDiscount] = useState<string>("");

  // Popover States
  const [customerOpen, setCustomerOpen] = useState(false);
  const [productOpen, setProductOpen] = useState(false);

  // Current Item Being Added — string-based inputs like distribution
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

  // --- Fetch Data on Mount ---
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // 1. Load Current User from Local Storage
        let userId = "";
        let bizId: string | null = null;

        if (typeof window !== "undefined") {
          const storedUser = localStorage.getItem("currentUser");
          if (storedUser) {
            const parsedUser = JSON.parse(storedUser);
            if (!parsedUser.id) {
              const userRes = await fetch("/api/users");
              const users = await userRes.json();
              const found = users.find((u: any) => u.email === parsedUser.email);
              if (found) parsedUser.id = found.id;
            }
            setCurrentUser(parsedUser);
            userId = parsedUser.id;
            bizId = parsedUser.businessId || null;
            setUserBusinessId(bizId);
          }
        }

        if (!userId) {
          toast.error("User not identified. Please login.");
          setLoading(false);
          return;
        }

        // 2. Check settings in parallel
        const [overrideData, customerCreateData, routesData] = await Promise.all([
          fetch("/api/settings/invoice-override").then((r) => r.json()).catch(() => ({ enabled: false })),
          fetch("/api/settings/rep-customer-creation").then((r) => r.json()).catch(() => ({ enabled: false })),
          fetch("/api/settings/categories?type=route").then((r) => r.json()).catch(() => []),
        ]);

        const overrideEnabled = overrideData.enabled ?? false;
        setOutOfStockOverride(overrideEnabled);
        setCanCreateCustomer(customerCreateData.enabled ?? false);
        setRoutes(routesData.filter((r: any) => r.name));

        // 3. Fetch Products (Specific to Rep's Location)
        const stockUrl = overrideEnabled
          ? `/api/rep/stock?userId=${userId}&includeOutOfStock=true`
          : `/api/rep/stock?userId=${userId}`;
        const productsRes = await fetch(stockUrl);
        if (!productsRes.ok) throw new Error("Failed to load rep stock");
        const productsData = await productsRes.json();

        setProducts(
          productsData.map((p: any) => ({
            id: p.id,
            sku: p.sku,
            name: p.name,
            selling_price: p.selling_price,
            mrp: p.mrp,
            stock_quantity: p.stock_quantity,
            unit_of_measure: p.unit_of_measure || "unit",
          }))
        );

        // 4. Fetch Customers — filtered to rep's own business
        const customersUrl = bizId
          ? `/api/customers?businessId=${bizId}`
          : "/api/customers";
        const customersRes = await fetch(customersUrl);
        const customersData = await customersRes.json();
        setCustomers(
          customersData.map((c: any) => ({ id: c.id, name: c.shopName }))
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
      quantity: "",
      freeQuantity: "",
      unit: product.unit_of_measure,
      mrp: product.mrp,
      unitPrice: product.selling_price,
      discountPercent: "",
      stockAvailable: product.stock_quantity,
    });

    setProductOpen(false);
    setTimeout(() => qtyInputRef.current?.focus(), 100);
  };

  // Enter key to add item quickly
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddItem();
    }
  };

  // --- Add Item to Order ---
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

    if (!outOfStockOverride) {
      const totalReqQty = qty + free;
      if (totalReqQty > currentItem.stockAvailable) {
        toast.error(`Insufficient stock! Available: ${currentItem.stockAvailable}`);
        return;
      }
    }

    const product = products.find((p) => p.id === currentItem.productId);
    if (!product) return;

    const grossTotal = currentItem.unitPrice * qty;
    const discountAmount = (grossTotal * discPerc) / 100;
    const netTotal = grossTotal - discountAmount;

    const newItem: OrderItem = {
      id: Date.now().toString(),
      productId: currentItem.productId,
      sku: product.sku,
      productName: product.name,
      unit: product.unit_of_measure,
      quantity: qty,
      freeQuantity: free,
      mrp: currentItem.mrp,
      unitPrice: currentItem.unitPrice,
      discountPercent: discPerc,
      discountAmount: discountAmount,
      total: netTotal,
    };

    setItems([...items, newItem]);

    // Reset
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

  // --- Create New Customer ---
  const handleCreateCustomer = async () => {
    if (!newCustomer.phone.trim() || newCustomer.phone.trim().length < 9) {
      toast.error("A valid phone number is required");
      return;
    }
    if (!newCustomer.shopName.trim()) {
      toast.error("Shop name is required");
      return;
    }
    if (!userBusinessId) {
      toast.error("Business ID not found — please re-login");
      return;
    }

    setCreatingCustomer(true);
    try {
      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shopName: newCustomer.shopName.trim(),
          ownerName: newCustomer.ownerName.trim() || undefined,
          phone: newCustomer.phone.trim(),
          email: newCustomer.email.trim() || undefined,
          address: newCustomer.address.trim() || undefined,
          route: newCustomer.route || "General",
          creditLimit: newCustomer.creditLimit || 0,
          businessId: userBusinessId,
          status: newCustomer.status,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create customer");

      const created = { id: data.data.id, name: newCustomer.shopName.trim() };
      setCustomers((prev) => [created, ...prev]);
      setCustomerId(created.id);
      setNewCustomerOpen(false);
      setNewCustomer({ shopName: "", ownerName: "", phone: "", email: "", address: "", route: "", creditLimit: 0, status: "Active" });
      toast.success(`Customer "${created.name}" created and selected`);
    } catch (err: any) {
      toast.error(err.message || "Failed to create customer");
    } finally {
      setCreatingCustomer(false);
    }
  };

  // --- Totals ---
  const subtotal = items.reduce((sum, item) => sum + item.total, 0);
  const totalItemDiscount = items.reduce((sum, item) => sum + item.discountAmount, 0);
  const grossTotal = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);

  const extraDiscPercVal = parseFloat(extraDiscount) || 0;
  const extraDiscountAmount = (subtotal * extraDiscPercVal) / 100;
  const grandTotal = Math.max(0, subtotal - extraDiscountAmount);

  // Current item live totals
  const qtyNum = parseFloat(currentItem.quantity) || 0;
  const discPercNum = parseFloat(currentItem.discountPercent) || 0;
  const currentDiscountAmt = (currentItem.unitPrice * qtyNum * discPercNum) / 100;
  const currentTotal = currentItem.unitPrice * qtyNum - currentDiscountAmt;

  // --- Save Order ---
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
      salesRepId: currentUser.id,
      invoiceDate: orderDate,
      orderStatus: "Pending",
      items,
      subTotal: subtotal,
      extraDiscountPercent: extraDiscPercVal,
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
      if (!res.ok) throw new Error(data.error || "Failed to place order");

      toast.success("Order Placed Successfully!");
      router.push("/dashboard/rep");
    } catch (error: any) {
      toast.error(error.message || "Failed to create order");
    } finally {
      setSubmitting(false);
    }
  };

  const availableProducts = products.filter(
    (p) => !items.some((i) => i.productId === p.id)
  );

  if (loading) {
    return (
      <div className="flex justify-center items-center h-full min-h-64">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        <p className="text-lg text-muted-foreground">Loading Your Stock...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 mx-auto pb-20">
      {/* Out-of-stock override banner */}
      {outOfStockOverride && (
        <div className="flex items-start gap-2 bg-orange-50 border border-orange-300 rounded-xl px-4 py-3 text-sm text-orange-800">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-orange-500" />
          <span>
            <strong>Special Sales Period Active:</strong> Out-of-stock items are
            visible and can be invoiced. Stock validation is temporarily disabled.
          </span>
        </div>
      )}

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
              <CardDescription>Select the customer for this order</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {/* Customer Select */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Customer</Label>
                    {canCreateCustomer && (
                      <button
                        type="button"
                        onClick={() => setNewCustomerOpen(true)}
                        className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium"
                      >
                        <UserPlus className="h-3.5 w-3.5" />
                        New Customer
                      </button>
                    )}
                  </div>
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
                    <PopoverContent
                      className="w-[var(--radix-popover-trigger-width)] p-0"
                      align="start"
                    >
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
                  />
                </div>
              </div>

              {/* Rep info row */}
              <div className="grid grid-cols-2 gap-4 pt-1">
                <div className="flex items-center gap-3 p-3 rounded-md border bg-muted/20">
                  <User className="h-5 w-5 text-muted-foreground" />
                  <div className="flex flex-col">
                    <span className="text-xs text-muted-foreground uppercase">Sales Rep</span>
                    <span className="font-medium text-sm">
                      {currentUser ? currentUser.name : "Loading..."}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-md border bg-muted/20">
                  <Package className="h-5 w-5 text-muted-foreground" />
                  <div className="flex flex-col">
                    <span className="text-xs text-muted-foreground uppercase">Order Status</span>
                    <span className="font-medium text-sm text-yellow-600">Pending Approval</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 2. Add Products */}
          <Card>
            <CardHeader>
              <CardTitle>Add Products</CardTitle>
              <CardDescription>
                {outOfStockOverride
                  ? "All items available — including out-of-stock products"
                  : "Search and add products to the order"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Product Search — full width */}
              <div className="grid grid-cols-4 gap-4">
                <div className="col-span-4 space-y-2">
                  <Label>Product</Label>
                  <Popover open={productOpen} onOpenChange={setProductOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={productOpen}
                        className="w-full justify-between"
                      >
                        {currentItem.productId
                          ? products.find((p) => p.id === currentItem.productId)?.name
                          : "Select Product"}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      className="w-[var(--radix-popover-trigger-width)] p-0"
                      align="start"
                    >
                      <Command>
                        <CommandInput placeholder="Search product by name or SKU..." />
                        <CommandList>
                          <CommandEmpty>No product found in your stock.</CommandEmpty>
                          <CommandGroup>
                            {availableProducts.map((product) => (
                              <CommandItem
                                key={product.id}
                                value={product.name}
                                onSelect={() => handleProductSelect(product.id)}
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
                                  <div className="font-medium">{product.name}</div>
                                  <div className="text-xs text-muted-foreground">
                                    {product.sku} • Stock: {product.stock_quantity} • LKR{" "}
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
              </div>

              {/* Quantity row */}
              <div className="grid grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label>Quantity</Label>
                  <Input
                    ref={qtyInputRef}
                    type="number"
                    min="1"
                    placeholder="Qty"
                    value={currentItem.quantity}
                    onChange={(e) =>
                      setCurrentItem({ ...currentItem, quantity: e.target.value })
                    }
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
                    onChange={(e) =>
                      setCurrentItem({ ...currentItem, freeQuantity: e.target.value })
                    }
                    onKeyDown={handleKeyDown}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Unit</Label>
                  <Input
                    value={currentItem.unit || "-"}
                    disabled
                    className="bg-muted"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Stock</Label>
                  <Input
                    value={
                      currentItem.productId
                        ? currentItem.stockAvailable
                        : "-"
                    }
                    disabled
                    className={
                      !outOfStockOverride &&
                      currentItem.stockAvailable > 0 &&
                      currentItem.stockAvailable < 10
                        ? "text-destructive font-bold bg-muted"
                        : "bg-muted"
                    }
                  />
                </div>
              </div>

              {/* Price row */}
              <div className="grid grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label>MRP</Label>
                  <Input
                    type="number"
                    value={currentItem.mrp || ""}
                    onChange={(e) =>
                      setCurrentItem({ ...currentItem, mrp: Number(e.target.value) })
                    }
                    onKeyDown={handleKeyDown}
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Unit Price</Label>
                  <Input
                    type="number"
                    value={currentItem.unitPrice || ""}
                    onChange={(e) =>
                      setCurrentItem({ ...currentItem, unitPrice: Number(e.target.value) })
                    }
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
                    value={currentItem.discountPercent}
                    onChange={(e) =>
                      setCurrentItem({ ...currentItem, discountPercent: e.target.value })
                    }
                    onKeyDown={handleKeyDown}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Total</Label>
                  <Input
                    value={currentTotal.toFixed(2)}
                    disabled
                    className="font-bold bg-muted"
                  />
                </div>
              </div>

              <Button
                onClick={handleAddItem}
                className="w-full bg-blue-600 hover:bg-blue-700"
                disabled={!currentItem.productId}
              >
                <Plus className="w-4 h-4 mr-2" />
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
                        <TableCell
                          colSpan={8}
                          className="text-center text-muted-foreground py-8"
                        >
                          <Package className="w-8 h-8 mx-auto mb-2 opacity-50" />
                          No items added yet
                        </TableCell>
                      </TableRow>
                    ) : (
                      items.map((item, idx) => (
                        <TableRow key={item.id}>
                          <TableCell>{idx + 1}</TableCell>
                          <TableCell>
                            <div className="font-medium">{item.productName}</div>
                            <div className="text-xs text-muted-foreground">{item.sku}</div>
                          </TableCell>
                          <TableCell className="text-center">
                            {item.quantity} {item.unit}
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
                              size="icon"
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

        {/* RIGHT COLUMN — Summary */}
        <div className="lg:col-span-1">
          <Card className="sticky top-6">
            <CardHeader>
              <CardTitle>Order Summary</CardTitle>
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
                  <span className="text-muted-foreground">Item Discounts:</span>
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

              <Button
                onClick={handleSaveOrder}
                disabled={items.length === 0 || submitting}
                className="w-full bg-black hover:bg-gray-800 text-white mt-2"
              >
                {submitting ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                Place Order
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* New Customer Dialog */}
      <Dialog open={newCustomerOpen} onOpenChange={setNewCustomerOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Customer</DialogTitle>
            <DialogDescription>
              Enter new customer information below.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-4 py-4">
            {/* Shop Name — full width */}
            <div className="col-span-2 space-y-2">
              <Label>Shop Name *</Label>
              <Input
                value={newCustomer.shopName}
                onChange={(e) => setNewCustomer({ ...newCustomer, shopName: e.target.value })}
                placeholder="e.g. Singer Plus - Galle"
              />
            </div>

            {/* Owner / Phone — side by side */}
            <div className="space-y-2">
              <Label>Owner / Contact Person</Label>
              <Input
                value={newCustomer.ownerName}
                onChange={(e) => setNewCustomer({ ...newCustomer, ownerName: e.target.value })}
                placeholder="e.g. Mr. Perera"
              />
            </div>
            <div className="space-y-2">
              <Label>Phone Number *</Label>
              <Input
                value={newCustomer.phone}
                onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                placeholder="077xxxxxxx"
              />
            </div>

            {/* Email — full width */}
            <div className="col-span-2 space-y-2">
              <Label>Email (Optional)</Label>
              <Input
                value={newCustomer.email}
                onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })}
                placeholder="email@example.com"
              />
            </div>

            {/* Address — full width */}
            <div className="col-span-2 space-y-2">
              <Label>Address</Label>
              <Input
                value={newCustomer.address}
                onChange={(e) => setNewCustomer({ ...newCustomer, address: e.target.value })}
                placeholder="Full Street address"
              />
            </div>

            {/* Route / Credit Limit — side by side */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1">
                <MapPin className="w-3 h-3" /> Route / Area *
              </Label>
              <Select
                value={newCustomer.route}
                onValueChange={(v) => setNewCustomer({ ...newCustomer, route: v })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select Route" />
                </SelectTrigger>
                <SelectContent>
                  {routes.length === 0 && (
                    <SelectItem value="General">General (Default)</SelectItem>
                  )}
                  {routes.map((r) => (
                    <SelectItem key={r.id} value={r.name}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Credit Limit (LKR)</Label>
              <Input
                type="number"
                min="0"
                value={newCustomer.creditLimit}
                onChange={(e) =>
                  setNewCustomer({
                    ...newCustomer,
                    creditLimit: parseFloat(e.target.value) || 0,
                  })
                }
              />
            </div>

            {/* Status */}
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={newCustomer.status}
                onValueChange={(v) => setNewCustomer({ ...newCustomer, status: v })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Inactive">Inactive</SelectItem>
                  <SelectItem value="Blocked">Blocked</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setNewCustomerOpen(false)}
              disabled={creatingCustomer}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateCustomer}
              disabled={creatingCustomer}
              className="bg-black hover:bg-gray-800 text-white"
            >
              {creatingCustomer && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Add Customer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
