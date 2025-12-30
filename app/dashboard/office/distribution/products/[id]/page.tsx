"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
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
  ArrowLeft,
  Package,
  DollarSign,
  TrendingUp,
  BarChart3,
  AlertTriangle,
  Loader2,
  ChevronLeft,
  ChevronRight,
  TrendingDown,
  User,
  RotateCcw,
  History,
  MapPin,
  Building2,
  Layers, // Icon for Stock Balance
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
  PieChart,
  Pie,
  Cell,
  Line,
} from "recharts";
import { Product } from "../types";
import { toast } from "sonner";
import { format } from "date-fns";

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884D8"];
const ITEMS_PER_PAGE = 10;

interface ExtendedProduct extends Product {
  stocks?: {
    locationName: string;
    isMainWarehouse: boolean;
    quantity: number;
    damaged: number;
    lastUpdated: string;
  }[];
}

interface Transaction {
  id: string;
  date: string;
  type: "SALE" | "PURCHASE" | "RETURN" | "DAMAGE" | "ADJUSTMENT";
  quantity: number;
  customer?: string;
  location: string;
  stockAfter?: number;
}

export default function ProductDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const [product, setProduct] = useState<ExtendedProduct | null>(null);
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [transactionPage, setTransactionPage] = useState(1);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const prodRes = await fetch(`/api/products/${id}`);
        if (!prodRes.ok) throw new Error("Failed to fetch product");
        const prodData = await prodRes.json();
        setProduct(prodData);

        const analyticsRes = await fetch(`/api/products/${id}/analytics`);
        if (!analyticsRes.ok) throw new Error("Failed to fetch analytics");
        const analyticsData = await analyticsRes.json();
        setAnalytics(analyticsData);
      } catch (error) {
        toast.error("Error loading data");
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!product || !analytics) return <div>Product not found</div>;

  const allTransactions: Transaction[] = analytics.allTransactions || [];

  const totalTransactionPages = Math.ceil(
    allTransactions.length / ITEMS_PER_PAGE
  );
  const startTransactionIndex = (transactionPage - 1) * ITEMS_PER_PAGE;
  const paginatedTransactions = allTransactions.slice(
    startTransactionIndex,
    startTransactionIndex + ITEMS_PER_PAGE
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h2 className="text-3xl font-bold tracking-tight">{product.name}</h2>
          <div className="flex items-center gap-2 text-muted-foreground mt-1">
            <Badge variant="outline">{product.category}</Badge>
            <span>•</span>
            <span className="text-sm">SKU: {product.sku}</span>
            <span>•</span>
            <span className="text-sm">{product.supplier}</span>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Stock</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {product.stock} {product.unitOfMeasure}
            </div>
            {product.stock <= product.minStock && (
              <p className="text-xs text-red-500 font-medium flex items-center mt-1">
                <AlertTriangle className="w-3 h-3 mr-1" /> Low Stock Warning
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Sold</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {analytics.summary.totalUnitsSold}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Lifetime units</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              LKR {analytics.summary.totalRevenue.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Lifetime sales</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Profit Margin</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {analytics.summary.margin.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              LKR {analytics.summary.totalProfit.toLocaleString()} Profit
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Tabs defaultValue="history" className="space-y-4">
            <TabsList>
              <TabsTrigger value="history">Transaction History</TabsTrigger>
              <TabsTrigger value="analytics">Analytics</TabsTrigger>
              <TabsTrigger value="details">Product Details</TabsTrigger>
            </TabsList>

            <TabsContent value="history" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Transaction History</CardTitle>
                  <CardDescription>
                    Sales, Purchases, Returns & Adjustments
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Table className="w-full">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[15%]">Date</TableHead>
                        <TableHead className="w-[15%]">Type</TableHead>
                        <TableHead className="w-[10%] text-right">
                          Qty
                        </TableHead>
                        <TableHead className="w-[15%] text-right bg-muted/20">
                          Balance
                        </TableHead>
                        <TableHead className="w-[20%] pl-6">Party</TableHead>
                        <TableHead className="w-[25%]">Location</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedTransactions.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={6}
                            className="text-center h-24 text-muted-foreground"
                          >
                            No transactions found.
                          </TableCell>
                        </TableRow>
                      ) : (
                        paginatedTransactions.map((transaction) => (
                          <TableRow key={transaction.id}>
                            <TableCell className="text-muted-foreground whitespace-nowrap">
                              {transaction.date}
                            </TableCell>
                            <TableCell>
                              {transaction.type === "SALE" && (
                                <Badge className="bg-black text-white hover:bg-black/90 gap-1 whitespace-nowrap">
                                  <TrendingDown className="h-3 w-3" /> SALE
                                </Badge>
                              )}
                              {transaction.type === "PURCHASE" && (
                                <Badge
                                  variant="outline"
                                  className="gap-1 border-green-600 text-green-600 whitespace-nowrap"
                                >
                                  <TrendingUp className="h-3 w-3" /> PURCHASE
                                </Badge>
                              )}
                              {transaction.type === "RETURN" && (
                                <Badge className="bg-blue-500 text-white hover:bg-blue-600 gap-1 whitespace-nowrap">
                                  <RotateCcw className="h-3 w-3" /> RETURN
                                </Badge>
                              )}
                              {transaction.type === "DAMAGE" && (
                                <Badge className="bg-red-500 text-white hover:bg-red-600 gap-1 whitespace-nowrap">
                                  <AlertTriangle className="h-3 w-3" /> DAMAGE
                                </Badge>
                              )}
                              {transaction.type === "ADJUSTMENT" && (
                                <Badge
                                  variant="secondary"
                                  className="gap-1 whitespace-nowrap"
                                >
                                  <History className="h-3 w-3" /> ADJUST
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell
                              className={`font-semibold text-right ${
                                transaction.quantity < 0
                                  ? "text-red-500"
                                  : "text-green-600"
                              }`}
                            >
                              {transaction.quantity > 0 ? "+" : ""}
                              {transaction.quantity}
                            </TableCell>
                            <TableCell className="text-right font-mono text-slate-600 bg-muted/20">
                              {transaction.stockAfter !== undefined
                                ? transaction.stockAfter
                                : "-"}
                            </TableCell>
                            <TableCell className="pl-6">
                              <div className="flex items-center gap-2">
                                <User className="h-3 w-3 text-muted-foreground" />
                                <span
                                  className="truncate max-w-[150px]"
                                  title={transaction.customer}
                                >
                                  {transaction.customer || "-"}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="font-medium text-slate-700">
                              <div className="flex items-center gap-2">
                                <MapPin className="h-3 w-3 text-muted-foreground" />
                                <span
                                  className="truncate max-w-[180px]"
                                  title={transaction.location}
                                >
                                  {transaction.location}
                                </span>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>

                  {allTransactions.length > 0 && (
                    <div className="flex items-center justify-between py-4 border-t mt-4">
                      <div className="text-sm text-muted-foreground">
                        Page {transactionPage} of {totalTransactionPages}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setTransactionPage((p) => Math.max(1, p - 1))
                          }
                          disabled={transactionPage === 1}
                        >
                          <ChevronLeft className="h-4 w-4 mr-1" /> Previous
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setTransactionPage((p) =>
                              Math.min(totalTransactionPages, p + 1)
                            )
                          }
                          disabled={transactionPage === totalTransactionPages}
                        >
                          Next <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="analytics" className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <Card className="col-span-2">
                  <CardHeader>
                    <CardTitle>Monthly Sales & Profit</CardTitle>
                    <CardDescription>
                      Performance over the last 12 months
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={analytics.monthly}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis yAxisId="left" />
                        <YAxis yAxisId="right" orientation="right" />
                        <Tooltip />
                        <Legend />
                        <Bar
                          yAxisId="left"
                          dataKey="revenue"
                          name="Revenue"
                          fill="#0088FE"
                        />
                        <Line
                          yAxisId="right"
                          type="monotone"
                          dataKey="profit"
                          name="Profit"
                          stroke="#00C49F"
                          strokeWidth={2}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle>Sales by Business</CardTitle>
                  </CardHeader>
                  <CardContent className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={analytics.business}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={80}
                          label={({
                            name,
                            percent,
                          }: {
                            name?: string;
                            percent?: number;
                          }) =>
                            `${name ?? ""} ${((percent || 0) * 100).toFixed(
                              0
                            )}%`
                          }
                        >
                          {analytics.business.map((_: any, index: number) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={COLORS[index % COLORS.length]}
                            />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value: any) =>
                            `LKR ${(Number(value) || 0).toLocaleString()}`
                          }
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle>Top Selling Representatives</CardTitle>
                  </CardHeader>
                  <CardContent className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={analytics.reps} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" hide />
                        <YAxis dataKey="name" type="category" width={100} />
                        <Tooltip
                          formatter={(value: any) =>
                            `LKR ${(Number(value) || 0).toLocaleString()}`
                          }
                        />
                        <Bar dataKey="value" fill="#8884d8" name="Revenue">
                          {analytics.reps.map((_: any, index: number) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={COLORS[index % COLORS.length]}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="details">
              <Card>
                <CardHeader>
                  <CardTitle>Product Information</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">
                        Description
                      </label>
                      <div className="mt-1">{product.name}</div>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">
                        Categories
                      </label>
                      <div className="mt-1 flex gap-2">
                        <Badge>{product.category}</Badge>
                        {product.subCategory && (
                          <Badge variant="outline">{product.subCategory}</Badge>
                        )}
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">
                        Brand & Model
                      </label>
                      <div className="mt-1">
                        {product.brand || "N/A"}
                        {product.modelType ? ` - ${product.modelType}` : ""}
                      </div>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">
                        Pricing
                      </label>
                      <div className="grid grid-cols-2 gap-4 mt-1 p-4 border rounded-lg bg-muted/20">
                        <div>
                          <span className="text-xs text-muted-foreground">
                            Cost Price
                          </span>
                          <div className="font-medium">
                            LKR {product.costPrice.toLocaleString()}
                          </div>
                        </div>
                        <div>
                          <span className="text-xs text-muted-foreground">
                            Selling Price
                          </span>
                          <div className="font-medium text-green-600">
                            LKR {product.sellingPrice.toLocaleString()}
                          </div>
                        </div>
                        <div>
                          <span className="text-xs text-muted-foreground">
                            MRP
                          </span>
                          <div className="font-medium">
                            LKR {product.mrp.toLocaleString()}
                          </div>
                        </div>
                        <div>
                          <span className="text-xs text-muted-foreground">
                            Commission
                          </span>
                          <div className="font-medium text-orange-600">
                            {product.commissionValue}%
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        <div>
          <Card className="h-fit sticky top-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-muted-foreground" />
                Stock Breakdown
              </CardTitle>
              <CardDescription>Live quantity by location</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {product.stocks && product.stocks.length > 0 ? (
                  product.stocks.map((stock, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-3 border rounded-lg bg-muted/10"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`p-2 rounded-full ${
                            stock.isMainWarehouse
                              ? "bg-blue-100 text-blue-700"
                              : "bg-gray-100 text-gray-700"
                          }`}
                        >
                          <MapPin className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="font-medium text-sm">
                            {stock.locationName}
                          </div>
                          {stock.lastUpdated && (
                            <div className="text-[10px] text-muted-foreground">
                              {format(
                                new Date(stock.lastUpdated),
                                "MMM d, HH:mm"
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-lg">
                          {stock.quantity}
                        </div>
                        {stock.damaged > 0 && (
                          <div className="text-xs text-red-600 font-medium">
                            {stock.damaged} Damaged
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-6 text-muted-foreground text-sm border-2 border-dashed rounded-lg">
                    No stock allocated to locations.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
