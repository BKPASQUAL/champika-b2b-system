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
  ShoppingCart,
  FileText,
  BadgeCheck,
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
  const [submitStep, setSubmitStep] = useState(0); // 0=idle 1=validating 2=saving 3=done
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
    setSubmitStep(1);

    const orderData = {
      customerId,
      salesRepId: currentUser.id,
      businessId: userBusinessId,
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
      // Step 1 → Step 2 after a short beat so user sees the transition
      await new Promise((r) => setTimeout(r, 600));
      setSubmitStep(2);

      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(orderData),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to place order");

      setSubmitStep(3);
      await new Promise((r) => setTimeout(r, 1200));
      router.push(`/dashboard/rep/invoices/${data.data.id}`);
    } catch (error: any) {
      toast.error(error.message || "Failed to create order");
      setSubmitting(false);
      setSubmitStep(0);
    }
  };

  const availableProducts = products.filter(
    (p) => !items.some((i) => i.productId === p.id)
  );

  if (loading) {
    return (
      <div className="flex justify-center items-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // ── Submission overlay ─────────────────────────────────────────────────────
  const steps = [
    { icon: ShoppingCart, label: "Validating order",   desc: "Checking items & customer details" },
    { icon: FileText,     label: "Creating invoice",   desc: "Saving your order to the system"    },
    { icon: BadgeCheck,   label: "Order confirmed!",   desc: "Everything is set — redirecting…"   },
  ];

  if (submitting) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white">
        {/* Subtle animated background */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-primary/5 blur-3xl animate-pulse" />
          <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-primary/5 blur-3xl animate-pulse [animation-delay:1s]" />
        </div>

        <div className="relative z-10 flex flex-col items-center gap-10 w-full max-w-sm px-6">
          {/* Central icon ring */}
          <div className="relative flex items-center justify-center">
            {/* Outer pulse rings */}
            {submitStep < 3 && (
              <>
                <span className="absolute inline-flex h-28 w-28 rounded-full bg-primary/10 animate-ping [animation-duration:1.4s]" />
                <span className="absolute inline-flex h-24 w-24 rounded-full bg-primary/15 animate-ping [animation-duration:1.4s] [animation-delay:0.3s]" />
              </>
            )}
            {/* Icon circle */}
            <div className={cn(
              "relative h-20 w-20 rounded-full flex items-center justify-center shadow-xl transition-all duration-700",
              submitStep === 3
                ? "bg-emerald-500 scale-110 shadow-emerald-200"
                : "bg-primary shadow-primary/30"
            )}>
              {submitStep === 3 ? (
                <BadgeCheck className="h-10 w-10 text-white animate-[scale-in_0.3s_ease-out]" strokeWidth={1.8} />
              ) : (
                <Loader2 className="h-10 w-10 text-white animate-spin" strokeWidth={1.8} />
              )}
            </div>
          </div>

          {/* Steps list */}
          <div className="w-full space-y-3">
            {steps.map((step, idx) => {
              const Icon = step.icon;
              const stepNum = idx + 1;
              const isDone    = submitStep > stepNum;
              const isActive  = submitStep === stepNum;
              const isPending = submitStep < stepNum;

              return (
                <div
                  key={idx}
                  className={cn(
                    "flex items-center gap-4 rounded-2xl px-5 py-4 transition-all duration-500",
                    isActive  && "bg-primary/8 border border-primary/20 shadow-sm scale-[1.02]",
                    isDone    && "bg-emerald-50 border border-emerald-100",
                    isPending && "opacity-35"
                  )}
                >
                  {/* Step icon / check */}
                  <div className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-all duration-500",
                    isActive  && "bg-primary text-white",
                    isDone    && "bg-emerald-500 text-white",
                    isPending && "bg-muted text-muted-foreground"
                  )}>
                    {isDone
                      ? <Check className="h-4 w-4" strokeWidth={2.5} />
                      : <Icon className={cn("h-4 w-4", isActive && "animate-pulse")} />
                    }
                  </div>

                  {/* Text */}
                  <div className="flex-1 min-w-0">
                    <p className={cn(
                      "text-sm font-semibold leading-tight",
                      isActive  && "text-primary",
                      isDone    && "text-emerald-700",
                      isPending && "text-muted-foreground"
                    )}>
                      {step.label}
                    </p>
                    {(isActive || isDone) && (
                      <p className={cn(
                        "text-xs mt-0.5",
                        isDone   && "text-emerald-600",
                        isActive && "text-muted-foreground"
                      )}>
                        {step.desc}
                      </p>
                    )}
                  </div>

                  {/* Active spinner dot */}
                  {isActive && (
                    <div className="flex gap-1">
                      {[0, 1, 2].map((i) => (
                        <span
                          key={i}
                          className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce"
                          style={{ animationDelay: `${i * 0.15}s` }}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Progress bar */}
          <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all duration-700 ease-out"
              style={{ width: submitStep === 0 ? "0%" : submitStep === 1 ? "33%" : submitStep === 2 ? "66%" : "100%",
                       backgroundColor: submitStep === 3 ? "rgb(16 185 129)" : undefined }}
            />
          </div>
        </div>
      </div>
    );
  }
  // ── End overlay ─────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4 mx-auto pb-28 lg:pb-6">

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

      {/* ── Page header ── */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0"
          onClick={() => router.push("/dashboard/rep")}
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight truncate">
            New Sales Order
          </h1>
          <p className="text-muted-foreground text-xs sm:text-sm mt-0.5 hidden sm:block">
            Create a new order for your customer
          </p>
        </div>
        {/* Desktop Place Order button — hidden on mobile (uses sticky bar below) */}
        <Button
          onClick={handleSaveOrder}
          disabled={items.length === 0 || submitting}
          className="hidden lg:flex bg-black hover:bg-gray-800 text-white shrink-0"
        >
          <Save className="w-4 h-4 mr-2" />
          Place Order
        </Button>
      </div>

      <div className="grid gap-4 sm:gap-6 lg:grid-cols-3">

        {/* ── LEFT COLUMN ── */}
        <div className="lg:col-span-2 space-y-4 sm:space-y-6">

          {/* 1. Customer Details */}
          <Card>
            <CardHeader className="pb-3 sm:pb-6">
              <CardTitle className="text-base sm:text-lg">Customer Details</CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                Select the customer for this order
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 sm:space-y-4">

              {/* Customer + Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs sm:text-sm">Customer</Label>
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
                        className="w-full justify-between text-sm"
                      >
                        <span className="truncate">
                          {customerId
                            ? customers.find((c) => c.id === customerId)?.name
                            : "Select Customer"}
                        </span>
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
                                    "mr-2 h-4 w-4 shrink-0",
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

                <div className="space-y-2">
                  <Label className="text-xs sm:text-sm">Order Date</Label>
                  <Input
                    type="date"
                    value={orderDate}
                    onChange={(e) => setOrderDate(e.target.value)}
                    className="text-sm"
                  />
                </div>
              </div>

              {/* Rep info row */}
              <div className="grid grid-cols-2 gap-3 sm:gap-4 pt-1">
                <div className="flex items-center gap-2 sm:gap-3 p-2 sm:p-3 rounded-md border bg-muted/20">
                  <User className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground shrink-0" />
                  <div className="flex flex-col min-w-0">
                    <span className="text-[10px] sm:text-xs text-muted-foreground uppercase">
                      Sales Rep
                    </span>
                    <span className="font-medium text-xs sm:text-sm truncate">
                      {currentUser ? currentUser.name : "Loading..."}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 sm:gap-3 p-2 sm:p-3 rounded-md border bg-muted/20">
                  <Package className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground shrink-0" />
                  <div className="flex flex-col min-w-0">
                    <span className="text-[10px] sm:text-xs text-muted-foreground uppercase">
                      Status
                    </span>
                    <span className="font-medium text-xs sm:text-sm text-yellow-600 truncate">
                      Pending
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 2. Add Products */}
          <Card>
            <CardHeader className="pb-3 sm:pb-6">
              <CardTitle className="text-base sm:text-lg">Add Products</CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                {outOfStockOverride
                  ? "All items available — including out-of-stock products"
                  : "Search and add products to the order"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 sm:space-y-4">

              {/* Product search */}
              <div className="space-y-2">
                <Label className="text-xs sm:text-sm">Product</Label>
                <Popover open={productOpen} onOpenChange={setProductOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={productOpen}
                      className="w-full justify-between text-sm"
                    >
                      <span className="truncate">
                        {currentItem.productId
                          ? products.find((p) => p.id === currentItem.productId)?.name
                          : "Select Product"}
                      </span>
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
                                  "mr-2 h-4 w-4 shrink-0",
                                  currentItem.productId === product.id
                                    ? "opacity-100"
                                    : "opacity-0"
                                )}
                              />
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-sm truncate">
                                  {product.name}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {product.sku} · Stock: {product.stock_quantity} · LKR{" "}
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

              {/* Qty / Free / Unit / Stock — 2 cols on mobile, 4 on sm+ */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                <div className="space-y-2">
                  <Label className="text-xs sm:text-sm">Quantity</Label>
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
                    className="text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs sm:text-sm">Free Qty</Label>
                  <Input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={currentItem.freeQuantity}
                    onChange={(e) =>
                      setCurrentItem({ ...currentItem, freeQuantity: e.target.value })
                    }
                    onKeyDown={handleKeyDown}
                    className="text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs sm:text-sm">Unit</Label>
                  <Input
                    value={currentItem.unit || "-"}
                    disabled
                    className="bg-muted text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs sm:text-sm">Stock</Label>
                  <Input
                    value={currentItem.productId ? currentItem.stockAvailable : "-"}
                    disabled
                    className={cn(
                      "text-sm",
                      !outOfStockOverride &&
                      currentItem.stockAvailable > 0 &&
                      currentItem.stockAvailable < 10
                        ? "text-destructive font-bold bg-muted"
                        : "bg-muted"
                    )}
                  />
                </div>
              </div>

              {/* MRP / Unit Price / Discount / Total — 2 cols on mobile, 4 on sm+ */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                <div className="space-y-2">
                  <Label className="text-xs sm:text-sm">MRP</Label>
                  <Input
                    type="number"
                    value={currentItem.mrp || ""}
                    onChange={(e) =>
                      setCurrentItem({ ...currentItem, mrp: Number(e.target.value) })
                    }
                    onKeyDown={handleKeyDown}
                    placeholder="0.00"
                    className="text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs sm:text-sm">Unit Price</Label>
                  <Input
                    type="number"
                    value={currentItem.unitPrice || ""}
                    onChange={(e) =>
                      setCurrentItem({ ...currentItem, unitPrice: Number(e.target.value) })
                    }
                    onKeyDown={handleKeyDown}
                    placeholder="0.00"
                    className="text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs sm:text-sm">Disc %</Label>
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
                    className="text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs sm:text-sm">Total</Label>
                  <Input
                    value={currentTotal.toFixed(2)}
                    disabled
                    className="font-bold bg-muted text-sm"
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

          {/* 3. Order Items */}
          <Card>
            <CardHeader className="pb-3 sm:pb-6">
              <CardTitle className="text-base sm:text-lg">Order Items</CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                {items.length} item(s) added
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0 sm:p-6 sm:pt-0">

              {/* ── Mobile card list (hidden on sm+) ── */}
              <div className="sm:hidden divide-y">
                {items.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                    <Package className="w-8 h-8 mb-2 opacity-40" />
                    <p className="text-sm">No items added yet</p>
                  </div>
                ) : (
                  items.map((item, idx) => (
                    <div key={item.id} className="flex items-start gap-3 px-4 py-3">
                      <span className="text-xs text-muted-foreground pt-0.5 w-5 shrink-0">
                        {idx + 1}
                      </span>
                      <div className="flex-1 min-w-0 space-y-1">
                        <p className="font-medium text-sm leading-tight truncate">
                          {item.productName}
                        </p>
                        <p className="text-xs text-muted-foreground">{item.sku}</p>
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                          <span>Qty: <span className="text-foreground font-medium">{item.quantity} {item.unit}</span></span>
                          {item.freeQuantity > 0 && (
                            <span>Free: <span className="text-foreground font-medium">{item.freeQuantity}</span></span>
                          )}
                          <span>Price: <span className="text-foreground font-medium">LKR {item.unitPrice.toLocaleString()}</span></span>
                          {item.discountPercent > 0 && (
                            <span>Disc: <span className="text-foreground font-medium">{item.discountPercent}%</span></span>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className="font-bold text-sm">
                          LKR {item.total.toLocaleString()}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => handleRemoveItem(item.id)}
                        >
                          <Trash2 className="w-3.5 h-3.5 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* ── Desktop table (hidden on mobile) ── */}
              <div className="hidden sm:block border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">#</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead className="text-center w-20">Qty</TableHead>
                      <TableHead className="text-center w-16">Free</TableHead>
                      <TableHead className="text-right w-24">Unit Price</TableHead>
                      <TableHead className="text-center w-16">Disc%</TableHead>
                      <TableHead className="text-right w-28">Total</TableHead>
                      <TableHead className="w-10"></TableHead>
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
                          <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
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

        {/* ── RIGHT COLUMN — Summary (desktop sidebar) ── */}
        <div className="lg:col-span-1 hidden lg:block">
          <Card className="sticky top-6">
            <CardHeader>
              <CardTitle>Order Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Customer:</span>
                  <span className="font-medium truncate ml-2 text-right">
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
                <Save className="w-4 h-4 mr-2" />
                Place Order
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── Mobile / Tablet sticky bottom bar ── */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t shadow-lg px-4 py-3 safe-area-inset-bottom">
        <div className="flex items-center gap-3 max-w-2xl mx-auto">
          {/* Mini totals */}
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-1.5">
              <span className="text-xs text-muted-foreground">Total</span>
              <span className="font-bold text-base text-primary truncate">
                LKR {grandTotal.toLocaleString()}
              </span>
            </div>
            <div className="flex gap-2 text-xs text-muted-foreground">
              <span>{items.length} item{items.length !== 1 ? "s" : ""}</span>
              {extraDiscountAmount > 0 && (
                <span>· Disc: LKR {extraDiscountAmount.toLocaleString()}</span>
              )}
            </div>
          </div>

          {/* Extra discount quick input */}
          <div className="flex items-center gap-1.5 shrink-0">
            <Label className="text-xs text-muted-foreground whitespace-nowrap">
              Extra %
            </Label>
            <Input
              type="number"
              min="0"
              max="100"
              placeholder="0"
              value={extraDiscount}
              onChange={(e) => setExtraDiscount(e.target.value)}
              className="w-16 h-9 text-sm text-center"
            />
          </div>

          {/* Place Order */}
          <Button
            onClick={handleSaveOrder}
            disabled={items.length === 0 || submitting}
            className="bg-black hover:bg-gray-800 text-white shrink-0"
          >
            <Save className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">Place Order</span>
          </Button>
        </div>
      </div>

      {/* New Customer Dialog */}
      <Dialog open={newCustomerOpen} onOpenChange={setNewCustomerOpen}>
        <DialogContent className="w-[95vw] max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle>Add New Customer</DialogTitle>
            <DialogDescription>
              Enter new customer information below.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 py-4">
            {/* Shop Name */}
            <div className="sm:col-span-2 space-y-2">
              <Label>Shop Name *</Label>
              <Input
                value={newCustomer.shopName}
                onChange={(e) => setNewCustomer({ ...newCustomer, shopName: e.target.value })}
                placeholder="e.g. Singer Plus - Galle"
              />
            </div>

            {/* Owner / Phone */}
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

            {/* Email */}
            <div className="sm:col-span-2 space-y-2">
              <Label>Email (Optional)</Label>
              <Input
                value={newCustomer.email}
                onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })}
                placeholder="email@example.com"
              />
            </div>

            {/* Address */}
            <div className="sm:col-span-2 space-y-2">
              <Label>Address</Label>
              <Input
                value={newCustomer.address}
                onChange={(e) => setNewCustomer({ ...newCustomer, address: e.target.value })}
                placeholder="Full Street address"
              />
            </div>

            {/* Route */}
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

            {/* Credit Limit */}
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

          <DialogFooter className="flex-row gap-2 sm:flex-row">
            <Button
              variant="outline"
              onClick={() => setNewCustomerOpen(false)}
              disabled={creatingCustomer}
              className="flex-1 sm:flex-none"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateCustomer}
              disabled={creatingCustomer}
              className="flex-1 sm:flex-none bg-black hover:bg-gray-800 text-white"
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
