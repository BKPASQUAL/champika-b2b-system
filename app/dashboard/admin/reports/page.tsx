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
  ArrowUpRight,
  Loader2,
  ChevronLeft,
  ChevronRight,
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

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884D8"];
const ITEMS_PER_PAGE = 10;

export default function AdminReportsPage() {
  const [timePeriod, setTimePeriod] = useState("this-month");
  const [activeTab, setActiveTab] = useState("overview");
  const [loading, setLoading] = useState(true);

  // Pagination State
  const [orderPage, setOrderPage] = useState(1);

  // State for data
  const [overview, setOverview] = useState<any>({
    revenue: 0,
    cost: 0,
    profit: 0,
    margin: 0,
  });
  const [businessData, setBusinessData] = useState<any[]>([]);
  const [customerData, setCustomerData] = useState<any[]>([]);
  const [productData, setProductData] = useState<any[]>([]);
  const [repData, setRepData] = useState<any[]>([]);
  const [orderData, setOrderData] = useState<any[]>([]);
  const [revenueTrend, setRevenueTrend] = useState<any[]>([]);

  // Derived Pagination Data
  const totalOrderPages = Math.ceil(orderData.length / ITEMS_PER_PAGE);
  const startOrderIndex = (orderPage - 1) * ITEMS_PER_PAGE;
  const currentOrders = orderData.slice(
    startOrderIndex,
    startOrderIndex + ITEMS_PER_PAGE
  );

  // Calculate Date Ranges
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
    setOrderPage(1); // Reset pagination on filter change
  }, [timePeriod]);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const { from, to } = getDateRange(timePeriod);
      const res = await fetch(`/api/reports?from=${from}&to=${to}`);
      if (!res.ok) throw new Error("Failed to fetch reports");
      const data = await res.json();

      setOverview(data.overview);

      // Process Orders List
      const processedOrders = data.orders.map((o: any) => ({
        ...o,
        margin: o.revenue > 0 ? (o.profit / o.revenue) * 100 : 0,
      }));
      setOrderData(processedOrders);

      // Process Revenue Trend
      const trendMap: Record<string, any> = {};
      data.orders.forEach((o: any) => {
        if (!trendMap[o.date]) {
          trendMap[o.date] = { date: o.date, revenue: 0, cost: 0, profit: 0 };
        }
        trendMap[o.date].revenue += o.revenue;
        trendMap[o.date].cost += o.cost;
        trendMap[o.date].profit += o.profit;
      });
      setRevenueTrend(
        Object.values(trendMap).sort(
          (a: any, b: any) =>
            new Date(a.date).getTime() - new Date(b.date).getTime()
        )
      );

      // Process Business Data
      const processedBusiness = data.business.map((b: any) => ({
        ...b,
        margin: b.revenue > 0 ? (b.profit / b.revenue) * 100 : 0,
      }));
      setBusinessData(processedBusiness);

      // Process Customer Data
      const processedCustomers = data.customers.map((c: any) => ({
        ...c,
        avgOrder: c.orders > 0 ? c.revenue / c.orders : 0,
        margin: c.revenue > 0 ? (c.profit / c.revenue) * 100 : 0,
      }));
      setCustomerData(processedCustomers);

      // Process Product Data
      const processedProducts = data.products.map((p: any) => ({
        ...p,
        margin: p.revenue > 0 ? ((p.revenue - p.cost) / p.revenue) * 100 : 0,
        profit: p.revenue - p.cost,
      }));
      setProductData(processedProducts);

      // Process Rep Data
      const processedReps = data.reps.map((r: any) => ({
        ...r,
        margin: r.revenue > 0 ? (r.profit / r.revenue) * 100 : 0,
      }));
      setRepData(processedReps);
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

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalOrderPages) {
      setOrderPage(newPage);
    }
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
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Financial Reports
          </h1>
          <p className="text-muted-foreground">
            Profit margins, revenue, and performance analytics
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

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="space-y-6"
      >
        <TabsList className="grid w-full grid-cols-2 lg:grid-cols-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="business">By Business</TabsTrigger>
          <TabsTrigger value="customer">By Customer</TabsTrigger>
          <TabsTrigger value="product">By Product</TabsTrigger>
          <TabsTrigger value="representative">By Representative</TabsTrigger>
          <TabsTrigger value="order">By Order</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          {/* Key Metrics */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Cost of Goods
                </CardTitle>
                <Package className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  LKR {overview.cost?.toLocaleString()}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Net Profit
                </CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  LKR {overview.profit?.toLocaleString()}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Margin %</CardTitle>
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {overview.margin?.toFixed(1)}%
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Charts */}
          <div className="grid gap-4 md:grid-cols-2">
            {/* Revenue Trend */}
            <Card>
              <CardHeader>
                <CardTitle>Revenue Trend</CardTitle>
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
                      <linearGradient
                        id="colorProfit"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="5%"
                          stopColor="#00C49F"
                          stopOpacity={0.8}
                        />
                        <stop
                          offset="95%"
                          stopColor="#00C49F"
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Area
                      type="monotone"
                      dataKey="revenue"
                      stroke="#0088FE"
                      fillOpacity={1}
                      fill="url(#colorRevenue)"
                    />
                    <Area
                      type="monotone"
                      dataKey="profit"
                      stroke="#00C49F"
                      fillOpacity={1}
                      fill="url(#colorProfit)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Profit Margin by Business */}
            <Card>
              <CardHeader>
                <CardTitle>Profit Margin by Business</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={businessData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="revenue" fill="#0088FE" name="Revenue" />
                    <Bar dataKey="profit" fill="#00C49F" name="Profit" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Top Performers */}
          <div className="grid gap-4 md:grid-cols-3">
            {/* Top Products */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Top Products</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {productData.slice(0, 5).map((product, index) => (
                    <div
                      key={product.id}
                      className="flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-medium">
                          {index + 1}
                        </div>
                        <div className="text-sm font-medium">
                          {product.name}
                        </div>
                      </div>
                      <div className="text-sm font-medium">
                        LKR {product.revenue.toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Top Customers */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Top Customers</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {customerData.slice(0, 5).map((customer, index) => (
                    <div
                      key={customer.id}
                      className="flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-medium">
                          {index + 1}
                        </div>
                        <div className="text-sm font-medium">
                          {customer.name}
                        </div>
                      </div>
                      <div className="text-sm font-medium">
                        LKR {customer.revenue.toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Top Representatives */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Top Representatives</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {repData.slice(0, 5).map((rep, index) => (
                    <div
                      key={rep.id}
                      className="flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-medium">
                          {index + 1}
                        </div>
                        <div className="text-sm font-medium">{rep.name}</div>
                      </div>
                      <div className="text-sm font-medium">
                        LKR {rep.revenue.toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Detailed Transactions */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Transactions</CardTitle>
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
                  {orderData.slice(0, 10).map((order) => (
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
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* By Business Tab */}
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
                        LKR {business.cost.toLocaleString()}
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

        {/* By Customer Tab */}
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

        {/* By Product Tab */}
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

        {/* By Representative Tab */}
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

        {/* By Order Tab */}
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

              {/* Pagination Controls */}
              {orderData.length > 0 && (
                <div className="flex items-center justify-end space-x-2 py-4">
                  <div className="text-sm text-muted-foreground">
                    Page {orderPage} of {totalOrderPages}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(orderPage - 1)}
                    disabled={orderPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(orderPage + 1)}
                    disabled={orderPage === totalOrderPages}
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
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
