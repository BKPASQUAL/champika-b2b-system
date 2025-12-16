// app/products/[id]/page.tsx
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

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884D8"];
const ITEMS_PER_PAGE = 10;

// Combined transaction type
interface Transaction {
  id: string;
  date: string;
  type: "SALE" | "PURCHASE";
  quantity: number;
  customer?: string;
  supplier?: string;
  reference: string;
  notes: string;
}

export default function ProductDetailsPage({
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
        // 1. Fetch Product Basic Info
        const prodRes = await fetch(`/api/products/${id}`);
        if (!prodRes.ok) throw new Error("Failed to fetch product");
        const prodData = await prodRes.json();
        setProduct(prodData);

        // 2. Fetch Analytics (Sales + Purchases)
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

  // Combine sales and purchases into unified transaction list
  const allTransactions: Transaction[] = [
    ...(analytics.history || []).map((sale: any) => ({
      id: sale.id,
      date: sale.date,
      type: "SALE" as const,
      quantity: -Math.abs(sale.quantity), // Negative for sales
      customer: sale.customer,
      reference: sale.orderId || "",
      notes: `Sale - Order ${sale.orderId}`,
    })),
    ...(analytics.purchaseHistory || []).map((purchase: any) => ({
      id: purchase.id,
      date: purchase.date,
      type: "PURCHASE" as const,
      quantity: Math.abs(purchase.quantity), // Positive for purchases
      supplier: purchase.supplier,
      reference: purchase.purchaseId || "",
      notes:
        purchase.notes || `Stock addition from purchase ${purchase.purchaseId}`,
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()); // Sort by date descending

  // Pagination for unified transactions
  const totalTransactionPages = Math.ceil(
    allTransactions.length / ITEMS_PER_PAGE
  );
  const startTransactionIndex = (transactionPage - 1) * ITEMS_PER_PAGE;
  const paginatedTransactions = allTransactions.slice(
    startTransactionIndex,
    startTransactionIndex + ITEMS_PER_PAGE
  );

  return (
    <div className="space-y-6 ">
      {/* Header */}
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

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
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

      <Tabs defaultValue="history" className="space-y-4">
        <TabsList>
          <TabsTrigger value="history">Transaction History</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="details">Product Details</TabsTrigger>
        </TabsList>

        {/* --- UNIFIED TRANSACTION HISTORY TAB --- */}
        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Transaction History</CardTitle>
              <CardDescription>
                All transactions for this product (each line item shown
                separately)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[120px]">Date</TableHead>
                    <TableHead className="w-[120px]">Type</TableHead>
                    <TableHead className="w-[100px]">Quantity</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead className="w-[120px]">Reference</TableHead>
                    <TableHead>Notes</TableHead>
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
                        <TableCell className="text-muted-foreground">
                          {transaction.date}
                        </TableCell>
                        <TableCell>
                          {transaction.type === "SALE" ? (
                            <Badge className="bg-black text-white hover:bg-black/90 gap-1">
                              <TrendingDown className="h-3 w-3" />
                              SALE
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="gap-1">
                              <TrendingUp className="h-3 w-3" />
                              PURCHASE
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell
                          className={`font-semibold ${
                            transaction.quantity < 0
                              ? "text-red-500"
                              : "text-green-600"
                          }`}
                        >
                          {transaction.quantity > 0 ? "+" : ""}
                          {transaction.quantity} rolls
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <User className="h-3 w-3 text-muted-foreground" />
                            <span>
                              {transaction.customer ||
                                transaction.supplier ||
                                "-"}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
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
                      formatter={(value: number) =>
                        `LKR ${value.toLocaleString()}`
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
                      formatter={(value: number) =>
                        `LKR ${value.toLocaleString()}`
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
