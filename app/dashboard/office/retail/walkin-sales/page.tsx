// app/dashboard/office/retail/walkin-sales/page.tsx
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
  Printer,
  Download,
  Pencil,
  X,
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
import { BUSINESS_IDS, BUSINESS_NAMES } from "@/app/config/business-constants";

// --- Types ---

interface Product {
  id: string;
  sku: string;
  name: string;
  selling_price: number;
  retail_price?: number | null;
  mrp: number;
  stock_quantity: number;
  unit_of_measure: string;
  supplier?: string;
  retailOnly?: boolean;
}

interface Customer {
  id: string;
  name: string;
  shop_name: string;
  owner_name: string;
  business_id: string | null;
  phone?: string;
  ownerName?: string;
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
  supplier?: string;
  retailOnly?: boolean;
}

interface CurrentItemState {
  productId: string;
  sku: string;
  quantity: number | "";
  freeQuantity: number | "";
  unit: string;
  mrp: number | "";
  unitPrice: number | "";
  discountPercent: number | "";
  stockAvailable: number;
}

export default function CreateRetailInvoicePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [stockLoading, setStockLoading] = useState(false);

  // Business Context
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [businessName, setBusinessName] = useState<string>("");
  const [userId, setUserId] = useState<string | null>(null);

  // Data State
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [allCustomers, setAllCustomers] = useState<Customer[]>([]);

  // NEW: State to store the ID of the Walk-in customer found in the database
  const [guestCustomerId, setGuestCustomerId] = useState<string | null>(null);

  // Form State
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [invoiceDate, setInvoiceDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [invoiceNumber, setInvoiceNumber] = useState("INV-NEW");
  const [paymentType, setPaymentType] = useState<string>("Cash");

  // Items State
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [extraDiscount, setExtraDiscount] = useState<number>(0);

  // Popover States
  const [customerOpen, setCustomerOpen] = useState(false);
  const [productOpen, setProductOpen] = useState(false);

  // Supplier filter state
  const [supplierFilter, setSupplierFilter] = useState<"all" | "sierra" | "wireman" | "orange" | "retail" | "other">("all");

  // Current Item Being Added - Initialized with empty values
  const [currentItem, setCurrentItem] = useState<CurrentItemState>({
    productId: "",
    sku: "",
    quantity: "",
    freeQuantity: "",
    unit: "",
    mrp: "",
    unitPrice: "",
    discountPercent: "",
    stockAvailable: 0,
  });

  // Edit mode — tracks which item is being edited (null = adding new)
  const [editingItemId, setEditingItemId] = useState<string | null>(null);

  const addProductCardRef = useRef<HTMLDivElement>(null);
  const quantityInputRef = useRef<HTMLInputElement>(null);

  const [isLandscape, setIsLandscape] = useState(false);
  const [isDesktopScreen, setIsDesktopScreen] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(orientation: landscape) and (max-width: 1279px)");
    setIsLandscape(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsLandscape(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1280px)");
    setIsDesktopScreen(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsDesktopScreen(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
    if (productOpen) {
      addProductCardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [productOpen]);

  // --- 1. Get Business Context and Fetch Initial Data ---
  useEffect(() => {
    const fetchInitialData = async () => {
      setLoading(true);
      try {
        const user = getUserBusinessContext();
        if (!user) {
          toast.error("User context not found");
          router.push("/login");
          return;
        }

        const resolvedBusinessName = user.businessName ?? BUSINESS_NAMES[BUSINESS_IDS.CHAMPIKA_RETAIL];

        setBusinessId(BUSINESS_IDS.CHAMPIKA_RETAIL);
        setBusinessName(resolvedBusinessName);
        setUserId(user.id);

        const customersRes = await fetch(`/api/customers?businessId=${BUSINESS_IDS.CHAMPIKA_RETAIL}`);
        const customersData = await customersRes.json();

        setAllCustomers(customersData);

        const retailCustomers = customersData.filter((c: any) => {
          return (
            c.business_id === BUSINESS_IDS.CHAMPIKA_RETAIL ||
            c.businessId === BUSINESS_IDS.CHAMPIKA_RETAIL
          );
        });

        // --- NEW LOGIC: Find Guest / Walk-in Customer ---
        // Searches for a customer with "walk-in" or "guest" in their name/shop name
        const guest = retailCustomers.find((c: any) => {
          const nameToCheck = (
            c.shop_name ||
            c.shopName ||
            c.name ||
            ""
          ).toLowerCase();
          return (
            nameToCheck.includes("walk-in") || nameToCheck.includes("guest")
          );
        });

        if (guest) {
          setGuestCustomerId(guest.id);
          // Auto-select the Walk-in customer by default
          setCustomerId(guest.id);
        }
        // ------------------------------------------------

        if (retailCustomers.length === 0) {
          toast.info(
            `No customers assigned to ${user.businessName}. Please assign customers to this business first.`,
            { duration: 5000 }
          );
        }

        setCustomers(
          retailCustomers.map((c: any) => ({
            id: c.id,
            name: c.shop_name || c.shopName,
            shop_name: c.shop_name || c.shopName,
            owner_name: c.owner_name || c.ownerName,
            business_id: c.business_id || c.businessId,
          }))
        );

        setStockLoading(true);
        const productsRes = await fetch(`/api/rep/stock?userId=${user.id}`);

        if (!productsRes.ok) {
          throw new Error("Failed to fetch assigned stock");
        }

        const productsData = await productsRes.json();

        if (Array.isArray(productsData)) {
          setProducts(
            productsData.map((p: any) => ({
              id: p.id,
              sku: p.sku,
              name: p.name,
              selling_price: p.selling_price || 0,
              retail_price: p.retail_price ?? null,
              mrp: p.mrp || 0,
              stock_quantity: p.stock_quantity || 0,
              unit_of_measure: p.unit_of_measure || "unit",
              supplier: p.supplier || "",
              retailOnly: p.retailOnly ?? p.retail_only ?? false,
            }))
          );

          if (productsData.length === 0) {
            toast.warning(
              "No stock found. Please check your Warehouse Assignments."
            );
          }
        } else {
          console.error("Invalid product data format", productsData);
          setProducts([]);
        }

        setStockLoading(false);
      } catch (error) {
        console.error("Error fetching data:", error);
        toast.error("Failed to load data");
      } finally {
        setLoading(false);
      }
    };

    fetchInitialData();
  }, [router]);

  // --- Product Selection Handler ---
  const handleProductSelect = (productId: string) => {
    const product = products.find((p) => p.id === productId);
    if (!product) return;

    setCurrentItem({
      productId: product.id,
      sku: product.sku,
      quantity: "", // Start empty
      freeQuantity: "", // Start empty
      unit: product.unit_of_measure,
      mrp: product.mrp,
      unitPrice: product.retail_price ?? product.selling_price,
      discountPercent: "", // Start empty
      stockAvailable: product.stock_quantity,
    });

    // Auto-focus and select the quantity input field
    setTimeout(() => {
      quantityInputRef.current?.focus();
      quantityInputRef.current?.select();
    }, 150);
  };

  const resetCurrentItem = () => {
    setCurrentItem({
      productId: "",
      sku: "",
      quantity: "",
      freeQuantity: "",
      unit: "",
      mrp: "",
      unitPrice: "",
      discountPercent: "",
      stockAvailable: 0,
    });
    setEditingItemId(null);
  };

  // --- Load item into form for editing ---
  const handleEditItem = (itemId: string) => {
    const item = items.find((i) => i.id === itemId);
    if (!item) return;
    const product = products.find((p) => p.id === item.productId);
    setEditingItemId(itemId);
    setCurrentItem({
      productId: item.productId,
      sku: item.sku,
      quantity: item.quantity,
      freeQuantity: item.freeQuantity,
      unit: item.unit,
      mrp: item.mrp,
      unitPrice: item.unitPrice,
      discountPercent: item.discountPercent,
      stockAvailable: product?.stock_quantity ?? 0,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // --- Add / Update Item ---
  const handleAddItem = () => {
    if (!currentItem.productId) {
      toast.error("Please select a product");
      return;
    }

    const qty = currentItem.quantity === "" ? 0 : currentItem.quantity;
    const freeQty = currentItem.freeQuantity === "" ? 0 : currentItem.freeQuantity;

    if (qty <= 0) {
      toast.error("Quantity must be greater than 0");
      return;
    }

    const totalReqQty = qty + freeQty;
    if (totalReqQty > currentItem.stockAvailable) {
      toast.error(`Insufficient stock! Available: ${currentItem.stockAvailable}`);
      return;
    }

    const product = products.find((p) => p.id === currentItem.productId);
    if (!product) return;

    const unitPrice = currentItem.unitPrice === "" ? 0 : currentItem.unitPrice;
    const mrp = currentItem.mrp === "" ? 0 : currentItem.mrp;
    const discountPercent = currentItem.discountPercent === "" ? 0 : currentItem.discountPercent;

    const grossTotal = unitPrice * qty;
    const discountAmount = (grossTotal * discountPercent) / 100;
    const netTotal = grossTotal - discountAmount;

    const updatedItem: InvoiceItem = {
      id: editingItemId ?? Date.now().toString(),
      productId: currentItem.productId,
      sku: product.sku,
      productName: product.name,
      unit: product.unit_of_measure,
      quantity: qty,
      freeQuantity: freeQty,
      mrp: mrp,
      unitPrice: unitPrice,
      discountPercent: discountPercent,
      discountAmount: discountAmount,
      total: netTotal,
      supplier: product.supplier || "",
      retailOnly: product.retailOnly || false,
    };

    if (editingItemId) {
      setItems(items.map((i) => (i.id === editingItemId ? updatedItem : i)));
      toast.success("Item updated");
    } else {
      setItems([...items, updatedItem]);
    }

    resetCurrentItem();
  };

  const handleRemoveItem = (id: string) => {
    setItems(items.filter((item) => item.id !== id));
    if (editingItemId === id) resetCurrentItem();
  };

  const handleSaveAction = async (action: "save" | "print" | "download") => {
    if (!customerId) {
      toast.error("Please select a customer.");
      return;
    }
    if (!businessId || !userId) {
      toast.error("Session invalid. Please refresh.");
      return;
    }
    if (items.length === 0) {
      toast.error("Please add items to the invoice.");
      return;
    }

    setLoading(true);

    const invoiceData = {
      customerId,
      salesRepId: userId,
      businessId: businessId,
      items,
      invoiceNumber,
      invoiceDate,
      subTotal: subtotal,
      extraDiscountPercent: extraDiscount,
      extraDiscountAmount: extraDiscountAmount,
      grandTotal: grandTotal,
      orderStatus: "Delivered",
      paymentType: paymentType,
      paymentStatus: paymentType === "Cash" ? "Paid" : "Unpaid",
      paidAmount: paymentType === "Cash" ? grandTotal : 0,
    };

    try {
      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(invoiceData),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to create invoice");
      }

      toast.success("Invoice Created Successfully!");

      if (action === "save") {
        router.push("/dashboard/office/retail/invoices");
      } else if (action === "print") {
        router.push(
          `/dashboard/office/retail/invoices/${data.data.id}?print=true`
        );
      } else if (action === "download") {
        router.push(
          `/dashboard/office/retail/invoices/${data.data.id}?download=true`
        );
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to create invoice");
    } finally {
      setLoading(false);
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
    (p) => !items.some((i) => i.productId === p.id) || p.id === currentItem.productId
  );

  const filteredAvailableProducts = availableProducts.filter((product) => {
    if (supplierFilter === "all") return true;
    if (supplierFilter === "retail") return product.retailOnly === true;

    const sup = (product.supplier || "").toLowerCase();
    if (supplierFilter === "sierra") return sup.includes("sierra") && !product.retailOnly;
    if (supplierFilter === "wireman") return sup.includes("wireman") && !product.retailOnly;
    if (supplierFilter === "orange") return sup.includes("orange") && !product.retailOnly;
    if (supplierFilter === "other") {
      return (
        !sup.includes("sierra") &&
        !sup.includes("wireman") &&
        !sup.includes("orange") &&
        !product.retailOnly
      );
    }
    return true;
  });

  // Helper for current item calculation
  const safeUnitPrice =
    currentItem.unitPrice === "" ? 0 : currentItem.unitPrice;
  const safeQuantity = currentItem.quantity === "" ? 0 : currentItem.quantity;
  const safeDiscount =
    currentItem.discountPercent === "" ? 0 : currentItem.discountPercent;

  const currentDiscountAmt =
    (safeUnitPrice * safeQuantity * safeDiscount) / 100;

  if (loading && customers.length === 0 && allCustomers.length === 0) {
    return (
      <div className="flex justify-center items-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className={cn("mx-auto", isLandscape ? "space-y-3 pb-4" : "space-y-4 pb-28 xl:pb-6")}>

      {/* ── Page header (Desktop only) ── */}
      <div className="hidden xl:flex items-center gap-3 mb-6">
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0"
          onClick={() => router.push("/dashboard/office/retail/invoices")}
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight truncate">
            Walk-in Sale
          </h1>
          <p className="text-muted-foreground text-xs sm:text-sm mt-0.5 hidden sm:block">
            {businessName} · Create a new walk-in sale
          </p>
        </div>
        {/* Desktop action buttons */}
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleSaveAction("download")}
            disabled={items.length === 0 || loading}
          >
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
            Download
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleSaveAction("print")}
            disabled={items.length === 0 || loading}
          >
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Printer className="w-4 h-4 mr-2" />}
            Print
          </Button>
          <Button
            size="sm"
            onClick={() => handleSaveAction("save")}
            disabled={items.length === 0 || loading}
            className="bg-green-600 hover:bg-green-700"
          >
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Save Invoice
          </Button>
        </div>
      </div>



      <div className={cn(
        "grid",
        isLandscape ? "gap-3 grid-cols-[1fr_22rem]" : "gap-4 sm:gap-6 xl:grid-cols-3"
      )}>
        {/* LEFT COLUMN */}
        <div className={cn("min-w-0", isLandscape ? "space-y-3" : "xl:col-span-2 space-y-4 sm:space-y-6")}>
          {/* 1. Invoice Details */}
          <Card className="gap-0.5 xl:gap-4">
            <CardHeader className="pb-0 xl:pb-2 flex flex-row items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 xl:hidden"
                onClick={() => router.push("/dashboard/office/retail/invoices")}
              >
                <ArrowLeft className="w-4 h-4 text-slate-500" />
              </Button>
              <CardTitle className="text-base sm:text-lg">Invoice Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Customer Selection with Walk-in Button */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Label>
                      Customer <span className="text-red-500">*</span>
                    </Label>

                    {/* --- NEW: Quick Select Button for Walk-in Customer --- */}
                    {guestCustomerId && customerId !== guestCustomerId && (
                      <Button
                        variant="secondary"
                        size="sm"
                        className="h-6 text-xs bg-blue-100 text-blue-700 hover:bg-blue-200"
                        onClick={() => {
                          setCustomerId(guestCustomerId);
                          setCustomerOpen(false);
                          toast.success("Selected Walk-in Customer");
                        }}
                      >
                        Select Walk-in / Guest
                      </Button>
                    )}
                    {/* --------------------------------------------------- */}
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
                          : customers.length > 0
                            ? "Select Customer"
                            : "No Retail Customers"}
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
                          <CommandEmpty>
                            {customers.length === 0
                              ? "No customers assigned to retail business"
                              : "No customer found"}
                          </CommandEmpty>
                          <CommandGroup>
                            {customers.map((customer) => (
                              <CommandItem
                                key={customer.id}
                                value={`${customer.name} ${customer.phone || ""} ${customer.ownerName || ""}`}
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
                                <div className="flex-1">
                                  <div className="font-medium">
                                    {customer.name}
                                  </div>
                                  {customer.owner_name && (
                                    <div className="text-xs text-muted-foreground">
                                      {customer.owner_name}
                                    </div>
                                  )}
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  {/* <p className="text-xs text-muted-foreground">
                    Showing {customers.length} retail customers only
                  </p> */}
                </div>

                {/* Invoice Date */}
                <div className="space-y-2">
                  <Label>Invoice Date</Label>
                  <Input
                    type="date"
                    value={invoiceDate}
                    onChange={(e) => setInvoiceDate(e.target.value)}
                    className="h-11"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Invoice Number */}
                <div className="space-y-2">
                  <Label>Invoice No (Auto)</Label>
                  <Input value={invoiceNumber} disabled className="bg-muted h-11" />
                </div>

                {/* Payment Type */}
                <div className="space-y-2">
                  <Label>
                    Payment Type <span className="text-red-500">*</span>
                  </Label>
                  <Select value={paymentType} onValueChange={setPaymentType}>
                    <SelectTrigger className="w-full h-11">
                      <SelectValue placeholder="Select Payment Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Cash">
                        <div className="flex items-center gap-2">
                          <span>💵 Cash</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="Credit">
                        <div className="flex items-center gap-2">
                          <span>📋 Credit</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  {/* <p className="text-xs text-muted-foreground">
                    {paymentType === "Cash"
                      ? "✓ Invoice will be marked as Paid"
                      : "⏳ Customer can pay later"}
                  </p> */}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 2. Add Items */}
          <div ref={addProductCardRef} className="scroll-mt-4">
            <Card className="gap-0.5 xl:gap-4">
              <CardHeader className="pb-0 xl:pb-2">
                <CardTitle className="text-base sm:text-lg">Add Products</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 sm:space-y-4">
                {/* Product Selection */}
                <div className="grid grid-cols-4 gap-4">
                  <div className="col-span-4 space-y-2">
                    <div className="flex justify-between items-center">
                      <Label className="text-sm font-medium">
                        Product{" "}
                        {stockLoading && (
                          <Loader2 className="inline h-3 w-3 animate-spin ml-2" />
                        )}
                      </Label>
                    </div>

                    {/* Supplier Filter Buttons Row */}
                    <div className="flex gap-2 pb-2 border-b border-slate-100 overflow-x-auto scrollbar-hide flex-nowrap">
                      <Button
                        type="button"
                        variant={supplierFilter === "all" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setSupplierFilter("all")}
                        className={cn(
                          "h-8 text-xs font-semibold rounded-full transition-all duration-200 shrink-0",
                          supplierFilter === "all" && "bg-slate-900 text-white shadow-sm"
                        )}
                      >
                        🌐 All Products
                      </Button>
                      <Button
                        type="button"
                        variant={supplierFilter === "sierra" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setSupplierFilter("sierra")}
                        className={cn(
                          "h-8 text-xs font-semibold rounded-full border-purple-200 text-purple-700 hover:bg-purple-50 transition-all duration-200",
                          supplierFilter === "sierra" && "bg-purple-600 text-white border-purple-600 hover:bg-purple-700 hover:text-white shadow-sm"
                        )}
                      >
                        🟣 Sierra Cables
                      </Button>
                      <Button
                        type="button"
                        variant={supplierFilter === "wireman" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setSupplierFilter("wireman")}
                        className={cn(
                          "h-8 text-xs font-semibold rounded-full border-red-200 text-red-700 hover:bg-red-50 transition-all duration-200",
                          supplierFilter === "wireman" && "bg-red-600 text-white border-red-600 hover:bg-red-700 hover:text-white shadow-sm"
                        )}
                      >
                        🔴 Wireman
                      </Button>
                      <Button
                        type="button"
                        variant={supplierFilter === "orange" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setSupplierFilter("orange")}
                        className={cn(
                          "h-8 text-xs font-semibold rounded-full border-orange-200 text-orange-700 hover:bg-orange-50 transition-all duration-200",
                          supplierFilter === "orange" && "bg-orange-500 text-white border-orange-500 hover:bg-orange-600 hover:text-white shadow-sm"
                        )}
                      >
                        🟠 Orange
                      </Button>
                      <Button
                        type="button"
                        variant={supplierFilter === "retail" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setSupplierFilter("retail")}
                        className={cn(
                          "h-8 text-xs font-semibold rounded-full border-emerald-200 text-emerald-700 hover:bg-emerald-50 transition-all duration-200",
                          supplierFilter === "retail" && "bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700 hover:text-white shadow-sm"
                        )}
                      >
                        🛍️ Retail Only
                      </Button>
                      <Button
                        type="button"
                        variant={supplierFilter === "other" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setSupplierFilter("other")}
                        className={cn(
                          "h-8 text-xs font-semibold rounded-full border-slate-200 text-slate-700 hover:bg-slate-50 transition-all duration-200",
                          supplierFilter === "other" && "bg-slate-600 text-white border-slate-600 hover:bg-slate-700 hover:text-white shadow-sm"
                        )}
                      >
                        ⚪ Other Suppliers
                      </Button>
                    </div>

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
                            ? products.find((p) => p.id === currentItem.productId)
                              ?.name
                            : stockLoading
                              ? "Loading products..."
                              : "Select Product"}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent
                        className="w-[var(--radix-popover-trigger-width)] p-0"
                        align="start"
                        side="bottom"
                        avoidCollisions={false}
                      >
                        <Command>
                          <CommandInput placeholder="Search product..." />
                          <CommandList className="max-h-[200px]">
                            <CommandEmpty>
                              {filteredAvailableProducts.length === 0
                                ? "No products found in this category"
                                : "No products found."}
                            </CommandEmpty>
                            <CommandGroup>
                              {filteredAvailableProducts.map((product) => {
                                const isSierra = (product.supplier || "").toLowerCase().includes("sierra");
                                const isWireman = (product.supplier || "").toLowerCase().includes("wireman");
                                const isOrange = (product.supplier || "").toLowerCase().includes("orange");
                                const isRetailOnly = product.retailOnly;

                                let borderClass = "border-l-4 border-slate-300";
                                let bgHoverClass = "hover:bg-slate-50";
                                let supplierLabelName = "Retail/Other";
                                let badgeColor = "bg-slate-100 text-slate-700 border-slate-200";

                                if (isRetailOnly) {
                                  borderClass = "border-l-4 border-emerald-500";
                                  bgHoverClass = "hover:bg-emerald-50/50";
                                  supplierLabelName = "Retail Only";
                                  badgeColor = "bg-emerald-100 text-emerald-800 border-emerald-200";
                                } else if (isSierra) {
                                  borderClass = "border-l-4 border-purple-500";
                                  bgHoverClass = "hover:bg-purple-50/50";
                                  supplierLabelName = "Sierra";
                                  badgeColor = "bg-purple-100 text-purple-700 border-purple-200";
                                } else if (isWireman) {
                                  borderClass = "border-l-4 border-red-500";
                                  bgHoverClass = "hover:bg-red-50/50";
                                  supplierLabelName = "Wireman";
                                  badgeColor = "bg-red-100 text-red-700 border-red-200";
                                } else if (isOrange) {
                                  borderClass = "border-l-4 border-orange-500";
                                  bgHoverClass = "hover:bg-orange-50/50";
                                  supplierLabelName = "Orange";
                                  badgeColor = "bg-orange-100 text-orange-700 border-orange-200";
                                }

                                return (
                                  <CommandItem
                                    key={product.id}
                                    value={`${product.name} ${product.sku} ${product.supplier || ""}`}
                                    onSelect={() => {
                                      handleProductSelect(product.id);
                                      setProductOpen(false);
                                    }}
                                    className={cn(
                                      "flex items-center px-3 py-2 cursor-pointer transition-colors duration-150",
                                      borderClass,
                                      bgHoverClass
                                    )}
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
                                      <div className="flex items-center justify-between gap-2">
                                        <span className="font-semibold text-slate-900 truncate">
                                          {product.name}
                                        </span>
                                        <span className={cn(
                                          "text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0",
                                          badgeColor
                                        )}>
                                          {supplierLabelName}
                                        </span>
                                      </div>
                                      <div className="text-xs text-muted-foreground flex flex-wrap gap-x-2 gap-y-0.5 mt-0.5 font-sans">
                                        <span className="font-mono">{product.sku}</span>
                                        <span>•</span>
                                        <span>Stock: <strong className={cn(product.stock_quantity === 0 ? "text-red-500 font-bold" : "text-slate-700")}>{product.stock_quantity}</strong></span>
                                        <span>•</span>
                                        <span>LKR {(product.retail_price ?? product.selling_price).toLocaleString()}</span>
                                      </div>
                                    </div>
                                  </CommandItem>
                                );
                              })}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    {/* <p className="text-xs text-muted-foreground mt-1">
                    Showing products from your assigned warehouse locations.
                  </p> */}
                  </div>
                </div>

                {/* Quantity and Free Quantity Row */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Quantity</Label>
                    <Input
                      ref={quantityInputRef}
                      type="number"
                      min="1"
                      value={currentItem.quantity}
                      className="h-11"
                      onChange={(e) =>
                        setCurrentItem({
                          ...currentItem,
                          quantity:
                            e.target.value === "" ? "" : Number(e.target.value),
                        })
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Free Qty</Label>
                    <Input
                      type="number"
                      min="0"
                      value={currentItem.freeQuantity}
                      className="h-11"
                      onChange={(e) =>
                        setCurrentItem({
                          ...currentItem,
                          freeQuantity:
                            e.target.value === "" ? "" : Number(e.target.value),
                        })
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Unit</Label>
                    <Input
                      value={currentItem.unit || "—"}
                      disabled
                      className="bg-muted h-11 text-center font-medium"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">In Stock</Label>
                    <Input
                      value={currentItem.stockAvailable || "—"}
                      disabled
                      className={cn(
                        "h-11 text-center font-bold bg-muted",
                        currentItem.stockAvailable > 0 && currentItem.stockAvailable < 10
                          ? "text-destructive"
                          : "text-slate-700"
                      )}
                    />
                  </div>
                </div>

                {/* Price Row */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">MRP</Label>
                    <Input
                      type="number"
                      value={currentItem.mrp}
                      className="h-11"
                      onChange={(e) =>
                        setCurrentItem({
                          ...currentItem,
                          mrp:
                            e.target.value === "" ? "" : Number(e.target.value),
                        })
                      }
                      placeholder="0.00"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Unit Price</Label>
                    <Input
                      type="number"
                      value={currentItem.unitPrice}
                      className="h-11"
                      onChange={(e) =>
                        setCurrentItem({
                          ...currentItem,
                          unitPrice:
                            e.target.value === "" ? "" : Number(e.target.value),
                        })
                      }
                      placeholder="0.00"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Discount %</Label>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      value={currentItem.discountPercent}
                      className="h-11"
                      onChange={(e) =>
                        setCurrentItem({
                          ...currentItem,
                          discountPercent:
                            e.target.value === "" ? "" : Number(e.target.value),
                        })
                      }
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Line Total</Label>
                    <Input
                      value={(safeUnitPrice * safeQuantity - currentDiscountAmt).toFixed(2)}
                      disabled
                      className="h-11 font-bold bg-green-50 text-green-700 border-green-100 text-right"
                    />
                  </div>
                </div>

                {/* Add / Update Button */}
                <div className={cn("grid gap-2", editingItemId ? "grid-cols-2" : "grid-cols-1")}>
                  {editingItemId && (
                    <Button variant="outline" onClick={resetCurrentItem} className="h-12">
                      <X className="w-4 h-4 mr-2" />
                      Cancel
                    </Button>
                  )}
                  <Button
                    onClick={handleAddItem}
                    className={cn(
                      "h-12 text-base font-bold shadow-sm",
                      editingItemId
                        ? "bg-blue-600 hover:bg-blue-700"
                        : "bg-green-600 hover:bg-green-700"
                    )}
                    disabled={!currentItem.productId}
                  >
                    {editingItemId ? (
                      <><Pencil className="w-4 h-4 mr-2" />Update Item</>
                    ) : (
                      <><Plus className="w-4 h-4 mr-2" />Add to Invoice</>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 3. Items Table */}
          <Card className={cn(isLandscape ? "hidden" : "")}>
            <CardHeader className="pb-3 sm:pb-6">
              <CardTitle className="text-base sm:text-lg">Invoice Items</CardTitle>
              <CardDescription className="text-xs sm:text-sm">{items.length} item(s) added</CardDescription>
            </CardHeader>
            <CardContent className="p-3 sm:p-4 pt-0 sm:pt-0">
              {items.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-muted-foreground rounded-lg border border-dashed">
                  <Package className="w-8 h-8 mb-2 opacity-40" />
                  <p className="text-sm">No items added yet</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {items.map((item, idx) => {
                    const isSierra = (item.supplier || "").toLowerCase().includes("sierra");
                    const isWireman = (item.supplier || "").toLowerCase().includes("wireman");
                    const isOrange = (item.supplier || "").toLowerCase().includes("orange");
                    const isRetailOnly = item.retailOnly;

                    let leftBorder = "border-l-4 border-l-slate-200";
                    let supplierLabel = "";
                    let supplierBadgeCls = "bg-slate-100 text-slate-600 border-slate-200";
                    if (isRetailOnly) { leftBorder = "border-l-4 border-l-emerald-500"; supplierLabel = "Retail Only"; supplierBadgeCls = "bg-emerald-100 text-emerald-700 border-emerald-200"; }
                    else if (isSierra) { leftBorder = "border-l-4 border-l-purple-500"; supplierLabel = "Sierra"; supplierBadgeCls = "bg-purple-100 text-purple-700 border-purple-200"; }
                    else if (isWireman) { leftBorder = "border-l-4 border-l-red-500"; supplierLabel = "Wireman"; supplierBadgeCls = "bg-red-100 text-red-700 border-red-200"; }
                    else if (isOrange) { leftBorder = "border-l-4 border-l-orange-500"; supplierLabel = "Orange"; supplierBadgeCls = "bg-orange-100 text-orange-700 border-orange-200"; }

                    const isEditing = editingItemId === item.id;

                    return (
                      <div
                        key={item.id}
                        className={cn(
                          "flex items-center gap-3 rounded-lg border bg-card px-3 py-2.5 transition-colors",
                          leftBorder,
                          isEditing ? "bg-blue-50/60 border-blue-200" : "hover:bg-muted/40"
                        )}
                      >
                        {/* Index */}
                        <span className="text-xs text-muted-foreground w-5 shrink-0 text-center font-medium">
                          {idx + 1}
                        </span>

                        {/* Product info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-medium text-sm leading-tight">{item.productName}</span>
                            {supplierLabel && (
                              <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded border shrink-0", supplierBadgeCls)}>
                                {supplierLabel}
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-x-2.5 gap-y-0 mt-1 text-xs text-muted-foreground">
                            <span className="font-mono text-[11px]">{item.sku}</span>
                            <span>·</span>
                            <span>{item.quantity} {item.unit}</span>
                            {item.freeQuantity > 0 && <><span>·</span><span className="text-green-600">+{item.freeQuantity} free</span></>}
                            <span>·</span>
                            <span>LKR {item.unitPrice.toLocaleString()}</span>
                            {item.discountPercent > 0 && <><span>·</span><span className="text-orange-600">{item.discountPercent}% off</span></>}
                          </div>
                        </div>

                        {/* Total + actions */}
                        <div className="flex items-center gap-1 shrink-0">
                          <span className="font-bold text-sm text-slate-800 min-w-[60px] text-right">
                            {item.total.toLocaleString()}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className={cn("h-7 w-7 shrink-0", isEditing && "bg-blue-100 text-blue-600")}
                            onClick={() => handleEditItem(item.id)}
                          >
                            <Pencil className="w-3.5 h-3.5 text-blue-500" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 shrink-0"
                            onClick={() => handleRemoveItem(item.id)}
                          >
                            <Trash2 className="w-3.5 h-3.5 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* RIGHT COLUMN — desktop sidebar + landscape POS */}
        <div className={cn(isLandscape ? "block" : "xl:col-span-1 hidden xl:block")}>
          <Card className="sticky top-6 border shadow-sm">
            <CardHeader className="pb-2 border-b">
              <CardTitle className="text-base font-semibold text-slate-700">Invoice Summary</CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-4">

              {/* Customer & billing info — Desktop only */}
              {isDesktopScreen && (
                <div className="space-y-2.5 mb-4">
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">Customer</p>
                    <p className="text-sm font-semibold mt-0.5 leading-snug wrap-break-word text-slate-800">
                      {customers.find((c) => c.id === customerId)?.name || <span className="text-muted-foreground italic">Not selected</span>}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">Business</p>
                    <p className="text-sm font-medium mt-0.5 leading-snug wrap-break-word text-slate-700">{businessName}</p>
                  </div>
                  <div className="flex gap-4">
                    <div className="flex-1">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">Payment</p>
                      <p className={cn("text-sm font-semibold mt-0.5", paymentType === "Cash" ? "text-green-600" : "text-orange-600")}>
                        {paymentType === "Cash" ? "💵 Cash" : "📋 Credit"}
                      </p>
                    </div>
                    <div className="flex-1">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">Date</p>
                      <p className="text-sm font-medium mt-0.5 text-slate-700">{invoiceDate}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Invoice Items list in sidebar — Mobile/Tablet only */}
              {!isDesktopScreen && (
                <>
                  {items.length > 0 ? (
                    <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
                      {items.map((item, idx) => {
                        const isSierra = (item.supplier || "").toLowerCase().includes("sierra");
                        const isWireman = (item.supplier || "").toLowerCase().includes("wireman");
                        const isOrange = (item.supplier || "").toLowerCase().includes("orange");
                        const isRetailOnly = item.retailOnly;

                        let leftBorder = "border-l-4 border-l-slate-300";
                        let supplierLabel = "";
                        let supplierBadgeCls = "bg-slate-100 text-slate-600 border-slate-200";
                        if (isRetailOnly) {
                          leftBorder = "border-l-4 border-l-emerald-500";
                          supplierLabel = "Retail Only";
                          supplierBadgeCls = "bg-emerald-50 text-emerald-700 border-emerald-100";
                        } else if (isSierra) {
                          leftBorder = "border-l-4 border-l-purple-500";
                          supplierLabel = "Sierra";
                          supplierBadgeCls = "bg-purple-50 text-purple-700 border-purple-100";
                        } else if (isWireman) {
                          leftBorder = "border-l-4 border-l-red-500";
                          supplierLabel = "Wireman";
                          supplierBadgeCls = "bg-red-50 text-red-700 border-red-100";
                        } else if (isOrange) {
                          leftBorder = "border-l-4 border-l-orange-500";
                          supplierLabel = "Orange";
                          supplierBadgeCls = "bg-orange-50 text-orange-700 border-orange-100";
                        }

                        const isEditing = editingItemId === item.id;

                        return (
                          <div
                            key={item.id}
                            className={cn(
                              "flex items-start justify-between gap-2 rounded-lg border bg-slate-50/50 p-2 transition-all duration-200",
                              leftBorder,
                              isEditing ? "bg-blue-50/80 border-blue-200 shadow-sm" : "hover:bg-slate-100/70 border-slate-100"
                            )}
                          >
                            {/* Details */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1 flex-wrap">
                                <span className="font-semibold text-xs leading-tight text-slate-800 break-words">{item.productName}</span>
                                {supplierLabel && (
                                  <span className={cn("text-[9px] font-bold px-1 py-0.2 rounded border shrink-0", supplierBadgeCls)}>
                                    {supplierLabel}
                                  </span>
                                )}
                              </div>
                              <div className="flex flex-wrap gap-x-2 gap-y-0.5 mt-1 text-[10px] text-muted-foreground font-sans">
                                <span className="font-mono text-[9px]">{item.sku}</span>
                                <span>·</span>
                                <span>{item.quantity} {item.unit}</span>
                                {item.freeQuantity > 0 && <span className="text-green-600 font-medium">+{item.freeQuantity} free</span>}
                                <span>·</span>
                                <span>LKR {item.unitPrice.toLocaleString()}</span>
                                {item.discountPercent > 0 && <span className="text-orange-600 font-semibold">{item.discountPercent}% off</span>}
                              </div>
                            </div>

                            {/* Total + Actions */}
                            <div className="flex flex-col items-end gap-1.5 shrink-0 ml-2">
                              <span className="font-bold text-xs text-slate-800">
                                {item.total.toLocaleString()}
                              </span>
                              <div className="flex gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className={cn("h-6 w-6 rounded-md hover:bg-blue-100/50 text-blue-500", isEditing && "bg-blue-100 text-blue-600")}
                                  onClick={() => handleEditItem(item.id)}
                                >
                                  <Pencil className="w-3 h-3" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 rounded-md hover:bg-red-100/50 text-destructive"
                                  onClick={() => handleRemoveItem(item.id)}
                                >
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-6 text-muted-foreground rounded-lg border border-dashed border-slate-200 bg-slate-50/20">
                      <Package className="w-6 h-6 mb-1.5 opacity-30 text-slate-400" />
                      <p className="text-xs">No items in the invoice</p>
                    </div>
                  )}
                </>
              )}

              {/* Totals breakdown */}
              <div className="border-t pt-3 space-y-1.5">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Items</span>
                  <span className="font-medium text-slate-700">{items.length}</span>
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Gross Total</span>
                  <span className="font-medium text-slate-700">LKR {grossTotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Item Discounts</span>
                  <span className="font-medium text-red-500">− LKR {totalItemDiscount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm font-semibold text-slate-800 pt-1 border-t">
                  <span>Subtotal</span>
                  <span>LKR {subtotal.toLocaleString()}</span>
                </div>
              </div>

              {/* Extra Discount */}
              <div className="border-t pt-3 space-y-2">
                <Label className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Extra Discount %</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={extraDiscount}
                  onChange={(e) => setExtraDiscount(Number(e.target.value))}
                  className="h-10"
                />
                {extraDiscountAmount > 0 && (
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Extra Discount</span>
                    <span className="font-medium text-red-500">− LKR {extraDiscountAmount.toLocaleString()}</span>
                  </div>
                )}
              </div>

              {/* Grand Total block */}
              <div className="rounded-xl bg-green-50 border border-green-100 p-3.5">
                <p className="text-[10px] uppercase tracking-widest text-green-700 font-bold mb-1">Grand Total</p>
                <p className="text-2xl font-black text-green-700 leading-none">
                  LKR {grandTotal.toLocaleString()}
                </p>
                {items.length > 0 && (
                  <p className="text-[11px] text-green-600 mt-1.5">{items.length} product{items.length !== 1 ? "s" : ""} · {paymentType}</p>
                )}
              </div>

              {/* Quick action buttons in sidebar */}
              {isDesktopScreen ? (
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleSaveAction("print")}
                    disabled={items.length === 0 || loading}
                    className="h-10 text-xs font-medium"
                  >
                    {loading ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Printer className="w-3.5 h-3.5 mr-1.5" />}
                    Print
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleSaveAction("save")}
                    disabled={items.length === 0 || loading}
                    className="h-10 bg-green-600 hover:bg-green-700 text-xs font-bold"
                  >
                    {loading ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1.5" />}
                    Save
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-1.5 pt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleSaveAction("download")}
                    disabled={items.length === 0 || loading}
                    className="h-10 text-xs font-medium px-1"
                  >
                    {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3 mr-1 shrink-0" />}
                    <span>PDF</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleSaveAction("print")}
                    disabled={items.length === 0 || loading}
                    className="h-10 text-xs font-medium px-1"
                  >
                    {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Printer className="w-3 h-3 mr-1 shrink-0" />}
                    <span>Print</span>
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleSaveAction("save")}
                    disabled={items.length === 0 || loading}
                    className="h-10 bg-green-600 hover:bg-green-700 text-xs font-bold px-1 text-white"
                  >
                    {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3 mr-1 shrink-0" />}
                    <span>Save</span>
                  </Button>
                </div>
              )}

            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── Mobile / Tablet sticky bottom bar — hidden in landscape (summary panel takes over) ── */}
      {!isLandscape && <div className="xl:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t shadow-lg px-4 py-3">
        <div className="flex items-center gap-3 max-w-2xl mx-auto">
          {/* Mini totals */}
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-1.5">
              <span className="text-xs text-muted-foreground">Total</span>
              <span className="font-bold text-base text-green-600 truncate">
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
            <Label className="text-xs text-muted-foreground whitespace-nowrap">Extra %</Label>
            <Input
              type="number"
              min="0"
              max="100"
              placeholder="0"
              value={extraDiscount}
              onChange={(e) => setExtraDiscount(Number(e.target.value))}
              className="w-16 h-9 text-sm text-center"
            />
          </div>

          {/* Print (icon only on small) */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleSaveAction("print")}
            disabled={items.length === 0 || loading}
            className="h-10 shrink-0"
          >
            <Printer className="w-4 h-4" />
            <span className="hidden sm:inline ml-1.5">Print</span>
          </Button>

          {/* Save */}
          <Button
            size="sm"
            onClick={() => handleSaveAction("save")}
            disabled={items.length === 0 || loading}
            className="h-10 bg-green-600 hover:bg-green-700 font-bold shrink-0"
          >
            {loading ? <Loader2 className="w-4 h-4 sm:mr-1.5 animate-spin" /> : <Save className="w-4 h-4 sm:mr-1.5" />}
            <span className="hidden sm:inline">Save Invoice</span>
          </Button>
        </div>
      </div>}
    </div>
  );
}
