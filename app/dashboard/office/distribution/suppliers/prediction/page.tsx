"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Factory,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Calculator,
  Download,
  ArrowRight,
  Search,
  Sparkles,
  Clock,
  ShieldAlert,
  DollarSign,
  Layers,
  ShoppingCart,
  RefreshCcw,
  Info,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

// We import recharts components safely (will render only after client mounting)
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";

interface ProductForecast {
  id: string;
  name: string;
  sku: string;
  category: string;
  costPrice: number;
  sellingPrice: number;
  minStockLevel: number;
  stockQty: number;
  pendingOrderQty: number;
  totalUnitsSold: number;
  monthlyAverage: number;
  mrp?: number;
  monthlyTrend: Array<{
    monthKey: string;
    monthLabel: string;
    sales: number;
  }>;
}

interface SupplierInfo {
  id: string;
  name: string;
  supplier_id: string;
}

interface PredictionResponse {
  supplier: SupplierInfo | null;
  products: ProductForecast[];
  months: string[];
  numberOfMonths: number;
  suppliersList: Array<{ id: string; name: string }>;
}

export default function SupplierPredictionPage() {
  const router = useRouter();

  // Mounting safety check for Recharts SSR
  const [isMounted, setIsMounted] = useState(false);

  // States for parameters
  const [selectedSupplierName, setSelectedSupplierName] = useState<string>("");
  const [historyPeriod, setHistoryPeriod] = useState<string>("90"); // "30" | "90" | "180" | "365"
  const [leadTime, setLeadTime] = useState<number>(30); // days
  const [safetyStock, setSafetyStock] = useState<number>(15); // days
  const [coveragePeriod, setCoveragePeriod] = useState<number>(30); // days

  // Dynamic search & filters
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all"); // "all" | "reorder" | "stockout" | "healthy"

  // Data states
  const [loading, setLoading] = useState(false);
  const [suppliersList, setSuppliersList] = useState<Array<{ id: string; name: string }>>([]);
  const [products, setProducts] = useState<ProductForecast[]>([]);
  const [supplierInfo, setSupplierInfo] = useState<SupplierInfo | null>(null);

  // Manual Overrides for recommended order quantities
  const [overrides, setOverrides] = useState<Record<string, number>>({});

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Fetch initial suppliers or run initial prediction
  const fetchPredictionData = async (supplierName: string, days: number) => {
    setLoading(true);
    try {
      // Calculate start and end dates based on history period
      const to = new Date();
      const from = new Date();
      from.setDate(to.getDate() - days);
      const fromStr = from.toISOString().split("T")[0];
      const toStr = to.toISOString().split("T")[0];

      let url = `/api/reports/suppliers/prediction?from=${fromStr}&to=${toStr}`;
      if (supplierName) {
        url += `&supplier=${encodeURIComponent(supplierName)}`;
      }

      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to load forecast data");
      const data: PredictionResponse = await res.json();

      setProducts(data.products || []);
      setSupplierInfo(data.supplier || null);
      if (data.suppliersList && data.suppliersList.length > 0) {
        setSuppliersList(data.suppliersList);
        if (!supplierName && data.suppliersList[0]?.name) {
          // Default load first supplier
          setSelectedSupplierName(data.suppliersList[0].name);
          fetchPredictionData(data.suppliersList[0].name, days);
        }
      }
    } catch (err: any) {
      toast.error(err.message || "Error fetching data");
    } finally {
      setLoading(false);
    }
  };

  // Trigger fetch when supplier or history period changes
  useEffect(() => {
    fetchPredictionData(selectedSupplierName, Number(historyPeriod));
    setOverrides({}); // Reset overrides on supplier/period change
  }, [selectedSupplierName, historyPeriod]);

  // Compute number of days in selected period
  const totalDays = useMemo(() => {
    return Number(historyPeriod);
  }, [historyPeriod]);

  // List of unique categories available for filter
  const categories = useMemo(() => {
    return ["all", ...new Set(products.map((p) => p.category).filter(Boolean))];
  }, [products]);

  // Perform analytics calculation & filters
  const processedProducts = useMemo(() => {
    return products.map((p) => {
      // 1. Average Daily Sales (ADS)
      const ads = p.totalUnitsSold / totalDays;

      // 2. Lead Time Demand
      const ltd = ads * leadTime;

      // 3. Safety Stock
      const ss = ads * safetyStock;

      // 4. Reorder Point (ROP)
      const rop = ltd + ss;

      // 5. Total Effective Stock (Current + Pending Incoming)
      const effectiveStock = p.stockQty + p.pendingOrderQty;

      // 6. Check if reorder is needed (effective stock <= ROP)
      const reorderNeeded = effectiveStock <= rop;

      // 7. Recommended order quantity (target level - effective stock)
      // target stock covers lead time + safety stock + coverage cycle
      const targetStock = ads * (leadTime + safetyStock + coveragePeriod);
      let recommended = 0;
      if (reorderNeeded || effectiveStock < ss) {
        recommended = Math.max(0, Math.ceil(targetStock - effectiveStock));
      }

      // Determine Status Badge
      let status: "stockout" | "reorder" | "healthy" | "overstocked" = "healthy";
      if (p.stockQty === 0) {
        status = "stockout";
      } else if (reorderNeeded) {
        status = "reorder";
      } else if (effectiveStock > ads * (leadTime + safetyStock + 90)) {
        status = "overstocked";
      }

      // Get override if exists, else recommended
      const orderQty = overrides[p.id] !== undefined ? overrides[p.id] : recommended;
      const orderCost = orderQty * p.costPrice;

      return {
        ...p,
        ads,
        ltd,
        ss,
        rop,
        effectiveStock,
        reorderNeeded,
        recommended,
        orderQty,
        orderCost,
        status,
      };
    });
  }, [products, leadTime, safetyStock, coveragePeriod, totalDays, overrides]);

  // Filtered list based on Search, Category, and Status Filters
  const filteredProducts = useMemo(() => {
    return processedProducts.filter((p) => {
      const matchesSearch =
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.sku.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesCategory = categoryFilter === "all" || p.category === categoryFilter;

      let matchesStatus = true;
      if (statusFilter === "reorder") {
        matchesStatus = p.reorderNeeded;
      } else if (statusFilter === "stockout") {
        matchesStatus = p.stockQty === 0;
      } else if (statusFilter === "healthy") {
        matchesStatus = !p.reorderNeeded && p.stockQty > 0;
      }

      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [processedProducts, searchQuery, categoryFilter, statusFilter]);

  // Summary Metrics
  const summary = useMemo(() => {
    let reordersCount = 0;
    let stockoutsCount = 0;
    let totalCost = 0;

    processedProducts.forEach((p) => {
      if (p.reorderNeeded) reordersCount++;
      if (p.stockQty === 0) stockoutsCount++;
      totalCost += p.orderCost;
    });

    return {
      totalProducts: processedProducts.length,
      reordersNeeded: reordersCount,
      stockouts: stockoutsCount,
      totalOrderCost: totalCost,
    };
  }, [processedProducts]);

  // Handler for custom overrides
  const handleOverrideChange = (productId: string, val: string) => {
    const qty = val === "" ? 0 : Math.max(0, parseInt(val, 10));
    setOverrides((prev) => ({
      ...prev,
      [productId]: isNaN(qty) ? 0 : qty,
    }));
  };

  const handleApplyAllRecommendations = () => {
    const newOverrides: Record<string, number> = {};
    processedProducts.forEach((p) => {
      newOverrides[p.id] = p.recommended;
    });
    setOverrides(newOverrides);
    toast.success("Applied recommended order quantities to all items!");
  };

  const handleResetOverrides = () => {
    setOverrides({});
    toast.info("Cleared custom order overrides");
  };

  // Integration: Prefill new bill page
  const handleGeneratePurchaseBill = () => {
    if (!supplierInfo) {
      toast.error("Please select a supplier first");
      return;
    }

    const itemsToOrder = processedProducts
      .filter((p) => p.orderQty > 0)
      .map((p) => ({
        productId: p.id,
        sku: p.sku,
        name: p.name,
        quantity: p.orderQty,
        costPrice: p.costPrice,
        sellingPrice: p.sellingPrice,
        mrp: p.mrp || p.sellingPrice || 0,
      }));

    if (itemsToOrder.length === 0) {
      toast.error("No items have order quantities. Adjust recommended or custom orders first.");
      return;
    }

    // Write to localStorage for purchases/create to pick up
    const prefillData = {
      supplierId: supplierInfo.id,
      items: itemsToOrder,
    };

    localStorage.setItem("champika_prefill_purchase", JSON.stringify(prefillData));
    toast.success(`Generated purchase outline for ${itemsToOrder.length} products! Redirecting...`);
    router.push("/dashboard/office/distribution/purchases/create");
  };

  // Report Export: Excel
  const exportToExcel = () => {
    if (processedProducts.length === 0) {
      toast.error("No data to export");
      return;
    }

    const excelData = processedProducts.map((p) => ({
      SKU: p.sku,
      Name: p.name,
      Category: p.category,
      "Cost Price": p.costPrice,
      "Current Stock": p.stockQty,
      "Pending Incoming": p.pendingOrderQty,
      "Total Sold": p.totalUnitsSold,
      "Avg Daily Sales": p.ads.toFixed(2),
      "Lead Time Demand": p.ltd.toFixed(1),
      "Safety Stock Level": p.ss.toFixed(1),
      "Reorder Point (ROP)": p.rop.toFixed(1),
      "Status Alert": p.status.toUpperCase(),
      "Recommended Order": p.recommended,
      "Override Order": p.orderQty,
      "Order Cost": p.orderCost,
    }));

    const ws = XLSX.utils.json_to_sheet(excelData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Order Prediction");
    
    // Add columns widths
    const maxLen = 15;
    ws["!cols"] = Array(15).fill({ wch: maxLen });

    XLSX.writeFile(
      wb,
      `Order_Prediction_${supplierInfo?.name || "Supplier"}_${new Date().toISOString().split("T")[0]}.xlsx`
    );
    toast.success("Excel report exported successfully");
  };

  // Report Export: PDF
  const exportToPDF = () => {
    if (processedProducts.length === 0) {
      toast.error("No data to export");
      return;
    }

    const doc = new jsPDF("l", "mm", "a4");
    doc.setFontSize(16);
    doc.text(`Supplier Order Prediction - ${supplierInfo?.name || "N/A"}`, 14, 15);
    
    doc.setFontSize(10);
    doc.text(`Lead Time: ${leadTime} days | Safety Stock: ${safetyStock} days | Coverage: ${coveragePeriod} days | Period Analyzed: Last ${historyPeriod} Days`, 14, 22);

    const tableRows = processedProducts.map((p) => [
      p.sku,
      p.name,
      p.stockQty.toString(),
      p.pendingOrderQty.toString(),
      p.totalUnitsSold.toString(),
      p.ads.toFixed(2),
      p.rop.toFixed(1),
      p.status.toUpperCase(),
      p.orderQty.toString(),
      p.orderCost.toLocaleString(undefined, { minimumFractionDigits: 2 }),
    ]);

    autoTable(doc, {
      head: [["SKU", "Product Name", "Stock", "Pending", "Sold", "ADS", "ROP", "Status", "Order Qty", "Order Cost"]],
      body: tableRows,
      startY: 28,
      theme: "striped",
      styles: { fontSize: 8 },
      headStyles: { fillColor: [28, 58, 148] },
    });

    doc.save(`Order_Prediction_${supplierInfo?.name || "Supplier"}_${new Date().toISOString().split("T")[0]}.pdf`);
    toast.success("PDF report exported successfully");
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header Panel */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-200 pb-5">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-950 flex items-center gap-2">
            <TrendingUp className="w-8 h-8 text-blue-600 animate-pulse" />
            Supplier Order Prediction
          </h1>
          <p className="text-muted-foreground mt-1.5 text-sm md:text-base">
            Forecast sales demand and calculate recommended orders to account for long shipping lead times.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="outline"
            className="flex items-center gap-2 text-xs"
            onClick={exportToExcel}
            disabled={products.length === 0 || loading}
          >
            <Download className="w-4 h-4 text-emerald-600" /> Export Excel
          </Button>
          <Button
            variant="outline"
            className="flex items-center gap-2 text-xs"
            onClick={exportToPDF}
            disabled={products.length === 0 || loading}
          >
            <Download className="w-4 h-4 text-red-600" /> Export PDF
          </Button>
          <Button
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-md flex items-center gap-2 text-xs"
            onClick={handleGeneratePurchaseBill}
            disabled={summary.totalOrderCost === 0 || loading}
          >
            <ShoppingCart className="w-4 h-4" />
            Generate Purchase Bill
            <ArrowRight className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Main Parameters Panel */}
      <Card className="border-blue-100 shadow-sm bg-gradient-to-tr from-white to-blue-50/20">
        <CardHeader className="py-4 border-b border-blue-50">
          <CardTitle className="text-base font-bold flex items-center gap-1.5 text-blue-900">
            <Calculator className="w-5 h-5 text-blue-600" /> Forecast Configuration
          </CardTitle>
          <CardDescription>
            Configure inventory parameters to adjust how average sales demand triggers purchase predictions.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Supplier Select */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-gray-700">Supplier Name</Label>
              <Select
                value={selectedSupplierName}
                onValueChange={(val) => setSelectedSupplierName(val)}
                disabled={loading}
              >
                <SelectTrigger className="bg-white border-blue-100 focus:ring-blue-500 text-sm">
                  <SelectValue placeholder="Loading suppliers..." />
                </SelectTrigger>
                <SelectContent>
                  {suppliersList.map((sup) => (
                    <SelectItem key={sup.id} value={sup.name}>
                      {sup.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Historical Window */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-gray-700">Historical Sales Period</Label>
              <Select
                value={historyPeriod}
                onValueChange={(val) => setHistoryPeriod(val)}
                disabled={loading}
              >
                <SelectTrigger className="bg-white border-blue-100 focus:ring-blue-500 text-sm">
                  <SelectValue placeholder="Select period" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="30">Last 30 Days (Short Term)</SelectItem>
                  <SelectItem value="90">Last 90 Days (Standard)</SelectItem>
                  <SelectItem value="180">Last 180 Days (Stable)</SelectItem>
                  <SelectItem value="365">Last 365 Days (Annual Trend)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Lead Time */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-gray-700 flex items-center gap-1">
                Lead Time (Days)
                <span title="Days it takes from placing the order to receipt at warehouse.">
                  <Info className="w-3 h-3 text-slate-400" />
                </span>
              </Label>
              <Input
                type="number"
                min="0"
                className="bg-white border-blue-100 focus:ring-blue-500 text-sm"
                value={leadTime}
                onChange={(e) => setLeadTime(Math.max(0, parseInt(e.target.value, 10) || 0))}
                disabled={loading}
              />
            </div>

            {/* Safety Stock */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-gray-700 flex items-center gap-1">
                Safety Stock Buffer (Days)
                <span title="Safety buffer days of inventory to prevent stockouts.">
                  <Info className="w-3 h-3 text-slate-400" />
                </span>
              </Label>
              <Input
                type="number"
                min="0"
                className="bg-white border-blue-100 focus:ring-blue-500 text-sm"
                value={safetyStock}
                onChange={(e) => setSafetyStock(Math.max(0, parseInt(e.target.value, 10) || 0))}
                disabled={loading}
              />
            </div>

            {/* Coverage Period */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-gray-700 flex items-center gap-1">
                Coverage Cycle (Days)
                <span title="Target replenishment cycle duration (number of days of stock to buy).">
                  <Info className="w-3 h-3 text-slate-400" />
                </span>
              </Label>
              <Input
                type="number"
                min="0"
                className="bg-white border-blue-100 focus:ring-blue-500 text-sm"
                value={coveragePeriod}
                onChange={(e) => setCoveragePeriod(Math.max(0, parseInt(e.target.value, 10) || 0))}
                disabled={loading}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Products */}
        <Card className="shadow-sm border-gray-100">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1.5">
                <span className="text-muted-foreground text-xs font-semibold uppercase tracking-wider block">Total Products</span>
                <span className="text-3xl font-extrabold text-slate-900">
                  {loading ? <RefreshCcw className="w-6 h-6 animate-spin text-slate-400" /> : summary.totalProducts}
                </span>
              </div>
              <div className="p-3 bg-blue-50 rounded-xl text-blue-600">
                <Layers className="w-6 h-6" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Reorders Needed */}
        <Card className="shadow-sm border-amber-100 bg-amber-50/10">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1.5">
                <span className="text-muted-foreground text-xs font-semibold uppercase tracking-wider block">Reorder Alerts</span>
                <span className="text-3xl font-extrabold text-amber-600">
                  {loading ? <RefreshCcw className="w-6 h-6 animate-spin text-slate-400" /> : summary.reordersNeeded}
                </span>
              </div>
              <div className="p-3 bg-amber-50 rounded-xl text-amber-600">
                <AlertTriangle className="w-6 h-6" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stockout Alerts */}
        <Card className="shadow-sm border-rose-100 bg-rose-50/10">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1.5">
                <span className="text-muted-foreground text-xs font-semibold uppercase tracking-wider block">Stockouts</span>
                <span className="text-3xl font-extrabold text-rose-600">
                  {loading ? <RefreshCcw className="w-6 h-6 animate-spin text-slate-400" /> : summary.stockouts}
                </span>
              </div>
              <div className="p-3 bg-rose-50 rounded-xl text-rose-600">
                <ShieldAlert className="w-6 h-6" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Est. Total Cost */}
        <Card className="shadow-sm border-emerald-100 bg-emerald-50/10">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1.5">
                <span className="text-muted-foreground text-xs font-semibold uppercase tracking-wider block">Est. Purchase Cost</span>
                <span className="text-2xl font-extrabold text-emerald-700">
                  {loading ? (
                    <RefreshCcw className="w-6 h-6 animate-spin text-slate-400" />
                  ) : (
                    `LKR ${summary.totalOrderCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                  )}
                </span>
              </div>
              <div className="p-3 bg-emerald-50 rounded-xl text-emerald-600">
                <DollarSign className="w-6 h-6" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Forecast Tabular Details */}
      <Card className="shadow-sm">
        <CardHeader className="py-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle className="text-lg font-bold text-slate-800">Forecast Matrix</CardTitle>
            <CardDescription>
              Analyze predicted demand, view monthly historical sales distributions, and adjust purchase sizes.
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              className="text-xs text-blue-600 border-blue-200 hover:bg-blue-50"
              onClick={handleApplyAllRecommendations}
              disabled={products.length === 0 || loading}
            >
              <Sparkles className="w-3.5 h-3.5 mr-1" /> Apply Recommended
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-gray-500 hover:bg-gray-100"
              onClick={handleResetOverrides}
              disabled={Object.keys(overrides).length === 0 || loading}
            >
              Reset Custom
            </Button>
          </div>
        </CardHeader>

        {/* Toolbar Filter Controls */}
        <div className="p-4 bg-gray-50/50 border-b border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search by product name or SKU..."
              className="pl-9 bg-white text-sm"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="flex flex-wrap items-center gap-4">
            {/* Category Filter */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 font-semibold whitespace-nowrap">Category:</span>
              <Select value={categoryFilter} onValueChange={(val) => setCategoryFilter(val)}>
                <SelectTrigger className="w-40 bg-white text-xs">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat} value={cat} className="text-xs capitalize">
                      {cat === "all" ? "All Categories" : cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Status Alert Filter */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 font-semibold whitespace-nowrap">Filter Alert:</span>
              <Select value={statusFilter} onValueChange={(val) => setStatusFilter(val)}>
                <SelectTrigger className="w-40 bg-white text-xs">
                  <SelectValue placeholder="All States" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">All Products</SelectItem>
                  <SelectItem value="reorder" className="text-xs">Reorder Alerts Only</SelectItem>
                  <SelectItem value="stockout" className="text-xs">Stockouts Only</SelectItem>
                  <SelectItem value="healthy" className="text-xs">Healthy Inventory</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Forecast Table grid */}
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <RefreshCcw className="w-8 h-8 text-blue-600 animate-spin" />
                <p className="text-sm font-medium text-slate-500">Recalculating forecast formulas...</p>
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Info className="w-10 h-10 text-slate-400 mb-2" />
                <p className="font-semibold text-slate-700">No products found matching filters</p>
                <p className="text-xs text-slate-400 mt-1">Try resetting search string or selecting another supplier</p>
              </div>
            ) : (
              <Table>
                <TableHeader className="bg-gray-50/70">
                  <TableRow>
                    <TableHead className="w-72 font-semibold">Product Description</TableHead>
                    <TableHead className="text-center font-semibold">Current / Pending Stock</TableHead>
                    <TableHead className="text-center font-semibold">Sales Demand ({totalDays}d)</TableHead>
                    <TableHead className="text-center font-semibold">ROP Forecast</TableHead>
                    <TableHead className="text-center font-semibold">Inventory Status</TableHead>
                    <TableHead className="text-center font-semibold w-32">Order Qty</TableHead>
                    <TableHead className="text-right font-semibold w-40">Est. Order Cost</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProducts.map((p) => (
                    <TableRow key={p.id} className="hover:bg-slate-50/50">
                      {/* Name / Category */}
                      <TableCell className="align-middle">
                        <div className="font-semibold text-slate-900 line-clamp-2">{p.name}</div>
                        <div className="flex items-center gap-2 mt-1 text-xs text-slate-500 font-medium">
                          <span className="bg-slate-100 px-1.5 py-0.5 rounded uppercase">{p.sku}</span>
                          <span>•</span>
                          <span className="capitalize">{p.category}</span>
                        </div>
                      </TableCell>

                      {/* Stock levels */}
                      <TableCell className="align-middle text-center">
                        <div className="space-y-1">
                          <div className="text-sm font-bold text-slate-950">
                            {p.stockQty} <span className="text-xs text-slate-400 font-normal">on hand</span>
                          </div>
                          {p.pendingOrderQty > 0 && (
                            <div className="text-xs font-semibold text-blue-600 bg-blue-50 inline-block px-1.5 py-0.5 rounded">
                              +{p.pendingOrderQty} incoming
                            </div>
                          )}
                          <div className="text-xs text-slate-400">
                            Effective: {p.effectiveStock}
                          </div>
                        </div>
                      </TableCell>

                      {/* Sales Demand */}
                      <TableCell className="align-middle text-center">
                        <div className="space-y-1">
                          <div className="text-sm font-bold text-slate-800">
                            {p.totalUnitsSold} <span className="text-xs text-slate-400 font-normal">sold</span>
                          </div>
                          <div className="text-xs text-slate-500">
                            ADS: {p.ads.toFixed(2)} units/day
                          </div>
                        </div>
                      </TableCell>

                      {/* ROP Details */}
                      <TableCell className="align-middle text-center">
                        <div className="space-y-1.5 text-xs font-medium text-slate-600">
                          <div>
                            LT Demand: <span className="font-semibold text-slate-800">{p.ltd.toFixed(1)}</span>
                          </div>
                          <div>
                            Safety Buffer: <span className="font-semibold text-slate-800">{p.ss.toFixed(1)}</span>
                          </div>
                          <div className="border-t border-slate-100 pt-1 font-bold text-slate-900">
                            ROP Point: {p.rop.toFixed(1)}
                          </div>
                        </div>
                      </TableCell>

                      {/* Status Badges */}
                      <TableCell className="align-middle text-center">
                        {p.status === "stockout" && (
                          <span className="inline-flex items-center gap-1.5 bg-rose-50 border border-rose-100 text-rose-700 px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider animate-pulse">
                            <ShieldAlert className="w-3.5 h-3.5" /> Stockout
                          </span>
                        )}
                        {p.status === "reorder" && (
                          <span className="inline-flex items-center gap-1.5 bg-amber-50 border border-amber-100 text-amber-700 px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
                            <AlertTriangle className="w-3.5 h-3.5" /> Reorder Alert
                          </span>
                        )}
                        {p.status === "healthy" && (
                          <span className="inline-flex items-center gap-1.5 bg-emerald-50 border border-emerald-100 text-emerald-700 px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Healthy
                          </span>
                        )}
                        {p.status === "overstocked" && (
                          <span className="inline-flex items-center gap-1.5 bg-indigo-50 border border-indigo-100 text-indigo-700 px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
                            Overstocked
                          </span>
                        )}
                      </TableCell>

                      {/* Recommended / Custom Input */}
                      <TableCell className="align-middle text-center">
                        <div className="space-y-1.5">
                          <Input
                            type="number"
                            min="0"
                            className={`w-28 text-center text-xs font-bold h-8 focus:ring-blue-500 ${
                              overrides[p.id] !== undefined ? "border-blue-500 bg-blue-50/30" : "bg-white"
                            }`}
                            placeholder={p.recommended.toString()}
                            value={overrides[p.id] !== undefined ? overrides[p.id] : ""}
                            onChange={(e) => handleOverrideChange(p.id, e.target.value)}
                          />
                          {p.recommended > 0 && overrides[p.id] === undefined && (
                            <button
                              onClick={() => setOverrides((prev) => ({ ...prev, [p.id]: p.recommended }))}
                              className="text-[10px] text-blue-600 font-semibold hover:underline"
                            >
                              Lock recommended
                            </button>
                          )}
                          {overrides[p.id] !== undefined && (
                            <button
                              onClick={() =>
                                setOverrides((prev) => {
                                  const copy = { ...prev };
                                  delete copy[p.id];
                                  return copy;
                                })
                              }
                              className="text-[10px] text-slate-400 hover:text-slate-600 hover:underline block mx-auto"
                            >
                              Clear Override
                            </button>
                          )}
                        </div>
                      </TableCell>

                      {/* Calculated Cost */}
                      <TableCell className="align-middle text-right font-bold text-slate-900 text-sm">
                        LKR {p.orderCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        <div className="text-[10px] font-normal text-slate-400 mt-0.5">
                          Cost layer: LKR {p.costPrice.toFixed(2)}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Historical Sales Trend Chart (Only for Selected Supplier) */}
      {isMounted && products.length > 0 && !loading && (
        <Card className="shadow-sm border-slate-100">
          <CardHeader className="py-4 border-b border-gray-100">
            <CardTitle className="text-base font-bold flex items-center gap-1.5 text-slate-800">
              <Clock className="w-5 h-5 text-indigo-600" /> Aggregated Supplier Sales Demand Trend
            </CardTitle>
            <CardDescription>
              Shows aggregate monthly units sold for all products associated with {supplierInfo?.name}.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={
                    // Compute aggregated sales trend
                    useMemo(() => {
                      if (products.length === 0) return [];
                      const monthsMap: Record<string, { label: string; qty: number }> = {};
                      products.forEach((p) => {
                        p.monthlyTrend.forEach((m) => {
                          if (!monthsMap[m.monthKey]) {
                            monthsMap[m.monthKey] = { label: m.monthLabel, qty: 0 };
                          }
                          monthsMap[m.monthKey].qty += m.sales;
                        });
                      });
                      return Object.values(monthsMap);
                    }, [products])
                  }
                  margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2563eb" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="label" stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "white",
                      borderColor: "#e2e8f0",
                      borderRadius: "8px",
                      fontSize: "12px",
                      boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="qty"
                    name="Aggregate Sold Units"
                    stroke="#2563eb"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorSales)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
