// app/dashboard/office/retail/invoices/[id]/edit/page.tsx
// Same layout as the Walk-in Sale screen, for editing a saved retail invoice.
"use client";

import React, { useState, useEffect, use, useRef } from "react";
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
  AlertTriangle,
  Undo2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MrpDiscountInput } from "@/components/ui/mrp-discount-input";
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
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { getUserBusinessContext } from "@/app/middleware/businessAuth";
import { BUSINESS_IDS, BUSINESS_NAMES } from "@/app/config/business-constants";
import { FIXED_SUPPLIERS, getSupplierCleanName, getSupplierColorStyles } from "../../../_lib/supplier-styles";

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

const EMPTY_ITEM: CurrentItemState = {
  productId: "",
  sku: "",
  quantity: "",
  freeQuantity: "",
  unit: "",
  mrp: "",
  unitPrice: "",
  discountPercent: "",
  stockAvailable: 0,
};

export default function EditRetailInvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [retailOutOfStockOverride, setRetailOutOfStockOverride] = useState(false);

  // Business Context
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [businessName, setBusinessName] = useState<string>("");
  const [userId, setUserId] = useState<string | null>(null);

  // Data State
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [suppliers, setSuppliers] = useState<{ id: string; name: string }[]>([]);
  const [guestCustomerId, setGuestCustomerId] = useState<string | null>(null);

  // Form State
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [invoiceDate, setInvoiceDate] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [paymentType, setPaymentType] = useState<string>("Cash");
  const [cashPaidAmount, setCashPaidAmount] = useState<number | "">(0);
  const [changeReason, setChangeReason] = useState(""); // Audit Log

  // Items State
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [extraDiscount, setExtraDiscount] = useState<number>(0);
  // Qty already on this invoice per product (its stock is already taken, so it counts as available)
  const [originalQty, setOriginalQty] = useState<Record<string, number>>({});
  // Walk-in good returns saved with this bill (taken off the total, shown read-only)
  const [goodReturns, setGoodReturns] = useState<any[]>([]);

  // Popover States
  const [customerOpen, setCustomerOpen] = useState(false);
  const [productOpen, setProductOpen] = useState(false);
  const [supplierFilter, setSupplierFilter] = useState<string>("all");

  // Current Item Being Added / Edited
  const [currentItem, setCurrentItem] = useState<CurrentItemState>(EMPTY_ITEM);
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

  // --- 1. Fetch Data ---
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const user = getUserBusinessContext();
        if (!user) {
          toast.error("User context not found");
          router.push("/login");
          return;
        }

        setBusinessId(BUSINESS_IDS.CHAMPIKA_RETAIL);
        setBusinessName(user.businessName ?? BUSINESS_NAMES[BUSINESS_IDS.CHAMPIKA_RETAIL]);
        setUserId(user.id);

        // Start the requests that don't depend on anything right away
        const invPromise = fetch(`/api/invoices/${id}`);
        const custPromise = fetch(`/api/customers?businessId=${BUSINESS_IDS.CHAMPIKA_RETAIL}&status=Active`);
        const suppliersPromise = fetch("/api/suppliers").catch(() => null);
        const settingSuppliersPromise = fetch("/api/settings/categories?type=supplier").catch(() => null);

        // Out-of-stock override setting (decides which product list to load)
        const prodPromise = (async () => {
          let isOverrideEnabled = false;
          try {
            const overrideRes = await fetch("/api/settings/portal-stock-override").catch(() => null);
            if (overrideRes?.ok) {
              const overrideData = await overrideRes.json();
              isOverrideEnabled = overrideData.retail ?? false;
              setRetailOutOfStockOverride(isOverrideEnabled);
            }
          } catch (err) {
            console.error("Error fetching retail invoice override setting:", err);
          }
          return fetch(`/api/rep/stock?userId=${user.id}${isOverrideEnabled ? "&includeOutOfStock=true" : ""}`);
        })();

        const [invRes, custRes, prodRes, suppliersRes, settingSuppliersRes] = await Promise.all([
          invPromise,
          custPromise,
          prodPromise,
          suppliersPromise,
          settingSuppliersPromise,
        ]);

        if (!invRes.ok) throw new Error("Failed to load invoice");

        const invoice = await invRes.json();
        const customersData = await custRes.json();
        const productsData = await prodRes.json();
        const suppliersData = suppliersRes && suppliersRes.ok ? await suppliersRes.json() : [];
        const settingSuppliersData =
          settingSuppliersRes && settingSuppliersRes.ok ? await settingSuppliersRes.json() : [];
        setSuppliers([
          ...(Array.isArray(suppliersData) ? suppliersData : []),
          ...(Array.isArray(settingSuppliersData) ? settingSuppliersData : []),
        ]);

        // Customers
        const retailCustomers = Array.isArray(customersData) ? customersData : [];
        const guest = retailCustomers.find((c: any) => {
          const nameToCheck = (c.shop_name || c.shopName || c.name || "").toLowerCase();
          return nameToCheck.includes("walk-in") || nameToCheck.includes("guest");
        });
        if (guest) setGuestCustomerId(guest.id);

        setCustomers(
          retailCustomers.map((c: any) => ({
            id: c.id,
            name: c.shop_name || c.shopName || c.name || "Unnamed Customer",
            shop_name: c.shop_name || c.shopName || c.name || "Unnamed Customer",
            owner_name: c.owner_name || c.ownerName || "",
            business_id: c.business_id || c.businessId || null,
            phone: c.phone || "",
            ownerName: c.owner_name || c.ownerName || "",
          }))
        );

        // Products
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
        }

        // Invoice header
        setInvoiceNumber(invoice.invoiceNo);
        setGoodReturns((invoice.returns || []).filter((r: any) => r.walkIn));
        setInvoiceDate(invoice.date);
        setCustomerId(invoice.customerId);
        setPaymentType(
          invoice.payments && invoice.payments.length > 0 ? invoice.payments[0].method : "Cash"
        );
        setCashPaidAmount(invoice.paidAmount || 0);
        setExtraDiscount(invoice.extraDiscountPercent || 0);

        // Invoice items
        const loadedItems: InvoiceItem[] = invoice.items.map((item: any) => ({
          id: item.id || `EXISTING-${Math.random()}`,
          productId: item.productId,
          sku: item.sku,
          productName: item.productName || item.name,
          quantity: item.quantity,
          freeQuantity: item.freeQuantity || 0,
          unit: item.unit,
          mrp: item.mrp,
          unitPrice: item.unitPrice,
          discountPercent: item.discountPercent || 0,
          discountAmount: item.discountAmount || 0,
          total: item.total,
          supplier: item.supplier || "",
          retailOnly: item.retailOnly ?? item.retail_only ?? false,
        }));
        setItems(loadedItems);

        const orig: Record<string, number> = {};
        loadedItems.forEach((it) => {
          orig[it.productId] = (orig[it.productId] || 0) + it.quantity + it.freeQuantity;
        });
        setOriginalQty(orig);
      } catch (error) {
        console.error("Error loading data:", error);
        toast.error("Failed to load invoice data");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [id, router]);

  // Stock that can be used for a product on this invoice
  const availableFor = (productId: string) => {
    const product = products.find((p) => p.id === productId);
    return (product?.stock_quantity ?? 0) + (originalQty[productId] || 0);
  };

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
      unitPrice: product.retail_price ?? product.selling_price,
      discountPercent: "",
      stockAvailable: availableFor(product.id),
    });

    setTimeout(() => {
      quantityInputRef.current?.focus();
      quantityInputRef.current?.select();
    }, 150);
  };

  const resetCurrentItem = () => {
    setCurrentItem(EMPTY_ITEM);
    setEditingItemId(null);
  };

  // --- Load item into form for editing ---
  const handleEditItem = (itemId: string) => {
    const item = items.find((i) => i.id === itemId);
    if (!item) return;
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
      stockAvailable: availableFor(item.productId),
    });
    addProductCardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
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

    if (!retailOutOfStockOverride && qty + freeQty > currentItem.stockAvailable) {
      toast.error(`Insufficient stock! Available: ${currentItem.stockAvailable}`);
      return;
    }

    // A product already on the invoice may not be in the stock list (e.g. sold out)
    const product = products.find((p) => p.id === currentItem.productId);
    const existing = items.find((i) => i.id === editingItemId);
    if (!product && !existing) return;

    const unitPrice = currentItem.unitPrice === "" ? 0 : currentItem.unitPrice;
    const mrp = currentItem.mrp === "" ? 0 : currentItem.mrp;
    const discountPercent = currentItem.discountPercent === "" ? 0 : currentItem.discountPercent;

    const grossTotal = unitPrice * qty;
    const discountAmount = (grossTotal * discountPercent) / 100;
    const netTotal = grossTotal - discountAmount;

    const updatedItem: InvoiceItem = {
      id: editingItemId ?? `NEW-${Date.now()}`,
      productId: currentItem.productId,
      sku: product?.sku ?? existing!.sku,
      productName: product?.name ?? existing!.productName,
      unit: product?.unit_of_measure ?? existing!.unit,
      quantity: qty,
      freeQuantity: freeQty,
      mrp,
      unitPrice,
      discountPercent,
      discountAmount,
      total: netTotal,
      supplier: product?.supplier ?? existing?.supplier ?? "",
      retailOnly: product?.retailOnly ?? existing?.retailOnly ?? false,
    };

    if (editingItemId) {
      setItems(items.map((i) => (i.id === editingItemId ? updatedItem : i)));
      toast.success("Item updated");
    } else {
      setItems([...items, updatedItem]);
    }

    resetCurrentItem();
  };

  const handleRemoveItem = (itemId: string) => {
    setItems(items.filter((item) => item.id !== itemId));
    if (editingItemId === itemId) resetCurrentItem();
  };

  // --- Save / Update Handler ---
  const handleSaveAction = async (action: "save" | "print" | "printHalf" | "download") => {
    if (!customerId) {
      toast.error("Customer is required");
      return;
    }
    if (items.length === 0) {
      toast.error("Invoice must have at least one item");
      return;
    }
    if (grandTotal < 0) {
      toast.error("Good returns are more than the bill. Add more items.");
      return;
    }

    setSaving(true);

    const invoiceData = {
      customerId,
      salesRepId: userId,
      businessId,
      items,
      invoiceNumber,
      invoiceDate,
      subTotal: subtotal,
      extraDiscountPercent: extraDiscount,
      extraDiscountAmount,
      grandTotal,
      orderStatus: "Delivered",
      paymentType,
      paidAmount: paymentType === "Cash" ? (cashPaidAmount === "" ? 0 : Number(cashPaidAmount)) : null,
      notes: "",
      changeReason: changeReason || "Updated invoice details",
      userId,
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
      } else if (action === "printHalf") {
        router.push(`/dashboard/office/retail/invoices/${id}?print=half`);
      } else if (action === "download") {
        router.push(`/dashboard/office/retail/invoices/${id}?download=true`);
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  // --- Totals ---
  const subtotal = items.reduce((sum, item) => sum + item.total, 0);
  const totalItemDiscount = items.reduce((sum, item) => sum + item.discountAmount, 0);
  const grossTotal = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const extraDiscountAmount = (subtotal * extraDiscount) / 100;
  const goodReturnsTotal = goodReturns.reduce((sum, r) => sum + Number(r.totalValue || 0), 0);
  const grandTotal = Math.round((subtotal - extraDiscountAmount - goodReturnsTotal) * 100) / 100;

  const availableProducts = products.filter(
    (p) => !items.some((i) => i.productId === p.id) || p.id === currentItem.productId
  );

  const combinedSuppliers = React.useMemo(() => {
    const cleaned: { id: string; name: string }[] = [];
    const seen = new Set<string>();
    [...FIXED_SUPPLIERS, ...suppliers].forEach((sup) => {
      const cleanName = getSupplierCleanName(sup.name);
      if (!seen.has(cleanName)) {
        seen.add(cleanName);
        cleaned.push({ id: sup.id || cleanName, name: cleanName });
      }
    });
    return cleaned;
  }, [suppliers]);

  const filteredAvailableProducts = availableProducts.filter((product) => {
    if (supplierFilter === "all") return true;
    if (supplierFilter === "retail") return product.retailOnly === true;
    return !!product.supplier && getSupplierCleanName(product.supplier) === supplierFilter;
  });

  const currentProductName =
    products.find((p) => p.id === currentItem.productId)?.name ||
    items.find((i) => i.productId === currentItem.productId)?.productName;

  const safeUnitPrice = currentItem.unitPrice === "" ? 0 : currentItem.unitPrice;
  const safeQuantity = currentItem.quantity === "" ? 0 : currentItem.quantity;
  const safeDiscount = currentItem.discountPercent === "" ? 0 : currentItem.discountPercent;
  const currentDiscountAmt = (safeUnitPrice * safeQuantity * safeDiscount) / 100;

  const busy = loading || saving;
  const canSave = items.length > 0 && !busy;

  // Item badge + left border colour by supplier
  const itemStyle = (supplier?: string, retailOnly?: boolean) => {
    const styles = getSupplierColorStyles(supplier);
    if (retailOnly) {
      return {
        border: "border-l-4 border-l-emerald-500",
        label: "Retail Only",
        badge: "bg-emerald-100 text-emerald-700 border-emerald-200",
      };
    }
    return {
      border: cn("border-l-4", styles.borderLeft || "border-l-slate-200"),
      label: getSupplierCleanName(supplier),
      badge: styles.badge,
    };
  };

  if (loading && items.length === 0) {
    return (
      <div className="flex justify-center items-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className={cn("mx-auto", isLandscape ? "space-y-3 pb-4" : "space-y-4 pb-28 xl:pb-6")}>
      {/* Out of Stock Override Banner */}
      {retailOutOfStockOverride && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-amber-800 text-xs sm:text-sm flex items-start gap-3 shadow-sm">
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600 mt-0.5" />
          <div className="space-y-1">
            <span className="font-bold block text-sm">Retail Out-of-Stock Invoicing Override is Active</span>
            <span className="text-muted-foreground block text-xs">
              You can search, select, and invoice any product regardless of current stock levels. Items with insufficient stock will be clamp-deducted to 0 on saving.
            </span>
          </div>
        </div>
      )}

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
            Edit Retail Invoice
          </h1>
          <p className="text-muted-foreground text-xs sm:text-sm mt-0.5 hidden sm:block">
            {businessName} · Modifying {invoiceNumber}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={() => handleSaveAction("download")} disabled={!canSave}>
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
            Download
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleSaveAction("print")} disabled={!canSave}>
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Printer className="w-4 h-4 mr-2" />}
            Print A4
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleSaveAction("printHalf")} disabled={!canSave}>
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Printer className="w-4 h-4 mr-2" />}
            Print A5
          </Button>
          <Button
            size="sm"
            onClick={() => handleSaveAction("save")}
            disabled={!canSave}
            className="bg-green-600 hover:bg-green-700"
          >
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Update Invoice
          </Button>
        </div>
      </div>

      <div className={cn("grid", isLandscape ? "gap-3 grid-cols-[1fr_22rem]" : "gap-4 sm:gap-6 xl:grid-cols-3")}>
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
              <CardTitle className="text-base sm:text-lg">
                Invoice Details <span className="xl:hidden text-muted-foreground font-normal">· {invoiceNumber}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Customer */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Label>
                      Customer <span className="text-red-500">*</span>
                    </Label>
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
                                  {customer.owner_name && (
                                    <div className="text-xs text-muted-foreground">{customer.owner_name}</div>
                                  )}
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
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
                <div className="space-y-2">
                  <Label>Invoice No</Label>
                  <Input value={invoiceNumber} disabled className="bg-muted h-11" />
                </div>

                <div className="space-y-2">
                  <Label>
                    Payment Type <span className="text-red-500">*</span>
                  </Label>
                  <Select value={paymentType} onValueChange={setPaymentType}>
                    <SelectTrigger className="w-full h-11">
                      <SelectValue placeholder="Select Payment Type" />
                    </SelectTrigger>
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
          <div ref={addProductCardRef} className="scroll-mt-4">
            <Card className="gap-0.5 xl:gap-4">
              <CardHeader className="pb-0 xl:pb-2">
                <CardTitle className="text-base sm:text-lg">
                  {editingItemId ? "Edit Product" : "Add Products"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 sm:space-y-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Product</Label>

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
                      variant={supplierFilter === "retail" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSupplierFilter("retail")}
                      className={cn(
                        "h-8 text-xs font-semibold rounded-full border-emerald-200 text-emerald-700 hover:bg-emerald-50 transition-all duration-200 shrink-0",
                        supplierFilter === "retail" &&
                          "bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700 hover:text-white shadow-sm"
                      )}
                    >
                      🛍️ Retail Only
                    </Button>
                    {combinedSuppliers
                      .filter((sup) =>
                        ["Sierra Cables", "Wireman", "Orange", "ACL", "Polycrome"].includes(
                          getSupplierCleanName(sup.name)
                        )
                      )
                      .map((sup) => {
                        const styles = getSupplierColorStyles(sup.name);
                        const isSelected = supplierFilter === sup.name;
                        return (
                          <Button
                            key={sup.id || sup.name}
                            type="button"
                            variant={isSelected ? "default" : "outline"}
                            size="sm"
                            onClick={() => setSupplierFilter(sup.name)}
                            className={cn(
                              "h-8 text-xs font-semibold rounded-full transition-all duration-200 shrink-0",
                              isSelected ? styles.bgActive : cn("bg-white", styles.borderInactive)
                            )}
                          >
                            {styles.dot} {getSupplierCleanName(sup.name)}
                          </Button>
                        );
                      })}
                  </div>

                  <Popover open={productOpen} onOpenChange={setProductOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={productOpen}
                        className="w-full justify-between"
                        disabled={!!editingItemId}
                      >
                        {currentItem.productId ? currentProductName : "Select Product"}
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
                        <CommandList className="max-h-[400px]">
                          <CommandEmpty>
                            {filteredAvailableProducts.length === 0
                              ? "No products found in this category"
                              : "No products found."}
                          </CommandEmpty>
                          <CommandGroup>
                            {filteredAvailableProducts.map((product) => {
                              const styles = getSupplierColorStyles(product.supplier);
                              let borderClass = cn("border-l-4", styles.borderLeft || "border-slate-300");
                              let bgHoverClass = styles.hoverBg || "hover:bg-slate-50";
                              let supplierLabelName = getSupplierCleanName(product.supplier);
                              let badgeColor = styles.badge;
                              if (product.retailOnly) {
                                borderClass = "border-l-4 border-emerald-500";
                                bgHoverClass = "hover:bg-emerald-50/50";
                                supplierLabelName = "Retail Only";
                                badgeColor = "bg-emerald-100 text-emerald-800 border-emerald-200";
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
                                      currentItem.productId === product.id ? "opacity-100" : "opacity-0"
                                    )}
                                  />
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between gap-2">
                                      <span className="font-semibold text-slate-900 truncate">{product.name}</span>
                                      <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0", badgeColor)}>
                                        {supplierLabelName}
                                      </span>
                                    </div>
                                    <div className="text-xs text-muted-foreground flex flex-wrap gap-x-2 gap-y-0.5 mt-0.5 font-sans">
                                      <span className="font-mono">{product.sku}</span>
                                      <span>•</span>
                                      <span>
                                        Stock:{" "}
                                        <strong className={cn(product.stock_quantity === 0 ? "text-red-500 font-bold" : "text-slate-700")}>
                                          {product.stock_quantity}
                                        </strong>
                                      </span>
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
                </div>

                {/* Quantity row */}
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
                        setCurrentItem({ ...currentItem, quantity: e.target.value === "" ? "" : Number(e.target.value) })
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddItem();
                        }
                      }}
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
                        setCurrentItem({ ...currentItem, freeQuantity: e.target.value === "" ? "" : Number(e.target.value) })
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddItem();
                        }
                      }}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Unit</Label>
                    <Input value={currentItem.unit || "—"} disabled className="bg-muted h-11 text-center font-medium" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">In Stock</Label>
                    <Input
                      value={currentItem.productId ? currentItem.stockAvailable : "—"}
                      disabled
                      className={cn(
                        "h-11 text-center font-bold bg-muted",
                        currentItem.stockAvailable > 0 && currentItem.stockAvailable < 10 ? "text-destructive" : "text-slate-700"
                      )}
                    />
                  </div>
                </div>

                {/* Price row */}
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">MRP</Label>
                    <Input
                      type="number"
                      value={currentItem.mrp}
                      className="h-11"
                      onChange={(e) =>
                        setCurrentItem({ ...currentItem, mrp: e.target.value === "" ? "" : Number(e.target.value) })
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddItem();
                        }
                      }}
                      placeholder="0.00"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">MRP Disc %</Label>
                    <MrpDiscountInput
                      mrp={currentItem.mrp}
                      unitPrice={currentItem.unitPrice}
                      onUnitPriceChange={(price) => setCurrentItem((prev) => ({ ...prev, unitPrice: price }))}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddItem();
                        }
                      }}
                      className="h-11"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Unit Price</Label>
                    <Input
                      type="number"
                      value={currentItem.unitPrice}
                      className="h-11"
                      onChange={(e) =>
                        setCurrentItem({ ...currentItem, unitPrice: e.target.value === "" ? "" : Number(e.target.value) })
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddItem();
                        }
                      }}
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
                          discountPercent: e.target.value === "" ? "" : Number(e.target.value),
                        })
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddItem();
                        }
                      }}
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
                      editingItemId ? "bg-blue-600 hover:bg-blue-700" : "bg-green-600 hover:bg-green-700"
                    )}
                    disabled={!currentItem.productId}
                  >
                    {editingItemId ? (
                      <>
                        <Pencil className="w-4 h-4 mr-2" />
                        Update Item
                      </>
                    ) : (
                      <>
                        <Plus className="w-4 h-4 mr-2" />
                        Add to Invoice
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 3. Items list */}
          <Card className={cn(isLandscape ? "hidden" : "")}>
            <CardHeader className="pb-3 sm:pb-6">
              <CardTitle className="text-base sm:text-lg">Invoice Items</CardTitle>
              <CardDescription className="text-xs sm:text-sm">{items.length} item(s) · tap ✎ to change an item</CardDescription>
            </CardHeader>
            <CardContent className="p-3 sm:p-4 pt-0 sm:pt-0">
              {items.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-muted-foreground rounded-lg border border-dashed">
                  <Package className="w-8 h-8 mb-2 opacity-40" />
                  <p className="text-sm">No items</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {items.map((item, idx) => {
                    const st = itemStyle(item.supplier, item.retailOnly);
                    const isEditing = editingItemId === item.id;
                    return (
                      <div
                        key={item.id}
                        className={cn(
                          "flex items-center gap-3 rounded-lg border bg-card px-3 py-2.5 transition-colors",
                          st.border,
                          isEditing ? "bg-blue-50/60 border-blue-200" : "hover:bg-muted/40"
                        )}
                      >
                        <span className="text-xs text-muted-foreground w-5 shrink-0 text-center font-medium">{idx + 1}</span>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-medium text-sm leading-tight">{item.productName}</span>
                            {st.label && (
                              <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded border shrink-0", st.badge)}>
                                {st.label}
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-x-2.5 gap-y-0 mt-1 text-xs text-muted-foreground">
                            <span className="font-mono text-[11px]">{item.sku}</span>
                            <span>·</span>
                            <span>{item.quantity} {item.unit}</span>
                            {item.freeQuantity > 0 && (
                              <>
                                <span>·</span>
                                <span className="text-green-600">+{item.freeQuantity} free</span>
                              </>
                            )}
                            <span>·</span>
                            <span>LKR {item.unitPrice.toLocaleString()}</span>
                            {item.discountPercent > 0 && (
                              <>
                                <span>·</span>
                                <span className="text-orange-600">{item.discountPercent}% off</span>
                              </>
                            )}
                          </div>
                        </div>

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

          {/* 4. Good returns saved with this bill (read-only here) */}
          {goodReturns.length > 0 && (
            <Card className="border-orange-200">
              <CardHeader className="pb-3 sm:pb-4">
                <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                  <Undo2 className="w-4 h-4 text-orange-600" /> Good Returns
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm">
                  Returned on this bill and taken off the total. These can&apos;t be changed here.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-3 sm:p-4 pt-0 sm:pt-0 space-y-2">
                {goodReturns.map((r, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-3 rounded-lg border border-l-4 border-l-orange-500 bg-card px-3 py-2.5"
                  >
                    <span className="text-xs text-muted-foreground w-5 shrink-0 text-center font-medium">{idx + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-medium text-sm leading-tight">{r.productName}</span>
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded border shrink-0 bg-orange-100 text-orange-700 border-orange-200">
                          Good Return
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-x-2.5 gap-y-0 mt-1 text-xs text-muted-foreground">
                        <span className="font-mono text-[11px]">{r.sku || "-"}</span>
                        <span>·</span>
                        <span>{r.quantity}</span>
                        <span>·</span>
                        <span>LKR {Number(r.price || 0).toLocaleString()}</span>
                      </div>
                    </div>
                    <span className="font-bold text-sm text-orange-700 min-w-[60px] text-right shrink-0">
                      −{Number(r.totalValue || 0).toLocaleString()}
                    </span>
                  </div>
                ))}
                <div className="flex justify-between rounded-lg bg-orange-50 border border-orange-100 px-3 py-2.5 text-sm font-semibold text-orange-800">
                  <span>Total Returns</span>
                  <span>− LKR {goodReturnsTotal.toLocaleString()}</span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Cash received + audit reason — on phones they sit here (desktop has them in the sidebar) */}
          {!isDesktopScreen && !isLandscape && (
            <Card>
              <CardContent className="space-y-3">
                {paymentType === "Cash" && (
                  <div className="space-y-2">
                    <Label className="text-sm">Cash Received (LKR)</Label>
                    <Input
                      type="number"
                      min="0"
                      max={grandTotal}
                      value={cashPaidAmount}
                      onChange={(e) => setCashPaidAmount(e.target.value === "" ? "" : Number(e.target.value))}
                      className="h-11 font-semibold"
                      placeholder={grandTotal.toString()}
                    />
                    {(() => {
                      const balance = grandTotal - (cashPaidAmount === "" ? 0 : Number(cashPaidAmount));
                      return balance > 0 ? (
                        <p className="text-xs font-semibold text-amber-600">Balance Due: LKR {balance.toLocaleString()}</p>
                      ) : (
                        <p className="text-xs font-semibold text-green-600">Fully Paid</p>
                      );
                    })()}
                  </div>
                )}
                <Label className="text-sm">Reason for Change (Optional)</Label>
                <Textarea
                  placeholder="Reason for changes..."
                  value={changeReason}
                  onChange={(e) => setChangeReason(e.target.value)}
                  className="h-20 text-sm resize-none"
                />
              </CardContent>
            </Card>
          )}
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
                      {customers.find((c) => c.id === customerId)?.name || (
                        <span className="text-muted-foreground italic">Not selected</span>
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">Invoice</p>
                    <p className="text-sm font-medium mt-0.5 font-mono text-slate-700">{invoiceNumber}</p>
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

              {/* Items list in sidebar — landscape tablet only */}
              {!isDesktopScreen && (
                <>
                  {items.length > 0 ? (
                    <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
                      {items.map((item) => {
                        const st = itemStyle(item.supplier, item.retailOnly);
                        const isEditing = editingItemId === item.id;
                        return (
                          <div
                            key={item.id}
                            className={cn(
                              "flex items-start justify-between gap-2 rounded-lg border bg-slate-50/50 p-2 transition-all duration-200",
                              st.border,
                              isEditing ? "bg-blue-50/80 border-blue-200 shadow-sm" : "hover:bg-slate-100/70 border-slate-100"
                            )}
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1 flex-wrap">
                                <span className="font-semibold text-xs leading-tight text-slate-800 break-words">{item.productName}</span>
                                {st.label && (
                                  <span className={cn("text-[9px] font-bold px-1 py-0.2 rounded border shrink-0", st.badge)}>
                                    {st.label}
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
                                {item.discountPercent > 0 && (
                                  <span className="text-orange-600 font-semibold">{item.discountPercent}% off</span>
                                )}
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-1.5 shrink-0 ml-2">
                              <span className="font-bold text-xs text-slate-800">{item.total.toLocaleString()}</span>
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

              {/* Good returns taken off the bill */}
              {goodReturnsTotal > 0 && (
                <div className="flex justify-between text-xs text-orange-700 bg-orange-50 border border-orange-100 rounded-lg px-3 py-2">
                  <span className="flex items-center gap-1">
                    <Undo2 className="w-3 h-3" /> Good Returns ({goodReturns.length})
                  </span>
                  <span className="font-semibold">− LKR {goodReturnsTotal.toLocaleString()}</span>
                </div>
              )}

              {/* Grand Total block */}
              <div className="rounded-xl bg-green-50 border border-green-100 p-3.5">
                <p className="text-[10px] uppercase tracking-widest text-green-700 font-bold mb-1">Grand Total</p>
                <p className="text-2xl font-black text-green-700 leading-none">LKR {grandTotal.toLocaleString()}</p>
                {items.length > 0 && (
                  <p className="text-[11px] text-green-600 mt-1.5">
                    {items.length} product{items.length !== 1 ? "s" : ""} · {paymentType}
                  </p>
                )}
              </div>

              {/* Cash received (edit only) */}
              {paymentType === "Cash" && (
                <div className="border-t pt-3 space-y-2">
                  <Label className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
                    Cash Received (LKR)
                  </Label>
                  <Input
                    type="number"
                    min="0"
                    max={grandTotal}
                    value={cashPaidAmount}
                    onChange={(e) => setCashPaidAmount(e.target.value === "" ? "" : Number(e.target.value))}
                    className="h-10 font-semibold"
                    placeholder={grandTotal.toString()}
                  />
                  {(() => {
                    const paid = cashPaidAmount === "" ? 0 : Number(cashPaidAmount);
                    const balance = grandTotal - paid;
                    return balance > 0 ? (
                      <div className="flex justify-between text-xs font-semibold text-amber-600">
                        <span>Balance Due</span>
                        <span>LKR {balance.toLocaleString()}</span>
                      </div>
                    ) : (
                      <div className="flex justify-between text-xs font-semibold text-green-600">
                        <span>Status</span>
                        <span>Fully Paid</span>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Audit reason (desktop / landscape) */}
              {(isDesktopScreen || isLandscape) && (
                <div className="border-t pt-3 space-y-2">
                  <Label className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
                    Reason for Change (Optional)
                  </Label>
                  <Textarea
                    placeholder="Reason for changes..."
                    value={changeReason}
                    onChange={(e) => setChangeReason(e.target.value)}
                    className="h-16 text-sm resize-none"
                  />
                </div>
              )}

              {/* Quick action buttons */}
              {isDesktopScreen ? (
                <div className="grid grid-cols-3 gap-2 pt-1">
                  <Button variant="outline" size="sm" onClick={() => handleSaveAction("print")} disabled={!canSave} className="h-10 text-xs font-medium">
                    {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Printer className="w-3.5 h-3.5 mr-1" />}
                    A4
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleSaveAction("printHalf")} disabled={!canSave} className="h-10 text-xs font-medium">
                    {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Printer className="w-3.5 h-3.5 mr-1" />}
                    A5
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleSaveAction("save")}
                    disabled={!canSave}
                    className="h-10 bg-green-600 hover:bg-green-700 text-xs font-bold"
                  >
                    {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1" />}
                    Update
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-1.5 pt-1">
                  <Button variant="outline" size="sm" onClick={() => handleSaveAction("download")} disabled={!canSave} className="h-10 text-xs font-medium px-1">
                    {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3 mr-0.5 shrink-0" />}
                    <span>PDF</span>
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleSaveAction("print")} disabled={!canSave} className="h-10 text-xs font-medium px-1">
                    {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Printer className="w-3 h-3 mr-0.5 shrink-0" />}
                    <span>A4</span>
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleSaveAction("printHalf")} disabled={!canSave} className="h-10 text-xs font-medium px-1">
                    {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Printer className="w-3 h-3 mr-0.5 shrink-0" />}
                    <span>A5</span>
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleSaveAction("save")}
                    disabled={!canSave}
                    className="h-10 bg-green-600 hover:bg-green-700 text-xs font-bold px-1 text-white"
                  >
                    {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3 mr-0.5 shrink-0" />}
                    <span>Update</span>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── Mobile / Tablet sticky bottom bar — hidden in landscape (summary panel takes over) ── */}
      {!isLandscape && (
        <div className="xl:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t shadow-lg px-4 py-3">
          <div className="flex items-center gap-3 max-w-2xl mx-auto">
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-1.5">
                <span className="text-xs text-muted-foreground">Total</span>
                <span className="font-bold text-base text-green-600 truncate">LKR {grandTotal.toLocaleString()}</span>
              </div>
              <div className="flex gap-2 text-xs text-muted-foreground">
                <span>{items.length} item{items.length !== 1 ? "s" : ""}</span>
                {extraDiscountAmount > 0 && <span>· Disc: LKR {extraDiscountAmount.toLocaleString()}</span>}
              </div>
            </div>

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

            <Button variant="outline" size="sm" onClick={() => handleSaveAction("print")} disabled={!canSave} className="h-10 shrink-0">
              <Printer className="w-4 h-4" />
              <span className="ml-1 text-xs">A4</span>
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleSaveAction("printHalf")} disabled={!canSave} className="h-10 shrink-0">
              <Printer className="w-4 h-4" />
              <span className="ml-1 text-xs">A5</span>
            </Button>
            <Button
              size="sm"
              onClick={() => handleSaveAction("save")}
              disabled={!canSave}
              className="h-10 bg-green-600 hover:bg-green-700 font-bold shrink-0"
            >
              {saving ? <Loader2 className="w-4 h-4 sm:mr-1.5 animate-spin" /> : <Save className="w-4 h-4 sm:mr-1.5" />}
              <span className="hidden sm:inline">Update Invoice</span>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
