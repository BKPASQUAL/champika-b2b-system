"use client";

import { useState, useEffect, useMemo } from "react";
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
  Package,
  Users,
  Truck,
  FileText,
  AlertCircle,
  Loader2,
  BarChart3,
  ShoppingBag,
  RefreshCw,
  Search,
  ChevronUp,
  ChevronDown,
  ArrowUpDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useCachedFetch } from "@/hooks/useCachedFetch";
import { BUSINESS_IDS } from "@/app/config/business-constants";
import { getUserBusinessContext } from "@/app/middleware/businessAuth";

// ── Constants ────────────────────────────────────────────────────────────────

const COLORS = [
  "#0088FE",
  "#00C49F",
  "#FFBB28",
  "#FF8042",
  "#8884D8",
  "#82ca9d",
  "#ffc658",
  "#a4de6c",
];

const DIST_ID = BUSINESS_IDS.CHAMPIKA_DISTRIBUTION;

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

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-LK", { day: "numeric", month: "short" });

const CURRENT_YEAR = new Date().getFullYear();
const SELECTABLE_YEARS = Array.from({ length: 4 }, (_, i) => CURRENT_YEAR - i);

const getDateRange = (period: string) => {
  const now = new Date();
  let from: Date, to: Date;

  if (/^\d{4}$/.test(period)) {
    const y = parseInt(period, 10);
    from = new Date(y, 0, 1);
    to = new Date(y, 11, 31, 23, 59, 59, 999);
    return { from: from.toISOString(), to: to.toISOString() };
  }

  switch (period) {
    case "today":
      from = new Date(now);
      from.setHours(0, 0, 0, 0);
      to = new Date(now);
      to.setHours(23, 59, 59, 999);
      break;
    case "this-week": {
      from = new Date(now);
      from.setDate(now.getDate() - now.getDay());
      from.setHours(0, 0, 0, 0);
      to = new Date(now);
      to.setHours(23, 59, 59, 999);
      break;
    }
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

// ── Colour variants ──────────────────────────────────────────────────────────

const colorVariants: Record<
  string,
  { border: string; iconBg: string; iconText: string; valueText: string }
> = {
  blue: {
    border: "border-l-blue-400",
    iconBg: "bg-blue-100",
    iconText: "text-blue-600",
    valueText: "text-blue-700",
  },
  green: {
    border: "border-l-green-400",
    iconBg: "bg-green-100",
    iconText: "text-green-600",
    valueText: "text-green-700",
  },
  red: {
    border: "border-l-red-400",
    iconBg: "bg-red-100",
    iconText: "text-red-600",
    valueText: "text-red-700",
  },
  orange: {
    border: "border-l-orange-400",
    iconBg: "bg-orange-100",
    iconText: "text-orange-600",
    valueText: "text-orange-700",
  },
  yellow: {
    border: "border-l-yellow-400",
    iconBg: "bg-yellow-100",
    iconText: "text-yellow-600",
    valueText: "text-yellow-700",
  },
  purple: {
    border: "border-l-purple-400",
    iconBg: "bg-purple-100",
    iconText: "text-purple-600",
    valueText: "text-purple-700",
  },
};

// ── Page Component ────────────────────────────────────────────────────────────

export default function DistributionProfitPage() {
  const [period, setPeriod] = useState("this-year");
  const [activeTab, setActiveTab] = useState("overview");
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    const user = getUserBusinessContext();
    setIsAdmin(user?.role === "admin");
  }, []);

  const [overview, setOverview] = useState<any>(null);
  const [monthly, setMonthly] = useState<any[]>([]);
  const [reps, setReps] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [deliveries, setDeliveries] = useState<any[]>([]);

  // All distribution invoices for the Invoices tab
  const { data: allInvoices = [] } = useCachedFetch<any[]>(
    `/api/invoices?businessId=${DIST_ID}`,
    [],
    () => {}
  );

  // Filter invoices by selected period
  const periodInvoices = useMemo(() => {
    const { from, to } = getDateRange(period);
    const fromTime = new Date(from).getTime();
    const toTime = new Date(to).getTime();
    return (allInvoices as any[]).filter((inv: any) => {
      const d = new Date(inv.date).getTime();
      return d >= fromTime && d <= toTime;
    }).sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [allInvoices, period]);

  const invoiceSummary = useMemo(() => {
    const totalRevenue = periodInvoices.reduce((s: number, inv: any) => s + (Number(inv.totalAmount) || 0), 0);
    const totalProfit = periodInvoices.reduce((s: number, inv: any) => s + (Number(inv.profit) || 0), 0);
    const totalCost = totalRevenue - totalProfit;
    const margin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;
    return { count: periodInvoices.length, totalRevenue, totalProfit, totalCost, margin };
  }, [periodInvoices]);

  // Invoice tab search + sort
  const [invSearch, setInvSearch] = useState("");
  const [invSortField, setInvSortField] = useState<"date" | "invoiceNo" | "customerName" | "salesRepName" | "totalAmount" | "profit" | "margin">("date");
  const [invSortDir, setInvSortDir] = useState<"asc" | "desc">("desc");

  const handleInvSort = (field: typeof invSortField) => {
    if (invSortField === field) {
      setInvSortDir(invSortDir === "asc" ? "desc" : "asc");
    } else {
      setInvSortField(field);
      setInvSortDir(field === "date" ? "desc" : "desc");
    }
  };

  const displayInvoices = useMemo(() => {
    const q = invSearch.toLowerCase();
    const filtered = q
      ? periodInvoices.filter((inv: any) =>
          (inv.invoiceNo || "").toLowerCase().includes(q) ||
          (inv.manualInvoiceNo || "").toLowerCase().includes(q) ||
          (inv.customerName || "").toLowerCase().includes(q) ||
          (inv.salesRepName || "").toLowerCase().includes(q)
        )
      : periodInvoices;

    return [...filtered].sort((a: any, b: any) => {
      let aVal: any, bVal: any;
      if (invSortField === "margin") {
        const aR = Number(a.totalAmount) || 0;
        const bR = Number(b.totalAmount) || 0;
        aVal = aR > 0 ? (Number(a.profit) / aR) * 100 : 0;
        bVal = bR > 0 ? (Number(b.profit) / bR) * 100 : 0;
      } else if (invSortField === "date") {
        aVal = new Date(a.date).getTime();
        bVal = new Date(b.date).getTime();
      } else {
        aVal = invSortField === "totalAmount" || invSortField === "profit"
          ? Number(a[invSortField]) || 0
          : (a[invSortField] || "").toLowerCase();
        bVal = invSortField === "totalAmount" || invSortField === "profit"
          ? Number(b[invSortField]) || 0
          : (b[invSortField] || "").toLowerCase();
      }
      if (aVal < bVal) return invSortDir === "asc" ? -1 : 1;
      if (aVal > bVal) return invSortDir === "asc" ? 1 : -1;
      return 0;
    });
  }, [periodInvoices, invSearch, invSortField, invSortDir]);

  // Live pending counts — scoped to distribution business only
  const { data: allOrders = [] } = useCachedFetch<any[]>(
    `/api/orders?businessId=${DIST_ID}`,
    [],
    () => {}
  );
  const { data: unpaidInvoices = [] } = useCachedFetch<any[]>(
    `/api/invoices?businessId=${DIST_ID}&status=Unpaid`,
    [],
    () => {}
  );
  const { data: partialInvoices = [] } = useCachedFetch<any[]>(
    `/api/invoices?businessId=${DIST_ID}&status=Partial`,
    [],
    () => {}
  );

  const pendingOrders = (allOrders as any[]).filter((o: any) =>
    ["Pending", "Processing", "Checking", "Loading"].includes(o.status)
  );
  const pendingOrdersValue = pendingOrders.reduce(
    (s: number, o: any) => s + (Number(o.totalAmount) || 0),
    0
  );
  const pendingInvoiceValue = [...(unpaidInvoices as any[]), ...(partialInvoices as any[])].reduce(
    (s: number, inv: any) => s + (Number(inv.dueAmount) || 0),
    0
  );
  const pendingInvoiceCount =
    (unpaidInvoices as any[]).length + (partialInvoices as any[]).length;

  useEffect(() => {
    fetchProfit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period]);

  // Auto-refresh when new payments or invoices are recorded
  useEffect(() => {
    const handler = () => fetchProfit();
    window.addEventListener("b2b:payment-mutated", handler);
    return () => window.removeEventListener("b2b:payment-mutated", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period]);

  const fetchProfit = async () => {
    setLoading(true);
    try {
      const { from, to } = getDateRange(period);
      const res = await fetch(
        `/api/reports?from=${from}&to=${to}&businessId=${DIST_ID}`
      );
      if (!res.ok) throw new Error("Failed to fetch profit data");
      const data = await res.json();

      setOverview(data.overview);
      setMonthly(data.monthly || []);
      setReps(
        (data.reps || []).map((r: any) => ({
          ...r,
          margin: r.revenue > 0 ? (r.profit / r.revenue) * 100 : 0,
        }))
      );
      setCustomers(
        (data.customers || []).map((c: any) => ({
          ...c,
          margin: c.revenue > 0 ? (c.profit / c.revenue) * 100 : 0,
          avgOrder: c.orders > 0 ? c.revenue / c.orders : 0,
        }))
      );
      setProducts(
        (data.products || []).map((p: any) => ({
          ...p,
          profit: p.revenue - p.cost,
          margin: p.revenue > 0 ? ((p.revenue - p.cost) / p.revenue) * 100 : 0,
        }))
      );
      setDeliveries(data.deliveries || []);
    } catch {
      toast.error("Failed to load profit data");
    } finally {
      setLoading(false);
    }
  };

  if (isAdmin === null) {
    return (
      <div className="flex justify-center items-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
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

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            Profit Analytics
          </h1>
          <p className="text-slate-500 mt-1 text-sm flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Distribution profitability · {getPeriodLabel(period)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="this-week">This Week</SelectItem>
              <SelectItem value="this-month">This Month</SelectItem>
              <SelectItem value="last-month">Last Month</SelectItem>
              <SelectItem value="this-year">This Year</SelectItem>
              {SELECTABLE_YEARS.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="icon"
            onClick={fetchProfit}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <>
          {/* ── KPI Cards ── */}
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
            <KpiCard
              label="Total Revenue"
              value={fmt(overview?.revenue ?? 0)}
              sub="From delivered orders"
              color="blue"
              icon={<DollarSign className="h-4 w-4" />}
            />
            <KpiCard
              label="Gross Profit"
              value={fmt(overview?.grossProfit ?? 0)}
              sub={`${(overview?.grossMargin ?? 0).toFixed(1)}% gross margin`}
              color="green"
              icon={<TrendingUp className="h-4 w-4" />}
            />
            <KpiCard
              label="Net Profit"
              value={fmt(overview?.netProfit ?? 0)}
              sub={`${(overview?.netMargin ?? 0).toFixed(1)}% net margin`}
              color={
                (overview?.netProfit ?? 0) >= 0 ? "green" : "red"
              }
              icon={<BarChart3 className="h-4 w-4" />}
            />
            <KpiCard
              label="Total Expenses"
              value={fmt(overview?.expenses ?? 0)}
              sub="Operational costs"
              color="orange"
              icon={<TrendingDown className="h-4 w-4" />}
            />
            <KpiCard
              label="Pending Invoices"
              value={fmt(pendingInvoiceValue)}
              sub={`${pendingInvoiceCount} unpaid bills`}
              color="red"
              icon={<FileText className="h-4 w-4" />}
            />
            <KpiCard
              label="Orders in Pipeline"
              value={fmt(pendingOrdersValue)}
              sub={`${pendingOrders.length} active orders`}
              color="yellow"
              icon={<ShoppingBag className="h-4 w-4" />}
            />
          </div>

          {/* ── Tabs ── */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="flex flex-wrap h-auto gap-1">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="reps">
                Rep Performance
                <Badge className="ml-1.5 text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0">
                  {reps.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="deliveries">
                Deliveries
                <Badge className="ml-1.5 text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0">
                  {deliveries.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="customers">
                Top Customers
                <Badge className="ml-1.5 text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0">
                  {customers.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="products">
                Top Products
                <Badge className="ml-1.5 text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0">
                  {products.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="invoices">
                Invoices
                <Badge className="ml-1.5 text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0">
                  {periodInvoices.length}
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
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={monthly}>
                      <defs>
                        <linearGradient id="gradRevenue" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#0088FE" stopOpacity={0.18} />
                          <stop offset="95%" stopColor="#0088FE" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="gradProfit" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#00C49F" stopOpacity={0.18} />
                          <stop offset="95%" stopColor="#00C49F" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis tickFormatter={fmtK} tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(v: number | undefined) => fmt(v ?? 0)} />
                      <Legend />
                      <Area
                        type="monotone"
                        dataKey="revenue"
                        name="Revenue"
                        stroke="#0088FE"
                        fill="url(#gradRevenue)"
                        strokeWidth={2}
                      />
                      <Area
                        type="monotone"
                        dataKey="grossProfit"
                        name="Gross Profit"
                        stroke="#00C49F"
                        fill="url(#gradProfit)"
                        strokeWidth={2}
                      />
                      <Area
                        type="monotone"
                        dataKey="netProfit"
                        name="Net Profit"
                        stroke="#FFBB28"
                        fill="none"
                        strokeWidth={2}
                        strokeDasharray="5 3"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <div className="grid md:grid-cols-2 gap-5">
                {/* P&L Summary */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">P&L Summary</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <PLRow label="Total Revenue" value={overview?.revenue ?? 0} />
                    <PLRow
                      label="Cost of Goods Sold"
                      value={-(overview?.cogs ?? 0)}
                      indent
                    />
                    <PLRow
                      label="Gross Profit"
                      value={overview?.grossProfit ?? 0}
                      bold
                    />
                    <PLRow
                      label="Operating Expenses"
                      value={-(overview?.expenses ?? 0)}
                      indent
                    />
                    <PLRow
                      label="Business Losses"
                      value={-(overview?.businessLoss ?? 0)}
                      indent
                    />
                    <div className="border-t pt-3">
                      <PLRow
                        label="Net Profit"
                        value={overview?.netProfit ?? 0}
                        bold
                        highlight
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* Monthly Order Volume */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Monthly Order Volume</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={monthly}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} />
                        <Tooltip />
                        <Bar
                          dataKey="orders"
                          name="Orders"
                          fill="#0088FE"
                          radius={[4, 4, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>

              {/* Pending snapshot */}
              <div className="grid sm:grid-cols-2 gap-5">
                <Card className="border-red-200 bg-red-50/30">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2 text-red-800">
                      <AlertCircle className="h-4 w-4" />
                      Pending Consumer Invoices
                    </CardTitle>
                    <CardDescription>
                      Outstanding unpaid & partial bills
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-bold text-red-700">
                      {fmt(pendingInvoiceValue)}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {pendingInvoiceCount} invoice
                      {pendingInvoiceCount !== 1 ? "s" : ""} awaiting payment
                    </p>
                    <div className="mt-3 pt-3 border-t border-red-200 flex gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Unpaid:</span>{" "}
                        <span className="font-semibold">
                          {(unpaidInvoices as any[]).length}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Partial:</span>{" "}
                        <span className="font-semibold">
                          {(partialInvoices as any[]).length}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-yellow-200 bg-yellow-50/30">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2 text-yellow-800">
                      <ShoppingBag className="h-4 w-4" />
                      Active Order Pipeline
                    </CardTitle>
                    <CardDescription>
                      Orders not yet delivered
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-bold text-yellow-700">
                      {fmt(pendingOrdersValue)}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {pendingOrders.length} order
                      {pendingOrders.length !== 1 ? "s" : ""} in progress
                    </p>
                    <div className="mt-3 pt-3 border-t border-yellow-200 flex flex-wrap gap-3 text-sm">
                      {["Pending", "Processing", "Checking", "Loading"].map((s) => {
                        const count = pendingOrders.filter((o: any) => o.status === s).length;
                        return (
                          <div key={s}>
                            <span className="text-muted-foreground">{s}:</span>{" "}
                            <span className="font-semibold">{count}</span>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* ── Rep Performance Tab ── */}
            <TabsContent value="reps" className="space-y-5 mt-5">
              <div className="grid md:grid-cols-2 gap-5">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Revenue vs Profit by Rep</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart data={reps.slice(0, 8)} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis
                          type="number"
                          tickFormatter={fmtK}
                          tick={{ fontSize: 10 }}
                        />
                        <YAxis
                          type="category"
                          dataKey="name"
                          width={90}
                          tick={{ fontSize: 11 }}
                        />
                        <Tooltip formatter={(v: number | undefined) => fmt(v ?? 0)} />
                        <Legend />
                        <Bar
                          dataKey="revenue"
                          name="Revenue"
                          fill="#0088FE"
                          radius={[0, 4, 4, 0]}
                        />
                        <Bar
                          dataKey="profit"
                          name="Profit"
                          fill="#00C49F"
                          radius={[0, 4, 4, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Profit Share by Rep</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={280}>
                      <PieChart>
                        <Pie
                          data={reps.filter((r) => r.profit > 0)}
                          dataKey="profit"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={100}
                          label={({ name, percent }: { name?: string; percent?: number }) =>
                            (percent ?? 0) > 0.06
                              ? `${(name ?? "").split(" ")[0]} ${((percent ?? 0) * 100).toFixed(0)}%`
                              : ""
                          }
                        >
                          {reps.map((_, i) => (
                            <Cell
                              key={i}
                              fill={COLORS[i % COLORS.length]}
                            />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v: number | undefined) => fmt(v ?? 0)} />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    Sales Rep Performance Detail
                  </CardTitle>
                  <CardDescription>
                    Ranked by revenue · {getPeriodLabel(period)}
                  </CardDescription>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>#</TableHead>
                        <TableHead>Rep Name</TableHead>
                        <TableHead className="text-right">Orders</TableHead>
                        <TableHead className="text-right">Customers</TableHead>
                        <TableHead className="text-right">Revenue</TableHead>
                        <TableHead className="text-right">Gross Profit</TableHead>
                        <TableHead className="text-right">Margin</TableHead>
                        <TableHead className="text-right">Losses</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {reps.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={8}
                            className="text-center text-muted-foreground py-10"
                          >
                            No rep data for this period
                          </TableCell>
                        </TableRow>
                      ) : (
                        reps.map((rep, i) => (
                          <TableRow key={rep.id}>
                            <TableCell className="text-muted-foreground font-medium w-8">
                              {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <div
                                  className="h-7 w-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                                  style={{
                                    backgroundColor: COLORS[i % COLORS.length],
                                  }}
                                >
                                  {(rep.name?.[0] ?? "?").toUpperCase()}
                                </div>
                                <span className="font-medium">{rep.name}</span>
                                {i === 0 && (
                                  <Badge className="bg-yellow-100 text-yellow-700 text-[10px] border-0">
                                    Top
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {rep.orders}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {rep.customers}
                            </TableCell>
                            <TableCell className="text-right font-mono tabular-nums">
                              {fmt(rep.revenue)}
                            </TableCell>
                            <TableCell className="text-right font-mono tabular-nums text-green-700">
                              {fmt(rep.profit)}
                            </TableCell>
                            <TableCell className="text-right">
                              <MarginBadge margin={rep.margin} />
                            </TableCell>
                            <TableCell className="text-right font-mono tabular-nums text-red-500">
                              {rep.loss > 0 ? fmt(rep.loss) : "—"}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── Deliveries Tab ── */}
            <TabsContent value="deliveries" className="space-y-5 mt-5">
              {deliveries.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Profit by Delivery Run</CardTitle>
                    <CardDescription>
                      Revenue & net profit per loading sheet
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={deliveries.slice(0, 15)}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="loadId" tick={{ fontSize: 10 }} />
                        <YAxis tickFormatter={fmtK} tick={{ fontSize: 10 }} />
                        <Tooltip formatter={(v: number | undefined) => fmt(v ?? 0)} />
                        <Legend />
                        <Bar
                          dataKey="revenue"
                          name="Revenue"
                          fill="#0088FE"
                          radius={[4, 4, 0, 0]}
                        />
                        <Bar
                          dataKey="netProfit"
                          name="Net Profit"
                          fill="#00C49F"
                          radius={[4, 4, 0, 0]}
                        />
                        <Bar
                          dataKey="expenses"
                          name="Expenses"
                          fill="#FF8042"
                          radius={[4, 4, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Delivery Runs Detail</CardTitle>
                  <CardDescription>
                    {deliveries.length} delivery run
                    {deliveries.length !== 1 ? "s" : ""} · {getPeriodLabel(period)}
                  </CardDescription>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Load ID</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Driver</TableHead>
                        <TableHead>Lorry</TableHead>
                        <TableHead className="text-right">Orders</TableHead>
                        <TableHead className="text-right">Revenue</TableHead>
                        <TableHead className="text-right">Expenses</TableHead>
                        <TableHead className="text-right">Net Profit</TableHead>
                        <TableHead className="text-right">Margin</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {deliveries.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={9}
                            className="text-center text-muted-foreground py-10"
                          >
                            No deliveries for this period
                          </TableCell>
                        </TableRow>
                      ) : (
                        deliveries.map((d) => (
                          <TableRow key={d.id}>
                            <TableCell className="font-mono text-xs text-slate-600">
                              {d.loadId}
                            </TableCell>
                            <TableCell>{fmtDate(d.date)}</TableCell>
                            <TableCell>{d.driver}</TableCell>
                            <TableCell>{d.lorry || "—"}</TableCell>
                            <TableCell className="text-right tabular-nums">
                              {d.ordersCount}
                            </TableCell>
                            <TableCell className="text-right font-mono tabular-nums">
                              {fmt(d.revenue)}
                            </TableCell>
                            <TableCell className="text-right font-mono tabular-nums text-orange-600">
                              {d.expenses > 0 ? fmt(d.expenses) : "—"}
                            </TableCell>
                            <TableCell
                              className={`text-right font-mono tabular-nums font-semibold ${
                                d.netProfit >= 0
                                  ? "text-green-700"
                                  : "text-red-600"
                              }`}
                            >
                              {fmt(d.netProfit)}
                            </TableCell>
                            <TableCell className="text-right">
                              <MarginBadge margin={d.margin} />
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── Top Customers Tab ── */}
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
                        <XAxis
                          type="number"
                          tickFormatter={fmtK}
                          tick={{ fontSize: 10 }}
                        />
                        <YAxis
                          type="category"
                          dataKey="name"
                          width={110}
                          tick={{ fontSize: 10 }}
                        />
                        <Tooltip formatter={(v: number | undefined) => fmt(v ?? 0)} />
                        <Legend />
                        <Bar
                          dataKey="revenue"
                          name="Revenue"
                          fill="#0088FE"
                          radius={[0, 4, 4, 0]}
                        />
                        <Bar
                          dataKey="profit"
                          name="Profit"
                          fill="#00C49F"
                          radius={[0, 4, 4, 0]}
                        />
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
                          dataKey="revenue"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={100}
                          label={({ percent }: { percent?: number }) =>
                            (percent ?? 0) > 0.05
                              ? `${((percent ?? 0) * 100).toFixed(0)}%`
                              : ""
                          }
                        >
                          {customers.slice(0, 7).map((_, i) => (
                            <Cell key={i} fill={COLORS[i % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v: number | undefined) => fmt(v ?? 0)} />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    Customer Profitability Details
                  </CardTitle>
                  <CardDescription>
                    {customers.length} customers · ranked by revenue
                  </CardDescription>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-8">#</TableHead>
                        <TableHead>Shop Name</TableHead>
                        <TableHead className="text-right">Orders</TableHead>
                        <TableHead className="text-right">Revenue</TableHead>
                        <TableHead className="text-right">Avg Order</TableHead>
                        <TableHead className="text-right">Profit</TableHead>
                        <TableHead className="text-right">Margin</TableHead>
                        <TableHead className="text-right">Losses</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {customers.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={8}
                            className="text-center text-muted-foreground py-10"
                          >
                            No customer data for this period
                          </TableCell>
                        </TableRow>
                      ) : (
                        customers.slice(0, 25).map((c, i) => (
                          <TableRow key={c.id}>
                            <TableCell className="text-muted-foreground font-medium">
                              {i === 0
                                ? "🥇"
                                : i === 1
                                ? "🥈"
                                : i === 2
                                ? "🥉"
                                : i + 1}
                            </TableCell>
                            <TableCell className="font-medium">
                              {c.name}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {c.orders}
                            </TableCell>
                            <TableCell className="text-right font-mono tabular-nums">
                              {fmt(c.revenue)}
                            </TableCell>
                            <TableCell className="text-right font-mono tabular-nums text-slate-500">
                              {fmt(c.avgOrder)}
                            </TableCell>
                            <TableCell className="text-right font-mono tabular-nums text-green-700">
                              {fmt(c.profit)}
                            </TableCell>
                            <TableCell className="text-right">
                              <MarginBadge margin={c.margin} />
                            </TableCell>
                            <TableCell className="text-right font-mono tabular-nums text-red-500">
                              {c.loss > 0 ? fmt(c.loss) : "—"}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── Top Products Tab ── */}
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
                        <XAxis
                          type="number"
                          tickFormatter={fmtK}
                          tick={{ fontSize: 10 }}
                        />
                        <YAxis
                          type="category"
                          dataKey="name"
                          width={110}
                          tick={{ fontSize: 10 }}
                        />
                        <Tooltip formatter={(v: number | undefined) => fmt(v ?? 0)} />
                        <Legend />
                        <Bar
                          dataKey="revenue"
                          name="Revenue"
                          fill="#0088FE"
                          radius={[0, 4, 4, 0]}
                        />
                        <Bar
                          dataKey="profit"
                          name="Profit"
                          fill="#00C49F"
                          radius={[0, 4, 4, 0]}
                        />
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
                            (percent ?? 0) > 0.05
                              ? `${((percent ?? 0) * 100).toFixed(0)}%`
                              : ""
                          }
                        >
                          {products.slice(0, 8).map((_, i) => (
                            <Cell key={i} fill={COLORS[i % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v: number | undefined) => fmt(v ?? 0)} />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Product Profitability</CardTitle>
                  <CardDescription>
                    {products.length} products sold · ranked by revenue
                  </CardDescription>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-8">#</TableHead>
                        <TableHead>Product</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead className="text-right">Units Sold</TableHead>
                        <TableHead className="text-right">Revenue</TableHead>
                        <TableHead className="text-right">Cost</TableHead>
                        <TableHead className="text-right">Gross Profit</TableHead>
                        <TableHead className="text-right">Margin</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {products.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={8}
                            className="text-center text-muted-foreground py-10"
                          >
                            No product data for this period
                          </TableCell>
                        </TableRow>
                      ) : (
                        products.slice(0, 30).map((p, i) => (
                          <TableRow key={p.id}>
                            <TableCell className="text-muted-foreground font-medium">
                              {i === 0
                                ? "🥇"
                                : i === 1
                                ? "🥈"
                                : i === 2
                                ? "🥉"
                                : i + 1}
                            </TableCell>
                            <TableCell className="font-medium max-w-[160px] truncate">
                              {p.name}
                            </TableCell>
                            <TableCell>
                              {p.category ? (
                                <Badge
                                  variant="outline"
                                  className="text-[10px]"
                                >
                                  {p.category}
                                </Badge>
                              ) : (
                                "—"
                              )}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {p.sold.toLocaleString()}
                            </TableCell>
                            <TableCell className="text-right font-mono tabular-nums">
                              {fmt(p.revenue)}
                            </TableCell>
                            <TableCell className="text-right font-mono tabular-nums text-orange-600">
                              {fmt(p.cost)}
                            </TableCell>
                            <TableCell className="text-right font-mono tabular-nums text-green-700">
                              {fmt(p.profit)}
                            </TableCell>
                            <TableCell className="text-right">
                              <MarginBadge margin={p.margin} />
                            </TableCell>
                          </TableRow>
                        ))
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
                  value={invoiceSummary.count.toString()}
                  sub={`${getPeriodLabel(period)}`}
                  color="blue"
                  icon={<FileText className="h-4 w-4" />}
                />
                <KpiCard
                  label="Total Revenue"
                  value={fmt(invoiceSummary.totalRevenue)}
                  sub="Invoice revenue"
                  color="blue"
                  icon={<DollarSign className="h-4 w-4" />}
                />
                <KpiCard
                  label="Total Profit"
                  value={fmt(invoiceSummary.totalProfit)}
                  sub={`${invoiceSummary.margin.toFixed(1)}% margin`}
                  color={invoiceSummary.totalProfit >= 0 ? "green" : "red"}
                  icon={<TrendingUp className="h-4 w-4" />}
                />
                <KpiCard
                  label="Total Cost"
                  value={fmt(invoiceSummary.totalCost)}
                  sub="Cost of goods sold"
                  color="orange"
                  icon={<TrendingDown className="h-4 w-4" />}
                />
              </div>

              {/* Invoice Table */}
              <Card>
                <CardHeader>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <CardTitle className="text-base">Invoice Profit Detail</CardTitle>
                      <CardDescription>
                        {displayInvoices.length}{invSearch ? ` of ${periodInvoices.length}` : ""} invoice{periodInvoices.length !== 1 ? "s" : ""} · {getPeriodLabel(period)}
                      </CardDescription>
                    </div>
                    <div className="relative w-full sm:w-64">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      <Input
                        placeholder="Search invoice, customer, rep…"
                        value={invSearch}
                        onChange={(e) => setInvSearch(e.target.value)}
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
                        {(
                          [
                            { key: "invoiceNo", label: "Invoice No", align: "left" },
                            { key: "date", label: "Date", align: "left" },
                            { key: "customerName", label: "Customer", align: "left" },
                            { key: "salesRepName", label: "Sales Rep", align: "left" },
                            { key: "totalAmount", label: "Revenue", align: "right" },
                            { key: "profit", label: "Cost", align: "right", noSort: true },
                            { key: "profit", label: "Profit", align: "right" },
                            { key: "margin", label: "Margin", align: "right" },
                          ] as { key: typeof invSortField; label: string; align: string; noSort?: boolean }[]
                        ).map(({ key, label, align, noSort }) => (
                          <TableHead
                            key={`${key}-${label}`}
                            className={`${align === "right" ? "text-right" : ""} ${!noSort ? "cursor-pointer select-none hover:text-foreground" : ""}`}
                            onClick={noSort ? undefined : () => handleInvSort(key)}
                          >
                            <span className={`inline-flex items-center gap-1 ${align === "right" ? "justify-end w-full" : ""}`}>
                              {label}
                              {!noSort && (
                                invSortField === key
                                  ? invSortDir === "asc"
                                    ? <ChevronUp className="h-3 w-3" />
                                    : <ChevronDown className="h-3 w-3" />
                                  : <ArrowUpDown className="h-3 w-3 opacity-40" />
                              )}
                            </span>
                          </TableHead>
                        ))}
                        <TableHead>Order Status</TableHead>
                        <TableHead>Payment</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {displayInvoices.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={11} className="text-center text-muted-foreground py-10">
                            {invSearch ? "No invoices match your search" : "No invoices for this period"}
                          </TableCell>
                        </TableRow>
                      ) : (
                        displayInvoices.map((inv: any, i: number) => {
                          const revenue = Number(inv.totalAmount) || 0;
                          const profit = Number(inv.profit) || 0;
                          const cost = revenue - profit;
                          const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
                          return (
                            <TableRow key={inv.id}>
                              <TableCell className="text-muted-foreground font-medium w-8 text-xs">
                                {i + 1}
                              </TableCell>
                              <TableCell className="font-mono text-xs font-semibold text-blue-700">
                                {inv.invoiceNo}
                                {inv.manualInvoiceNo && (
                                  <div className="text-[10px] text-slate-400 font-normal">
                                    {inv.manualInvoiceNo}
                                  </div>
                                )}
                              </TableCell>
                              <TableCell className="text-xs text-slate-600 whitespace-nowrap">
                                {fmtDate(inv.date)}
                              </TableCell>
                              <TableCell className="font-medium text-sm max-w-[150px] truncate">
                                {inv.customerName}
                              </TableCell>
                              <TableCell className="text-sm text-slate-600">
                                {inv.salesRepName}
                              </TableCell>
                              <TableCell className="text-right font-mono tabular-nums text-sm">
                                {fmt(revenue)}
                              </TableCell>
                              <TableCell className="text-right font-mono tabular-nums text-sm text-orange-600">
                                {fmt(cost)}
                              </TableCell>
                              <TableCell className={`text-right font-mono tabular-nums text-sm font-semibold ${profit >= 0 ? "text-green-700" : "text-red-600"}`}>
                                {fmt(profit)}
                              </TableCell>
                              <TableCell className="text-right">
                                <MarginBadge margin={margin} />
                              </TableCell>
                              <TableCell>
                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                                  inv.orderStatus === "Delivered" || inv.orderStatus === "Completed"
                                    ? "bg-green-100 text-green-800"
                                    : inv.orderStatus === "Cancelled"
                                    ? "bg-red-100 text-red-700"
                                    : "bg-slate-100 text-slate-600"
                                }`}>
                                  {inv.orderStatus}
                                </span>
                              </TableCell>
                              <TableCell>
                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                                  inv.status === "Paid"
                                    ? "bg-green-100 text-green-800"
                                    : inv.status === "Partial"
                                    ? "bg-yellow-100 text-yellow-800"
                                    : inv.status === "Overdue"
                                    ? "bg-red-100 text-red-700"
                                    : "bg-slate-100 text-slate-600"
                                }`}>
                                  {inv.status}
                                </span>
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
          </Tabs>
        </>
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  sub,
  color,
  icon,
}: {
  label: string;
  value: string;
  sub: string;
  color: string;
  icon: React.ReactNode;
}) {
  const cv = colorVariants[color] ?? colorVariants.blue;
  return (
    <Card className={`border-l-4 ${cv.border}`}>
      <CardContent className="p-3 sm:p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] sm:text-xs font-medium text-muted-foreground uppercase tracking-wide truncate pr-1">
            {label}
          </span>
          <div
            className={`rounded-md p-1.5 shrink-0 ${cv.iconBg} ${cv.iconText}`}
          >
            {icon}
          </div>
        </div>
        <div className={`text-xl sm:text-2xl font-bold leading-none ${cv.valueText}`}>
          {value}
        </div>
        <p className="text-xs text-muted-foreground mt-1 truncate">{sub}</p>
      </CardContent>
    </Card>
  );
}

function PLRow({
  label,
  value,
  indent,
  bold,
  highlight,
}: {
  label: string;
  value: number;
  indent?: boolean;
  bold?: boolean;
  highlight?: boolean;
}) {
  const isNeg = value < 0;
  return (
    <div
      className={`flex justify-between items-center ${indent ? "pl-4" : ""} ${
        bold ? "font-semibold" : ""
      } ${highlight ? "text-base" : "text-sm"}`}
    >
      <span className={highlight ? "text-slate-900" : "text-slate-600"}>
        {label}
      </span>
      <span
        className={`font-mono ${
          isNeg
            ? "text-red-600"
            : highlight
            ? "text-green-700"
            : "text-slate-800"
        }`}
      >
        {isNeg ? `-${fmt(-value)}` : fmt(value)}
      </span>
    </div>
  );
}

function MarginBadge({ margin }: { margin: number }) {
  const cls =
    margin >= 20
      ? "bg-green-100 text-green-800"
      : margin >= 10
      ? "bg-yellow-100 text-yellow-800"
      : margin >= 0
      ? "bg-orange-100 text-orange-800"
      : "bg-red-100 text-red-800";
  return (
    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${cls}`}>
      {margin.toFixed(1)}%
    </span>
  );
}
