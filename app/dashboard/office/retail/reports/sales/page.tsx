"use client";

import { useState, useMemo } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
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
  Receipt,
  DollarSign,
  Wallet,
  Search,
  RefreshCw,
  Loader2,
  Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCachedFetch } from "@/hooks/useCachedFetch";
import { BUSINESS_IDS } from "@/app/config/business-constants";
import { TablePagination } from "@/components/ui/TablePagination";

const RETAIL_ID = BUSINESS_IDS.CHAMPIKA_RETAIL;
const ITEMS_PER_PAGE = 10;
const STATUS_COLORS: Record<string, string> = {
  Paid: "#00C49F",
  Partial: "#FFBB28",
  Unpaid: "#FF8042",
  Overdue: "#FF4444",
};

const fmt = (n: number) =>
  new Intl.NumberFormat("en-LK", {
    style: "currency",
    currency: "LKR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-LK", { day: "numeric", month: "short" });

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
  return { from, to };
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

export default function RetailSalesReportPage() {
  const [period, setPeriod] = useState("this-month");
  const [activeTab, setActiveTab] = useState("overview");
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const {
    data: allInvoices = [],
    loading,
    refetch,
  } = useCachedFetch<any[]>(`/api/invoices?businessId=${RETAIL_ID}`, [], () => {});

  const periodInvoices = useMemo(() => {
    const { from, to } = getDateRange(period);
    const fromTime = from.getTime();
    const toTime = to.getTime();
    return (allInvoices as any[])
      .map((inv: any) => ({
        ...inv,
        // Sale date shown/filtered here is when the invoice was recorded,
        // not the (possibly backdated) order date — matches the Invoice List page.
        recordedDate: (inv.createdAt || inv.date || "").split("T")[0],
      }))
      .filter((inv: any) => {
        const d = new Date(inv.createdAt || inv.date).getTime();
        return d >= fromTime && d <= toTime;
      })
      .sort(
        (a: any, b: any) =>
          new Date(b.createdAt || b.date).getTime() - new Date(a.createdAt || a.date).getTime()
      );
  }, [allInvoices, period]);

  const summary = useMemo(() => {
    const totalSales = periodInvoices.reduce(
      (s: number, inv: any) => s + (Number(inv.totalAmount) || 0),
      0
    );
    const totalPaid = periodInvoices.reduce(
      (s: number, inv: any) => s + (Number(inv.paidAmount) || 0),
      0
    );
    const totalDue = periodInvoices.reduce(
      (s: number, inv: any) => s + (Number(inv.dueAmount) || 0),
      0
    );
    const totalProfit = periodInvoices.reduce(
      (s: number, inv: any) => s + (Number(inv.profit) || 0),
      0
    );
    const count = periodInvoices.length;
    return {
      count,
      totalSales,
      totalPaid,
      totalDue,
      totalProfit,
      margin: totalSales > 0 ? (totalProfit / totalSales) * 100 : 0,
      avgSale: count > 0 ? totalSales / count : 0,
    };
  }, [periodInvoices]);

  // Month-by-month and year-by-year breakdowns — span all invoices, not just
  // the selected period, since these tabs are the historical trend view.
  const monthlyBreakdown = useMemo(() => {
    const map: Record<
      string,
      { key: string; label: string; sales: number; profit: number; count: number }
    > = {};
    (allInvoices as any[]).forEach((inv: any) => {
      const dateStr = inv.createdAt || inv.date;
      if (!dateStr) return;
      const d = new Date(dateStr);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (!map[key])
        map[key] = {
          key,
          label: d.toLocaleDateString("en-US", { month: "long", year: "numeric" }),
          sales: 0,
          profit: 0,
          count: 0,
        };
      map[key].sales += Number(inv.totalAmount) || 0;
      map[key].profit += Number(inv.profit) || 0;
      map[key].count += 1;
    });
    return Object.values(map).sort((a, b) => a.key.localeCompare(b.key));
  }, [allInvoices]);

  const yearlyBreakdown = useMemo(() => {
    const map: Record<string, { year: string; sales: number; profit: number; count: number }> = {};
    (allInvoices as any[]).forEach((inv: any) => {
      const dateStr = inv.createdAt || inv.date;
      if (!dateStr) return;
      const year = String(new Date(dateStr).getFullYear());
      if (!map[year]) map[year] = { year, sales: 0, profit: 0, count: 0 };
      map[year].sales += Number(inv.totalAmount) || 0;
      map[year].profit += Number(inv.profit) || 0;
      map[year].count += 1;
    });
    return Object.values(map).sort((a, b) => a.year.localeCompare(b.year));
  }, [allInvoices]);

  const dailyTrend = useMemo(() => {
    const map: Record<string, { date: string; amount: number; count: number }> = {};
    periodInvoices.forEach((inv: any) => {
      if (!map[inv.recordedDate])
        map[inv.recordedDate] = { date: inv.recordedDate, amount: 0, count: 0 };
      map[inv.recordedDate].amount += Number(inv.totalAmount) || 0;
      map[inv.recordedDate].count += 1;
    });
    return Object.values(map).sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
  }, [periodInvoices]);

  const statusBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    periodInvoices.forEach((inv: any) => {
      const s = inv.status || "Unpaid";
      map[s] = (map[s] || 0) + 1;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [periodInvoices]);

  const displayInvoices = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return periodInvoices;
    return periodInvoices.filter(
      (inv: any) =>
        (inv.invoiceNo || "").toLowerCase().includes(q) ||
        (inv.manualInvoiceNo || "").toLowerCase().includes(q) ||
        (inv.customerName || "").toLowerCase().includes(q)
    );
  }, [periodInvoices, search]);

  const totalPages = Math.ceil(displayInvoices.length / ITEMS_PER_PAGE);
  const paginatedInvoices = displayInvoices.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const handleExport = () => {
    if (displayInvoices.length === 0) return;
    const headers = ["Invoice No", "Date", "Customer", "Amount", "Paid", "Due", "Status"];
    const rows = displayInvoices.map((inv: any) => [
      inv.invoiceNo,
      inv.date,
      inv.customerName,
      inv.totalAmount,
      inv.paidAmount,
      inv.dueAmount,
      inv.status,
    ]);
    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers, ...rows].map((r) => r.join(",")).join("\n");
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", `retail-sales-report-${period}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-green-950">
            Sales Reports
          </h1>
          <p className="text-muted-foreground mt-1 text-sm flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Retail sales analytics · {getPeriodLabel(period)}
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
          <Button variant="outline" onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
          <Button variant="outline" size="icon" onClick={refetch} disabled={loading}>
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
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            <Card className="border-l-4 border-l-green-500 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Sales
                </CardTitle>
                <Receipt className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-700">{summary.count}</div>
                <p className="text-xs text-muted-foreground">Invoices in period</p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-blue-500 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Sales Value
                </CardTitle>
                <DollarSign className="h-4 w-4 text-blue-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-700">
                  {fmt(summary.totalSales)}
                </div>
                <p className="text-xs text-muted-foreground">Gross invoiced amount</p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-green-600 bg-green-50/40 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Profit
                </CardTitle>
                <TrendingUp className="h-4 w-4 text-green-700" />
              </CardHeader>
              <CardContent>
                <div
                  className={`text-2xl font-bold ${
                    summary.totalProfit >= 0 ? "text-green-700" : "text-red-600"
                  }`}
                >
                  {fmt(summary.totalProfit)}
                </div>
                <p className="text-xs text-muted-foreground">
                  {summary.margin.toFixed(1)}% margin
                </p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-amber-500 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Avg Sale Value
                </CardTitle>
                <TrendingUp className="h-4 w-4 text-amber-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-amber-700">
                  {fmt(summary.avgSale)}
                </div>
                <p className="text-xs text-muted-foreground">Per invoice</p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-red-500 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Outstanding Due
                </CardTitle>
                <Wallet className="h-4 w-4 text-red-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">
                  {fmt(summary.totalDue)}
                </div>
                <p className="text-xs text-muted-foreground">
                  {fmt(summary.totalPaid)} collected
                </p>
              </CardContent>
            </Card>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="monthly">Monthly</TabsTrigger>
              <TabsTrigger value="yearly">Yearly</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6 mt-5">
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle className="text-base">Daily Sales Trend</CardTitle>
                <CardDescription>Sales value per day for selected period</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={dailyTrend}>
                    <defs>
                      <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#16a34a" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#16a34a" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tickFormatter={fmtDate} tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip
                      labelFormatter={(v) => fmtDate(String(v))}
                      formatter={(v: number | undefined) => fmt(v ?? 0)}
                    />
                    <Area
                      type="monotone"
                      dataKey="amount"
                      name="Sales"
                      stroke="#16a34a"
                      fill="url(#colorSales)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Payment Status</CardTitle>
                <CardDescription>Invoice count by status</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie
                      data={statusBreakdown}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={90}
                      label
                    >
                      {statusBreakdown.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={STATUS_COLORS[entry.name] || "#8884d8"}
                        />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-base">Sales Detail</CardTitle>
                  <CardDescription>
                    {displayInvoices.length}
                    {search ? ` of ${periodInvoices.length}` : ""} sale
                    {periodInvoices.length !== 1 ? "s" : ""} · {getPeriodLabel(period)}
                  </CardDescription>
                </div>
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Search invoice or customer…"
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="pl-8 h-8 text-sm"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="border rounded-md overflow-hidden overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-green-50/50">
                      <TableHead>Invoice No</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="text-right">Paid</TableHead>
                      <TableHead className="text-right">Due</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedInvoices.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                          {search ? "No sales match your search" : "No sales for this period"}
                        </TableCell>
                      </TableRow>
                    ) : (
                      paginatedInvoices.map((inv: any) => (
                        <TableRow key={inv.id}>
                          <TableCell className="font-mono text-xs font-semibold text-green-700">
                            {inv.invoiceNo}
                          </TableCell>
                          <TableCell className="text-xs whitespace-nowrap">
                            {fmtDate(inv.recordedDate)}
                          </TableCell>
                          <TableCell className="font-medium max-w-[180px] truncate">
                            {inv.customerName}
                          </TableCell>
                          <TableCell className="text-right font-mono tabular-nums">
                            {fmt(Number(inv.totalAmount) || 0)}
                          </TableCell>
                          <TableCell className="text-right font-mono tabular-nums text-green-700">
                            {fmt(Number(inv.paidAmount) || 0)}
                          </TableCell>
                          <TableCell className="text-right font-mono tabular-nums text-red-600">
                            {Number(inv.dueAmount) > 0 ? fmt(Number(inv.dueAmount)) : "—"}
                          </TableCell>
                          <TableCell>
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                                inv.status === "Paid"
                                  ? "bg-green-100 text-green-800"
                                  : inv.status === "Partial"
                                  ? "bg-yellow-100 text-yellow-800"
                                  : inv.status === "Overdue"
                                  ? "bg-red-100 text-red-700"
                                  : "bg-slate-100 text-slate-600"
                              }`}
                            >
                              {inv.status}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              <TablePagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={displayInvoices.length}
                itemsPerPage={ITEMS_PER_PAGE}
                onPageChange={setCurrentPage}
              />
            </CardContent>
          </Card>
            </TabsContent>

            <TabsContent value="monthly" className="space-y-6 mt-5">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Sales vs Profit by Month</CardTitle>
                  <CardDescription>All-time monthly breakdown</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={monthlyBreakdown}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="label" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" height={70} />
                      <YAxis tickFormatter={fmtK} tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(v: number | undefined) => fmt(v ?? 0)} />
                      <Legend />
                      <Bar dataKey="sales" name="Sales" fill="#0088FE" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="profit" name="Profit" fill="#16a34a" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Monthly Breakdown</CardTitle>
                  <CardDescription>{monthlyBreakdown.length} months on record</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="border rounded-md overflow-hidden overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-green-50/50">
                          <TableHead>Month</TableHead>
                          <TableHead className="text-right">Sales</TableHead>
                          <TableHead className="text-right">Profit</TableHead>
                          <TableHead className="text-right">Margin</TableHead>
                          <TableHead className="text-right">Invoices</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {monthlyBreakdown.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">
                              No sales recorded yet
                            </TableCell>
                          </TableRow>
                        ) : (
                          [...monthlyBreakdown].reverse().map((m) => {
                            const margin = m.sales > 0 ? (m.profit / m.sales) * 100 : 0;
                            return (
                              <TableRow key={m.key}>
                                <TableCell className="font-medium">{m.label}</TableCell>
                                <TableCell className="text-right font-mono tabular-nums">
                                  {fmt(m.sales)}
                                </TableCell>
                                <TableCell
                                  className={`text-right font-mono tabular-nums ${
                                    m.profit >= 0 ? "text-green-700" : "text-red-600"
                                  }`}
                                >
                                  {fmt(m.profit)}
                                </TableCell>
                                <TableCell className="text-right">{margin.toFixed(1)}%</TableCell>
                                <TableCell className="text-right tabular-nums">{m.count}</TableCell>
                              </TableRow>
                            );
                          })
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="yearly" className="space-y-6 mt-5">
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
                      <Bar dataKey="sales" name="Sales" fill="#0088FE" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="profit" name="Profit" fill="#16a34a" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Yearly Breakdown</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="border rounded-md overflow-hidden overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-green-50/50">
                          <TableHead>Year</TableHead>
                          <TableHead className="text-right">Sales</TableHead>
                          <TableHead className="text-right">Profit</TableHead>
                          <TableHead className="text-right">Margin</TableHead>
                          <TableHead className="text-right">Invoices</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {yearlyBreakdown.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">
                              No sales recorded yet
                            </TableCell>
                          </TableRow>
                        ) : (
                          [...yearlyBreakdown].reverse().map((y) => {
                            const margin = y.sales > 0 ? (y.profit / y.sales) * 100 : 0;
                            return (
                              <TableRow key={y.year}>
                                <TableCell className="font-medium">{y.year}</TableCell>
                                <TableCell className="text-right font-mono tabular-nums">
                                  {fmt(y.sales)}
                                </TableCell>
                                <TableCell
                                  className={`text-right font-mono tabular-nums ${
                                    y.profit >= 0 ? "text-green-700" : "text-red-600"
                                  }`}
                                >
                                  {fmt(y.profit)}
                                </TableCell>
                                <TableCell className="text-right">{margin.toFixed(1)}%</TableCell>
                                <TableCell className="text-right tabular-nums">{y.count}</TableCell>
                              </TableRow>
                            );
                          })
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
