"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
} from "recharts";
import { Input } from "@/components/ui/input";
import {
  Package,
  DollarSign,
  TrendingUp,
  Boxes,
  Calendar,
  Loader2,
  Factory,
  ChevronRight,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884D8", "#82ca9d", "#ffc658"];

const fmt = (n: number) =>
  n.toLocaleString("en-LK", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

function getRange(quickSelect: string, customFrom: string, customTo: string) {
  const now = new Date();
  let from: Date, to: Date;
  switch (quickSelect) {
    case "this-month":
      from = new Date(now.getFullYear(), now.getMonth(), 1);
      to = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
      break;
    case "last-month":
      from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      to = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
      break;
    case "this-year":
      from = new Date(now.getFullYear(), 0, 1);
      to = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
      break;
    case "last-year":
      from = new Date(now.getFullYear() - 1, 0, 1);
      to = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59);
      break;
    case "custom":
      from = new Date(customFrom); from.setHours(0, 0, 0, 0);
      to = new Date(customTo); to.setHours(23, 59, 59, 999);
      break;
    default:
      from = new Date(now.getFullYear(), now.getMonth(), 1);
      to = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  }
  return { from: from.toISOString(), to: to.toISOString() };
}

export default function SupplierAnalyticsPage() {
  const today = new Date().toISOString().split("T")[0];
  const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    .toISOString().split("T")[0];

  const [quickSelect, setQuickSelect] = useState("this-month");
  const [customFrom, setCustomFrom] = useState(firstOfMonth);
  const [customTo, setCustomTo] = useState(today);
  const [loading, setLoading] = useState(true);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [selectedSupplier, setSelectedSupplier] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { from, to } = getRange(quickSelect, customFrom, customTo);
      const res = await fetch(`/api/reports/suppliers?from=${from}&to=${to}`);
      if (!res.ok) throw new Error("Failed to fetch supplier analytics");
      const data = await res.json();
      setSuppliers(data.suppliers || []);
      if (data.suppliers?.length > 0 && !selectedSupplier) {
        setSelectedSupplier(data.suppliers[0].name);
      }
    } catch {
      toast.error("Failed to load supplier analytics");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (quickSelect !== "custom") fetchData();
  }, [quickSelect]);

  const handleCustomApply = () => {
    if (!customFrom || !customTo) return;
    fetchData();
  };

  const current = suppliers.find((s) => s.name === selectedSupplier);

  return (
    <div className="flex h-full gap-0 -m-4 md:-m-8">
      {/* ── Left Sidebar: Supplier List ─────────────────────────────── */}
      <aside className="w-64 flex-shrink-0 bg-white border-r flex flex-col h-full overflow-hidden">
        <div className="p-4 border-b space-y-2">
          <div className="flex items-center gap-2 mb-1">
            <Factory className="h-5 w-5 text-primary" />
            <h2 className="font-semibold text-sm">Suppliers</h2>
          </div>
          <Select value={quickSelect} onValueChange={setQuickSelect}>
            <SelectTrigger className="w-full h-8 text-xs">
              <Calendar className="mr-1 h-3 w-3" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="this-month">This Month</SelectItem>
              <SelectItem value="last-month">Last Month</SelectItem>
              <SelectItem value="this-year">This Year</SelectItem>
              <SelectItem value="last-year">Last Year</SelectItem>
              <SelectItem value="custom">Custom Range</SelectItem>
            </SelectContent>
          </Select>
          {quickSelect === "custom" && (
            <div className="space-y-1.5 pt-1">
              <Input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="h-7 text-xs"
              />
              <Input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="h-7 text-xs"
              />
              <Button
                size="sm"
                className="w-full h-7 text-xs"
                onClick={handleCustomApply}
                disabled={loading}
              >
                {loading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <RefreshCw className="h-3 w-3 mr-1" />}
                Apply
              </Button>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-24">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <ul className="py-1">
              {suppliers.map((s) => (
                <li key={s.name}>
                  <button
                    onClick={() => setSelectedSupplier(s.name)}
                    className={`w-full text-left px-4 py-3 flex items-center justify-between hover:bg-muted/50 transition-colors border-b border-gray-50 ${
                      selectedSupplier === s.name
                        ? "bg-primary/5 border-l-2 border-l-primary"
                        : ""
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-medium truncate">{s.name}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {s.productCount} products · LKR {fmt(s.totalRevenue)}
                      </p>
                    </div>
                    {selectedSupplier === s.name && (
                      <ChevronRight className="h-3 w-3 text-primary flex-shrink-0 ml-1" />
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>

      {/* ── Right Panel: Supplier Detail ────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {!current ? (
          <div className="flex items-center justify-center h-64 text-muted-foreground">
            {loading ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : (
              <span className="text-sm">Select a supplier to view analytics</span>
            )}
          </div>
        ) : (
          <>
            {/* Header */}
            <div>
              <h1 className="text-2xl font-bold">{current.name}</h1>
              <p className="text-sm text-muted-foreground mt-1">
                {current.productCount} products · Only delivered orders counted
              </p>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-2 pt-4 px-4">
                  <CardTitle className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                    <Boxes className="h-3 w-3" /> Total Stock
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <div className="text-xl font-bold">{fmt(current.totalStock)}</div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">units in warehouse</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2 pt-4 px-4">
                  <CardTitle className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                    <Package className="h-3 w-3" /> Stock Cost Value
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <div className="text-xl font-bold">LKR {fmt(current.totalStockCostValue)}</div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    sell value: LKR {fmt(current.totalStockSellingValue)}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2 pt-4 px-4">
                  <CardTitle className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                    <DollarSign className="h-3 w-3" /> Total Revenue
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <div className="text-xl font-bold">LKR {fmt(current.totalRevenue)}</div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {fmt(current.totalUnitsSold)} units sold
                  </p>
                </CardContent>
              </Card>

              <Card className={current.totalProfit >= 0 ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}>
                <CardHeader className="pb-2 pt-4 px-4">
                  <CardTitle className={`text-xs font-medium flex items-center gap-1 ${current.totalProfit >= 0 ? "text-green-700" : "text-red-700"}`}>
                    <TrendingUp className="h-3 w-3" /> Gross Profit
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <div className={`text-xl font-bold ${current.totalProfit >= 0 ? "text-green-700" : "text-red-700"}`}>
                    LKR {fmt(current.totalProfit)}
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {current.margin.toFixed(1)}% margin
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Revenue by Product (Top 10)</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={current.products.slice(0, 10)} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" tick={{ fontSize: 10 }} />
                      <YAxis
                        dataKey="name"
                        type="category"
                        width={110}
                        tick={{ fontSize: 10 }}
                        tickFormatter={(v) => v.length > 14 ? v.slice(0, 14) + "…" : v}
                      />
                      <Tooltip formatter={(v: any) => `LKR ${fmt(v)}`} />
                      <Bar dataKey="revenue" fill="#0088FE" name="Revenue" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Stock Distribution (Top 10)</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                      <Pie
                        data={current.products
                          .filter((p: any) => p.stockQty > 0)
                          .slice(0, 10)}
                        dataKey="stockQty"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={90}
                        label={false}
                      >
                        {current.products.slice(0, 10).map((_: any, i: number) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: any) => `${v} units`} />
                      <Legend
                        formatter={(v) => v.length > 16 ? v.slice(0, 16) + "…" : v}
                        wrapperStyle={{ fontSize: 10 }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            {/* Products Table */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">
                  All Products — {current.name}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead className="text-right">Stock</TableHead>
                        <TableHead className="text-right">Stock Value</TableHead>
                        <TableHead className="text-right">Units Sold</TableHead>
                        <TableHead className="text-right">Revenue</TableHead>
                        <TableHead className="text-right">Cost</TableHead>
                        <TableHead className="text-right">Profit</TableHead>
                        <TableHead className="text-right">Margin</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {current.products.map((p: any) => (
                        <TableRow key={p.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium text-xs">{p.name}</p>
                              {p.sku && (
                                <p className="text-[10px] text-muted-foreground">{p.sku}</p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {p.category || "—"}
                          </TableCell>
                          <TableCell className="text-right text-xs">{fmt(p.stockQty)}</TableCell>
                          <TableCell className="text-right text-xs">
                            {p.stockCostValue > 0 ? `LKR ${fmt(p.stockCostValue)}` : "—"}
                          </TableCell>
                          <TableCell className="text-right text-xs">{fmt(p.unitsSold)}</TableCell>
                          <TableCell className="text-right text-xs">
                            {p.revenue > 0 ? `LKR ${fmt(p.revenue)}` : "—"}
                          </TableCell>
                          <TableCell className="text-right text-xs">
                            {p.cost > 0 ? `LKR ${fmt(p.cost)}` : "—"}
                          </TableCell>
                          <TableCell className={`text-right text-xs font-medium ${p.profit > 0 ? "text-green-600" : p.profit < 0 ? "text-red-600" : "text-muted-foreground"}`}>
                            {p.profit !== 0 ? `LKR ${fmt(p.profit)}` : "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            {p.revenue > 0 ? (
                              <Badge variant={p.margin >= 20 ? "default" : "secondary"} className="text-[10px]">
                                {p.margin.toFixed(1)}%
                              </Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                      {current.products.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={9} className="text-center h-20 text-muted-foreground text-sm">
                            No products found for this supplier.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
