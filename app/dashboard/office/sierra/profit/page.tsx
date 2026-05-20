"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  FileText,
  AlertCircle,
  Loader2,
  BarChart3,
  RefreshCw,
  Search,
  ChevronUp,
  ChevronDown,
  ArrowUpDown,
  Users,
  Package,
  Receipt,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useCachedFetch } from "@/hooks/useCachedFetch";
import { BUSINESS_IDS } from "@/app/config/business-constants";
import { getUserBusinessContext } from "@/app/middleware/businessAuth";

// ── Constants ────────────────────────────────────────────────────────────────

const COLORS = [
  "#8b5cf6", "#6d28d9", "#a78bfa", "#c4b5fd",
  "#7c3aed", "#4c1d95", "#ddd6fe", "#5b21b6",
];

const SIERRA_ID = BUSINESS_IDS.SIERRA_AGENCY;
const PAGE_SIZE = 15;

const CURRENT_YEAR = new Date().getFullYear();
const SELECTABLE_YEARS = Array.from({ length: 4 }, (_, i) => CURRENT_YEAR - i);

// ── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  new Intl.NumberFormat("en-LK", {
    style: "currency",
    currency: "LKR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);

const fmtK = (n: number) => {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(0)}k`;
  return n.toFixed(0);
};

const getDateRange = (period: string) => {
  const now = new Date();
  let from: Date, to: Date;

  if (/^\d{4}$/.test(period)) {
    const y = parseInt(period, 10);
    return {
      from: new Date(y, 0, 1).toISOString(),
      to: new Date(y, 11, 31, 23, 59, 59, 999).toISOString(),
    };
  }

  switch (period) {
    case "today":
      from = new Date(now); from.setHours(0, 0, 0, 0);
      to = new Date(now); to.setHours(23, 59, 59, 999);
      break;
    case "this-week":
      from = new Date(now); from.setDate(now.getDate() - now.getDay()); from.setHours(0, 0, 0, 0);
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
    default: // this-year
      from = new Date(now.getFullYear(), 0, 1);
      to = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
  }
  return { from: from.toISOString(), to: to.toISOString() };
};

const getPeriodLabel = (p: string) => {
  const map: Record<string, string> = {
    today: "Today",
    "this-week": "This Week",
    "this-month": "This Month",
    "last-month": "Last Month",
    "this-year": "This Year",
  };
  return map[p] ?? p;
};

// ── Colour variants ──────────────────────────────────────────────────────────

const colorVariants: Record<string, { border: string; iconBg: string; iconText: string; valueText: string }> = {
  purple: { border: "border-l-purple-400", iconBg: "bg-purple-100", iconText: "text-purple-600", valueText: "text-purple-700" },
  green:  { border: "border-l-green-400",  iconBg: "bg-green-100",  iconText: "text-green-600",  valueText: "text-green-700"  },
  red:    { border: "border-l-red-400",    iconBg: "bg-red-100",    iconText: "text-red-600",    valueText: "text-red-700"    },
  orange: { border: "border-l-orange-400", iconBg: "bg-orange-100", iconText: "text-orange-600", valueText: "text-orange-700" },
  blue:   { border: "border-l-blue-400",   iconBg: "bg-blue-100",   iconText: "text-blue-600",   valueText: "text-blue-700"   },
};

// ── Page Component ────────────────────────────────────────────────────────────

export default function SierraProfitPage() {
  const router = useRouter();
  const [period, setPeriod] = useState("this-year");
  const [activeTab, setActiveTab] = useState("overview");
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    const user = getUserBusinessContext();
    setIsAdmin(user?.role === "admin");
  }, []);

  // Live pending invoices (not date-filtered)
  const { data: unpaidInvoices = [] } = useCachedFetch<any[]>(
    `/api/invoices?businessId=${SIERRA_ID}&status=Unpaid`,
    [],
    () => {}
  );
  const { data: partialInvoices = [] } = useCachedFetch<any[]>(
    `/api/invoices?businessId=${SIERRA_ID}&status=Partial`,
    [],
    () => {}
  );

  const pendingInvoiceValue = [...(unpaidInvoices as any[]), ...(partialInvoices as any[])].reduce(
    (s, inv: any) => s + (Number(inv.dueAmount) || 0),
    0
  );
  const pendingInvoiceCount = (unpaidInvoices as any[]).length + (partialInvoices as any[]).length;

  // Invoice tab search + sort + pagination
  const [invSearch, setInvSearch] = useState("");
  const [invSortField, setInvSortField] = useState<"date" | "invoiceNo" | "customer" | "amount" | "dueAmount">("date");
  const [invSortDir, setInvSortDir] = useState<"asc" | "desc">("desc");
  const [invPage, setInvPage] = useState(1);

  const handleInvSort = (field: typeof invSortField) => {
    if (invSortField === field) {
      setInvSortDir(invSortDir === "asc" ? "desc" : "asc");
    } else {
      setInvSortField(field);
      setInvSortDir("desc");
    }
    setInvPage(1);
  };

  const sortedOrders = useMemo(() => {
    const orders: any[] = data?.orders ?? [];
    const q = invSearch.toLowerCase();
    const filtered = q
      ? orders.filter((o: any) =>
          (o.invoiceNo || "").toLowerCase().includes(q) ||
          (o.manualInvoiceNo || "").toLowerCase().includes(q) ||
          (o.customer || "").toLowerCase().includes(q)
        )
      : orders;

    return [...filtered].sort((a: any, b: any) => {
      let aVal: any, bVal: any;
      if (invSortField === "date") {
        aVal = new Date(a.date || 0).getTime();
        bVal = new Date(b.date || 0).getTime();
      } else if (invSortField === "amount" || invSortField === "dueAmount") {
        aVal = Number(a[invSortField]) || 0;
        bVal = Number(b[invSortField]) || 0;
      } else {
        aVal = (a[invSortField] || "").toLowerCase();
        bVal = (b[invSortField] || "").toLowerCase();
      }
      if (aVal < bVal) return invSortDir === "asc" ? -1 : 1;
      if (aVal > bVal) return invSortDir === "asc" ? 1 : -1;
      return 0;
    });
  }, [data?.orders, invSearch, invSortField, invSortDir]);

  const totalInvPages = Math.max(1, Math.ceil(sortedOrders.length / PAGE_SIZE));
  const displayOrders = sortedOrders.slice((invPage - 1) * PAGE_SIZE, invPage * PAGE_SIZE);

  useEffect(() => {
    if (isAdmin) { setInvPage(1); fetchReport(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, isAdmin]);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const { from, to } = getDateRange(period);
      const res = await fetch(`/api/reports/sierra?from=${from}&to=${to}`);
      if (!res.ok) throw new Error("Failed to fetch Sierra report");
      setData(await res.json());
    } catch {
      toast.error("Failed to load Sierra profit data");
    } finally {
      setLoading(false);
    }
  };

  if (isAdmin === null) {
    return (
      <div className="flex justify-center items-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center gap-4">
        <div className="h-16 w-16 rounded-full bg-red-100 flex items-center justify-center">
          <BarChart3 className="h-8 w-8 text-red-500" />
        </div>
        <h2 className="text-xl font-bold text-slate-800">Access Restricted</h2>
        <p className="text-muted-foreground max-w-sm text-sm">
          Profit Analytics is only available to administrators. Contact your admin if you need access.
        </p>
      </div>
    );
  }

  const overview = data?.overview ?? {
    totalSales: 0, orderCount: 0, totalProfit: 0, totalCost: 0,
    profitMargin: 0, totalExpenses: 0, expenseCount: 0,
  };
  const profitMonthly: any[] = data?.profitMonthly ?? [];
  const products: any[] = data?.products ?? [];
  const customers: any[] = data?.customers ?? [];
  const marginDist = data?.marginDistribution ?? { excellent: 0, good: 0, fair: 0, low: 0 };

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col gap-3">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">
          Profit Analytics
        </h1>
        <div className="flex items-center gap-2">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="h-8 w-36 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today" className="text-xs">Today</SelectItem>
              <SelectItem value="this-week" className="text-xs">This Week</SelectItem>
              <SelectItem value="this-month" className="text-xs">This Month</SelectItem>
              <SelectItem value="last-month" className="text-xs">Last Month</SelectItem>
              <SelectItem value="this-year" className="text-xs">This Year</SelectItem>
              {SELECTABLE_YEARS.map((y) => (
                <SelectItem key={y} value={String(y)} className="text-xs">{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={fetchReport} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          </Button>
          <span className="text-xs text-slate-500 flex items-center gap-1.5">
            <BarChart3 className="h-3.5 w-3.5" />
            Sierra Agency · {getPeriodLabel(period)}
          </span>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
        </div>
      ) : (
        <>
          {/* ── KPI Cards ── */}
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
            <KpiCard
              label="Total Revenue"
              value={fmt(overview.totalSales)}
              sub={`${overview.orderCount} invoices`}
              color="purple"
              icon={<DollarSign className="h-4 w-4" />}
            />
            <KpiCard
              label="Gross Profit"
              value={fmt(overview.totalProfit)}
              sub={`${overview.profitMargin.toFixed(1)}% margin`}
              color={overview.totalProfit >= 0 ? "green" : "red"}
              icon={<TrendingUp className="h-4 w-4" />}
            />
            <KpiCard
              label="Total Cost (COGS)"
              value={fmt(overview.totalCost)}
              sub="Cost of goods sold"
              color="orange"
              icon={<TrendingDown className="h-4 w-4" />}
            />
            <KpiCard
              label="Total Expenses"
              value={fmt(overview.totalExpenses)}
              sub={`${overview.expenseCount} expense records`}
              color="red"
              icon={<Receipt className="h-4 w-4" />}
            />
            <KpiCard
              label="Pending Invoices"
              value={fmt(pendingInvoiceValue)}
              sub={`${pendingInvoiceCount} unpaid bills`}
              color="red"
              icon={<FileText className="h-4 w-4" />}
            />
          </div>

          {/* ── Tabs ── */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="flex flex-wrap h-auto gap-1">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="customers">
                Customers
                <Badge className="ml-1.5 text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0">
                  {customers.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="products">
                Products
                <Badge className="ml-1.5 text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0">
                  {products.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="invoices">
                Invoices
                <Badge className="ml-1.5 text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0">
                  {(data?.orders ?? []).length}
                </Badge>
              </TabsTrigger>
            </TabsList>

            {/* ── Overview Tab ── */}
            <TabsContent value="overview" className="space-y-5 mt-5">
              <Card>
                <CardHeader>
                  <CardTitle>Revenue & Profit Trend</CardTitle>
                  <CardDescription>Monthly breakdown for selected period</CardDescription>
                </CardHeader>
                <CardContent>
                  {profitMonthly.length === 0 ? (
                    <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
                      No data for the selected period.
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height={300}>
                      <AreaChart data={profitMonthly}>
                        <defs>
                          <linearGradient id="gradRevenueSierra" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.18} />
                            <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="gradProfitSierra" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#22c55e" stopOpacity={0.18} />
                            <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                        <YAxis tickFormatter={fmtK} tick={{ fontSize: 11 }} />
                        <Tooltip formatter={(v: number | undefined) => fmt(Number(v) || 0)} />
                        <Legend />
                        <Area
                          type="monotone"
                          dataKey="revenue"
                          name="Revenue"
                          stroke="#8b5cf6"
                          fill="url(#gradRevenueSierra)"
                          strokeWidth={2}
                        />
                        <Area
                          type="monotone"
                          dataKey="profit"
                          name="Gross Profit"
                          stroke="#22c55e"
                          fill="url(#gradProfitSierra)"
                          strokeWidth={2}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              <div className="grid md:grid-cols-2 gap-5">
                {/* P&L Summary */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">P&L Summary</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <PLRow label="Total Revenue" value={overview.totalSales} />
                    <PLRow label="Cost of Goods Sold" value={-overview.totalCost} indent />
                    <PLRow label="Gross Profit" value={overview.totalProfit} bold />
                    <PLRow label="Operating Expenses" value={-overview.totalExpenses} indent />
                    <div className="border-t pt-3">
                      <PLRow
                        label="Net Profit (After Expenses)"
                        value={overview.totalProfit - overview.totalExpenses}
                        bold
                        highlight
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* Margin Distribution */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Profit Margin Distribution</CardTitle>
                    <CardDescription>Orders by profit margin range</CardDescription>
                  </CardHeader>
                  <CardContent className="grid grid-cols-2 gap-3 pt-2">
                    {[
                      { label: "Excellent (30%+)", count: marginDist.excellent, cls: "bg-green-50 border-green-200 text-green-700" },
                      { label: "Good (20–30%)", count: marginDist.good, cls: "bg-blue-50 border-blue-200 text-blue-700" },
                      { label: "Fair (10–20%)", count: marginDist.fair, cls: "bg-amber-50 border-amber-200 text-amber-700" },
                      { label: "Low (<10%)", count: marginDist.low, cls: "bg-red-50 border-red-200 text-red-700" },
                    ].map((item) => (
                      <div key={item.label} className={`rounded-lg border p-3 ${item.cls}`}>
                        <p className="text-xs font-medium">{item.label}</p>
                        <p className="text-3xl font-bold mt-1">{item.count}</p>
                        <p className="text-xs opacity-70">orders</p>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>

              {/* Pending snapshot */}
              <Card
                className="border-red-200 bg-red-50/30 cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => router.push("/dashboard/office/sierra/invoices/due")}
              >
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2 text-red-800">
                    <AlertCircle className="h-4 w-4" />
                    Outstanding Invoices
                  </CardTitle>
                  <CardDescription>Unpaid & partially paid bills</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-red-700">{fmt(pendingInvoiceValue)}</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {pendingInvoiceCount} invoice{pendingInvoiceCount !== 1 ? "s" : ""} awaiting payment
                  </p>
                  <div className="mt-3 pt-3 border-t border-red-200 flex gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Unpaid:</span>{" "}
                      <span className="font-semibold">{(unpaidInvoices as any[]).length}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Partial:</span>{" "}
                      <span className="font-semibold">{(partialInvoices as any[]).length}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── Customers Tab ── */}
            <TabsContent value="customers" className="space-y-5 mt-5">
              <div className="grid md:grid-cols-2 gap-5">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Top 10 by Revenue</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart data={customers.slice(0, 10)} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" tickFormatter={fmtK} tick={{ fontSize: 10 }} />
                        <YAxis
                          type="category"
                          dataKey="name"
                          width={110}
                          tick={{ fontSize: 10 }}
                          tickFormatter={(v: string) => v.length > 14 ? v.slice(0, 14) + "…" : v}
                        />
                        <Tooltip formatter={(v: number | undefined) => fmt(Number(v) || 0)} />
                        <Bar dataKey="totalSales" name="Revenue" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Revenue Share (Top 7)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={280}>
                      <PieChart>
                        <Pie
                          data={customers.slice(0, 7)}
                          dataKey="totalSales"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={100}
                          label={({ percent }: { percent?: number }) =>
                            (percent ?? 0) > 0.05 ? `${((percent ?? 0) * 100).toFixed(0)}%` : ""
                          }
                        >
                          {customers.slice(0, 7).map((_, i) => (
                            <Cell key={i} fill={COLORS[i % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v: number | undefined) => fmt(Number(v) || 0)} />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Customer Revenue & Due</CardTitle>
                  <CardDescription>{customers.length} customers · ranked by revenue</CardDescription>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-8">#</TableHead>
                        <TableHead>Shop Name</TableHead>
                        <TableHead className="text-right">Bills</TableHead>
                        <TableHead className="text-right">Total Sales</TableHead>
                        <TableHead className="text-right">Due Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {customers.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-muted-foreground py-10">
                            No customer data for this period
                          </TableCell>
                        </TableRow>
                      ) : (
                        customers.map((c, i) => (
                          <TableRow
                            key={c.name}
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => router.push("/dashboard/office/sierra/customers")}
                          >
                            <TableCell className="text-muted-foreground font-medium">
                              {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}
                            </TableCell>
                            <TableCell className="font-medium max-w-[180px] truncate">{c.name}</TableCell>
                            <TableCell className="text-right tabular-nums">{c.billCount}</TableCell>
                            <TableCell className="text-right font-mono tabular-nums text-purple-700 font-semibold">
                              {fmt(c.totalSales)}
                            </TableCell>
                            <TableCell className={`text-right font-mono tabular-nums font-semibold ${c.dueAmount > 0 ? "text-red-600" : "text-muted-foreground"}`}>
                              {c.dueAmount > 0 ? fmt(c.dueAmount) : "—"}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── Products Tab ── */}
            <TabsContent value="products" className="space-y-5 mt-5">
              <div className="grid md:grid-cols-2 gap-5">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Top 10 Products by Revenue</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart data={products.slice(0, 10)} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" tickFormatter={fmtK} tick={{ fontSize: 10 }} />
                        <YAxis
                          type="category"
                          dataKey="name"
                          width={110}
                          tick={{ fontSize: 10 }}
                          tickFormatter={(v: string) => v.length > 14 ? v.slice(0, 14) + "…" : v}
                        />
                        <Tooltip formatter={(v: number | undefined) => fmt(Number(v) || 0)} />
                        <Legend />
                        <Bar dataKey="revenue" name="Revenue" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                        <Bar dataKey="profit" name="Profit" fill="#22c55e" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Revenue Mix (Top 8 Products)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={280}>
                      <PieChart>
                        <Pie
                          data={products.slice(0, 8)}
                          dataKey="revenue"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={100}
                          label={({ percent }: { percent?: number }) =>
                            (percent ?? 0) > 0.05 ? `${((percent ?? 0) * 100).toFixed(0)}%` : ""
                          }
                        >
                          {products.slice(0, 8).map((_, i) => (
                            <Cell key={i} fill={COLORS[i % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v: number | undefined) => fmt(Number(v) || 0)} />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Product Profitability — Selling vs Cost</CardTitle>
                  <CardDescription>
                    {products.length} Sierra products sold · avg selling price, avg cost (FIFO), profit per unit
                  </CardDescription>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-8">#</TableHead>
                        <TableHead>Product</TableHead>
                        <TableHead className="text-right">Qty Sold</TableHead>
                        <TableHead className="text-right">Avg Selling</TableHead>
                        <TableHead className="text-right">Avg Cost</TableHead>
                        <TableHead className="text-right">Profit / Unit</TableHead>
                        <TableHead className="text-right">Total Revenue</TableHead>
                        <TableHead className="text-right">Total Profit</TableHead>
                        <TableHead className="text-right">Margin</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {products.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={9} className="text-center text-muted-foreground py-10">
                            No product data for this period
                          </TableCell>
                        </TableRow>
                      ) : (
                        products.slice(0, 30).map((p, i) => {
                          const avgSelling = p.qtySold > 0 ? p.revenue / p.qtySold : 0;
                          const avgCost = p.qtySold > 0 ? p.cost / p.qtySold : 0;
                          const profitUnit = avgSelling - avgCost;
                          return (
                            <TableRow
                              key={p.id}
                              className="cursor-pointer hover:bg-muted/50"
                              onClick={() => router.push(`/dashboard/office/sierra/products/${p.id}`)}
                            >
                              <TableCell className="text-muted-foreground font-medium">
                                {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}
                              </TableCell>
                              <TableCell>
                                <div className="font-medium max-w-40 truncate">{p.name}</div>
                                <div className="text-xs text-muted-foreground font-mono">{p.sku}</div>
                              </TableCell>
                              <TableCell className="text-right tabular-nums">{p.qtySold}</TableCell>
                              <TableCell className="text-right font-mono tabular-nums text-purple-700 font-semibold">
                                {fmt(avgSelling)}
                              </TableCell>
                              <TableCell className="text-right font-mono tabular-nums text-slate-500">
                                {fmt(avgCost)}
                              </TableCell>
                              <TableCell className={`text-right font-mono tabular-nums font-bold ${profitUnit >= 0 ? "text-green-600" : "text-red-600"}`}>
                                {fmt(profitUnit)}
                              </TableCell>
                              <TableCell className="text-right font-mono tabular-nums">
                                {fmt(p.revenue)}
                              </TableCell>
                              <TableCell className={`text-right font-mono tabular-nums font-semibold ${p.profit >= 0 ? "text-green-700" : "text-red-600"}`}>
                                {fmt(p.profit)}
                              </TableCell>
                              <TableCell className="text-right">
                                <MarginBadge margin={p.margin} />
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── Invoices Tab ── */}
            <TabsContent value="invoices" className="space-y-5 mt-5">
              {/* Summary KPIs */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <KpiCard
                  label="Total Invoices"
                  value={(data?.orders ?? []).length.toString()}
                  sub={getPeriodLabel(period)}
                  color="purple"
                  icon={<FileText className="h-4 w-4" />}
                />
                <KpiCard
                  label="Total Revenue"
                  value={fmt(overview.totalSales)}
                  sub="Invoice revenue"
                  color="purple"
                  icon={<DollarSign className="h-4 w-4" />}
                />
                <KpiCard
                  label="Total Profit"
                  value={fmt(overview.totalProfit)}
                  sub={`${overview.profitMargin.toFixed(1)}% margin`}
                  color={overview.totalProfit >= 0 ? "green" : "red"}
                  icon={<TrendingUp className="h-4 w-4" />}
                />
                <KpiCard
                  label="Total Due"
                  value={fmt((data?.dueInvoices ?? []).reduce((s: number, d: any) => s + d.dueAmount, 0))}
                  sub={`${(data?.dueInvoices ?? []).length} unpaid bills`}
                  color="red"
                  icon={<AlertCircle className="h-4 w-4" />}
                />
              </div>

              <Card>
                <CardHeader>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <CardTitle className="text-base">Invoice Detail</CardTitle>
                      <CardDescription>
                        {sortedOrders.length}{invSearch ? ` of ${(data?.orders ?? []).length}` : ""} invoice{sortedOrders.length !== 1 ? "s" : ""} · {getPeriodLabel(period)}
                        {totalInvPages > 1 && ` · Page ${invPage} of ${totalInvPages}`}
                      </CardDescription>
                    </div>
                    <div className="relative w-full sm:w-64">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      <Input
                        placeholder="Search invoice or customer…"
                        value={invSearch}
                        onChange={(e) => { setInvSearch(e.target.value); setInvPage(1); }}
                        className="pl-8 h-8 text-sm"
                      />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-8">#</TableHead>
                        {([
                          { key: "invoiceNo", label: "Invoice No", align: "left" },
                          { key: "date", label: "Date", align: "left" },
                          { key: "customer", label: "Customer", align: "left" },
                          { key: "amount", label: "Amount", align: "right" },
                          { key: "dueAmount", label: "Due", align: "right" },
                        ] as { key: typeof invSortField; label: string; align: string }[]).reduce<React.ReactNode[]>((cols, { key, label, align }) => {
                          cols.push(
                            <TableHead
                              key={key}
                              className={`${align === "right" ? "text-right" : ""} cursor-pointer select-none hover:text-foreground`}
                              onClick={() => handleInvSort(key)}
                            >
                              <span className={`inline-flex items-center gap-1 ${align === "right" ? "justify-end w-full" : ""}`}>
                                {label}
                                {invSortField === key
                                  ? invSortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
                                  : <ArrowUpDown className="h-3 w-3 opacity-40" />}
                              </span>
                            </TableHead>
                          );
                          if (key === "invoiceNo") {
                            cols.push(<TableHead key="manualInvoice">Manual Invoice</TableHead>);
                          }
                          return cols;
                        }, [])}
                        <TableHead className="text-right">Profit</TableHead>
                        <TableHead className="text-right">Margin</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {displayOrders.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={10} className="text-center text-muted-foreground py-10">
                            {invSearch ? "No invoices match your search" : "No invoices for this period"}
                          </TableCell>
                        </TableRow>
                      ) : (
                        displayOrders.map((o: any, i: number) => (
                          <TableRow
                            key={o.id}
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => router.push(`/dashboard/office/sierra/invoices/${o.id}`)}
                          >
                            <TableCell className="text-muted-foreground text-xs w-8">
                              {(invPage - 1) * PAGE_SIZE + i + 1}
                            </TableCell>
                            <TableCell className="font-mono text-xs font-semibold text-purple-700 whitespace-nowrap">
                              {o.invoiceNo || "—"}
                            </TableCell>
                            <TableCell className="font-mono text-xs text-slate-600 whitespace-nowrap">
                              {o.manualInvoiceNo || <span className="text-muted-foreground/40">—</span>}
                            </TableCell>
                            <TableCell className="text-xs text-slate-600 whitespace-nowrap">
                              {o.date ? new Date(o.date).toLocaleDateString("en-LK", { day: "numeric", month: "short", year: "2-digit" }) : "—"}
                            </TableCell>
                            <TableCell className="font-medium text-sm max-w-[150px] truncate">{o.customer}</TableCell>
                            <TableCell className="text-right font-mono tabular-nums text-sm font-semibold">
                              {fmt(o.amount)}
                            </TableCell>
                            <TableCell className={`text-right font-mono tabular-nums text-sm font-semibold ${o.dueAmount > 0 ? "text-red-600" : "text-muted-foreground"}`}>
                              {o.dueAmount > 0 ? fmt(o.dueAmount) : "—"}
                            </TableCell>
                            <TableCell className={`text-right font-mono tabular-nums text-sm font-semibold ${
                              o.profit === null ? "text-muted-foreground"
                              : o.profit >= 0 ? "text-green-700" : "text-red-600"
                            }`}>
                              {o.profit === null ? <span className="text-xs text-muted-foreground/50">—</span> : fmt(o.profit)}
                            </TableCell>
                            <TableCell className="text-right">
                              {o.profitMargin == null
                                ? <span className="text-xs text-muted-foreground/50">—</span>
                                : <MarginBadge margin={o.profitMargin} />}
                            </TableCell>
                            <TableCell>
                              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                                o.paymentStatus === "Paid" ? "bg-green-100 text-green-800"
                                : o.paymentStatus === "Partial" ? "bg-yellow-100 text-yellow-800"
                                : "bg-red-100 text-red-700"
                              }`}>
                                {o.paymentStatus}
                              </span>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>

                  {/* Pagination */}
                  {totalInvPages > 1 && (
                    <div className="flex items-center justify-between mt-4 pt-3 border-t">
                      <p className="text-xs text-muted-foreground">
                        Showing {(invPage - 1) * PAGE_SIZE + 1}–{Math.min(invPage * PAGE_SIZE, sortedOrders.length)} of {sortedOrders.length}
                      </p>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => setInvPage((p) => Math.max(1, p - 1))}
                          disabled={invPage === 1}
                        >
                          <ChevronLeft className="h-3.5 w-3.5" />
                        </Button>
                        {Array.from({ length: totalInvPages }, (_, i) => i + 1)
                          .filter((p) => p === 1 || p === totalInvPages || Math.abs(p - invPage) <= 1)
                          .reduce<(number | "…")[]>((acc, p, idx, arr) => {
                            if (idx > 0 && (arr[idx - 1] as number) !== p - 1) acc.push("…");
                            acc.push(p);
                            return acc;
                          }, [])
                          .map((p, idx) =>
                            p === "…" ? (
                              <span key={`ellipsis-${idx}`} className="px-1 text-xs text-muted-foreground">…</span>
                            ) : (
                              <Button
                                key={p}
                                variant={invPage === p ? "default" : "outline"}
                                size="icon"
                                className={`h-7 w-7 text-xs ${invPage === p ? "bg-purple-600 hover:bg-purple-700 text-white" : ""}`}
                                onClick={() => setInvPage(p as number)}
                              >
                                {p}
                              </Button>
                            )
                          )}
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => setInvPage((p) => Math.min(totalInvPages, p + 1))}
                          disabled={invPage === totalInvPages}
                        >
                          <ChevronRight className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, color, icon }: {
  label: string; value: string; sub: string; color: string; icon: React.ReactNode;
}) {
  const cv = colorVariants[color] ?? colorVariants.purple;
  return (
    <Card className={`border-l-4 ${cv.border}`}>
      <CardContent className="p-3 sm:p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] sm:text-xs font-medium text-muted-foreground uppercase tracking-wide truncate pr-1">
            {label}
          </span>
          <div className={`rounded-md p-1.5 shrink-0 ${cv.iconBg} ${cv.iconText}`}>{icon}</div>
        </div>
        <div className={`text-xl sm:text-2xl font-bold leading-none ${cv.valueText}`}>{value}</div>
        <p className="text-xs text-muted-foreground mt-1 truncate">{sub}</p>
      </CardContent>
    </Card>
  );
}

function PLRow({ label, value, indent, bold, highlight }: {
  label: string; value: number; indent?: boolean; bold?: boolean; highlight?: boolean;
}) {
  const isNeg = value < 0;
  return (
    <div className={`flex justify-between items-center ${indent ? "pl-4" : ""} ${bold ? "font-semibold" : ""} ${highlight ? "text-base" : "text-sm"}`}>
      <span className={highlight ? "text-slate-900" : "text-slate-600"}>{label}</span>
      <span className={`font-mono ${isNeg ? "text-red-600" : highlight ? "text-green-700" : "text-slate-800"}`}>
        {isNeg ? `-${fmt(-value)}` : fmt(value)}
      </span>
    </div>
  );
}

function MarginBadge({ margin }: { margin: number | null | undefined }) {
  const m = Number(margin) || 0;
  const cls =
    m >= 20 ? "bg-green-100 text-green-800"
    : m >= 10 ? "bg-yellow-100 text-yellow-800"
    : m >= 0 ? "bg-orange-100 text-orange-800"
    : "bg-red-100 text-red-800";
  return (
    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${cls}`}>
      {m.toFixed(1)}%
    </span>
  );
}
