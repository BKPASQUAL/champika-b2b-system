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
  Legend,
} from "recharts";
import {
  DollarSign,
  TrendingUp,
  Calendar,
  Loader2,
  ChevronRight,
  RefreshCw,
  Search,
  FileText,
  Menu,
  Users,
  ShoppingCart,
  Banknote,
  Clock,
  Award,
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

// ── Rep sidebar list ────────────────────────────────────────────────────────
function RepList({
  reps,
  selected,
  loading,
  onSelect,
}: {
  reps: any[];
  selected: string | null;
  loading: boolean;
  onSelect: (id: string) => void;
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center h-24">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (reps.length === 0) {
    return <p className="text-xs text-muted-foreground text-center py-6">No reps found.</p>;
  }
  return (
    <ul className="py-1">
      {reps.map((r) => (
        <li key={r.id}>
          <button
            onClick={() => onSelect(r.id)}
            className={`w-full text-left px-4 py-3 flex items-center justify-between hover:bg-muted/50 transition-colors border-b border-gray-50 ${
              selected === r.id ? "bg-primary/5 border-l-2 border-l-primary" : ""
            }`}
          >
            <div className="min-w-0">
              <p className="text-xs font-medium truncate">{r.name}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {r.invoiceCount} invoices · LKR {fmt(r.totalSales)}
              </p>
            </div>
            {selected === r.id && (
              <ChevronRight className="h-3 w-3 text-primary shrink-0 ml-1" />
            )}
          </button>
        </li>
      ))}
    </ul>
  );
}

// ── Commission rules badge colours ─────────────────────────────────────────
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

export default function RepAnalyticsPage() {
  const today = new Date().toISOString().split("T")[0];
  const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    .toISOString().split("T")[0];

  const [quickSelect, setQuickSelect] = useState("this-month");
  const [customFrom, setCustomFrom] = useState(firstOfMonth);
  const [customTo, setCustomTo] = useState(today);
  const [loading, setLoading] = useState(true);
  const [reps, setReps] = useState<any[]>([]);
  const [commissionRules, setCommissionRules] = useState<any[]>([]);
  const [selectedRepId, setSelectedRepId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);

  const PER_PAGE = 10;
  const [invoicePage, setInvoicePage] = useState(1);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { from, to } = getRange(quickSelect, customFrom, customTo);
      const res = await fetch(`/api/reports/reps?from=${from}&to=${to}`);
      if (!res.ok) throw new Error("Failed to fetch rep analytics");
      const data = await res.json();
      setReps(data.reps || []);
      setCommissionRules(data.commissionRules || []);
      if (data.reps?.length > 0 && !selectedRepId) {
        setSelectedRepId(data.reps[0].id);
      }
    } catch {
      toast.error("Failed to load rep analytics");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (quickSelect !== "custom") fetchData();
  }, [quickSelect]);

  const handleCustomApply = () => {
    if (!customFrom || !customTo) return;
    fetchData();
  };

  const handleSelectRep = (id: string) => {
    setSelectedRepId(id);
    setSearch("");
    setSheetOpen(false);
  };

  const current = reps.find((r) => r.id === selectedRepId);

  useEffect(() => {
    setInvoicePage(1);
  }, [search, selectedRepId]);

  const filteredInvoices = useMemo(() => {
    if (!current) return [];
    const q = search.toLowerCase();
    if (!q) return current.invoices;
    return current.invoices.filter(
      (inv: any) =>
        inv.invoiceNo.toLowerCase().includes(q) ||
        inv.customer.toLowerCase().includes(q) ||
        inv.date.includes(q)
    );
  }, [current, search]);

  const pagedInvoices = filteredInvoices.slice(
    (invoicePage - 1) * PER_PAGE,
    invoicePage * PER_PAGE
  );

  // ── Date controls (reused in sidebar + mobile) ──────────────────────────
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

  // Status badge for invoice
  const InvStatusBadge = ({ inv }: { inv: any }) => {
    if (inv.isPaid) return <Badge className="text-[10px] bg-green-100 text-green-700 border-green-200 hover:bg-green-100">Paid</Badge>;
    if (inv.paid > 0) return <Badge className="text-[10px] bg-yellow-100 text-yellow-700 border-yellow-200 hover:bg-yellow-100">Partial</Badge>;
    return <Badge variant="secondary" className="text-[10px]">Unpaid</Badge>;
  };

  return (
    <div className="flex flex-col lg:flex-row h-full gap-0 -m-4 md:-m-8">

      {/* ── Desktop Sidebar (lg+) ──────────────────────────────────────── */}
      <aside className="hidden lg:flex w-64 shrink-0 bg-white border-r flex-col h-full overflow-hidden">
        <div className="p-4 border-b space-y-2">
          <div className="flex items-center gap-2 mb-1">
            <Users className="h-5 w-5 text-primary" />
            <h2 className="font-semibold text-sm">Sales Reps</h2>
          </div>
          <DateControls />
        </div>
        <div className="flex-1 overflow-y-auto">
          <RepList reps={reps} selected={selectedRepId} loading={loading} onSelect={handleSelectRep} />
        </div>
      </aside>

      {/* ── Mobile / Tablet top bar (< lg) ────────────────────────────── */}
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
                  <Users className="h-4 w-4 text-primary" />
                  Sales Reps
                </SheetTitle>
                <DateControls />
              </SheetHeader>
              <div className="flex-1 overflow-y-auto">
                <RepList reps={reps} selected={selectedRepId} loading={loading} onSelect={handleSelectRep} />
              </div>
            </SheetContent>
          </Sheet>

          <Select value={selectedRepId ?? ""} onValueChange={handleSelectRep}>
            <SelectTrigger className="h-8 text-xs flex-1 min-w-0">
              <Users className="mr-1 h-3 w-3 shrink-0" />
              <SelectValue placeholder="Select rep…" />
            </SelectTrigger>
            <SelectContent>
              {reps.map((r) => (
                <SelectItem key={r.id} value={r.id} className="text-xs">{r.name}</SelectItem>
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

      {/* ── Main Content ─────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 md:space-y-6">
        {!current ? (
          <div className="flex items-center justify-center h-64 text-muted-foreground">
            {loading ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : (
              <span className="text-sm">Select a sales rep to view analytics</span>
            )}
          </div>
        ) : (
          <>
            {/* Header */}
            <div>
              <h1 className="text-xl md:text-2xl font-bold leading-tight">{current.name}</h1>
              <p className="text-xs md:text-sm text-muted-foreground mt-1">
                {current.invoiceCount} invoices · {current.pendingCount} pending orders · delivered only
              </p>
            </div>

            {/* KPI Cards — 2 cols mobile, 3 cols md, 6 cols xl */}
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
              <Card>
                <CardHeader className="pb-1 pt-3 px-3">
                  <CardTitle className="text-[10px] text-muted-foreground font-medium flex items-center gap-1">
                    <DollarSign className="h-3 w-3" /> Total Sales
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-3 pb-3">
                  <div className="text-sm md:text-base font-bold">LKR {fmt(current.totalSales)}</div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">delivered invoices</p>
                </CardContent>
              </Card>

              <Card className="bg-green-50 border-green-200">
                <CardHeader className="pb-1 pt-3 px-3">
                  <CardTitle className="text-[10px] text-green-700 font-medium flex items-center gap-1">
                    <Banknote className="h-3 w-3" /> Collections
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-3 pb-3">
                  <div className="text-sm md:text-base font-bold text-green-700">LKR {fmt(current.totalCollections)}</div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">payments received</p>
                </CardContent>
              </Card>

              <Card className="bg-amber-50 border-amber-200">
                <CardHeader className="pb-1 pt-3 px-3">
                  <CardTitle className="text-[10px] text-amber-700 font-medium flex items-center gap-1">
                    <Clock className="h-3 w-3" /> Pending Orders
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-3 pb-3">
                  <div className="text-sm md:text-base font-bold text-amber-700">{current.pendingCount}</div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">LKR {fmt(current.pendingAmount)}</p>
                </CardContent>
              </Card>

              <Card className="bg-red-50 border-red-200">
                <CardHeader className="pb-1 pt-3 px-3">
                  <CardTitle className="text-[10px] text-red-700 font-medium flex items-center gap-1">
                    <ShoppingCart className="h-3 w-3" /> Outstanding
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-3 pb-3">
                  <div className="text-sm md:text-base font-bold text-red-700">
                    LKR {fmt(current.totalSales - current.totalCollections)}
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">uncollected amount</p>
                </CardContent>
              </Card>

              <Card className="bg-purple-50 border-purple-200">
                <CardHeader className="pb-1 pt-3 px-3">
                  <CardTitle className="text-[10px] text-purple-700 font-medium flex items-center gap-1">
                    <Award className="h-3 w-3" /> Commission Earned
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-3 pb-3">
                  <div className="text-sm md:text-base font-bold text-purple-700">LKR {fmt(current.commissionEarned)}</div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">from paid invoices</p>
                </CardContent>
              </Card>

              <Card className="bg-sky-50 border-sky-200">
                <CardHeader className="pb-1 pt-3 px-3">
                  <CardTitle className="text-[10px] text-sky-700 font-medium flex items-center gap-1">
                    <TrendingUp className="h-3 w-3" /> Commission Pending
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-3 pb-3">
                  <div className="text-sm md:text-base font-bold text-sky-700">LKR {fmt(current.commissionPending)}</div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">awaiting collection</p>
                </CardContent>
              </Card>
            </div>

            {/* Monthly Sales vs Collections Chart */}
            <Card>
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm">Monthly Sales vs Collections</CardTitle>
              </CardHeader>
              <CardContent className="px-2 md:px-4">
                {current.monthly.length === 0 ? (
                  <p className="text-center py-10 text-sm text-muted-foreground">No data for this period.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={current.monthly} barGap={2}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
                      <Tooltip formatter={(v: any) => `LKR ${fmt(v)}`} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Bar dataKey="sales" name="Sales" fill="#6366f1" radius={[3, 3, 0, 0]} />
                      <Bar dataKey="collections" name="Collections" fill="#22c55e" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Commission by Supplier Cards */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Award className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-semibold">Commission by Supplier</h2>
                {current.commissionBySupplier?.length > 0 && (
                  <Badge variant="secondary" className="text-[10px]">
                    {current.commissionBySupplier.length} suppliers
                  </Badge>
                )}
              </div>
              {!current.commissionBySupplier?.length ? (
                <Card>
                  <CardContent className="py-8 text-center text-sm text-muted-foreground">
                    No commission data for this period.
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
                  {current.commissionBySupplier.map((s: any) => (
                    <Card key={s.name} className="relative overflow-hidden">
                      <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-purple-400 to-sky-400" />
                      <CardContent className="pt-4 pb-4 px-4 space-y-3">
                        {/* Supplier name */}
                        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide truncate">
                          {s.name}
                        </p>

                        {/* Commission amount — big number */}
                        <div>
                          <p className="text-[10px] text-muted-foreground mb-0.5">Commission</p>
                          <p className="text-lg md:text-xl font-bold text-purple-600 leading-tight">
                            LKR {fmt(s.commission)}
                          </p>
                        </div>

                        <div className="border-t pt-2 space-y-1">
                          {/* Total sales */}
                          <div className="flex items-center justify-between">
                            <p className="text-[10px] text-muted-foreground">Total Sales</p>
                            <p className="text-xs font-semibold">LKR {fmt(s.sales)}</p>
                          </div>
                          {/* Effective rate */}
                          <div className="flex items-center justify-between">
                            <p className="text-[10px] text-muted-foreground">Rate</p>
                            <RateBadge rate={parseFloat(s.rate.toFixed(1))} />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>

            {/* Commission Rules Reference */}
            {commissionRules.length > 0 && (
              <Card>
                <CardHeader className="pb-2 pt-4 px-4">
                  <div className="flex items-center gap-2">
                    <Percent className="h-4 w-4 text-muted-foreground" />
                    <CardTitle className="text-xs text-muted-foreground font-medium">
                      Commission Rules Reference
                    </CardTitle>
                    <Badge variant="secondary" className="text-[10px]">{commissionRules.length}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <div className="flex flex-wrap gap-2">
                    {commissionRules.map((rule: any) => (
                      <div
                        key={rule.id}
                        className="flex items-center gap-1.5 bg-muted/40 rounded-md px-2.5 py-1.5 border text-xs"
                      >
                        <span className="font-medium text-muted-foreground">{rule.supplier_name}</span>
                        <span className="text-muted-foreground/50">·</span>
                        <span>{rule.category}{rule.sub_category ? ` / ${rule.sub_category}` : ""}</span>
                        <RateBadge rate={rule.rate} />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Invoices + Commission Detail Tabs */}
            <Card>
              <CardHeader className="pb-3 px-3 md:px-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <CardTitle className="text-sm truncate">{current.name} — Invoice Detail</CardTitle>
                  <div className="relative w-full sm:w-60">
                    <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      placeholder="Search invoices…"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="pl-7 h-8 text-xs"
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <Tabs defaultValue="invoices">
                  <div className="overflow-x-auto">
                    <TabsList className="mx-3 md:mx-4 mb-2 flex w-max min-w-full sm:w-auto">
                      <TabsTrigger value="invoices" className="text-xs gap-1 whitespace-nowrap">
                        <FileText className="h-3 w-3" />
                        Invoices ({filteredInvoices.length})
                      </TabsTrigger>
                      <TabsTrigger value="commission" className="text-xs gap-1 whitespace-nowrap">
                        <Award className="h-3 w-3" />
                        Commission Detail
                      </TabsTrigger>
                    </TabsList>
                  </div>

                  {/* Invoices Tab */}
                  <TabsContent value="invoices" className="mt-0">
                    {/* Mobile card list */}
                    <div className="sm:hidden divide-y">
                      {pagedInvoices.length === 0 ? (
                        <p className="text-center py-10 text-sm text-muted-foreground">No invoices found.</p>
                      ) : pagedInvoices.map((inv: any) => (
                        <div key={inv.orderId} className="p-3 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="font-medium text-sm">{inv.invoiceNo}</p>
                              <p className="text-xs text-muted-foreground truncate">{inv.date} · {inv.customer}</p>
                            </div>
                            <InvStatusBadge inv={inv} />
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
                          {inv.commission > 0 && (
                            <div className="flex items-center gap-2 text-xs pt-0.5">
                              <Award className="h-3 w-3 text-purple-500 shrink-0" />
                              <span className="text-muted-foreground">Commission:</span>
                              <span className={`font-semibold ${inv.commissionEarned > 0 ? "text-purple-600" : "text-sky-600"}`}>
                                LKR {fmt(inv.commission)}
                                <span className="font-normal text-muted-foreground ml-1">
                                  {inv.commissionEarned > 0 ? "(earned)" : "(pending)"}
                                </span>
                              </span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                    {/* Desktop table */}
                    <div className="hidden sm:block overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="min-w-[100px]">Invoice</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead>Customer</TableHead>
                            <TableHead className="text-right">Total</TableHead>
                            <TableHead className="text-right">Paid</TableHead>
                            <TableHead className="text-right hidden md:table-cell">Due</TableHead>
                            <TableHead className="text-right">Commission</TableHead>
                            <TableHead className="text-right">Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {pagedInvoices.map((inv: any) => (
                            <TableRow key={inv.orderId}>
                              <TableCell className="font-medium text-xs">{inv.invoiceNo}</TableCell>
                              <TableCell className="text-xs text-muted-foreground">{inv.date}</TableCell>
                              <TableCell className="text-xs">{inv.customer}</TableCell>
                              <TableCell className="text-right text-xs">LKR {fmt(inv.total)}</TableCell>
                              <TableCell className="text-right text-xs text-green-600">LKR {fmt(inv.paid)}</TableCell>
                              <TableCell className={`text-right text-xs hidden md:table-cell ${inv.due > 0 ? "text-red-600" : "text-muted-foreground"}`}>
                                {inv.due > 0 ? `LKR ${fmt(inv.due)}` : "—"}
                              </TableCell>
                              <TableCell className="text-right text-xs">
                                {inv.commission > 0 ? (
                                  <span className={inv.commissionEarned > 0 ? "text-purple-600 font-medium" : "text-sky-600 font-medium"}>
                                    LKR {fmt(inv.commission)}
                                  </span>
                                ) : <span className="text-muted-foreground">—</span>}
                              </TableCell>
                              <TableCell className="text-right">
                                <InvStatusBadge inv={inv} />
                              </TableCell>
                            </TableRow>
                          ))}
                          {filteredInvoices.length === 0 && (
                            <TableRow>
                              <TableCell colSpan={8} className="text-center h-20 text-muted-foreground text-sm">
                                No invoices found.
                              </TableCell>
                            </TableRow>
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

                  {/* Commission Detail Tab */}
                  <TabsContent value="commission" className="mt-0">
                    {/* Mobile card list */}
                    <div className="sm:hidden divide-y">
                      {current.invoices.length === 0 ? (
                        <p className="text-center py-10 text-sm text-muted-foreground">No commission data.</p>
                      ) : current.invoices.filter((inv: any) => inv.commission > 0).length === 0 ? (
                        <p className="text-center py-10 text-sm text-muted-foreground">No commission-eligible invoices.</p>
                      ) : current.invoices.filter((inv: any) => inv.commission > 0).map((inv: any) => (
                        <div key={inv.orderId} className="p-3 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="font-medium text-sm">{inv.invoiceNo}</p>
                              <p className="text-xs text-muted-foreground">{inv.date} · {inv.customer}</p>
                            </div>
                            <Badge
                              className={`text-[10px] shrink-0 ${
                                inv.commissionEarned > 0
                                  ? "bg-green-100 text-green-700 border-green-200 hover:bg-green-100"
                                  : "bg-sky-100 text-sky-700 border-sky-200 hover:bg-sky-100"
                              }`}
                            >
                              {inv.commissionEarned > 0 ? "Earned" : "Pending"}
                            </Badge>
                          </div>
                          <div className="grid grid-cols-3 gap-2 text-xs">
                            <div>
                              <p className="text-[10px] text-muted-foreground">Invoice Total</p>
                              <p className="font-medium">LKR {fmt(inv.total)}</p>
                            </div>
                            <div>
                              <p className="text-[10px] text-muted-foreground">Commission</p>
                              <p className="font-semibold text-purple-600">LKR {fmt(inv.commission)}</p>
                            </div>
                            <div>
                              <p className="text-[10px] text-muted-foreground">% of Invoice</p>
                              <p className="font-medium">
                                {inv.total > 0 ? ((inv.commission / inv.total) * 100).toFixed(1) : "0"}%
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    {/* Desktop table */}
                    <div className="hidden sm:block overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Invoice</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead>Customer</TableHead>
                            <TableHead className="text-right">Invoice Total</TableHead>
                            <TableHead className="text-right">Commission</TableHead>
                            <TableHead className="text-right">% of Invoice</TableHead>
                            <TableHead className="text-right">Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {current.invoices.filter((inv: any) => inv.commission > 0).map((inv: any) => (
                            <TableRow key={inv.orderId}>
                              <TableCell className="font-medium text-xs">{inv.invoiceNo}</TableCell>
                              <TableCell className="text-xs text-muted-foreground">{inv.date}</TableCell>
                              <TableCell className="text-xs">{inv.customer}</TableCell>
                              <TableCell className="text-right text-xs">LKR {fmt(inv.total)}</TableCell>
                              <TableCell className="text-right text-xs font-semibold text-purple-600">
                                LKR {fmt(inv.commission)}
                              </TableCell>
                              <TableCell className="text-right text-xs">
                                {inv.total > 0 ? ((inv.commission / inv.total) * 100).toFixed(1) : "0"}%
                              </TableCell>
                              <TableCell className="text-right">
                                <Badge
                                  className={`text-[10px] ${
                                    inv.commissionEarned > 0
                                      ? "bg-green-100 text-green-700 border-green-200 hover:bg-green-100"
                                      : "bg-sky-100 text-sky-700 border-sky-200 hover:bg-sky-100"
                                  }`}
                                >
                                  {inv.commissionEarned > 0 ? "Earned" : "Pending"}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                          {current.invoices.filter((inv: any) => inv.commission > 0).length === 0 && (
                            <TableRow>
                              <TableCell colSpan={7} className="text-center h-20 text-muted-foreground text-sm">
                                No commission-eligible invoices.
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
