"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
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
  Search,
  Users,
  FileText,
  ShoppingBag,
} from "lucide-react";
import { toast } from "sonner";
import { TablePagination } from "@/components/ui/TablePagination";

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
  const [search, setSearch] = useState("");

  const PER_PAGE = 10;
  const [productPage, setProductPage] = useState(1);
  const [customerPage, setCustomerPage] = useState(1);
  const [invoicePage, setInvoicePage] = useState(1);

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

  // Reset pages when search or supplier changes
  useEffect(() => { setProductPage(1); setCustomerPage(1); setInvoicePage(1); }, [search, selectedSupplier]);

  // Per-tab search filtering
  const filteredProducts = useMemo(() => {
    if (!current) return [];
    const q = search.toLowerCase();
    if (!q) return current.products;
    return current.products.filter((p: any) =>
      p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || p.category.toLowerCase().includes(q)
    );
  }, [current, search]);

  const filteredCustomers = useMemo(() => {
    if (!current) return [];
    const q = search.toLowerCase();
    if (!q) return current.customers;
    return current.customers.filter((c: any) => c.name.toLowerCase().includes(q));
  }, [current, search]);

  const filteredInvoices = useMemo(() => {
    if (!current) return [];
    const q = search.toLowerCase();
    if (!q) return current.invoices;
    return current.invoices.filter((inv: any) =>
      inv.invoiceNo.toLowerCase().includes(q) ||
      inv.customer.toLowerCase().includes(q) ||
      inv.date.includes(q)
    );
  }, [current, search]);

  // Paginated slices
  const pagedProducts  = filteredProducts.slice((productPage  - 1) * PER_PAGE, productPage  * PER_PAGE);
  const pagedCustomers = filteredCustomers.slice((customerPage - 1) * PER_PAGE, customerPage * PER_PAGE);
  const pagedInvoices  = filteredInvoices.slice((invoicePage  - 1) * PER_PAGE, invoicePage  * PER_PAGE);

  return (
    <div className="flex h-full gap-0 -m-4 md:-m-8">
      {/* ── Left Sidebar ─────────────────────────────────────────────── */}
      <aside className="w-64 shrink-0 bg-white border-r flex flex-col h-full overflow-hidden">
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
                    onClick={() => { setSelectedSupplier(s.name); setSearch(""); }}
                    className={`w-full text-left px-4 py-3 flex items-center justify-between hover:bg-muted/50 transition-colors border-b border-gray-50 ${
                      selectedSupplier === s.name ? "bg-primary/5 border-l-2 border-l-primary" : ""
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-medium truncate">{s.name}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {s.productCount} products · LKR {fmt(s.totalRevenue)}
                      </p>
                    </div>
                    {selectedSupplier === s.name && (
                      <ChevronRight className="h-3 w-3 text-primary shrink-0 ml-1" />
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>

      {/* ── Right Panel ──────────────────────────────────────────────── */}
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
                {current.productCount} products · {current.customerCount} customers · {current.invoiceCount} invoices · delivered orders only
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
                  <CardTitle className="text-sm">Top Selling Products</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart
                      data={current.products.slice(0, 8)}
                      layout="vertical"
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" tick={{ fontSize: 10 }} />
                      <YAxis
                        dataKey="name"
                        type="category"
                        width={110}
                        tick={{ fontSize: 10 }}
                        tickFormatter={(v) => v.length > 14 ? v.slice(0, 14) + "…" : v}
                      />
                      <Tooltip formatter={(v: any) => `${fmt(v)} units`} />
                      <Bar dataKey="unitsSold" fill="#0088FE" name="Units Sold" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Top Customers by Revenue</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={240}>
                    <PieChart>
                      <Pie
                        data={current.customers.slice(0, 8)}
                        dataKey="revenue"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={85}
                        label={false}
                      >
                        {current.customers.slice(0, 8).map((_: any, i: number) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: any) => `LKR ${fmt(v)}`} />
                      <Legend
                        formatter={(v) => v.length > 16 ? v.slice(0, 16) + "…" : v}
                        wrapperStyle={{ fontSize: 10 }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            {/* Tabs: Products | Customers | Invoices */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <CardTitle className="text-sm">{current.name} — Details</CardTitle>
                  <div className="relative w-full sm:w-64">
                    <Search className="absolute left-2.5 top-2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search products, customers, invoices…"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="pl-8 h-8 text-xs"
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <Tabs defaultValue="products">
                  <TabsList className="mx-4 mb-2">
                    <TabsTrigger value="products" className="text-xs gap-1">
                      <ShoppingBag className="h-3 w-3" />
                      Products ({filteredProducts.length})
                    </TabsTrigger>
                    <TabsTrigger value="customers" className="text-xs gap-1">
                      <Users className="h-3 w-3" />
                      Customers ({filteredCustomers.length})
                    </TabsTrigger>
                    <TabsTrigger value="invoices" className="text-xs gap-1">
                      <FileText className="h-3 w-3" />
                      Invoices ({filteredInvoices.length})
                    </TabsTrigger>
                  </TabsList>

                  {/* Products Tab */}
                  <TabsContent value="products" className="mt-0">
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
                          {pagedProducts.map((p: any) => (
                            <TableRow key={p.id}>
                              <TableCell>
                                <div>
                                  <p className="font-medium text-xs">{p.name}</p>
                                  {p.sku && <p className="text-[10px] text-muted-foreground">{p.sku}</p>}
                                </div>
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground">{p.category || "—"}</TableCell>
                              <TableCell className="text-right text-xs">{fmt(p.stockQty)}</TableCell>
                              <TableCell className="text-right text-xs">
                                {p.stockCostValue > 0 ? `LKR ${fmt(p.stockCostValue)}` : "—"}
                              </TableCell>
                              <TableCell className="text-right text-xs font-medium">{fmt(p.unitsSold)}</TableCell>
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
                                ) : <span className="text-xs text-muted-foreground">—</span>}
                              </TableCell>
                            </TableRow>
                          ))}
                          {filteredProducts.length === 0 && (
                            <TableRow>
                              <TableCell colSpan={9} className="text-center h-20 text-muted-foreground text-sm">
                                No products found.
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                    <TablePagination
                      currentPage={productPage}
                      totalPages={Math.ceil(filteredProducts.length / PER_PAGE)}
                      onPageChange={setProductPage}
                      totalItems={filteredProducts.length}
                      itemsPerPage={PER_PAGE}
                    />
                  </TabsContent>

                  {/* Customers Tab */}
                  <TabsContent value="customers" className="mt-0">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>#</TableHead>
                            <TableHead>Customer</TableHead>
                            <TableHead className="text-right">Orders</TableHead>
                            <TableHead className="text-right">Revenue</TableHead>
                            <TableHead className="text-right">Cost</TableHead>
                            <TableHead className="text-right">Profit</TableHead>
                            <TableHead className="text-right">Margin</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {pagedCustomers.map((c: any, i: number) => (
                            <TableRow key={c.id}>
                              <TableCell className="text-xs text-muted-foreground">{(customerPage - 1) * PER_PAGE + i + 1}</TableCell>
                              <TableCell className="font-medium text-xs">{c.name}</TableCell>
                              <TableCell className="text-right text-xs">{c.orders}</TableCell>
                              <TableCell className="text-right text-xs">LKR {fmt(c.revenue)}</TableCell>
                              <TableCell className="text-right text-xs">LKR {fmt(c.cost)}</TableCell>
                              <TableCell className={`text-right text-xs font-medium ${c.profit >= 0 ? "text-green-600" : "text-red-600"}`}>
                                LKR {fmt(c.profit)}
                              </TableCell>
                              <TableCell className="text-right">
                                <Badge variant={c.margin >= 20 ? "default" : "secondary"} className="text-[10px]">
                                  {c.margin.toFixed(1)}%
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                          {filteredCustomers.length === 0 && (
                            <TableRow>
                              <TableCell colSpan={7} className="text-center h-20 text-muted-foreground text-sm">
                                No customers found.
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                    <TablePagination
                      currentPage={customerPage}
                      totalPages={Math.ceil(filteredCustomers.length / PER_PAGE)}
                      onPageChange={setCustomerPage}
                      totalItems={filteredCustomers.length}
                      itemsPerPage={PER_PAGE}
                    />
                  </TabsContent>

                  {/* Invoices Tab */}
                  <TabsContent value="invoices" className="mt-0">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Invoice No</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead>Customer</TableHead>
                            <TableHead className="text-right">Revenue</TableHead>
                            <TableHead className="text-right">Cost</TableHead>
                            <TableHead className="text-right">Profit</TableHead>
                            <TableHead className="text-right">Margin</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {pagedInvoices.map((inv: any) => (
                            <TableRow key={inv.orderId}>
                              <TableCell className="font-medium text-xs">{inv.invoiceNo}</TableCell>
                              <TableCell className="text-xs text-muted-foreground">{inv.date}</TableCell>
                              <TableCell className="text-xs">{inv.customer}</TableCell>
                              <TableCell className="text-right text-xs">LKR {fmt(inv.revenue)}</TableCell>
                              <TableCell className="text-right text-xs">LKR {fmt(inv.cost)}</TableCell>
                              <TableCell className={`text-right text-xs font-medium ${inv.profit >= 0 ? "text-green-600" : "text-red-600"}`}>
                                LKR {fmt(inv.profit)}
                              </TableCell>
                              <TableCell className="text-right">
                                {inv.revenue > 0 ? (
                                  <Badge variant={inv.margin >= 20 ? "default" : "secondary"} className="text-[10px]">
                                    {inv.margin.toFixed(1)}%
                                  </Badge>
                                ) : <span className="text-xs text-muted-foreground">—</span>}
                              </TableCell>
                            </TableRow>
                          ))}
                          {filteredInvoices.length === 0 && (
                            <TableRow>
                              <TableCell colSpan={7} className="text-center h-20 text-muted-foreground text-sm">
                                No invoices found.
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                    <TablePagination
                      currentPage={invoicePage}
                      totalPages={Math.ceil(filteredInvoices.length / PER_PAGE)}
                      onPageChange={setInvoicePage}
                      totalItems={filteredInvoices.length}
                      itemsPerPage={PER_PAGE}
                    />
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
