"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
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
  Pencil,
  X,
  FileText,
  Printer,
  Download,
  Share2,
  Layers,
  Sparkles,
  Boxes,
  CheckCircle2,
  AlertCircle,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
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
import { getUserBusinessContext } from "@/app/middleware/businessAuth";
import { BUSINESS_IDS, BUSINESS_NAMES } from "@/app/config/business-constants";

interface Product {
  id: string;
  sku: string;
  name: string;
  category?: string;
  brand?: string;
  subBrand?: string;
  sizeSpec?: string;
  subModel?: string;
  modelType?: string;
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
}

// Brand-specific variant details for a quotation item
interface BrandVariant {
  brand: string;
  productId: string;
  sku: string;
  productName: string;
  unitPrice: number;
  mrp: number;
  stock: number;
  available: boolean;
}

interface QuotationItem {
  id: string;
  baseItemName: string;      // Unified base name e.g. "1/1.13 Blue 100m Roll"
  sizeSpec: string;          // e.g. "100m"
  color: string;             // e.g. "Blue"
  unit: string;              // e.g. "Roll"
  quantity: number;
  freeQuantity: number;
  discountPercent: number;
  primaryBrand: string;      // The brand originally selected
  brandVariants: Record<string, BrandVariant>; // Orange, ACL, Sierra, Kelani, etc.
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
  currentStock: number;
}

// Helper to sanitize base item name by stripping brand prefixes
function extractBaseItemName(productName: string, brand?: string): string {
  let name = productName.trim();
  const knownBrands = ["Orange", "ACL", "Sierra", "Kelani", "Ruhunu", "Wireman", "Orel", "Common", "General"];
  if (brand && brand.trim()) {
    knownBrands.unshift(brand.trim());
  }

  for (const b of knownBrands) {
    const reg = new RegExp(`^${b}\\s+`, "i");
    name = name.replace(reg, "");
  }
  return name.trim() || productName;
}

export default function CreateQuotationPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [stockLoading, setStockLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [businessId] = useState(BUSINESS_IDS.CHAMPIKA_RETAIL);
  const [businessName, setBusinessName] = useState("");
  const [userId, setUserId] = useState<string | null>(null);

  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [guestCustomerId, setGuestCustomerId] = useState<string | null>(null);

  const [customerId, setCustomerId] = useState<string | null>(null);
  const [quotationDate, setQuotationDate] = useState(new Date().toISOString().split("T")[0]);
  const [paymentType, setPaymentType] = useState("Cash");
  const [notes, setNotes] = useState("");

  // Mode: Standard vs Multi-Brand Comparative Option Builder
  const [quotationMode, setQuotationMode] = useState<"standard" | "multi_brand">("standard");
  const [activeBrandOption, setActiveBrandOption] = useState<string>("all");

  const [items, setItems] = useState<QuotationItem[]>([]);
  const [extraDiscount, setExtraDiscount] = useState(0);

  const [customerOpen, setCustomerOpen] = useState(false);
  const [productOpen, setProductOpen] = useState(false);
  const [supplierFilter, setSupplierFilter] = useState<"all" | "sierra" | "wireman" | "orange" | "retail" | "other">("all");

  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [currentItem, setCurrentItem] = useState<CurrentItemState>({
    productId: "", sku: "", quantity: "", freeQuantity: "", unit: "",
    mrp: "", unitPrice: "", discountPercent: "", currentStock: 0,
  });

  const quantityInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        const user = getUserBusinessContext();
        if (!user) { router.push("/login"); return; }

        setBusinessName(user.businessName ?? BUSINESS_NAMES[BUSINESS_IDS.CHAMPIKA_RETAIL]);
        setUserId(user.id);

        const [customersRes, productsRes] = await Promise.all([
          fetch(`/api/customers?businessId=${BUSINESS_IDS.CHAMPIKA_RETAIL}`),
          fetch(`/api/products?active=true`),
        ]);

        const customersData = await customersRes.json();
        const productsData = await productsRes.json();

        const retailCustomers = (customersData || []).filter(
          (c: any) => c.business_id === BUSINESS_IDS.CHAMPIKA_RETAIL || c.businessId === BUSINESS_IDS.CHAMPIKA_RETAIL
        );

        const guest = retailCustomers.find((c: any) => {
          const n = (c.shop_name || c.shopName || c.name || "").toLowerCase();
          return n.includes("walk-in") || n.includes("guest");
        });
        if (guest) { setGuestCustomerId(guest.id); setCustomerId(guest.id); }

        setCustomers(retailCustomers.map((c: any) => ({
          id: c.id,
          name: c.shop_name || c.shopName,
          shop_name: c.shop_name || c.shopName,
          owner_name: c.owner_name || c.ownerName,
        })));

        if (Array.isArray(productsData)) {
          setProducts(productsData.map((p: any) => ({
            id: p.id,
            sku: p.sku || "N/A",
            name: p.name,
            category: p.category || "",
            brand: p.brand || p.supplier || "",
            subBrand: p.subBrand || "",
            sizeSpec: p.sizeSpec || "",
            subModel: p.subModel || "",
            modelType: p.modelType || "",
            selling_price: p.sellingPrice || 0,
            retail_price: p.retailPrice ?? null,
            mrp: p.mrp || 0,
            stock_quantity: p.stock || 0,
            unit_of_measure: p.unitOfMeasure || "unit",
            supplier: p.supplier || "",
            retailOnly: p.retailOnly ?? false,
          })));
        }
      } catch {
        toast.error("Failed to load data");
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [router]);

  // Major brand list in catalog
  const majorBrands = useMemo(() => {
    const list = ["Orange", "ACL", "Sierra", "Kelani", "Wireman"];
    const found = new Set<string>();
    products.forEach((p) => {
      const b = (p.brand || p.supplier || "").trim();
      if (b && !b.toLowerCase().includes("retail") && !b.toLowerCase().includes("common")) {
        const matching = list.find((m) => b.toLowerCase().includes(m.toLowerCase()));
        if (matching) found.add(matching);
        else found.add(b);
      }
    });
    return Array.from(found);
  }, [products]);

  // Handle product selection in form
  const handleProductSelect = (productId: string) => {
    const product = products.find((p) => p.id === productId);
    if (!product) return;
    setCurrentItem({
      productId: product.id, sku: product.sku,
      quantity: "", freeQuantity: "", unit: product.unit_of_measure,
      mrp: product.mrp, unitPrice: product.retail_price ?? product.selling_price,
      discountPercent: "", currentStock: product.stock_quantity,
    });
    setTimeout(() => { quantityInputRef.current?.focus(); quantityInputRef.current?.select(); }, 150);
  };

  const resetCurrentItem = () => {
    setCurrentItem({ productId: "", sku: "", quantity: "", freeQuantity: "", unit: "", mrp: "", unitPrice: "", discountPercent: "", currentStock: 0 });
    setEditingItemId(null);
  };

  // Find all sibling brand variants for a selected product
  const findBrandVariantsForProduct = (selectedProd: Product): Record<string, BrandVariant> => {
    const baseName = extractBaseItemName(selectedProd.name, selectedProd.brand);
    const sizeSpecLower = (selectedProd.sizeSpec || "").toLowerCase().trim();
    const subModelLower = (selectedProd.subModel || "").toLowerCase().trim();
    const primaryBrand = selectedProd.brand || selectedProd.supplier || "Standard";

    const variants: Record<string, BrandVariant> = {};

    // 1. Primary selected brand entry
    variants[primaryBrand] = {
      brand: primaryBrand,
      productId: selectedProd.id,
      sku: selectedProd.sku,
      productName: selectedProd.name,
      unitPrice: selectedProd.retail_price ?? selectedProd.selling_price,
      mrp: selectedProd.mrp || (selectedProd.retail_price ?? selectedProd.selling_price),
      stock: selectedProd.stock_quantity,
      available: true,
    };

    // 2. Scan catalog for equivalent sibling brand products matching same Base Item & Specs
    products.forEach((p) => {
      if (p.id === selectedProd.id) return;
      const pBrand = p.brand || p.supplier || "";
      if (!pBrand || variants[pBrand]) return; // already populated

      const pBase = extractBaseItemName(p.name, p.brand);
      const pSize = (p.sizeSpec || "").toLowerCase().trim();
      const pColor = (p.subModel || "").toLowerCase().trim();

      const sameBase = pBase.toLowerCase() === baseName.toLowerCase() || p.name.toLowerCase().includes(baseName.toLowerCase().split(" ")[0]);
      const sameSize = sizeSpecLower ? pSize === sizeSpecLower || p.name.toLowerCase().includes(sizeSpecLower) : true;
      const sameColor = subModelLower ? pColor === subModelLower || p.name.toLowerCase().includes(subModelLower) : true;

      if (sameBase && sameSize && sameColor) {
        variants[pBrand] = {
          brand: pBrand,
          productId: p.id,
          sku: p.sku,
          productName: p.name,
          unitPrice: p.retail_price ?? p.selling_price,
          mrp: p.mrp || (p.retail_price ?? p.selling_price),
          stock: p.stock_quantity,
          available: true,
        };
      }
    });

    return variants;
  };

  // Add Item (stores unified Base Item with brand variants)
  const handleAddItem = () => {
    if (!currentItem.productId) { toast.error("Please select a product"); return; }
    const qty = currentItem.quantity === "" ? 0 : currentItem.quantity;
    if (qty <= 0) { toast.error("Quantity must be greater than 0"); return; }

    const selectedProd = products.find((p) => p.id === currentItem.productId);
    if (!selectedProd) return;

    const unitPrice = currentItem.unitPrice === "" ? (selectedProd.retail_price ?? selectedProd.selling_price) : currentItem.unitPrice;
    const mrp = currentItem.mrp === "" ? selectedProd.mrp : currentItem.mrp;
    const freeQty = currentItem.freeQuantity === "" ? 0 : currentItem.freeQuantity;
    const discountPercent = currentItem.discountPercent === "" ? 0 : currentItem.discountPercent;

    const baseName = extractBaseItemName(selectedProd.name, selectedProd.brand);
    const primaryBrand = selectedProd.brand || selectedProd.supplier || "Orange";
    const brandVariants = findBrandVariantsForProduct(selectedProd);

    // Override primary variant price if user customized it
    if (brandVariants[primaryBrand]) {
      brandVariants[primaryBrand].unitPrice = unitPrice;
      brandVariants[primaryBrand].mrp = mrp;
    }

    const newItem: QuotationItem = {
      id: editingItemId ?? Date.now().toString(),
      baseItemName: baseName,
      sizeSpec: selectedProd.sizeSpec || "",
      color: selectedProd.subModel || "",
      unit: selectedProd.unit_of_measure || "Pcs",
      quantity: qty,
      freeQuantity: freeQty,
      discountPercent,
      primaryBrand,
      brandVariants,
    };

    if (editingItemId) {
      setItems(items.map((i) => (i.id === editingItemId ? newItem : i)));
      toast.success("Item updated");
    } else {
      setItems([...items, newItem]);
      toast.success(`Added "${baseName}" with ${Object.keys(brandVariants).length} brand option(s)!`);
    }
    resetCurrentItem();
  };

  const handleEditItem = (itemId: string) => {
    const item = items.find((i) => i.id === itemId);
    if (!item) return;
    setEditingItemId(itemId);
    const primaryVar = item.brandVariants[item.primaryBrand] || Object.values(item.brandVariants)[0];
    setCurrentItem({
      productId: primaryVar?.productId || "",
      sku: primaryVar?.sku || "",
      quantity: item.quantity,
      freeQuantity: item.freeQuantity,
      unit: item.unit,
      mrp: primaryVar?.mrp || "",
      unitPrice: primaryVar?.unitPrice || "",
      discountPercent: item.discountPercent,
      currentStock: primaryVar?.stock || 0,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Distinct Brands found across all quotation items
  const quotationBrands = useMemo(() => {
    const set = new Set<string>();
    items.forEach((item) => {
      Object.keys(item.brandVariants).forEach((b) => set.add(b));
    });
    return Array.from(set);
  }, [items]);

  // Brand Option Totals (calculates exact quotation total per brand option)
  const brandOptionSummaries = useMemo(() => {
    const summaries: Record<string, { brand: string; total: number; availableCount: number; missingCount: number }> = {};

    quotationBrands.forEach((b) => {
      let bTotal = 0;
      let avail = 0;
      let missing = 0;

      items.forEach((item) => {
        const v = item.brandVariants[b];
        if (v && v.available) {
          const gross = v.unitPrice * item.quantity;
          const disc = (gross * item.discountPercent) / 100;
          bTotal += gross - disc;
          avail++;
        } else {
          missing++;
        }
      });

      summaries[b] = {
        brand: b,
        total: bTotal,
        availableCount: avail,
        missingCount: missing,
      };
    });

    return summaries;
  }, [quotationBrands, items]);

  // Calculate totals based on active brand option tab (or primary brand total if 'all')
  const calculatedTotals = useMemo(() => {
    let sub = 0;
    let gross = 0;
    let itemDisc = 0;

    items.forEach((item) => {
      const activeVar =
        activeBrandOption === "all"
          ? (item.brandVariants[item.primaryBrand] || Object.values(item.brandVariants)[0])
          : item.brandVariants[activeBrandOption];

      if (activeVar) {
        const g = activeVar.unitPrice * item.quantity;
        const d = (g * item.discountPercent) / 100;
        gross += g;
        itemDisc += d;
        sub += g - d;
      }
    });

    const extraDiscAmount = (sub * extraDiscount) / 100;
    const grand = sub - extraDiscAmount;

    return {
      subtotal: sub,
      grossTotal: gross,
      totalItemDiscount: itemDisc,
      extraDiscountAmount: extraDiscAmount,
      grandTotal: grand,
    };
  }, [items, activeBrandOption, extraDiscount]);

  const safeUnitPrice = currentItem.unitPrice === "" ? 0 : currentItem.unitPrice;
  const safeQty = currentItem.quantity === "" ? 0 : currentItem.quantity;
  const safeDiscount = currentItem.discountPercent === "" ? 0 : currentItem.discountPercent;
  const currentLineTotal = safeUnitPrice * safeQty - (safeUnitPrice * safeQty * safeDiscount) / 100;

  const filteredProducts = products.filter((p) => {
    if (supplierFilter === "all") return true;
    if (supplierFilter === "retail") return p.retailOnly;
    const sup = (p.supplier || p.brand || "").toLowerCase();
    if (supplierFilter === "sierra") return sup.includes("sierra") && !p.retailOnly;
    if (supplierFilter === "wireman") return sup.includes("wireman") && !p.retailOnly;
    if (supplierFilter === "orange") return sup.includes("orange") && !p.retailOnly;
    if (supplierFilter === "other") return !sup.includes("sierra") && !sup.includes("wireman") && !sup.includes("orange") && !p.retailOnly;
    return false;
  });

  // Copy WhatsApp Quotation with Multi-Brand Comparison
  const handleCopyWhatsApp = () => {
    if (items.length === 0) { toast.error("Please add items first"); return; }
    const customerObj = customers.find((c) => c.id === customerId);
    const custName = customerObj ? customerObj.name : "Walk-in Customer";

    let text = `📋 *QUOTATION - CHAMPIKA HARDWARE & ELECTRICALS*\n`;
    text += `👤 *Customer:* ${custName}\n`;
    text += `📅 *Date:* ${quotationDate}\n\n`;

    if (quotationBrands.length > 1) {
      text += `*BRAND OPTIONS & COMPARISON:*\n\n`;
      quotationBrands.forEach((b, idx) => {
        const letter = String.fromCharCode(65 + idx);
        const bInfo = brandOptionSummaries[b];
        text += `*Option ${letter}: ${b.toUpperCase()}*\n`;

        items.forEach((it) => {
          const v = it.brandVariants[b];
          if (v) {
            const lineTot = (v.unitPrice * it.quantity) * (1 - it.discountPercent / 100);
            const stockTag = v.stock >= it.quantity ? "✅ In Stock" : `⚠️ Stock: ${v.stock}`;
            text += ` • ${it.baseItemName} x ${it.quantity} ${it.unit} = LKR ${lineTot.toLocaleString()} (${stockTag})\n`;
          } else {
            text += ` • ${it.baseItemName} x ${it.quantity} ${it.unit} = (Not Available)\n`;
          }
        });

        text += `👉 *Total ${b}: LKR ${Number(bInfo?.total || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}*\n\n`;
      });
    } else {
      text += `*Items:*\n`;
      items.forEach((it, idx) => {
        const v = Object.values(it.brandVariants)[0];
        const lineTot = v ? (v.unitPrice * it.quantity) * (1 - it.discountPercent / 100) : 0;
        text += `${idx + 1}. ${it.baseItemName} x ${it.quantity} ${it.unit} = LKR ${lineTot.toLocaleString()}\n`;
      });
      text += `\n*TOTAL: LKR ${calculatedTotals.grandTotal.toLocaleString("en-US", { minimumFractionDigits: 2 })}*\n`;
    }

    text += `\n📌 _${notes || "Prices valid for 7 days. Subject to stock availability."}_`;
    navigator.clipboard.writeText(text);
    toast.success("WhatsApp quotation copied to clipboard!");
  };

  // Save Quotation
  const handleSave = async (action: "save" | "print" | "download" = "save") => {
    if (!customerId) { toast.error("Please select a customer"); return; }
    if (items.length === 0) { toast.error("Please add at least one item"); return; }

    setSaving(true);
    try {
      const activeBrand = activeBrandOption !== "all" ? activeBrandOption : (items[0]?.primaryBrand || "Orange");

      // Extract items for active brand selection
      const invoiceItems = items.map((i) => {
        const v = i.brandVariants[activeBrand] || (i.brandVariants[i.primaryBrand] || Object.values(i.brandVariants)[0]);
        const unitP = v?.unitPrice || 0;
        const gross = unitP * i.quantity;
        const disc = (gross * i.discountPercent) / 100;
        return {
          productId: v?.productId || "",
          sku: v?.sku || "",
          productName: v?.productName || i.baseItemName,
          quantity: i.quantity,
          freeQuantity: i.freeQuantity,
          unit: i.unit,
          mrp: v?.mrp || unitP,
          unitPrice: unitP,
          discountPercent: i.discountPercent,
          discountAmount: disc,
          total: gross - disc,
          brand: activeBrand,
          supplier: activeBrand,
        };
      });

      const brandSuffix = activeBrandOption !== "all" ? ` [Brand Option: ${activeBrandOption.toUpperCase()}]` : "";

      const res = await fetch("/api/quotations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId,
          businessId,
          salesRepId: userId,
          items: invoiceItems,
          invoiceDate: quotationDate,
          subTotal: calculatedTotals.subtotal,
          extraDiscountPercent: extraDiscount,
          extraDiscountAmount: calculatedTotals.extraDiscountAmount,
          grandTotal: calculatedTotals.grandTotal,
          paymentType,
          notes: `${notes || ""}${brandSuffix}`.trim() || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create quotation");

      toast.success(`Quotation ${data.data.quotation_no} saved!`);
      
      let redirect = `/dashboard/office/retail/quotations/${data.data.id}`;
      if (action === "print") {
        redirect += "?print=true";
      } else if (action === "download") {
        redirect += "?download=true";
      }
      router.push(redirect);
    } catch (err: any) {
      toast.error(err.message || "Failed to save quotation");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex justify-center items-center py-16"><Loader2 className="h-8 w-8 animate-spin text-green-600" /></div>;

  return (
    <div className="space-y-4 pb-28 xl:pb-6 mx-auto">
      {/* Desktop header */}
      <div className="hidden xl:flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" className="shrink-0" onClick={() => router.push("/dashboard/office/retail/quotations")}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">Create Quotation</h1>
            <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border ml-2">
              <button
                type="button"
                onClick={() => { setQuotationMode("standard"); setActiveBrandOption("all"); }}
                className={cn(
                  "px-2.5 py-1 text-xs font-semibold rounded-md transition-all",
                  quotationMode === "standard" ? "bg-white text-slate-900 shadow-2xs font-bold" : "text-slate-600 hover:text-slate-900"
                )}
              >
                Standard
              </button>
              <button
                type="button"
                onClick={() => setQuotationMode("multi_brand")}
                className={cn(
                  "px-2.5 py-1 text-xs font-semibold rounded-md transition-all flex items-center gap-1",
                  quotationMode === "multi_brand" ? "bg-emerald-600 text-white shadow-2xs font-bold" : "text-slate-600 hover:text-slate-900"
                )}
              >
                <Layers className="w-3 h-3" /> Multi-Brand Comparative
              </button>
            </div>
          </div>
          <p className="text-muted-foreground text-sm mt-0.5">{businessName} · New quotation (no stock deducted until converted)</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopyWhatsApp}
            className="text-xs bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100"
          >
            <Share2 className="w-4 h-4 mr-1.5 text-emerald-600" />
            WhatsApp Quote
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleSave("download")}
            disabled={items.length === 0 || saving}
          >
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
            Save & Download
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleSave("print")}
            disabled={items.length === 0 || saving}
          >
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Printer className="w-4 h-4 mr-2" />}
            Save & Print
          </Button>
          <Button
            size="sm"
            onClick={() => handleSave("save")}
            disabled={items.length === 0 || saving}
            className="bg-green-600 hover:bg-green-700"
          >
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Save Quotation
          </Button>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        {/* LEFT COLUMN */}
        <div className="xl:col-span-2 space-y-4">
          {/* Details Card */}
          <Card>
            <CardHeader className="pb-0 flex flex-row items-center gap-3">
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 xl:hidden" onClick={() => router.push("/dashboard/office/retail/quotations")}>
                <ArrowLeft className="w-4 h-4 text-slate-500" />
              </Button>
              <div className="flex-1">
                <CardTitle className="text-base">Quotation Details</CardTitle>
                <p className="text-xs text-amber-600 mt-0.5">Stock is NOT deducted until this quotation is converted to a bill.</p>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 pt-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Label>Customer <span className="text-red-500">*</span></Label>
                    {guestCustomerId && (
                      <Button variant="secondary" size="sm" className="h-6 text-xs bg-blue-100 text-blue-700 hover:bg-blue-200" onClick={() => { setCustomerId(guestCustomerId); setCustomerOpen(false); toast.success("Selected Walk-in Customer"); }}>
                        Walk-in / Guest
                      </Button>
                    )}
                  </div>
                  <Popover open={customerOpen} onOpenChange={setCustomerOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" role="combobox" className="w-full justify-between">
                        {customerId ? customers.find((c) => c.id === customerId)?.name : "Select Customer"}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Search customer..." />
                        <CommandList>
                          <CommandEmpty>No customer found</CommandEmpty>
                          <CommandGroup>
                            {customers.map((c) => (
                              <CommandItem key={c.id} value={`${c.name} ${c.owner_name || ""}`} onSelect={() => { setCustomerId(c.id); setCustomerOpen(false); }}>
                                <Check className={cn("mr-2 h-4 w-4", customerId === c.id ? "opacity-100" : "opacity-0")} />
                                <div>
                                  <div className="font-medium">{c.name}</div>
                                  {c.owner_name && <div className="text-xs text-muted-foreground">{c.owner_name}</div>}
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
                  <Label>Date</Label>
                  <Input type="date" value={quotationDate} onChange={(e) => setQuotationDate(e.target.value)} className="h-11" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Payment Type</Label>
                  <Select value={paymentType} onValueChange={setPaymentType}>
                    <SelectTrigger className="h-11 w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Cash">💵 Cash</SelectItem>
                      <SelectItem value="Credit">📋 Credit</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Input placeholder="Optional note for this quotation..." value={notes} onChange={(e) => setNotes(e.target.value)} className="h-11" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Add Products Card */}
          <Card>
            <CardHeader className="pb-0">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Add Products</CardTitle>
                <span className="text-xs text-muted-foreground">
                  Select item · Base name &amp; brand options are linked automatically
                </span>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 pt-3">
              {/* Supplier filter */}
              <div className="flex gap-2 pb-2 border-b overflow-x-auto scrollbar-hide flex-nowrap">
                {(["all", "sierra", "wireman", "orange", "retail", "other"] as const).map((f) => {
                  const labels: Record<string, string> = { all: "🌐 All", sierra: "🟣 Sierra", wireman: "🔴 Wireman", orange: "🟠 Orange", retail: "🛍️ Retail Only", other: "⚪ Other" };
                  const colors: Record<string, string> = { all: "bg-slate-900", sierra: "bg-purple-600", wireman: "bg-red-600", orange: "bg-orange-500", retail: "bg-emerald-600", other: "bg-slate-600" };
                  return (
                    <Button key={f} type="button" variant={supplierFilter === f ? "default" : "outline"} size="sm"
                      onClick={() => setSupplierFilter(f)}
                      className={cn("h-8 text-xs font-semibold rounded-full shrink-0 transition-all", supplierFilter === f && `${colors[f]} text-white`)}>
                      {labels[f]}
                    </Button>
                  );
                })}
              </div>

              {/* Product search */}
              <Popover open={productOpen} onOpenChange={setProductOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" className="w-full justify-between" disabled={stockLoading}>
                    {currentItem.productId ? products.find((p) => p.id === currentItem.productId)?.name : "Select Product / Base Item"}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start" side="bottom" avoidCollisions={false}>
                  <Command>
                    <CommandInput placeholder="Search product or base spec..." />
                    <CommandList className="max-h-[400px]">
                      <CommandEmpty>No products found</CommandEmpty>
                      <CommandGroup>
                        {filteredProducts.map((p) => {
                          const isSierra = (p.supplier || "").toLowerCase().includes("sierra");
                          const isWireman = (p.supplier || "").toLowerCase().includes("wireman");
                          const isOrange = (p.supplier || "").toLowerCase().includes("orange");
                          const isRetailOnly = p.retailOnly;
                          let borderClass = "border-l-4 border-slate-300";
                          let badgeColor = "bg-slate-100 text-slate-700 border-slate-200";
                          let supplierLabel = "Other";
                          if (isRetailOnly) { borderClass = "border-l-4 border-emerald-500"; badgeColor = "bg-emerald-100 text-emerald-800 border-emerald-200"; supplierLabel = "Retail Only"; }
                          else if (isSierra) { borderClass = "border-l-4 border-purple-500"; badgeColor = "bg-purple-100 text-purple-700 border-purple-200"; supplierLabel = "Sierra"; }
                          else if (isWireman) { borderClass = "border-l-4 border-red-500"; badgeColor = "bg-red-100 text-red-700 border-red-200"; supplierLabel = "Wireman"; }
                          else if (isOrange) { borderClass = "border-l-4 border-orange-500"; badgeColor = "bg-orange-100 text-orange-700 border-orange-200"; supplierLabel = "Orange"; }
                          return (
                            <CommandItem key={p.id} value={`${p.name} ${p.sku} ${p.supplier || ""}`}
                              onSelect={() => { handleProductSelect(p.id); setProductOpen(false); }}
                              className={cn("px-3 py-2 cursor-pointer", borderClass)}>
                              <Check className={cn("mr-2 h-4 w-4 shrink-0", currentItem.productId === p.id ? "opacity-100" : "opacity-0")} />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="font-semibold text-slate-900 truncate">{p.name}</span>
                                  <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0", badgeColor)}>{supplierLabel}</span>
                                </div>
                                <div className="text-xs text-muted-foreground flex gap-x-2 mt-0.5">
                                  <span className="font-mono">{p.sku}</span>
                                  <span>•</span>
                                  <span>Stock: <strong className={p.stock_quantity === 0 ? "text-red-500" : "text-slate-700"}>{p.stock_quantity}</strong></span>
                                  <span>•</span>
                                  <span>LKR {(p.retail_price ?? p.selling_price).toLocaleString()}</span>
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

              {/* Qty + Free Qty + Unit + Stock */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase">Quantity</Label>
                  <Input ref={quantityInputRef} type="number" min="1" value={currentItem.quantity} className="h-11"
                    onChange={(e) => setCurrentItem({ ...currentItem, quantity: e.target.value === "" ? "" : Number(e.target.value) })}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddItem(); } }} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase">Free Qty</Label>
                  <Input type="number" min="0" value={currentItem.freeQuantity} className="h-11"
                    onChange={(e) => setCurrentItem({ ...currentItem, freeQuantity: e.target.value === "" ? "" : Number(e.target.value) })}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddItem(); } }} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase">Unit</Label>
                  <Input value={currentItem.unit || "—"} disabled className="bg-muted h-11 text-center font-medium" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase">In Stock</Label>
                  <Input value={currentItem.currentStock || "—"} disabled
                    className={cn("h-11 text-center font-bold bg-muted", currentItem.currentStock === 0 ? "text-red-500" : "text-slate-700")} />
                </div>
              </div>

              {/* Price row */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase">MRP</Label>
                  <Input type="number" value={currentItem.mrp} className="h-11"
                    onChange={(e) => setCurrentItem({ ...currentItem, mrp: e.target.value === "" ? "" : Number(e.target.value) })} placeholder="0.00" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase">Unit Price</Label>
                  <Input type="number" value={currentItem.unitPrice} className="h-11"
                    onChange={(e) => setCurrentItem({ ...currentItem, unitPrice: e.target.value === "" ? "" : Number(e.target.value) })} placeholder="0.00" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase">Discount %</Label>
                  <Input type="number" min="0" max="100" value={currentItem.discountPercent} className="h-11"
                    onChange={(e) => setCurrentItem({ ...currentItem, discountPercent: e.target.value === "" ? "" : Number(e.target.value) })} placeholder="0" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase">Line Total</Label>
                  <Input value={currentLineTotal.toFixed(2)} disabled className="h-11 font-bold bg-green-50 text-green-700 border-green-100 text-right" />
                </div>
              </div>

              {/* Add/Update buttons */}
              <div className={cn("grid gap-2", editingItemId ? "grid-cols-2" : "grid-cols-1")}>
                {editingItemId && (
                  <Button variant="outline" onClick={resetCurrentItem} className="h-12"><X className="w-4 h-4 mr-2" />Cancel</Button>
                )}
                <Button onClick={handleAddItem} disabled={!currentItem.productId}
                  className={cn("h-12 text-base font-bold", editingItemId ? "bg-blue-600 hover:bg-blue-700" : "bg-green-600 hover:bg-green-700")}>
                  {editingItemId ? <><Pencil className="w-4 h-4 mr-2" />Update Item</> : <><Plus className="w-4 h-4 mr-2" />Add to Quotation</>}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Quotation Items Table Card with Multi-Brand Option Tabs */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    Quotation Items
                    <Badge variant="outline" className="text-xs font-mono">
                      {items.length} base specs
                    </Badge>
                  </CardTitle>
                </div>

                {/* Brand Option Tabs (Option A: Orange, Option B: ACL, etc.) */}
                {quotationBrands.length > 0 && (
                  <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border overflow-x-auto">
                    <button
                      type="button"
                      onClick={() => setActiveBrandOption("all")}
                      className={cn(
                        "px-2.5 py-1 text-xs font-semibold rounded-md transition-all whitespace-nowrap cursor-pointer",
                        activeBrandOption === "all"
                          ? "bg-slate-900 text-white font-bold shadow-2xs"
                          : "text-slate-600 hover:text-slate-900"
                      )}
                    >
                      Comparative View
                    </button>
                    {quotationBrands.map((b, idx) => {
                      const letter = String.fromCharCode(65 + idx);
                      const isSelected = activeBrandOption === b;
                      const summary = brandOptionSummaries[b];
                      return (
                        <button
                          key={b}
                          type="button"
                          onClick={() => setActiveBrandOption(b)}
                          className={cn(
                            "px-2.5 py-1 text-xs font-semibold rounded-md transition-all whitespace-nowrap cursor-pointer flex items-center gap-1",
                            isSelected
                              ? "bg-emerald-600 text-white font-bold shadow-2xs"
                              : "text-slate-600 hover:text-slate-900"
                          )}
                        >
                          <span>Option {letter}: {b}</span>
                          <span className={cn("text-[10px] px-1 py-0.2 rounded font-mono", isSelected ? "bg-emerald-700 text-white" : "bg-slate-200 text-slate-700")}>
                            LKR {Number(summary?.total || 0).toLocaleString()}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {items.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-muted-foreground rounded-lg border border-dashed">
                  <Package className="w-8 h-8 mb-2 opacity-40" />
                  <p className="text-sm">No items added yet</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {items.map((item, idx) => {
                    const activeVariant =
                      activeBrandOption === "all"
                        ? (item.brandVariants[item.primaryBrand] || Object.values(item.brandVariants)[0])
                        : item.brandVariants[activeBrandOption];

                    const isEditing = editingItemId === item.id;
                    const isAvailableInActiveBrand = !!activeVariant;

                    return (
                      <div
                        key={item.id}
                        className={cn(
                          "rounded-lg border px-3 py-2.5 transition-colors space-y-2",
                          isAvailableInActiveBrand
                            ? isEditing
                              ? "bg-blue-50/60 border-blue-200"
                              : "hover:bg-muted/40"
                            : "bg-amber-50/40 border-amber-200"
                        )}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs text-muted-foreground font-mono w-5 text-center">{idx + 1}</span>
                            <span className="font-bold text-sm text-slate-900">{item.baseItemName}</span>
                            {item.sizeSpec && (
                              <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200">
                                {item.sizeSpec}
                              </Badge>
                            )}
                            {item.color && (
                              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                {item.color}
                              </Badge>
                            )}
                            <span className="text-xs font-semibold text-slate-700 ml-1">
                              Qty: {item.quantity} {item.unit}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {activeVariant ? (
                              <span className="font-bold text-sm text-slate-900 font-mono">
                                LKR {((activeVariant.unitPrice * item.quantity) * (1 - item.discountPercent / 100)).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                              </span>
                            ) : (
                              <Badge variant="outline" className="text-[10px] text-amber-700 bg-amber-50 border-amber-200">
                                ⚠️ Unavailable in {activeBrandOption}
                              </Badge>
                            )}
                            <Button variant="ghost" size="icon" className={cn("h-7 w-7", isEditing && "bg-blue-100")} onClick={() => handleEditItem(item.id)}>
                              <Pencil className="w-3.5 h-3.5 text-blue-500" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setItems(items.filter((i) => i.id !== item.id)); if (editingItemId === item.id) resetCurrentItem(); }}>
                              <Trash2 className="w-3.5 h-3.5 text-destructive" />
                            </Button>
                          </div>
                        </div>

                        {/* Comparative Brand Options Chips for this Base Item */}
                        <div className="flex items-center gap-2 flex-wrap pt-1 border-t border-slate-100">
                          <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                            Brand Prices:
                          </span>
                          {Object.entries(item.brandVariants).map(([brandName, v]) => {
                            const isBrandActive = activeBrandOption === brandName || (activeBrandOption === "all" && item.primaryBrand === brandName);
                            return (
                              <div
                                key={brandName}
                                className={cn(
                                  "px-2 py-0.5 rounded text-[11px] font-medium border flex items-center gap-1.5 transition-all",
                                  isBrandActive
                                    ? "bg-slate-900 text-white border-slate-900 font-semibold shadow-2xs"
                                    : "bg-slate-50 text-slate-700 border-slate-200"
                                )}
                              >
                                <span>{brandName}:</span>
                                <span className={isBrandActive ? "text-emerald-300 font-bold" : "text-emerald-700 font-semibold"}>
                                  LKR {v.unitPrice.toLocaleString()}
                                </span>
                                <span className={cn("text-[9px]", v.stock >= item.quantity ? "text-emerald-500" : "text-amber-500")}>
                                  ({v.stock} in stock)
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* RIGHT SIDEBAR (SUMMARY CARD) */}
        <div className="xl:col-span-1 hidden xl:block">
          <Card className="sticky top-6">
            <CardHeader className="pb-2 border-b">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold text-slate-700">Summary</CardTitle>
                {activeBrandOption !== "all" && (
                  <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px]">
                    OPTION: {activeBrandOption.toUpperCase()}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              <div className="space-y-1.5">
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">Customer</p>
                <p className="text-sm font-semibold text-slate-800">
                  {customers.find((c) => c.id === customerId)?.name || <span className="text-muted-foreground italic">Not selected</span>}
                </p>
              </div>
              <div className="space-y-1.5">
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">Payment</p>
                <p className={cn("text-sm font-semibold", paymentType === "Cash" ? "text-green-600" : "text-orange-600")}>
                  {paymentType === "Cash" ? "💵 Cash" : "📋 Credit"}
                </p>
              </div>
              <div className="border-t pt-3 space-y-1.5">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Gross Total</span><span>LKR {calculatedTotals.grossTotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Item Discounts</span><span className="text-red-500">− LKR {calculatedTotals.totalItemDiscount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm font-semibold border-t pt-1">
                  <span>Subtotal</span><span>LKR {calculatedTotals.subtotal.toLocaleString()}</span>
                </div>
              </div>
              <div className="border-t pt-3 space-y-2">
                <Label className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Extra Discount %</Label>
                <Input type="number" min="0" max="100" value={extraDiscount} onChange={(e) => setExtraDiscount(Number(e.target.value))} className="h-10" />
                {calculatedTotals.extraDiscountAmount > 0 && (
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Extra Discount</span><span className="text-red-500">− LKR {calculatedTotals.extraDiscountAmount.toLocaleString()}</span>
                  </div>
                )}
              </div>
              <div className="rounded-xl bg-amber-50 border border-amber-100 p-3.5">
                <p className="text-[10px] uppercase tracking-widest text-amber-700 font-bold mb-1">
                  {activeBrandOption !== "all" ? `${activeBrandOption.toUpperCase()} QUOTATION TOTAL` : "QUOTATION TOTAL"}
                </p>
                <p className="text-2xl font-black text-amber-700">LKR {calculatedTotals.grandTotal.toLocaleString()}</p>
                {items.length > 0 && <p className="text-[11px] text-amber-600 mt-1">{items.length} base specification{items.length !== 1 ? "s" : ""}</p>}
              </div>
              <div className="space-y-2">
                <Button onClick={() => handleSave("save")} disabled={items.length === 0 || saving} className="w-full h-11 bg-green-600 hover:bg-green-700 font-bold">
                  {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileText className="w-4 h-4 mr-2" />}
                  Save Quotation {activeBrandOption !== "all" ? `(${activeBrandOption})` : ""}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCopyWhatsApp}
                  className="w-full h-9 text-xs font-semibold bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100"
                >
                  <Share2 className="w-3.5 h-3.5 mr-1.5 text-emerald-600" />
                  Copy WhatsApp Multi-Brand Quote
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Mobile sticky bottom bar */}
      <div className="xl:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t shadow-lg px-4 py-3">
        <div className="flex items-center gap-3 max-w-2xl mx-auto">
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-1.5">
              <span className="text-xs text-muted-foreground">Total</span>
              <span className="font-bold text-base text-amber-600 truncate">LKR {calculatedTotals.grandTotal.toLocaleString()}</span>
            </div>
            <div className="text-xs text-muted-foreground">{items.length} item{items.length !== 1 ? "s" : ""}</div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <Label className="text-xs text-muted-foreground whitespace-nowrap">Extra %</Label>
            <Input type="number" min="0" max="100" placeholder="0" value={extraDiscount} onChange={(e) => setExtraDiscount(Number(e.target.value))} className="w-16 h-9 text-sm text-center" />
          </div>
          <Button size="sm" onClick={() => handleSave("save")} disabled={items.length === 0 || saving} className="h-10 bg-green-600 hover:bg-green-700 font-bold shrink-0">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 sm:mr-1.5" />}
            <span className="hidden sm:inline ml-1.5">Save Quotation</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
