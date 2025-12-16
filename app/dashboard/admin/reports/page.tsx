"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  TrendingUp,
  DollarSign,
  Package,
  Users,
  Download,
  Calendar,
  BarChart3,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Wallet,
  ArrowDownRight,
  Truck,
  CreditCard,
} from "lucide-react";
import {
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
  Area,
  AreaChart,
  Line,
  ComposedChart,
} from "recharts";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const COLORS = [
  "#0088FE",
  "#00C49F",
  "#FFBB28",
  "#FF8042",
  "#8884D8",
  "#82ca9d",
  "#ffc658",
];
const ITEMS_PER_PAGE = 10;

export default function AdminReportsPage() {
  const [timePeriod, setTimePeriod] = useState("this-year");
  const [activeTab, setActiveTab] = useState("overview");
  const [loading, setLoading] = useState(true);
  const [orderPage, setOrderPage] = useState(1);
  const [deliveryPage, setDeliveryPage] = useState(1);

  const [overview, setOverview] = useState<any>({
    revenue: 0,
    cogs: 0,
    grossProfit: 0,
    expenses: 0,
    netProfit: 0,
    grossMargin: 0,
    netMargin: 0,
  });

  const [monthlyData, setMonthlyData] = useState<any[]>([]);
  const [expensesByCategory, setExpensesByCategory] = useState<any[]>([]);
  const [businessData, setBusinessData] = useState<any[]>([]);
  const [customerData, setCustomerData] = useState<any[]>([]);
  const [productData, setProductData] = useState<any[]>([]);
  const [repData, setRepData] = useState<any[]>([]);
  const [orderData, setOrderData] = useState<any[]>([]);
  const [deliveryData, setDeliveryData] = useState<any[]>([]);
  const [revenueTrend, setRevenueTrend] = useState<any[]>([]);

  // Pagination Logic
  const totalOrderPages = Math.ceil(orderData.length / ITEMS_PER_PAGE);
  const startOrderIndex = (orderPage - 1) * ITEMS_PER_PAGE;
  const currentOrders = orderData.slice(
    startOrderIndex,
    startOrderIndex + ITEMS_PER_PAGE
  );

  const totalDeliveryPages = Math.ceil(deliveryData.length / ITEMS_PER_PAGE);
  const startDeliveryIndex = (deliveryPage - 1) * ITEMS_PER_PAGE;
  const currentDeliveries = deliveryData.slice(
    startDeliveryIndex,
    startDeliveryIndex + ITEMS_PER_PAGE
  );

  // Date Range Logic
  const getDateRange = (period: string) => {
    const now = new Date();
    const today = new Date(now.setHours(0, 0, 0, 0));
    let from = new Date(today);
    let to = new Date(now.setHours(23, 59, 59, 999));

    switch (period) {
      case "today":
        break;
      case "yesterday":
        from.setDate(today.getDate() - 1);
        to = new Date(from);
        to.setHours(23, 59, 59, 999);
        break;
      case "this-week":
        const day = today.getDay() || 7;
        if (day !== 1) from.setHours(-24 * (day - 1));
        to = new Date();
        break;
      case "last-week":
        const lastWeekDay = today.getDay() || 7;
        from.setDate(today.getDate() - lastWeekDay - 6);
        to.setDate(from.getDate() + 6);
        to.setHours(23, 59, 59, 999);
        break;
      case "this-month":
        from = new Date(now.getFullYear(), now.getMonth(), 1);
        to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        break;
      case "last-month":
        from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        to = new Date(now.getFullYear(), now.getMonth(), 0);
        break;
      case "this-year":
        from = new Date(now.getFullYear(), 0, 1);
        to = new Date(now.getFullYear(), 11, 31);
        break;
      default:
        from = new Date(now.getFullYear(), now.getMonth(), 1);
        to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    }
    return { from: from.toISOString(), to: to.toISOString() };
  };

  useEffect(() => {
    fetchReports();
    setOrderPage(1);
    setDeliveryPage(1);
  }, [timePeriod]);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const { from, to } = getDateRange(timePeriod);
      const res = await fetch(`/api/reports?from=${from}&to=${to}`);
      if (!res.ok) throw new Error("Failed to fetch reports");
      const data = await res.json();

      setOverview(data.overview);
      setMonthlyData(data.monthly || []);
      setExpensesByCategory(data.expensesByCategory || []);
      setDeliveryData(data.deliveries || []);

      const processedOrders = data.orders.map((o: any) => ({
        ...o,
        margin: o.revenue > 0 ? (o.profit / o.revenue) * 100 : 0,
      }));
      setOrderData(processedOrders);

      const trendMap: Record<string, any> = {};
      data.orders.forEach((o: any) => {
        if (!trendMap[o.date])
          trendMap[o.date] = { date: o.date, revenue: 0, profit: 0 };
        trendMap[o.date].revenue += o.revenue;
        trendMap[o.date].profit += o.profit;
      });
      setRevenueTrend(
        Object.values(trendMap).sort(
          (a: any, b: any) =>
            new Date(a.date).getTime() - new Date(b.date).getTime()
        )
      );

      setBusinessData(
        data.business.map((b: any) => ({
          ...b,
          margin: b.revenue > 0 ? (b.profit / b.revenue) * 100 : 0,
        }))
      );
      setCustomerData(
        data.customers.map((c: any) => ({
          ...c,
          avgOrder: c.orders > 0 ? c.revenue / c.orders : 0,
          margin: c.revenue > 0 ? (c.profit / c.revenue) * 100 : 0,
        }))
      );
      setProductData(
        data.products.map((p: any) => ({
          ...p,
          margin: p.revenue > 0 ? ((p.revenue - p.cost) / p.revenue) * 100 : 0,
          profit: p.revenue - p.cost,
        }))
      );
      setRepData(data.reps);
    } catch (error) {
      console.error(error);
      toast.error("Failed to load report data");
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    const headers = [
      "ID",
      "Date",
      "Customer",
      "Business",
      "Revenue",
      "Profit",
      "Status",
    ];
    const rows = orderData.map((o) => [
      o.id,
      o.date,
      o.customer,
      o.business,
      o.revenue,
      o.profit,
      o.status,
    ]);
    let csvContent =
      "data:text/csv;charset=utf-8," +
      headers.join(",") +
      "\n" +
      rows.map((e) => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `report-${timePeriod}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading && !overview.revenue) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Financial Reports
          </h1>
          <p className="text-muted-foreground">
            Profit margins, expenses, and net performance
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={timePeriod} onValueChange={setTimePeriod}>
            <SelectTrigger className="w-[180px]">
              <Calendar className="mr-2 h-4 w-4" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="yesterday">Yesterday</SelectItem>
              <SelectItem value="this-week">This Week</SelectItem>
              <SelectItem value="last-week">Last Week</SelectItem>
              <SelectItem value="this-month">This Month</SelectItem>
              <SelectItem value="last-month">Last Month</SelectItem>
              <SelectItem value="this-year">This Year</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={handleExport} variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </div>

      {loading && (
        <div className="w-full text-center py-2 text-sm text-muted-foreground">
          Refreshing data...
        </div>
      )}

      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="space-y-6"
      >
        <TabsList className="grid w-full grid-cols-2 lg:grid-cols-9">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="monthly">Monthly</TabsTrigger>
          <TabsTrigger value="expenses">Expenses</TabsTrigger>
          <TabsTrigger value="deliveries">Deliveries</TabsTrigger>
          <TabsTrigger value="business">Business</TabsTrigger>
          <TabsTrigger value="customer">Customer</TabsTrigger>
          <TabsTrigger value="product">Product</TabsTrigger>
          <TabsTrigger value="representative">Sales Rep</TabsTrigger>
          <TabsTrigger value="order">Orders</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* UPDATED: Overview Cards Grid with Gross Profit */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {/* 1. Revenue */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Revenue
                </CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  LKR {overview.revenue?.toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground">
                  Gross sales from orders
                </p>
              </CardContent>
            </Card>

            {/* 2. COGS */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Cost of Goods
                </CardTitle>
                <Package className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  LKR {overview.cogs?.toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground">
                  Total product cost
                </p>
              </CardContent>
            </Card>

            {/* 3. Gross Profit (Revenue - COGS) */}
            <Card className="bg-primary/5 border-primary/20">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-primary">
                  Gross Profit
                </CardTitle>
                <CreditCard className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-primary">
                  LKR {overview.grossProfit?.toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground">
                  Profit before expenses
                </p>
              </CardContent>
            </Card>

            {/* 4. Expenses */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Expenses
                </CardTitle>
                <ArrowDownRight className="h-4 w-4 text-red-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">
                  LKR {overview.expenses?.toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground">
                  Operational overheads
                </p>
              </CardContent>
            </Card>

            {/* 5. Net Profit (Gross - Expenses) */}
            <Card className="bg-green-50 border-green-200 dark:bg-green-900/10 dark:border-green-900/50">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-green-700 dark:text-green-400">
                  Net Profit
                </CardTitle>
                <Wallet className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-700 dark:text-green-400">
                  LKR {overview.netProfit?.toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground">
                  Final profit after expenses
                </p>
              </CardContent>
            </Card>

            {/* 6. Net Margin */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Net Margin
                </CardTitle>
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {overview.netMargin?.toFixed(1)}%
                </div>
                <p className="text-xs text-muted-foreground">
                  Profitability ratio
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Daily Revenue Trend</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={revenueTrend}>
                    <defs>
                      <linearGradient
                        id="colorRevenue"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="5%"
                          stopColor="#0088FE"
                          stopOpacity={0.8}
                        />
                        <stop
                          offset="95%"
                          stopColor="#0088FE"
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Area
                      type="monotone"
                      dataKey="revenue"
                      stroke="#0088FE"
                      fillOpacity={1}
                      fill="url(#colorRevenue)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Expenses by Category</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
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
                      {expensesByCategory.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={COLORS[index % COLORS.length]}
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

          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Top Products</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {productData.slice(0, 5).map((p, i) => (
                    <div
                      key={p.id}
                      className="flex justify-between items-center text-sm"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-muted-foreground">
                          {i + 1}.
                        </span>
                        <span>{p.name}</span>
                      </div>
                      <span className="font-medium">
                        LKR {p.revenue.toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Top Customers</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {customerData.slice(0, 5).map((c, i) => (
                    <div
                      key={c.id}
                      className="flex justify-between items-center text-sm"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-muted-foreground">
                          {i + 1}.
                        </span>
                        <span>{c.name}</span>
                      </div>
                      <span className="font-medium">
                        LKR {c.revenue.toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Top Reps</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {repData.slice(0, 5).map((r, i) => (
                    <div
                      key={r.id}
                      className="flex justify-between items-center text-sm"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-muted-foreground">
                          {i + 1}.
                        </span>
                        <span>{r.name}</span>
                      </div>
                      <span className="font-medium">
                        LKR {r.revenue.toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Recent Transactions</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead className="text-right">Profit</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orderData.slice(0, 5).map((order) => (
                    <TableRow key={order.id}>
                      <TableCell>{order.date}</TableCell>
                      <TableCell>{order.customer}</TableCell>
                      <TableCell className="text-right">
                        LKR {order.revenue.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right text-green-600">
                        LKR {order.profit.toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Badge>{order.status}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="expenses" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Expense Analysis</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-8">
                <div className="h-[400px]">
                  <h3 className="text-lg font-medium mb-4 text-center">
                    Expenses by Category
                  </h3>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={expensesByCategory} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" />
                      <YAxis dataKey="name" type="category" width={100} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="value" fill="#ff8042" name="Amount (LKR)" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div>
                  <h3 className="text-lg font-medium mb-4">
                    Detailed Breakdown
                  </h3>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Category</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead className="text-right">% of Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {expensesByCategory.map((cat, i) => (
                        <TableRow key={i}>
                          <TableCell>{cat.name}</TableCell>
                          <TableCell className="text-right">
                            LKR {cat.value.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right">
                            {overview.expenses > 0
                              ? ((cat.value / overview.expenses) * 100).toFixed(
                                  1
                                )
                              : 0}
                            %
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="font-bold">
                        <TableCell>Total</TableCell>
                        <TableCell className="text-right">
                          LKR {overview.expenses.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right">100%</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="deliveries" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Loading Deliveries Profitability</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Load ID</TableHead>
                    <TableHead>Driver / Lorry</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead className="text-right">COGS</TableHead>
                    <TableHead className="text-right">Gross Profit</TableHead>
                    <TableHead className="text-right">Expenses</TableHead>
                    <TableHead className="text-right">Net Profit</TableHead>
                    <TableHead className="text-right">Margin</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {currentDeliveries.map((d: any) => (
                    <TableRow key={d.id}>
                      <TableCell>{d.date}</TableCell>
                      <TableCell className="font-medium">{d.loadId}</TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span>{d.driver}</span>
                          <span className="text-xs text-muted-foreground">
                            {d.lorry}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        LKR {d.revenue.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        LKR {d.cogs.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        LKR {d.grossProfit.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right text-red-500">
                        LKR {d.expenses.toLocaleString()}
                      </TableCell>
                      <TableCell
                        className={`text-right font-bold ${
                          d.netProfit >= 0 ? "text-green-600" : "text-red-600"
                        }`}
                      >
                        LKR {d.netProfit.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge
                          variant={d.margin > 15 ? "default" : "secondary"}
                        >
                          {d.margin.toFixed(1)}%
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                  {currentDeliveries.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={9}
                        className="text-center h-24 text-muted-foreground"
                      >
                        No deliveries found in this period.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>

              {deliveryData.length > 0 && (
                <div className="flex items-center justify-end space-x-2 py-4">
                  <div className="text-sm text-muted-foreground">
                    Page {deliveryPage} of {totalDeliveryPages}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDeliveryPage(deliveryPage - 1)}
                    disabled={deliveryPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDeliveryPage(deliveryPage + 1)}
                    disabled={deliveryPage === totalDeliveryPages}
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="monthly" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Monthly Net Profit Analysis</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <ComposedChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <Tooltip />
                  <Legend />
                  <Bar
                    yAxisId="left"
                    dataKey="grossProfit"
                    fill="#00C49F"
                    name="Gross Profit"
                    barSize={30}
                  />
                  <Bar
                    yAxisId="left"
                    dataKey="expenses"
                    fill="#ff8042"
                    name="Expenses"
                    barSize={30}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="netProfit"
                    stroke="#0088FE"
                    strokeWidth={3}
                    name="Net Profit"
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Monthly Breakdown Table</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Month</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead className="text-right">COGS</TableHead>
                    <TableHead className="text-right">Gross Profit</TableHead>
                    <TableHead className="text-right">Expenses</TableHead>
                    <TableHead className="text-right">Net Profit</TableHead>
                    <TableHead className="text-right">Net Margin</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {monthlyData.map((m: any) => (
                    <TableRow key={m.key}>
                      <TableCell>{m.name}</TableCell>
                      <TableCell className="text-right">
                        LKR {m.revenue.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        LKR {m.cogs.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right text-green-600">
                        LKR {m.grossProfit.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right text-red-500">
                        LKR {m.expenses.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-bold">
                        LKR {m.netProfit.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge
                          variant={m.margin > 15 ? "default" : "secondary"}
                        >
                          {m.margin.toFixed(1)}%
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="business" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Business Performance Analysis</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Business Unit</TableHead>
                    <TableHead className="text-right">Orders</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead className="text-right">Cost</TableHead>
                    <TableHead className="text-right">Profit</TableHead>
                    <TableHead className="text-right">Margin %</TableHead>
                    <TableHead className="text-right">
                      Avg Order Value
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {businessData.map((business) => (
                    <TableRow key={business.name}>
                      <TableCell className="font-medium">
                        {business.name}
                      </TableCell>
                      <TableCell className="text-right">
                        {business.orders}
                      </TableCell>
                      <TableCell className="text-right">
                        LKR {business.revenue.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        LKR {(business.cost || 0).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-medium text-green-600">
                        LKR {business.profit.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        {business.margin.toFixed(1)}%
                      </TableCell>
                      <TableCell className="text-right">
                        LKR{" "}
                        {business.orders > 0
                          ? (business.revenue / business.orders).toFixed(2)
                          : "0.00"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Revenue Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={businessData}
                      dataKey="revenue"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      label
                    >
                      {businessData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={COLORS[index % COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Profit Comparison</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={businessData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="profit" fill="#00C49F" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="customer" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Customer Performance Analysis</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer Name</TableHead>
                    <TableHead className="text-right">Total Orders</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead className="text-right">
                      Avg Order Value
                    </TableHead>
                    <TableHead className="text-right">Margin %</TableHead>
                    <TableHead>Performance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customerData.map((customer) => (
                    <TableRow key={customer.id}>
                      <TableCell className="font-medium">
                        {customer.name}
                      </TableCell>
                      <TableCell className="text-right">
                        {customer.orders}
                      </TableCell>
                      <TableCell className="text-right">
                        LKR {customer.revenue.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        LKR {customer.avgOrder.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        {customer.margin.toFixed(1)}%
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            customer.margin > 28 ? "default" : "secondary"
                          }
                        >
                          {customer.margin > 28 ? "Excellent" : "Good"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Top Customers by Revenue</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={customerData.slice(0, 10)} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis dataKey="name" type="category" width={150} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="revenue" fill="#0088FE" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="product" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Product Performance Analysis</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Units Sold</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead className="text-right">Cost</TableHead>
                    <TableHead className="text-right">Profit</TableHead>
                    <TableHead className="text-right">Margin %</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {productData.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell className="font-medium">
                        {product.name}
                      </TableCell>
                      <TableCell>{product.category}</TableCell>
                      <TableCell className="text-right">
                        {product.sold}
                      </TableCell>
                      <TableCell className="text-right">
                        LKR {product.revenue.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        LKR {product.cost.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-medium text-green-600">
                        LKR {product.profit.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        {product.margin.toFixed(1)}%
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Product Revenue Distribution (Top 10)</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={productData.slice(0, 10)}
                      dataKey="revenue"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      label={false}
                    >
                      {productData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={COLORS[index % COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Profit Margin by Product</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={productData.slice(0, 10)}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="name"
                      angle={-45}
                      textAnchor="end"
                      height={100}
                    />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="margin" fill="#00C49F" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="representative" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Sales Representative Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Representative</TableHead>
                    <TableHead className="text-right">Orders</TableHead>
                    <TableHead className="text-right">Customers</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead className="text-right">Profit</TableHead>
                    <TableHead className="text-right">Margin %</TableHead>
                    <TableHead className="text-right">Avg Order</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {repData.map((rep) => (
                    <TableRow key={rep.id}>
                      <TableCell className="font-medium">{rep.name}</TableCell>
                      <TableCell className="text-right">{rep.orders}</TableCell>
                      <TableCell className="text-right">
                        {rep.customers}
                      </TableCell>
                      <TableCell className="text-right">
                        LKR {rep.revenue.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-medium text-green-600">
                        LKR {rep.profit.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        {rep.margin.toFixed(1)}%
                      </TableCell>
                      <TableCell className="text-right">
                        LKR{" "}
                        {rep.orders > 0
                          ? (rep.revenue / rep.orders).toFixed(2)
                          : "0.00"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Revenue by Representative</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={repData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="name"
                      angle={-45}
                      textAnchor="end"
                      height={100}
                    />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="revenue" fill="#0088FE" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Customer Acquisition</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={repData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="name"
                      angle={-45}
                      textAnchor="end"
                      height={100}
                    />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="customers" fill="#00C49F" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="order" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Detailed Order Analysis</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order ID</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Business</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead className="text-right">Cost</TableHead>
                    <TableHead className="text-right">Profit</TableHead>
                    <TableHead className="text-right">Margin</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {currentOrders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="font-medium">{order.id}</TableCell>
                      <TableCell>{order.date}</TableCell>
                      <TableCell>{order.customer}</TableCell>
                      <TableCell>{order.business}</TableCell>
                      <TableCell className="text-right">
                        LKR {order.revenue.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        LKR {order.cost.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-medium text-green-600">
                        LKR {order.profit.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        {order.margin.toFixed(1)}%
                      </TableCell>
                      <TableCell>
                        <Badge variant="default">{order.status}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                  {currentOrders.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={9} className="h-24 text-center">
                        No orders found.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>

              {/* Pagination Controls for Orders */}
              {orderData.length > 0 && (
                <div className="flex items-center justify-end space-x-2 py-4">
                  <div className="text-sm text-muted-foreground">
                    Page {orderPage} of {totalOrderPages}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setOrderPage(orderPage - 1)}
                    disabled={orderPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" /> Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setOrderPage(orderPage + 1)}
                    disabled={orderPage === totalOrderPages}
                  >
                    Next <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
