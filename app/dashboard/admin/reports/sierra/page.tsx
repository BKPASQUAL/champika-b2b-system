"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  TrendingDown,
  Percent,
  Receipt,
  Loader2,
  RefreshCw,
  Calendar,
  Building2,
  ShoppingCart,
  Users,
  CreditCard,
  AlertCircle,
  BarChart3,
  FileText,
} from "lucide-react";
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { toast } from "sonner";

// ── Constants ──────────────────────────────────────────────────────────────
const PIE_COLORS = [
  "#0ea5e9", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6",
  "#ec4899", "#14b8a6", "#f97316", "#64748b", "#a3e635",
  "#06b6d4", "#d946ef",
];

// ── Helpers ────────────────────────────────────────────────────────────────
const fmt = (n: number) =>
  new Intl.NumberFormat("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

function getRange(quickSelect: string, customFrom: string, customTo: string) {
  const now = new Date();
  let from: Date, to: Date;

  switch (quickSelect) {
    case "last-7":
      from = new Date(now); from.setDate(now.getDate() - 6); from.setHours(0, 0, 0, 0);
      to = new Date(now); to.setHours(23, 59, 59, 999);
      break;
    case "last-30":
      from = new Date(now); from.setDate(now.getDate() - 29); from.setHours(0, 0, 0, 0);
      to = new Date(now); to.setHours(23, 59, 59, 999);
      break;
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
    case "custom":
      from = new Date(customFrom); from.setHours(0, 0, 0, 0);
      to = new Date(customTo); to.setHours(23, 59, 59, 999);
      break;
    default:
      from = new Date(now); from.setDate(now.getDate() - 29); from.setHours(0, 0, 0, 0);
      to = new Date(now); to.setHours(23, 59, 59, 999);
  }
  return { from: from.toISOString(), to: to.toISOString() };
}

// ── Component ──────────────────────────────────────────────────────────────
export default function SierraReportPage() {
  const today = new Date().toISOString().split("T")[0];
  const thirtyDaysAgo = new Date(Date.now() - 29 * 864e5).toISOString().split("T")[0];

  const [quickSelect, setQuickSelect] = useState("last-30");
  const [customFrom, setCustomFrom] = useState(thirtyDaysAgo);
  const [customTo, setCustomTo] = useState(today);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const { from, to } = getRange(quickSelect, customFrom, customTo);
      const res = await fetch(`/api/reports/sierra?from=${from}&to=${to}`);
      if (!res.ok) throw new Error("Failed to fetch Sierra report");
      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load Sierra report");
    } finally {
      setLoading(false);
    }
  }, [quickSelect, customFrom, customTo]);

  useEffect(() => {
    if (quickSelect !== "custom") fetchReport();
  }, [quickSelect]);

  // Derived
  const overview = data?.overview ?? {
    totalSales: 0, orderCount: 0, totalProfit: 0, totalCost: 0,
    profitMargin: 0, totalExpenses: 0, expenseCount: 0,
  };

  return (
    <div className="space-y-5 p-2 sm:p-4 lg:p-6">
      {/* ── Page Title ──────────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Sierra Agency</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Profit analysis, sales performance, and financial overview
        </p>
      </div>

      {/* ── Report Filters Card ─────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Calendar className="h-4 w-4 text-purple-600" />
            Report Filters
          </CardTitle>
          <p className="text-xs text-muted-foreground">Select date range and report type</p>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-end">
            {/* Quick Select */}
            <div className="flex flex-col gap-1 w-full sm:w-auto">
              <label className="text-xs font-medium text-muted-foreground">Quick Select</label>
              <Select
                value={quickSelect}
                onValueChange={(v) => {
                  setQuickSelect(v);
                  if (v !== "custom") {
                    const { from, to } = getRange(v, customFrom, customTo);
                    setCustomFrom(from.split("T")[0]);
                    setCustomTo(to.split("T")[0]);
                  }
                }}
              >
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="last-7">Last 7 Days</SelectItem>
                  <SelectItem value="last-30">Last 30 Days</SelectItem>
                  <SelectItem value="this-month">This Month</SelectItem>
                  <SelectItem value="last-month">Last Month</SelectItem>
                  <SelectItem value="this-year">This Year</SelectItem>
                  <SelectItem value="custom">Custom Range</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* From Date */}
            <div className="flex flex-col gap-1 w-full sm:w-auto">
              <label className="text-xs font-medium text-muted-foreground">From Date</label>
              <Input
                type="date"
                value={customFrom}
                onChange={(e) => {
                  setCustomFrom(e.target.value);
                  setQuickSelect("custom");
                }}
                className="w-full sm:w-[150px]"
              />
            </div>

            {/* To Date */}
            <div className="flex flex-col gap-1 w-full sm:w-auto">
              <label className="text-xs font-medium text-muted-foreground">To Date</label>
              <Input
                type="date"
                value={customTo}
                onChange={(e) => {
                  setCustomTo(e.target.value);
                  setQuickSelect("custom");
                }}
                className="w-full sm:w-[150px]"
              />
            </div>

            {/* Refresh Button */}
            <Button
              onClick={fetchReport}
              disabled={loading}
              className="w-full sm:w-auto bg-slate-900 hover:bg-slate-800 text-white gap-2"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Refresh Report
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── KPI Cards ───────────────────────────────────────────────────────── */}
      {loading && !data ? (
        <div className="flex justify-center items-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Sales */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Sales</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-xl sm:text-2xl font-bold">
                  LKR {fmt(overview.totalSales)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {overview.orderCount} orders
                </p>
              </CardContent>
            </Card>

            {/* Total Profit */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Profit</CardTitle>
                <TrendingUp className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className={`text-xl sm:text-2xl font-bold ${overview.totalProfit >= 0 ? "text-green-600" : "text-red-600"}`}>
                  LKR {fmt(overview.totalProfit)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Cost: LKR {fmt(overview.totalCost)}
                </p>
              </CardContent>
            </Card>

            {/* Profit Margin */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Profit Margin</CardTitle>
                <Percent className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className={`text-xl sm:text-2xl font-bold ${overview.profitMargin >= 10 ? "text-green-600" : overview.profitMargin >= 5 ? "text-amber-600" : "text-red-600"}`}>
                  {overview.profitMargin.toFixed(2)}%
                </div>
                <p className="text-xs text-muted-foreground mt-1">Average margin</p>
              </CardContent>
            </Card>

            {/* Total Expenses */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
                <Receipt className="h-4 w-4 text-red-500" />
              </CardHeader>
              <CardContent>
                <div className="text-xl sm:text-2xl font-bold text-red-600">
                  LKR {fmt(overview.totalExpenses)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {overview.expenseCount} expenses
                </p>
              </CardContent>
            </Card>
          </div>

          {/* ── Tabs ──────────────────────────────────────────────────────────── */}
          <Tabs defaultValue="company" className="space-y-4">
            <div className="overflow-x-auto pb-1">
              <TabsList className="inline-flex w-auto min-w-full sm:min-w-0 sm:w-full sm:grid sm:grid-cols-7">
                <TabsTrigger value="company" className="flex items-center gap-1.5 text-xs sm:text-sm">
                  <Building2 className="h-3.5 w-3.5 hidden sm:block" />Company
                </TabsTrigger>
                <TabsTrigger value="profit" className="flex items-center gap-1.5 text-xs sm:text-sm">
                  <TrendingUp className="h-3.5 w-3.5 hidden sm:block" />Profit
                </TabsTrigger>
                <TabsTrigger value="orders" className="flex items-center gap-1.5 text-xs sm:text-sm">
                  <ShoppingCart className="h-3.5 w-3.5 hidden sm:block" />Orders
                </TabsTrigger>
                <TabsTrigger value="customers" className="flex items-center gap-1.5 text-xs sm:text-sm">
                  <Users className="h-3.5 w-3.5 hidden sm:block" />Customers
                </TabsTrigger>
                <TabsTrigger value="expenses" className="flex items-center gap-1.5 text-xs sm:text-sm">
                  <Receipt className="h-3.5 w-3.5 hidden sm:block" />Expenses
                </TabsTrigger>
                <TabsTrigger value="due" className="flex items-center gap-1.5 text-xs sm:text-sm">
                  <AlertCircle className="h-3.5 w-3.5 hidden sm:block" />Due
                </TabsTrigger>
                <TabsTrigger value="summary" className="flex items-center gap-1.5 text-xs sm:text-sm">
                  <BarChart3 className="h-3.5 w-3.5 hidden sm:block" />Summary
                </TabsTrigger>
              </TabsList>
            </div>

            {/* ── Company Tab: Month-wise Distribution ─────────────────────── */}
            <TabsContent value="company">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Month-wise Distribution Data</CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Detailed breakdown of bills, sales, and purchases per month.
                  </p>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Month</TableHead>
                        <TableHead className="text-center">No. of Bills</TableHead>
                        <TableHead className="text-right">Total Sales</TableHead>
                        <TableHead className="text-right">Total Purchases</TableHead>
                        <TableHead className="text-right">Net Value</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(data?.monthly ?? []).length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">
                            No data for the selected period.
                          </TableCell>
                        </TableRow>
                      ) : (
                        (data?.monthly ?? []).map((row: any) => (
                          <TableRow key={row.monthKey}>
                            <TableCell className="font-medium">{row.month}</TableCell>
                            <TableCell className="text-center">{row.billCount}</TableCell>
                            <TableCell className="text-right text-green-600 font-medium">
                              LKR {fmt(row.totalSales)}
                            </TableCell>
                            <TableCell className="text-right text-red-600 font-medium">
                              LKR {fmt(row.totalPurchases)}
                            </TableCell>
                            <TableCell className={`text-right font-bold ${row.netValue >= 0 ? "text-green-700" : "text-red-700"}`}>
                              LKR {fmt(row.netValue)}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── Profit Tab ──────────────────────────────────────────────── */}
            <TabsContent value="profit" className="space-y-4">
              {/* Header row */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold">Profit Overview</h2>
                  <p className="text-sm text-muted-foreground">Comprehensive breakdown of your business profits</p>
                </div>
                <Button
                  onClick={() => {
                    if (!data) return;
                    import("jspdf").then(({ jsPDF }) => {
                      import("jspdf-autotable").then(() => {
                        const doc = new jsPDF();
                        doc.setFontSize(18);
                        doc.text("Sierra Agency — Profit Report", 14, 20);
                        doc.setFontSize(11);
                        doc.text(`Period: ${customFrom} to ${customTo}`, 14, 30);
                        doc.setFontSize(13);
                        doc.text("Financial Summary", 14, 42);
                        (doc as any).autoTable({
                          startY: 46,
                          head: [["Metric", "Value"]],
                          body: [
                            ["Total Sales", `LKR ${fmt(overview.totalSales)}`],
                            ["Total Cost", `LKR ${fmt(overview.totalCost)}`],
                            ["Net Profit", `LKR ${fmt(overview.totalProfit)}`],
                            ["Profit Margin", `${overview.profitMargin.toFixed(2)}%`],
                          ],
                          theme: "striped",
                          headStyles: { fillColor: [147, 51, 234] },
                        });
                        const afterTable = (doc as any).lastAutoTable.finalY + 10;
                        doc.text("Product Profitability", 14, afterTable);
                        (doc as any).autoTable({
                          startY: afterTable + 4,
                          head: [["Product", "Qty Sold", "Revenue", "Cost", "Profit", "Margin"]],
                          body: (data?.products ?? []).map((p: any) => [
                            p.name, p.qtySold,
                            `LKR ${fmt(p.revenue)}`, `LKR ${fmt(p.cost)}`,
                            `LKR ${fmt(p.profit)}`, `${p.margin.toFixed(1)}%`,
                          ]),
                          theme: "striped",
                          headStyles: { fillColor: [147, 51, 234] },
                        });
                        doc.save(`sierra-profit-report-${customFrom}-to-${customTo}.pdf`);
                      });
                    });
                  }}
                  className="bg-blue-600 hover:bg-blue-700 text-white gap-2 self-start sm:self-auto"
                >
                  <FileText className="h-4 w-4" />
                  Export Profit PDF
                </Button>
              </div>

              {/* Sales vs Profit  +  Top Profitable Customers */}
              <div className="grid gap-4 lg:grid-cols-2">
                {/* Sales vs Profit card */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base font-semibold">Sales vs Profit</CardTitle>
                    <p className="text-xs text-muted-foreground">Revenue and profit comparison</p>
                  </CardHeader>
                  <CardContent className="space-y-5 pt-2">
                    {/* Total Sales */}
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-muted-foreground">Total Sales</p>
                        <p className="text-2xl font-bold text-slate-900">
                          LKR {fmt(overview.totalSales)}
                        </p>
                      </div>
                      <DollarSign className="h-8 w-8 text-blue-500 opacity-80" />
                    </div>

                    <div className="border-t" />

                    {/* Total Cost */}
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-muted-foreground">Total Cost</p>
                        <p className="text-2xl font-bold text-red-600">
                          LKR {fmt(overview.totalCost)}
                        </p>
                      </div>
                      <TrendingDown className="h-8 w-8 text-red-500 opacity-80" />
                    </div>

                    <div className="border-t" />

                    {/* Net Profit */}
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-muted-foreground">Net Profit</p>
                        <p className={`text-2xl font-bold ${overview.totalProfit >= 0 ? "text-green-600" : "text-red-600"}`}>
                          LKR {fmt(overview.totalProfit)}
                        </p>
                      </div>
                      <TrendingUp className={`h-8 w-8 opacity-80 ${overview.totalProfit >= 0 ? "text-green-500" : "text-red-500"}`} />
                    </div>

                    <div className="border-t" />

                    {/* Profit Margin */}
                    <div className="flex items-center justify-between pt-1">
                      <p className="text-sm text-muted-foreground">Profit Margin</p>
                      <p className={`text-2xl font-bold ${overview.profitMargin >= 10 ? "text-green-600" : overview.profitMargin >= 5 ? "text-amber-600" : "text-red-600"}`}>
                        {overview.profitMargin.toFixed(2)}%
                      </p>
                    </div>
                  </CardContent>
                </Card>

                {/* Top Profitable Customers — Pie Chart */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base font-semibold">Top Profitable Customers</CardTitle>
                    <p className="text-xs text-muted-foreground">Highest profit contributors</p>
                  </CardHeader>
                  <CardContent>
                    {(data?.customerProfits ?? []).length === 0 ? (
                      <div className="flex items-center justify-center h-52 text-muted-foreground text-sm">
                        No profit data available for this period.
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height={260}>
                        <PieChart>
                          <Pie
                            data={data?.customerProfits ?? []}
                            cx="50%"
                            cy="50%"
                            outerRadius={100}
                            dataKey="value"
                            nameKey="name"
                            label={({ name }) => name}
                            labelLine={true}
                          >
                            {(data?.customerProfits ?? []).map((_: any, idx: number) => (
                              <Cell
                                key={`cell-${idx}`}
                                fill={PIE_COLORS[idx % PIE_COLORS.length]}
                              />
                            ))}
                          </Pie>
                          <Tooltip
                            formatter={(value: any, _: any, props: any) => [
                              `LKR ${Number(value).toLocaleString()}`,
                              props.payload?.fullName || props.payload?.name,
                            ]}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Profit Margin Distribution */}
              <div>
                <h3 className="text-base font-semibold mb-0.5">Profit Margin Distribution</h3>
                <p className="text-xs text-muted-foreground mb-3">Orders by profit margin ranges</p>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <Card className="bg-green-50 border-green-200">
                    <CardContent className="pt-5 pb-5">
                      <p className="text-sm text-green-700 font-medium">Excellent (30%+)</p>
                      <p className="text-4xl font-bold text-green-600 mt-2">
                        {data?.marginDistribution?.excellent ?? 0}
                      </p>
                    </CardContent>
                  </Card>
                  <Card className="bg-blue-50 border-blue-200">
                    <CardContent className="pt-5 pb-5">
                      <p className="text-sm text-blue-700 font-medium">Good (20-30%)</p>
                      <p className="text-4xl font-bold text-blue-600 mt-2">
                        {data?.marginDistribution?.good ?? 0}
                      </p>
                    </CardContent>
                  </Card>
                  <Card className="bg-amber-50 border-amber-200">
                    <CardContent className="pt-5 pb-5">
                      <p className="text-sm text-amber-700 font-medium">Fair (10-20%)</p>
                      <p className="text-4xl font-bold text-amber-500 mt-2">
                        {data?.marginDistribution?.fair ?? 0}
                      </p>
                    </CardContent>
                  </Card>
                  <Card className="bg-red-50 border-red-200">
                    <CardContent className="pt-5 pb-5">
                      <p className="text-sm text-red-700 font-medium">Low (&lt;10%)</p>
                      <p className="text-4xl font-bold text-red-500 mt-2">
                        {data?.marginDistribution?.low ?? 0}
                      </p>
                    </CardContent>
                  </Card>
                </div>
              </div>

              {/* Product Profitability Table */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Product Profitability</CardTitle>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>SKU</TableHead>
                        <TableHead>Product Name</TableHead>
                        <TableHead className="text-center">Sold Qty</TableHead>
                        <TableHead className="text-right">Revenue</TableHead>
                        <TableHead className="text-right">Cost</TableHead>
                        <TableHead className="text-right">Profit</TableHead>
                        <TableHead className="text-right">Margin</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(data?.products ?? []).length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                            No product data for the selected period.
                          </TableCell>
                        </TableRow>
                      ) : (
                        (data?.products ?? []).map((p: any) => (
                          <TableRow key={p.id}>
                            <TableCell className="text-xs text-muted-foreground font-mono">{p.sku}</TableCell>
                            <TableCell className="max-w-[200px] truncate font-medium" title={p.name}>{p.name}</TableCell>
                            <TableCell className="text-center">{p.qtySold}</TableCell>
                            <TableCell className="text-right font-bold">LKR {fmt(p.revenue)}</TableCell>
                            <TableCell className="text-right text-muted-foreground">LKR {fmt(p.cost)}</TableCell>
                            <TableCell className={`text-right font-bold ${p.profit >= 0 ? "text-green-600" : "text-red-600"}`}>
                              LKR {fmt(p.profit)}
                            </TableCell>
                            <TableCell className="text-right">
                              <Badge
                                variant="outline"
                                className={
                                  p.margin >= 30
                                    ? "text-green-700 border-green-200 bg-green-50"
                                    : p.margin >= 20
                                    ? "text-blue-700 border-blue-200 bg-blue-50"
                                    : p.margin >= 10
                                    ? "text-amber-700 border-amber-200 bg-amber-50"
                                    : "text-red-700 border-red-200 bg-red-50"
                                }
                              >
                                {p.margin.toFixed(1)}%
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── Orders Tab ──────────────────────────────────────────────── */}
            <TabsContent value="orders">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Invoice / Order List</CardTitle>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Invoice No</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead className="text-right">Amount (LKR)</TableHead>
                        <TableHead className="text-right">Due (LKR)</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(data?.orders ?? []).length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                            No orders for the selected period.
                          </TableCell>
                        </TableRow>
                      ) : (
                        (data?.orders ?? []).map((o: any) => (
                          <TableRow key={o.id}>
                            <TableCell className="font-mono text-xs text-purple-600 font-medium">
                              {o.invoiceNo || "-"}
                            </TableCell>
                            <TableCell className="text-xs">
                              {o.date ? new Date(o.date).toLocaleDateString() : "-"}
                            </TableCell>
                            <TableCell className="max-w-40 truncate text-sm" title={o.customer}>
                              {o.customer}
                            </TableCell>
                            <TableCell className="text-right font-bold">
                              {fmt(o.amount)}
                            </TableCell>
                            <TableCell className={`text-right font-medium ${o.dueAmount > 0 ? "text-red-600" : "text-muted-foreground"}`}>
                              {fmt(o.dueAmount)}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={
                                  o.paymentStatus === "Paid"
                                    ? "text-green-600 border-green-200 bg-green-50"
                                    : o.paymentStatus === "Partial"
                                    ? "text-amber-600 border-amber-200 bg-amber-50"
                                    : "text-red-600 border-red-200 bg-red-50"
                                }
                              >
                                {o.paymentStatus}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── Customers Tab ───────────────────────────────────────────── */}
            <TabsContent value="customers">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Customer Breakdown</CardTitle>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>#</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead className="text-center">Bills</TableHead>
                        <TableHead className="text-right">Total Sales (LKR)</TableHead>
                        <TableHead className="text-right">Due Amount (LKR)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(data?.customers ?? []).length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">
                            No customer data for the selected period.
                          </TableCell>
                        </TableRow>
                      ) : (
                        (data?.customers ?? []).map((c: any, i: number) => (
                          <TableRow key={c.name}>
                            <TableCell className="text-muted-foreground text-sm">{i + 1}</TableCell>
                            <TableCell className="font-medium max-w-[200px] truncate" title={c.name}>
                              {c.name}
                            </TableCell>
                            <TableCell className="text-center">{c.billCount}</TableCell>
                            <TableCell className="text-right font-bold text-green-600">
                              {fmt(c.totalSales)}
                            </TableCell>
                            <TableCell className={`text-right font-medium ${c.dueAmount > 0 ? "text-red-600" : "text-muted-foreground"}`}>
                              {fmt(c.dueAmount)}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── Expenses Tab ────────────────────────────────────────────── */}
            <TabsContent value="expenses">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-base">Expense Records</CardTitle>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Sierra Agency operational expenses
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Total</p>
                    <p className="text-lg font-bold text-red-600">LKR {fmt(overview.totalExpenses)}</p>
                  </div>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Payment Method</TableHead>
                        <TableHead className="text-right">Amount (LKR)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(data?.expenses ?? []).length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">
                            No expenses recorded for the selected period.
                          </TableCell>
                        </TableRow>
                      ) : (
                        (data?.expenses ?? []).map((e: any) => (
                          <TableRow key={e.id}>
                            <TableCell className="text-xs">
                              {e.date ? new Date(e.date).toLocaleDateString() : "-"}
                            </TableCell>
                            <TableCell className="max-w-[200px] truncate text-sm" title={e.description}>
                              {e.description}
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary" className="text-xs">
                                {e.category}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {e.paymentMethod}
                            </TableCell>
                            <TableCell className="text-right font-bold text-red-600">
                              {fmt(e.amount)}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── Due Tab ─────────────────────────────────────────────────── */}
            <TabsContent value="due">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-base">Outstanding / Due Invoices</CardTitle>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Invoices with pending payment balance
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Total Due</p>
                    <p className="text-lg font-bold text-red-600">
                      LKR {fmt((data?.dueInvoices ?? []).reduce((s: number, d: any) => s + d.dueAmount, 0))}
                    </p>
                  </div>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Invoice No</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead className="text-right">Total (LKR)</TableHead>
                        <TableHead className="text-right">Due (LKR)</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(data?.dueInvoices ?? []).length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                            No outstanding invoices. All paid!
                          </TableCell>
                        </TableRow>
                      ) : (
                        (data?.dueInvoices ?? []).map((d: any) => (
                          <TableRow key={d.id}>
                            <TableCell className="font-mono text-xs text-purple-600 font-medium">
                              {d.invoiceNo || "-"}
                            </TableCell>
                            <TableCell className="text-xs">
                              {d.date ? new Date(d.date).toLocaleDateString() : "-"}
                            </TableCell>
                            <TableCell className="max-w-40 truncate text-sm" title={d.customer}>
                              {d.customer}
                            </TableCell>
                            <TableCell className="text-right font-bold">
                              {fmt(d.amount)}
                            </TableCell>
                            <TableCell className="text-right font-bold text-red-600">
                              {fmt(d.dueAmount)}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={
                                  d.paymentStatus === "Partial"
                                    ? "text-amber-600 border-amber-200 bg-amber-50"
                                    : "text-red-600 border-red-200 bg-red-50"
                                }
                              >
                                {d.paymentStatus}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── Summary Tab ─────────────────────────────────────────────── */}
            <TabsContent value="summary">
              <div className="grid gap-4 sm:grid-cols-2">
                {/* Financial Summary */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <CreditCard className="h-4 w-4 text-purple-600" />
                      Financial Summary
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {[
                      { label: "Total Sales", value: overview.totalSales, color: "text-slate-900" },
                      { label: "Total Cost (COGS)", value: overview.totalCost, color: "text-slate-600" },
                      { label: "Gross Profit", value: overview.totalProfit, color: overview.totalProfit >= 0 ? "text-green-600" : "text-red-600" },
                      { label: "Total Expenses", value: overview.totalExpenses, color: "text-red-600" },
                      {
                        label: "Net Profit (After Expenses)",
                        value: overview.totalProfit - overview.totalExpenses,
                        color: (overview.totalProfit - overview.totalExpenses) >= 0 ? "text-green-700" : "text-red-700",
                      },
                    ].map((row) => (
                      <div key={row.label} className="flex items-center justify-between py-1.5 border-b last:border-0">
                        <span className="text-sm text-muted-foreground">{row.label}</span>
                        <span className={`text-sm font-bold ${row.color}`}>
                          LKR {fmt(row.value)}
                        </span>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                {/* Activity Summary */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <BarChart3 className="h-4 w-4 text-purple-600" />
                      Activity Summary
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {[
                      { label: "Total Invoices", value: `${overview.orderCount} bills` },
                      { label: "Paid Invoices", value: `${(data?.orders ?? []).filter((o: any) => o.paymentStatus === "Paid").length} bills` },
                      { label: "Partial Payments", value: `${(data?.orders ?? []).filter((o: any) => o.paymentStatus === "Partial").length} bills` },
                      { label: "Unpaid Invoices", value: `${(data?.orders ?? []).filter((o: any) => o.paymentStatus === "Unpaid").length} bills` },
                      { label: "Outstanding Due", value: `LKR ${fmt((data?.dueInvoices ?? []).reduce((s: number, d: any) => s + d.dueAmount, 0))}` },
                      { label: "Total Expenses", value: `${overview.expenseCount} items` },
                      { label: "Profit Margin", value: `${overview.profitMargin.toFixed(2)}%` },
                    ].map((row) => (
                      <div key={row.label} className="flex items-center justify-between py-1.5 border-b last:border-0">
                        <span className="text-sm text-muted-foreground">{row.label}</span>
                        <span className="text-sm font-semibold">{row.value}</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
