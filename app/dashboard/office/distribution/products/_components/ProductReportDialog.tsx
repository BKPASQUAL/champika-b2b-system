// app/dashboard/office/distribution/products/_components/ProductReportDialog.tsx
"use client";

import React, { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Printer,
  Download,
  FileSpreadsheet,
  FileText,
  DollarSign,
  Building2,
  Package,
  Layers,
  Store,
  Truck,
  Globe,
} from "lucide-react";
import { Product } from "@/app/dashboard/admin/products/types";
import {
  generateCostAndPriceReport,
  generatePriceListReport,
  exportProductsToExcel,
} from "@/app/dashboard/admin/products/product-reports";

interface ProductReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  products: Product[];
  suppliers: { id: string; name: string }[];
  categories: { id: string; name: string }[];
  isRetailPortal?: boolean;
}

export function ProductReportDialog({
  open,
  onOpenChange,
  products,
  suppliers,
  categories,
  isRetailPortal = false,
}: ProductReportDialogProps) {
  const [reportType, setReportType] = useState<"cost_price" | "price_list">("cost_price");
  const [selectedSupplier, setSelectedSupplier] = useState<string>("all");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedSubCategory, setSelectedSubCategory] = useState<string>("all");
  const [channelFilter, setChannelFilter] = useState<"all" | "distribution" | "retail_only">(
    isRetailPortal ? "all" : "all"
  );
  const [stockFilter, setStockFilter] = useState<string>("all");
  const [includeImages, setIncludeImages] = useState<boolean>(true);

  // Available sub-categories derived from current product pool & category
  const availableSubCategories = useMemo(() => {
    const pool =
      selectedCategory === "all"
        ? products
        : products.filter(
            (p) => p.category?.toLowerCase().trim() === selectedCategory.toLowerCase().trim()
          );
    const subs = Array.from(
      new Set(pool.map((p) => p.subCategory?.trim()).filter((s): s is string => Boolean(s)))
    );
    return subs.sort((a, b) => a.localeCompare(b));
  }, [products, selectedCategory]);

  // Filter products for preview metrics
  const previewProducts = useMemo(() => {
    return products.filter((p) => {
      if (p.isActive === false) return false;
      if (selectedSupplier !== "all" && p.supplier?.toLowerCase().trim() !== selectedSupplier.toLowerCase().trim()) {
        return false;
      }
      if (selectedCategory !== "all" && p.category?.toLowerCase().trim() !== selectedCategory.toLowerCase().trim()) {
        return false;
      }
      if (selectedSubCategory !== "all" && p.subCategory?.toLowerCase().trim() !== selectedSubCategory.toLowerCase().trim()) {
        return false;
      }
      if (channelFilter === "distribution" && p.retailOnly) return false;
      if (channelFilter === "retail_only" && !p.retailOnly) return false;

      if (stockFilter === "in-stock" && (p.stock || 0) <= 0) return false;
      if (stockFilter === "low" && ((p.stock || 0) <= 0 || (p.stock || 0) >= (p.minStock || 0))) return false;
      if (stockFilter === "out-of-stock" && (p.stock || 0) > 0) return false;
      return true;
    });
  }, [products, selectedSupplier, selectedCategory, selectedSubCategory, channelFilter, stockFilter]);

  const metrics = useMemo(() => {
    const totalItems = previewProducts.length;
    const distItems = previewProducts.filter((p) => !p.retailOnly).length;
    const retailItems = previewProducts.filter((p) => Boolean(p.retailOnly)).length;
    const totalStock = previewProducts.reduce((sum, p) => sum + (Number(p.stock) || 0), 0);
    const totalCostVal = previewProducts.reduce((sum, p) => sum + (Number(p.stock) || 0) * (Number(p.costPrice) || 0), 0);
    const totalSellingVal = previewProducts.reduce((sum, p) => {
      const sellPrice = (isRetailPortal && Number(p.retailPrice) > 0) ? Number(p.retailPrice) : (Number(p.sellingPrice) || 0);
      return sum + (Number(p.stock) || 0) * sellPrice;
    }, 0);
    const totalProfit = totalSellingVal - totalCostVal;
    return { totalItems, distItems, retailItems, totalStock, totalCostVal, totalSellingVal, totalProfit };
  }, [previewProducts, isRetailPortal]);

  const handleGenerate = (action: "print" | "download") => {
    const options = {
      action,
      supplierFilter: selectedSupplier,
      categoryFilter: selectedCategory,
      subCategoryFilter: selectedSubCategory,
      channelFilter,
      stockFilter,
      includeImages,
      isRetailPortal,
      title:
        reportType === "cost_price"
          ? isRetailPortal
            ? "RETAIL PRODUCT COST & SELLING PRICE REPORT (BY SUPPLIER)"
            : "PRODUCT COST & SELLING PRICE REPORT (BY SUPPLIER)"
          : isRetailPortal
            ? "RETAIL PRODUCT PRICE LIST"
            : "DISTRIBUTION PRODUCT PRICE LIST",
    };

    if (reportType === "cost_price") {
      generateCostAndPriceReport(products, options);
    } else {
      generatePriceListReport(products, options);
    }
  };

  const handleExportExcel = () => {
    exportProductsToExcel(previewProducts, {
      supplierFilter: selectedSupplier,
      categoryFilter: selectedCategory,
      subCategoryFilter: selectedSubCategory,
      channelFilter,
      includeCost: reportType === "cost_price",
      isRetailPortal,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl sm:max-w-2xl md:max-w-3xl w-[95vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-bold">
            <FileText className="w-5 h-5 text-blue-600" />
            {isRetailPortal ? "Retail Product & Price Report" : "Generate Product & Cost Report"}
          </DialogTitle>
          <DialogDescription>
            Filter by Distribution / Retail channel, Supplier, Category, and Sub-Category to generate organized valuation & price reports.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Report Type Selector */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div
              onClick={() => setReportType("cost_price")}
              className={`cursor-pointer rounded-lg border-2 p-3 transition-all ${
                reportType === "cost_price"
                  ? "border-blue-600 bg-blue-50/50 shadow-sm"
                  : "border-slate-200 hover:border-slate-300 bg-white"
              }`}
            >
              <div className="flex items-center gap-2 font-semibold text-slate-900 text-sm">
                <DollarSign className="w-4 h-4 text-blue-600" />
                Cost & Price Report
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Grouped by Category &amp; Sub-Category with Cost Price, Selling Price, Retail Price, and MRP.
              </p>
            </div>

            <div
              onClick={() => setReportType("price_list")}
              className={`cursor-pointer rounded-lg border-2 p-3 transition-all ${
                reportType === "price_list"
                  ? "border-blue-600 bg-blue-50/50 shadow-sm"
                  : "border-slate-200 hover:border-slate-300 bg-white"
              }`}
            >
              <div className="flex items-center gap-2 font-semibold text-slate-900 text-sm">
                <Package className="w-4 h-4 text-emerald-600" />
                Price List (Customer Facing)
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Clean catalog with SKU, Item Name, Unit, Selling Price, Retail Price, and MRP.
              </p>
            </div>
          </div>

          {/* Filters Grid - Fully Responsive */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {/* Channel / Item Type Filter */}
            <div className="space-y-1.5 min-w-0">
              <Label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5 whitespace-nowrap">
                <Globe className="w-3.5 h-3.5 text-blue-600" /> Channel
              </Label>
              <Select
                value={channelFilter}
                onValueChange={(val: any) => setChannelFilter(val)}
              >
                <SelectTrigger className="h-9 text-xs w-full bg-white border-slate-200">
                  <SelectValue placeholder="All Channels" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Items (Both)</SelectItem>
                  <SelectItem value="distribution">Distribution Only</SelectItem>
                  <SelectItem value="retail_only">Retail-Only Exclusive</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Supplier Filter */}
            <div className="space-y-1.5 min-w-0">
              <Label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5 whitespace-nowrap">
                <Building2 className="w-3.5 h-3.5 text-blue-600" /> Supplier
              </Label>
              <Select value={selectedSupplier} onValueChange={setSelectedSupplier}>
                <SelectTrigger className="h-9 text-xs w-full bg-white border-slate-200">
                  <SelectValue placeholder="All Suppliers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Suppliers (Grouped)</SelectItem>
                  {suppliers.map((s) => (
                    <SelectItem key={s.id || s.name} value={s.name}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Stock Filter */}
            <div className="space-y-1.5 min-w-0">
              <Label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5 whitespace-nowrap">
                <Package className="w-3.5 h-3.5 text-blue-600" /> Stock Status
              </Label>
              <Select value={stockFilter} onValueChange={setStockFilter}>
                <SelectTrigger className="h-9 text-xs w-full bg-white border-slate-200">
                  <SelectValue placeholder="All Stock" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Stock Levels</SelectItem>
                  <SelectItem value="in-stock">In-Stock Only (&gt; 0)</SelectItem>
                  <SelectItem value="low">Low Stock (Below Min)</SelectItem>
                  <SelectItem value="out-of-stock">Out of Stock (0)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Category Filter */}
            <div className="space-y-1.5 min-w-0">
              <Label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5 whitespace-nowrap">
                <Layers className="w-3.5 h-3.5 text-blue-600" /> Category
              </Label>
              <Select
                value={selectedCategory}
                onValueChange={(val) => {
                  setSelectedCategory(val);
                  setSelectedSubCategory("all");
                }}
              >
                <SelectTrigger className="h-9 text-xs w-full bg-white border-slate-200">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.id || c.name} value={c.name}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Sub Category Filter */}
            <div className="space-y-1.5 min-w-0">
              <Label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5 whitespace-nowrap">
                <Layers className="w-3.5 h-3.5 text-blue-600" /> Sub Category
              </Label>
              <Select
                value={selectedSubCategory}
                onValueChange={setSelectedSubCategory}
                disabled={availableSubCategories.length === 0}
              >
                <SelectTrigger className="h-9 text-xs w-full bg-white border-slate-200">
                  <SelectValue placeholder={availableSubCategories.length === 0 ? "No Sub Categories" : "All Sub Categories"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sub Categories</SelectItem>
                  {availableSubCategories.map((sub) => (
                    <SelectItem key={sub} value={sub}>
                      {sub}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Toggle Options */}
          <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-200">
            <div>
              <span className="text-xs font-semibold text-slate-800">Include Product Images</span>
              <p className="text-[11px] text-slate-500">
                Embed thumbnail images for each item in the report
              </p>
            </div>
            <Switch checked={includeImages} onCheckedChange={setIncludeImages} />
          </div>

          {/* Live Summary Preview Card */}
          <div className="rounded-lg bg-slate-900 text-white p-3 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-slate-300">Report Scope & Valuation Preview:</span>
              <span className="text-[11px] text-slate-400">
                🚚 Dist: <strong className="text-blue-400">{metrics.distItems}</strong> | 🛍️ Retail: <strong className="text-purple-400">{metrics.retailItems}</strong>
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
              <div className="bg-slate-800/80 rounded p-2 border border-slate-700">
                <div className="text-[11px] text-slate-400">Selected Items</div>
                <div className="text-sm font-bold text-white mt-0.5">{metrics.totalItems}</div>
              </div>
              <div className="bg-slate-800/80 rounded p-2 border border-slate-700">
                <div className="text-[11px] text-slate-400">Total Stock</div>
                <div className="text-sm font-bold text-blue-400 mt-0.5">
                  {metrics.totalStock.toLocaleString()}
                </div>
              </div>
              <div className="bg-slate-800/80 rounded p-2 border border-slate-700">
                <div className="text-[11px] text-slate-400">Stock Cost Val</div>
                <div className="text-xs font-bold text-amber-400 mt-0.5 truncate">
                  LKR {metrics.totalCostVal.toLocaleString("en-LK", { maximumFractionDigits: 0 })}
                </div>
              </div>
              <div className="bg-slate-800/80 rounded p-2 border border-slate-700">
                <div className="text-[11px] text-slate-400">{isRetailPortal ? "Retail Valuation" : "Selling Valuation"}</div>
                <div className="text-xs font-bold text-emerald-400 mt-0.5 truncate">
                  LKR {metrics.totalSellingVal.toLocaleString("en-LK", { maximumFractionDigits: 0 })}
                </div>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="flex flex-col sm:flex-row gap-2 pt-2 border-t">
          <Button
            type="button"
            variant="outline"
            onClick={handleExportExcel}
            className="sm:mr-auto text-emerald-700 border-emerald-300 hover:bg-emerald-50"
          >
            <FileSpreadsheet className="w-4 h-4 mr-1.5 text-emerald-600" /> Export Excel
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={() => handleGenerate("print")}
            className="text-slate-700 hover:bg-slate-100"
          >
            <Printer className="w-4 h-4 mr-1.5 text-blue-600" /> Print Report
          </Button>

          <Button
            type="button"
            onClick={() => handleGenerate("download")}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Download className="w-4 h-4 mr-1.5" /> Download PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
