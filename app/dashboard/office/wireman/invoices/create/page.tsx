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
  ChevronsUpDown,
  Check,
  Pencil,
  X,
  Printer,
  Download,
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
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getUserBusinessContext } from "@/app/middleware/businessAuth";
import { BUSINESS_IDS } from "@/app/config/business-constants";
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

// --- Helper Components ---

interface SearchableDropdownProps {
  options: { id: string; name: string; info?: string }[];
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  disabled?: boolean;
  className?: string;
  searchInputRef?: React.RefObject<HTMLInputElement | null>;
  onSelectCallback?: () => void;
}

function SearchableDropdown({
  options,
  value,
  onChange,
  placeholder,
  disabled,
  className,
  searchInputRef,
  onSelectCallback,
}: SearchableDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const internalInputRef = useRef<HTMLInputElement>(null);
  const inputRefToUse = searchInputRef || internalInputRef;
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredOptions = options.filter((option) =>
    option.name.toLowerCase().includes(search.toLowerCase()) ||
    (option.info && option.info.toLowerCase().includes(search.toLowerCase())),
  );

  const selectedOption = options.find((o) => o.id === value);

  useEffect(() => {
    // Reset highlight when search changes
    setHighlightedIndex(-1);
  }, [search]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) {
      if (e.key === "ArrowDown" || e.key === "Enter") {
        setIsOpen(true);
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((prev) => {
        const next = prev < filteredOptions.length - 1 ? prev + 1 : prev;
        itemRefs.current[next]?.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
        });
        return next;
      });
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((prev) => {
        const next = prev > 0 ? prev - 1 : prev;
        itemRefs.current[next]?.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
        });
        return next;
      });
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < filteredOptions.length) {
        onChange(filteredOptions[highlightedIndex].id);
        setIsOpen(false);
        setSearch("");
        if (onSelectCallback) onSelectCallback();
      }
    } else if (e.key === "Escape") {
      setIsOpen(false);
    }
  };

  return (
    <div className={cn("relative w-full", className)} ref={containerRef}>
      <div className="relative">
        <div
          className={cn(
            "flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
            disabled ? "opacity-50 pointer-events-none" : "cursor-text",
          )}
          onClick={() => {
            if (!disabled) {
              setIsOpen(true);
              setTimeout(() => {
                if (inputRefToUse.current) {
                  inputRefToUse.current.focus({ preventScroll: true });
                }
              }, 0);
            }
          }}
        >
          {isOpen ? (
            <input
              ref={inputRefToUse as React.RefObject<HTMLInputElement>}
              className="w-full bg-transparent outline-none placeholder:text-muted-foreground"
              placeholder={placeholder}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={handleKeyDown}
            />
          ) : (
            <span
              className={
                selectedOption ? "text-foreground" : "text-muted-foreground"
              }
            >
              {selectedOption ? selectedOption.name : placeholder}
            </span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </div>
      </div>

      {isOpen && (
        <div className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border bg-popover text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95">
          {filteredOptions.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              No results found.
            </div>
          ) : (
            <div className="p-1">
              {filteredOptions.map((option, index) => (
                <div
                  key={option.id}
                  ref={(el) => {
                    itemRefs.current[index] = el;
                  }}
                  className={cn(
                    "relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none",
                    value === option.id && "bg-accent text-accent-foreground",
                    highlightedIndex === index
                      ? "bg-red-100 text-red-900" // Highlight color
                      : "hover:bg-accent hover:text-accent-foreground"
                  )}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  onClick={() => {
                    onChange(option.id);
                    setIsOpen(false);
                    setSearch("");
                    if (onSelectCallback) onSelectCallback();
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === option.id ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <div className="flex flex-col">
                    <span>{option.name}</span>
                    {option.info && (
                      <span className="text-xs text-muted-foreground">
                        {option.info}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const parseNumber = (val: string | number) => {
  if (val === "" || val === undefined || val === null) return 0;
  return Number(val);
};

export default function CreateWiremanInvoicePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [stockLoading, setStockLoading] = useState(false);

  // Input Refs for Fast Data Entry
  const productSearchInputRef = useRef<HTMLInputElement>(null);
  const qtyInputRef = useRef<HTMLInputElement>(null);

  // Business Context
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<{
    id: string;
    name: string;
    email: string;
  } | null>(null);

  // Data State
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<{ id: string; name: string; phone?: string; ownerName?: string; }[]>(
    [],
  );

  // Form State
  const [customerId, setCustomerId] = useState<string>("");
  const [invoiceDate, setInvoiceDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  // Manual Field
  const [manualInvoiceNo, setManualInvoiceNo] = useState("");
  const [noManualRef, setNoManualRef] = useState(false);
  const [isIncorrect, setIsIncorrect] = useState(false);

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

  // Items State
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [extraDiscount, setExtraDiscount] = useState<number | string>("");
  const [editingItemId, setEditingItemId] = useState<string | null>(null);

  const [currentItem, setCurrentItem] = useState<{
    productId: string;
    sku: string;
    quantity: number | string;
    freeQuantity: number | string;
    unit: string;
    mrp: number;
    unitPrice: number;
    discountPercent: number;
    stockAvailable: number;
  }>({
    productId: "",
    sku: "",
    quantity: "",
    freeQuantity: "",
    unit: "",
    mrp: 0,
    unitPrice: 0,
    discountPercent: 0,
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

        setBusinessId(BUSINESS_IDS.WIREMAN_AGENCY);
        setCurrentUser({ id: user.id, name: user.name, email: user.email });

        const customersRes = await fetch(
          `/api/customers?businessId=${BUSINESS_IDS.WIREMAN_AGENCY}`,
        );
        const customersData = await customersRes.json();
        setCustomers(
          customersData.map((c: any) => ({
            id: c.id,
            name: c.shopName, phone: c.phone || "", ownerName: c.ownerName || "" })),
        );
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
        const res = await fetch(
          `/api/rep/stock?userId=${salesRepId}&supplierLike=Wireman`,
        );
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
  }, [salesRepId]);

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
      discountPercent: 0,
      stockAvailable: product.stock_quantity,
    });
  };

  const onProductDropdownSelect = () => {
    // Auto-focus quantity input after selection
    setTimeout(() => {
      qtyInputRef.current?.focus({ preventScroll: true });
    }, 100);
  };

  // --- Global Keyboard Shortcuts ---
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Shift + F to focus product search in the dropdown
      if (e.shiftKey && (e.key === "f" || e.key === "F")) {
        e.preventDefault();
        // Look for the input element inside the searchable dropdown that has the placeholder text for products
        const searchInput = document.querySelector('input[placeholder="Search Product..."]') as HTMLInputElement;
        if (searchInput) {
          searchInput.focus({ preventScroll: true });
        } else {
            // click the dropdown trigger to open it
            const triggers = document.querySelectorAll('.ring-offset-background');
            if(triggers && triggers.length > 1) { // 2nd trigger is product search
                (triggers[1] as HTMLElement).click();
            }
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
    if (totalReqQty > currentItem.stockAvailable) {
      toast.error(
        `Insufficient stock! Available: ${currentItem.stockAvailable}`,
      );
      return;
    }

    const product = products.find((p) => p.id === currentItem.productId);
    if (!product) return;

    const grossTotal = currentItem.unitPrice * qty;
    const discountAmount = (grossTotal * currentItem.discountPercent) / 100;
    const netTotal = grossTotal - discountAmount;

    const newItem: InvoiceItem = {
      id: Date.now().toString(),
      productId: currentItem.productId,
      sku: product.sku,
      productName: product.name,
      unit: product.unit_of_measure,
      quantity: qty,
      freeQuantity: freeQty,
      mrp: currentItem.mrp,
      unitPrice: currentItem.unitPrice,
      discountPercent: currentItem.discountPercent,
      discountAmount: discountAmount,
      total: netTotal,
    };

    if (editingItemId) {
      setItems(items.map((i) => i.id === editingItemId ? { ...newItem, id: editingItemId } : i));
      setEditingItemId(null);
    } else {
      setItems([...items, newItem]);
    }

    setCurrentItem({
      productId: "",
      sku: "",
      quantity: "",
      freeQuantity: "",
      unit: "",
      mrp: 0,
      unitPrice: 0,
      discountPercent: 0,
      stockAvailable: 0,
    });
  };

  const handleRemoveItem = (id: string) => {
    setItems(items.filter((item) => item.id !== id));
    if (editingItemId === id) {
      setEditingItemId(null);
      setCurrentItem({ productId: "", sku: "", quantity: "", freeQuantity: "", unit: "", mrp: 0, unitPrice: 0, discountPercent: 0, stockAvailable: 0 });
    }
  };

  const handleEditItem = (item: InvoiceItem) => {
    const product = products.find((p) => p.id === item.productId);
    setCurrentItem({
      productId: item.productId,
      sku: item.sku,
      quantity: item.quantity,
      freeQuantity: item.freeQuantity,
      unit: item.unit,
      mrp: item.mrp,
      unitPrice: item.unitPrice,
      discountPercent: item.discountPercent,
      stockAvailable: product?.stock_quantity ?? item.quantity,
    });
    setEditingItemId(item.id);
    setTimeout(() => qtyInputRef.current?.focus({ preventScroll: true }), 100);
  };

  const handleCancelEdit = () => {
    setEditingItemId(null);
    setCurrentItem({ productId: "", sku: "", quantity: "", freeQuantity: "", unit: "", mrp: 0, unitPrice: 0, discountPercent: 0, stockAvailable: 0 });
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
        router.push("/dashboard/office/wireman/invoices");
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
          title: "Upload Proof for Wireman Invoice",
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
  const totalItemDiscount = items.reduce(
    (sum, item) => sum + item.discountAmount,
    0,
  );
  const grossTotal = items.reduce(
    (sum, item) => sum + item.unitPrice * item.quantity,
    0,
  );

  const extraDiscountAmount = (subtotal * parseNumber(extraDiscount)) / 100;
  const grandTotal = subtotal - extraDiscountAmount;

  const availableProducts = products;

  const currentLiveQty = parseNumber(currentItem.quantity);
  const currentLiveDiscountAmt =
    (currentItem.unitPrice * currentLiveQty * currentItem.discountPercent) /
    100;

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
            onClick={() => router.push("/dashboard/office/wireman/invoices")}
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold tracking-tight">New Customer Bill</h1>
            <p className="text-muted-foreground mt-1">Wireman Agency - Create a new customer invoice</p>
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
        <div className="lg:col-span-2 space-y-6">
          {/* 1. Invoice Details */}
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Customer</Label>
                  <SearchableDropdown
                    options={customers.map((c) => ({ id: c.id, name: c.name }))}
                    value={customerId}
                    onChange={setCustomerId}
                    placeholder="Search Customer..."
                  />
                </div>
                <div className="space-y-2">
                  <Label>Date</Label>
                  <Input
                    type="date"
                    value={invoiceDate}
                    onChange={(e) => setInvoiceDate(e.target.value)}
                  />
                </div>
              </div>

              {/* Manual Invoice No */}
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
                  <Label>Sales Rep (Current User)</Label>
                  <Input
                    value={currentUser?.name || ""}
                    disabled
                    className="bg-muted"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Order Status</Label>
                  <Input
                    value="Delivered"
                    disabled
                    className="bg-green-50 text-green-700 font-medium border-green-200"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 2. Add Items */}
          <Card>
            <CardHeader>
              <CardTitle>Add Products</CardTitle>
              <CardDescription>
                Showing stock for your assigned location
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-4 gap-4">
                <div className="col-span-4 space-y-2">
                  <Label>
                    Product{" "}
                    {stockLoading && (
                      <Loader2 className="inline h-3 w-3 animate-spin ml-2 text-red-600" />
                    )}
                  </Label>
                  <SearchableDropdown
                    options={availableProducts.map((p) => ({
                      id: p.id,
                      name: p.name,
                      info: `${p.company_code ? p.company_code + " • " : ""}${p.sku} • Stock: ${p.stock_quantity}`,
                    }))}
                    value={currentItem.productId}
                    onChange={handleProductSelect}
                    placeholder="Search Product..."
                    disabled={stockLoading}
                    searchInputRef={productSearchInputRef}
                    onSelectCallback={onProductDropdownSelect}
                  />
                </div>
              </div>

              <div className="grid grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label>Unit Price</Label>
                  <Input
                    type="number"
                    value={currentItem.unitPrice || ""}
                    onChange={(e) =>
                      setCurrentItem({
                        ...currentItem,
                        unitPrice: Number(e.target.value),
                      })
                    }
                    onKeyDown={handleKeyDown}
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Quantity</Label>
                  <Input
                    ref={qtyInputRef}
                    type="number"
                    min="1"
                    placeholder="Qty"
                    value={currentItem.quantity}
                    onChange={(e) => {
                      const val = e.target.value;
                      setCurrentItem({
                        ...currentItem,
                        quantity: val === "" ? "" : Number(val),
                      });
                    }}
                    onKeyDown={handleKeyDown}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Free Qty</Label>
                  <Input
                    type="number"
                    min="0"
                    placeholder="Free"
                    value={currentItem.freeQuantity}
                    onChange={(e) => {
                      const val = e.target.value;
                      setCurrentItem({
                        ...currentItem,
                        freeQuantity: val === "" ? "" : Number(val),
                      });
                    }}
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
              </div>

              <div className="grid grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label>MRP</Label>
                  <Input
                    type="number"
                    value={currentItem.mrp || ""}
                    onChange={(e) =>
                      setCurrentItem({
                        ...currentItem,
                        mrp: Number(e.target.value),
                      })
                    }
                    onKeyDown={handleKeyDown}
                    placeholder="0.00"
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
                        ? "text-destructive font-bold bg-muted"
                        : "bg-muted"
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Discount %</Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={currentItem.discountPercent || ""}
                    onChange={(e) =>
                      setCurrentItem({
                        ...currentItem,
                        discountPercent: Number(e.target.value),
                      })
                    }
                    onKeyDown={handleKeyDown}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Total</Label>
                  <Input
                    value={(
                      currentItem.unitPrice * currentLiveQty -
                      currentLiveDiscountAmt
                    ).toFixed(2)}
                    disabled
                    className="font-bold bg-muted"
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={handleAddItem}
                  className="flex-1 bg-red-600 hover:bg-red-700"
                  variant="default"
                  disabled={!currentItem.productId}
                >
                  {editingItemId ? (
                    <><Pencil className="w-4 h-4 mr-2" /> Update Item</>
                  ) : (
                    <><Plus className="w-4 h-4 mr-2" /> Add to Bill</>
                  )}
                </Button>
                {editingItemId && (
                  <Button variant="outline" onClick={handleCancelEdit}>
                    <X className="w-4 h-4 mr-1" /> Cancel
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* 3. Items Table */}
          <Card>
            <CardHeader>
              <CardTitle>Items</CardTitle>
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
                      <TableHead className="text-right w-24">
                        Unit Price
                      </TableHead>
                      <TableHead className="text-center w-20">Disc%</TableHead>
                      <TableHead className="text-right w-28">Total</TableHead>
                      <TableHead className="w-20"></TableHead>
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
                        <TableRow
                          key={item.id}
                          className={editingItemId === item.id ? "bg-amber-50 border-l-2 border-l-amber-400" : ""}
                        >
                          <TableCell>{idx + 1}</TableCell>
                          <TableCell>
                            <div className="font-medium">
                              {item.productName}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {item.sku}
                            </div>
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
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                onClick={() => handleEditItem(item)}
                                className="hover:bg-amber-100 hover:text-amber-700"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                onClick={() => handleRemoveItem(item.id)}
                              >
                                <Trash2 className="w-3.5 h-3.5 text-destructive" />
                              </Button>
                            </div>
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
              <CardTitle>Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Customer:</span>
                  <span className="font-medium">
                    {customers.find((c) => c.id === customerId)?.name ||
                      "Not Selected"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Bill By:</span>
                  <span className="font-medium">
                    {currentUser?.name || "-"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Date:</span>
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
                  <span className="text-destructive">
                    - LKR {extraDiscountAmount.toLocaleString()}
                  </span>
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
                    type="button"
                    onClick={() => handleSaveAction("print")}
                    disabled={items.length === 0 || loading}
                    className="w-full text-xs"
                  >
                    {loading ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Printer className="w-3 h-3 mr-1" />}
                    Save & Print
                  </Button>
                  <Button
                    variant="outline"
                    type="button"
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
    </div>
  );
}
