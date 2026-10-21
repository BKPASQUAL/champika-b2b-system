"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Printer,
  Calendar,
  Loader2,
  Building2,
  HardHat,
  Users,
  Landmark,
  Zap,
  Fuel,
  Home,
  Receipt,
  ArrowUpRight,
  ArrowDownRight,
  Plus,
  PlusCircle,
  PieChart as PieIcon,
  Search,
  CheckCircle2,
  AlertTriangle,
  Banknote,
  Eye,
  Download,
  ExternalLink,
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
import { BUSINESS_NAMES } from "@/app/config/business-constants";

const COLORS = [
  "#2563eb",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#06b6d4",
  "#ec4899",
  "#84cc16",
  "#f97316",
  "#64748b",
];

const MONTHS = [
  { value: "1", label: "January" },
  { value: "2", label: "February" },
  { value: "3", label: "March" },
  { value: "4", label: "April" },
  { value: "5", label: "May" },
  { value: "6", label: "June" },
  { value: "7", label: "July" },
  { value: "8", label: "August" },
  { value: "9", label: "September" },
  { value: "10", label: "October" },
  { value: "11", label: "November" },
  { value: "12", label: "December" },
];

const fmt = (n: number | null | undefined) =>
  `LKR ${(Number(n) || 0).toLocaleString("en-LK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const fmtShort = (n: number | null | undefined) =>
  `LKR ${(Number(n) || 0).toLocaleString("en-LK", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;

export default function MonthlyPnLPage() {
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(String(now.getFullYear()));
  const [selectedMonth, setSelectedMonth] = useState(String(now.getMonth() + 1));
  const [selectedBusiness, setSelectedBusiness] = useState("all");
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [voucherSearch, setVoucherSearch] = useState("");
  const [salarySearch, setSalarySearch] = useState("");
  const [activeTab, setActiveTab] = useState("statement");

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/reports/monthly-pnl?year=${selectedYear}&month=${selectedMonth}&businessId=${selectedBusiness}`
      );
      if (!res.ok) throw new Error("Failed to load Monthly P&L data");
      const json = await res.json();
      setData(json);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Error loading Monthly P&L report");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedYear, selectedMonth, selectedBusiness]);

  const targetMonth = data?.targetMonth || {};
  const isProfit = (targetMonth.netProfit || 0) >= 0;
  const netProfitValue = targetMonth.netProfit || 0;
  const netMargin = targetMonth.netMargin || 0;
  const operatingProfit = targetMonth.operatingProfit || 0;

  // Filter vouchers by search
  const filteredVouchers = useMemo(() => {
    if (!data?.overheadEntries) return [];
    if (!voucherSearch.trim()) return data.overheadEntries;
    const q = voucherSearch.toLowerCase();
    return data.overheadEntries.filter(
      (e: any) =>
        e.description.toLowerCase().includes(q) ||
        e.category.toLowerCase().includes(q) ||
        e.referenceNo.toLowerCase().includes(q) ||
        e.paymentMethod.toLowerCase().includes(q)
    );
  }, [data?.overheadEntries, voucherSearch]);

  // Filter salaries by search
  const filteredSalaries = useMemo(() => {
    if (!data?.staffSalariesList) return [];
    if (!salarySearch.trim()) return data.staffSalariesList;
    const q = salarySearch.toLowerCase();
    return data.staffSalariesList.filter(
      (s: any) =>
        s.name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q)
    );
  }, [data?.staffSalariesList, salarySearch]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 pb-12 print:p-0 print:m-0 print:space-y-4">
      {/* ─── Top Header & Controls ─────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4 print:border-b-2">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Monthly Profit & Loss Statement
            </h1>
            <Badge
              variant="outline"
              className={
                isProfit
                  ? "bg-emerald-50 text-emerald-700 border-emerald-300 font-semibold"
                  : "bg-rose-50 text-rose-700 border-rose-300 font-semibold"
              }
            >
              {data?.monthName} {selectedYear} • {isProfit ? "PROFIT" : "LOSS"}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Complete executive financial breakdown: Sales Revenue, Product Costs, Staff Salaries, and Operational Overheads.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          {/* Year selector */}
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-[100px] text-xs">
              <SelectValue placeholder="Year" />
            </SelectTrigger>
            <SelectContent>
              {[2024, 2025, 2026, 2027].map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Month selector */}
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-[130px] text-xs">
              <Calendar className="w-3.5 h-3.5 mr-1.5 text-muted-foreground" />
              <SelectValue placeholder="Month" />
            </SelectTrigger>
            <SelectContent>
              {MONTHS.map((m) => (
                <SelectItem key={m.value} value={m.value}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Business / Agency Filter */}
          <Select value={selectedBusiness} onValueChange={setSelectedBusiness}>
            <SelectTrigger className="w-[160px] text-xs">
              <Building2 className="w-3.5 h-3.5 mr-1.5 text-muted-foreground" />
              <SelectValue placeholder="Business" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Businesses</SelectItem>
              {Object.entries(BUSINESS_NAMES).map(([id, name]) => (
                <SelectItem key={id} value={id}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Staff Salaries Shortcut */}
          <Button variant="outline" asChild size="sm" className="border-indigo-300 text-indigo-700 hover:bg-indigo-50">
            <Link href="/dashboard/admin/salaries">
              <Banknote className="w-4 h-4 mr-1 text-indigo-600" />
              Staff Salaries
            </Link>
          </Button>

          {/* Log Expense Shortcut */}
          <Button variant="outline" asChild size="sm">
            <Link href="/dashboard/admin/expenses">
              <PlusCircle className="w-4 h-4 mr-1 text-blue-600" />
              Log Expense
            </Link>
          </Button>

          {/* Print Button */}
          <Button onClick={handlePrint} variant="default" size="sm">
            <Printer className="w-4 h-4 mr-1.5" />
            Print P&L
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">
            Calculating sales, payroll, overheads & monthly net profit...
          </p>
        </div>
      ) : !data ? (
        <Card className="p-8 text-center text-muted-foreground">
          No data available for the selected period.
        </Card>
      ) : (
        <>
          {/* ─── HERO NET PROFIT / LOSS BANNER ───────────────────────────────── */}
          <div
            className={`rounded-2xl p-6 border shadow-sm transition-all ${
              isProfit
                ? "bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent border-emerald-500/30"
                : "bg-gradient-to-br from-rose-500/10 via-rose-500/5 to-transparent border-rose-500/30"
            }`}
          >
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                      isProfit
                        ? "bg-emerald-600 text-white"
                        : "bg-rose-600 text-white"
                    }`}
                  >
                    {isProfit ? (
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    ) : (
                      <AlertTriangle className="w-3.5 h-3.5" />
                    )}
                    {data.monthName} {selectedYear} • {targetMonth.status}
                  </span>
                  <span className="text-xs text-muted-foreground font-medium">
                    Net Profit Margin: {netMargin.toFixed(1)}%
                  </span>
                </div>

                <div className="flex items-baseline gap-3">
                  <h2
                    className={`text-3xl md:text-5xl font-extrabold tracking-tight ${
                      isProfit
                        ? "text-emerald-700 dark:text-emerald-400"
                        : "text-rose-700 dark:text-rose-400"
                    }`}
                  >
                    {netProfitValue >= 0 ? "+" : ""}
                    {fmt(netProfitValue)}
                  </h2>
                </div>

                <p className="text-sm text-slate-600 dark:text-slate-300 max-w-2xl">
                  {isProfit
                    ? `In ${data.monthName} ${selectedYear}, your business generated a Net Profit of ${fmt(netProfitValue)} after deducting product costs (${fmt(targetMonth.cogs)}), staff salaries (${fmt(targetMonth.salaries)}), and operational overheads (${fmt(targetMonth.overheads)}).`
                    : `In ${data.monthName} ${selectedYear}, operational overheads and direct costs exceeded gross revenue by ${fmt(Math.abs(netProfitValue))}.`}
                </p>
              </div>

              {/* MoM Comparison */}
              {data.momComparison?.prevMonthName && (
                <div className="bg-background/80 backdrop-blur rounded-xl p-4 border shadow-sm flex flex-col gap-2 min-w-[260px]">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    vs. {data.momComparison.prevMonthName} (MoM)
                  </p>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <p className="text-muted-foreground">Sales Revenue</p>
                      <p
                        className={`font-semibold flex items-center ${
                          (data.momComparison.revenueChange || 0) >= 0
                            ? "text-emerald-600"
                            : "text-rose-600"
                        }`}
                      >
                        {(data.momComparison.revenueChange || 0) >= 0 ? (
                          <ArrowUpRight className="w-3 h-3 mr-0.5" />
                        ) : (
                          <ArrowDownRight className="w-3 h-3 mr-0.5" />
                        )}
                        {data.momComparison.revenueChangePct !== null
                          ? `${data.momComparison.revenueChangePct.toFixed(1)}%`
                          : "N/A"}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Net Profit</p>
                      <p
                        className={`font-semibold flex items-center ${
                          (data.momComparison.netProfitChange || 0) >= 0
                            ? "text-emerald-600"
                            : "text-rose-600"
                        }`}
                      >
                        {(data.momComparison.netProfitChange || 0) >= 0 ? (
                          <ArrowUpRight className="w-3 h-3 mr-0.5" />
                        ) : (
                          <ArrowDownRight className="w-3 h-3 mr-0.5" />
                        )}
                        {data.momComparison.netProfitChangePct !== null
                          ? `${data.momComparison.netProfitChangePct.toFixed(1)}%`
                          : "N/A"}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ─── 4 MAIN FINANCIAL TIERS (Sales, Gross Profit, Salaries, Overheads) ──── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* 1. Total Sales Revenue */}
            <Card className="shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  1. Sales Revenue
                </CardTitle>
                <DollarSign className="w-4 h-4 text-emerald-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                  {fmtShort(targetMonth.revenue)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {targetMonth.orderCount || 0} Customer Invoices
                </p>
              </CardContent>
            </Card>

            {/* 2. Gross Profit */}
            <Card className="shadow-sm bg-blue-50/40 dark:bg-blue-950/20 border-blue-200/50">
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-blue-900 dark:text-blue-200">
                  2. Gross Profit
                </CardTitle>
                <TrendingUp className="w-4 h-4 text-blue-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-700 dark:text-blue-400">
                  {fmtShort(targetMonth.grossProfit)}
                </div>
                <p className="text-xs text-blue-600 dark:text-blue-300 mt-1">
                  Margin: {targetMonth.grossMargin?.toFixed(1)}% (COGS: {fmtShort(targetMonth.cogs)})
                </p>
              </CardContent>
            </Card>

            {/* 3. STAFF SALARIES (DEDICATED PROMINENT TIER) */}
            <Card className="shadow-sm bg-indigo-50/40 dark:bg-indigo-950/20 border-indigo-200/50">
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-indigo-900 dark:text-indigo-200">
                  3. Staff Salaries
                </CardTitle>
                <Banknote className="w-4 h-4 text-indigo-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-indigo-700 dark:text-indigo-400">
                  {fmtShort(targetMonth.salaries)}
                </div>
                <div className="flex items-center justify-between mt-1">
                  <p className="text-xs text-indigo-600 dark:text-indigo-300">
                    {targetMonth.staffCount || data.staffSalariesList?.length || 0} Staff Members Paid
                  </p>
                  <Link
                    href="/dashboard/admin/salaries"
                    className="text-[11px] font-semibold text-indigo-700 hover:underline inline-flex items-center"
                  >
                    Manage <ExternalLink className="w-3 h-3 ml-0.5" />
                  </Link>
                </div>
              </CardContent>
            </Card>

            {/* 4. Operating Overheads (Excl. Salaries) */}
            <Card className="shadow-sm bg-rose-50/40 dark:bg-rose-950/20 border-rose-200/50">
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-rose-900 dark:text-rose-200">
                  4. Operating Overheads
                </CardTitle>
                <Receipt className="w-4 h-4 text-rose-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-rose-700 dark:text-rose-400">
                  {fmtShort(targetMonth.overheads)}
                </div>
                <p className="text-xs text-rose-600 dark:text-rose-300 mt-1">
                  Fuel, Utilities, Rent, Interest, etc.
                </p>
              </CardContent>
            </Card>
          </div>

          {/* ─── TABS CONTENT ──────────────────────────────────────────────── */}
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="space-y-4 print:space-y-2"
          >
            <TabsList className="grid w-full grid-cols-2 md:grid-cols-5 print:hidden">
              <TabsTrigger value="statement">📋 Formal P&L Statement</TabsTrigger>
              <TabsTrigger value="salaries">👥 Staff Salaries ({data.staffSalariesList?.length || 0})</TabsTrigger>
              <TabsTrigger value="breakdown">📊 Overheads Breakdown</TabsTrigger>
              <TabsTrigger value="vouchers">🧾 Overhead Vouchers ({data.overheadEntries?.length || 0})</TabsTrigger>
              <TabsTrigger value="annual">📈 12-Month Annual Trend</TabsTrigger>
            </TabsList>

            {/* TAB 1: FORMAL STATEMENT WITH DEDICATED SALARIES TIER */}
            <TabsContent value="statement" className="space-y-4">
              <Card className="shadow-sm">
                <CardHeader className="border-b pb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg">
                        Statement of Profit or Loss
                      </CardTitle>
                      <CardDescription>
                        For the month ended {data.monthName} {selectedYear} • Standard 3-Tier Multi-Step Layout
                      </CardDescription>
                    </div>
                    <Badge variant="outline" className="text-xs font-mono">
                      Accounting Format
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/40">
                        <TableHead className="w-[65%] font-bold text-slate-900 dark:text-slate-100">
                          Account Head / Financial Item
                        </TableHead>
                        <TableHead className="text-right font-bold text-slate-900 dark:text-slate-100">
                          Amount (LKR)
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {/* SECTION 1: TRADING ACCOUNT */}
                      <TableRow className="bg-slate-50/70 dark:bg-slate-900/70 font-semibold">
                        <TableCell colSpan={2} className="text-xs uppercase text-primary tracking-wider py-2">
                          1. TRADING ACCOUNT (Gross Sales & Direct Margin)
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="pl-6">
                          Gross Invoiced Sales Revenue ({targetMonth.orderCount || 0} customer invoices)
                        </TableCell>
                        <TableCell className="text-right font-medium text-emerald-700 dark:text-emerald-400">
                          {fmt(targetMonth.revenue)}
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="pl-6 text-muted-foreground">
                          Less: Cost of Goods Sold (Stock Purchase Cost)
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          ({fmt(targetMonth.cogs)})
                        </TableCell>
                      </TableRow>
                      <TableRow className="font-bold border-t-2 border-b-2 bg-blue-50/30 dark:bg-blue-950/20">
                        <TableCell className="pl-6">
                          GROSS PROFIT (Gross Margin: {targetMonth.grossMargin?.toFixed(1)}%)
                        </TableCell>
                        <TableCell className="text-right text-blue-700 dark:text-blue-400">
                          {fmt(targetMonth.grossProfit)}
                        </TableCell>
                      </TableRow>

                      {/* SECTION 2: STAFF SALARIES & PAYROLL (DEDICATED TIER) */}
                      <TableRow className="bg-indigo-50/70 dark:bg-indigo-950/50 font-semibold">
                        <TableCell colSpan={2} className="text-xs uppercase text-indigo-700 dark:text-indigo-300 tracking-wider py-2">
                          2. STAFF SALARIES & PERSONNEL COSTS (Dedicated Payroll Section)
                        </TableCell>
                      </TableRow>

                      {data.staffSalariesList && data.staffSalariesList.length > 0 ? (
                        data.staffSalariesList.map((st: any) => (
                          <TableRow key={st.id}>
                            <TableCell className="pl-6 flex items-center justify-between">
                              <span className="font-medium">{st.name}</span>
                              <span className="text-xs text-muted-foreground">
                                Basic: {fmtShort(st.basic)} | Additions: +{fmtShort(st.allowances + st.commissions)} | Deductions: -{fmtShort(st.deductions)}
                              </span>
                            </TableCell>
                            <TableCell className="text-right font-mono text-indigo-700 dark:text-indigo-300">
                              {fmt(st.netSalary)}
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell className="pl-6">
                            Staff Salaries (Monthly Payroll Total)
                          </TableCell>
                          <TableCell className="text-right font-mono text-indigo-700 dark:text-indigo-300">
                            {fmt(targetMonth.salaries)}
                          </TableCell>
                        </TableRow>
                      )}

                      <TableRow className="font-bold border-t border-b bg-indigo-50/20">
                        <TableCell className="pl-6">
                          TOTAL STAFF SALARIES
                        </TableCell>
                        <TableCell className="text-right font-bold text-indigo-700 dark:text-indigo-400">
                          ({fmt(targetMonth.salaries)})
                        </TableCell>
                      </TableRow>

                      <TableRow className="font-semibold bg-muted/10 border-b">
                        <TableCell className="pl-6">
                          ==&gt; OPERATING PROFIT AFTER SALARIES
                        </TableCell>
                        <TableCell className="text-right font-bold text-slate-800 dark:text-slate-200">
                          {fmt(operatingProfit)}
                        </TableCell>
                      </TableRow>

                      {/* SECTION 3: OPERATING OVERHEADS */}
                      <TableRow className="bg-slate-50/70 dark:bg-slate-900/70 font-semibold">
                        <TableCell colSpan={2} className="text-xs uppercase text-primary tracking-wider py-2">
                          3. GENERAL OPERATING & ADMINISTRATIVE OVERHEADS
                        </TableCell>
                      </TableRow>

                      {data.overheadBreakdown && data.overheadBreakdown.length > 0 ? (
                        data.overheadBreakdown.map((item: any) => (
                          <TableRow key={item.category}>
                            <TableCell className="pl-6 flex items-center justify-between">
                              <span>{item.category}</span>
                              <span className="text-xs text-muted-foreground font-mono">
                                {item.count} voucher(s) • {item.percentOfOverheads.toFixed(1)}% of overheads
                              </span>
                            </TableCell>
                            <TableCell className="text-right font-mono text-slate-700 dark:text-slate-300">
                              {fmt(item.total)}
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={2} className="pl-6 text-xs text-muted-foreground italic">
                            No other overhead expenses recorded for this month.
                          </TableCell>
                        </TableRow>
                      )}

                      <TableRow className="font-semibold border-t bg-muted/20">
                        <TableCell className="pl-6">
                          TOTAL OPERATING OVERHEADS
                        </TableCell>
                        <TableCell className="text-right font-bold text-rose-700 dark:text-rose-400">
                          ({fmt(targetMonth.overheads)})
                        </TableCell>
                      </TableRow>

                      {/* LOSSES */}
                      {targetMonth.losses > 0 && (
                        <>
                          <TableRow className="bg-slate-50/70 dark:bg-slate-900/70 font-semibold">
                            <TableCell colSpan={2} className="text-xs uppercase text-primary tracking-wider py-2">
                              4. DAMAGES & INVENTORY LOSSES
                            </TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell className="pl-6 text-muted-foreground">
                              Damaged Goods Marked as Business Loss
                            </TableCell>
                            <TableCell className="text-right text-rose-600">
                              ({fmt(targetMonth.losses)})
                            </TableCell>
                          </TableRow>
                        </>
                      )}

                      {/* FINAL NET PROFIT / LOSS */}
                      <TableRow
                        className={`text-base font-extrabold border-t-4 border-b-4 ${
                          isProfit
                            ? "bg-emerald-500/10 text-emerald-800 dark:text-emerald-300"
                            : "bg-rose-500/10 text-rose-800 dark:text-rose-300"
                        }`}
                      >
                        <TableCell className="pl-6 py-4">
                          NET {isProfit ? "PROFIT" : "LOSS"} FOR THE MONTH (Bottom Line)
                        </TableCell>
                        <TableCell className="text-right py-4 font-mono text-lg">
                          {isProfit ? "" : "-"}
                          {fmt(Math.abs(netProfitValue))}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            {/* TAB 2: DEDICATED STAFF SALARIES REGISTER */}
            <TabsContent value="salaries" className="space-y-4">
              <Card className="shadow-sm">
                <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Banknote className="w-5 h-5 text-indigo-600" />
                      Staff Payroll Breakdown — {data.monthName} {selectedYear}
                    </CardTitle>
                    <CardDescription>
                      Total Staff Payroll: {fmt(targetMonth.salaries)} across{" "}
                      {data.staffSalariesList?.length || 0} employees
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" asChild size="sm">
                      <Link href="/dashboard/admin/salaries">
                        <PlusCircle className="w-4 h-4 mr-1.5 text-indigo-600" />
                        Record New Salary
                      </Link>
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30">
                        <TableHead>Staff Member</TableHead>
                        <TableHead className="text-right">Basic Pay</TableHead>
                        <TableHead className="text-right text-emerald-600">Allowances</TableHead>
                        <TableHead className="text-right text-blue-600">Commissions / Bonus</TableHead>
                        <TableHead className="text-right text-rose-600">Deductions</TableHead>
                        <TableHead className="text-right font-bold text-slate-900 dark:text-slate-100">
                          Net Pay
                        </TableHead>
                        <TableHead className="text-center">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.staffSalariesList && data.staffSalariesList.length > 0 ? (
                        data.staffSalariesList.map((st: any) => (
                          <TableRow key={st.id}>
                            <TableCell>
                              <div className="font-semibold text-xs text-slate-900 dark:text-slate-100">
                                {st.name}
                              </div>
                              <div className="text-[11px] text-muted-foreground">{st.email}</div>
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs">
                              {fmtShort(st.basic)}
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs text-emerald-600">
                              +{fmtShort(st.allowances)}
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs text-blue-600">
                              +{fmtShort(st.commissions)}
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs text-rose-600">
                              {st.deductions > 0 ? `-${fmtShort(st.deductions)}` : "—"}
                            </TableCell>
                            <TableCell className="text-right font-mono font-bold text-slate-900 dark:text-slate-100 text-sm">
                              {fmt(st.netSalary)}
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge
                                variant="outline"
                                className="bg-emerald-50 text-emerald-700 border-emerald-300 text-[10px]"
                              >
                                {st.status}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-12 text-sm text-muted-foreground">
                            No individual staff salary records logged for {data.monthName} {selectedYear} yet.
                            <div className="mt-2">
                              <Button asChild size="sm">
                                <Link href="/dashboard/admin/salaries">
                                  <Plus className="w-4 h-4 mr-1.5" />
                                  Add Staff Salary in Payroll Register
                                </Link>
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            {/* TAB 3: OVERHEAD BREAKDOWN */}
            <TabsContent value="breakdown" className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <PieIcon className="w-4 h-4 text-primary" />
                      Operating Overheads Allocation
                    </CardTitle>
                    <CardDescription>
                      Distribution of non-salary operational expenses in {data.monthName} {selectedYear}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="h-[320px]">
                    {data.overheadBreakdown && data.overheadBreakdown.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={data.overheadBreakdown}
                            dataKey="total"
                            nameKey="category"
                            cx="50%"
                            cy="50%"
                            outerRadius={100}
                            innerRadius={50}
                            paddingAngle={2}
                          >
                            {data.overheadBreakdown.map((_: any, idx: number) => (
                              <Cell
                                key={`cell-${idx}`}
                                fill={COLORS[idx % COLORS.length]}
                              />
                            ))}
                          </Pie>
                          <Tooltip formatter={(val: any) => [fmt(val), "Amount"]} />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                        No overhead expenses recorded this month
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-base">
                      Overhead Category Breakdown
                    </CardTitle>
                    <CardDescription>
                      Total: {fmt(targetMonth.overheads)} across{" "}
                      {data.overheadBreakdown?.length || 0} categories
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {data.overheadBreakdown?.map((item: any, i: number) => (
                      <div key={item.category} className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold flex items-center gap-2">
                            <span
                              className="w-2.5 h-2.5 rounded-full"
                              style={{
                                backgroundColor: COLORS[i % COLORS.length],
                              }}
                            />
                            {item.category}
                          </span>
                          <span className="font-mono text-muted-foreground">
                            {fmt(item.total)} ({item.percentOfOverheads.toFixed(1)}%)
                          </span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                          <div
                            className="h-2 rounded-full transition-all"
                            style={{
                              width: `${Math.min(item.percentOfOverheads, 100)}%`,
                              backgroundColor: COLORS[i % COLORS.length],
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* TAB 4: OVERHEAD VOUCHERS */}
            <TabsContent value="vouchers" className="space-y-4">
              <Card className="shadow-sm">
                <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3">
                  <div>
                    <CardTitle className="text-base">
                      Operating Expense Receipts & Vouchers
                    </CardTitle>
                    <CardDescription>
                      All daily petty cash, fuel, utilities & overhead payments in {data.monthName}{" "}
                      {selectedYear}
                    </CardDescription>
                  </div>
                  <div className="relative w-64">
                    <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-muted-foreground" />
                    <Input
                      placeholder="Search voucher..."
                      className="pl-8 text-xs"
                      value={voucherSearch}
                      onChange={(e) => setVoucherSearch(e.target.value)}
                    />
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30">
                        <TableHead>Date</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Payment</TableHead>
                        <TableHead>Ref / Cheque</TableHead>
                        <TableHead>Business Scope</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredVouchers.length > 0 ? (
                        filteredVouchers.map((v: any) => (
                          <TableRow key={v.id}>
                            <TableCell className="font-mono text-xs">{v.date}</TableCell>
                            <TableCell className="font-medium text-xs">{v.description}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-[11px]">
                                {v.category}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">{v.paymentMethod}</TableCell>
                            <TableCell className="text-xs font-mono text-muted-foreground">{v.referenceNo}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{v.businessName}</TableCell>
                            <TableCell className="text-right font-mono font-semibold text-rose-600">
                              {fmt(v.amount)}
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-8 text-sm text-muted-foreground">
                            No matching expense entries found for this month.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            {/* TAB 5: 12-MONTH ANNUAL TREND */}
            <TabsContent value="annual" className="space-y-4">
              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base">
                    Full Year Financial Performance ({selectedYear})
                  </CardTitle>
                  <CardDescription>
                    Month-by-month Revenue vs. Salaries vs. Overheads vs. Net Profit curve
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[360px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={data.monthlyTrend || []}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                        <XAxis dataKey="shortName" />
                        <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                        <Tooltip formatter={(v: any, name: any) => [fmt(v), name]} />
                        <Legend />
                        <Bar dataKey="revenue" name="Sales Revenue" fill="#10b981" barSize={16} radius={[4, 4, 0, 0]} />
                        <Bar dataKey="salaries" name="Staff Salaries" fill="#8b5cf6" barSize={16} radius={[4, 4, 0, 0]} />
                        <Bar dataKey="overheads" name="Overheads" fill="#ef4444" barSize={16} radius={[4, 4, 0, 0]} />
                        <Line type="monotone" dataKey="netProfit" name="Net Profit" stroke="#2563eb" strokeWidth={3} dot={{ r: 4 }} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* 12-Month Table */}
              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base">
                    Monthly Performance Ledger ({selectedYear})
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/40">
                        <TableHead>Month</TableHead>
                        <TableHead className="text-right">Sales Revenue</TableHead>
                        <TableHead className="text-right">Gross Profit</TableHead>
                        <TableHead className="text-right text-indigo-700">Staff Salaries</TableHead>
                        <TableHead className="text-right text-rose-600">Overheads</TableHead>
                        <TableHead className="text-right">Net Profit / Loss</TableHead>
                        <TableHead className="text-right">Net Margin</TableHead>
                        <TableHead className="text-center">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.monthlyTrend?.map((m: any) => (
                        <TableRow
                          key={m.monthIndex}
                          className={
                            m.monthIndex === parseInt(selectedMonth, 10)
                              ? "bg-primary/5 font-semibold"
                              : ""
                          }
                        >
                          <TableCell className="font-medium">
                            {m.name}
                            {m.monthIndex === parseInt(selectedMonth, 10) && (
                              <Badge className="ml-2 text-[10px]" variant="secondary">
                                Selected
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-mono">{fmtShort(m.revenue)}</TableCell>
                          <TableCell className="text-right font-mono text-blue-600">{fmtShort(m.grossProfit)}</TableCell>
                          <TableCell className="text-right font-mono text-indigo-700">{fmtShort(m.salaries)}</TableCell>
                          <TableCell className="text-right font-mono text-rose-600">{fmtShort(m.overheads)}</TableCell>
                          <TableCell
                            className={`text-right font-mono font-bold ${
                              m.netProfit >= 0 ? "text-emerald-600" : "text-rose-600"
                            }`}
                          >
                            {fmtShort(m.netProfit)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs">{m.netMargin.toFixed(1)}%</TableCell>
                          <TableCell className="text-center">
                            <Badge
                              variant="outline"
                              className={
                                m.status === "PROFIT"
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-300 text-[10px]"
                                  : m.status === "LOSS"
                                  ? "bg-rose-50 text-rose-700 border-rose-300 text-[10px]"
                                  : "text-[10px]"
                              }
                            >
                              {m.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}

                      {/* YTD Total Row */}
                      {data.ytd && (
                        <TableRow className="bg-slate-100 dark:bg-slate-800 font-bold border-t-2">
                          <TableCell>YEAR-TO-DATE (YTD) TOTAL</TableCell>
                          <TableCell className="text-right font-mono text-emerald-700">{fmtShort(data.ytd.revenue)}</TableCell>
                          <TableCell className="text-right font-mono text-blue-700">{fmtShort(data.ytd.grossProfit)}</TableCell>
                          <TableCell className="text-right font-mono text-indigo-700">{fmtShort(data.ytd.salaries)}</TableCell>
                          <TableCell className="text-right font-mono text-rose-700">{fmtShort(data.ytd.overheads)}</TableCell>
                          <TableCell
                            className={`text-right font-mono font-extrabold ${
                              data.ytd.netProfit >= 0 ? "text-emerald-700" : "text-rose-700"
                            }`}
                          >
                            {fmtShort(data.ytd.netProfit)}
                          </TableCell>
                          <TableCell className="text-right font-mono">{data.ytd.netMargin?.toFixed(1)}%</TableCell>
                          <TableCell className="text-center">
                            <Badge className={data.ytd.status === "PROFIT" ? "bg-emerald-600 text-white" : "bg-rose-600 text-white"}>
                              YTD {data.ytd.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
