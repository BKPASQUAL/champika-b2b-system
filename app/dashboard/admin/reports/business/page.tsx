"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import {
  LayoutDashboard,
  DollarSign,
  TrendingUp,
  AlertCircle,
  Calendar,
  Loader2,
  Building2,
  ChevronRight,
  ChevronDown,
  RefreshCw,
  Menu,
  Users,
  Package,
  Receipt,
  Search,
  Eye,
  ExternalLink,
  Banknote,
  CheckCircle2,
  CalendarDays,
} from "lucide-react";
import { toast } from "sonner";
import { BUSINESS_THEMES, BUSINESS_IDS } from "@/app/config/business-constants";

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884D8"];

const fmt = (n: number) =>
  n.toLocaleString("en-LK", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

function MarginBadge({ margin }: { margin: number | null | undefined }) {
  const m = Number(margin) || 0;
  const cls =
    m >= 20 ? "bg-green-100 text-green-800"
    : m >= 10 ? "bg-yellow-100 text-yellow-800"
    : m >= 0 ? "bg-orange-100 text-orange-800"
    : "bg-red-100 text-red-800";
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${cls}`}>
      {m.toFixed(1)}%
    </span>
  );
}

function CollectionBadge({ rate }: { rate: number | null | undefined }) {
  const r = Math.min(100, Math.max(0, Number(rate) || 0));
  const cls =
    r >= 80 ? "bg-emerald-100 text-emerald-800 border-emerald-200"
    : r >= 50 ? "bg-blue-100 text-blue-800 border-blue-200"
    : r >= 25 ? "bg-amber-100 text-amber-800 border-amber-200"
    : "bg-rose-100 text-rose-800 border-rose-200";
  const barColor =
    r >= 80 ? "bg-emerald-500"
    : r >= 50 ? "bg-blue-500"
    : r >= 25 ? "bg-amber-500"
    : "bg-rose-500";

  return (
    <div className="flex items-center justify-end gap-1.5">
      <div className="w-12 bg-gray-200 rounded-full h-1.5 overflow-hidden">
        <div className={`h-full ${barColor}`} style={{ width: `${r}%` }} />
      </div>
      <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold border ${cls}`}>
        {r.toFixed(1)}%
      </span>
    </div>
  );
}

import {
  ReportDateFilter,
  ReportDateFilterValue,
  calculateRange,
} from "../_components/ReportDateFilter";

function getBizBg(bizId: string): string {
  const theme = BUSINESS_THEMES[bizId as keyof typeof BUSINESS_THEMES];
  return theme?.bgClass || "bg-gray-100";
}
function getBizColor(bizId: string): string {
  const theme = BUSINESS_THEMES[bizId as keyof typeof BUSINESS_THEMES];
  return theme?.textClass || "text-gray-600";
}

const STATUS_COLORS: Record<string, string> = {
  Paid: "bg-green-100 text-green-700",
  Partial: "bg-yellow-100 text-yellow-700",
  Unpaid: "bg-red-100 text-red-700",
  Overdue: "bg-red-200 text-red-800",
};

export default function BusinessAnalyticsPage() {
  const router = useRouter();
  const [dateFilter, setDateFilter] = useState<ReportDateFilterValue>(() => {
    const range = calculateRange("this-month");
    return {
      from: range.from,
      to: range.to,
      quickSelect: "this-month",
      label: range.label,
    };
  });
  const [loading, setLoading] = useState(true);
  const [overall, setOverall] = useState<any>(null);
  const [businesses, setBusinesses] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState<string>("overall");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [detailTab, setDetailTab] = useState<"invoices" | "customers" | "products" | "reps" | "months">("invoices");
  const [detailSearch, setDetailSearch] = useState("");
  const [selectedMonthRep, setSelectedMonthRep] = useState<string>("all");
  const [expandedMonth, setExpandedMonth] = useState<string | null>(null);

  const fetchData = async (from = dateFilter.from, to = dateFilter.to) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/reports/business?from=${from}&to=${to}`);
      if (!res.ok) throw new Error("Failed to fetch business analytics");
      const data = await res.json();
      setOverall(data.overall);
      setBusinesses(data.businesses || []);
    } catch {
      toast.error("Failed to load business analytics");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(dateFilter.from, dateFilter.to);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFilter.from, dateFilter.to]);

  const current = useMemo(() => {
    if (selectedId === "overall") return overall;
    return businesses.find((b) => b.id === selectedId) || null;
  }, [selectedId, overall, businesses]);

  const revenueChartData = useMemo(
    () => businesses.map((b) => ({
      name: b.name.replace("Champika Hardware - ", "CH ").replace(" Agency", ""),
      revenue: b.totalRevenue,
      profit: b.totalGrossProfit !== undefined ? b.totalGrossProfit : b.totalProfit,
      due: b.dueAmount,
    })),
    [businesses]
  );

  // Filtered detail lists
  const filteredInvoices = useMemo(() => {
    const list: any[] = current?.invoices || [];
    if (!detailSearch) return list;
    const q = detailSearch.toLowerCase();
    return list.filter(
      (i) =>
        i.invoiceNo?.toLowerCase().includes(q) ||
        i.customer?.toLowerCase().includes(q) ||
        i.date?.includes(q)
    );
  }, [current, detailSearch]);

  const filteredCustomers = useMemo(() => {
    const list: any[] = current?.customers || [];
    if (!detailSearch) return list;
    const q = detailSearch.toLowerCase();
    return list.filter((c) => c.name?.toLowerCase().includes(q));
  }, [current, detailSearch]);

  const filteredProducts = useMemo(() => {
    const list: any[] = current?.products || [];
    if (!detailSearch) return list;
    const q = detailSearch.toLowerCase();
    return list.filter(
      (p) => p.name?.toLowerCase().includes(q) || p.sku?.toLowerCase().includes(q)
    );
  }, [current, detailSearch]);

  const filteredReps = useMemo(() => {
    const list: any[] = current?.reps || [];
    if (!detailSearch) return list;
    const q = detailSearch.toLowerCase();
    return list.filter((r) => {
      const name = r.name?.toLowerCase() || "";
      const displayRepName = name === "champika hardware" ? "champika hardware direct" : name;
      return displayRepName.includes(q);
    });
  }, [current, detailSearch]);

  // Totals for detail tabs
  const invTotals = useMemo(() => {
    const grossProfit = filteredInvoices.reduce((s, i) => s + ((i.profit && i.profit > 0) ? i.profit : 0), 0);
    const totalLoss = filteredInvoices.reduce((s, i) => s + ((i.profit && i.profit < 0) ? Math.abs(i.profit) : 0), 0);
    const profit = filteredInvoices.reduce((s, i) => s + (i.profit || 0), 0);
    return {
      amount: filteredInvoices.reduce((s, i) => s + i.amount, 0),
      due: filteredInvoices.reduce((s, i) => s + i.due, 0),
      grossProfit,
      totalLoss,
      profit,
      freeQty: filteredInvoices.reduce((s, i) => s + (i.freeQty || 0), 0),
      freeCost: filteredInvoices.reduce((s, i) => s + (i.freeCost || 0), 0),
      netProfit: filteredInvoices.reduce((s, i) => s + (i.netProfit || 0), 0),
      pendingClaimCost: filteredInvoices.reduce((s, i) => s + (i.pendingClaimCost || 0), 0),
    };
  }, [filteredInvoices]);

  const custTotals = useMemo(() => {
    const revenue = filteredCustomers.reduce((s, c) => s + c.revenue, 0);
    const cost = filteredCustomers.reduce((s, c) => s + c.cost, 0);
    const profit = filteredCustomers.reduce((s, c) => s + c.profit, 0);
    const dueAmount = filteredCustomers.reduce((s, c) => s + c.dueAmount, 0);
    const collected = filteredCustomers.reduce((s, c) => s + (c.collected !== undefined ? c.collected : Math.max(0, c.revenue - c.dueAmount)), 0);
    const invoiceCount = filteredCustomers.reduce((s, c) => s + c.invoiceCount, 0);
    return {
      revenue,
      cost,
      profit,
      dueAmount,
      collected,
      collectionRate: revenue > 0 ? (collected / revenue) * 100 : 0,
      invoiceCount,
    };
  }, [filteredCustomers]);

  const prodTotals = useMemo(() => ({
    unitsSold: filteredProducts.reduce((s, p) => s + p.unitsSold, 0),
    revenue: filteredProducts.reduce((s, p) => s + p.revenue, 0),
    cost: filteredProducts.reduce((s, p) => s + p.cost, 0),
    profit: filteredProducts.reduce((s, p) => s + p.profit, 0),
  }), [filteredProducts]);

  const repTotals = useMemo(() => {
    const revenue = filteredReps.reduce((s, r) => s + r.revenue, 0);
    const cost = filteredReps.reduce((s, r) => s + r.cost, 0);
    const profit = filteredReps.reduce((s, r) => s + r.profit, 0);
    const dueAmount = filteredReps.reduce((s, r) => s + r.dueAmount, 0);
    const collected = filteredReps.reduce((s, r) => s + (r.collected !== undefined ? r.collected : Math.max(0, r.revenue - r.dueAmount)), 0);
    const invoiceCount = filteredReps.reduce((s, r) => s + r.invoiceCount, 0);
    return {
      revenue,
      cost,
      profit,
      dueAmount,
      collected,
      collectionRate: revenue > 0 ? (collected / revenue) * 100 : 0,
      invoiceCount,
    };
  }, [filteredReps]);

  const monthlyData = useMemo(() => {
    const monthsList: any[] = current?.months || [];
    if (selectedMonthRep === "all") {
      return monthsList;
    }
    return monthsList
      .map((m) => {
        const repData = (m.reps || []).find((r: any) => r.name === selectedMonthRep);
        const sales = repData?.sales || 0;
        const collected = repData?.collected || 0;
        const due = repData?.due || 0;
        const invoiceCount = repData?.invoiceCount || 0;
        const collectionRate = sales > 0 ? (collected / sales) * 100 : 0;
        return {
          ...m,
          salesAmount: sales,
          collectedAmount: collected,
          dueAmount: due,
          invoiceCount,
          collectionRate,
          reps: repData ? [repData] : [],
        };
      })
      .filter((m) => m.salesAmount > 0 || m.invoiceCount > 0);
  }, [current, selectedMonthRep]);

  const monthTotals = useMemo(() => {
    const sales = monthlyData.reduce((s, m) => s + m.salesAmount, 0);
    const collected = monthlyData.reduce((s, m) => s + m.collectedAmount, 0);
    const due = monthlyData.reduce((s, m) => s + m.dueAmount, 0);
    const invoiceCount = monthlyData.reduce((s, m) => s + m.invoiceCount, 0);
    const profit = monthlyData.reduce((s, m) => s + (m.profit || 0), 0);
    return {
      sales,
      collected,
      due,
      invoiceCount,
      profit,
      collectionRate: sales > 0 ? (collected / sales) * 100 : 0,
    };
  }, [monthlyData]);

  const repFilterOptions = useMemo(() => {
    const namesSet = new Set<string>();
    (current?.reps || []).forEach((r: any) => {
      if (r.name) namesSet.add(r.name);
    });
    (current?.months || []).forEach((m: any) => {
      (m.reps || []).forEach((r: any) => {
        if (r.name) namesSet.add(r.name);
      });
    });
    return Array.from(namesSet).sort();
  }, [current]);

  const monthlyChartData = useMemo(() => {
    return monthlyData.map((m) => ({
      name: m.monthLabel || m.month,
      sales: m.salesAmount,
      collected: m.collectedAmount,
      due: m.dueAmount,
      rate: m.collectionRate,
    }));
  }, [monthlyData]);

  const DateControls = () => (
    <ReportDateFilter
      value={dateFilter}
      onChange={setDateFilter}
      loading={loading}
    />
  );

  const BusinessList = () => (
    <ul className="py-1">
      <li>
        <button
          onClick={() => { setSelectedId("overall"); setSheetOpen(false); }}
          className={`w-full text-left px-4 py-3 flex items-center justify-between hover:bg-muted/50 transition-colors border-b ${
            selectedId === "overall" ? "bg-primary/5 border-l-2 border-l-primary" : ""
          }`}
        >
          <div className="min-w-0">
            <p className="text-xs font-semibold">Overall</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">All businesses combined</p>
          </div>
          {selectedId === "overall" && <ChevronRight className="h-3 w-3 text-primary shrink-0 ml-1" />}
        </button>
      </li>
      {businesses.map((biz) => (
        <li key={biz.id}>
          <button
            onClick={() => { setSelectedId(biz.id); setSheetOpen(false); }}
            className={`w-full text-left px-4 py-3 flex items-center justify-between hover:bg-muted/50 transition-colors border-b border-gray-50 ${
              selectedId === biz.id ? "bg-primary/5 border-l-2 border-l-primary" : ""
            }`}
          >
            <div className="min-w-0">
              <p className="text-xs font-medium truncate">{biz.name}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                LKR {fmt(biz.totalRevenue)} · {biz.invoiceCount} invoices
              </p>
            </div>
            {selectedId === biz.id && <ChevronRight className="h-3 w-3 text-primary shrink-0 ml-1" />}
          </button>
        </li>
      ))}
    </ul>
  );

  const isOverall = selectedId === "overall";

  return (
    <div className="flex flex-col lg:flex-row h-full gap-0 -m-4 md:-m-8">

      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-64 shrink-0 bg-white border-r flex-col h-full overflow-hidden">
        <div className="p-4 border-b space-y-2">
          <div className="flex items-center gap-2 mb-1">
            <Building2 className="h-5 w-5 text-primary" />
            <h2 className="font-semibold text-sm">Businesses</h2>
          </div>
          <DateControls />
        </div>
        <div className="flex-1 overflow-y-auto">
          <BusinessList />
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="lg:hidden bg-white border-b px-4 py-3 space-y-2.5 shrink-0">
        <div className="flex items-center gap-2">
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 px-2 shrink-0">
                <Menu className="h-4 w-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0 flex flex-col">
              <SheetHeader className="p-4 border-b">
                <SheetTitle className="flex items-center gap-2 text-sm">
                  <Building2 className="h-4 w-4 text-primary" />
                  Businesses
                </SheetTitle>
                <DateControls />
              </SheetHeader>
              <div className="flex-1 overflow-y-auto">
                <BusinessList />
              </div>
            </SheetContent>
          </Sheet>
          <Select value={selectedId} onValueChange={setSelectedId}>
            <SelectTrigger className="h-8 text-xs flex-1 min-w-0">
              <Building2 className="mr-1 h-3 w-3 shrink-0" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="overall" className="text-xs">Overall</SelectItem>
              {businesses.map((b) => (
                <SelectItem key={b.id} value={b.id} className="text-xs">{b.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <DateControls />
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 md:space-y-6">
        {!current ? (
          <div className="flex items-center justify-center h-64 text-muted-foreground">
            {loading ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : (
              <span className="text-sm">No data available</span>
            )}
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl md:text-2xl font-bold leading-tight flex items-center gap-2">
                  {!isOverall && (
                    <span className={`w-3 h-3 rounded-full inline-block ${getBizBg(current.id)}`} />
                  )}
                  {current.name}
                </h1>
                <p className="text-xs md:text-sm text-muted-foreground mt-1">
                  {current.invoiceCount} invoices · {current.customerCount} customers · {current.products?.length || 0} products
                </p>
              </div>
              {!isOverall && (
                <Badge variant="outline" className={`${getBizColor(current.id)} border-current`}>
                  {current.margin.toFixed(1)}% margin
                </Badge>
              )}
            </div>

            {/* KPI Cards — Restructured into Reconciliation and Receivables Rows */}
            <div className="space-y-4">
              {/* Row 1: Sales & Profits Reconciliation */}
              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Sales & Profits Reconciliation (Claims Lag)</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4">
                  {/* Total Sales */}
                  <Card className="bg-blue-50/50 border-blue-100">
                    <CardHeader className="pb-1 pt-3 px-3 md:px-4">
                      <CardTitle className="text-[10px] md:text-xs text-blue-700 font-medium flex items-center gap-1">
                        <DollarSign className="h-3 w-3" /> Total Sales
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="px-3 md:px-4 pb-3 md:pb-4">
                      <div className="text-sm md:text-xl font-bold text-blue-700">LKR {fmt(current.totalRevenue)}</div>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{fmt(current.totalUnits)} units sold</p>
                    </CardContent>
                  </Card>

                  {/* Gross Profit (Expected - Unreduced) */}
                  <Card className="bg-green-50 border-green-200">
                    <CardHeader className="pb-1 pt-3 px-3 md:px-4">
                      <CardTitle className="text-[10px] md:text-xs text-green-700 font-medium flex items-center gap-1">
                        <TrendingUp className="h-3 w-3" /> Expected Gross Profit
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="px-3 md:px-4 pb-3 md:pb-4">
                      <div className="text-sm md:text-xl font-bold text-green-700">
                        LKR {fmt(current.totalGrossProfit !== undefined ? current.totalGrossProfit : current.totalProfit)}
                      </div>
                      <p className="text-[10px] text-green-600/80 mt-0.5">{current.margin.toFixed(1)}% margin</p>
                    </CardContent>
                  </Card>

                  {/* Total Loss / Lost Amount */}
                  <Card className={(current.totalLoss || 0) > 0 ? "bg-rose-50 border-rose-200" : "bg-gray-50/50 border-gray-200"}>
                    <CardHeader className="pb-1 pt-3 px-3 md:px-4">
                      <CardTitle className={`text-[10px] md:text-xs font-medium flex items-center gap-1 ${(current.totalLoss || 0) > 0 ? "text-rose-700" : "text-gray-600"}`}>
                        <AlertCircle className="h-3 w-3" /> Total Loss
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="px-3 md:px-4 pb-3 md:pb-4">
                      <div className={`text-sm md:text-xl font-bold ${(current.totalLoss || 0) > 0 ? "text-rose-700" : "text-gray-800"}`}>
                        LKR {fmt(current.totalLoss || 0)}
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {(current.totalLoss || 0) > 0 ? "lost amount (below cost)" : "no loss recorded"}
                      </p>
                    </CardContent>
                  </Card>

                  {/* Pending Claims */}
                  <Card className={current.pendingClaimCost > 0 ? "bg-orange-50/50 border-orange-200" : "bg-gray-50/50 border-gray-200"}>
                    <CardHeader className="pb-1 pt-3 px-3 md:px-4">
                      <CardTitle className={`text-[10px] md:text-xs font-medium flex items-center gap-1 ${current.pendingClaimCost > 0 ? "text-orange-700" : "text-gray-600"}`}>
                        <AlertCircle className="h-3 w-3" /> Pending Claims
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="px-3 md:px-4 pb-3 md:pb-4">
                      <div className={`text-sm md:text-xl font-bold ${current.pendingClaimCost > 0 ? "text-orange-700" : "text-gray-800"}`}>
                        LKR {fmt(current.pendingClaimCost || 0)}
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{current.totalFreeQty || 0} free units unclaimed</p>
                    </CardContent>
                  </Card>

                  {/* Realized Net Profit */}
                  <Card className="bg-slate-50/50 border-slate-200">
                    <CardHeader className="pb-1 pt-3 px-3 md:px-4">
                      <CardTitle className="text-[10px] md:text-xs text-slate-700 font-medium flex items-center gap-1">
                        <TrendingUp className="h-3 w-3" /> Realized Net Profit
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="px-3 md:px-4 pb-3 md:pb-4">
                      <div className="text-sm md:text-xl font-bold text-slate-800">LKR {fmt(current.netProfit || 0)}</div>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{(current.netMargin || 0).toFixed(1)}% net margin</p>
                    </CardContent>
                  </Card>
                </div>
              </div>

              {/* Row 2: Outstanding Balance & Customer Counts */}
              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Receivables & Customer Reach</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
                  {/* Collections Received */}
                  <Card className="bg-emerald-50 border-emerald-200">
                    <CardHeader className="pb-1 pt-3 px-3 md:px-4">
                      <CardTitle className="text-[10px] md:text-xs text-emerald-700 font-medium flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" /> Collections Received
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="px-3 md:px-4 pb-3 md:pb-4">
                      <div className="text-sm md:text-xl font-bold text-emerald-700">
                        LKR {fmt(current.totalCollections !== undefined ? current.totalCollections : Math.max(0, current.totalRevenue - current.dueAmount))}
                      </div>
                      <p className="text-[10px] text-emerald-600/80 mt-0.5">
                        {current.collectionRate !== undefined
                          ? current.collectionRate.toFixed(1)
                          : ((Math.max(0, current.totalRevenue - current.dueAmount) / (current.totalRevenue || 1)) * 100).toFixed(1)}% recovery rate
                      </p>
                    </CardContent>
                  </Card>

                  {/* Due Invoices */}
                  <Card className="bg-red-50 border-red-200">
                    <CardHeader className="pb-1 pt-3 px-3 md:px-4">
                      <CardTitle className="text-[10px] md:text-xs text-red-700 font-medium flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" /> Due Invoices
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="px-3 md:px-4 pb-3 md:pb-4">
                      <div className="text-sm md:text-xl font-bold text-red-700">LKR {fmt(current.dueAmount)}</div>
                      <p className="text-[10px] text-muted-foreground mt-0.5">outstanding balance</p>
                    </CardContent>
                  </Card>

                  {/* Customers */}
                  <Card>
                    <CardHeader className="pb-1 pt-3 px-3 md:px-4">
                      <CardTitle className="text-[10px] md:text-xs text-muted-foreground font-medium flex items-center gap-1">
                        <Users className="h-3 w-3" /> Customers
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="px-3 md:px-4 pb-3 md:pb-4">
                      <div className="text-lg md:text-xl font-bold">{fmt(current.customerCount)}</div>
                      <p className="text-[10px] text-muted-foreground mt-0.5">active buyer accounts</p>
                    </CardContent>
                  </Card>

                  {/* Total Invoices */}
                  <Card>
                    <CardHeader className="pb-1 pt-3 px-3 md:px-4">
                      <CardTitle className="text-[10px] md:text-xs text-muted-foreground font-medium flex items-center gap-1">
                        <Receipt className="h-3 w-3" /> Total Invoices
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="px-3 md:px-4 pb-3 md:pb-4">
                      <div className="text-lg md:text-xl font-bold">{fmt(current.invoiceCount)}</div>
                      <p className="text-[10px] text-muted-foreground mt-0.5">invoices issued in range</p>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>

            {/* Charts */}
            {isOverall ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-2 pt-4 px-4">
                    <CardTitle className="text-sm">Sales by Business</CardTitle>
                  </CardHeader>
                  <CardContent className="px-2 md:px-4">
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={revenueChartData} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" tick={{ fontSize: 9 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                        <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 9 }} />
                        <Tooltip formatter={(v: any) => `LKR ${fmt(v)}`} />
                        <Bar dataKey="revenue" fill="#0088FE" name="Revenue" />
                        <Bar dataKey="profit" fill="#00C49F" name="Profit" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2 pt-4 px-4">
                    <CardTitle className="text-sm">Revenue Share</CardTitle>
                  </CardHeader>
                  <CardContent className="px-2 md:px-4">
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        <Pie
                          data={revenueChartData.filter((b) => b.revenue > 0)}
                          dataKey="revenue"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={75}
                          label={false}
                        >
                          {revenueChartData.map((_, i) => (
                            <Cell key={i} fill={COLORS[i % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v: any) => `LKR ${fmt(v)}`} />
                        <Legend formatter={(v) => v.length > 14 ? v.slice(0, 14) + "…" : v} wrapperStyle={{ fontSize: 9 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <Card>
                <CardHeader className="pb-2 pt-4 px-4">
                  <CardTitle className="text-sm">{current.name} — Sales vs Due</CardTitle>
                </CardHeader>
                <CardContent className="px-2 md:px-4">
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={[{
                      name: current.name.replace("Champika Hardware - ", "CH ").replace(" Agency", ""),
                      "Total Sales": current.totalRevenue,
                      "Total Profit": current.totalProfit,
                      "Due Amount": current.dueAmount,
                    }]}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 9 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                      <Tooltip formatter={(v: any) => `LKR ${fmt(v)}`} />
                      <Bar dataKey="Total Sales" fill="#0088FE" />
                      <Bar dataKey="Total Profit" fill="#00C49F" />
                      <Bar dataKey="Due Amount" fill="#FF8042" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {/* Business breakdown table (Overall only) */}
            {isOverall && (
              <Card>
                <CardHeader className="pb-3 px-4">
                  <CardTitle className="text-sm">Business Breakdown</CardTitle>
                </CardHeader>
                <CardContent className="px-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Business</TableHead>
                          <TableHead className="text-right">Total Sales</TableHead>
                          <TableHead className="text-right">Gross Profit</TableHead>
                          <TableHead className="text-right">Total Loss</TableHead>
                          <TableHead className="text-right">Net Profit</TableHead>
                          <TableHead className="text-right">Margin</TableHead>
                          <TableHead className="text-right">Due Amount</TableHead>
                          <TableHead className="text-right">Invoices</TableHead>
                          <TableHead className="text-right">Customers</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {/* Totals row at top */}
                        <TableRow className="border-b-2 font-bold bg-muted/30">
                          <TableCell className="font-bold">Total</TableCell>
                          <TableCell className="text-right text-blue-700 font-bold">
                            LKR {fmt(overall?.totalRevenue || 0)}
                          </TableCell>
                          <TableCell className="text-right text-green-700 font-bold">
                            LKR {fmt(overall?.totalGrossProfit ?? overall?.totalProfit ?? 0)}
                          </TableCell>
                          <TableCell className="text-right text-rose-600 font-bold">
                            {(overall?.totalLoss || 0) > 0 ? `LKR ${fmt(overall.totalLoss)}` : "—"}
                          </TableCell>
                          <TableCell className={`text-right font-bold ${(overall?.netProfit || 0) >= 0 ? "text-slate-800" : "text-rose-700"}`}>
                            LKR {fmt(overall?.netProfit || 0)}
                          </TableCell>
                          <TableCell className="text-right text-xs font-bold">
                            {overall?.margin.toFixed(1)}%
                          </TableCell>
                          <TableCell className="text-right text-red-600 font-bold">
                            LKR {fmt(overall?.dueAmount || 0)}
                          </TableCell>
                          <TableCell className="text-right font-bold">{overall?.invoiceCount}</TableCell>
                          <TableCell className="text-right font-bold">{overall?.customerCount}</TableCell>
                        </TableRow>
                        {businesses.map((biz) => (
                          <TableRow
                            key={biz.id}
                            className="cursor-pointer hover:bg-muted/30"
                            onClick={() => setSelectedId(biz.id)}
                          >
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <span className={`w-2 h-2 rounded-full shrink-0 ${getBizBg(biz.id)}`} />
                                <span className="font-medium text-xs md:text-sm">{biz.name}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-right font-medium text-blue-700">
                              LKR {fmt(biz.totalRevenue)}
                            </TableCell>
                            <TableCell className="text-right font-medium text-green-700">
                              LKR {fmt(biz.totalGrossProfit !== undefined ? biz.totalGrossProfit : biz.totalProfit)}
                            </TableCell>
                            <TableCell className="text-right font-medium text-rose-600">
                              {(biz.totalLoss || 0) > 0 ? `LKR ${fmt(biz.totalLoss)}` : "—"}
                            </TableCell>
                            <TableCell className={`text-right font-medium ${(biz.netProfit ?? biz.totalProfit) >= 0 ? "text-slate-800" : "text-rose-700"}`}>
                              LKR {fmt(biz.netProfit ?? biz.totalProfit)}
                            </TableCell>
                            <TableCell className="text-right text-xs text-muted-foreground">
                              {biz.margin.toFixed(1)}%
                            </TableCell>
                            <TableCell className="text-right text-red-600 font-medium">
                              LKR {fmt(biz.dueAmount)}
                            </TableCell>
                            <TableCell className="text-right">{biz.invoiceCount}</TableCell>
                            <TableCell className="text-right">{biz.customerCount}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Detail Tabs: Invoices / Customers / Products / Reps */}
            <Card>
              <CardHeader className="pb-3 px-4 pt-4 border-b">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 overflow-x-auto">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => { setDetailTab("invoices"); setDetailSearch(""); }}
                      className={`px-4 py-2 text-xs font-semibold rounded-xl gap-2 transition-all flex items-center whitespace-nowrap border ${
                        detailTab === "invoices"
                          ? "bg-black text-white border-black shadow-sm"
                          : "text-gray-800 hover:bg-gray-100/80 border-transparent"
                      }`}
                    >
                      <Receipt className="h-4 w-4 shrink-0" />
                      <span>Invoices</span>
                      <span className="text-sky-500 font-bold ml-0.5">({current.invoices?.length || 0})</span>
                    </button>

                    <button
                      onClick={() => { setDetailTab("customers"); setDetailSearch(""); }}
                      className={`px-4 py-2 text-xs font-semibold rounded-xl gap-2 transition-all flex items-center whitespace-nowrap border ${
                        detailTab === "customers"
                          ? "bg-black text-white border-black shadow-sm"
                          : "text-gray-800 hover:bg-gray-100/80 border-transparent"
                      }`}
                    >
                      <Users className="h-4 w-4 shrink-0" />
                      <span>Customers</span>
                      <span className="text-sky-500 font-bold ml-0.5">({current.customers?.length || 0})</span>
                    </button>

                    <button
                      onClick={() => { setDetailTab("products"); setDetailSearch(""); }}
                      className={`px-4 py-2 text-xs font-semibold rounded-xl gap-2 transition-all flex items-center whitespace-nowrap border ${
                        detailTab === "products"
                          ? "bg-black text-white border-black shadow-sm"
                          : "text-gray-800 hover:bg-gray-100/80 border-transparent"
                      }`}
                    >
                      <Package className="h-4 w-4 shrink-0" />
                      <span>Products</span>
                      <span className="text-sky-500 font-bold ml-0.5">({current.products?.length || 0})</span>
                    </button>

                    <button
                      onClick={() => { setDetailTab("reps"); setDetailSearch(""); }}
                      className={`px-4 py-2 text-xs font-semibold rounded-xl gap-2 transition-all flex items-center whitespace-nowrap border ${
                        detailTab === "reps"
                          ? "bg-black text-white border-black shadow-sm"
                          : "text-gray-800 hover:bg-gray-100/80 border-transparent"
                      }`}
                    >
                      <Users className="h-4 w-4 shrink-0" />
                      <span>Reps</span>
                      <span className="text-sky-500 font-bold ml-0.5">({current.reps?.length || 0})</span>
                    </button>

                    <button
                      onClick={() => { setDetailTab("months"); setDetailSearch(""); }}
                      className={`px-4 py-2 text-xs font-semibold rounded-xl gap-2 transition-all flex items-center whitespace-nowrap border ${
                        detailTab === "months"
                          ? "bg-black text-white border-black shadow-sm"
                          : "text-gray-800 hover:bg-gray-100/80 border-transparent"
                      }`}
                    >
                      <CalendarDays className="h-4 w-4 shrink-0" />
                      <span>Months — Sales vs Collection</span>
                      <span className="text-sky-500 font-bold ml-0.5">({monthlyData.length})</span>
                    </button>
                  </div>

                  <div className="relative w-full sm:w-60 shrink-0">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      placeholder="Search..."
                      value={detailSearch}
                      onChange={(e) => setDetailSearch(e.target.value)}
                      className="h-8 text-xs pl-8 rounded-lg"
                    />
                  </div>
                </div>
              </CardHeader>

              <CardContent className="px-0 pt-3">
                <div className="overflow-x-auto">

                  {/* ── Invoices Tab ── */}
                  {detailTab === "invoices" && (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Invoice No</TableHead>
                          <TableHead>Customer</TableHead>
                          <TableHead className="text-right">Free Issues</TableHead>
                          <TableHead className="text-right">Claim Value</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                          <TableHead className="text-right">Due</TableHead>
                          <TableHead className="text-right">Expected Profit</TableHead>
                          <TableHead className="text-right">Realized Net Profit</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {/* Totals row */}
                        <TableRow className="border-b-2 bg-muted/30 font-bold">
                          <TableCell colSpan={3} className="font-bold text-xs">
                            Total — {filteredInvoices.length} invoices
                          </TableCell>
                          <TableCell className="text-right text-orange-600 font-bold">
                            {invTotals.freeQty > 0 ? `${invTotals.freeQty} units` : "—"}
                          </TableCell>
                          <TableCell className="text-right text-orange-600 font-bold">
                            {invTotals.freeCost > 0 ? `LKR ${fmt(invTotals.freeCost)}` : "—"}
                          </TableCell>
                          <TableCell className="text-right text-blue-700 font-bold">
                            LKR {fmt(invTotals.amount)}
                          </TableCell>
                          <TableCell className="text-right text-red-600 font-bold">
                            LKR {fmt(invTotals.due)}
                          </TableCell>
                          <TableCell className="text-right font-bold">
                            <div className="flex flex-col items-end">
                              <span className="text-green-700 font-bold">LKR {fmt(invTotals.grossProfit)}</span>
                              {invTotals.totalLoss > 0 && (
                                <span className="text-[10px] text-rose-600 font-semibold mt-0.5">
                                  Loss: LKR {fmt(invTotals.totalLoss)}
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-bold">
                            <div className="flex flex-col items-end">
                              <span className={`font-bold ${invTotals.netProfit >= 0 ? "text-slate-800" : "text-rose-700"}`}>
                                LKR {fmt(invTotals.netProfit)}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell />
                          <TableCell />
                        </TableRow>
                        {filteredInvoices.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={11} className="text-center text-muted-foreground text-xs py-8">
                              No invoices found
                            </TableCell>
                          </TableRow>
                        ) : (
                          filteredInvoices.map((inv: any) => (
                            <TableRow key={inv.invoiceId} className="text-xs hover:bg-muted/40 transition-colors">
                              <TableCell className="text-muted-foreground whitespace-nowrap">{inv.date}</TableCell>
                              <TableCell className="font-mono font-medium">
                                <button
                                  type="button"
                                  onClick={() => router.push(`/dashboard/admin/invoices/${inv.invoiceId}?from=/dashboard/admin/reports/business`)}
                                  className="text-blue-600 hover:text-blue-800 hover:underline font-bold cursor-pointer text-left transition-colors inline-flex items-center gap-1 group"
                                  title="View invoice details"
                                >
                                  <span>{inv.invoiceNo}</span>
                                  <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                                </button>
                              </TableCell>
                              <TableCell>{inv.customer}</TableCell>
                              
                              {/* Free Issues */}
                              <TableCell className="text-right font-mono font-medium">
                                {inv.freeQty > 0 ? (
                                  <span className="text-orange-600 font-semibold">{inv.freeQty} units</span>
                                ) : (
                                  <span className="text-muted-foreground/45">—</span>
                                )}
                              </TableCell>
                              
                              {/* Claim Value */}
                              <TableCell className="text-right font-mono">
                                {inv.freeQty > 0 ? (
                                  <div className="flex flex-col items-end">
                                    <span className="text-orange-600 font-semibold">LKR {fmt(inv.freeCost)}</span>
                                    {inv.pendingClaimCost > 0 ? (
                                      <span className="text-[9px] text-orange-500 bg-orange-50 px-1 rounded font-sans">Unclaimed</span>
                                    ) : (
                                      <span className="text-[9px] text-green-600 bg-green-50 px-1 rounded font-sans">Claimed</span>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground/45">—</span>
                                )}
                              </TableCell>

                              <TableCell className="text-right font-medium">
                                LKR {fmt(inv.amount)}
                              </TableCell>
                              <TableCell className={`text-right font-medium ${inv.due > 0 ? "text-red-600" : "text-muted-foreground"}`}>
                                {inv.due > 0 ? `LKR ${fmt(inv.due)}` : "—"}
                              </TableCell>
                              
                              {/* Expected Profit */}
                              <TableCell className="text-right font-mono tabular-nums font-semibold">
                                {inv.profit === null || inv.profit === undefined ? (
                                  <span className="text-[10px] text-muted-foreground/50">—</span>
                                ) : inv.profit < 0 ? (
                                  <div className="flex flex-col items-end">
                                    <span className="text-rose-600 font-bold bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200 text-xs">
                                      Loss: LKR {fmt(Math.abs(inv.profit))}
                                    </span>
                                    <span className="text-[9px] text-rose-500 font-normal mt-0.5">
                                      {inv.profitMargin !== null ? `${inv.profitMargin.toFixed(1)}%` : ""}
                                    </span>
                                  </div>
                                ) : (
                                  <div className="flex flex-col items-end">
                                    <span className="text-green-700 font-bold">LKR {fmt(inv.profit)}</span>
                                    <span className="text-[9px] font-normal text-green-600">
                                      {inv.profitMargin !== null ? `+${inv.profitMargin.toFixed(1)}%` : ""}
                                    </span>
                                  </div>
                                )}
                              </TableCell>
                              
                              {/* Realized Net Profit */}
                              <TableCell className="text-right font-mono tabular-nums font-semibold">
                                {inv.netProfit === null || inv.netProfit === undefined ? (
                                  <span className="text-[10px] text-muted-foreground/50">—</span>
                                ) : inv.netProfit < 0 ? (
                                  <div className="flex flex-col items-end">
                                    <span className="text-rose-600 font-bold">
                                      -LKR {fmt(Math.abs(inv.netProfit))}
                                    </span>
                                    <span className="text-[9px] text-rose-500 font-normal">
                                      {inv.netMargin !== null ? `${inv.netMargin.toFixed(1)}%` : ""}
                                    </span>
                                  </div>
                                ) : (
                                  <div className="flex flex-col items-end">
                                    <span className="text-slate-800 font-bold">LKR {fmt(inv.netProfit)}</span>
                                    <span className="text-[9px] text-muted-foreground font-normal">
                                      {inv.netMargin !== null ? `${inv.netMargin.toFixed(1)}%` : ""}
                                    </span>
                                  </div>
                                )}
                              </TableCell>

                              <TableCell>
                                <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${STATUS_COLORS[inv.paymentStatus] || "bg-gray-100 text-gray-700"}`}>
                                  {inv.paymentStatus}
                                </span>
                              </TableCell>

                              {/* Action: View Invoice */}
                              <TableCell className="text-right">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 px-2.5 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50 font-medium gap-1 cursor-pointer"
                                  onClick={() => router.push(`/dashboard/admin/invoices/${inv.invoiceId}?from=/dashboard/admin/reports/business`)}
                                  title="View invoice details"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                  <span>View</span>
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  )}

                  {/* ── Customers Tab ── */}
                  {detailTab === "customers" && (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Customer</TableHead>
                          <TableHead className="text-right">Invoices</TableHead>
                          <TableHead className="text-right">Total Sales</TableHead>
                          <TableHead className="text-right">Collections (Paid)</TableHead>
                          <TableHead className="text-right">Due Amount</TableHead>
                          <TableHead className="text-right">Collection %</TableHead>
                          <TableHead className="text-right">Cost</TableHead>
                          <TableHead className="text-right">Profit</TableHead>
                          <TableHead className="text-right">Margin</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {/* Totals row */}
                        <TableRow className="border-b-2 bg-muted/30 font-bold">
                          <TableCell className="font-bold text-xs">
                            Total — {filteredCustomers.length} customers
                          </TableCell>
                          <TableCell className="text-right font-bold">{custTotals.invoiceCount}</TableCell>
                          <TableCell className="text-right text-blue-700 font-bold">
                            LKR {fmt(custTotals.revenue)}
                          </TableCell>
                          <TableCell className="text-right text-emerald-700 font-bold">
                            LKR {fmt(custTotals.collected)}
                          </TableCell>
                          <TableCell className="text-right text-red-600 font-bold">
                            LKR {fmt(custTotals.dueAmount)}
                          </TableCell>
                          <TableCell className="text-right font-bold">
                            <CollectionBadge rate={custTotals.collectionRate} />
                          </TableCell>
                          <TableCell className="text-right font-bold text-muted-foreground">
                            LKR {fmt(custTotals.cost)}
                          </TableCell>
                          <TableCell className={`text-right font-bold ${custTotals.profit >= 0 ? "text-green-700" : "text-red-700"}`}>
                            LKR {fmt(custTotals.profit)}
                          </TableCell>
                          <TableCell className="text-right text-xs font-bold">
                            {custTotals.revenue > 0 ? ((custTotals.profit / custTotals.revenue) * 100).toFixed(1) : "0.0"}%
                          </TableCell>
                        </TableRow>
                        {filteredCustomers.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={9} className="text-center text-muted-foreground text-xs py-8">
                              No customers found
                            </TableCell>
                          </TableRow>
                        ) : (
                          filteredCustomers.map((c: any) => {
                            const collected = c.collected !== undefined ? c.collected : Math.max(0, c.revenue - c.dueAmount);
                            const collRate = c.collectionRate !== undefined ? c.collectionRate : (c.revenue > 0 ? (collected / c.revenue) * 100 : 0);
                            return (
                              <TableRow key={c.id} className="text-xs hover:bg-muted/30">
                                <TableCell className="font-medium">{c.name}</TableCell>
                                <TableCell className="text-right">{c.invoiceCount}</TableCell>
                                <TableCell className="text-right text-blue-700 font-medium">
                                  LKR {fmt(c.revenue)}
                                </TableCell>
                                <TableCell className="text-right text-emerald-700 font-medium">
                                  LKR {fmt(collected)}
                                </TableCell>
                                <TableCell className={`text-right font-medium ${c.dueAmount > 0 ? "text-red-600" : "text-muted-foreground"}`}>
                                  {c.dueAmount > 0 ? `LKR ${fmt(c.dueAmount)}` : "—"}
                                </TableCell>
                                <TableCell className="text-right">
                                  <CollectionBadge rate={collRate} />
                                </TableCell>
                                <TableCell className="text-right text-muted-foreground">
                                  LKR {fmt(c.cost)}
                                </TableCell>
                                <TableCell className={`text-right font-medium ${c.profit >= 0 ? "text-green-700" : "text-red-700"}`}>
                                  LKR {fmt(c.profit)}
                                </TableCell>
                                <TableCell className="text-right text-muted-foreground">
                                  {c.margin.toFixed(1)}%
                                </TableCell>
                              </TableRow>
                            );
                          })
                        )}
                      </TableBody>
                    </Table>
                  )}

                  {/* ── Products Tab ── */}
                  {detailTab === "products" && (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Product</TableHead>
                          <TableHead>SKU</TableHead>
                          <TableHead className="text-right">Units Sold</TableHead>
                          <TableHead className="text-right">Revenue</TableHead>
                          <TableHead className="text-right">Cost</TableHead>
                          <TableHead className="text-right">Profit</TableHead>
                          <TableHead className="text-right">Margin</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {/* Totals row */}
                        <TableRow className="border-b-2 bg-muted/30 font-bold">
                          <TableCell className="font-bold text-xs">
                            Total — {filteredProducts.length} products
                          </TableCell>
                          <TableCell />
                          <TableCell className="text-right font-bold">{fmt(prodTotals.unitsSold)}</TableCell>
                          <TableCell className="text-right text-blue-700 font-bold">
                            LKR {fmt(prodTotals.revenue)}
                          </TableCell>
                          <TableCell className="text-right font-bold text-muted-foreground">
                            LKR {fmt(prodTotals.cost)}
                          </TableCell>
                          <TableCell className={`text-right font-bold ${prodTotals.profit >= 0 ? "text-green-700" : "text-red-700"}`}>
                            LKR {fmt(prodTotals.profit)}
                          </TableCell>
                          <TableCell className="text-right text-xs font-bold">
                            {prodTotals.revenue > 0 ? ((prodTotals.profit / prodTotals.revenue) * 100).toFixed(1) : "0.0"}%
                          </TableCell>
                        </TableRow>
                        {filteredProducts.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={7} className="text-center text-muted-foreground text-xs py-8">
                              No products found
                            </TableCell>
                          </TableRow>
                        ) : (
                          filteredProducts.map((p: any) => (
                            <TableRow key={p.id} className="text-xs">
                              <TableCell className="font-medium max-w-[180px] truncate">{p.name}</TableCell>
                              <TableCell className="font-mono text-muted-foreground">{p.sku || "—"}</TableCell>
                              <TableCell className="text-right">{fmt(p.unitsSold)}</TableCell>
                              <TableCell className="text-right text-blue-700 font-medium">
                                LKR {fmt(p.revenue)}
                              </TableCell>
                              <TableCell className="text-right text-muted-foreground">
                                LKR {fmt(p.cost)}
                              </TableCell>
                              <TableCell className={`text-right font-medium ${p.profit >= 0 ? "text-green-700" : "text-red-700"}`}>
                                LKR {fmt(p.profit)}
                              </TableCell>
                              <TableCell className="text-right text-muted-foreground">
                                {p.margin.toFixed(1)}%
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  )}

                  {/* ── Reps Tab ── */}
                  {detailTab === "reps" && (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Representative</TableHead>
                          <TableHead className="text-right">Invoices</TableHead>
                          <TableHead className="text-right">Total Sales</TableHead>
                          <TableHead className="text-right">Collections (Paid)</TableHead>
                          <TableHead className="text-right">Due Amount</TableHead>
                          <TableHead className="text-right">Collection %</TableHead>
                          <TableHead className="text-right">Cost</TableHead>
                          <TableHead className="text-right">Profit</TableHead>
                          <TableHead className="text-right">Margin</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {/* Totals row */}
                        <TableRow className="border-b-2 bg-muted/30 font-bold">
                          <TableCell className="font-bold text-xs">
                            Total — {filteredReps.length} reps
                          </TableCell>
                          <TableCell className="text-right font-bold">{repTotals.invoiceCount}</TableCell>
                          <TableCell className="text-right text-blue-700 font-bold">
                            LKR {fmt(repTotals.revenue)}
                          </TableCell>
                          <TableCell className="text-right text-emerald-700 font-bold">
                            LKR {fmt(repTotals.collected)}
                          </TableCell>
                          <TableCell className="text-right text-red-600 font-bold">
                            LKR {fmt(repTotals.dueAmount)}
                          </TableCell>
                          <TableCell className="text-right font-bold">
                            <CollectionBadge rate={repTotals.collectionRate} />
                          </TableCell>
                          <TableCell className="text-right font-bold text-muted-foreground">
                            LKR {fmt(repTotals.cost)}
                          </TableCell>
                          <TableCell className={`text-right font-bold ${repTotals.profit >= 0 ? "text-green-700" : "text-red-700"}`}>
                            LKR {fmt(repTotals.profit)}
                          </TableCell>
                          <TableCell className="text-right text-xs font-bold">
                            {repTotals.revenue > 0 ? ((repTotals.profit / repTotals.revenue) * 100).toFixed(1) : "0.0"}%
                          </TableCell>
                        </TableRow>
                        {filteredReps.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={9} className="text-center text-muted-foreground text-xs py-8">
                              No representatives found
                            </TableCell>
                          </TableRow>
                        ) : (
                          filteredReps.map((r: any) => {
                            const isDirect = r.name === "Champika Hardware";
                            const collected = r.collected !== undefined ? r.collected : Math.max(0, r.revenue - r.dueAmount);
                            const collRate = r.collectionRate !== undefined ? r.collectionRate : (r.revenue > 0 ? (collected / r.revenue) * 100 : 0);
                            return (
                              <TableRow key={r.id} className="text-xs hover:bg-muted/30">
                                <TableCell>
                                  {isDirect ? (
                                    <div className="flex items-center gap-2">
                                      <span className="font-semibold text-primary">Champika Hardware Direct</span>
                                      <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-[9px] px-1 py-0 h-4">
                                        Direct Counter Sales
                                      </Badge>
                                    </div>
                                  ) : (
                                    <span className="font-medium">{r.name}</span>
                                  )}
                                </TableCell>
                                <TableCell className="text-right">{r.invoiceCount}</TableCell>
                                <TableCell className="text-right text-blue-700 font-medium">
                                  LKR {fmt(r.revenue)}
                                </TableCell>
                                <TableCell className="text-right text-emerald-700 font-medium">
                                  LKR {fmt(collected)}
                                </TableCell>
                                <TableCell className={`text-right font-medium ${r.dueAmount > 0 ? "text-red-600" : "text-muted-foreground"}`}>
                                  {r.dueAmount > 0 ? `LKR ${fmt(r.dueAmount)}` : "—"}
                                </TableCell>
                                <TableCell className="text-right">
                                  <CollectionBadge rate={collRate} />
                                </TableCell>
                                <TableCell className="text-right text-muted-foreground">
                                  LKR {fmt(r.cost)}
                                </TableCell>
                                <TableCell className={`text-right font-medium ${r.profit >= 0 ? "text-green-700" : "text-red-700"}`}>
                                  LKR {fmt(r.profit)}
                                </TableCell>
                                <TableCell className="text-right text-muted-foreground">
                                  {r.margin.toFixed(1)}%
                                </TableCell>
                              </TableRow>
                            );
                          })
                        )}
                      </TableBody>
                    </Table>
                  )}

                  {/* ── Months — Sales vs Collection Tab ── */}
                  {detailTab === "months" && (
                    <div className="space-y-4">
                      {/* Controls header */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-2 bg-muted/20 border-b">
                        <div>
                          <h4 className="text-xs font-semibold text-gray-900">
                            Monthly Sales vs Collections Performance
                          </h4>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            Month-by-month cash realization, outstanding debt, and representative contributions
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-medium text-muted-foreground shrink-0">Filter Rep:</span>
                          <Select value={selectedMonthRep} onValueChange={setSelectedMonthRep}>
                            <SelectTrigger className="w-[180px] h-7 text-xs bg-white">
                              <SelectValue placeholder="All Representatives" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All Representatives</SelectItem>
                              {repFilterOptions.map((name) => (
                                <SelectItem key={name} value={name}>
                                  {name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {/* Monthly summary KPI metrics */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 px-4">
                        <div className="p-3 bg-blue-50/60 border border-blue-200/70 rounded-xl">
                          <p className="text-[11px] font-medium text-blue-700 flex items-center gap-1">
                            <DollarSign className="w-3.5 h-3.5" /> Total Sales
                          </p>
                          <p className="text-lg font-bold text-blue-900 mt-0.5">LKR {fmt(monthTotals.sales)}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {monthTotals.invoiceCount} invoices · {monthlyData.length} active months
                          </p>
                        </div>

                        <div className="p-3 bg-emerald-50/60 border border-emerald-200/70 rounded-xl">
                          <p className="text-[11px] font-medium text-emerald-700 flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Collections (Paid)
                          </p>
                          <p className="text-lg font-bold text-emerald-900 mt-0.5">LKR {fmt(monthTotals.collected)}</p>
                          <p className="text-[10px] text-emerald-700 mt-0.5">
                            Cash collected from billing
                          </p>
                        </div>

                        <div className="p-3 bg-rose-50/60 border border-rose-200/70 rounded-xl">
                          <p className="text-[11px] font-medium text-rose-700 flex items-center gap-1">
                            <AlertCircle className="w-3.5 h-3.5" /> Due Amount
                          </p>
                          <p className="text-lg font-bold text-red-700 mt-0.5">LKR {fmt(monthTotals.due)}</p>
                          <p className="text-[10px] text-rose-700 mt-0.5">
                            Unrecovered receivables
                          </p>
                        </div>

                        <div className="p-3 bg-indigo-50/60 border border-indigo-200/70 rounded-xl">
                          <p className="text-[11px] font-medium text-indigo-700 flex items-center gap-1">
                            <TrendingUp className="w-3.5 h-3.5" /> Collection Rate
                          </p>
                          <p className="text-lg font-bold text-indigo-900 mt-0.5">{monthTotals.collectionRate.toFixed(1)}%</p>
                          <div className="w-full bg-indigo-200/60 rounded-full h-1.5 mt-1 overflow-hidden">
                            <div
                              className="bg-indigo-600 h-full rounded-full transition-all"
                              style={{ width: `${Math.min(100, monthTotals.collectionRate)}%` }}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Sales vs Collections Comparison Chart */}
                      {monthlyChartData.length > 0 && (
                        <div className="px-4 pt-1">
                          <div className="p-4 border rounded-xl bg-white shadow-sm">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                              <div>
                                <h5 className="text-xs font-semibold text-gray-800">
                                  Monthly Trend: Sales vs Collections vs Due
                                </h5>
                                <p className="text-[10px] text-muted-foreground">
                                  Visual comparison of monthly billing and payment realization
                                </p>
                              </div>
                              <div className="flex items-center gap-4 text-xs font-medium">
                                <span className="flex items-center gap-1.5">
                                  <span className="w-2.5 h-2.5 rounded bg-blue-600 inline-block" /> Sales
                                </span>
                                <span className="flex items-center gap-1.5">
                                  <span className="w-2.5 h-2.5 rounded bg-emerald-500 inline-block" /> Collections
                                </span>
                                <span className="flex items-center gap-1.5">
                                  <span className="w-2.5 h-2.5 rounded bg-rose-500 inline-block" /> Due
                                </span>
                              </div>
                            </div>
                            <ResponsiveContainer width="100%" height={240}>
                              <BarChart data={monthlyChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                                <YAxis tick={{ fontSize: 9 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                                <Tooltip
                                  formatter={(val: any, name: any) => [
                                    `LKR ${fmt(Number(val))}`,
                                    name === "sales" ? "Total Sales" : name === "collected" ? "Collections (Paid)" : "Due Amount",
                                  ]}
                                />
                                <Bar dataKey="sales" fill="#2563eb" name="sales" radius={[3, 3, 0, 0]} />
                                <Bar dataKey="collected" fill="#10b981" name="collected" radius={[3, 3, 0, 0]} />
                                <Bar dataKey="due" fill="#ef4444" name="due" radius={[3, 3, 0, 0]} />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                      )}

                      {/* Month-by-Month Breakdown Table */}
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-8"></TableHead>
                            <TableHead>Month</TableHead>
                            <TableHead className="text-right">Invoices</TableHead>
                            <TableHead className="text-right">Total Sales</TableHead>
                            <TableHead className="text-right">Collections (Paid)</TableHead>
                            <TableHead className="text-right">Due Amount</TableHead>
                            <TableHead className="text-right">Collection %</TableHead>
                            <TableHead className="text-right">Profit</TableHead>
                            <TableHead className="text-right">Margin</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {/* Totals row */}
                          <TableRow className="border-b-2 bg-muted/30 font-bold">
                            <TableCell></TableCell>
                            <TableCell className="font-bold text-xs">Total — {monthlyData.length} months</TableCell>
                            <TableCell className="text-right font-bold">{monthTotals.invoiceCount}</TableCell>
                            <TableCell className="text-right text-blue-700 font-bold">LKR {fmt(monthTotals.sales)}</TableCell>
                            <TableCell className="text-right text-emerald-700 font-bold">LKR {fmt(monthTotals.collected)}</TableCell>
                            <TableCell className="text-right text-red-600 font-bold">LKR {fmt(monthTotals.due)}</TableCell>
                            <TableCell className="text-right font-bold">
                              <CollectionBadge rate={monthTotals.collectionRate} />
                            </TableCell>
                            <TableCell className={`text-right font-bold ${monthTotals.profit >= 0 ? "text-green-700" : "text-red-700"}`}>
                              LKR {fmt(monthTotals.profit)}
                            </TableCell>
                            <TableCell className="text-right text-xs font-bold">
                              {monthTotals.sales > 0 ? ((monthTotals.profit / monthTotals.sales) * 100).toFixed(1) : "0.0"}%
                            </TableCell>
                          </TableRow>

                          {monthlyData.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={9} className="text-center text-muted-foreground text-xs py-8">
                                No monthly sales and collection records found for this period
                              </TableCell>
                            </TableRow>
                          ) : (
                            monthlyData.map((m: any) => {
                              const isExpanded = expandedMonth === m.month;
                              return (
                                <React.Fragment key={m.month}>
                                  <TableRow
                                    className="text-xs hover:bg-muted/30 cursor-pointer"
                                    onClick={() => setExpandedMonth(isExpanded ? null : m.month)}
                                  >
                                    <TableCell className="text-center p-0 w-8">
                                      {m.reps && m.reps.length > 0 && (
                                        <button
                                          type="button"
                                          className="p-1 hover:bg-gray-200 rounded text-muted-foreground"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setExpandedMonth(isExpanded ? null : m.month);
                                          }}
                                          title={isExpanded ? "Collapse representatives" : "Expand representatives"}
                                        >
                                          {isExpanded ? (
                                            <ChevronDown className="w-3.5 h-3.5" />
                                          ) : (
                                            <ChevronRight className="w-3.5 h-3.5" />
                                          )}
                                        </button>
                                      )}
                                    </TableCell>
                                    <TableCell className="font-semibold text-gray-900">
                                      <div className="flex items-center gap-1.5">
                                        <span>{m.monthLabel || m.month}</span>
                                        {m.reps && m.reps.length > 0 && (
                                          <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 bg-muted/40 font-normal">
                                            {m.reps.length} reps
                                          </Badge>
                                        )}
                                      </div>
                                    </TableCell>
                                    <TableCell className="text-right">{m.invoiceCount}</TableCell>
                                    <TableCell className="text-right text-blue-700 font-medium">LKR {fmt(m.salesAmount)}</TableCell>
                                    <TableCell className="text-right text-emerald-700 font-medium">LKR {fmt(m.collectedAmount)}</TableCell>
                                    <TableCell className={`text-right font-medium ${m.dueAmount > 0 ? "text-red-600" : "text-muted-foreground"}`}>
                                      {m.dueAmount > 0 ? `LKR ${fmt(m.dueAmount)}` : "—"}
                                    </TableCell>
                                    <TableCell className="text-right">
                                      <CollectionBadge rate={m.collectionRate} />
                                    </TableCell>
                                    <TableCell className={`text-right font-medium ${m.profit >= 0 ? "text-green-700" : "text-red-700"}`}>
                                      LKR {fmt(m.profit)}
                                    </TableCell>
                                    <TableCell className="text-right text-muted-foreground">
                                      {m.margin.toFixed(1)}%
                                    </TableCell>
                                  </TableRow>

                                  {/* Sub-table for Representatives active in this month */}
                                  {isExpanded && m.reps && m.reps.length > 0 && (
                                    <TableRow className="bg-slate-50/70 hover:bg-slate-50/70">
                                      <TableCell colSpan={9} className="p-3 pl-8">
                                        <div className="border border-slate-200 rounded-lg bg-white overflow-hidden shadow-sm">
                                          <div className="px-3 py-1.5 bg-slate-100/80 border-b flex items-center justify-between">
                                            <span className="text-[11px] font-semibold text-slate-700">
                                              Representative Performance · {m.monthLabel || m.month}
                                            </span>
                                            <span className="text-[10px] text-muted-foreground">
                                              {m.reps.length} active reps
                                            </span>
                                          </div>
                                          <Table>
                                            <TableHeader>
                                              <TableRow className="text-[10px] bg-slate-50 border-b">
                                                <TableHead className="h-7 text-slate-600">Representative</TableHead>
                                                <TableHead className="h-7 text-right text-slate-600">Invoices</TableHead>
                                                <TableHead className="h-7 text-right text-slate-600">Total Sales</TableHead>
                                                <TableHead className="h-7 text-right text-slate-600">Collections (Paid)</TableHead>
                                                <TableHead className="h-7 text-right text-slate-600">Due Amount</TableHead>
                                                <TableHead className="h-7 text-right text-slate-600">Collection %</TableHead>
                                              </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                              {m.reps.map((r: any) => {
                                                const rRate = r.sales > 0 ? (r.collected / r.sales) * 100 : 0;
                                                return (
                                                  <TableRow key={r.name} className="text-[11px] hover:bg-slate-50/50">
                                                    <TableCell className="py-1.5 font-medium">{r.name}</TableCell>
                                                    <TableCell className="py-1.5 text-right">{r.invoiceCount}</TableCell>
                                                    <TableCell className="py-1.5 text-right text-blue-700 font-medium">LKR {fmt(r.sales)}</TableCell>
                                                    <TableCell className="py-1.5 text-right text-emerald-700 font-medium">LKR {fmt(r.collected)}</TableCell>
                                                    <TableCell className={`py-1.5 text-right font-medium ${r.due > 0 ? "text-red-600" : "text-muted-foreground"}`}>
                                                      {r.due > 0 ? `LKR ${fmt(r.due)}` : "—"}
                                                    </TableCell>
                                                    <TableCell className="py-1.5 text-right">
                                                      <CollectionBadge rate={rRate} />
                                                    </TableCell>
                                                  </TableRow>
                                                );
                                              })}
                                            </TableBody>
                                          </Table>
                                        </div>
                                      </TableCell>
                                    </TableRow>
                                  )}
                                </React.Fragment>
                              );
                            })
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  )}

                </div>
              </CardContent>
            </Card>

          </>
        )}
      </div>
    </div>
  );
}
