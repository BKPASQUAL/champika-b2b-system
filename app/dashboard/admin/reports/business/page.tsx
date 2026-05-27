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
  ShoppingCart,
} from "lucide-react";
import { toast } from "sonner";
import { BUSINESS_THEMES, BUSINESS_IDS } from "@/app/config/business-constants";

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884D8"];

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

function getBizColor(bizId: string): string {
  const theme = BUSINESS_THEMES[bizId as keyof typeof BUSINESS_THEMES];
  if (!theme) return "text-gray-600";
  return theme.textClass;
}
function getBizBg(bizId: string): string {
  const theme = BUSINESS_THEMES[bizId as keyof typeof BUSINESS_THEMES];
  if (!theme) return "bg-gray-100";
  return theme.bgClass;
}

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

  // Chart data: compare all businesses by revenue
  const revenueChartData = useMemo(
    () => businesses.map((b) => ({
      name: b.name.replace("Champika Hardware - ", "CH ").replace(" Agency", ""),
      revenue: b.totalRevenue,
      profit: b.totalProfit,
      due: b.dueAmount,
    })),
    [businesses]
  );

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
      {/* Overall entry */}
      <li>
        <button
          onClick={() => { setSelectedId("overall"); setSheetOpen(false); }}
          className={`w-full text-left px-4 py-3 flex items-center justify-between hover:bg-muted/50 transition-colors border-b ${
            selectedId === "overall" ? "bg-primary/5 border-l-2 border-l-primary" : ""
          }`}
        >
          <div className="min-w-0">
            <p className="text-xs font-semibold">Overall</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              All businesses combined
            </p>
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

      {/* ── Desktop Sidebar ──────────────────────────────────────── */}
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

      {/* ── Mobile top bar ────────────────────────────── */}
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

      {/* ── Main Content ───────────────────────────────────────────── */}
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
                  {current.invoiceCount} invoices · {current.customerCount} customers
                </p>
              </div>
              {!isOverall && (
                <Badge variant="outline" className={`${getBizColor(current.id)} border-current`}>
                  {current.margin.toFixed(1)}% margin
                </Badge>
              )}
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
              <Card className="bg-blue-50 border-blue-200">
                <CardHeader className="pb-1 pt-3 px-3 md:px-4">
                  <CardTitle className="text-[10px] md:text-xs text-blue-700 font-medium flex items-center gap-1">
                    <DollarSign className="h-3 w-3" /> Total Sales
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-3 md:px-4 pb-3 md:pb-4">
                  <div className="text-sm md:text-xl font-bold text-blue-700">
                    LKR {fmt(current.totalRevenue)}
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {fmt(current.totalUnits)} units sold
                  </p>
                </CardContent>
              </Card>

              <Card className={current.totalProfit >= 0 ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}>
                <CardHeader className="pb-1 pt-3 px-3 md:px-4">
                  <CardTitle className={`text-[10px] md:text-xs font-medium flex items-center gap-1 ${current.totalProfit >= 0 ? "text-green-700" : "text-red-700"}`}>
                    <TrendingUp className="h-3 w-3" /> Total Profit
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-3 md:px-4 pb-3 md:pb-4">
                  <div className={`text-sm md:text-xl font-bold ${current.totalProfit >= 0 ? "text-green-700" : "text-red-700"}`}>
                    LKR {fmt(current.totalProfit)}
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {current.margin.toFixed(1)}% margin
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-red-50 border-red-200">
                <CardHeader className="pb-1 pt-3 px-3 md:px-4">
                  <CardTitle className="text-[10px] md:text-xs text-red-700 font-medium flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" /> Due Invoices
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-3 md:px-4 pb-3 md:pb-4">
                  <div className="text-sm md:text-xl font-bold text-red-700">
                    LKR {fmt(current.dueAmount)}
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">outstanding balance</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-1 pt-3 px-3 md:px-4">
                  <CardTitle className="text-[10px] md:text-xs text-muted-foreground font-medium flex items-center gap-1">
                    <Users className="h-3 w-3" /> Customers
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-3 md:px-4 pb-3 md:pb-4">
                  <div className="text-lg md:text-xl font-bold">
                    {fmt(current.customerCount)}
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {fmt(current.invoiceCount)} invoices
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Overall: comparison charts */}
            {isOverall && (
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
            )}

            {/* Summary table — all businesses side by side when Overall selected */}
            {isOverall ? (
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
                        {/* Totals row */}
                        <TableRow className="border-t-2 font-bold bg-muted/20">
                          <TableCell>Total</TableCell>
                          <TableCell className="text-right text-blue-700">
                            LKR {fmt(overall?.totalRevenue || 0)}
                          </TableCell>
                          <TableCell className={`text-right ${(overall?.totalProfit || 0) >= 0 ? "text-green-700" : "text-red-700"}`}>
                            LKR {fmt(overall?.totalProfit || 0)}
                          </TableCell>
                          <TableCell className="text-right text-xs">
                            {overall?.margin.toFixed(1)}%
                          </TableCell>
                          <TableCell className="text-right text-red-600">
                            LKR {fmt(overall?.dueAmount || 0)}
                          </TableCell>
                          <TableCell className="text-right">{overall?.invoiceCount}</TableCell>
                          <TableCell className="text-right">{overall?.customerCount}</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            ) : (
              /* Individual business: due vs sales bar chart */
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
          </>
        )}
      </div>
    </div>
  );
}
