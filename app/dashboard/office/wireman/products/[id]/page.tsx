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
  Clock, // ✅ Added for Price History
  Archive, // ✅ Added for Stock Icon
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
import { BUSINESS_IDS } from "@/app/config/business-constants";

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884D8"];
const ITEMS_PER_PAGE = 10;

// ✅ Updated Transaction Interface (Matches Admin)
interface Transaction {
  id: string;
  date: string;
  type: "SALE" | "PURCHASE" | "RETURN" | "DAMAGE" | "ADJUSTMENT" | "FREE ISSUE";
  quantity: number;
  freeQuantity?: number;
  currentStock?: number; // ✅ Added Stock Balance
  customer?: string;
  reference: string;
  notes: string;
  buyingPrice: number;
  sellingPrice: number;
}

export default function WiremanProductDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const [product, setProduct] = useState<Product | null>(null);
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [transactionPage, setTransactionPage] = useState(1);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        // 1. Fetch Product Basic Info (Filtered by Business ID)
        const prodRes = await fetch(
          `/api/products/${id}?businessId=${BUSINESS_IDS.WIREMAN_AGENCY}`,
        );

        if (prodRes.status === 404) {
          toast.error("Product not found in Wireman catalog");
          router.push("/dashboard/office/wireman/products");
          return;
        }

        if (!prodRes.ok) throw new Error("Failed to fetch product");
        const prodData = await prodRes.json();
        setProduct(prodData);

        // 2. Fetch Analytics (Filtered by Business ID)
        // This relies on the API update we made earlier to calculate stock globally first, then filter
        const analyticsRes = await fetch(
          `/api/products/${id}/analytics?businessId=${BUSINESS_IDS.WIREMAN_AGENCY}`,
        );

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
  }, [id, router]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-red-600" />
      </div>
    );
  }

  if (!product || !analytics) return <div>Product not found</div>;

  const allTransactions: Transaction[] = analytics.allTransactions || [];

  // Pagination
  const totalTransactionPages = Math.ceil(
    allTransactions.length / ITEMS_PER_PAGE,
  );
  const startTransactionIndex = (transactionPage - 1) * ITEMS_PER_PAGE;
  const paginatedTransactions = allTransactions.slice(
    startTransactionIndex,
    startTransactionIndex + ITEMS_PER_PAGE,
  );

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-LK", {
      style: "currency",
      currency: "LKR",
    }).format(amount);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-red-950">
            {product.name}
          </h2>
          <div className="flex items-center gap-2 text-muted-foreground mt-1">
            <Badge variant="outline">{product.category}</Badge>
            <span>•</span>
            <span className="text-sm">SKU: {product.sku}</span>
            <span>•</span>
            <span className="text-sm font-medium text-red-700">
              {product.supplier}
            </span>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-t-4 border-t-red-600 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Current Stock</CardTitle>
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
            <div className="text-2xl font-bold text-red-700">
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

      <Tabs defaultValue="history" className="space-y-4">
        <TabsList>
          <TabsTrigger value="history">Transaction History</TabsTrigger>
          <TabsTrigger value="prices">Price History</TabsTrigger>{" "}
          {/* ✅ New Tab */}
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="details">Product Details</TabsTrigger>
        </TabsList>

        {/* --- UNIFIED TRANSACTION HISTORY TAB --- */}
        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Transaction History</CardTitle>
              <CardDescription>
                All transactions (Sales, Purchases, Returns) for Wireman
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table className="w-full">
                <TableHeader>
                  <TableRow>
                    {/* Centered Headers & Adjusted Widths */}
                    <TableHead className="w-[100px] text-center">
                      Date
                    </TableHead>
                    <TableHead className="w-[120px] text-center">
                      Type
                    </TableHead>
                    <TableHead className="w-[80px] text-center">
                      Quantity
                    </TableHead>
                    {/* ✅ Stock Column */}
                    <TableHead className="w-[80px] text-center font-bold text-black">
                      Stock
                    </TableHead>
                    <TableHead className="w-[150px] text-center">
                      Party
                    </TableHead>
                    <TableHead className="w-[100px] text-center">
                      Buy Price
                    </TableHead>
                    <TableHead className="w-[100px] text-center">
                      Sell Price
                    </TableHead>
                    <TableHead className="w-[120px] text-center">
                      Reference
                    </TableHead>
                    <TableHead className="w-[150px]">Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedTransactions.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={9}
                        className="text-center h-24 text-muted-foreground"
                      >
                        No transactions found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedTransactions.map((transaction) => (
                      <TableRow key={transaction.id}>
                        {/* Centered Cells */}
                        <TableCell className="text-muted-foreground whitespace-nowrap text-center">
                          {transaction.date}
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex justify-center">
                            {transaction.type === "SALE" && (
                              <Badge className="bg-black text-white hover:bg-black/90 gap-1 whitespace-nowrap">
                                <TrendingDown className="h-3 w-3" />
                                SALE
                              </Badge>
                            )}
                            {transaction.type === "PURCHASE" && (
                              <Badge
                                variant="outline"
                                className="gap-1 border-green-600 text-green-600 whitespace-nowrap"
                              >
                                <TrendingUp className="h-3 w-3" />
                                PURCHASE
                              </Badge>
                            )}
                            {transaction.type === "FREE ISSUE" && (
                              <Badge
                                variant="outline"
                                className="gap-1 border-green-600 text-green-600 whitespace-nowrap"
                              >
                                <TrendingUp className="h-3 w-3" />
                                FREE ISSUE
                              </Badge>
                            )}
                            {transaction.type === "RETURN" && (
                              <Badge className="bg-blue-500 text-white hover:bg-blue-600 gap-1 whitespace-nowrap">
                                <RotateCcw className="h-3 w-3" />
                                RETURN
                              </Badge>
                            )}
                            {transaction.type === "DAMAGE" && (
                              <Badge className="bg-red-500 text-white hover:bg-red-600 gap-1 whitespace-nowrap">
                                <AlertTriangle className="h-3 w-3" />
                                DAMAGE
                              </Badge>
                            )}
                            {transaction.type === "ADJUSTMENT" && (
                              <Badge
                                variant="secondary"
                                className="gap-1 whitespace-nowrap"
                              >
                                <AlertTriangle className="h-3 w-3" />
                                ADJUST
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex flex-col items-center">
                            <span
                              className={`font-semibold ${
                                transaction.quantity < 0
                                  ? "text-red-500"
                                  : "text-green-600"
                              }`}
                            >
                              {transaction.quantity > 0 ? "+" : ""}
                              {transaction.quantity}
                            </span>
                            {transaction.freeQuantity &&
                            transaction.freeQuantity > 0 ? (
                              <span className="text-[10px] text-muted-foreground font-medium">
                                (+{transaction.freeQuantity} Free)
                              </span>
                            ) : null}
                          </div>
                        </TableCell>

                        {/* ✅ Calculated Stock - Centered */}
                        <TableCell className="text-center font-mono font-bold">
                          {transaction.currentStock}
                        </TableCell>

                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-2">
                            <User className="h-3 w-3 text-muted-foreground" />
                            <span
                              className="truncate max-w-[140px]"
                              title={transaction.customer}
                            >
                              {transaction.customer || "-"}
                            </span>
                          </div>
                        </TableCell>

                        {/* ✅ Buying Price */}
                        <TableCell className="text-center font-mono text-xs">
                          {transaction.buyingPrice > 0
                            ? formatCurrency(transaction.buyingPrice)
                            : "-"}
                        </TableCell>

                        {/* ✅ Selling Price */}
                        <TableCell className="text-center font-mono text-xs">
                          {transaction.sellingPrice > 0
                            ? formatCurrency(transaction.sellingPrice)
                            : "-"}
                        </TableCell>

                        <TableCell className="text-muted-foreground text-center">
                          {transaction.reference}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {transaction.notes}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>

              {/* Pagination */}
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
                          Math.min(totalTransactionPages, p + 1),
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

        {/* --- PRICE HISTORY TAB (Added for Hybrid Functionality) --- */}
        <TabsContent value="prices" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Price Change Log</CardTitle>
              <CardDescription>
                Historical record of cost and selling price changes.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date Changed</TableHead>
                    <TableHead>Old Cost</TableHead>
                    <TableHead>Old Selling</TableHead>
                    <TableHead>Old MRP</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {product.priceHistory && product.priceHistory.length > 0 ? (
                    product.priceHistory.map((h: any, i: number) => (
                      <TableRow key={i}>
                        <TableCell className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-muted-foreground" />
                          {new Date(h.date).toLocaleDateString()}
                          <span className="text-xs text-muted-foreground">
                            {new Date(h.date).toLocaleTimeString()}
                          </span>
                        </TableCell>
                        <TableCell>{formatCurrency(h.costPrice)}</TableCell>
                        <TableCell>{formatCurrency(h.sellingPrice)}</TableCell>
                        <TableCell>{formatCurrency(h.mrp)}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell
                        colSpan={4}
                        className="text-center text-muted-foreground h-24"
                      >
                        No price changes recorded yet.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* --- ANALYTICS TAB --- */}
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
                      fill="#DC2626"
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="profit"
                      name="Profit"
                      stroke="#059669"
                      strokeWidth={2}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Sales by Business Context</CardTitle>
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
                      label={({ name, percent }) =>
                        `${name ?? ""} ${((percent || 0) * 100).toFixed(0)}%`
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

        {/* --- DETAILS TAB --- */}
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
                      <span className="text-xs text-muted-foreground">MRP</span>
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
  );
}
