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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
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
} from "recharts";
import {
  Package,
  AlertTriangle,
  DollarSign,
  Layers,
  RefreshCw,
  Loader2,
  BarChart3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useCachedFetch } from "@/hooks/useCachedFetch";
import { BUSINESS_IDS } from "@/app/config/business-constants";

const RETAIL_ID = BUSINESS_IDS.CHAMPIKA_RETAIL;
const COLORS = ["#16a34a", "#0088FE", "#FFBB28", "#FF8042", "#8884D8", "#82ca9d", "#ffc658"];

const fmt = (n: number) =>
  new Intl.NumberFormat("en-LK", {
    style: "currency",
    currency: "LKR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);

export default function RetailInventoryReportPage() {
  const {
    data,
    loading,
    refetch,
  } = useCachedFetch<any>(
    `/api/inventory?businessId=${RETAIL_ID}`,
    null,
    () => toast.error("Failed to load inventory data")
  );

  const products = data?.products || [];

  const categoryBreakdown = useMemo(() => {
    const map: Record<string, { name: string; units: number; value: number; products: number }> = {};
    products.forEach((p: any) => {
      const cat = p.category || "Uncategorized";
      if (!map[cat]) map[cat] = { name: cat, units: 0, value: 0, products: 0 };
      const qty = Number(p.stock_quantity) || 0;
      const cost = Number(p.selling_price) || 0;
      map[cat].units += qty;
      map[cat].value += qty * cost;
      map[cat].products += 1;
    });
    return Object.values(map).sort((a, b) => b.value - a.value);
  }, [products]);

  const lowStockProducts = useMemo(
    () =>
      products
        .filter((p: any) => (Number(p.stock_quantity) || 0) <= (p.min_stock_level || 0))
        .sort((a: any, b: any) => (Number(a.stock_quantity) || 0) - (Number(b.stock_quantity) || 0)),
    [products]
  );

  const topValueProducts = useMemo(
    () =>
      [...products]
        .map((p: any) => ({
          ...p,
          stockValue: (Number(p.stock_quantity) || 0) * (Number(p.selling_price) || 0),
        }))
        .sort((a: any, b: any) => b.stockValue - a.stockValue)
        .slice(0, 10),
    [products]
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-green-950">
            Inventory Reports
          </h1>
          <p className="text-muted-foreground mt-1 text-sm flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Stock movement and levels for Champika Retail
          </p>
        </div>
        <Button variant="outline" size="icon" onClick={refetch} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-green-600" />
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card className="border-l-4 border-l-green-500 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Inventory Value
                </CardTitle>
                <DollarSign className="w-4 h-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-700">
                  {fmt(data?.stats?.totalValue ?? 0)}
                </div>
                <p className="text-xs text-muted-foreground">Total stock cost value</p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-blue-500 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Products
                </CardTitle>
                <Package className="w-4 h-4 text-blue-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-700">
                  {data?.stats?.totalProducts ?? 0}
                </div>
                <p className="text-xs text-muted-foreground">In product catalog</p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-amber-500 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Low Stock
                </CardTitle>
                <AlertTriangle className="w-4 h-4 text-amber-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-amber-600">
                  {data?.stats?.lowStock ?? 0}
                </div>
                <p className="text-xs text-muted-foreground">Below minimum level</p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-red-500 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Out of Stock
                </CardTitle>
                <AlertTriangle className="w-4 h-4 text-red-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">
                  {data?.stats?.outOfStock ?? 0}
                </div>
                <p className="text-xs text-muted-foreground">Items unavailable</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle className="text-base">Stock Value by Category</CardTitle>
                <CardDescription>Total stock value per product category</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={categoryBreakdown.slice(0, 10)}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" angle={-30} textAnchor="end" height={70} tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip formatter={(v: number | undefined) => fmt(v ?? 0)} />
                    <Bar dataKey="value" name="Stock Value" fill="#16a34a" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Units by Category</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie
                      data={categoryBreakdown.slice(0, 7)}
                      dataKey="units"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={90}
                      label={({ percent }: { percent?: number }) =>
                        (percent ?? 0) > 0.06 ? `${((percent ?? 0) * 100).toFixed(0)}%` : ""
                      }
                    >
                      {categoryBreakdown.slice(0, 7).map((_, index) => (
                        <Cell key={index} fill={COLORS[index % COLORS.length]} />
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
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                Low & Out of Stock Alerts
              </CardTitle>
              <CardDescription>
                {lowStockProducts.length} product{lowStockProducts.length !== 1 ? "s" : ""} need
                restocking
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="border rounded-md overflow-hidden overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-green-50/50">
                      <TableHead>SKU</TableHead>
                      <TableHead>Product Name</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-right">Current Stock</TableHead>
                      <TableHead className="text-right">Min Level</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lowStockProducts.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          No low or out of stock items
                        </TableCell>
                      </TableRow>
                    ) : (
                      lowStockProducts.slice(0, 30).map((p: any) => {
                        const good = Number(p.stock_quantity) || 0;
                        return (
                          <TableRow key={p.id}>
                            <TableCell className="font-mono text-xs text-muted-foreground">
                              {p.sku}
                            </TableCell>
                            <TableCell className="font-medium">{p.name}</TableCell>
                            <TableCell>
                              <Badge variant="secondary" className="font-normal">
                                {p.category || "-"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right font-mono">{good}</TableCell>
                            <TableCell className="text-right font-mono text-muted-foreground">
                              {p.min_stock_level || 0}
                            </TableCell>
                            <TableCell className="text-center">
                              {good === 0 ? (
                                <Badge variant="destructive">Out of Stock</Badge>
                              ) : (
                                <Badge className="bg-amber-500 hover:bg-amber-600">Low Stock</Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Layers className="w-4 h-4 text-green-600" />
                Top 10 Products by Stock Value
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="border rounded-md overflow-hidden overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-green-50/50">
                      <TableHead>Product Name</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-right">Stock Qty</TableHead>
                      <TableHead className="text-right">Unit Price</TableHead>
                      <TableHead className="text-right">Stock Value</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {topValueProducts.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                          No stock data available
                        </TableCell>
                      </TableRow>
                    ) : (
                      topValueProducts.map((p: any) => (
                        <TableRow key={p.id}>
                          <TableCell className="font-medium">{p.name}</TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="font-normal">
                              {p.category || "-"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {Number(p.stock_quantity) || 0}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {fmt(Number(p.selling_price) || 0)}
                          </TableCell>
                          <TableCell className="text-right font-mono font-medium text-green-700">
                            {fmt(p.stockValue)}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
