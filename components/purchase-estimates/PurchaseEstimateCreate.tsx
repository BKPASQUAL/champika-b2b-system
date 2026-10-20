"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Save,
  Loader2,
  Factory,
  RefreshCcw,
  X,
  Search,
  Copy,
  Calculator,
  Download,
  ShieldAlert,
  MessageSquare,
  Pencil,
  Check,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { copyEstimateItemsAsText } from "@/app/lib/purchase-estimate-print";
import { cn } from "@/lib/utils";

interface Product {
  id: string;
  sku: string;
  companyCode?: string;
  name: string;
  sellingPrice: number;
  costPrice: number;
  mrp: number;
  stock: number;
  unitOfMeasure: string;
  supplier: string;
}

interface Supplier {
  id: string;
  name: string;
  phone?: string;
  email?: string;
}

export interface EstimateItem {
  id: string;
  productId: string;
  sku: string;
  productName: string;
  quantity: number;
  freeQuantity: number;
  unit: string;
  mrp: number;
  sellingPrice: number;
  unitPrice: number; // Quoted Cost Price
  discountPercent: number;
  discountAmount: number;
  finalPrice: number;
  total: number;
  currentStock?: number;
}

interface PurchaseEstimateCreateProps {
  businessId: string;
  businessName: string;
  baseRoute: string; // e.g. "/dashboard/office/orange/purchase-estimates"
  estimateId?: string; // Optional: when editing an existing saved estimate
  supplierFilterKeyword?: string; // e.g. "orange" or "sierra" or "wireman"
  themeColor?: "orange" | "blue" | "emerald" | "slate";
}

const parseNumber = (val: string | number) => {
  if (val === "" || val === undefined || val === null) return 0;
  return Number(val);
};

export function PurchaseEstimateCreate({
  businessId,
  businessName,
  baseRoute,
  estimateId,
  supplierFilterKeyword,
  themeColor = "orange",
}: PurchaseEstimateCreateProps) {
  const router = useRouter();
  const [loadingData, setLoadingData] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Data States
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  // Existing Estimate State (when in Edit Mode)
  const [existingEstimateNumber, setExistingEstimateNumber] = useState<string>("");

  // Inline Item Row Editing State
  const [editingRowId, setEditingRowId] = useState<string | null>(null);

  // Form States
  const [supplierId, setSupplierId] = useState<string | null>(null);
  const [estimateDate, setEstimateDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [arrivalDate, setArrivalDate] = useState("");
  const [referenceNo, setReferenceNo] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<"Saved" | "Finalized">("Saved");
  const [extraDiscountPercent, setExtraDiscountPercent] = useState<number | string>("");

  // Items State
  const [items, setItems] = useState<EstimateItem[]>([]);

  // Dropdown & Search States
  const [searchTerm, setSearchTerm] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  // Fast entry ref
  const qtyInputRef = useRef<HTMLInputElement>(null);

  // Current Item Edit State
  const [currentItem, setCurrentItem] = useState<{
    productId: string;
    sku: string;
    currentStock: number;
    quantity: number | string;
    freeQuantity: number | string;
    mrp: number | string;
    sellingPrice: number | string;
    unitPrice: number | string;
    discountPercent: number | string;
    unit: string;
  }>({
    productId: "",
    sku: "",
    currentStock: 0,
    quantity: "",
    freeQuantity: "",
    mrp: 0,
    sellingPrice: 0,
    unitPrice: "",
    discountPercent: "",
    unit: "",
  });

  const colorStyles = {
    orange: {
      primary: "bg-orange-600 hover:bg-orange-700 text-white",
      border: "border-orange-200",
      accent: "text-orange-600",
      light: "bg-orange-50",
      header: "text-orange-950",
    },
    blue: {
      primary: "bg-blue-600 hover:bg-blue-700 text-white",
      border: "border-blue-200",
      accent: "text-blue-600",
      light: "bg-blue-50",
      header: "text-blue-950",
    },
    emerald: {
      primary: "bg-emerald-600 hover:bg-emerald-700 text-white",
      border: "border-emerald-200",
      accent: "text-emerald-600",
      light: "bg-emerald-50",
      header: "text-emerald-950",
    },
    slate: {
      primary: "bg-slate-800 hover:bg-slate-900 text-white",
      border: "border-slate-200",
      accent: "text-slate-700",
      light: "bg-slate-50",
      header: "text-slate-950",
    },
  }[themeColor];

  // 1. Fetch Products & Suppliers
  const loadData = async () => {
    setLoadingData(true);
    try {
      const [prodRes, supRes] = await Promise.all([
        fetch("/api/products?active=true"),
        fetch(`/api/suppliers?businessId=${businessId}`),
      ]);

      if (prodRes.ok) {
        const allProducts: Product[] = await prodRes.json();
        // Filter products if a keyword like 'orange', 'sierra', or 'wireman' is provided
        if (supplierFilterKeyword) {
          const kw = supplierFilterKeyword.toLowerCase();
          const filtered = allProducts.filter((p) => {
            const supName = (p.supplier || "").toLowerCase();
            const pName = (p.name || "").toLowerCase();
            const pSku = (p.sku || "").toLowerCase();
            return (
              supName.includes(kw) ||
              pName.includes(kw) ||
              pSku.startsWith(kw.slice(0, 2))
            );
          });
          setProducts(filtered.length > 0 ? filtered : allProducts);
        } else {
          setProducts(allProducts);
        }
      }

      if (supRes.ok) {
        const supplierData = await supRes.json();
        setSuppliers(supplierData);

        if (supplierFilterKeyword) {
          const kw = supplierFilterKeyword.toLowerCase();
          const matchedSup = supplierData.find((s: Supplier) =>
            s.name.toLowerCase().includes(kw)
          );
          if (matchedSup) setSupplierId(matchedSup.id);
          else if (supplierData.length === 1) setSupplierId(supplierData[0].id);
        } else if (supplierData.length === 1) {
          setSupplierId(supplierData[0].id);
        }
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to load catalog or suppliers");
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [businessId]);

  // Load existing estimate data when in Edit Mode
  useEffect(() => {
    if (!estimateId) return;
    const fetchExisting = async () => {
      try {
        const res = await fetch(`/api/purchase-estimates/${estimateId}`);
        if (!res.ok) throw new Error("Failed to load estimate for editing");
        const data = await res.json();
        if (data.supplierId) setSupplierId(data.supplierId);
        if (data.estimateDate) setEstimateDate(data.estimateDate);
        if (data.arrivalDate) setArrivalDate(data.arrivalDate);
        if (data.referenceNo) setReferenceNo(data.referenceNo);
        if (data.notes) setNotes(data.notes);
        if (data.status) setStatus(data.status);
        if (data.extraDiscountPercent !== undefined)
          setExtraDiscountPercent(data.extraDiscountPercent);
        if (Array.isArray(data.items)) setItems(data.items);
        if (data.estimateNumber) setExistingEstimateNumber(data.estimateNumber);
      } catch (err: any) {
        toast.error(err.message || "Could not load estimate");
      }
    };
    fetchExisting();
  }, [estimateId]);

  // Click outside listener for dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Global Shift+F shortcut to focus product search
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.shiftKey && (e.key === "f" || e.key === "F")) {
        e.preventDefault();
        searchInputRef.current?.focus({ preventScroll: true });
      }
    };
    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, []);

  // Product Selection
  const handleProductSelect = (product: Product) => {
    setCurrentItem({
      productId: product.id,
      sku: product.sku,
      currentStock: product.stock ?? 0,
      mrp: product.mrp || 0,
      sellingPrice: product.sellingPrice || 0,
      unitPrice: product.costPrice > 0 ? product.costPrice : "",
      discountPercent: "",
      freeQuantity: "",
      quantity: "",
      unit: product.unitOfMeasure || "Pcs",
    });
    setSearchTerm(product.name);
    setIsDropdownOpen(false);
    setHighlightedIndex(-1);
    setTimeout(() => {
      qtyInputRef.current?.focus({ preventScroll: true });
    }, 100);
  };

  // Sync latest product stock onto items if not yet set
  useEffect(() => {
    if (products.length > 0 && items.length > 0) {
      setItems((prevItems) => {
        let changed = false;
        const updated = prevItems.map((it) => {
          if (it.currentStock === undefined) {
            const p = products.find((prod) => prod.id === it.productId || prod.sku === it.sku);
            if (p) {
              changed = true;
              return { ...it, currentStock: p.stock ?? 0 };
            }
          }
          return it;
        });
        return changed ? updated : prevItems;
      });
    }
  }, [products]);

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isDropdownOpen) {
      if ((e.key === "ArrowDown" || e.key === "Enter") && searchTerm.trim().length > 0) {
        setIsDropdownOpen(true);
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((prev) => {
        const next = prev < filteredProducts.length - 1 ? prev + 1 : prev;
        itemRefs.current[next]?.scrollIntoView({ block: "nearest" });
        return next;
      });
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((prev) => {
        const next = prev > 0 ? prev - 1 : 0;
        itemRefs.current[next]?.scrollIntoView({ block: "nearest" });
        return next;
      });
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (highlightedIndex >= 0 && filteredProducts[highlightedIndex]) {
        handleProductSelect(filteredProducts[highlightedIndex]);
      } else if (filteredProducts.length === 1) {
        handleProductSelect(filteredProducts[0]);
      }
    } else if (e.key === "Escape") {
      setIsDropdownOpen(false);
    }
  };

  // Add Item to table
  const handleAddItem = () => {
    const qty = parseNumber(currentItem.quantity);
    const unitPrice = parseNumber(currentItem.unitPrice);

    if (!currentItem.productId) return toast.error("Select a product");
    if (qty <= 0) return toast.error("Enter a valid quantity");
    if (unitPrice < 0) return toast.error("Cost price cannot be negative");

    const discPct = parseNumber(currentItem.discountPercent);
    const lineDiscountAmt = ((unitPrice * discPct) / 100) * qty;
    const lineTotal = unitPrice * qty - lineDiscountAmt;
    const finalUnitPrice = qty > 0 ? lineTotal / qty : unitPrice;

    const newItem: EstimateItem = {
      id: Math.random().toString(36).substring(7),
      productId: currentItem.productId,
      sku: currentItem.sku,
      productName: searchTerm,
      quantity: qty,
      freeQuantity: parseNumber(currentItem.freeQuantity),
      unit: currentItem.unit,
      mrp: parseNumber(currentItem.mrp),
      sellingPrice: parseNumber(currentItem.sellingPrice),
      unitPrice: unitPrice,
      discountPercent: discPct,
      discountAmount: lineDiscountAmt,
      finalPrice: finalUnitPrice,
      total: lineTotal,
      currentStock: currentItem.currentStock,
    };

    setItems([...items, newItem]);

    // Reset current item
    setCurrentItem({
      productId: "",
      sku: "",
      currentStock: 0,
      quantity: "",
      freeQuantity: "",
      mrp: 0,
      sellingPrice: 0,
      unitPrice: "",
      discountPercent: "",
      unit: "",
    });
    setSearchTerm("");
    setIsDropdownOpen(false);
    setHighlightedIndex(-1);
    searchInputRef.current?.focus();
  };

  const handleRemoveItem = (id: string) => {
    if (editingRowId === id) {
      handleCancelItemEdit();
    }
    setItems(items.filter((it) => it.id !== id));
  };

  // Start editing a row in the items table
  const handleEditItem = (item: EstimateItem) => {
    const matchingProd = products.find(
      (p) => p.id === item.productId || p.sku === item.sku
    );
    setEditingRowId(item.id);
    setCurrentItem({
      productId: item.productId,
      sku: item.sku,
      currentStock: item.currentStock ?? matchingProd?.stock ?? 0,
      quantity: item.quantity,
      freeQuantity: item.freeQuantity ? item.freeQuantity : "",
      mrp: item.mrp || 0,
      sellingPrice: item.sellingPrice || 0,
      unitPrice: item.unitPrice,
      discountPercent: item.discountPercent ? item.discountPercent : "",
      unit: item.unit || "Pcs",
    });
    setSearchTerm(item.productName);
    setIsDropdownOpen(false);
    setHighlightedIndex(-1);
    qtyInputRef.current?.focus({ preventScroll: true });
    toast.info(`Editing "${item.productName}"`);
  };

  // Cancel item editing
  const handleCancelItemEdit = () => {
    setEditingRowId(null);
    setCurrentItem({
      productId: "",
      sku: "",
      currentStock: 0,
      quantity: "",
      freeQuantity: "",
      mrp: 0,
      sellingPrice: 0,
      unitPrice: "",
      discountPercent: "",
      unit: "",
    });
    setSearchTerm("");
    setIsDropdownOpen(false);
    setHighlightedIndex(-1);
  };

  // Save edited row
  const handleSaveItemEdit = () => {
    if (!editingRowId) return;
    const qty = parseNumber(currentItem.quantity);
    const unitPrice = parseNumber(currentItem.unitPrice);

    if (qty <= 0) return toast.error("Enter a valid quantity");
    if (unitPrice < 0) return toast.error("Cost price cannot be negative");

    const discPct = parseNumber(currentItem.discountPercent);
    const lineDiscountAmt = ((unitPrice * discPct) / 100) * qty;
    const lineTotal = unitPrice * qty - lineDiscountAmt;
    const finalUnitPrice = qty > 0 ? lineTotal / qty : unitPrice;

    setItems((prev) =>
      prev.map((it) =>
        it.id === editingRowId
          ? {
              ...it,
              productId: currentItem.productId || it.productId,
              sku: currentItem.sku || it.sku,
              currentStock: currentItem.currentStock ?? it.currentStock ?? 0,
              productName: searchTerm || it.productName,
              quantity: qty,
              freeQuantity: parseNumber(currentItem.freeQuantity),
              unit: currentItem.unit || it.unit,
              mrp: parseNumber(currentItem.mrp),
              sellingPrice: parseNumber(currentItem.sellingPrice),
              unitPrice: unitPrice,
              discountPercent: discPct,
              discountAmount: lineDiscountAmt,
              finalPrice: finalUnitPrice,
              total: lineTotal,
            }
          : it
      )
    );

    toast.success("Item updated successfully!");
    handleCancelItemEdit();
  };

  // Calculations
  const grossTotal = items.reduce(
    (sum, item) => sum + item.unitPrice * item.quantity,
    0
  );
  const totalLineDiscount = items.reduce(
    (sum, item) => sum + item.discountAmount,
    0
  );
  const subtotal = grossTotal - totalLineDiscount;
  const extraDiscountAmount =
    (subtotal * parseNumber(extraDiscountPercent)) / 100;
  const finalTotal = subtotal - extraDiscountAmount;

  const totalBilledQty = items.reduce((s, it) => s + it.quantity, 0);
  const totalFreeQty = items.reduce((s, it) => s + it.freeQuantity, 0);

  // Save Estimate (Create or Update)
  const handleSaveEstimate = async () => {
    if (items.length === 0) return toast.error("Add at least one item");
    if (!supplierId) return toast.error("Select a supplier");

    setSubmitting(true);
    const selectedSupplier = suppliers.find((s) => s.id === supplierId);
    const payload = {
      supplier_id: supplierId,
      business_id: businessId,
      supplier_name: selectedSupplier?.name || undefined,
      reference_no: referenceNo || "",
      estimate_date: estimateDate?.trim() || new Date().toISOString().split("T")[0],
      arrival_date: arrivalDate && arrivalDate.trim() !== "" ? arrivalDate.trim() : null,
      items: items,
      gross_total: grossTotal,
      line_discount_total: totalLineDiscount,
      sub_total: subtotal,
      extra_discount_percent: parseNumber(extraDiscountPercent),
      extra_discount_amount: extraDiscountAmount,
      total_amount: finalTotal,
      status: status,
      notes: notes,
    };

    try {
      const url = estimateId
        ? `/api/purchase-estimates/${estimateId}`
        : "/api/purchase-estimates";
      const method = estimateId ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok) {
        if (data?.code === "TABLE_NOT_FOUND") {
          toast.error(data.error, { duration: 6000 });
          return;
        }
        throw new Error(data.error || "Failed to save estimate");
      }

      toast.success(
        estimateId
          ? "Purchase Estimate Updated Successfully!"
          : data.message || "Purchase Estimate Saved!"
      );
      router.push(`${baseRoute}${estimateId ? `/${estimateId}` : ""}`);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Filter products for searchable dropdown
  const filteredProducts = products.filter((p) => {
    if (searchTerm === "") return true;
    const searchWords = searchTerm.toLowerCase().trim().split(/\s+/);
    for (const word of searchWords) {
      const pName = p.name ? p.name.toLowerCase() : "";
      const pSku = p.sku ? p.sku.toLowerCase() : "";
      const pCode = p.companyCode ? p.companyCode.toLowerCase() : "";
      if (!pName.includes(word) && !pSku.includes(word) && !pCode.includes(word)) {
        return false;
      }
    }
    return true;
  });

  const currentLineQty = parseNumber(currentItem.quantity);
  const currentLineUnitPrice = parseNumber(currentItem.unitPrice);
  const currentLineSellingPrice = parseNumber(currentItem.sellingPrice);
  const currentLineGross = currentLineUnitPrice * currentLineQty;
  const currentLineDiscountAmount =
    ((currentLineUnitPrice *
      parseNumber(currentItem.discountPercent)) /
      100) *
    currentLineQty;
  const currentLineTotal = currentLineGross - currentLineDiscountAmount;
  const currentUnitProfit =
    currentLineSellingPrice > 0 ? currentLineSellingPrice - currentLineUnitPrice : 0;
  const currentProfitMarginPct =
    currentLineSellingPrice > 0
      ? (currentUnitProfit / currentLineSellingPrice) * 100
      : 0;

  const totalEstimatedRevenue = items.reduce(
    (sum, it) => sum + (it.sellingPrice || 0) * (it.quantity || 0),
    0
  );
  const totalEstimatedProfit =
    totalEstimatedRevenue > 0 ? totalEstimatedRevenue - finalTotal : 0;
  const overallMarginPct =
    totalEstimatedRevenue > 0
      ? (totalEstimatedProfit / totalEstimatedRevenue) * 100
      : 0;

  if (loadingData) {
    return (
      <div className="flex justify-center items-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-3 text-sm text-muted-foreground">
          Loading catalog & suppliers...
        </span>
      </div>
    );
  }

  const selectedSupplier = suppliers.find((s) => s.id === supplierId);

  return (
    <div className="space-y-4 w-full pb-12">
      {/* Top Header */}
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push(baseRoute)}
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1">
          <h1 className={`text-2xl md:text-3xl font-bold tracking-tight ${colorStyles.header} flex items-center gap-2`}>
            {estimateId ? `Edit Estimate ${existingEstimateNumber}` : "New Purchase Estimate"}{" "}
            <Calculator className={`w-6 h-6 ${colorStyles.accent}`} />
          </h1>
          <p className="text-muted-foreground mt-0.5 text-xs md:text-sm">
            {estimateId
              ? "Update prices, quantities, or line discounts for this saved estimate"
              : `Calculate order amounts, check pricing & plan purchasing for ${businessName} (No stock added)`}
          </p>
        </div>

        {/* Quick Copy Button even before saving */}
        {items.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              copyEstimateItemsAsText(
                {
                  businessId,
                  supplierName: selectedSupplier?.name,
                  estimateNumber: existingEstimateNumber || "DRAFT",
                  estimateDate,
                  items,
                  subTotal: subtotal,
                  extraDiscountPercent: parseNumber(extraDiscountPercent),
                  extraDiscountAmount: extraDiscountAmount,
                  totalAmount: finalTotal,
                },
                "whatsapp"
              )
            }
            className="text-xs border-green-300 text-green-700 hover:bg-green-50 hidden sm:inline-flex"
          >
            <MessageSquare className="w-3.5 h-3.5 mr-1 text-green-600" />
            Copy Order Text
          </Button>
        )}

        <Button
          onClick={handleSaveEstimate}
          disabled={items.length === 0 || submitting}
          className={colorStyles.primary}
        >
          {submitting ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Save className="w-4 h-4 mr-2" />
          )}
          {estimateId ? "Update Estimate" : "Save Estimate"}
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* LEFT COLUMN: Inputs & Table */}
        <div className="lg:col-span-2 space-y-4">
          {/* Estimate Details Card */}
          <Card className={colorStyles.border}>
            <CardHeader className="py-3 px-4 bg-slate-50/60 border-b">
              <CardTitle className="text-sm flex items-center gap-2">
                <Factory className={`w-4 h-4 ${colorStyles.accent}`} /> Estimate & Supplier Info
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Supplier</Label>
                  <Select
                    value={supplierId || ""}
                    onValueChange={(val) => setSupplierId(val)}
                  >
                    <SelectTrigger className="w-full h-9 text-xs">
                      <SelectValue placeholder="Select Supplier" />
                    </SelectTrigger>
                    <SelectContent>
                      {suppliers.map((s) => (
                        <SelectItem key={s.id} value={s.id} className="text-xs">
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="estDate" className="text-xs">Estimate Date</Label>
                  <Input
                    id="estDate"
                    type="date"
                    className="h-9 text-xs"
                    value={estimateDate}
                    onChange={(e) => setEstimateDate(e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="refNo" className="text-xs">Supplier Quote / Ref #</Label>
                  <Input
                    id="refNo"
                    placeholder="e.g. Quotation Ref / Inquiry #"
                    className="h-9 text-xs"
                    value={referenceNo}
                    onChange={(e) => setReferenceNo(e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Item Entry Card */}
          <Card className="border">
            <CardHeader className="py-3 px-4 flex flex-row items-center justify-between border-b bg-slate-50/40">
              <CardTitle className="text-sm">Add Items to Estimate</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={loadData}
                className="text-xs h-7"
                type="button"
              >
                <RefreshCcw className="w-3 h-3 mr-1" /> Refresh
              </Button>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              {/* Product Search Input */}
              <div className="w-full relative" ref={dropdownRef}>
                <div className="flex items-center justify-between mb-1.5">
                  <Label className="text-xs font-medium">
                    Search Product ({products.length} items loaded)
                  </Label>
                  <span className="text-[11px] text-muted-foreground">
                    Keyboard shortcut: <kbd className="px-1 py-0.5 bg-slate-100 border rounded text-[10px]">Shift+F</kbd>
                  </span>
                </div>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    ref={searchInputRef}
                    placeholder="Type product name, SKU, or company code..."
                    className="pl-8 text-xs h-9"
                    value={searchTerm}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSearchTerm(val);
                      if (val.trim().length > 0) {
                        setIsDropdownOpen(true);
                      } else {
                        setIsDropdownOpen(false);
                      }
                      setHighlightedIndex(-1);
                    }}
                    onFocus={() => {
                      if (searchTerm.trim().length > 0) {
                        setIsDropdownOpen(true);
                      }
                    }}
                    onKeyDown={handleSearchKeyDown}
                  />
                  {searchTerm && (
                    <button
                      onClick={() => {
                        setSearchTerm("");
                        setIsDropdownOpen(false);
                        setCurrentItem((prev) => ({ ...prev, productId: "" }));
                        setHighlightedIndex(-1);
                      }}
                      className="absolute right-2 top-2.5 text-muted-foreground hover:text-black"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Search Results Dropdown - Only open when there is text */}
                {isDropdownOpen && searchTerm.trim().length > 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-md shadow-lg max-h-60 overflow-y-auto">
                    {filteredProducts.length === 0 ? (
                      <div className="p-3 text-xs text-center text-slate-500">
                        No products found
                      </div>
                    ) : (
                      filteredProducts.map((product, index) => (
                        <div
                          key={product.id}
                          ref={(el) => {
                            itemRefs.current[index] = el;
                          }}
                          className={`p-2.5 cursor-pointer border-b border-slate-100 last:border-0 ${
                            highlightedIndex === index
                              ? "bg-slate-100"
                              : "hover:bg-slate-50"
                          }`}
                          onMouseEnter={() => setHighlightedIndex(index)}
                          onClick={() => handleProductSelect(product)}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold text-xs text-slate-900 truncate">
                              {product.name}
                            </span>
                            <span
                              className={cn(
                                "text-[10px] font-bold px-1.5 py-0.5 rounded border shrink-0",
                                (product.stock ?? 0) <= 0
                                  ? "bg-red-50 text-red-600 border-red-200"
                                  : (product.stock ?? 0) < 10
                                  ? "bg-amber-50 text-amber-700 border-amber-200"
                                  : "bg-emerald-50 text-emerald-700 border-emerald-200"
                              )}
                            >
                              Stock: {product.stock ?? 0} {product.unitOfMeasure || "Pcs"}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 flex items-center gap-4 mt-0.5">
                            <span>
                              <strong>Code:</strong> {product.sku}
                            </span>
                            {product.companyCode && (
                              <span className="text-blue-600">
                                <strong>Comp Code:</strong> {product.companyCode}
                              </span>
                            )}
                            <span>
                              <strong>Cost:</strong> Rs. {product.costPrice}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* Selected Product Quick Info & Stock Banner */}
              {currentItem.productId && (
                <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-md text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500 font-medium">Selected:</span>
                    <span className="font-bold text-slate-900">{searchTerm}</span>
                    <span className="text-slate-400 font-mono text-[11px]">({currentItem.sku})</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="flex items-center gap-1.5">
                      <span className="text-slate-500">Current Stock:</span>
                      <span
                        className={cn(
                          "font-extrabold px-2 py-0.5 rounded text-[11px] border",
                          currentItem.currentStock <= 0
                            ? "bg-red-50 text-red-700 border-red-200"
                            : currentItem.currentStock < 10
                            ? "bg-amber-50 text-amber-800 border-amber-200"
                            : "bg-emerald-50 text-emerald-800 border-emerald-200"
                        )}
                      >
                        {currentItem.currentStock} {currentItem.unit || "Pcs"}
                      </span>
                    </span>

                    {/* Selling Price preview */}
                    {currentLineSellingPrice > 0 && (
                      <span className="flex items-center gap-1.5">
                        <span className="text-slate-500">Sell Price:</span>
                        <span className="font-mono font-bold text-purple-900">
                          Rs. {currentLineSellingPrice.toFixed(2)}
                        </span>
                      </span>
                    )}

                    {currentLineQty > 0 && (
                      <span className="flex items-center gap-1.5 text-slate-500">
                        <span>Est. After Order:</span>
                        <span className="font-bold text-indigo-900 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded text-[11px]">
                          {currentItem.currentStock + currentLineQty + parseNumber(currentItem.freeQuantity)} {currentItem.unit || "Pcs"}
                        </span>
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Editing Banner */}
              {editingRowId && (
                <div className="bg-blue-50 border border-blue-200 text-blue-900 text-xs px-3 py-2 rounded-md flex items-center justify-between">
                  <span className="flex items-center gap-1.5 font-medium">
                    <Pencil className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    Editing: <strong className="text-blue-950 font-bold">{searchTerm || "Selected Product"}</strong> — modify values below and click <strong>Update</strong>
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCancelItemEdit}
                    className="h-6 text-xs text-blue-700 hover:text-blue-900 hover:bg-blue-100 px-2"
                  >
                    Cancel
                  </Button>
                </div>
              )}

              {/* Item Fast-Entry Rows (2 Lines) */}
              <div className="space-y-2.5 pt-1">
                {/* Line 1: Reference & Pricing */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div>
                    <Label className="mb-1 block text-[11px] text-muted-foreground">Code</Label>
                    <Input
                      value={currentItem.sku || ""}
                      disabled
                      className="h-8 bg-slate-50 text-xs font-mono"
                      placeholder="Auto"
                    />
                  </div>

                  <div>
                    <Label className="mb-1 block text-[11px] font-semibold text-slate-700">
                      Current Stock
                    </Label>
                    <Input
                      value={
                        currentItem.productId
                          ? `${currentItem.currentStock} ${currentItem.unit || "Pcs"}`
                          : "-"
                      }
                      disabled
                      className={cn(
                        "h-8 text-xs font-bold",
                        !currentItem.productId
                          ? "bg-slate-50 text-slate-400"
                          : currentItem.currentStock <= 0
                          ? "bg-red-50 text-red-600 border-red-200 font-bold"
                          : currentItem.currentStock < 10
                          ? "bg-amber-50 text-amber-700 border-amber-200 font-bold"
                          : "bg-emerald-50 text-emerald-700 border-emerald-200 font-bold"
                      )}
                    />
                  </div>

                  <div>
                    <Label className="mb-1 block text-[11px] text-blue-700 font-semibold">Cost Price (Rs.)</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={currentItem.unitPrice}
                      onChange={(e) =>
                        setCurrentItem({
                          ...currentItem,
                          unitPrice: e.target.value === "" ? "" : parseFloat(e.target.value),
                        })
                      }
                      onKeyDown={(e) => e.key === "Enter" && (editingRowId ? handleSaveItemEdit() : handleAddItem())}
                      className="h-8 border-blue-200 text-xs font-mono font-bold"
                      placeholder="0.00"
                    />
                  </div>

                  <div>
                    <Label className="mb-1 block text-[11px] text-purple-700 font-semibold">
                      Selling Price (Rs.)
                    </Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={currentItem.sellingPrice}
                      onChange={(e) =>
                        setCurrentItem({
                          ...currentItem,
                          sellingPrice: e.target.value === "" ? "" : parseFloat(e.target.value),
                        })
                      }
                      onKeyDown={(e) => e.key === "Enter" && (editingRowId ? handleSaveItemEdit() : handleAddItem())}
                      className="h-8 border-purple-200 text-xs font-mono font-bold text-purple-900"
                      placeholder="0.00"
                    />
                  </div>
                </div>

                {/* Line 2: Order Quantities, Discount, Est. Total & Action */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5 items-end">
                  <div>
                    <Label className="mb-1 block text-[11px] font-semibold text-slate-700">Quantity</Label>
                    <Input
                      ref={qtyInputRef}
                      type="number"
                      min="1"
                      value={currentItem.quantity}
                      onChange={(e) =>
                        setCurrentItem({
                          ...currentItem,
                          quantity: e.target.value === "" ? "" : parseInt(e.target.value),
                        })
                      }
                      onKeyDown={(e) => e.key === "Enter" && (editingRowId ? handleSaveItemEdit() : handleAddItem())}
                      className="h-8 text-xs font-bold"
                      placeholder="Qty"
                    />
                  </div>

                  <div>
                    <Label className="mb-1 block text-[11px] text-green-700 font-medium">Free Qty</Label>
                    <Input
                      type="number"
                      min="0"
                      value={currentItem.freeQuantity}
                      onChange={(e) =>
                        setCurrentItem({
                          ...currentItem,
                          freeQuantity: e.target.value === "" ? "" : parseInt(e.target.value),
                        })
                      }
                      onKeyDown={(e) => e.key === "Enter" && (editingRowId ? handleSaveItemEdit() : handleAddItem())}
                      className="h-8 border-green-200 text-xs text-green-700"
                      placeholder="0"
                    />
                  </div>

                  <div>
                    <Label className="mb-1 block text-[11px] text-slate-700 font-medium">Disc %</Label>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={currentItem.discountPercent}
                      onChange={(e) =>
                        setCurrentItem({
                          ...currentItem,
                          discountPercent: e.target.value === "" ? "" : parseFloat(e.target.value),
                        })
                      }
                      onKeyDown={(e) => e.key === "Enter" && (editingRowId ? handleSaveItemEdit() : handleAddItem())}
                      className="h-8 text-xs"
                      placeholder="0%"
                    />
                  </div>

                  <div>
                    <Label className="mb-1 block text-[11px] text-indigo-700 font-semibold">Est. Total (Rs.)</Label>
                    <Input
                      value={currentLineTotal > 0 ? currentLineTotal.toFixed(2) : "0.00"}
                      disabled
                      className="h-8 bg-indigo-50/60 border-indigo-200 text-xs font-mono font-bold text-indigo-900"
                      placeholder="0.00"
                    />
                  </div>

                  <div className="col-span-2 sm:col-span-1">
                    {editingRowId ? (
                      <div className="flex items-center gap-1">
                        <Button
                          onClick={handleSaveItemEdit}
                          className="flex-1 h-8 bg-blue-600 hover:bg-blue-700 text-white text-xs px-2"
                          title="Update this item"
                        >
                          <Check className="w-3.5 h-3.5 mr-1" /> Update
                        </Button>
                        <Button
                          variant="outline"
                          size="icon-sm"
                          onClick={handleCancelItemEdit}
                          className="h-8 w-8 text-slate-500 hover:bg-slate-100 shrink-0"
                          title="Cancel edit"
                        >
                          <X className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    ) : (
                      <Button
                        onClick={handleAddItem}
                        className={`w-full h-8 ${colorStyles.primary} font-semibold`}
                        disabled={!currentItem.productId}
                      >
                        <Plus className="w-3.5 h-3.5 mr-1" /> Add
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Items Table */}
          <Card className="border overflow-hidden">
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-slate-50/80">
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-center w-[85px]">Stock</TableHead>
                    <TableHead className="text-right w-[95px]">Cost Price</TableHead>
                    <TableHead className="text-right w-[95px]">Sell Price</TableHead>
                    <TableHead className="text-center w-[60px]">Qty</TableHead>
                    <TableHead className="text-center w-[60px]">Free</TableHead>
                    <TableHead className="text-right w-[80px]">Disc</TableHead>
                    <TableHead className="text-right w-[110px]">Line Total</TableHead>
                    <TableHead className="w-[75px] text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-10 text-muted-foreground text-xs">
                        No items added yet. Search a product above and click Add.
                      </TableCell>
                    </TableRow>
                  ) : (
                    items.map((it) => (
                      <TableRow
                        key={it.id}
                        className={cn(
                          "text-xs transition-colors",
                          editingRowId === it.id && "bg-blue-50/80 border-blue-200"
                        )}
                      >
                        <TableCell>
                          <div className="font-semibold text-slate-900">{it.productName}</div>
                          <div className="text-[11px] text-muted-foreground font-mono">{it.sku}</div>
                        </TableCell>
                        <TableCell className="text-center">
                          <span
                            className={cn(
                              "inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-bold border",
                              (it.currentStock ?? 0) <= 0
                                ? "bg-red-50 text-red-600 border-red-200"
                                : (it.currentStock ?? 0) < 10
                                ? "bg-amber-50 text-amber-700 border-amber-200"
                                : "bg-emerald-50 text-emerald-700 border-emerald-200"
                            )}
                          >
                            {it.currentStock ?? 0} {it.unit || "Pcs"}
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-mono font-medium">
                          {it.unitPrice.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right font-mono font-semibold text-purple-950">
                          {it.sellingPrice > 0 ? Number(it.sellingPrice).toFixed(2) : "-"}
                        </TableCell>
                        <TableCell className="text-center font-bold">
                          {it.quantity}
                        </TableCell>
                        <TableCell className="text-center text-green-700 font-medium">
                          {it.freeQuantity || "-"}
                        </TableCell>
                        <TableCell className="text-right text-red-600">
                          {it.discountAmount > 0 ? it.discountAmount.toFixed(2) : "-"}
                        </TableCell>
                        <TableCell className="text-right font-mono font-bold text-slate-900">
                          {it.total.toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => handleEditItem(it)}
                              className="text-slate-400 hover:text-blue-600"
                              title="Edit item"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => handleRemoveItem(it.id)}
                              className="text-slate-400 hover:text-red-500"
                              title="Remove item"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        {/* RIGHT COLUMN: Bill Summary & Notes */}
        <div className="lg:col-span-1 space-y-4">
          <Card className={`sticky top-4 ${colorStyles.border} shadow-sm`}>
            <CardHeader className="bg-slate-50/60 py-3 px-4 border-b">
              <CardTitle className="text-sm font-semibold flex items-center justify-between">
                <span>Estimate Summary</span>
                <Badge variant="outline" className="text-[10px] font-normal">
                  {items.length} items
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3 text-xs">
              <div className="space-y-1.5 pb-2 border-b">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Supplier:</span>
                  <span className="font-semibold">{selectedSupplier?.name || "None"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Date:</span>
                  <span>{new Date(estimateDate).toLocaleDateString("en-GB")}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Quantities:</span>
                  <span className="font-semibold">
                    {totalBilledQty} Billed {totalFreeQty > 0 ? `+ ${totalFreeQty} Free` : ""}
                  </span>
                </div>
              </div>

              {/* Subtotal & Discounts */}
              <div className="space-y-2 pt-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Gross Total:</span>
                  <span className="font-mono">Rs. {grossTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                {totalLineDiscount > 0 && (
                  <div className="flex justify-between text-red-600">
                    <span>Line Discounts:</span>
                    <span className="font-mono">-Rs. {totalLineDiscount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                )}
                <div className="flex justify-between font-semibold pt-1 border-t">
                  <span>Subtotal:</span>
                  <span className="font-mono">Rs. {subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>

                {/* Extra Discount Box */}
                <div className="bg-slate-50 p-2.5 rounded-md border border-slate-200 space-y-2 mt-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-[11px] font-medium text-slate-700">
                      Extra Cash Discount (%)
                    </Label>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      value={extraDiscountPercent}
                      onChange={(e) =>
                        setExtraDiscountPercent(
                          e.target.value === "" ? "" : parseFloat(e.target.value)
                        )
                      }
                      placeholder="0%"
                      className="h-7 w-20 text-right text-xs bg-white"
                    />
                  </div>
                  {extraDiscountAmount > 0 && (
                    <div className="flex justify-between text-red-600 text-[11px] font-medium">
                      <span>Discount Amount:</span>
                      <span className="font-mono">
                        -Rs. {extraDiscountAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  )}
                </div>

                {/* Final Net Amount */}
                <div className="pt-3 border-t-2 border-slate-200">
                  <div className="flex justify-between items-baseline">
                    <span className="text-sm font-bold text-slate-900">
                      Estimated Net Total:
                    </span>
                    <span className="text-lg font-extrabold font-mono text-slate-950">
                      Rs. {finalTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                {/* Projected Sales & Profitability */}
                {totalEstimatedRevenue > 0 && (
                  <div className="bg-emerald-50/70 border border-emerald-200 rounded-md p-2.5 space-y-1.5 mt-2">
                    <div className="flex justify-between items-center text-[11px] font-semibold text-emerald-950">
                      <span className="flex items-center gap-1">
                        <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                        Projected Sales Value:
                      </span>
                      <span className="font-mono font-bold">
                        Rs. {totalEstimatedRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-[11px] text-emerald-800">
                      <span>Est. Gross Profit:</span>
                      <span className="font-mono font-bold">
                        Rs. {totalEstimatedProfit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-[11px] text-emerald-900 pt-1 border-t border-emerald-200">
                      <span>Projected Margin:</span>
                      <span className="font-bold font-mono px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-900 border border-emerald-300 text-[10px]">
                        {overallMarginPct.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Status Selector */}
              <div className="pt-2">
                <Label className="text-[11px] mb-1 block">Status</Label>
                <Select
                  value={status}
                  onValueChange={(v: "Saved" | "Finalized") => setStatus(v)}
                >
                  <SelectTrigger className="w-full h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Saved">Saved / Draft</SelectItem>
                    <SelectItem value="Finalized">Finalized (Ready to Order)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Planning Notes */}
              <div className="pt-2">
                <Label className="text-[11px] mb-1 block">Notes / Inquiry Remarks</Label>
                <Textarea
                  placeholder="Special instructions, delivery requests, or supplier remarks..."
                  className="text-xs h-18 resize-none"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              {/* Notice */}
              <div className="bg-amber-50 border border-amber-200 rounded p-2 text-[10px] text-amber-800 flex items-start gap-1.5 mt-2">
                <ShieldAlert className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  <strong>Estimate Notice:</strong> No items will be added to stock and no supplier payables will be created upon saving.
                </span>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 space-y-2">
                <Button
                  onClick={handleSaveEstimate}
                  disabled={items.length === 0 || submitting}
                  className={`w-full ${colorStyles.primary}`}
                >
                  {submitting ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4 mr-2" />
                  )}
                  {estimateId ? "Update Estimate" : "Save Estimate"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
