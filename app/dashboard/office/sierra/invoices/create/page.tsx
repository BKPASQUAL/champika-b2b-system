"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { invalidatePaymentCaches, invalidateCache } from "@/hooks/useCachedFetch";
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
  AlertTriangle,
  Paperclip,
  Camera,
  ImageIcon,
  FileText,
  File,
  Upload,
  Share2,
  Copy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
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
import { getUserBusinessContext } from "@/app/middleware/businessAuth";
import { BUSINESS_IDS } from "@/app/config/business-constants";
import { CustomerDialogs } from "../../customers/_components/CustomerDialogs";
import { CustomerFormData } from "../../customers/types";
import { SearchableDropdown } from "@/components/ui/searchable-dropdown";
import { printInvoice, downloadInvoice } from "../print-utils";
import { DocumentAttachments } from "@/components/ui/DocumentAttachments";

// --- Types ---

interface Product {
  id: string;
  sku: string;
  name: string;
  selling_price: number;
  mrp: number;
  stock_quantity: number;
  unit_of_measure: string;
  company_code?: string;
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

const parseNumber = (val: string | number) => {
  if (val === "" || val === undefined || val === null) return 0;
  return Number(val);
};

export default function CreateSierraInvoicePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [stockLoading, setStockLoading] = useState(false);

  const qtyInputRef = useRef<HTMLInputElement>(null);

  // Business Context
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [outOfStockOverride, setOutOfStockOverride] = useState(false);
  const [currentUser, setCurrentUser] = useState<{
    id: string;
    name: string;
    email: string;
  } | null>(null);

  // Data State
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<{ id: string; name: string; phone?: string; ownerName?: string }[]>([]);

  // Form State
  const [customerId, setCustomerId] = useState<string>("");
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split("T")[0]);
  const [manualInvoiceNo, setManualInvoiceNo] = useState("");
  const [noManualRef, setNoManualRef] = useState(false);
  const [isIncorrect, setIsIncorrect] = useState(false);
  const paymentType = "Credit";

  // Temporary Upload Link & Sync State
  const [tempInvoiceId, setTempInvoiceId] = useState(() => {
    if (typeof window !== "undefined" && window.crypto?.randomUUID) {
      return window.crypto.randomUUID();
    }
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
      const r = (Math.random() * 16) | 0;
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  });

  const salesRepId = currentUser?.id || "";
  const orderStatus = "Delivered";

  // New Customer Dialog State
  const [isAddCustomerDialogOpen, setIsAddCustomerDialogOpen] = useState(false);
  const [customerFormData, setCustomerFormData] = useState<CustomerFormData>({
    shopName: "",
    ownerName: "",
    phone: "",
    email: "",
    address: "",
    route: "General",
    status: "Active",
    creditLimit: 0,
    businessId: BUSINESS_IDS.SIERRA_AGENCY,
  });

  // Items State
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [extraDiscount, setExtraDiscount] = useState<number | string>("");

  // Popover state
  const [productOpen, setProductOpen] = useState(false);

  const [currentItem, setCurrentItem] = useState<{
    productId: string;
    sku: string;
    quantity: number | string;
    freeQuantity: number | string;
    unit: string;
    mrp: number | string;
    unitPrice: number | string;
    discountPercent: number | string;
    stockAvailable: number;
  }>({
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

  // 1. Fetch Initial Data
  useEffect(() => {
    const fetchInitialData = async () => {
      setLoading(true);
      try {
        const user = getUserBusinessContext();
        if (!user) {
          toast.error("Session missing. Please log in again.");
          router.push("/login");
          return;
        }

        setBusinessId(BUSINESS_IDS.SIERRA_AGENCY);
        setCurrentUser({ id: user.id, name: user.name, email: user.email });

        const customersRes = await fetch(`/api/customers?businessId=${BUSINESS_IDS.SIERRA_AGENCY}`);
        const customersData = await customersRes.json();
        setCustomers(
          customersData.map((c: any) => ({
            id: c.id,
            name: c.shopName,
            phone: c.phone || "",
            ownerName: c.ownerName || "",
          })),
        );

        // Load stock override setting
        try {
          const overrideRes = await fetch("/api/settings/portal-stock-override");
          if (overrideRes.ok) {
            const overrideData = await overrideRes.json();
            setOutOfStockOverride(overrideData.sierra ?? false);
          }
        } catch (err) {
          console.error("Error loading portal stock overrides:", err);
        }
      } catch (error) {
        console.error("Error fetching data:", error);
        toast.error("Failed to load initial data");
      } finally {
        setLoading(false);
      }
    };

    fetchInitialData();
  }, [router]);

  // 2. Fetch Products
  useEffect(() => {
    const fetchUserStock = async () => {
      if (!salesRepId) return;

      setStockLoading(true);
      try {
        const res = await fetch(`/api/rep/stock?userId=${salesRepId}&supplierLike=Sierra${outOfStockOverride ? "&includeOutOfStock=true" : ""}`);
        if (!res.ok) throw new Error("Failed to load stock");

        const productsData = await res.json();
        setProducts(
          productsData.map((p: any) => ({
            id: p.id,
            sku: p.sku,
            name: p.name,
            selling_price: p.selling_price,
            mrp: p.mrp,
            stock_quantity: p.stock_quantity,
            unit_of_measure: p.unit_of_measure || "unit",
            company_code: p.company_code,
          })),
        );
      } catch (error) {
        console.error("Error fetching stock:", error);
        toast.error("Failed to load your product stock");
        setProducts([]);
      } finally {
        setStockLoading(false);
      }
    };

    fetchUserStock();
  }, [salesRepId, outOfStockOverride]);

  // Handlers
  const handleProductSelect = (selectedId: string) => {
    const product = products.find((p) => p.id === selectedId);
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

    setTimeout(() => {
      qtyInputRef.current?.focus({ preventScroll: true });
    }, 100);
  };

  // --- Global Keyboard Shortcuts ---
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.shiftKey && (e.key === "f" || e.key === "F")) {
        e.preventDefault();
        const triggers = document.querySelectorAll('button[role="combobox"]');
        if (triggers && triggers.length > 0) {
          (triggers[0] as HTMLElement).click();
        }
      }
    };
    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddItem();
    }
  };

  const handleAddItem = () => {
    if (!currentItem.productId) {
      toast.error("Please select a valid product");
      return;
    }

    const qty = parseNumber(currentItem.quantity);
    const freeQty = parseNumber(currentItem.freeQuantity);

    if (qty <= 0) {
      toast.error("Please enter a valid quantity");
      return;
    }

    const totalReqQty = qty + freeQty;
    if (!outOfStockOverride && totalReqQty > currentItem.stockAvailable) {
      toast.error(`Insufficient stock! Available: ${currentItem.stockAvailable}`);
      return;
    }

    const product = products.find((p) => p.id === currentItem.productId);
    if (!product) return;

    const unitPrice = parseNumber(currentItem.unitPrice);
    const discountPercent = parseNumber(currentItem.discountPercent);
    const grossTotal = unitPrice * qty;
    const discountAmount = (grossTotal * discountPercent) / 100;
    const netTotal = grossTotal - discountAmount;

    const newItem: InvoiceItem = {
      id: Date.now().toString(),
      productId: currentItem.productId,
      sku: product.sku,
      productName: product.name,
      unit: product.unit_of_measure,
      quantity: qty,
      freeQuantity: freeQty,
      mrp: parseNumber(currentItem.mrp),
      unitPrice,
      discountPercent,
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
      mrp: "",
      unitPrice: "",
      discountPercent: "",
      stockAvailable: 0,
    });
  };

  const handleRemoveItem = (id: string) => {
    setItems(items.filter((item) => item.id !== id));
  };

  const handleCreateCustomer = async () => {
    if (!customerFormData.shopName) {
      toast.error("Shop name is required");
      return;
    }
    try {
      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...customerFormData,
          businessId: businessId ?? BUSINESS_IDS.SIERRA_AGENCY,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create customer");

      toast.success("Customer added successfully!");
      setIsAddCustomerDialogOpen(false);
      setCustomerFormData({
        shopName: "",
        ownerName: "",
        phone: "",
        email: "",
        address: "",
        route: "General",
        status: "Active",
        creditLimit: 0,
        businessId: BUSINESS_IDS.SIERRA_AGENCY,
      });

      invalidateCache("/api/customers");
      const customersRes = await fetch(`/api/customers?businessId=${BUSINESS_IDS.SIERRA_AGENCY}`);
      const customersData = await customersRes.json();
      const mapped = customersData.map((c: any) => ({
        id: c.id,
        name: c.shopName,
        phone: c.phone || "",
        ownerName: c.ownerName || "",
      }));
      setCustomers(mapped);
      if (data.id) setCustomerId(data.id);
    } catch (error: any) {
      toast.error(error.message || "Failed to create customer");
    }
  };

  const handleSaveAction = async (action: "save" | "print" | "download") => {
    if (!customerId) {
      toast.error("Please select a customer.");
      return;
    }
    if (items.length === 0) {
      toast.error("Please add items to the invoice.");
      return;
    }
    if (!noManualRef && !manualInvoiceNo.trim()) {
      toast.error("Enter a manual invoice number, or tick 'No manual ref'.");
      return;
    }
    if (!businessId) {
      toast.error("Business context missing.");
      return;
    }

    setLoading(true);

    const invoiceData = {
      customerId,
      salesRepId,
      items,
      manual_invoice_no: noManualRef ? "" : manualInvoiceNo,
      invoiceDate,
      subTotal: subtotal,
      extraDiscountPercent: parseNumber(extraDiscount),
      extraDiscountAmount: extraDiscountAmount,
      grandTotal: grandTotal,
      orderStatus,
      businessId,
      paymentType,
      paymentStatus: "Unpaid",
      paidAmount: 0,
      performedByName: currentUser?.name ?? null,
      performedByEmail: currentUser?.email ?? null,
      isIncorrect,
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
      invalidatePaymentCaches();

      // Transfer mobile attachments from temp ID to real ID
      try {
        await fetch("/api/attachments", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tempEntityId: tempInvoiceId,
            realEntityId: data.data.id,
            entityType: "invoice",
          }),
        });
      } catch (patchErr) {
        console.error("Error patching attachments:", patchErr);
      }

      if (action === "print") {
        printInvoice(data.data.id);
      } else if (action === "download") {
        downloadInvoice(data.data.id);
      } else {
        router.push("/dashboard/office/sierra/invoices");
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to create invoice");
    } finally {
      setLoading(false);
    }
  };

  const handleShareTempLink = async () => {
    const tempUrl = `${window.location.origin}/invoice/${tempInvoiceId}?draft=true`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Upload Proof for Sierra Invoice",
          text: "Please open this link on your mobile to upload delivery proof / images:",
          url: tempUrl,
        });
      } catch (err: any) {
        if (err?.name !== "AbortError") {
          toast.error("Failed to share upload link");
        }
      }
    } else {
      try {
        await navigator.clipboard.writeText(tempUrl);
        toast.success("Mobile upload link copied! Send it via WhatsApp or SMS.");
      } catch {
        toast.error("Failed to copy link");
      }
    }
  };

  // Calculations
  const subtotal = items.reduce((sum, item) => sum + item.total, 0);
  const totalItemDiscount = items.reduce((sum, item) => sum + item.discountAmount, 0);
  const grossTotal = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);

  const extraDiscountAmount = (subtotal * parseNumber(extraDiscount)) / 100;
  const grandTotal = subtotal - extraDiscountAmount;

  const availableProducts = products.filter((p) => !items.some((i) => i.productId === p.id));

  const safeUnitPrice = parseNumber(currentItem.unitPrice);
  const safeQuantity = parseNumber(currentItem.quantity);
  const safeDiscount = parseNumber(currentItem.discountPercent);
  const currentDiscountAmt = (safeUnitPrice * safeQuantity * safeDiscount) / 100;

  if (loading && !salesRepId) {
    return (
      <div className="flex justify-center items-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4 mx-auto">
      <div className="flex flex-col md:flex-row items-center gap-4">
        <div className="flex items-center gap-4 w-full md:w-auto">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/dashboard/office/sierra/invoices")}
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold tracking-tight">New Customer Bill</h1>
            <p className="text-muted-foreground mt-1">Sierra Agency - Create a new customer invoice</p>
          </div>
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <Button
            variant="outline"
            onClick={() => handleSaveAction("download")}
            disabled={items.length === 0 || loading}
          >
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
            Save & Download
          </Button>
          <Button
            variant="outline"
            onClick={() => handleSaveAction("print")}
            disabled={items.length === 0 || loading}
          >
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Printer className="w-4 h-4 mr-2" />}
            Save & Print
          </Button>
          <Button
            onClick={() => handleSaveAction("save")}
            disabled={items.length === 0 || loading}
            className="bg-red-600 hover:bg-red-700"
          >
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Save Invoice
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* LEFT COLUMN */}
        <div className="lg:col-span-2 space-y-6 min-w-0">
          {/* 1. Invoice Details */}
          <Card>
            <CardHeader>
              <CardTitle>Invoice Details</CardTitle>
              <CardDescription>Customer and billing information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Customer <span className="text-red-500">*</span></Label>
                    <Button
                      variant="ghost"
                      size="sm"
                      type="button"
                      className="h-auto p-0 text-xs text-red-600 hover:text-red-700 hover:bg-transparent"
                      onClick={() => setIsAddCustomerDialogOpen(true)}
                    >
                      <Plus className="w-3 h-3 mr-1" /> New Customer
                    </Button>
                  </div>
                  <SearchableDropdown
                    options={customers.map((c) => ({ id: c.id, name: c.name }))}
                    value={customerId}
                    onChange={setCustomerId}
                    placeholder="Search Customer..."
                  />
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
                  <div className="flex items-center justify-between">
                    <Label className="font-semibold text-red-600">
                      Manual Invoice No <span>*</span>
                    </Label>
                    <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={noManualRef}
                        onChange={(e) => {
                          setNoManualRef(e.target.checked);
                          if (e.target.checked) setManualInvoiceNo("");
                        }}
                        className="rounded"
                      />
                      No manual ref
                    </label>
                  </div>
                  {!noManualRef ? (
                    <Input
                      value={manualInvoiceNo}
                      onChange={(e) => setManualInvoiceNo(e.target.value)}
                      placeholder="Enter manual invoice number"
                      className="border-red-300 focus:border-red-500"
                    />
                  ) : (
                    <div className="h-9 flex items-center text-xs text-muted-foreground italic px-3 border rounded-md bg-muted">
                      No manual ref
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Payment Type</Label>
                  <Input value="📋 Credit" disabled className="bg-muted" />
                  <p className="text-xs text-muted-foreground">⏳ Invoice will be marked as Unpaid</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 2. Add Products */}
          <Card>
            <CardHeader>
              <CardTitle>Add Products</CardTitle>
              <CardDescription>Search and add products to the invoice</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Product Selection */}
              <div className="grid grid-cols-4 gap-4">
                <div className="col-span-4 space-y-2">
                  <Label>
                    Product{" "}
                    {stockLoading && <Loader2 className="inline h-3 w-3 animate-spin ml-2 text-red-600" />}
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
                    <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Search product..." />
                        <CommandList>
                          <CommandEmpty>
                            {products.length === 0 ? "No stock found" : "No products found."}
                          </CommandEmpty>
                          <CommandGroup>
                            {availableProducts.map((product) => (
                              <CommandItem
                                key={product.id}
                                value={`${product.name} ${product.sku} ${product.company_code || ""}`}
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
                                    {product.company_code ? `${product.company_code} • ` : ""}
                                    {product.sku} • Stock: {product.stock_quantity} • LKR {product.selling_price}
                                  </div>
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  <p className="text-xs text-muted-foreground mt-1">
                    Showing Sierra products from your assigned stock.
                  </p>
                  {outOfStockOverride && (
                    <div className="flex items-center gap-2 text-amber-600 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 rounded-lg p-3 text-xs mt-2">
                      <AlertTriangle className="h-4 w-4 shrink-0" strokeWidth={2} />
                      <span>
                        Out-of-stock invoicing is active. You can search, select, and bill items with 0 stock.
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Quantity and Free Quantity Row */}
              <div className="grid grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label>Quantity</Label>
                  <Input
                    ref={qtyInputRef}
                    type="number"
                    min="1"
                    value={currentItem.quantity}
                    onChange={(e) =>
                      setCurrentItem({ ...currentItem, quantity: e.target.value === "" ? "" : Number(e.target.value) })
                    }
                    onKeyDown={handleKeyDown}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Free Qty</Label>
                  <Input
                    type="number"
                    min="0"
                    value={currentItem.freeQuantity}
                    onChange={(e) =>
                      setCurrentItem({ ...currentItem, freeQuantity: e.target.value === "" ? "" : Number(e.target.value) })
                    }
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

              {/* Price Row */}
              <div className="grid grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label>MRP</Label>
                  <Input
                    type="number"
                    value={currentItem.mrp}
                    onChange={(e) =>
                      setCurrentItem({ ...currentItem, mrp: e.target.value === "" ? "" : Number(e.target.value) })
                    }
                    onKeyDown={handleKeyDown}
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Unit Price</Label>
                  <Input
                    type="number"
                    value={currentItem.unitPrice}
                    onChange={(e) =>
                      setCurrentItem({ ...currentItem, unitPrice: e.target.value === "" ? "" : Number(e.target.value) })
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
                    value={currentItem.discountPercent}
                    onChange={(e) =>
                      setCurrentItem({ ...currentItem, discountPercent: e.target.value === "" ? "" : Number(e.target.value) })
                    }
                    onKeyDown={handleKeyDown}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Total</Label>
                  <Input
                    value={(safeUnitPrice * safeQuantity - currentDiscountAmt).toFixed(2)}
                    disabled
                    className="font-bold bg-muted"
                  />
                </div>
              </div>

              <Button
                onClick={handleAddItem}
                className="w-full bg-red-600 hover:bg-red-700"
                variant="default"
                disabled={!currentItem.productId}
              >
                <Plus className="w-4 h-4 mr-2" />
                Add to Invoice
              </Button>
            </CardContent>
          </Card>

          {/* 3. Items Table */}
          <Card>
            <CardHeader>
              <CardTitle>Invoice Items</CardTitle>
              <CardDescription>{items.length} item(s) added</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="border rounded-md overflow-x-auto">
                <Table className="min-w-[520px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">#</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead className="text-center w-20">Qty</TableHead>
                      <TableHead className="text-center w-16 hidden sm:table-cell">Free</TableHead>
                      <TableHead className="text-right w-24">Price</TableHead>
                      <TableHead className="text-center w-16 hidden sm:table-cell">Disc%</TableHead>
                      <TableHead className="text-right w-24">Total</TableHead>
                      <TableHead className="w-10"></TableHead>
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
                      items.map((item, idx) => (
                        <TableRow key={item.id}>
                          <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                          <TableCell>
                            <div className="font-medium leading-tight">{item.productName}</div>
                            <div className="text-xs text-muted-foreground">{item.sku}</div>
                            <div className="text-xs text-muted-foreground sm:hidden">
                              {item.freeQuantity > 0 && `Free: ${item.freeQuantity} · `}
                              {item.discountPercent > 0 && `Disc: ${item.discountPercent}%`}
                            </div>
                          </TableCell>
                          <TableCell className="text-center">{item.quantity} {item.unit}</TableCell>
                          <TableCell className="text-center hidden sm:table-cell">{item.freeQuantity || "-"}</TableCell>
                          <TableCell className="text-right">{item.unitPrice.toLocaleString()}</TableCell>
                          <TableCell className="text-center hidden sm:table-cell">
                            {item.discountPercent > 0 ? `${item.discountPercent}%` : "-"}
                          </TableCell>
                          <TableCell className="text-right font-bold">{item.total.toLocaleString()}</TableCell>
                          <TableCell>
                            <Button variant="ghost" size="icon" onClick={() => handleRemoveItem(item.id)}>
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

          {/* Images & Attachments with Mobile Upload sharing */}
          <DocumentAttachments
            entityType="invoice"
            entityId={tempInvoiceId}
            title="Images & Attachments"
            allowUpload={true}
            pollInterval={3000}
            showMobileUpload={true}
            onShareLink={handleShareTempLink}
          />
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
                  <span className="text-muted-foreground">Payment:</span>
                  <span className="font-medium text-orange-600">
                    📋 Credit
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Invoice Date:</span>
                  <span className="font-medium">{invoiceDate}</span>
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
                    placeholder="0"
                    value={extraDiscount}
                    onChange={(e) => {
                      const val = e.target.value;
                      setExtraDiscount(val === "" ? "" : Number(val));
                    }}
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
                  <span className="text-2xl font-bold text-red-700">
                    LKR {grandTotal.toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="border-t pt-4 bg-red-50/50 dark:bg-red-950/20 p-3.5 rounded-lg border border-red-200/60 mt-4">
                <div className="flex gap-2.5 items-start">
                  <Checkbox
                    id="incorrect-checkbox"
                    checked={isIncorrect}
                    onCheckedChange={(checked) => setIsIncorrect(!!checked)}
                    className="data-[state=checked]:bg-red-600 data-[state=checked]:border-red-600 border-red-300 mt-1 cursor-pointer"
                  />
                  <div className="space-y-1">
                    <Label htmlFor="incorrect-checkbox" className="text-sm font-semibold text-red-950 dark:text-red-300 leading-tight block cursor-pointer select-none">
                      Mark Incorrect (Mistake)
                    </Label>
                    <p className="text-[11px] text-red-700/80 dark:text-red-400/80 leading-normal">
                      Check this if there is a mistake in this invoice's manual entries.
                    </p>
                  </div>
                </div>
              </div>

              <div className="border-t pt-4 space-y-3 mt-4">
                <Button
                  onClick={() => handleSaveAction("save")}
                  disabled={items.length === 0 || loading}
                  className="w-full bg-red-600 hover:bg-red-700 text-white font-medium"
                >
                  {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                  Save Invoice
                </Button>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    onClick={() => handleSaveAction("print")}
                    disabled={items.length === 0 || loading}
                    className="w-full text-xs"
                  >
                    {loading ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Printer className="w-3 h-3 mr-1" />}
                    Save & Print
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleSaveAction("download")}
                    disabled={items.length === 0 || loading}
                    className="w-full text-xs"
                  >
                    {loading ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Download className="w-3 h-3 mr-1" />}
                    Save & PDF
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <CustomerDialogs
        isAddDialogOpen={isAddCustomerDialogOpen}
        setIsAddDialogOpen={setIsAddCustomerDialogOpen}
        formData={customerFormData}
        setFormData={setCustomerFormData}
        onSave={handleCreateCustomer}
        selectedCustomer={null}
        isDeleteDialogOpen={false}
        setIsDeleteDialogOpen={() => {}}
        onDeleteConfirm={() => {}}
      />
    </div>
  );
}
