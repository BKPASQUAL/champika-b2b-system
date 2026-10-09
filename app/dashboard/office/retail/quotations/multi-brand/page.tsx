"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCachedFetch } from "@/hooks/useCachedFetch";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Package,
  Layers,
  Sparkles,
  Download,
  Share2,
  Copy,
  Check,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Boxes,
  Truck,
  Building2,
  Search,
  Zap,
  ArrowRight,
  GitMerge,
  Printer,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { BUSINESS_IDS } from "@/app/config/business-constants";

interface Product {
  id: string;
  sku: string;
  name: string;
  category: string;
  subCategory?: string;
  brand?: string;
  subBrand?: string;
  sizeSpec?: string;
  modelType?: string;
  subModel?: string;
  supplier?: string;
  stock: number;
  minStock?: number;
  mrp: number;
  sellingPrice: number;
  costPrice: number;
  retailPrice?: number | null;
  retailOnly?: boolean;
  unitOfMeasure: string;
}

interface Customer {
  id: string;
  name: string;
  shop_name?: string;
  owner_name?: string;
  phone?: string;
  contact_number?: string;
}

interface SpecRequirement {
  id: string;
  baseName: string;
  sizeSpec: string;
  color: string;
  packSize: string;
  quantity: number;
  discountPercent: number;
}

const PRESET_POPULAR_SPECS: { baseName: string; sizeSpec: string; color: string; packSize: string; label: string }[] = [
  { baseName: "1/1.13 Wire", sizeSpec: "100m", color: "Brown", packSize: "Roll", label: "1/1.13 Brown (100m)" },
  { baseName: "1/1.13 Wire", sizeSpec: "100m", color: "Blue", packSize: "Roll", label: "1/1.13 Blue (100m)" },
  { baseName: "1/1.13 Wire", sizeSpec: "50m", color: "Brown", packSize: "Roll", label: "1/1.13 Brown (50m)" },
  { baseName: "1/1.13 Wire", sizeSpec: "50m", color: "Blue", packSize: "Roll", label: "1/1.13 Blue (50m)" },
  { baseName: "7/0.67 Wire", sizeSpec: "100m", color: "Red", packSize: "Roll", label: "7/0.67 Red (100m)" },
  { baseName: "7/0.67 Wire", sizeSpec: "100m", color: "Black", packSize: "Roll", label: "7/0.67 Black (100m)" },
  { baseName: "1 Gang 1 Way Switch", sizeSpec: "1 Gang", color: "White", packSize: "Pcs", label: "1 Gang 1 Way Switch" },
  { baseName: "2 Gang 1 Way Switch", sizeSpec: "2 Gang", color: "White", packSize: "Pcs", label: "2 Gang 1 Way Switch" },
  { baseName: "13A Socket", sizeSpec: "13A", color: "White", packSize: "Pcs", label: "13A Single Socket" },
  { baseName: "13A Double Socket", sizeSpec: "13A Double", color: "White", packSize: "Pcs", label: "13A Double Socket" },
  { baseName: "MCB 1 Pole", sizeSpec: "10A", color: "", packSize: "Pcs", label: "MCB 1P 10A" },
  { baseName: "MCB 1 Pole", sizeSpec: "32A", color: "", packSize: "Pcs", label: "MCB 1P 32A" },
  { baseName: "LED Bulb", sizeSpec: "9W", color: "Daylight", packSize: "Pcs", label: "LED Bulb 9W Daylight" },
  { baseName: "LED Bulb", sizeSpec: "12W", color: "Daylight", packSize: "Pcs", label: "LED Bulb 12W Daylight" },
];

export default function MultiBrandQuotationBuilderPage() {
  const router = useRouter();

  // API Data
  const { data: products = [], loading: productsLoading } = useCachedFetch<Product[]>("/api/products?active=true", []);
  const { data: customers = [], loading: customersLoading } = useCachedFetch<Customer[]>(
    `/api/customers?businessId=${BUSINESS_IDS.CHAMPIKA_RETAIL}`,
    []
  );

  // Customer & Header Details
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [guestName, setGuestName] = useState<string>("");
  const [guestPhone, setGuestPhone] = useState<string>("");
  const [quotationDate, setQuotationDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState<string>("Prices valid for 7 days. Subject to stock availability.");

  // Spec Requirements List
  const [requirements, setRequirements] = useState<SpecRequirement[]>([
    {
      id: "req-1",
      baseName: "1/1.13 Wire",
      sizeSpec: "100m",
      color: "Brown",
      packSize: "Roll",
      quantity: 4,
      discountPercent: 0,
    },
    {
      id: "req-2",
      baseName: "1/1.13 Wire",
      sizeSpec: "100m",
      color: "Blue",
      packSize: "Roll",
      quantity: 2,
      discountPercent: 0,
    },
    {
      id: "req-3",
      baseName: "1/1.13 Wire",
      sizeSpec: "50m",
      color: "Brown",
      packSize: "Roll",
      quantity: 1,
      discountPercent: 0,
    },
  ]);

  // Selected Brand for Active Focus Tab (or 'all' / 'custom')
  const [activeBrandTab, setActiveBrandTab] = useState<string>("all");
  const [customBrandPicks, setCustomBrandPicks] = useState<Record<string, string>>({});
  const [isConverting, setIsConverting] = useState<boolean>(false);

  // Form State for Adding New Requirement Line
  const [newBaseName, setNewBaseName] = useState("");
  const [newSizeSpec, setNewSizeSpec] = useState("");
  const [newColor, setNewColor] = useState("");
  const [newPackSize, setNewPackSize] = useState("Pcs");
  const [newQuantity, setNewQuantity] = useState<number>(1);

  // Unique Brands in Database
  const availableBrands = useMemo(() => {
    const set = new Set<string>();
    ["Orange", "ACL", "Sierra", "Kelani", "Ruhunu"].forEach((b) => set.add(b));
    products.forEach((p) => {
      const b = p.brand?.trim();
      if (b && b.toLowerCase() !== "common" && b.toLowerCase() !== "general") {
        set.add(b);
      }
    });
    return Array.from(set).sort();
  }, [products]);

  // Selected Customer details
  const selectedCustomer = useMemo(() => {
    return customers.find((c) => c.id === selectedCustomerId) || null;
  }, [customers, selectedCustomerId]);

  const customerDisplayName = selectedCustomer
    ? `${selectedCustomer.name}${selectedCustomer.shop_name ? ` (${selectedCustomer.shop_name})` : ""}`
    : (guestName.trim() || "Walk-in Customer");

  // Helper to match a requirement against a specific brand in product catalog
  const matchProductForBrand = (req: SpecRequirement, brand: string): Product | null => {
    const brandLower = brand.toLowerCase().trim();
    const baseLower = req.baseName.toLowerCase().trim();
    const sizeLower = req.sizeSpec.toLowerCase().trim();
    const colorLower = req.color.toLowerCase().trim();

    return (
      products.find((p) => {
        const pBrand = (p.brand || p.supplier || "").toLowerCase();
        const pName = p.name.toLowerCase();
        const pSize = (p.sizeSpec || "").toLowerCase();
        const pColor = (p.subModel || "").toLowerCase();

        const brandMatches = pBrand.includes(brandLower) || pName.includes(brandLower);
        if (!brandMatches) return false;

        const sizeMatches = !sizeLower || pSize.includes(sizeLower) || pName.includes(sizeLower);
        const colorMatches = !colorLower || pColor.includes(colorLower) || pName.includes(colorLower);
        const nameMatches = pName.includes(baseLower.split(" ")[0]);

        return sizeMatches && colorMatches && nameMatches;
      }) || null
    );
  };

  // Build Multi-Brand Matrix Data for All Requirements
  const comparisonMatrix = useMemo(() => {
    return requirements.map((req) => {
      const brandMatches: Record<string, { product: Product | null; unitPrice: number; lineTotal: number; inStock: boolean; stock: number }> = {};

      availableBrands.forEach((brand) => {
        const matched = matchProductForBrand(req, brand);
        if (matched) {
          const price = matched.retailPrice || matched.sellingPrice || 0;
          const discountedPrice = price * (1 - req.discountPercent / 100);
          brandMatches[brand] = {
            product: matched,
            unitPrice: discountedPrice,
            lineTotal: discountedPrice * req.quantity,
            inStock: (matched.stock || 0) >= req.quantity,
            stock: matched.stock || 0,
          };
        } else {
          brandMatches[brand] = {
            product: null,
            unitPrice: 0,
            lineTotal: 0,
            inStock: false,
            stock: 0,
          };
        }
      });

      return {
        requirement: req,
        brandMatches,
      };
    });
  }, [requirements, availableBrands, products]);

  // Totals & Stock Readiness per Brand Option
  const brandTotals = useMemo(() => {
    const totals: Record<string, { totalAmount: number; matchedCount: number; inStockCount: number; fullyReady: boolean }> = {};

    availableBrands.forEach((brand) => {
      let sum = 0;
      let matched = 0;
      let inStock = 0;

      comparisonMatrix.forEach((row) => {
        const match = row.brandMatches[brand];
        if (match && match.product) {
          sum += match.lineTotal;
          matched++;
          if (match.inStock) inStock++;
        }
      });

      totals[brand] = {
        totalAmount: sum,
        matchedCount: matched,
        inStockCount: inStock,
        fullyReady: matched === requirements.length && inStock === requirements.length,
      };
    });

    return totals;
  }, [availableBrands, comparisonMatrix, requirements]);

  // Add a Requirement Line
  const handleAddRequirement = () => {
    if (!newBaseName.trim()) {
      toast.error("Please enter a Base Item Name");
      return;
    }

    const newReq: SpecRequirement = {
      id: `req-${Date.now()}`,
      baseName: newBaseName.trim(),
      sizeSpec: newSizeSpec.trim(),
      color: newColor.trim(),
      packSize: newPackSize || "Pcs",
      quantity: Number(newQuantity) || 1,
      discountPercent: 0,
    };

    setRequirements((prev) => [...prev, newReq]);
    setNewBaseName("");
    setNewSizeSpec("");
    setNewColor("");
    setNewQuantity(1);
    toast.success("Added specification line to quotation");
  };

  // Add from popular preset
  const handleAddPreset = (preset: typeof PRESET_POPULAR_SPECS[0]) => {
    const exists = requirements.some(
      (r) =>
        r.baseName.toLowerCase() === preset.baseName.toLowerCase() &&
        r.sizeSpec.toLowerCase() === preset.sizeSpec.toLowerCase() &&
        r.color.toLowerCase() === preset.color.toLowerCase()
    );

    if (exists) {
      toast.info("This specification is already in the list.");
      return;
    }

    const newReq: SpecRequirement = {
      id: `req-${Date.now()}`,
      baseName: preset.baseName,
      sizeSpec: preset.sizeSpec,
      color: preset.color,
      packSize: preset.packSize,
      quantity: 1,
      discountPercent: 0,
    };

    setRequirements((prev) => [...prev, newReq]);
    toast.success(`Added ${preset.label}`);
  };

  const removeRequirement = (id: string) => {
    setRequirements((prev) => prev.filter((r) => r.id !== id));
    toast.info("Removed specification line");
  };

  const updateRequirement = (id: string, field: keyof SpecRequirement, val: any) => {
    setRequirements((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [field]: val } : r))
    );
  };

  // =========================================================================
  // 1. GENERATE WHATSAPP QUOTATION TEXT
  // =========================================================================
  const copyWhatsAppQuotation = () => {
    if (requirements.length === 0) {
      toast.error("Add at least one specification requirement.");
      return;
    }

    let text = `📋 *MULTI-BRAND PRICE QUOTATION*\n`;
    text += `🏬 *Champika Hardware & Electricals*\n`;
    text += `👤 *Customer:* ${customerDisplayName}\n`;
    text += `📅 *Date:* ${quotationDate}\n\n`;

    text += `*Requested Specifications:*\n`;
    requirements.forEach((req, idx) => {
      text += `${idx + 1}. ${req.baseName} ${req.sizeSpec} ${req.color} (${req.quantity} ${req.packSize})\n`;
    });
    text += `\n------------------------------------\n`;
    text += `💰 *BRAND OPTIONS & PRICE COMPARISON:*\n\n`;

    availableBrands.forEach((brand, bIdx) => {
      const bInfo = brandTotals[brand];
      if (!bInfo || bInfo.matchedCount === 0) return;

      const letter = String.fromCharCode(65 + bIdx); // A, B, C...
      text += `*Option ${letter}: ${brand.toUpperCase()}*\n`;

      comparisonMatrix.forEach((row) => {
        const m = row.brandMatches[brand];
        const specName = `${row.requirement.baseName} ${row.requirement.sizeSpec} ${row.requirement.color}`.trim();
        if (m && m.product) {
          const status = m.inStock ? "✅ In Stock" : "⚠️ Low/Out of Stock";
          text += ` • ${specName} x ${row.requirement.quantity} = LKR ${m.lineTotal.toLocaleString()} (${status})\n`;
        } else {
          text += ` • ${specName} x ${row.requirement.quantity} = (Unavailable)\n`;
        }
      });

      text += `👉 *Total ${brand}: LKR ${bInfo.totalAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}*\n\n`;
    });

    text += `📌 _${notes}_\n`;
    text += `📞 _Contact us to confirm your order._`;

    navigator.clipboard.writeText(text);
    toast.success("WhatsApp Multi-Brand Quotation copied to clipboard!");
  };

  // =========================================================================
  // 2. EXPORT MULTI-BRAND COMPARISON PDF
  // =========================================================================
  const downloadMultiBrandPdf = () => {
    if (requirements.length === 0) {
      toast.error("Add items first");
      return;
    }

    const doc = new jsPDF("landscape");

    // Header
    doc.setFontSize(18);
    doc.setTextColor(30, 41, 59);
    doc.text("CHAMPIKA HARDWARE & ELECTRICALS", 14, 18);

    doc.setFontSize(11);
    doc.setTextColor(71, 85, 105);
    doc.text("Multi-Brand Comparative Price Quotation", 14, 25);

    doc.setFontSize(9);
    doc.text(`Customer: ${customerDisplayName}`, 14, 33);
    doc.text(`Date: ${quotationDate}`, 14, 38);
    doc.text(`Valid for: 7 Days`, 14, 43);

    // Dynamic brand columns
    const activeComparingBrands = availableBrands.filter((b) => (brandTotals[b]?.matchedCount || 0) > 0);

    const headers = [
      "#",
      "Item Specification",
      "Qty",
      "Unit",
      ...activeComparingBrands.map((b) => `${b} (LKR)`),
    ];

    const bodyRows = comparisonMatrix.map((row, idx) => {
      const specLabel = `${row.requirement.baseName} ${row.requirement.sizeSpec} ${row.requirement.color}`.trim();
      const brandCols = activeComparingBrands.map((b) => {
        const match = row.brandMatches[b];
        if (match && match.product) {
          return `${match.unitPrice.toLocaleString()} (${match.lineTotal.toLocaleString()})`;
        }
        return "N/A";
      });

      return [idx + 1, specLabel, row.requirement.quantity, row.requirement.packSize, ...brandCols];
    });

    // Total Row
    const totalsRow = [
      "",
      "TOTAL PACKAGE PRICE",
      "",
      "",
      ...activeComparingBrands.map((b) => `LKR ${brandTotals[b]?.totalAmount.toLocaleString("en-US", { minimumFractionDigits: 2 }) || "0.00"}`),
    ];

    autoTable(doc, {
      startY: 48,
      head: [headers],
      body: [...bodyRows, totalsRow],
      theme: "striped",
      headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: "bold" },
      footStyles: { fillColor: [241, 245, 249], fontStyle: "bold" },
      styles: { fontSize: 9 },
    });

    doc.save(`Quotation-MultiBrand-${customerDisplayName.replace(/\s+/g, "_")}.pdf`);
    toast.success("Multi-Brand Quotation PDF downloaded!");
  };

  // =========================================================================
  // 3. 1-CLICK CONVERT SELECTED BRAND OPTION TO SALES INVOICE
  // =========================================================================
  const handleConvertBrandToInvoice = async (brandToConvert: string) => {
    const brandMatch = brandTotals[brandToConvert];
    if (!brandMatch || brandMatch.matchedCount === 0) {
      toast.error(`No products found for brand ${brandToConvert}`);
      return;
    }

    setIsConverting(true);
    try {
      const invoiceItems: any[] = [];

      for (const row of comparisonMatrix) {
        const m = row.brandMatches[brandToConvert];
        if (m && m.product) {
          invoiceItems.push({
            productId: m.product.id,
            sku: m.product.sku,
            productName: m.product.name,
            quantity: row.requirement.quantity,
            freeQuantity: 0,
            unitPrice: m.unitPrice,
            mrp: m.product.mrp || m.unitPrice,
            discountPercent: row.requirement.discountPercent || 0,
            discountAmount: (m.unitPrice * (row.requirement.discountPercent || 0)) / 100,
            total: m.lineTotal,
            unitOfMeasure: row.requirement.packSize,
          });
        }
      }

      if (invoiceItems.length === 0) {
        throw new Error("No matched items to invoice.");
      }

      const res = await fetch("/api/quotations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId: BUSINESS_IDS.CHAMPIKA_RETAIL,
          customerId: selectedCustomerId || null,
          guestName: guestName.trim() || null,
          guestPhone: guestPhone.trim() || null,
          items: invoiceItems,
          subTotal: brandMatch.totalAmount,
          extraDiscountPercent: 0,
          extraDiscountAmount: 0,
          grandTotal: brandMatch.totalAmount,
          paymentType: "Cash",
          invoiceDate: quotationDate,
          notes: `Created from Multi-Brand Option: ${brandToConvert} | ${notes}`,
          status: "Active",
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create quotation");

      toast.success(`Quotation created for ${brandToConvert}!`);
      router.push(`/dashboard/office/retail/quotations/${data.id || data.data?.id}`);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to convert quotation");
    } finally {
      setIsConverting(false);
    }
  };

  return (
    <div className="space-y-6 pb-24 max-w-7xl mx-auto">
      {/* Top Breadcrumb & Actions Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b pb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link
              href="/dashboard/office/retail/quotations"
              className="p-1 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
              <Layers className="w-6 h-6 text-blue-600" />
              Multi-Brand Quotation Builder
            </h1>
            <Badge className="bg-blue-100 text-blue-800 border-blue-200">
              Comparative Engine
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground ml-8">
            Enter specifications once to instantly generate side-by-side comparative quotes across Orange, ACL, Sierra, Kelani, and more.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={copyWhatsAppQuotation}
            className="text-xs font-semibold bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100"
          >
            <Share2 className="w-3.5 h-3.5 mr-1.5 text-emerald-600" />
            Copy WhatsApp Quote
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={downloadMultiBrandPdf}
            className="text-xs font-semibold"
          >
            <Download className="w-3.5 h-3.5 mr-1.5 text-slate-600" />
            Export PDF
          </Button>
          <Link href="/dashboard/office/distribution/products/matrix">
            <Button variant="ghost" size="sm" className="text-xs text-blue-600 hover:bg-blue-50">
              <Sparkles className="w-3.5 h-3.5 mr-1.5" /> Product Matrix Builder
            </Button>
          </Link>
        </div>
      </div>

      {/* Customer & Quotation Header Card */}
      <Card className="border-slate-200 shadow-xs">
        <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-700">Customer</Label>
            <Select value={selectedCustomerId} onValueChange={setSelectedCustomerId}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Select Customer (or Walk-in)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="walkin">Walk-in / Guest Customer</SelectItem>
                {customers.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name} {c.shop_name && `(${c.shop_name})`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {(!selectedCustomerId || selectedCustomerId === "walkin") && (
            <>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">Guest Name</Label>
                <Input
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  placeholder="e.g. Sunil Electricals"
                  className="h-9 text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">Guest Phone</Label>
                <Input
                  value={guestPhone}
                  onChange={(e) => setGuestPhone(e.target.value)}
                  placeholder="0771234567"
                  className="h-9 text-xs"
                />
              </div>
            </>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-700">Quotation Date</Label>
            <Input
              type="date"
              value={quotationDate}
              onChange={(e) => setQuotationDate(e.target.value)}
              className="h-9 text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-700">Notes / Validity</Label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Valid for 7 days..."
              className="h-9 text-xs"
            />
          </div>
        </CardContent>
      </Card>

      {/* ===================================================================== */}
      {/* BRAND COMPARISON SUMMARY CARDS (OPTION A, B, C...)                    */}
      {/* ===================================================================== */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
            <Boxes className="w-4 h-4 text-blue-600" />
            Comparative Brand Totals ({availableBrands.length} Brands Available)
          </h2>
          <span className="text-xs text-muted-foreground">
            Click any brand card to convert or view breakdown
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5">
          {availableBrands.map((brand, idx) => {
            const info = brandTotals[brand];
            const isMatched = info && info.matchedCount > 0;
            const letter = String.fromCharCode(65 + idx);

            return (
              <Card
                key={brand}
                className={`border transition-all shadow-xs ${
                  isMatched
                    ? info.fullyReady
                      ? "border-emerald-300 bg-emerald-50/40 hover:bg-emerald-50"
                      : "border-blue-200 bg-blue-50/30 hover:bg-blue-50/60"
                    : "border-slate-200 bg-slate-50 opacity-60"
                }`}
              >
                <CardContent className="p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className="text-[10px] font-bold bg-white text-slate-800">
                      Option {letter}
                    </Badge>
                    {isMatched && (
                      <span className="text-[11px] font-semibold text-emerald-700 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        {info.inStockCount}/{requirements.length} In Stock
                      </span>
                    )}
                  </div>

                  <div>
                    <h3 className="text-base font-bold text-slate-900">{brand}</h3>
                    <p className="text-lg font-extrabold text-blue-900 font-mono mt-0.5">
                      LKR {Number(info?.totalAmount || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </p>
                  </div>

                  <Button
                    size="sm"
                    disabled={!isMatched || isConverting}
                    onClick={() => handleConvertBrandToInvoice(brand)}
                    className={`w-full h-8 text-xs font-semibold shadow-2xs ${
                      info?.fullyReady
                        ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                        : "bg-blue-600 hover:bg-blue-700 text-white"
                    }`}
                  >
                    <Zap className="w-3.5 h-3.5 mr-1" />
                    Convert {brand} to Quote
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* ===================================================================== */}
      {/* SPECIFICATION REQUIREMENT BUILDER & QUICK TEMPLATES                   */}
      {/* ===================================================================== */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-3 border-b bg-slate-50/70">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Plus className="w-4 h-4 text-blue-600" />
                Add Item Requirements
              </CardTitle>
              <CardDescription className="text-xs">
                Specify the core item, size/spec, color, and quantity. The engine automatically finds all corresponding brand SKUs.
              </CardDescription>
            </div>
          </div>

          {/* Quick Preset Buttons */}
          <div className="pt-2.5 flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] text-muted-foreground font-semibold uppercase mr-1">
              Popular Specs:
            </span>
            {PRESET_POPULAR_SPECS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => handleAddPreset(preset)}
                className="px-2 py-0.5 rounded text-[11px] font-medium bg-white text-slate-700 border border-slate-200 hover:bg-slate-100 transition-all cursor-pointer shadow-2xs"
              >
                + {preset.label}
              </button>
            ))}
          </div>
        </CardHeader>

        <CardContent className="p-4 space-y-4">
          {/* Custom Spec Input Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-3 items-end p-3 rounded-xl bg-slate-50 border border-slate-200">
            <div className="space-y-1 md:col-span-2">
              <Label className="text-xs font-semibold text-slate-700">Base Item Name</Label>
              <Input
                value={newBaseName}
                onChange={(e) => setNewBaseName(e.target.value)}
                placeholder="e.g. 1/1.13 Wire or 13A Socket"
                className="h-9 text-xs bg-white"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-700">Size / Spec / Length</Label>
              <Input
                value={newSizeSpec}
                onChange={(e) => setNewSizeSpec(e.target.value)}
                placeholder="e.g. 100m, 9W, 16A"
                className="h-9 text-xs bg-white"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-700">Color / Finish</Label>
              <Input
                value={newColor}
                onChange={(e) => setNewColor(e.target.value)}
                placeholder="e.g. Brown, Blue, White"
                className="h-9 text-xs bg-white"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-700">Quantity</Label>
              <Input
                type="number"
                min="1"
                value={newQuantity}
                onChange={(e) => setNewQuantity(parseInt(e.target.value, 10) || 1)}
                className="h-9 text-xs bg-white"
              />
            </div>
            <div>
              <Button
                onClick={handleAddRequirement}
                className="w-full h-9 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-xs"
              >
                <Plus className="w-4 h-4 mr-1" /> Add Requirement
              </Button>
            </div>
          </div>

          {/* ===================================================================== */}
          {/* SIDE-BY-SIDE COMPARATIVE SPECIFICATION TABLE                          */}
          {/* ===================================================================== */}
          <div className="rounded-xl border border-slate-200 overflow-x-auto bg-white shadow-xs">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-100 text-slate-700 font-bold border-b">
                <tr>
                  <th className="p-3 w-10 text-center">#</th>
                  <th className="p-3 min-w-[200px]">Specification Requirement</th>
                  <th className="p-3 w-20 text-center">Qty</th>
                  <th className="p-3 w-20">Unit</th>
                  {availableBrands.map((brand) => (
                    <th key={brand} className="p-3 min-w-[140px] text-right bg-slate-100/80">
                      <span className="block font-extrabold text-slate-900">{brand}</span>
                      <span className="text-[10px] text-muted-foreground font-normal">Unit &amp; Total</span>
                    </th>
                  ))}
                  <th className="p-3 w-10 text-center"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {comparisonMatrix.length === 0 ? (
                  <tr>
                    <td colSpan={5 + availableBrands.length} className="p-8 text-center text-slate-400">
                      No specifications added. Use the input row or popular buttons above to start comparing.
                    </td>
                  </tr>
                ) : (
                  comparisonMatrix.map((row, idx) => (
                    <tr key={row.requirement.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3 text-center font-mono text-slate-400">{idx + 1}</td>
                      <td className="p-3">
                        <div className="font-bold text-slate-900 text-xs">
                          {row.requirement.baseName}
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                          {row.requirement.sizeSpec && (
                            <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200">
                              {row.requirement.sizeSpec}
                            </Badge>
                          )}
                          {row.requirement.color && (
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                              {row.requirement.color}
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="p-3 text-center font-bold">
                        <Input
                          type="number"
                          min="1"
                          value={row.requirement.quantity}
                          onChange={(e) =>
                            updateRequirement(row.requirement.id, "quantity", parseInt(e.target.value, 10) || 1)
                          }
                          className="w-16 h-7 text-xs text-center mx-auto"
                        />
                      </td>
                      <td className="p-3 text-slate-600 font-medium">
                        {row.requirement.packSize}
                      </td>

                      {/* Brand Columns */}
                      {availableBrands.map((brand) => {
                        const m = row.brandMatches[brand];
                        return (
                          <td key={brand} className="p-3 text-right">
                            {m && m.product ? (
                              <div className="space-y-0.5">
                                <div className="font-extrabold text-slate-900 font-mono">
                                  LKR {m.lineTotal.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                                </div>
                                <div className="text-[10px] text-muted-foreground">
                                  @ LKR {m.unitPrice.toLocaleString()}
                                </div>
                                <div>
                                  {m.inStock ? (
                                    <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.2 rounded inline-flex items-center gap-0.5">
                                      ✓ {m.stock} in stock
                                    </span>
                                  ) : (
                                    <span className="text-[10px] text-amber-700 font-bold bg-amber-50 px-1.5 py-0.2 rounded inline-flex items-center gap-0.5">
                                      ⚠️ {m.stock} left
                                    </span>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <span className="text-slate-400 text-xs italic">N/A</span>
                            )}
                          </td>
                        );
                      })}

                      <td className="p-3 text-center">
                        <button
                          type="button"
                          onClick={() => removeRequirement(row.requirement.id)}
                          className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                          title="Remove specification"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {comparisonMatrix.length > 0 && (
                <tfoot className="bg-slate-100 font-bold border-t-2 border-slate-300">
                  <tr>
                    <td colSpan={4} className="p-3 text-right text-xs uppercase tracking-wider text-slate-700">
                      Total Package Price:
                    </td>
                    {availableBrands.map((brand) => (
                      <td key={brand} className="p-3 text-right font-extrabold text-sm text-blue-950 font-mono">
                        LKR {Number(brandTotals[brand]?.totalAmount || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </td>
                    ))}
                    <td></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
