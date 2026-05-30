"use client";

import React, { useState, useEffect, useMemo } from "react";
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
  RefreshCw,
  Menu,
  Users,
  Package,
  Receipt,
  Search,
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

function getRange(quickSelect: string, customFrom: string, customTo: string) {
  const now = new Date();
  let from: Date, to: Date;
  switch (quickSelect) {
    case "this-month":
      from = new Date(now.getFullYear(), now.getMonth(), 1);
      to = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
      break;
    case "last-month":
      from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      to = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
      break;
    case "this-year":
      from = new Date(now.getFullYear(), 0, 1);
      to = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
      break;
    case "last-year":
      from = new Date(now.getFullYear() - 1, 0, 1);
      to = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59);
      break;
    case "custom":
      from = new Date(customFrom); from.setHours(0, 0, 0, 0);
      to = new Date(customTo); to.setHours(23, 59, 59, 999);
      break;
    default:
      from = new Date(now.getFullYear(), now.getMonth(), 1);
      to = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  }
  return { from: from.toISOString(), to: to.toISOString() };
}

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
  const today = new Date().toISOString().split("T")[0];
  const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    .toISOString().split("T")[0];

  const [quickSelect, setQuickSelect] = useState("this-month");
  const [customFrom, setCustomFrom] = useState(firstOfMonth);
  const [customTo, setCustomTo] = useState(today);
  const [loading, setLoading] = useState(true);
  const [overall, setOverall] = useState<any>(null);
  const [businesses, setBusinesses] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState<string>("overall");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [detailTab, setDetailTab] = useState<"invoices" | "customers" | "products" | "reps">("invoices");
  const [detailSearch, setDetailSearch] = useState("");

  const fetchData = async () => {
    setLoading(true);
    try {
      const { from, to } = getRange(quickSelect, customFrom, customTo);
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
    if (quickSelect !== "custom") fetchData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quickSelect]);

  const handleCustomApply = () => {
    if (!customFrom || !customTo) return;
    fetchData();
  };

  const current = useMemo(() => {
    if (selectedId === "overall") return overall;
    return businesses.find((b) => b.id === selectedId) || null;
  }, [selectedId, overall, businesses]);

  const revenueChartData = useMemo(
    () => businesses.map((b) => ({
      name: b.name.replace("Champika Hardware - ", "CH ").replace(" Agency", ""),
      revenue: b.totalRevenue,
      profit: b.totalProfit,
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
  const invTotals = useMemo(() => ({
    amount: filteredInvoices.reduce((s, i) => s + i.amount, 0),
    due: filteredInvoices.reduce((s, i) => s + i.due, 0),
    profit: filteredInvoices.reduce((s, i) => s + (i.profit || 0), 0),
    freeQty: filteredInvoices.reduce((s, i) => s + (i.freeQty || 0), 0),
    freeCost: filteredInvoices.reduce((s, i) => s + (i.freeCost || 0), 0),
    netProfit: filteredInvoices.reduce((s, i) => s + (i.netProfit || 0), 0),
    pendingClaimCost: filteredInvoices.reduce((s, i) => s + (i.pendingClaimCost || 0), 0),
  }), [filteredInvoices]);

  const custTotals = useMemo(() => ({
    revenue: filteredCustomers.reduce((s, c) => s + c.revenue, 0),
    cost: filteredCustomers.reduce((s, c) => s + c.cost, 0),
    profit: filteredCustomers.reduce((s, c) => s + c.profit, 0),
    dueAmount: filteredCustomers.reduce((s, c) => s + c.dueAmount, 0),
    invoiceCount: filteredCustomers.reduce((s, c) => s + c.invoiceCount, 0),
  }), [filteredCustomers]);

  const prodTotals = useMemo(() => ({
    unitsSold: filteredProducts.reduce((s, p) => s + p.unitsSold, 0),
    revenue: filteredProducts.reduce((s, p) => s + p.revenue, 0),
    cost: filteredProducts.reduce((s, p) => s + p.cost, 0),
    profit: filteredProducts.reduce((s, p) => s + p.profit, 0),
  }), [filteredProducts]);

  const repTotals = useMemo(() => ({
    revenue: filteredReps.reduce((s, r) => s + r.revenue, 0),
    cost: filteredReps.reduce((s, r) => s + r.cost, 0),
    profit: filteredReps.reduce((s, r) => s + r.profit, 0),
    dueAmount: filteredReps.reduce((s, r) => s + r.dueAmount, 0),
    invoiceCount: filteredReps.reduce((s, r) => s + r.invoiceCount, 0),
  }), [filteredReps]);

  const DateControls = () => (
    <div className="space-y-2">
      <Select value={quickSelect} onValueChange={setQuickSelect}>
        <SelectTrigger className="w-full h-8 text-xs">
          <Calendar className="mr-1 h-3 w-3" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="this-month">This Month</SelectItem>
          <SelectItem value="last-month">Last Month</SelectItem>
          <SelectItem value="this-year">This Year</SelectItem>
          <SelectItem value="last-year">Last Year</SelectItem>
          <SelectItem value="custom">Custom Range</SelectItem>
        </SelectContent>
      </Select>
      {quickSelect === "custom" && (
        <div className="space-y-1.5">
          <Input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="h-7 text-xs" />
          <Input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="h-7 text-xs" />
          <Button size="sm" className="w-full h-7 text-xs" onClick={handleCustomApply} disabled={loading}>
            {loading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <RefreshCw className="h-3 w-3 mr-1" />}
            Apply
          </Button>
        </div>
      )}
    </div>
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
      <div className="lg:hidden bg-white border-b px-4 py-3 space-y-3 shrink-0">
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
          <Select value={quickSelect} onValueChange={setQuickSelect}>
            <SelectTrigger className="h-8 text-xs w-32 shrink-0">
              <Calendar className="mr-1 h-3 w-3 shrink-0" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="this-month">This Month</SelectItem>
              <SelectItem value="last-month">Last Month</SelectItem>
              <SelectItem value="this-year">This Year</SelectItem>
              <SelectItem value="last-year">Last Year</SelectItem>
              <SelectItem value="custom">Custom</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {quickSelect === "custom" && (
          <div className="flex gap-2">
            <Input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="h-8 text-xs flex-1" />
            <Input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="h-8 text-xs flex-1" />
            <Button size="sm" className="h-8 px-3 shrink-0" onClick={handleCustomApply} disabled={loading}>
              {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
            </Button>
          </div>
        )}
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
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
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

                  {/* Gross Profit (Expected) */}
                  <Card className="bg-slate-50/50 border-slate-200">
                    <CardHeader className="pb-1 pt-3 px-3 md:px-4">
                      <CardTitle className="text-[10px] md:text-xs text-slate-700 font-medium flex items-center gap-1">
                        <TrendingUp className="h-3 w-3" /> Expected Gross Profit
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="px-3 md:px-4 pb-3 md:pb-4">
                      <div className="text-sm md:text-xl font-bold text-slate-800">LKR {fmt(current.totalProfit)}</div>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{current.margin.toFixed(1)}% margin</p>
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
                  <Card className="bg-green-50 border-green-200">
                    <CardHeader className="pb-1 pt-3 px-3 md:px-4">
                      <CardTitle className="text-[10px] md:text-xs text-green-700 font-medium flex items-center gap-1">
                        <TrendingUp className="h-3 w-3" /> Realized Net Profit
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="px-3 md:px-4 pb-3 md:pb-4">
                      <div className="text-sm md:text-xl font-bold text-green-700">LKR {fmt(current.netProfit || 0)}</div>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{(current.netMargin || 0).toFixed(1)}% net margin</p>
                    </CardContent>
                  </Card>
                </div>
              </div>

              {/* Row 2: Outstanding Balance & Customer Counts */}
              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Receivables & Customer Reach</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
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
                          <TableHead className="text-right">Total Profit</TableHead>
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
                          <TableCell className={`text-right font-bold ${(overall?.totalProfit || 0) >= 0 ? "text-green-700" : "text-red-700"}`}>
                            LKR {fmt(overall?.totalProfit || 0)}
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
                            <TableCell className={`text-right font-medium ${biz.totalProfit >= 0 ? "text-green-700" : "text-red-700"}`}>
                              LKR {fmt(biz.totalProfit)}
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

            {/* Detail Tabs: Invoices / Customers / Products */}
            <Card>
              <CardHeader className="pb-0 px-4 pt-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex gap-1 flex-wrap">
                    <Button
                      variant={detailTab === "invoices" ? "default" : "ghost"}
                      size="sm"
                      className="h-8 text-xs"
                      onClick={() => { setDetailTab("invoices"); setDetailSearch(""); }}
                    >
                      <Receipt className="h-3 w-3 mr-1" />
                      Invoices ({current.invoices?.length || 0})
                    </Button>
                    <Button
                      variant={detailTab === "customers" ? "default" : "ghost"}
                      size="sm"
                      className="h-8 text-xs"
                      onClick={() => { setDetailTab("customers"); setDetailSearch(""); }}
                    >
                      <Users className="h-3 w-3 mr-1" />
                      Customers ({current.customers?.length || 0})
                    </Button>
                    <Button
                      variant={detailTab === "products" ? "default" : "ghost"}
                      size="sm"
                      className="h-8 text-xs"
                      onClick={() => { setDetailTab("products"); setDetailSearch(""); }}
                    >
                      <Package className="h-3 w-3 mr-1" />
                      Products ({current.products?.length || 0})
                    </Button>
                    <Button
                      variant={detailTab === "reps" ? "default" : "ghost"}
                      size="sm"
                      className="h-8 text-xs"
                      onClick={() => { setDetailTab("reps"); setDetailSearch(""); }}
                    >
                      <Users className="h-3 w-3 mr-1" />
                      Reps ({current.reps?.length || 0})
                    </Button>
                  </div>
                  <div className="relative w-full sm:w-44">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                    <Input
                      placeholder="Search..."
                      value={detailSearch}
                      onChange={(e) => setDetailSearch(e.target.value)}
                      className="h-8 text-xs pl-7"
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
                          <TableCell className={`text-right font-bold ${invTotals.profit >= 0 ? "text-slate-700" : "text-red-700"}`}>
                            LKR {fmt(invTotals.profit)}
                          </TableCell>
                          <TableCell className={`text-right font-bold ${invTotals.netProfit >= 0 ? "text-green-700 font-bold" : "text-red-700 font-bold"}`}>
                            LKR {fmt(invTotals.netProfit)}
                          </TableCell>
                          <TableCell />
                        </TableRow>
                        {filteredInvoices.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={10} className="text-center text-muted-foreground text-xs py-8">
                              No invoices found
                            </TableCell>
                          </TableRow>
                        ) : (
                          filteredInvoices.map((inv: any) => (
                            <TableRow key={inv.invoiceId} className="text-xs">
                              <TableCell className="text-muted-foreground whitespace-nowrap">{inv.date}</TableCell>
                              <TableCell className="font-mono font-medium">{inv.invoiceNo}</TableCell>
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
                              <TableCell className={`text-right font-mono tabular-nums font-semibold ${
                                inv.profit === null || inv.profit === undefined ? "text-muted-foreground"
                                : inv.profit >= 0 ? "text-slate-700" : "text-red-600"
                              }`}>
                                {inv.profit === null || inv.profit === undefined ? (
                                  <span className="text-[10px] text-muted-foreground/50">—</span>
                                ) : (
                                  <div className="flex flex-col items-end">
                                    <span>LKR {fmt(inv.profit)}</span>
                                    <span className="text-[9px] text-muted-foreground font-normal">
                                      {inv.profitMargin !== null ? `${inv.profitMargin.toFixed(1)}%` : ""}
                                    </span>
                                  </div>
                                )}
                              </TableCell>
                              
                              {/* Realized Net Profit */}
                              <TableCell className={`text-right font-mono tabular-nums font-semibold ${
                                inv.netProfit === null || inv.netProfit === undefined ? "text-muted-foreground"
                                : inv.netProfit >= 0 ? "text-green-700 font-bold" : "text-red-600 font-bold bg-red-50/50"
                              }`}>
                                {inv.netProfit === null || inv.netProfit === undefined ? (
                                  <span className="text-[10px] text-muted-foreground/50">—</span>
                                ) : (
                                  <div className="flex flex-col items-end">
                                    <span>LKR {fmt(inv.netProfit)}</span>
                                    <span className={`text-[9px] font-normal ${inv.netProfit >= 0 ? "text-green-600" : "text-red-500"}`}>
                                      {inv.netMargin !== null ? `${inv.netMargin.toFixed(1)}%` : ""}
                                    </span>
                                  </div>
                                )}
                              </TableCell>
                              
                              <TableCell>
                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${STATUS_COLORS[inv.paymentStatus] || "bg-gray-100 text-gray-700"}`}>
                                  {inv.paymentStatus}
                                </span>
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
                          <TableHead className="text-right">Revenue</TableHead>
                          <TableHead className="text-right">Cost</TableHead>
                          <TableHead className="text-right">Profit</TableHead>
                          <TableHead className="text-right">Margin</TableHead>
                          <TableHead className="text-right">Due</TableHead>
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
                          <TableCell className="text-right font-bold text-muted-foreground">
                            LKR {fmt(custTotals.cost)}
                          </TableCell>
                          <TableCell className={`text-right font-bold ${custTotals.profit >= 0 ? "text-green-700" : "text-red-700"}`}>
                            LKR {fmt(custTotals.profit)}
                          </TableCell>
                          <TableCell className="text-right text-xs font-bold">
                            {custTotals.revenue > 0 ? ((custTotals.profit / custTotals.revenue) * 100).toFixed(1) : "0.0"}%
                          </TableCell>
                          <TableCell className="text-right text-red-600 font-bold">
                            LKR {fmt(custTotals.dueAmount)}
                          </TableCell>
                        </TableRow>
                        {filteredCustomers.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={7} className="text-center text-muted-foreground text-xs py-8">
                              No customers found
                            </TableCell>
                          </TableRow>
                        ) : (
                          filteredCustomers.map((c: any) => (
                            <TableRow key={c.id} className="text-xs">
                              <TableCell className="font-medium">{c.name}</TableCell>
                              <TableCell className="text-right">{c.invoiceCount}</TableCell>
                              <TableCell className="text-right text-blue-700 font-medium">
                                LKR {fmt(c.revenue)}
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
                              <TableCell className={`text-right font-medium ${c.dueAmount > 0 ? "text-red-600" : "text-muted-foreground"}`}>
                                {c.dueAmount > 0 ? `LKR ${fmt(c.dueAmount)}` : "—"}
                              </TableCell>
                            </TableRow>
                          ))
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
                          <TableHead className="text-right">Cost</TableHead>
                          <TableHead className="text-right">Profit</TableHead>
                          <TableHead className="text-right">Margin</TableHead>
                          <TableHead className="text-right">Due Amount</TableHead>
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
                          <TableCell className="text-right font-bold text-muted-foreground">
                            LKR {fmt(repTotals.cost)}
                          </TableCell>
                          <TableCell className={`text-right font-bold ${repTotals.profit >= 0 ? "text-green-700" : "text-red-700"}`}>
                            LKR {fmt(repTotals.profit)}
                          </TableCell>
                          <TableCell className="text-right text-xs font-bold">
                            {repTotals.revenue > 0 ? ((repTotals.profit / repTotals.revenue) * 100).toFixed(1) : "0.0"}%
                          </TableCell>
                          <TableCell className="text-right text-red-600 font-bold">
                            LKR {fmt(repTotals.dueAmount)}
                          </TableCell>
                        </TableRow>
                        {filteredReps.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={7} className="text-center text-muted-foreground text-xs py-8">
                              No representatives found
                            </TableCell>
                          </TableRow>
                        ) : (
                          filteredReps.map((r: any) => {
                            const isDirect = r.name === "Champika Hardware";
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
                                <TableCell className="text-right text-muted-foreground">
                                  LKR {fmt(r.cost)}
                                </TableCell>
                                <TableCell className={`text-right font-medium ${r.profit >= 0 ? "text-green-700" : "text-red-700"}`}>
                                  LKR {fmt(r.profit)}
                                </TableCell>
                                <TableCell className="text-right text-muted-foreground">
                                  {r.margin.toFixed(1)}%
                                </TableCell>
                                <TableCell className={`text-right font-medium ${r.dueAmount > 0 ? "text-red-600" : "text-muted-foreground"}`}>
                                  {r.dueAmount > 0 ? `LKR ${fmt(r.dueAmount)}` : "—"}
                                </TableCell>
                              </TableRow>
                            );
                          })
                        )}
                      </TableBody>
                    </Table>
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
