// app/admin/reports/page.tsx
"use client";

import { useState } from "react";
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
  ArrowDownRight,
} from "lucide-react";
import {
  LineChart,
  Line,
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

// Sample data - Replace with actual API calls
const revenueData = [
  { date: "Dec 1", revenue: 4500, cost: 3200, profit: 1300 },
  { date: "Dec 3", revenue: 5200, cost: 3800, profit: 1400 },
  { date: "Dec 5", revenue: 6100, cost: 4500, profit: 1600 },
  { date: "Dec 7", revenue: 5800, cost: 4200, profit: 1600 },
  { date: "Dec 9", revenue: 7200, cost: 5300, profit: 1900 },
  { date: "Dec 11", revenue: 6800, cost: 4900, profit: 1900 },
  { date: "Dec 13", revenue: 8100, cost: 5900, profit: 2200 },
  { date: "Dec 15", revenue: 9200, cost: 6800, profit: 2400 },
];

const businessData = [
  {
    name: "Champika Hardware",
    revenue: 32500,
    cost: 23800,
    profit: 8700,
    margin: 26.8,
    orders: 245,
  },
  {
    name: "Orange Agency",
    revenue: 20921,
    cost: 15257,
    profit: 5664,
    margin: 27.1,
    orders: 89,
  },
];

const customerData = [
  {
    id: 1,
    name: "ABC Construction",
    revenue: 12500,
    orders: 45,
    avgOrder: 278,
    margin: 28.5,
  },
  {
    id: 2,
    name: "XYZ Builders",
    revenue: 10200,
    orders: 38,
    avgOrder: 268,
    margin: 25.2,
  },
  {
    id: 3,
    name: "Quick Mart",
    revenue: 8900,
    orders: 67,
    avgOrder: 133,
    margin: 31.2,
  },
  {
    id: 4,
    name: "Home Plus",
    revenue: 7800,
    orders: 52,
    avgOrder: 150,
    margin: 24.8,
  },
  {
    id: 5,
    name: "City Hardware",
    revenue: 6500,
    orders: 41,
    avgOrder: 159,
    margin: 29.1,
  },
];

const productData = [
  {
    id: 1,
    name: "Premium Cement",
    category: "Cement",
    sold: 450,
    revenue: 15600,
    cost: 11200,
    profit: 4400,
    margin: 28.2,
  },
  {
    id: 2,
    name: "Steel Rods 12mm",
    category: "Steel",
    sold: 320,
    revenue: 12800,
    cost: 9400,
    profit: 3400,
    margin: 26.6,
  },
  {
    id: 3,
    name: "Paint White 5L",
    category: "Paint",
    sold: 280,
    revenue: 9800,
    cost: 6800,
    profit: 3000,
    margin: 30.6,
  },
  {
    id: 4,
    name: "Tiles Ceramic",
    category: "Tiles",
    sold: 210,
    revenue: 8400,
    cost: 6200,
    profit: 2200,
    margin: 26.2,
  },
  {
    id: 5,
    name: "Wiring Cable",
    category: "Electrical",
    sold: 380,
    revenue: 7600,
    cost: 5200,
    profit: 2400,
    margin: 31.6,
  },
];

const repData = [
  {
    id: 1,
    name: "Kamal Silva",
    orders: 78,
    revenue: 18500,
    profit: 4920,
    margin: 26.6,
    customers: 34,
  },
  {
    id: 2,
    name: "Nimal Perera",
    orders: 65,
    revenue: 15200,
    profit: 4180,
    margin: 27.5,
    customers: 28,
  },
  {
    id: 3,
    name: "Sunil Fernando",
    orders: 54,
    revenue: 12900,
    profit: 3350,
    margin: 26.0,
    customers: 25,
  },
  {
    id: 4,
    name: "Pradeep Kumar",
    orders: 48,
    revenue: 11200,
    profit: 2912,
    margin: 26.0,
    customers: 22,
  },
];

const orderData = [
  {
    id: "INV-2024-1234",
    date: "2024-12-15",
    customer: "ABC Construction",
    business: "Champika Hardware",
    items: 8,
    revenue: 4500,
    cost: 3200,
    profit: 1300,
    margin: 28.9,
    status: "Completed",
  },
  {
    id: "INV-2024-1233",
    date: "2024-12-15",
    customer: "XYZ Builders",
    business: "Orange Agency",
    items: 5,
    revenue: 3200,
    cost: 2400,
    profit: 800,
    margin: 25.0,
    status: "Completed",
  },
  {
    id: "INV-2024-1232",
    date: "2024-12-14",
    customer: "Quick Mart",
    business: "Champika Hardware",
    items: 12,
    revenue: 2800,
    cost: 1900,
    profit: 900,
    margin: 32.1,
    status: "Completed",
  },
  {
    id: "INV-2024-1231",
    date: "2024-12-14",
    customer: "Home Plus",
    business: "Champika Hardware",
    items: 6,
    revenue: 3600,
    cost: 2700,
    profit: 900,
    margin: 25.0,
    status: "Pending",
  },
  {
    id: "INV-2024-1230",
    date: "2024-12-13",
    customer: "City Hardware",
    business: "Orange Agency",
    items: 9,
    revenue: 5100,
    cost: 3800,
    profit: 1300,
    margin: 25.5,
    status: "Completed",
  },
];

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884D8"];

export default function AdminReportsPage() {
  const [timePeriod, setTimePeriod] = useState("this-month");
  const [activeTab, setActiveTab] = useState("overview");

  const handleExport = () => {
    // Implement export functionality
    console.log("Exporting report...");
  };

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
              <SelectItem value="this-quarter">This Quarter</SelectItem>
              <SelectItem value="this-year">This Year</SelectItem>
              <SelectItem value="custom">Custom Range</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

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
                <div className="text-2xl font-bold">LKR 53,421.34</div>
                <div className="flex items-center text-xs text-muted-foreground mt-1">
                  <ArrowUpRight className="mr-1 h-3 w-3 text-green-600" />
                  <span className="text-green-600 font-medium">12.5%</span>
                  <span className="ml-1">vs last month</span>
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
                <div className="text-2xl font-bold">LKR 39,057.00</div>
                <div className="flex items-center text-xs text-muted-foreground mt-1">
                  <ArrowUpRight className="mr-1 h-3 w-3 text-orange-600" />
                  <span className="text-orange-600 font-medium">8.2%</span>
                  <span className="ml-1">vs last month</span>
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
                <div className="text-2xl font-bold">LKR 14,364.34</div>
                <div className="flex items-center text-xs text-muted-foreground mt-1">
                  <ArrowUpRight className="mr-1 h-3 w-3 text-green-600" />
                  <span className="text-green-600 font-medium">18.3%</span>
                  <span className="ml-1">vs last month</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Margin %</CardTitle>
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">26.9%</div>
                <div className="flex items-center text-xs text-muted-foreground mt-1">
                  <ArrowUpRight className="mr-1 h-3 w-3 text-green-600" />
                  <span className="text-green-600 font-medium">1.2%</span>
                  <span className="ml-1">vs last month</span>
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
                  <AreaChart data={revenueData}>
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
                  {orderData.map((order) => (
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
                        <Badge
                          variant={
                            order.status === "Completed"
                              ? "default"
                              : "secondary"
                          }
                        >
                          {order.status}
                        </Badge>
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
                        LKR {(business.revenue / business.orders).toFixed(2)}
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
                <BarChart data={customerData} layout="vertical">
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
                <CardTitle>Product Revenue Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={productData}
                      dataKey="revenue"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      label
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
                  <BarChart data={productData}>
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
                        LKR {(rep.revenue / rep.orders).toFixed(2)}
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
                    <TableHead className="text-right">Items</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead className="text-right">Cost</TableHead>
                    <TableHead className="text-right">Profit</TableHead>
                    <TableHead className="text-right">Margin</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orderData.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="font-medium">{order.id}</TableCell>
                      <TableCell>{order.date}</TableCell>
                      <TableCell>{order.customer}</TableCell>
                      <TableCell>{order.business}</TableCell>
                      <TableCell className="text-right">
                        {order.items}
                      </TableCell>
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
                        <Badge
                          variant={
                            order.status === "Completed"
                              ? "default"
                              : "secondary"
                          }
                        >
                          {order.status}
                        </Badge>
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
                <CardTitle>Order Value Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={orderData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="id"
                      angle={-45}
                      textAnchor="end"
                      height={100}
                    />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="revenue" fill="#0088FE" name="Revenue" />
                    <Bar dataKey="profit" fill="#00C49F" name="Profit" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Order Status Overview</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={[
                        { name: "Completed", value: 4 },
                        { name: "Pending", value: 1 },
                      ]}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      label
                    >
                      <Cell fill="#00C49F" />
                      <Cell fill="#FFBB28" />
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
