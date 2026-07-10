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
  DollarSign,
  TrendingUp,
  TrendingDown,
  Package,
  BarChart3,
  Loader2,
  RefreshCw,
  Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { BUSINESS_IDS } from "@/app/config/business-constants";

const RETAIL_ID = BUSINESS_IDS.CHAMPIKA_RETAIL;
const COLORS = ["#16a34a", "#0088FE", "#FFBB28", "#FF8042", "#8884D8", "#82ca9d"];

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
  switch (period) {
    case "today":
      from = new Date(now);
      from.setHours(0, 0, 0, 0);
      to = new Date(now);
      to.setHours(23, 59, 59, 999);
      break;
    case "this-week":
      from = new Date(now);
      from.setDate(now.getDate() - now.getDay());
      from.setHours(0, 0, 0, 0);
      to = new Date(now);
      to.setHours(23, 59, 59, 999);
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
      <span className={highlight ? "text-slate-900" : "text-slate-600"}>{label}</span>
      <span
        className={`font-mono ${
          isNeg ? "text-red-600" : highlight ? "text-green-700" : "text-slate-800"
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

export default function RetailRevenueReportPage() {
  const [period, setPeriod] = useState("this-year");
  const [activeTab, setActiveTab] = useState("overview");
  const [loading, setLoading] = useState(true);

  const [overview, setOverview] = useState<any>(null);
  const [monthly, setMonthly] = useState<any[]>([]);
  const [expensesByCategory, setExpensesByCategory] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);

  // All-time monthly figures, used by the Monthly & Yearly tabs — independent
  // of the period selector above, which only scopes the Overview/Products/Customers tabs.
  const [allTimeMonthly, setAllTimeMonthly] = useState<any[]>([]);
  const [allTimeLoading, setAllTimeLoading] = useState(true);

  useEffect(() => {
    fetchRevenue();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period]);

  useEffect(() => {
    fetchAllTime();
  }, []);

  const fetchAllTime = async () => {
    setAllTimeLoading(true);
    try {
      const from = new Date(2000, 0, 1).toISOString();
      const to = new Date(new Date().getFullYear() + 1, 0, 0, 23, 59, 59).toISOString();
      const res = await fetch(`/api/reports?from=${from}&to=${to}&businessId=${RETAIL_ID}`);
      if (!res.ok) throw new Error("Failed to fetch all-time revenue data");
      const data = await res.json();
      setAllTimeMonthly(data.monthly || []);
    } catch {
      toast.error("Failed to load monthly/yearly history");
    } finally {
      setAllTimeLoading(false);
    }
  };

  const yearlyBreakdown = useMemo(() => {
    const map: Record<
      string,
      { year: string; revenue: number; netProfit: number; orders: number }
    > = {};
    allTimeMonthly.forEach((m: any) => {
      const year = m.key.slice(0, 4);
      if (!map[year]) map[year] = { year, revenue: 0, netProfit: 0, orders: 0 };
      map[year].revenue += m.revenue || 0;
      map[year].netProfit += m.netProfit || 0;
      map[year].orders += m.orders || 0;
    });
    return Object.values(map).sort((a, b) => a.year.localeCompare(b.year));
  }, [allTimeMonthly]);

  const fetchRevenue = async () => {
    setLoading(true);
    try {
      const { from, to } = getDateRange(period);
      const res = await fetch(`/api/reports?from=${from}&to=${to}&businessId=${RETAIL_ID}`);
      if (!res.ok) throw new Error("Failed to fetch revenue data");
      const data = await res.json();

      setOverview(data.overview);
      setMonthly(data.monthly || []);
      setExpensesByCategory(data.expensesByCategory || []);
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
    } catch {
      toast.error("Failed to load revenue data");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-green-950">
            Revenue Reports
          </h1>
          <p className="text-muted-foreground mt-1 text-sm flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Revenue and profit analysis · {getPeriodLabel(period)}
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
          <Button variant="outline" size="icon" onClick={fetchRevenue} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-green-600" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <Card className="border-l-4 border-l-blue-400">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Revenue
                  </span>
                  <DollarSign className="h-4 w-4 text-blue-600" />
                </div>
                <div className="text-xl font-bold text-blue-700">
                  {fmt(overview?.revenue ?? 0)}
                </div>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-orange-400">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Cost of Goods
                  </span>
                  <Package className="h-4 w-4 text-orange-600" />
                </div>
                <div className="text-xl font-bold text-orange-700">
                  {fmt(overview?.cogs ?? 0)}
                </div>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-green-400">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Gross Profit
                  </span>
                  <TrendingUp className="h-4 w-4 text-green-600" />
                </div>
                <div className="text-xl font-bold text-green-700">
                  {fmt(overview?.grossProfit ?? 0)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {(overview?.grossMargin ?? 0).toFixed(1)}% margin
                </p>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-red-400">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Expenses
                  </span>
                  <TrendingDown className="h-4 w-4 text-red-600" />
                </div>
                <div className="text-xl font-bold text-red-700">
                  {fmt(overview?.expenses ?? 0)}
                </div>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-green-600 bg-green-50/40">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Net Profit
                  </span>
                  <BarChart3 className="h-4 w-4 text-green-700" />
                </div>
                <div
                  className={`text-xl font-bold ${
                    (overview?.netProfit ?? 0) >= 0 ? "text-green-700" : "text-red-600"
                  }`}
                >
                  {fmt(overview?.netProfit ?? 0)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {(overview?.netMargin ?? 0).toFixed(1)}% margin
                </p>
              </CardContent>
            </Card>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="monthly">Monthly</TabsTrigger>
              <TabsTrigger value="yearly">Yearly</TabsTrigger>
              <TabsTrigger value="products">Top Products</TabsTrigger>
              <TabsTrigger value="customers">Top Customers</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-5 mt-5">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Revenue & Profit Trend</CardTitle>
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
                          <stop offset="5%" stopColor="#16a34a" stopOpacity={0.18} />
                          <stop offset="95%" stopColor="#16a34a" stopOpacity={0} />
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
                        dataKey="netProfit"
                        name="Net Profit"
                        stroke="#16a34a"
                        fill="url(#gradProfit)"
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <div className="grid md:grid-cols-2 gap-5">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">P&L Summary</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <PLRow label="Total Revenue" value={overview?.revenue ?? 0} />
                    <PLRow label="Cost of Goods Sold" value={-(overview?.cogs ?? 0)} indent />
                    <PLRow label="Gross Profit" value={overview?.grossProfit ?? 0} bold />
                    <PLRow label="Operating Expenses" value={-(overview?.expenses ?? 0)} indent />
                    <PLRow label="Business Losses" value={-(overview?.businessLoss ?? 0)} indent />
                    <div className="border-t pt-3">
                      <PLRow label="Net Profit" value={overview?.netProfit ?? 0} bold highlight />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Expenses by Category</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        <Pie
                          data={expensesByCategory}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={80}
                          label
                        >
                          {expensesByCategory.map((_, index) => (
                            <Cell key={index} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v: number | undefined) => fmt(v ?? 0)} />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="monthly" className="space-y-5 mt-5">
              {allTimeLoading ? (
                <div className="flex justify-center items-center py-16">
                  <Loader2 className="h-6 w-6 animate-spin text-green-600" />
                </div>
              ) : (
                <>
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Sales vs Profit by Month</CardTitle>
                      <CardDescription>All-time monthly breakdown</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={allTimeMonthly}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" height={70} />
                          <YAxis tickFormatter={fmtK} tick={{ fontSize: 11 }} />
                          <Tooltip formatter={(v: number | undefined) => fmt(v ?? 0)} />
                          <Legend />
                          <Bar dataKey="revenue" name="Sales" fill="#0088FE" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="netProfit" name="Profit" fill="#16a34a" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Monthly Breakdown</CardTitle>
                      <CardDescription>{allTimeMonthly.length} months on record</CardDescription>
                    </CardHeader>
                    <CardContent className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Month</TableHead>
                            <TableHead className="text-right">Sales</TableHead>
                            <TableHead className="text-right">Profit</TableHead>
                            <TableHead className="text-right">Margin</TableHead>
                            <TableHead className="text-right">Orders</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {allTimeMonthly.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={5} className="text-center text-muted-foreground py-10">
                                No sales recorded yet
                              </TableCell>
                            </TableRow>
                          ) : (
                            [...allTimeMonthly].reverse().map((m: any) => {
                              const margin = m.revenue > 0 ? (m.netProfit / m.revenue) * 100 : 0;
                              return (
                                <TableRow key={m.key}>
                                  <TableCell className="font-medium">{m.name}</TableCell>
                                  <TableCell className="text-right font-mono tabular-nums">
                                    {fmt(m.revenue)}
                                  </TableCell>
                                  <TableCell
                                    className={`text-right font-mono tabular-nums ${
                                      m.netProfit >= 0 ? "text-green-700" : "text-red-600"
                                    }`}
                                  >
                                    {fmt(m.netProfit)}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <MarginBadge margin={margin} />
                                  </TableCell>
                                  <TableCell className="text-right tabular-nums">{m.orders}</TableCell>
                                </TableRow>
                              );
                            })
                          )}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </>
              )}
            </TabsContent>

            <TabsContent value="yearly" className="space-y-5 mt-5">
              {allTimeLoading ? (
                <div className="flex justify-center items-center py-16">
                  <Loader2 className="h-6 w-6 animate-spin text-green-600" />
                </div>
              ) : (
                <>
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Sales vs Profit by Year</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={yearlyBreakdown}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="year" tick={{ fontSize: 12 }} />
                          <YAxis tickFormatter={fmtK} tick={{ fontSize: 11 }} />
                          <Tooltip formatter={(v: number | undefined) => fmt(v ?? 0)} />
                          <Legend />
                          <Bar dataKey="revenue" name="Sales" fill="#0088FE" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="netProfit" name="Profit" fill="#16a34a" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Yearly Breakdown</CardTitle>
                    </CardHeader>
                    <CardContent className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Year</TableHead>
                            <TableHead className="text-right">Sales</TableHead>
                            <TableHead className="text-right">Profit</TableHead>
                            <TableHead className="text-right">Margin</TableHead>
                            <TableHead className="text-right">Orders</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {yearlyBreakdown.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={5} className="text-center text-muted-foreground py-10">
                                No sales recorded yet
                              </TableCell>
                            </TableRow>
                          ) : (
                            [...yearlyBreakdown].reverse().map((y) => {
                              const margin = y.revenue > 0 ? (y.netProfit / y.revenue) * 100 : 0;
                              return (
                                <TableRow key={y.year}>
                                  <TableCell className="font-medium">{y.year}</TableCell>
                                  <TableCell className="text-right font-mono tabular-nums">
                                    {fmt(y.revenue)}
                                  </TableCell>
                                  <TableCell
                                    className={`text-right font-mono tabular-nums ${
                                      y.netProfit >= 0 ? "text-green-700" : "text-red-600"
                                    }`}
                                  >
                                    {fmt(y.netProfit)}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <MarginBadge margin={margin} />
                                  </TableCell>
                                  <TableCell className="text-right tabular-nums">{y.orders}</TableCell>
                                </TableRow>
                              );
                            })
                          )}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </>
              )}
            </TabsContent>

            <TabsContent value="products" className="space-y-5 mt-5">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Top 10 Products by Revenue</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={products.slice(0, 10)} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" tickFormatter={fmtK} tick={{ fontSize: 10 }} />
                      <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 10 }} />
                      <Tooltip formatter={(v: number | undefined) => fmt(v ?? 0)} />
                      <Legend />
                      <Bar dataKey="revenue" name="Revenue" fill="#0088FE" radius={[0, 4, 4, 0]} />
                      <Bar dataKey="profit" name="Profit" fill="#16a34a" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

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
                        <TableHead className="text-right">Profit</TableHead>
                        <TableHead className="text-right">Margin</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {products.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center text-muted-foreground py-10">
                            No product data for this period
                          </TableCell>
                        </TableRow>
                      ) : (
                        products.slice(0, 30).map((p, i) => (
                          <TableRow key={p.id}>
                            <TableCell className="text-muted-foreground font-medium">{i + 1}</TableCell>
                            <TableCell className="font-medium max-w-[180px] truncate">{p.name}</TableCell>
                            <TableCell>
                              {p.category ? (
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                                  {p.category}
                                </span>
                              ) : (
                                "—"
                              )}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">{p.sold.toLocaleString()}</TableCell>
                            <TableCell className="text-right font-mono tabular-nums">{fmt(p.revenue)}</TableCell>
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

            <TabsContent value="customers" className="space-y-5 mt-5">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Top 10 Customers by Revenue</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={customers.slice(0, 10)} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" tickFormatter={fmtK} tick={{ fontSize: 10 }} />
                      <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 10 }} />
                      <Tooltip formatter={(v: number | undefined) => fmt(v ?? 0)} />
                      <Legend />
                      <Bar dataKey="revenue" name="Revenue" fill="#0088FE" radius={[0, 4, 4, 0]} />
                      <Bar dataKey="profit" name="Profit" fill="#16a34a" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Customer Profitability</CardTitle>
                  <CardDescription>{customers.length} customers · ranked by revenue</CardDescription>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-8">#</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead className="text-right">Orders</TableHead>
                        <TableHead className="text-right">Revenue</TableHead>
                        <TableHead className="text-right">Avg Order</TableHead>
                        <TableHead className="text-right">Profit</TableHead>
                        <TableHead className="text-right">Margin</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {customers.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center text-muted-foreground py-10">
                            No customer data for this period
                          </TableCell>
                        </TableRow>
                      ) : (
                        customers.slice(0, 25).map((c, i) => (
                          <TableRow key={c.id}>
                            <TableCell className="text-muted-foreground font-medium">{i + 1}</TableCell>
                            <TableCell className="font-medium">{c.name}</TableCell>
                            <TableCell className="text-right tabular-nums">{c.orders}</TableCell>
                            <TableCell className="text-right font-mono tabular-nums">{fmt(c.revenue)}</TableCell>
                            <TableCell className="text-right font-mono tabular-nums text-slate-500">
                              {fmt(c.avgOrder)}
                            </TableCell>
                            <TableCell className="text-right font-mono tabular-nums text-green-700">
                              {fmt(c.profit)}
                            </TableCell>
                            <TableCell className="text-right">
                              <MarginBadge margin={c.margin} />
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
