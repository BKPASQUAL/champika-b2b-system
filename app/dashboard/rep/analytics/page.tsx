"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  DollarSign,
  TrendingUp,
  Calendar,
  Loader2,
  RefreshCw,
  Search,
  FileText,
  Award,
  Factory,
  Package,
  Banknote,
  Clock,
  ShoppingCart,
  Percent,
} from "lucide-react";
import { toast } from "sonner";
import { TablePagination } from "@/components/ui/TablePagination";

const fmt = (n: number) =>
  n.toLocaleString("en-LK", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

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

function RateBadge({ rate }: { rate: number }) {
  const color =
    rate >= 10 ? "bg-green-100 text-green-700 border-green-200" :
    rate >= 5  ? "bg-blue-100 text-blue-700 border-blue-200" :
    rate >= 2  ? "bg-yellow-100 text-yellow-700 border-yellow-200" :
                 "bg-gray-100 text-gray-600 border-gray-200";
  return (
    <span className={`inline-flex items-center gap-0.5 text-[11px] font-semibold px-1.5 py-0.5 rounded border ${color}`}>
      {rate}%
    </span>
  );
}

export default function RepPortalAnalyticsPage() {
  const todayStr = new Date().toISOString().split("T")[0];
  const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    .toISOString().split("T")[0];

  const [quickSelect, setQuickSelect] = useState("this-month");
  const [customFrom, setCustomFrom] = useState(firstOfMonth);
  const [customTo, setCustomTo] = useState(todayStr);
  const [loading, setLoading] = useState(true);

  const [repData, setRepData] = useState<any>(null);
  const [repId, setRepId] = useState<string>("");

  const [invoiceSearch, setInvoiceSearch] = useState("");
  const [supplierSearch, setSupplierSearch] = useState("");
  const [categorySearch, setCategorySearch] = useState("");

  const PER_PAGE = 10;
  const [invoicePage, setInvoicePage] = useState(1);

  const fetchAnalytics = async (id: string) => {
    if (!id) return;
    setLoading(true);
    try {
      const { from, to } = getRange(quickSelect, customFrom, customTo);
      const res = await fetch(`/api/rep/analytics?repId=${id}&from=${from}&to=${to}&_t=${Date.now()}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load analytics");
      const data = await res.json();
      setRepData(data);
    } catch {
      toast.error("Failed to fetch rep sales analytics");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = localStorage.getItem("currentUser");
      if (stored) {
        const user = JSON.parse(stored);
        setRepId(user.id);
        if (quickSelect !== "custom") {
          fetchAnalytics(user.id);
        }
      }
    } catch {
      setLoading(false);
    }
  }, [quickSelect]);

  const handleCustomApply = () => {
    if (!customFrom || !customTo || !repId) return;
    fetchAnalytics(repId);
  };

  const filteredInvoices = useMemo(() => {
    if (!repData?.invoices) return [];
    const q = invoiceSearch.toLowerCase();
    if (!q) return repData.invoices;
    return repData.invoices.filter(
      (inv: any) =>
        inv.invoiceNo.toLowerCase().includes(q) ||
        inv.customer.toLowerCase().includes(q) ||
        inv.date.includes(q)
    );
  }, [repData, invoiceSearch]);

  const pagedInvoices = useMemo(() => {
    return filteredInvoices.slice((invoicePage - 1) * PER_PAGE, invoicePage * PER_PAGE);
  }, [filteredInvoices, invoicePage]);

  const filteredSuppliers = useMemo(() => {
    if (!repData?.supplierSales) return [];
    const q = supplierSearch.toLowerCase();
    if (!q) return repData.supplierSales;
    return repData.supplierSales.filter((s: any) =>
      s.name.toLowerCase().includes(q)
    );
  }, [repData, supplierSearch]);

  const filteredCategories = useMemo(() => {
    if (!repData?.categorySales) return [];
    const q = categorySearch.toLowerCase();
    if (!q) return repData.categorySales;
    return repData.categorySales.filter(
      (c: any) =>
        c.supplier.toLowerCase().includes(q) ||
        c.category.toLowerCase().includes(q) ||
        (c.subCategory && c.subCategory.toLowerCase().includes(q))
    );
  }, [repData, categorySearch]);

  const stats = repData?.stats || {
    totalSales: 0,
    totalCollections: 0,
    totalDue: 0,
    commissionEarned: 0,
    commissionPending: 0,
  };

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Sales Analytics</h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Your supplier & category wise performance and earnings
          </p>
        </div>

        {/* Date Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <Select value={quickSelect} onValueChange={setQuickSelect}>
            <SelectTrigger className="w-36 sm:w-44 h-8 text-xs">
              <Calendar className="mr-1.5 h-3.5 w-3.5 text-muted-foreground" />
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
            <div className="flex items-center gap-1.5">
              <Input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="h-8 text-xs w-32"
              />
              <Input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="h-8 text-xs w-32"
              />
              <Button size="sm" className="h-8 px-2.5 text-xs" onClick={handleCustomApply} disabled={loading}>
                Apply
              </Button>
            </div>
          )}

          <Button
            variant="outline"
            size="icon"
            onClick={() => fetchAnalytics(repId)}
            disabled={loading}
            className="h-8 w-8"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <Card>
          <CardHeader className="pb-1 pt-3.5 px-4">
            <CardTitle className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
              <DollarSign className="h-3.5 w-3.5 text-primary" /> My Total Sales
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {loading ? (
              <div className="h-7 w-28 bg-muted/40 rounded animate-pulse" />
            ) : (
              <div className="text-lg sm:text-xl font-bold">LKR {fmt(stats.totalSales)}</div>
            )}
            <p className="text-[10px] text-muted-foreground mt-0.5">Delivered orders</p>
          </CardContent>
        </Card>

        <Card className="bg-green-50/50 border-green-200">
          <CardHeader className="pb-1 pt-3.5 px-4">
            <CardTitle className="text-xs text-green-700 font-medium flex items-center gap-1.5">
              <Banknote className="h-3.5 w-3.5" /> Collections
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {loading ? (
              <div className="h-7 w-28 bg-muted/40 rounded animate-pulse" />
            ) : (
              <div className="text-lg sm:text-xl font-bold text-green-700">LKR {fmt(stats.totalCollections)}</div>
            )}
            <p className="text-[10px] text-muted-foreground mt-0.5">Payments received</p>
          </CardContent>
        </Card>

        <Card className="bg-purple-50/50 border-purple-200">
          <CardHeader className="pb-1 pt-3.5 px-4">
            <CardTitle className="text-xs text-purple-700 font-medium flex items-center gap-1.5">
              <Award className="h-3.5 w-3.5" /> Comm. Earned
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {loading ? (
              <div className="h-7 w-28 bg-muted/40 rounded animate-pulse" />
            ) : (
              <div className="text-lg sm:text-xl font-bold text-purple-700">LKR {fmt(stats.commissionEarned)}</div>
            )}
            <p className="text-[10px] text-muted-foreground mt-0.5">Paid within 60d</p>
          </CardContent>
        </Card>

        <Card className="bg-amber-50/50 border-amber-200">
          <CardHeader className="pb-1 pt-3.5 px-4">
            <CardTitle className="text-xs text-amber-700 font-medium flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" /> Outstanding Due
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {loading ? (
              <div className="h-7 w-28 bg-muted/40 rounded animate-pulse" />
            ) : (
              <div className="text-lg sm:text-xl font-bold text-amber-700">LKR {fmt(stats.totalDue)}</div>
            )}
            <p className="text-[10px] text-muted-foreground mt-0.5">Uncollected total</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs Container */}
      <Card>
        <CardContent className="p-0">
          <Tabs defaultValue="suppliers">
            <div className="border-b px-4 py-2.5 overflow-x-auto">
              <TabsList className="bg-transparent gap-2 h-auto p-1">
                <TabsTrigger
                  value="suppliers"
                  className="data-[state=active]:bg-black data-[state=active]:text-white text-gray-800 hover:bg-gray-100/80 rounded-xl px-4 py-2 text-xs font-semibold gap-2 transition-all flex items-center whitespace-nowrap border border-transparent data-[state=active]:border-black shadow-none data-[state=active]:shadow-sm"
                >
                  <Factory className="h-4 w-4 shrink-0" />
                  <span>Supplier Sales</span>
                  <span className="text-sky-500 font-bold ml-0.5">({repData?.supplierSales?.length || 0})</span>
                </TabsTrigger>
                <TabsTrigger
                  value="categories"
                  className="data-[state=active]:bg-black data-[state=active]:text-white text-gray-800 hover:bg-gray-100/80 rounded-xl px-4 py-2 text-xs font-semibold gap-2 transition-all flex items-center whitespace-nowrap border border-transparent data-[state=active]:border-black shadow-none data-[state=active]:shadow-sm"
                >
                  <Package className="h-4 w-4 shrink-0" />
                  <span>Category Sales</span>
                  <span className="text-sky-500 font-bold ml-0.5">({repData?.categorySales?.length || 0})</span>
                </TabsTrigger>
                <TabsTrigger
                  value="invoices"
                  className="data-[state=active]:bg-black data-[state=active]:text-white text-gray-800 hover:bg-gray-100/80 rounded-xl px-4 py-2 text-xs font-semibold gap-2 transition-all flex items-center whitespace-nowrap border border-transparent data-[state=active]:border-black shadow-none data-[state=active]:shadow-sm"
                >
                  <FileText className="h-4 w-4 shrink-0" />
                  <span>Invoices</span>
                  <span className="text-sky-500 font-bold ml-0.5">({repData?.invoices?.length || 0})</span>
                </TabsTrigger>
              </TabsList>
            </div>

            {/* ── Supplier Breakdown Tab ── */}
            <TabsContent value="suppliers" className="mt-0 p-4 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Search supplier name..."
                    value={supplierSearch}
                    onChange={(e) => setSupplierSearch(e.target.value)}
                    className="pl-8 h-8 text-xs"
                  />
                </div>
                <Badge variant="outline" className="w-fit text-xs font-semibold bg-muted/30">
                  Total Supplier Sales: LKR {fmt(stats.totalSales)}
                </Badge>
              </div>

              {/* Mobile Card List */}
              <div className="sm:hidden divide-y border rounded-lg overflow-hidden bg-white">
                {loading ? (
                  <p className="text-center py-8 text-xs text-muted-foreground">Loading supplier sales...</p>
                ) : filteredSuppliers.length === 0 ? (
                  <p className="text-center py-8 text-xs text-muted-foreground">No supplier sales recorded.</p>
                ) : (
                  filteredSuppliers.map((s: any) => (
                    <div key={s.name} className="p-3.5 space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="font-semibold text-sm">{s.name}</p>
                        <RateBadge rate={parseFloat(s.rate.toFixed(1))} />
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div>
                          <p className="text-[10px] text-muted-foreground">Qty Sold</p>
                          <p className="font-medium">{s.itemsCount ?? 0} pcs</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground">Sales Total</p>
                          <p className="font-semibold text-primary">LKR {fmt(s.sales)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground">Commission</p>
                          <p className="font-semibold text-purple-600">LKR {fmt(s.commission)}</p>
                        </div>
                      </div>
                      <div className="space-y-1 pt-1 border-t">
                        <div className="flex justify-between text-[10px] text-muted-foreground">
                          <span>Share of My Total Sales</span>
                          <span className="font-medium">{(s.sharePct || 0).toFixed(1)}%</span>
                        </div>
                        <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-black rounded-full" style={{ width: `${s.sharePct || 0}%` }} />
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Desktop Table */}
              <div className="hidden sm:block border rounded-lg overflow-hidden bg-white">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40">
                      <TableHead className="font-semibold">Supplier Name</TableHead>
                      <TableHead className="text-right font-semibold">Qty Sold</TableHead>
                      <TableHead className="text-right font-semibold">Total Sales (LKR)</TableHead>
                      <TableHead className="text-right font-semibold">Comm. Earned (LKR)</TableHead>
                      <TableHead className="text-right font-semibold">Comm. Rate</TableHead>
                      <TableHead className="w-48 text-right font-semibold">Sales Share %</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center h-24 text-muted-foreground text-sm">
                          Loading supplier analytics…
                        </TableCell>
                      </TableRow>
                    ) : filteredSuppliers.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center h-24 text-muted-foreground text-sm">
                          No supplier sales records found.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredSuppliers.map((s: any) => (
                        <TableRow key={s.name} className="hover:bg-muted/30">
                          <TableCell className="font-medium text-xs">{s.name}</TableCell>
                          <TableCell className="text-right text-xs font-mono">{s.itemsCount ?? 0} pcs</TableCell>
                          <TableCell className="text-right text-xs font-semibold text-foreground">LKR {fmt(s.sales)}</TableCell>
                          <TableCell className="text-right text-xs font-semibold text-purple-600">LKR {fmt(s.commission)}</TableCell>
                          <TableCell className="text-right text-xs">
                            <RateBadge rate={parseFloat(s.rate.toFixed(1))} />
                          </TableCell>
                          <TableCell className="text-right text-xs">
                            <div className="flex items-center justify-end gap-2">
                              <span className="text-[11px] font-medium w-10 text-right">{(s.sharePct || 0).toFixed(1)}%</span>
                              <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                                <div className="h-full bg-black rounded-full" style={{ width: `${s.sharePct || 0}%` }} />
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                  {/* Rep Grand Total Footer */}
                  {repData?.supplierSales?.length > 0 && (
                    <tfoot className="bg-muted/20 font-bold border-t-2">
                      <TableRow>
                        <TableCell className="text-xs font-bold text-foreground">
                          My Grand Total ({repData.supplierSales.length} Suppliers)
                        </TableCell>
                        <TableCell className="text-right text-xs font-bold font-mono">
                          {repData.supplierSales.reduce((s: number, r: any) => s + (r.itemsCount || 0), 0)} pcs
                        </TableCell>
                        <TableCell className="text-right text-xs font-bold text-black">
                          LKR {fmt(stats.totalSales)}
                        </TableCell>
                        <TableCell className="text-right text-xs font-bold text-purple-700">
                          LKR {fmt(stats.commissionEarned)}
                        </TableCell>
                        <TableCell className="text-right text-xs text-muted-foreground">—</TableCell>
                        <TableCell className="text-right text-xs font-bold text-black">100.0%</TableCell>
                      </TableRow>
                    </tfoot>
                  )}
                </Table>
              </div>
            </TabsContent>

            {/* ── Category Breakdown Tab ── */}
            <TabsContent value="categories" className="mt-0 p-4 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Search category / supplier..."
                    value={categorySearch}
                    onChange={(e) => setCategorySearch(e.target.value)}
                    className="pl-8 h-8 text-xs"
                  />
                </div>
                <Badge variant="outline" className="w-fit text-xs font-semibold bg-muted/30">
                  Total Category Sales: LKR {fmt(stats.totalSales)}
                </Badge>
              </div>

              {/* Mobile Category List */}
              <div className="sm:hidden divide-y border rounded-lg overflow-hidden bg-white">
                {loading ? (
                  <p className="text-center py-8 text-xs text-muted-foreground">Loading category sales...</p>
                ) : filteredCategories.length === 0 ? (
                  <p className="text-center py-8 text-xs text-muted-foreground">No category sales recorded.</p>
                ) : (
                  filteredCategories.map((c: any, idx: number) => (
                    <div key={idx} className="p-3.5 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold text-sm">{c.category}</p>
                          {c.subCategory && <p className="text-xs text-muted-foreground">{c.subCategory}</p>}
                          <p className="text-[10px] text-primary font-medium">{c.supplier}</p>
                        </div>
                        <RateBadge rate={parseFloat(c.rate.toFixed(1))} />
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div>
                          <p className="text-[10px] text-muted-foreground">Qty Sold</p>
                          <p className="font-medium">{c.itemsCount ?? 0} pcs</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground">Sales Total</p>
                          <p className="font-semibold text-primary">LKR {fmt(c.sales)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground">Commission</p>
                          <p className="font-semibold text-purple-600">LKR {fmt(c.commission)}</p>
                        </div>
                      </div>
                      <div className="space-y-1 pt-1 border-t">
                        <div className="flex justify-between text-[10px] text-muted-foreground">
                          <span>Share of My Total Sales</span>
                          <span className="font-medium">{(c.sharePct || 0).toFixed(1)}%</span>
                        </div>
                        <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-indigo-600 rounded-full" style={{ width: `${c.sharePct || 0}%` }} />
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Desktop Category Table */}
              <div className="hidden sm:block border rounded-lg overflow-hidden bg-white">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40">
                      <TableHead className="font-semibold">Supplier</TableHead>
                      <TableHead className="font-semibold">Category</TableHead>
                      <TableHead className="font-semibold">Sub-Category</TableHead>
                      <TableHead className="text-right font-semibold">Qty Sold</TableHead>
                      <TableHead className="text-right font-semibold">Total Sales (LKR)</TableHead>
                      <TableHead className="text-right font-semibold">Comm. Earned (LKR)</TableHead>
                      <TableHead className="text-right font-semibold">Rate</TableHead>
                      <TableHead className="w-44 text-right font-semibold">Sales Share %</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center h-24 text-muted-foreground text-sm">
                          Loading category analytics…
                        </TableCell>
                      </TableRow>
                    ) : filteredCategories.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center h-24 text-muted-foreground text-sm">
                          No category sales records found.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredCategories.map((c: any, idx: number) => (
                        <TableRow key={idx} className="hover:bg-muted/30">
                          <TableCell className="text-xs text-muted-foreground">{c.supplier}</TableCell>
                          <TableCell className="font-medium text-xs">{c.category}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{c.subCategory || "—"}</TableCell>
                          <TableCell className="text-right text-xs font-mono">{c.itemsCount ?? 0} pcs</TableCell>
                          <TableCell className="text-right text-xs font-semibold text-foreground">LKR {fmt(c.sales)}</TableCell>
                          <TableCell className="text-right text-xs font-semibold text-purple-600">LKR {fmt(c.commission)}</TableCell>
                          <TableCell className="text-right text-xs">
                            <RateBadge rate={parseFloat(c.rate.toFixed(1))} />
                          </TableCell>
                          <TableCell className="text-right text-xs">
                            <div className="flex items-center justify-end gap-2">
                              <span className="text-[11px] font-medium w-10 text-right">{(c.sharePct || 0).toFixed(1)}%</span>
                              <div className="w-20 h-2 bg-muted rounded-full overflow-hidden">
                                <div className="h-full bg-indigo-600 rounded-full" style={{ width: `${c.sharePct || 0}%` }} />
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                  {/* Rep Grand Total Footer */}
                  {repData?.categorySales?.length > 0 && (
                    <tfoot className="bg-indigo-50/60 font-bold border-t-2 border-indigo-200">
                      <TableRow>
                        <TableCell colSpan={3} className="text-xs text-indigo-950 font-bold">
                          My Grand Total ({repData.categorySales.length} Categories)
                        </TableCell>
                        <TableCell className="text-right text-xs font-bold font-mono">
                          {repData.categorySales.reduce((s: number, r: any) => s + (r.itemsCount || 0), 0)} pcs
                        </TableCell>
                        <TableCell className="text-right text-xs font-bold text-indigo-950">
                          LKR {fmt(stats.totalSales)}
                        </TableCell>
                        <TableCell className="text-right text-xs font-bold text-purple-700">
                          LKR {fmt(stats.commissionEarned)}
                        </TableCell>
                        <TableCell className="text-right text-xs text-muted-foreground">—</TableCell>
                        <TableCell className="text-right text-xs font-bold text-indigo-950">100.0%</TableCell>
                      </TableRow>
                    </tfoot>
                  )}
                </Table>
              </div>
            </TabsContent>

            {/* ── Invoices Tab ── */}
            <TabsContent value="invoices" className="mt-0 p-4 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Search invoice or customer..."
                    value={invoiceSearch}
                    onChange={(e) => setInvoiceSearch(e.target.value)}
                    className="pl-8 h-8 text-xs"
                  />
                </div>
              </div>

              {/* Mobile Invoice List */}
              <div className="sm:hidden divide-y border rounded-lg overflow-hidden bg-white">
                {pagedInvoices.length === 0 ? (
                  <p className="text-center py-8 text-xs text-muted-foreground">No invoices found.</p>
                ) : (
                  pagedInvoices.map((inv: any) => (
                    <div key={inv.orderId} className="p-3.5 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold text-sm">{inv.invoiceNo}</p>
                          <p className="text-xs text-muted-foreground">{inv.date} · {inv.customer}</p>
                        </div>
                        <Badge
                          variant="secondary"
                          className={inv.isPaid ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}
                        >
                          {inv.isPaid ? "Paid" : inv.paid > 0 ? "Partial" : "Unpaid"}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div>
                          <p className="text-[10px] text-muted-foreground">Total</p>
                          <p className="font-medium">LKR {fmt(inv.total)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground">Paid</p>
                          <p className="font-medium text-green-600">LKR {fmt(inv.paid)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground">Due</p>
                          <p className={`font-medium ${inv.due > 0 ? "text-red-600" : "text-muted-foreground"}`}>
                            {inv.due > 0 ? `LKR ${fmt(inv.due)}` : "—"}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Desktop Invoice Table */}
              <div className="hidden sm:block border rounded-lg overflow-hidden bg-white">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40">
                      <TableHead>Invoice No</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead className="text-right">Total (LKR)</TableHead>
                      <TableHead className="text-right">Paid (LKR)</TableHead>
                      <TableHead className="text-right">Due (LKR)</TableHead>
                      <TableHead className="text-right">Commission</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagedInvoices.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center h-24 text-muted-foreground text-sm">
                          No invoices found.
                        </TableCell>
                      </TableRow>
                    ) : (
                      pagedInvoices.map((inv: any) => (
                        <TableRow key={inv.orderId} className="hover:bg-muted/30">
                          <TableCell className="font-mono text-xs font-semibold">{inv.invoiceNo}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{inv.date}</TableCell>
                          <TableCell className="text-xs font-medium">{inv.customer}</TableCell>
                          <TableCell className="text-right text-xs font-semibold">LKR {fmt(inv.total)}</TableCell>
                          <TableCell className="text-right text-xs text-green-600">LKR {fmt(inv.paid)}</TableCell>
                          <TableCell className={`text-right text-xs ${inv.due > 0 ? "text-red-600 font-semibold" : "text-muted-foreground"}`}>
                            {inv.due > 0 ? `LKR ${fmt(inv.due)}` : "—"}
                          </TableCell>
                          <TableCell className="text-right text-xs font-semibold text-purple-600">
                            {inv.commission > 0 ? `LKR ${fmt(inv.commission)}` : "—"}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              <TablePagination
                currentPage={invoicePage}
                totalPages={Math.ceil(filteredInvoices.length / PER_PAGE)}
                onPageChange={setInvoicePage}
                totalItems={filteredInvoices.length}
                itemsPerPage={PER_PAGE}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
