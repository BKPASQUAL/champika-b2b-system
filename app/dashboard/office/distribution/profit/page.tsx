"use client";

import { useState, useEffect } from "react";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useCachedFetch } from "@/hooks/useCachedFetch";
import { BUSINESS_IDS } from "@/app/config/business-constants";

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

const getDateRange = (period: string) => {
  const now = new Date();
  let from: Date, to: Date;
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

  const [overview, setOverview] = useState<any>(null);
  const [monthly, setMonthly] = useState<any[]>([]);
  const [reps, setReps] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [deliveries, setDeliveries] = useState<any[]>([]);

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

  const periodLabel: Record<string, string> = {
    today: "Today",
    "this-week": "This Week",
    "this-month": "This Month",
    "last-month": "Last Month",
    "this-year": "This Year",
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
            Distribution profitability · {periodLabel[period]}
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
                      <Tooltip formatter={(v: number) => fmt(v)} />
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
                        <Tooltip formatter={(v: number) => fmt(v)} />
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
                          label={({ name, percent }) =>
                            percent > 0.06
                              ? `${name.split(" ")[0]} ${(percent * 100).toFixed(0)}%`
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
                        <Tooltip formatter={(v: number) => fmt(v)} />
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
                    Ranked by revenue · {periodLabel[period]}
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
                        <Tooltip formatter={(v: number) => fmt(v)} />
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
                    {deliveries.length !== 1 ? "s" : ""} · {periodLabel[period]}
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
                        <Tooltip formatter={(v: number) => fmt(v)} />
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
                          label={({ percent }) =>
                            percent > 0.05
                              ? `${(percent * 100).toFixed(0)}%`
                              : ""
                          }
                        >
                          {customers.slice(0, 7).map((_, i) => (
                            <Cell key={i} fill={COLORS[i % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v: number) => fmt(v)} />
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
                        <Tooltip formatter={(v: number) => fmt(v)} />
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
                          label={({ percent }) =>
                            percent > 0.05
                              ? `${(percent * 100).toFixed(0)}%`
                              : ""
                          }
                        >
                          {products.slice(0, 8).map((_, i) => (
                            <Cell key={i} fill={COLORS[i % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v: number) => fmt(v)} />
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
