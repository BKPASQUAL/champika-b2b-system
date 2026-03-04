"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DollarSign,
  Package,
  Calendar,
  Loader2,
  Briefcase,
  CreditCard
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ComposedChart,
  Line
} from "recharts";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export default function WiremanReportPage() {
  const [timePeriod, setTimePeriod] = useState("this-year");
  const [loading, setLoading] = useState(true);

  const [overview, setOverview] = useState<any>({
    revenue: 0,
    standardCost: 0,
    standardProfit: 0,
    margin: 0,
  });

  const [monthlyData, setMonthlyData] = useState<any[]>([]);
  const [productData, setProductData] = useState<any[]>([]);
  const [customerData, setCustomerData] = useState<any[]>([]);
  const [orderData, setOrderData] = useState<any[]>([]);

  // Custom Date State
  const [customFrom, setCustomFrom] = useState(
    new Date(new Date().setDate(new Date().getDate() - 7)).toISOString().split("T")[0]
  );
  const [customTo, setCustomTo] = useState(new Date().toISOString().split("T")[0]);

  // Search State
  const [customerSearch, setCustomerSearch] = useState("");
  const [orderSearch, setOrderSearch] = useState("");

  const getDateRange = (period: string) => {
    const now = new Date();
    const today = new Date(now.setHours(0, 0, 0, 0));
    let from = new Date(today);
    let to = new Date(now.setHours(23, 59, 59, 999));

    switch (period) {
      case "today": break;
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
      case "custom":
        from = new Date(customFrom);
        to = new Date(customTo);
        to.setHours(23, 59, 59, 999);
        break;
      default:
        from = new Date(now.getFullYear(), now.getMonth(), 1);
        to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    }
    return { from: from.toISOString(), to: to.toISOString() };
  };

  useEffect(() => {
    fetchReports();
  }, [timePeriod, customFrom, customTo]);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const { from, to } = getDateRange(timePeriod);
      const res = await fetch(`/api/reports/wireman?from=${from}&to=${to}`);
      if (!res.ok) throw new Error("Failed to fetch wireman reports");
      const data = await res.json();

      setOverview(data.overview);
      setMonthlyData(data.monthly || []);
      setProductData(data.products || []);
      setCustomerData(data.customers || []);
      setOrderData(data.orders || []);
    } catch (error) {
      console.error(error);
      toast.error("Failed to load report data");
    } finally {
      setLoading(false);
    }
  };

  if (loading && !overview.revenue) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Wireman Agency Report</h1>
          <p className="text-muted-foreground">
            Analyze standard true profit (Selling Price - Base Cost)
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
              <SelectItem value="custom">Custom Range</SelectItem>
            </SelectContent>
          </Select>
          {timePeriod === "custom" && (
            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="w-auto"
              />
              <span className="text-muted-foreground">-</span>
              <Input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="w-auto"
              />
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">LKR {overview.revenue?.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Gross sales of Wireman items</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Standard Cost</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">LKR {overview.standardCost?.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Based on Default Product Cost Price</p>
          </CardContent>
        </Card>

        <Card className="bg-primary/5 border-primary/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-primary">Standard Profit</CardTitle>
            <Briefcase className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">LKR {overview.standardProfit?.toLocaleString()}</div>
            <p className="text-xs text-primary/80">Revenue - Cost</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="monthly" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 lg:grid-cols-4">
          <TabsTrigger value="monthly">Monthly Analysis</TabsTrigger>
          <TabsTrigger value="products">Product Breakdown</TabsTrigger>
          <TabsTrigger value="customers">Customer Breakdown</TabsTrigger>
          <TabsTrigger value="orders">Order Breakdown</TabsTrigger>
        </TabsList>

        <TabsContent value="monthly" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Monthly Profit Analysis</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <ComposedChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip formatter={(value: any) => `LKR ${Number(value).toLocaleString()}`} />
                  <Legend />
                  <Bar dataKey="standardProfit" fill="#8884d8" name="Profit" barSize={30} />
                  <Line type="monotone" dataKey="revenue" stroke="#ff7300" name="Revenue" strokeWidth={3} />
                </ComposedChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="products" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Product Profitability Tracker</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>SKU</TableHead>
                    <TableHead>Product Name</TableHead>
                    <TableHead className="text-center">Sold Qty</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead className="text-right">Cost</TableHead>
                    <TableHead className="text-right">Profit</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {productData.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium text-xs text-muted-foreground">{p.sku}</TableCell>
                      <TableCell className="font-medium max-w-[200px] truncate" title={p.name}>{p.name}</TableCell>
                      <TableCell className="text-center">{p.qtySold}</TableCell>
                      <TableCell className="text-right font-bold">LKR {p.revenue.toLocaleString()}</TableCell>
                      <TableCell className="text-right text-muted-foreground">LKR {p.standardCost.toLocaleString()}</TableCell>
                      <TableCell className="text-right text-green-600 font-bold">LKR {p.standardProfit.toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                  {productData.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        No product data found for this period
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="customers" className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Customer Profitability</CardTitle>
              <Input
                placeholder="Search Customer..."
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
                className="max-w-xs"
              />
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer Name</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead className="text-right">Cost</TableHead>
                    <TableHead className="text-right">Profit</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customerData
                    .filter((c) =>
                      c.name.toLowerCase().includes(customerSearch.toLowerCase())
                    )
                    .map((c, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium text-xs truncate max-w-[200px]" title={c.name}>{c.name}</TableCell>
                      <TableCell className="text-right font-bold">LKR {c.revenue.toLocaleString()}</TableCell>
                      <TableCell className="text-right text-muted-foreground">LKR {c.standardCost.toLocaleString()}</TableCell>
                      <TableCell className="text-right text-green-600 font-bold">LKR {c.standardProfit.toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                  {customerData.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                        No customer data found for this period
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="orders" className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Order Profitability</CardTitle>
              <Input
                placeholder="Search Invoice or Customer..."
                value={orderSearch}
                onChange={(e) => setOrderSearch(e.target.value)}
                className="max-w-sm"
              />
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order ID</TableHead>
                    <TableHead>Invoice No</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead className="text-right">Cost</TableHead>
                    <TableHead className="text-right">Profit</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orderData
                    .filter(
                      (o) =>
                        o.orderId.toLowerCase().includes(orderSearch.toLowerCase()) ||
                        o.invoiceNo?.toLowerCase().includes(orderSearch.toLowerCase()) ||
                        o.customer.toLowerCase().includes(orderSearch.toLowerCase())
                    )
                    .map((o) => (
                    <TableRow key={o.orderId}>
                      <TableCell className="font-medium text-xs text-muted-foreground">{o.orderId}</TableCell>
                      <TableCell className="font-medium text-xs text-primary">{o.invoiceNo}</TableCell>
                      <TableCell className="text-xs">{o.date}</TableCell>
                      <TableCell className="text-xs truncate max-w-[200px]" title={o.customer}>{o.customer}</TableCell>
                      <TableCell className="text-right font-bold">LKR {o.revenue.toLocaleString()}</TableCell>
                      <TableCell className="text-right text-muted-foreground">LKR {o.standardCost.toLocaleString()}</TableCell>
                      <TableCell className="text-right text-green-600 font-bold">LKR {o.standardProfit.toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                  {orderData.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                        No order data found for this period
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
