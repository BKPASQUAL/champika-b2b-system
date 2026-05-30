// app/dashboard/office/retail/invoices/[id]/edit/page.tsx
"use client";

import React, { useState, useEffect, use } from "react";
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
import { Textarea } from "@/components/ui/textarea";
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
  stockAvailable?: number; // Added for edit validation
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

export default function EditRetailInvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
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
  
  // Guest Customer Logic (kept for consistency with Create page)
  const [guestCustomerId, setGuestCustomerId] = useState<string | null>(null);

  // Form State
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [invoiceDate, setInvoiceDate] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [paymentType, setPaymentType] = useState<string>("Cash");
  const [changeReason, setChangeReason] = useState(""); // Audit Log

  // Items State
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [extraDiscount, setExtraDiscount] = useState<number>(0);

  // Popover States
  const [customerOpen, setCustomerOpen] = useState(false);
  const [productOpen, setProductOpen] = useState(false);

  // Supplier filter state
  const [supplierFilter, setSupplierFilter] = useState<"all" | "sierra" | "wireman" | "orange" | "retail" | "other">("all");

  // Current Item Being Added
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

  // --- 1. Fetch Data ---
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        // 1. Check User Context
        const user = getUserBusinessContext();
        if (!user) {
          toast.error("User context not found");
          router.push("/login");
          return;
        }

        setBusinessId(BUSINESS_IDS.CHAMPIKA_RETAIL);
        setBusinessName(user.businessName ?? BUSINESS_NAMES[BUSINESS_IDS.CHAMPIKA_RETAIL]);
        setUserId(user.id);

        // 2. Fetch Data (Invoice, Customers, Products)
        const [invRes, custRes, prodRes] = await Promise.all([
          fetch(`/api/invoices/${id}`),
          fetch(`/api/customers?businessId=${BUSINESS_IDS.CHAMPIKA_RETAIL}&status=Active`),
          fetch(`/api/rep/stock?userId=${user.id}`),
        ]);

        if (!invRes.ok) throw new Error("Failed to load invoice");

        const invoice = await invRes.json();
        const customersData = await custRes.json();
        const productsData = await prodRes.json();

        // 3. Setup Customers
        const retailCustomers = customersData;
        
        // Find Guest Customer (Logic from Create Page)
        const guest = retailCustomers.find((c: any) => {
          const nameToCheck = (c.shop_name || c.name || "").toLowerCase();
          return nameToCheck.includes("walk-in") || nameToCheck.includes("guest");
        });
        if (guest) setGuestCustomerId(guest.id);

        setCustomers(retailCustomers.map((c: any) => ({
          id: c.id,
          name: c.shop_name || c.name,
          shop_name: c.shop_name,
          owner_name: c.owner_name,
          business_id: c.business_id,
        })));

        // 4. Setup Products
        if (Array.isArray(productsData)) {
          setProducts(productsData.map((p: any) => ({
            id: p.id,
            sku: p.sku,
            name: p.name,
            selling_price: p.selling_price || 0,
            mrp: p.mrp || 0,
            stock_quantity: p.stock_quantity || 0,
            unit_of_measure: p.unit_of_measure || "unit",
            supplier: p.supplier || "",
            retailOnly: p.retailOnly ?? p.retail_only ?? false,
          })));
        }

        // 5. Populate Form with Invoice Data
        setInvoiceNumber(invoice.invoiceNo);
        setInvoiceDate(invoice.date);
        setCustomerId(invoice.customerId);
        setPaymentType(
          invoice.payments && invoice.payments.length > 0
            ? invoice.payments[0].method
            : "Cash"
        );
        setExtraDiscount(invoice.extraDiscountPercent || 0);

        // 6. Populate Items
        setItems(invoice.items.map((item: any) => ({
          id: item.id || `EXISTING-${Math.random()}`,
          productId: item.productId,
          sku: item.sku,
          productName: item.productName || item.name,
          quantity: item.quantity,
          freeQuantity: item.freeQuantity || 0,
          unit: item.unit,
          mrp: item.mrp,
          unitPrice: item.unitPrice, // Make sure this comes from API
          discountPercent: item.discountPercent || 0,
          discountAmount: item.discountAmount || 0,
          total: item.total,
          stockAvailable: item.stockAvailable || 0, // Might come from API or 0
          supplier: item.supplier || "",
          retailOnly: item.retailOnly ?? item.retail_only ?? false,
        })));

      } catch (error) {
        console.error("Error loading data:", error);
        toast.error("Failed to load invoice data");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [id, router]);

  // --- Product Selection ---
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
  };

  // --- Add Item ---
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

    const product = products.find((p) => p.id === currentItem.productId);
    if (!product) return;

    const unitPrice = currentItem.unitPrice === "" ? 0 : currentItem.unitPrice;
    const mrp = currentItem.mrp === "" ? 0 : currentItem.mrp;
    const discountPercent = currentItem.discountPercent === "" ? 0 : currentItem.discountPercent;

    const grossTotal = unitPrice * qty;
    const discountAmount = (grossTotal * discountPercent) / 100;
    const netTotal = grossTotal - discountAmount;

    const newItem: InvoiceItem = {
      id: `NEW-${Date.now()}`,
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
      stockAvailable: product.stock_quantity,
      supplier: product.supplier || "",
      retailOnly: product.retailOnly || false,
    };

    setItems([...items, newItem]);

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
  };

  const handleRemoveItem = (id: string) => {
    setItems(items.filter((item) => item.id !== id));
  };

  // --- Update Item (Inline Edit) ---
  const handleUpdateItem = (id: string, field: keyof InvoiceItem, value: number) => {
    setItems(prevItems => prevItems.map(item => {
      if (item.id === id) {
        const updatedItem = { ...item, [field]: value };
        
        // Recalculate totals
        const gross = updatedItem.unitPrice * updatedItem.quantity;
        const discount = (gross * updatedItem.discountPercent) / 100;
        
        updatedItem.discountAmount = discount;
        updatedItem.total = gross - discount;
        
        return updatedItem;
      }
      return item;
    }));
  };

  // --- Save / Update Handler ---
  const handleSaveAction = async (action: "save" | "print" | "download") => {
    if (!customerId) {
      toast.error("Customer is required");
      return;
    }
    if (items.length === 0) {
      toast.error("Invoice must have at least one item");
      return;
    }

    setLoading(true);

    const invoiceData = {
      customerId,
      salesRepId: userId,
      businessId: businessId,
      items,
      invoiceNumber, // Used for logging mostly, backend generates new ones only on create
      invoiceDate,
      subTotal: subtotal,
      extraDiscountPercent: extraDiscount,
      extraDiscountAmount: extraDiscountAmount,
      grandTotal: grandTotal,
      orderStatus: "Delivered", // Standard retail status
      paymentType: paymentType,
      paymentStatus: paymentType === "Cash" ? "Paid" : "Unpaid",
      paidAmount: paymentType === "Cash" ? grandTotal : 0,
      notes: "",
      changeReason: changeReason || "Updated invoice details", // Optional reason
      userId: userId, // For Audit
    };

    try {
      const res = await fetch(`/api/invoices/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(invoiceData),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Update failed");

      toast.success("Invoice Updated Successfully!");

      if (action === "save") {
        router.push("/dashboard/office/retail/invoices");
      } else if (action === "print") {
        router.push(`/dashboard/office/retail/invoices/${id}?print=true`);
      } else if (action === "download") {
        router.push(`/dashboard/office/retail/invoices/${id}?download=true`);
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  // --- Totals Calculation ---
  const subtotal = items.reduce((sum, item) => sum + item.total, 0);
  const totalItemDiscount = items.reduce((sum, item) => sum + item.discountAmount, 0);
  const grossTotal = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);

  const extraDiscountAmount = (subtotal * extraDiscount) / 100;
  const grandTotal = subtotal - extraDiscountAmount;

  const availableProducts = products.filter(
    (p) => !items.some((i) => i.productId === p.id)
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
  const safeUnitPrice = currentItem.unitPrice === "" ? 0 : currentItem.unitPrice;
  const safeQuantity = currentItem.quantity === "" ? 0 : currentItem.quantity;
  const safeDiscount = currentItem.discountPercent === "" ? 0 : currentItem.discountPercent;
  const currentDiscountAmt = (safeUnitPrice * safeQuantity * safeDiscount) / 100;

  if (loading && items.length === 0) {
    return (
      <div className="flex justify-center items-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4 mx-auto pb-16 lg:pb-0">
      <div className="flex flex-col md:flex-row items-center gap-4">
        <div className="flex items-center gap-4 w-full md:w-auto">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/dashboard/office/retail/invoices")}
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold tracking-tight">Edit Retail Invoice</h1>
            <p className="text-muted-foreground mt-1">
              Modifying: {invoiceNumber}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto md:ml-auto">
          <Button
            variant="outline"
            onClick={() => handleSaveAction("download")}
            disabled={items.length === 0 || loading}
            className="flex-1 md:flex-initial text-xs md:text-sm px-2.5 md:px-4"
          >
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
            Save & Download
          </Button>

          <Button
            variant="outline"
            onClick={() => handleSaveAction("print")}
            disabled={items.length === 0 || loading}
            className="flex-1 md:flex-initial text-xs md:text-sm px-2.5 md:px-4"
          >
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Printer className="w-4 h-4 mr-2" />}
            Save & Print
          </Button>

          <Button
            onClick={() => handleSaveAction("save")}
            disabled={items.length === 0 || loading}
            className="flex-1 md:flex-initial text-xs md:text-sm px-2.5 md:px-4 bg-green-600 hover:bg-green-700"
          >
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Update Invoice
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* LEFT COLUMN */}
        <div className="lg:col-span-2 space-y-6">
          {/* 1. Invoice Details */}
          <Card>
            <CardHeader>
              <CardTitle>Invoice Details</CardTitle>
              <CardDescription>Customer and billing information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Label>Customer <span className="text-red-500">*</span></Label>
                    {guestCustomerId && (
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
                          ? customers.find((c) => c.id === customerId)?.name || "Unknown Customer"
                          : "Select Customer"}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Search customer..." />
                        <CommandList>
                          <CommandEmpty>No customer found</CommandEmpty>
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
                                  className={cn("mr-2 h-4 w-4", customerId === customer.id ? "opacity-100" : "opacity-0")}
                                />
                                <div className="flex-1">
                                  <div className="font-medium">{customer.name}</div>
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <Label>Invoice Date</Label>
                  <Input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Invoice No</Label>
                  <Input value={invoiceNumber} disabled className="bg-muted" />
                </div>

                <div className="space-y-2">
                  <Label>Payment Type</Label>
                  <Select value={paymentType} onValueChange={setPaymentType}>
                    <SelectTrigger className="w-full"><SelectValue placeholder="Select Type" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Cash">💵 Cash</SelectItem>
                      <SelectItem value="Credit">📋 Credit</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 2. Add Items */}
          <Card>
            <CardHeader>
              <CardTitle>Add Products</CardTitle>
              <CardDescription>Search and add new products</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Product Search */}
              <div className="space-y-2">
                <Label>Product {stockLoading && <Loader2 className="inline h-3 w-3 animate-spin ml-2" />}</Label>
                
                {/* Supplier Filter Buttons Row */}
                <div className="flex flex-wrap gap-2 pb-2 border-b border-slate-100">
                  <Button
                    type="button"
                    variant={supplierFilter === "all" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSupplierFilter("all")}
                    className={cn(
                      "h-8 text-xs font-semibold rounded-full transition-all duration-200",
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
                    <Button variant="outline" role="combobox" aria-expanded={productOpen} className="w-full justify-between" disabled={stockLoading}>
                      {currentItem.productId ? products.find((p) => p.id === currentItem.productId)?.name : "Select Product"}
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
                      <CommandList>
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
                                <Check className={cn("mr-2 h-4 w-4 shrink-0", currentItem.productId === product.id ? "opacity-100" : "opacity-0")} />
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
                                    <span>LKR {product.selling_price.toLocaleString()}</span>
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
              </div>

              {/* Add Form Inputs */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="space-y-2">
                  <Label>Quantity</Label>
                  <Input type="number" min="1" value={currentItem.quantity} onChange={(e) => setCurrentItem({ ...currentItem, quantity: e.target.value === "" ? "" : Number(e.target.value) })} />
                </div>
                <div className="space-y-2">
                  <Label>Free Qty</Label>
                  <Input type="number" min="0" value={currentItem.freeQuantity} onChange={(e) => setCurrentItem({ ...currentItem, freeQuantity: e.target.value === "" ? "" : Number(e.target.value) })} />
                </div>
                <div className="space-y-2">
                  <Label>Unit Price</Label>
                  <Input type="number" value={currentItem.unitPrice} onChange={(e) => setCurrentItem({ ...currentItem, unitPrice: e.target.value === "" ? "" : Number(e.target.value) })} />
                </div>
                <div className="space-y-2">
                  <Label>Disc %</Label>
                  <Input type="number" value={currentItem.discountPercent} onChange={(e) => setCurrentItem({ ...currentItem, discountPercent: e.target.value === "" ? "" : Number(e.target.value) })} />
                </div>
              </div>

              <div className="space-y-2">
                 <Label>Total Preview</Label>
                 <Input value={(safeUnitPrice * safeQuantity - currentDiscountAmt).toFixed(2)} disabled className="font-bold bg-muted" />
              </div>

              <Button onClick={handleAddItem} className="w-full bg-green-600 hover:bg-green-700" disabled={!currentItem.productId}>
                <Plus className="w-4 h-4 mr-2" /> Add to Invoice
              </Button>
            </CardContent>
          </Card>

          {/* 3. Items Table (Editable) */}
          <Card>
            <CardHeader>
              <CardTitle>Invoice Items (Editable)</CardTitle>
              <CardDescription>{items.length} item(s) added. Adjust values directly below.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead className="w-[250px]">Product</TableHead>
                      <TableHead className="w-20 text-center">Qty</TableHead>
                      <TableHead className="w-20 text-center">Free</TableHead>
                      <TableHead className="w-24 text-right">Price</TableHead>
                      <TableHead className="w-20 text-center">Disc%</TableHead>
                      <TableHead className="w-28 text-right">Total</TableHead>
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                          <Package className="w-8 h-8 mx-auto mb-2 opacity-50" />
                          No items
                        </TableCell>
                      </TableRow>
                    ) : (
                      items.map((item, idx) => {
                        const isSierra = (item.supplier || "").toLowerCase().includes("sierra");
                        const isWireman = (item.supplier || "").toLowerCase().includes("wireman");
                        const isOrange = (item.supplier || "").toLowerCase().includes("orange");
                        const isRetailOnly = item.retailOnly;
                        
                        let rowBorderClass = "border-l-4 border-l-slate-300";
                        let supplierBadge = null;
                        
                        if (isRetailOnly) {
                          rowBorderClass = "border-l-4 border-l-emerald-500 bg-emerald-50/10";
                          supplierBadge = (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-emerald-100 text-emerald-800 border-emerald-200 ml-2">
                              Retail Only
                            </span>
                          );
                        } else if (isSierra) {
                          rowBorderClass = "border-l-4 border-l-purple-500 bg-purple-50/10";
                          supplierBadge = (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-purple-100 text-purple-700 border-purple-200 ml-2">
                              Sierra
                            </span>
                          );
                        } else if (isWireman) {
                          rowBorderClass = "border-l-4 border-l-red-500 bg-red-50/10";
                          supplierBadge = (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-red-100 text-red-700 border-red-200 ml-2">
                              Wireman
                            </span>
                          );
                        } else if (isOrange) {
                          rowBorderClass = "border-l-4 border-l-orange-500 bg-orange-50/10";
                          supplierBadge = (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-orange-100 text-orange-700 border-orange-200 ml-2">
                              Orange
                            </span>
                          );
                        }
                        
                        return (
                          <TableRow key={item.id} className={rowBorderClass}>
                            <TableCell>{idx + 1}</TableCell>
                            <TableCell>
                              <div className="flex items-center">
                                <span className="font-medium text-slate-900">{item.productName}</span>
                                {supplierBadge}
                              </div>
                              <div className="text-xs text-muted-foreground font-mono mt-0.5">
                                {item.sku}
                              </div>
                            </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              className="h-8 w-20 text-center"
                              value={item.quantity}
                              onChange={(e) => handleUpdateItem(item.id, 'quantity', Number(e.target.value))}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              className="h-8 w-20 text-center"
                              value={item.freeQuantity}
                              onChange={(e) => handleUpdateItem(item.id, 'freeQuantity', Number(e.target.value))}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              className="h-8 w-24 text-right"
                              value={item.unitPrice}
                              onChange={(e) => handleUpdateItem(item.id, 'unitPrice', Number(e.target.value))}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              className="h-8 w-20 text-center"
                              value={item.discountPercent}
                              onChange={(e) => handleUpdateItem(item.id, 'discountPercent', Number(e.target.value))}
                            />
                          </TableCell>
                          <TableCell className="text-right font-bold">
                            {item.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </TableCell>
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

        {/* RIGHT COLUMN */}
        <div className="lg:col-span-1 space-y-6">
          <Card className="sticky top-6">
            <CardHeader>
              <CardTitle>Invoice Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Customer:</span>
                  <span className="font-medium">{customers.find((c) => c.id === customerId)?.name || "-"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Date:</span>
                  <span className="font-medium">{invoiceDate}</span>
                </div>
              </div>

              <div className="border-t pt-4 space-y-2">
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
                  <Input type="number" min="0" max="100" value={extraDiscount} onChange={(e) => setExtraDiscount(Number(e.target.value))} />
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Extra Discount:</span>
                  <span className="text-destructive">- LKR {extraDiscountAmount.toLocaleString()}</span>
                </div>
              </div>

              <div className="border-t pt-4">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-bold">Grand Total:</span>
                  <span className="text-2xl font-bold text-green-600">LKR {grandTotal.toLocaleString()}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Audit Log (Required by API) */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Audit Log</CardTitle>
            </CardHeader>
            <CardContent>
              <Label className="text-xs text-muted-foreground mb-1 block">Modification Reason (Optional)</Label>
              <Textarea 
                placeholder="Reason for changes..." 
                value={changeReason}
                onChange={(e) => setChangeReason(e.target.value)}
                className="h-20 text-sm resize-none"
              />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Sleek Sticky Bottom Summary Bar for Mobile & Tablets */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 px-4 py-3 shadow-lg flex items-center justify-between gap-4 transition-all duration-300">
        <div className="flex flex-col">
          <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">
            Total ({items.length} items)
          </span>
          <span className="text-lg font-extrabold text-green-600">
            LKR {grandTotal.toLocaleString()}
          </span>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleSaveAction("print")}
            disabled={items.length === 0 || loading}
            className="h-10 text-xs px-2.5"
          >
            <Printer className="w-4 h-4" />
          </Button>
          <Button
            size="sm"
            onClick={() => handleSaveAction("save")}
            disabled={items.length === 0 || loading}
            className="h-10 bg-green-600 hover:bg-green-700 font-bold px-4 text-xs"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 mr-1 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-1" />
            )}
            Update Invoice
          </Button>
        </div>
      </div>
    </div>
  );
}