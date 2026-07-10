"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ChartTooltip,
  ResponsiveContainer,
  LineChart,
  Line,
} from "recharts";
import {
  Factory,
  Calendar,
  Download,
  Search,
  RefreshCw,
  TrendingUp,
  Package,
  Sliders,
  DollarSign,
  AlertTriangle,
  ArrowLeft,
  ChevronRight,
  Info,
  Percent,
  Printer,
} from "lucide-react";
import { toast } from "sonner";
import { TablePagination } from "@/components/ui/TablePagination";

const fmt = (n: number) =>
  n.toLocaleString("en-LK", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

const fmtCurr = (n: number) =>
  "LKR " + n.toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function getQuickRange(quickSelect: string) {
  const now = new Date();
  let from: Date, to: Date;
  switch (quickSelect) {
    case "3-months":
      from = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
      to = new Date();
      break;
    case "6-months":
      from = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
      to = new Date();
      break;
    case "ytd":
      from = new Date(now.getFullYear(), 0, 1);
      to = new Date();
      break;
    default:
      from = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
      to = new Date();
  }
  return {
    from: from.toISOString().split("T")[0],
    to: to.toISOString().split("T")[0]
  };
}

export default function SupplierPredictionPage() {
  const router = useRouter();
  
  // Basic states
  const [loading, setLoading] = useState(true);
  const [selectedSupplier, setSelectedSupplier] = useState("China");
  const [quickPeriod, setQuickPeriod] = useState("6-months");
  
  // Params
  const [leadTime, setLeadTime] = useState<number>(12); // Default to 12 months for China
  const [safetyBuffer, setSafetyBuffer] = useState<number>(2); // 2 months safety buffer
  const [growthRate, setGrowthRate] = useState<number>(0); // 0% growth
  const [safetyStockSource, setSafetyStockSource] = useState<"minStock" | "buffer">("buffer");
  
  // Data states
  const [products, setProducts] = useState<any[]>([]);
  const [suppliersList, setSuppliersList] = useState<any[]>([]);
  const [activeProduct, setActiveProduct] = useState<any | null>(null);
  
  // UI states
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [orderFilter, setOrderFilter] = useState("ALL"); // ALL, NEEDS_ORDER, SUFFICIENT
  const [currentPage, setCurrentPage] = useState(1);
  const [overwrites, setOverwrites] = useState<Record<string, number>>({});
  
  const PER_PAGE = 10;

  // Retrieve date range
  const { from, to } = useMemo(() => getQuickRange(quickPeriod), [quickPeriod]);

  // Load Data
  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/reports/suppliers/prediction?supplier=${encodeURIComponent(
          selectedSupplier
        )}&from=${from}&to=${to}`
      );
      if (!res.ok) throw new Error("Failed to fetch prediction analytics");
      const data = await res.json();
      setProducts(data.products || []);
      setSuppliersList(data.suppliersList || []);
      
      // Auto adjust default lead time: If they pick China, it should default to 12 months.
      if (selectedSupplier === "China") {
        setLeadTime(12);
      } else {
        setLeadTime(3); // Default other local suppliers to 3 months
      }
      
      // Clear overwrites when supplier changes
      setOverwrites({});
    } catch (err: any) {
      toast.error("Failed to load prediction report: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedSupplier, from, to]);

  // Handle overwrite changes
  const handleOverwrite = (pid: string, val: string) => {
    const num = val === "" ? NaN : parseInt(val);
    setOverwrites((prev) => {
      const copy = { ...prev };
      if (isNaN(num) || num < 0) {
        delete copy[pid];
      } else {
        copy[pid] = num;
      }
      return copy;
    });
  };

  // Perform client-side calculations for all products
  const computedProducts = useMemo(() => {
    return products.map((p) => {
      const predictedMonthly = p.monthlyAverage * (1 + growthRate / 100);
      const predictedLeadTimeSales = predictedMonthly * leadTime;
      const safetyStock =
        safetyStockSource === "minStock"
          ? p.minStockLevel
          : predictedMonthly * safetyBuffer;
      
      const rawRecommended = predictedLeadTimeSales + safetyStock - p.stockQty - p.pendingOrderQty;
      const recommendedQty = Math.max(0, Math.ceil(rawRecommended));
      
      const userQty = overwrites[p.id] !== undefined ? overwrites[p.id] : recommendedQty;
      const estimatedCost = userQty * p.costPrice;

      return {
        ...p,
        predictedMonthly,
        predictedLeadTimeSales,
        safetyStock,
        recommendedQty,
        finalQty: userQty,
        isOverwritten: overwrites[p.id] !== undefined,
        estimatedCost,
      };
    });
  }, [products, leadTime, safetyBuffer, growthRate, safetyStockSource, overwrites]);

  // Categories list
  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.category) set.add(p.category);
    });
    return ["ALL", ...Array.from(set).sort()];
  }, [products]);

  // Filter products
  const filteredProducts = useMemo(() => {
    const q = search.toLowerCase().trim();
    return computedProducts.filter((p) => {
      const matchesSearch =
        p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q);
      
      const matchesCategory = selectedCategory === "ALL" || p.category === selectedCategory;
      
      let matchesOrderFilter = true;
      if (orderFilter === "NEEDS_ORDER") {
        matchesOrderFilter = p.finalQty > 0;
      } else if (orderFilter === "SUFFICIENT") {
        matchesOrderFilter = p.finalQty === 0;
      }

      return matchesSearch && matchesCategory && matchesOrderFilter;
    });
  }, [computedProducts, search, selectedCategory, orderFilter]);

  // Reset pages on filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [search, selectedCategory, orderFilter]);

  // Paginated products
  const paginatedProducts = useMemo(() => {
    const start = (currentPage - 1) * PER_PAGE;
    return filteredProducts.slice(start, start + PER_PAGE);
  }, [filteredProducts, currentPage]);

  // Total summary metrics
  const summary = useMemo(() => {
    let totalProducts = computedProducts.length;
    let totalStockQty = 0;
    let totalIncomingQty = 0;
    let totalRecommendedQty = 0;
    let totalEstimatedCost = 0;

    computedProducts.forEach((p) => {
      totalStockQty += p.stockQty;
      totalIncomingQty += p.pendingOrderQty;
      totalRecommendedQty += p.finalQty;
      totalEstimatedCost += p.estimatedCost;
    });

    return {
      totalProducts,
      totalStockQty,
      totalIncomingQty,
      totalRecommendedQty,
      totalEstimatedCost,
    };
  }, [computedProducts]);

  // Export CSV
  const handleExportCSV = () => {
    const headers = [
      "Product Name",
      "SKU",
      "Category",
      "Cost Price (LKR)",
      "Current Stock",
      "Pending Ordered Stock",
      "Avg Monthly Sales",
      `Predicted Sales (${leadTime}m)`,
      "Safety Stock Level",
      "Recommended Order",
      "Final Order Quantity",
      "Is Overwritten",
      "Estimated Cost (LKR)",
    ];

    const rows = computedProducts.map((p) => [
      `"${p.name.replace(/"/g, '""')}"`,
      p.sku,
      p.category,
      p.costPrice,
      p.stockQty,
      p.pendingOrderQty,
      p.monthlyAverage.toFixed(2),
      p.predictedLeadTimeSales.toFixed(2),
      p.safetyStock.toFixed(2),
      p.recommendedQty,
      p.finalQty,
      p.isOverwritten ? "Yes" : "No",
      p.estimatedCost.toFixed(2),
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8,\uFEFF" +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `Order_Prediction_${selectedSupplier}_${new Date().toISOString().split("T")[0]}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("CSV export download started!");
  };

  const handlePrintPDF = async () => {
    try {
      const { default: jsPDF } = await import("jspdf");
      const { default: autoTable } = await import("jspdf-autotable");

      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      const pageWidth = doc.internal.pageSize.width;
      const pageHeight = doc.internal.pageSize.height;
      const marginLeft = 14;
      const marginRight = pageWidth - 14;

      const drawPageHeader = () => {
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(16);
        doc.setFont("helvetica", "bold");
        doc.text("CHAMPIKA HARDWARE", pageWidth / 2, 14, { align: "center" });

        doc.setTextColor(60, 60, 60);
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.text("Pranawatta Road, Wallabada, Boossa  |  Tel: 0777681663", pageWidth / 2, 19, { align: "center" });

        doc.setDrawColor(0, 0, 0);
        doc.setLineWidth(0.5);
        doc.line(marginLeft, 23, marginRight, 23);

        doc.setTextColor(0, 0, 0);
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.text(`SUPPLIER ORDER PREDICTION REPORT — ${selectedSupplier.toUpperCase()}`, pageWidth / 2, 29, { align: "center" });

        const today = new Date().toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        });
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(80, 80, 80);
        
        doc.text(`Date: ${today}`, marginLeft, 35);
        doc.text(`Lead Time: ${leadTime} Months  |  Safety Buffer: ${safetyBuffer} Months  |  Growth: ${growthRate}%  |  Stock Source: ${safetyStockSource === 'minStock' ? 'DB Min Stock' : 'Buffer Run Rate'}`, marginLeft, 39);
        
        doc.text(`Total Products: ${computedProducts.length}`, marginRight, 35, { align: "right" });
        const totalCostStr = summary.totalEstimatedCost.toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        doc.text(`Projected Cost: LKR ${totalCostStr}`, marginRight, 39, { align: "right" });

        doc.setDrawColor(180, 180, 180);
        doc.setLineWidth(0.3);
        doc.line(marginLeft, 42, marginRight, 42);
      };

      const drawPageFooter = (pageNum: number, totalPages: number) => {
        doc.setFontSize(7);
        doc.setFont("helvetica", "italic");
        doc.setTextColor(130, 130, 130);
        doc.text(`Page ${pageNum} of ${totalPages}`, pageWidth / 2, pageHeight - 8, { align: "center" });
        doc.text("Champika Hardware — Confidential", marginLeft, pageHeight - 8);
      };

      drawPageHeader();

      const tableRows = filteredProducts.map((p, idx) => [
        idx + 1,
        p.sku || "-",
        p.name,
        p.category || "-",
        p.costPrice.toLocaleString("en-LK", { minimumFractionDigits: 2 }),
        p.stockQty,
        p.pendingOrderQty > 0 ? p.pendingOrderQty : "-",
        p.monthlyAverage.toFixed(1),
        Math.round(p.predictedLeadTimeSales),
        p.finalQty > 0 ? `${p.finalQty} ${p.isOverwritten ? '(Adj)' : ''}` : "-",
        p.finalQty > 0 ? p.estimatedCost.toLocaleString("en-LK", { minimumFractionDigits: 2 }) : "-"
      ]);

      let totalQty = 0;
      let totalCost = 0;
      filteredProducts.forEach(p => {
        totalQty += p.finalQty;
        totalCost += p.estimatedCost;
      });

      const totalCostStr = totalCost.toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

      autoTable(doc, {
        head: [["#", "SKU", "Item Name", "Category", "Unit Cost", "Stock", "Pending", "Run Rate/mo", `Predicted (${leadTime}m)`, "Order Qty", "Est. Cost (LKR)"]],
        body: tableRows,
        foot: [["", "", "Total Summary (Filtered)", "", "", "", "", "", "", totalQty, totalCostStr]],
        startY: 46,
        theme: "striped",
        margin: { top: 46, left: marginLeft, right: marginLeft },
        headStyles: {
          fillColor: [30, 41, 59],
          textColor: [255, 255, 255],
          fontStyle: "bold",
          fontSize: 8,
          halign: "center",
          valign: "middle"
        },
        bodyStyles: {
          textColor: [30, 30, 30],
          fontSize: 8,
          valign: "middle"
        },
        footStyles: {
          fillColor: [241, 245, 249],
          textColor: [15, 23, 42],
          fontStyle: "bold",
          fontSize: 8,
          valign: "middle"
        },
        columnStyles: {
          0: { cellWidth: 10, halign: "center" },
          1: { cellWidth: 25 },
          2: { cellWidth: "auto" },
          3: { cellWidth: 32 },
          4: { cellWidth: 22, halign: "right" },
          5: { cellWidth: 16, halign: "right" },
          6: { cellWidth: 16, halign: "right" },
          7: { cellWidth: 22, halign: "right" },
          8: { cellWidth: 22, halign: "right" },
          9: { cellWidth: 24, halign: "right", fontStyle: "bold" },
          10: { cellWidth: 30, halign: "right", fontStyle: "bold" }
        },
        didDrawPage: () => {
          drawPageHeader();
        }
      });

      const totalPages = doc.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        drawPageFooter(i, totalPages);
      }

      doc.save(`Order_Prediction_${selectedSupplier}_${new Date().toISOString().slice(0, 10)}.pdf`);
      toast.success("PDF report downloaded successfully!");
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to generate PDF: " + err.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Breadcrumbs and Page Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Link
              href="/dashboard/admin/reports/suppliers"
              className="flex items-center gap-1 hover:text-primary transition-colors"
            >
              <ArrowLeft className="h-3 w-3" /> Supplier Analytics
            </Link>
            <span>/</span>
            <span className="text-foreground">Prediction Report</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-gray-900">
            Supplier Order Prediction
          </h1>
          <p className="text-sm text-muted-foreground">
            Forecast sales demand and calculate recommended orders to account for long shipping lead times.
          </p>
        </div>

        {/* Global Action Controls */}
        <div className="flex items-center gap-2">
          <Button
            onClick={fetchData}
            variant="outline"
            size="sm"
            className="h-9 border-gray-200"
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button
            onClick={handlePrintPDF}
            variant="outline"
            size="sm"
            className="h-9 border-gray-200"
            disabled={loading || products.length === 0}
          >
            <Printer className="h-4 w-4 mr-2 text-rose-500" />
            Download PDF
          </Button>
          <Button
            onClick={handleExportCSV}
            variant="default"
            size="sm"
            className="h-9 bg-primary hover:bg-primary/95 text-white"
            disabled={loading || products.length === 0}
          >
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Configuration Sliders / Settings Panel */}
      <Card className="bg-white border border-gray-100 shadow-sm overflow-hidden">
        <CardHeader className="bg-gray-50/50 border-b border-gray-100 py-3 px-6">
          <CardTitle className="text-sm font-semibold flex items-center gap-2 text-gray-700">
            <Sliders className="h-4 w-4 text-primary" /> Forecast Parameters & Constraints
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            
            {/* Supplier Selector */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block">
                Target Supplier
              </label>
              <Select value={selectedSupplier} onValueChange={setSelectedSupplier}>
                <SelectTrigger className="w-full bg-white border border-gray-200 focus:ring-primary focus:ring-offset-0">
                  <Factory className="mr-2 h-4 w-4 text-muted-foreground shrink-0" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {suppliersList.map((sup) => (
                    <SelectItem key={sup.id} value={sup.name}>
                      {sup.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedSupplier === "China" && (
                <div className="flex items-center gap-1.5 text-[10px] text-amber-600 bg-amber-50 p-2 rounded border border-amber-100 mt-1">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  <span>Lead time locked to 1 year (12 months) by default.</span>
                </div>
              )}
            </div>

            {/* Historical Analysis window */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block">
                Sales Analysis Period
              </label>
              <Select value={quickPeriod} onValueChange={setQuickPeriod}>
                <SelectTrigger className="w-full bg-white border border-gray-200">
                  <Calendar className="mr-2 h-4 w-4 text-muted-foreground shrink-0" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="3-months">Last 3 Months (Run Rate)</SelectItem>
                  <SelectItem value="6-months">Last 6 Months (YTD Trend)</SelectItem>
                  <SelectItem value="ytd">Full Current Year (YTD)</SelectItem>
                </SelectContent>
              </Select>
              <span className="text-[10px] text-muted-foreground block mt-1">
                Averages calculated based on actual calendar months in range.
              </span>
            </div>

            {/* Safety Stock Config */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block">
                Safety Stock Level Source
              </label>
              <Select
                value={safetyStockSource}
                onValueChange={(val: any) => setSafetyStockSource(val)}
              >
                <SelectTrigger className="w-full bg-white border border-gray-200">
                  <Package className="mr-2 h-4 w-4 text-muted-foreground shrink-0" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="buffer">Run Rate Buffer Months</SelectItem>
                  <SelectItem value="minStock">Database Minimum Stock Level</SelectItem>
                </SelectContent>
              </Select>
              <span className="text-[10px] text-muted-foreground block mt-1">
                Determines how the safety buffer volume is computed.
              </span>
            </div>

            {/* Growth Rate / Growth Multiplier */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block flex items-center justify-between">
                <span>Expected Sales Growth</span>
                <span className="text-primary font-bold text-xs">{growthRate}%</span>
              </label>
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="range"
                  min="-50"
                  max="100"
                  step="5"
                  value={growthRate}
                  onChange={(e) => setGrowthRate(parseInt(e.target.value))}
                  className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary"
                />
              </div>
              <span className="text-[10px] text-muted-foreground block mt-1">
                Applies a growth factor multiplier to the demand forecast.
              </span>
            </div>

          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6 pt-6 border-t border-gray-100">
            {/* Shipping / Ordering Lead Time slider */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs font-semibold text-gray-500 uppercase tracking-wider">
                <span>Shipping Lead Time (Months)</span>
                <span className="text-primary font-bold text-sm bg-primary/5 px-2 py-0.5 rounded">
                  {leadTime} Months
                </span>
              </div>
              <input
                type="range"
                min="1"
                max="24"
                value={leadTime}
                onChange={(e) => setLeadTime(parseInt(e.target.value))}
                className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary"
              />
              <p className="text-[10px] text-muted-foreground">
                Time elapsed between placing order and products arriving in warehouses.
              </p>
            </div>

            {/* Safety buffer multiplier slider */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs font-semibold text-gray-500 uppercase tracking-wider">
                <span>Safety Buffer Stock (Months)</span>
                <span className="text-primary font-bold text-sm bg-primary/5 px-2 py-0.5 rounded">
                  {safetyBuffer} Months
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="6"
                step="0.5"
                value={safetyBuffer}
                disabled={safetyStockSource === "minStock"}
                className={`w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary ${
                  safetyStockSource === "minStock" ? "opacity-40 cursor-not-allowed" : ""
                }`}
                onChange={(e) => setSafetyBuffer(parseFloat(e.target.value))}
              />
              <p className="text-[10px] text-muted-foreground">
                Additional months of inventory to preserve as a cushion (safety buffer).
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        <Card className="bg-white border border-gray-100 shadow-sm">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Products Analysed
              </p>
              <h3 className="text-2xl font-extrabold text-gray-900 mt-1">{summary.totalProducts}</h3>
              <p className="text-[10px] text-muted-foreground mt-0.5">belonging to supplier</p>
            </div>
            <div className="h-10 w-10 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center">
              <Factory className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border border-gray-100 shadow-sm">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Warehouse Stock
              </p>
              <h3 className="text-2xl font-extrabold text-gray-900 mt-1">{fmt(summary.totalStockQty)}</h3>
              <p className="text-[10px] text-muted-foreground mt-0.5">units in inventory</p>
            </div>
            <div className="h-10 w-10 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center">
              <Package className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border border-gray-100 shadow-sm">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Incoming Transit Stock
              </p>
              <h3 className="text-2xl font-extrabold text-gray-900 mt-1">{fmt(summary.totalIncomingQty)}</h3>
              <p className="text-[10px] text-muted-foreground mt-0.5">units in pending orders</p>
            </div>
            <div className="h-10 w-10 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center">
              <TrendingUp className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-2 border-primary/20 shadow-md">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-primary uppercase tracking-wider">
                Projected Order Cost
              </p>
              <h3 className="text-xl font-black text-gray-900 mt-1">{fmtCurr(summary.totalEstimatedCost)}</h3>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                for {fmt(summary.totalRecommendedQty)} units recommended
              </p>
            </div>
            <div className="h-10 w-10 bg-primary/10 text-primary rounded-full flex items-center justify-center">
              <DollarSign className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

      </div>

      {/* Main Analysis and Forecast Table */}
      <Card className="bg-white border border-gray-100 shadow-sm">
        <CardHeader className="py-4 px-6 border-b border-gray-100 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <CardTitle className="text-base font-bold text-gray-800">
              Demand Forecast and Purchase Plan
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Calculates purchase quantities based on the formula: (Monthly Run Rate * Lead Time) + Safety Stock - Current Stock - Pending Orders.
            </p>
          </div>
          
          {/* Table Filters */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Search Input */}
            <div className="relative w-full sm:w-56">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search name or SKU..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-9 text-xs border-gray-200"
              />
            </div>
            {/* Category Filter */}
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-full sm:w-40 h-9 text-xs border-gray-200 bg-white">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat} value={cat} className="text-xs">
                    {cat === "ALL" ? "All Categories" : cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {/* Order Requirement Filter */}
            <Select value={orderFilter} onValueChange={setOrderFilter}>
              <SelectTrigger className="w-full sm:w-40 h-9 text-xs border-gray-200 bg-white">
                <SelectValue placeholder="Ordering Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL" className="text-xs">All Products</SelectItem>
                <SelectItem value="NEEDS_ORDER" className="text-xs">Needs Order</SelectItem>
                <SelectItem value="SUFFICIENT" className="text-xs">Stock Sufficient</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-gray-50/50">
                <TableRow>
                  <TableHead className="w-[200px] text-xs font-semibold">Product</TableHead>
                  <TableHead className="text-right text-xs font-semibold">Current Stock</TableHead>
                  <TableHead className="text-right text-xs font-semibold">Pending Ordered</TableHead>
                  <TableHead className="text-right text-xs font-semibold">Avg Sales/mo</TableHead>
                  <TableHead className="text-center text-xs font-semibold w-[100px]">Historical (Spark)</TableHead>
                  <TableHead className="text-right text-xs font-semibold">Safety Buffer</TableHead>
                  <TableHead className="text-right text-xs font-semibold">Predicted Demand</TableHead>
                  <TableHead className="text-right text-xs font-semibold">Recommended Qty</TableHead>
                  <TableHead className="w-[110px] text-right text-xs font-semibold">Order Qty (Edit)</TableHead>
                  <TableHead className="text-right text-xs font-semibold">Est. Cost</TableHead>
                  <TableHead className="w-8"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center py-20 text-muted-foreground">
                      <RefreshCw className="h-6 w-6 animate-spin mx-auto text-primary mb-2" />
                      Loading forecast data...
                    </TableCell>
                  </TableRow>
                ) : paginatedProducts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center py-20 text-muted-foreground text-sm">
                      No products found matching filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedProducts.map((p) => {
                    return (
                      <TableRow
                        key={p.id}
                        className="hover:bg-gray-50/30 transition-colors align-middle cursor-pointer"
                        onClick={() => setActiveProduct(p)}
                      >
                        {/* Name and SKU */}
                        <TableCell onClick={(e) => e.stopPropagation()} className="py-3">
                          <button
                            onClick={() => setActiveProduct(p)}
                            className="text-left font-medium text-xs text-gray-900 hover:text-primary hover:underline font-semibold leading-snug truncate block max-w-[200px]"
                          >
                            {p.name}
                          </button>
                          <span className="text-[10px] text-muted-foreground block mt-0.5">
                            SKU: {p.sku || "—"} · Cost: {fmt(p.costPrice)}
                          </span>
                        </TableCell>

                        {/* Current Stock */}
                        <TableCell className="text-right text-xs py-3">
                          <span className={`font-medium ${p.stockQty < 0 ? "text-red-600 font-semibold" : "text-gray-700"}`}>
                            {fmt(p.stockQty)}
                          </span>
                        </TableCell>

                        {/* Pending Stock */}
                        <TableCell className="text-right text-xs text-indigo-600 font-medium py-3">
                          {p.pendingOrderQty > 0 ? fmt(p.pendingOrderQty) : "—"}
                        </TableCell>

                        {/* Avg Sales/Mo */}
                        <TableCell className="text-right text-xs font-semibold text-gray-900 py-3">
                          {p.monthlyAverage.toFixed(1)}
                        </TableCell>

                        {/* Mini Sparkline Chart */}
                        <TableCell className="py-1 text-center" onClick={(e) => e.stopPropagation()}>
                          <div className="w-[90px] h-[30px] mx-auto opacity-75 hover:opacity-100 transition-opacity">
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart data={p.monthlyTrend}>
                                <Line
                                  type="monotone"
                                  dataKey="sales"
                                  stroke="#0088FE"
                                  strokeWidth={1.5}
                                  dot={false}
                                />
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
                        </TableCell>

                        {/* Safety Buffer */}
                        <TableCell className="text-right text-xs text-gray-500 py-3">
                          {Math.round(p.safetyStock)}
                        </TableCell>

                        {/* Predicted Demand */}
                        <TableCell className="text-right text-xs text-gray-700 py-3 font-medium">
                          {Math.round(p.predictedLeadTimeSales)}
                        </TableCell>

                        {/* Recommended Quantity */}
                        <TableCell className="text-right text-xs py-3">
                          {p.recommendedQty > 0 ? (
                            <Badge variant="destructive" className="bg-red-50 text-red-700 border-red-200 font-bold">
                              Order {fmt(p.recommendedQty)}
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="bg-gray-100 text-gray-600 border-transparent font-normal">
                              Sufficient
                            </Badge>
                          )}
                        </TableCell>

                        {/* Order Quantity input overwrite */}
                        <TableCell className="text-right py-2" onClick={(e) => e.stopPropagation()}>
                          <Input
                            type="number"
                            value={overwrites[p.id] !== undefined ? overwrites[p.id] : p.recommendedQty}
                            onChange={(e) => handleOverwrite(p.id, e.target.value)}
                            min="0"
                            className={`h-8 w-20 text-xs text-right border-gray-200 bg-white ${
                              p.isOverwritten ? "border-primary text-primary font-bold focus-visible:ring-primary" : "text-gray-700"
                            }`}
                          />
                        </TableCell>

                        {/* Estimated Cost */}
                        <TableCell className="text-right text-xs font-bold text-gray-900 py-3">
                          {p.finalQty > 0 ? fmt(p.estimatedCost) : "—"}
                        </TableCell>

                        {/* Action details */}
                        <TableCell className="text-right py-3">
                          <ChevronRight className="h-4 w-4 text-gray-400 group-hover:text-primary transition-colors" />
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
          
          {/* Pagination */}
          {!loading && filteredProducts.length > 0 && (
            <TablePagination
              currentPage={currentPage}
              totalPages={Math.ceil(filteredProducts.length / PER_PAGE)}
              onPageChange={setCurrentPage}
              totalItems={filteredProducts.length}
              itemsPerPage={PER_PAGE}
            />
          )}
        </CardContent>
      </Card>

      {/* Slide-out Product Analysis Details Sheet */}
      <Sheet open={!!activeProduct} onOpenChange={(open) => !open && setActiveProduct(null)}>
        <SheetContent className="w-[450px] sm:w-[500px] overflow-y-auto border-l shadow-2xl p-6 bg-white">
          {activeProduct && (
            <div className="space-y-6">
              
              {/* Sheet Header */}
              <SheetHeader className="space-y-1">
                <Badge className="bg-blue-50 text-blue-700 border-blue-100 w-max text-[10px]">
                  {activeProduct.category}
                </Badge>
                <SheetTitle className="text-lg font-bold text-gray-900 leading-snug">
                  {activeProduct.name}
                </SheetTitle>
                <p className="text-xs text-muted-foreground">SKU: {activeProduct.sku || "—"}</p>
              </SheetHeader>

              {/* Product Info Cards */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                  <span className="text-[10px] text-gray-500 font-semibold block uppercase">Cost Price</span>
                  <span className="text-sm font-bold text-gray-800">{fmtCurr(activeProduct.costPrice)}</span>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                  <span className="text-[10px] text-gray-500 font-semibold block uppercase">Selling Price</span>
                  <span className="text-sm font-bold text-gray-800">{fmtCurr(activeProduct.sellingPrice)}</span>
                </div>
              </div>

              {/* Trend Chart */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                  <TrendingUp className="h-4 w-4 text-primary" /> Monthly Sales Trend
                </h4>
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={activeProduct.monthlyTrend}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                      <XAxis dataKey="monthLabel" tick={{ fontSize: 9 }} tickLine={false} />
                      <YAxis tick={{ fontSize: 9 }} tickLine={false} width={20} />
                      <ChartTooltip formatter={(value: any) => [`${value} units`, "Units Sold"]} />
                      <Bar dataKey="sales" fill="#0088FE" radius={[4, 4, 0, 0]} maxBarSize={30} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Detailed Prediction Formula Variables breakdown */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Info className="h-4 w-4 text-primary" /> Recommendation Breakdown
                </h4>
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-100 divide-y divide-gray-200 text-xs">
                  
                  <div className="py-2 flex justify-between">
                    <span className="text-gray-500">Historical Sales (Total)</span>
                    <span className="font-semibold text-gray-800">{fmt(activeProduct.totalUnitsSold)} units</span>
                  </div>

                  <div className="py-2 flex justify-between">
                    <span className="text-gray-500">Monthly Run Rate</span>
                    <span className="font-semibold text-gray-800">{activeProduct.monthlyAverage.toFixed(1)} units/mo</span>
                  </div>

                  <div className="py-2 flex justify-between">
                    <span className="text-gray-500 flex items-center gap-1">
                      Growth Factor Adjusted <Percent className="h-3 w-3 text-muted-foreground inline" />
                    </span>
                    <span className="font-semibold text-gray-800">
                      {activeProduct.predictedMonthly.toFixed(1)} units/mo (+{growthRate}%)
                    </span>
                  </div>

                  <div className="py-2 flex justify-between">
                    <span className="text-gray-500">Lead Time Demand ({leadTime} months)</span>
                    <span className="font-semibold text-gray-800">{Math.round(activeProduct.predictedLeadTimeSales)} units</span>
                  </div>

                  <div className="py-2 flex justify-between">
                    <span className="text-gray-500">
                      Safety Stock Cushion ({safetyStockSource === "minStock" ? "DB Min Level" : `${safetyBuffer} months`})
                    </span>
                    <span className="font-semibold text-gray-800">{Math.round(activeProduct.safetyStock)} units</span>
                  </div>

                  <div className="py-2 flex justify-between">
                    <span className="text-gray-500">Current Stock</span>
                    <span className="font-semibold text-gray-800">{fmt(activeProduct.stockQty)} units</span>
                  </div>

                  <div className="py-2 flex justify-between">
                    <span className="text-gray-500">Pending Incoming Stock</span>
                    <span className="font-semibold text-gray-800">{fmt(activeProduct.pendingOrderQty)} units</span>
                  </div>

                  <div className="py-3 flex justify-between text-sm font-bold border-t-2 border-dashed border-gray-200">
                    <span className="text-primary uppercase tracking-wider">Calculated Recommended</span>
                    <span className="text-primary font-black">{fmt(activeProduct.recommendedQty)} units</span>
                  </div>

                  <div className="py-3 flex justify-between text-sm font-bold">
                    <span className="text-gray-900 uppercase tracking-wider">Estimated Order Cost</span>
                    <span className="text-gray-900 font-black">
                      {fmtCurr(activeProduct.finalQty * activeProduct.costPrice)}
                    </span>
                  </div>
                  
                </div>
              </div>

              {/* Adjust Quantity Input inside Panel */}
              <div className="bg-primary/5 border border-primary/20 p-4 rounded-lg space-y-2">
                <span className="text-xs font-bold text-primary uppercase block tracking-wider">
                  Adjust Final Ordering Qty
                </span>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    value={overwrites[activeProduct.id] !== undefined ? overwrites[activeProduct.id] : activeProduct.recommendedQty}
                    onChange={(e) => handleOverwrite(activeProduct.id, e.target.value)}
                    min="0"
                    className="h-10 text-sm bg-white border-primary/30 text-primary font-bold w-32"
                  />
                  <Button
                    onClick={() => {
                      const updated = { ...overwrites };
                      delete updated[activeProduct.id];
                      setOverwrites(updated);
                    }}
                    variant="outline"
                    className="h-10 text-xs border-gray-200 hover:bg-gray-100 flex-1"
                    disabled={overwrites[activeProduct.id] === undefined}
                  >
                    Reset to System Recommended
                  </Button>
                </div>
                {overwrites[activeProduct.id] !== undefined && (
                  <p className="text-[10px] text-primary italic">
                    Final order quantity has been custom adjusted from calculations.
                  </p>
                )}
              </div>

            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
