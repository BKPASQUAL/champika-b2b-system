"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Globe,
  Package,
  ShoppingCart,
  MessageSquare,
  AlertTriangle,
  Search,
  RefreshCw,
  Printer,
  ExternalLink,
  Truck,
  CheckCircle2,
  Clock,
  Send,
  Loader2,
  ArrowUpRight,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";

function StorefrontOperationsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState("orders");

  useEffect(() => {
    const tabParam = searchParams.get("tab");
    if (tabParam && ["orders", "products", "messages", "backlog"].includes(tabParam)) {
      setActiveTab(tabParam);
    }
  }, [searchParams]);

  const handleTabChange = (val: string) => {
    setActiveTab(val);
    router.replace(`/dashboard/admin/storefront?tab=${val}`, { scroll: false });
  };

  // Tab 1: Products state
  const [products, setProducts] = useState<any[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const [editingProduct, setEditingProduct] = useState<any | null>(null);
  const [editPrice, setEditPrice] = useState<number>(0);
  const [editBuffer, setEditBuffer] = useState<number>(5);
  const [savingProduct, setSavingProduct] = useState(false);

  // Tab 2: Orders state
  const [orders, setOrders] = useState<any[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [orderStatusFilter, setOrderStatusFilter] = useState("all");
  const [orderSearch, setOrderSearch] = useState("");
  const [convertingOrderId, setConvertingOrderId] = useState<string | null>(null);

  // Dispatch modal
  const [dispatchOrder, setDispatchOrder] = useState<any | null>(null);
  const [courierName, setCourierName] = useState("Delivery Lorry");
  const [trackingNo, setTrackingNo] = useState("");
  const [updatingDispatch, setUpdatingDispatch] = useState(false);

  // Tab 3: Inquiries state
  const [inquiries, setInquiries] = useState<any[]>([]);
  const [inquiriesLoading, setInquiriesLoading] = useState(false);

  // Tab 4: Backlog state
  const [backlog, setBacklog] = useState<any[]>([]);
  const [backlogLoading, setBacklogLoading] = useState(false);

  // Fetch functions
  const fetchProducts = async () => {
    setProductsLoading(true);
    try {
      const res = await fetch("/api/storefront/manage/products");
      if (!res.ok) throw new Error("Failed to load products");
      const data = await res.json();
      setProducts(data || []);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setProductsLoading(false);
    }
  };

  const fetchOrders = async () => {
    setOrdersLoading(true);
    try {
      const res = await fetch("/api/storefront/manage/orders");
      if (!res.ok) throw new Error("Failed to load orders");
      const data = await res.json();
      setOrders(data || []);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setOrdersLoading(false);
    }
  };

  const fetchInquiries = async () => {
    setInquiriesLoading(true);
    try {
      const res = await fetch("/api/storefront/manage/inquiries");
      if (!res.ok) throw new Error("Failed to load inquiries");
      const data = await res.json();
      setInquiries(data || []);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setInquiriesLoading(false);
    }
  };

  const fetchBacklog = async () => {
    setBacklogLoading(true);
    try {
      const res = await fetch("/api/storefront/manage/backlog");
      if (!res.ok) throw new Error("Failed to load backlog");
      const data = await res.json();
      setBacklog(data || []);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBacklogLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
    fetchProducts();
    fetchInquiries();
    fetchBacklog();
  }, []);

  // Toggle publish product
  const togglePublish = async (prod: any, newValue: boolean) => {
    try {
      const res = await fetch("/api/storefront/manage/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: prod.id,
          isPublished: newValue,
          onlinePrice: prod.onlinePrice,
          stockBuffer: prod.stockBuffer,
        }),
      });
      if (!res.ok) throw new Error("Failed to update status");
      toast.success(newValue ? `${prod.name} published online!` : `${prod.name} unpublished from online`);
      setProducts((prev) =>
        prev.map((p) => (p.id === prod.id ? { ...p, isPublished: newValue } : p))
      );
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  // Save product details
  const saveProductSettings = async () => {
    if (!editingProduct) return;
    setSavingProduct(true);
    try {
      const res = await fetch("/api/storefront/manage/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: editingProduct.id,
          isPublished: editingProduct.isPublished,
          onlinePrice: Number(editPrice),
          stockBuffer: Number(editBuffer),
        }),
      });
      if (!res.ok) throw new Error("Failed to save product settings");
      toast.success("Product settings saved!");
      setProducts((prev) =>
        prev.map((p) =>
          p.id === editingProduct.id
            ? { ...p, onlinePrice: Number(editPrice), stockBuffer: Number(editBuffer), visibleOnlineStock: Math.max(0, p.warehouseStock - Number(editBuffer)) }
            : p
        )
      );
      setEditingProduct(null);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSavingProduct(false);
    }
  };

  // 1-Click Convert Order to Invoice
  const handleConvertToInvoice = async (order: any) => {
    setConvertingOrderId(order.id);
    try {
      const res = await fetch(`/api/storefront/manage/orders/${order.id}/convert`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to convert to invoice");

      toast.success(`Invoice ${data.invoiceNo} generated successfully! Opening print view...`);
      fetchOrders();
      // Open clean invoice print view with CHO-XXXX
      window.open(`/invoice/${data.invoiceId}?division=online`, "_blank");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setConvertingOrderId(null);
    }
  };

  // Order status update
  const updateOrderStatus = async (orderId: string, newStatus: string, extra: any = {}) => {
    try {
      const res = await fetch("/api/storefront/manage/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, orderStatus: newStatus, ...extra }),
      });
      if (!res.ok) throw new Error("Failed to update status");
      toast.success(`Order updated to ${newStatus}`);
      fetchOrders();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  // Complete dispatch
  const handleConfirmDispatch = async () => {
    if (!dispatchOrder) return;
    setUpdatingDispatch(true);
    try {
      await updateOrderStatus(dispatchOrder.id, "Dispatched", {
        courierOrLorry: courierName,
        trackingNumber: trackingNo,
      });
      setDispatchOrder(null);
      setTrackingNo("");
    } finally {
      setUpdatingDispatch(false);
    }
  };

  // WhatsApp sender
  const sendWhatsAppUpdate = (order: any) => {
    const phone = (order.customerPhone || "").replace(/[^0-9]/g, "");
    const formattedPhone = phone.startsWith("0") ? `94${phone.slice(1)}` : phone;
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const trackLink = `${origin}/track/${order.orderNo}`;
    const text = encodeURIComponent(
      `Hello ${order.customerName},\n\nYour BK Wiring Kade order *#${order.orderNo}* is currently: *${order.orderStatus}*.\n\n📦 Total Amount: LKR ${order.grandTotal.toLocaleString()}\n📍 Delivery: ${order.deliveryAddress}\n\nTrack your delivery in real-time here:\n${trackLink}\n\nThank you for choosing BK Wiring Kade!`
    );
    window.open(`https://wa.me/${formattedPhone}?text=${text}`, "_blank");
  };

  // Format currency
  const fmt = (num: number) => (num || 0).toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // Filtered orders
  const filteredOrders = orders.filter((o) => {
    const matchesStatus = orderStatusFilter === "all" || o.orderStatus === orderStatusFilter;
    const matchesSearch =
      !orderSearch ||
      o.orderNo?.toLowerCase().includes(orderSearch.toLowerCase()) ||
      o.customerName?.toLowerCase().includes(orderSearch.toLowerCase()) ||
      o.customerPhone?.toLowerCase().includes(orderSearch.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  // Filtered products
  const filteredProducts = products.filter((p) => {
    return (
      !productSearch ||
      p.name?.toLowerCase().includes(productSearch.toLowerCase()) ||
      p.sku?.toLowerCase().includes(productSearch.toLowerCase()) ||
      p.brand?.toLowerCase().includes(productSearch.toLowerCase())
    );
  });

  // Metrics
  const pendingOrdersCount = orders.filter((o) => o.orderStatus === "Pending").length;
  const publishedProductsCount = products.filter((p) => p.isPublished).length;
  const backlogAlertCount = backlog.length;

  return (
    <div className="space-y-6 p-4 sm:p-6 w-full">
      {/* Top Banner & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-amber-500/10 text-amber-600 rounded-lg font-bold text-lg">BK</span>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
              BK Wiring Kade Operations
            </h1>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Online Storefront Operations • Live Orders, Products, Customer Inquiries & Reorder Backlog
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => window.open("/", "_blank")}
          >
            <Globe className="w-4 h-4 text-emerald-600" />
            Visit Storefront
            <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              fetchOrders();
              fetchProducts();
              fetchInquiries();
              fetchBacklog();
              toast.info("Refreshed all storefront data");
            }}
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-amber-500">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-xs font-semibold text-slate-500 uppercase">New Online Orders</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold text-slate-900">{pendingOrdersCount}</div>
            <p className="text-xs text-amber-600 font-medium mt-1">Pending verification</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-xs font-semibold text-slate-500 uppercase">Total Orders</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold text-slate-900">{orders.length}</div>
            <p className="text-xs text-slate-500 mt-1">Lifetime online orders</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-emerald-500">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-xs font-semibold text-slate-500 uppercase">Published Online</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold text-slate-900">{publishedProductsCount}</div>
            <p className="text-xs text-emerald-600 font-medium mt-1">Live in catalog</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-rose-500">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-xs font-semibold text-slate-500 uppercase">Stock Shortages</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold text-rose-600">{backlogAlertCount}</div>
            <p className="text-xs text-rose-500 font-medium mt-1">Items needing reorder</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-4">
        <TabsList className="bg-slate-100 p-1 rounded-xl">
          <TabsTrigger value="orders" className="gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm">
            <ShoppingCart className="w-4 h-4 text-blue-600" />
            Orders & Pipeline
            {pendingOrdersCount > 0 && (
              <span className="bg-amber-500 text-white rounded-full px-1.5 py-0.2 text-[10px] font-bold">
                {pendingOrdersCount}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="products" className="gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm">
            <Package className="w-4 h-4 text-emerald-600" />
            Products & Pricing ({publishedProductsCount})
          </TabsTrigger>
          <TabsTrigger value="messages" className="gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm">
            <MessageSquare className="w-4 h-4 text-purple-600" />
            Inquiries ({inquiries.length})
          </TabsTrigger>
          <TabsTrigger value="backlog" className="gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm">
            <AlertTriangle className="w-4 h-4 text-rose-600" />
            Shortage Backlog ({backlogAlertCount})
          </TabsTrigger>
        </TabsList>

        {/* ============================================================== */}
        {/* TAB 1: ORDERS & PIPELINE                                      */}
        {/* ============================================================== */}
        <TabsContent value="orders" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
              <div>
                <CardTitle>Online Orders & Delivery Pipeline</CardTitle>
                <CardDescription>
                  Manage orders from Placed → Confirmed → Invoiced → Dispatched → Delivered
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative w-64">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <Input
                    placeholder="Search order no, customer, phone..."
                    value={orderSearch}
                    onChange={(e) => setOrderSearch(e.target.value)}
                    className="pl-9 h-9"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Status Filter Buttons */}
              <div className="flex flex-wrap gap-2 border-b pb-3">
                {["all", "Pending", "Confirmed", "Processing", "Dispatched", "Delivered", "Cancelled"].map((st) => (
                  <Button
                    key={st}
                    variant={orderStatusFilter === st ? "default" : "outline"}
                    size="sm"
                    className="capitalize text-xs h-8"
                    onClick={() => setOrderStatusFilter(st)}
                  >
                    {st === "all" ? "All Orders" : st}
                    {st !== "all" && (
                      <span className="ml-1.5 opacity-60">
                        ({orders.filter((o) => o.orderStatus === st).length})
                      </span>
                    )}
                  </Button>
                ))}
              </div>

              {ordersLoading ? (
                <div className="py-12 flex justify-center items-center">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                </div>
              ) : filteredOrders.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  No orders found matching this filter.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50">
                        <TableHead>Order #</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Items</TableHead>
                        <TableHead>Grand Total</TableHead>
                        <TableHead>Payment</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Invoice</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredOrders.map((order) => (
                        <TableRow key={order.id} className="hover:bg-slate-50/80">
                          <TableCell className="font-bold text-slate-900">
                            <div>{order.orderNo}</div>
                            <div className="text-[11px] text-slate-400 font-normal">
                              {new Date(order.createdAt).toLocaleDateString()}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="font-medium text-slate-800">{order.customerName}</div>
                            <div className="text-xs text-slate-500">{order.customerPhone}</div>
                            <div className="text-[11px] text-slate-400 truncate max-w-[180px]" title={order.deliveryAddress}>
                              {order.deliveryAddress}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-xs font-semibold text-slate-700">
                              {(order.items || []).length} items
                            </div>
                            <div className="text-[11px] text-slate-400 truncate max-w-[200px]">
                              {(order.items || []).map((i: any) => `${i.quantity}x ${i.title || i.name}`).join(", ")}
                            </div>
                          </TableCell>
                          <TableCell className="font-bold text-slate-900">
                            LKR {fmt(order.grandTotal)}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs font-medium uppercase">
                              {order.paymentMethod}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge
                              className={`text-xs font-semibold ${
                                order.orderStatus === "Delivered"
                                  ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                                  : order.orderStatus === "Dispatched"
                                  ? "bg-purple-100 text-purple-800 border-purple-300"
                                  : order.orderStatus === "Processing"
                                  ? "bg-blue-100 text-blue-800 border-blue-300"
                                  : order.orderStatus === "Confirmed"
                                  ? "bg-cyan-100 text-cyan-800 border-cyan-300"
                                  : "bg-amber-100 text-amber-800 border-amber-300"
                              }`}
                            >
                              {order.orderStatus}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {order.invoiceId ? (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs gap-1 text-slate-700"
                                onClick={() => window.open(`/invoice/${order.invoiceId}?division=online`, "_blank")}
                              >
                                <Printer className="w-3 h-3 text-emerald-600" />
                                {order.invoiceNo || "Print CHO"}
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                className="h-7 text-xs gap-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                                disabled={convertingOrderId === order.id}
                                onClick={() => handleConvertToInvoice(order)}
                              >
                                {convertingOrderId === order.id ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <CheckCircle2 className="w-3 h-3" />
                                )}
                                Generate Invoice
                              </Button>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* WhatsApp Chat button */}
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                                title="Chat on WhatsApp"
                                onClick={() => sendWhatsAppUpdate(order)}
                              >
                                <Send className="w-3.5 h-3.5" />
                              </Button>

                              {/* Progress buttons */}
                              {order.orderStatus === "Pending" && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-8 text-xs text-blue-600 hover:bg-blue-50"
                                  onClick={() => updateOrderStatus(order.id, "Confirmed")}
                                >
                                  Confirm
                                </Button>
                              )}
                              {(order.orderStatus === "Confirmed" || order.orderStatus === "Processing") && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-8 text-xs text-purple-600 hover:bg-purple-50 gap-1"
                                  onClick={() => setDispatchOrder(order)}
                                >
                                  <Truck className="w-3 h-3" />
                                  Dispatch
                                </Button>
                              )}
                              {order.orderStatus === "Dispatched" && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-8 text-xs text-emerald-600 hover:bg-emerald-50"
                                  onClick={() => updateOrderStatus(order.id, "Delivered")}
                                >
                                  Mark Delivered
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============================================================== */}
        {/* TAB 2: PRODUCTS & PRICING                                     */}
        {/* ============================================================== */}
        <TabsContent value="products" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
              <div>
                <CardTitle>Online Products & Custom Pricing</CardTitle>
                <CardDescription>
                  Choose which warehouse items appear on BK Wiring Kade, set online retail prices and stock buffers.
                </CardDescription>
              </div>
              <div className="relative w-64">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input
                  placeholder="Search products..."
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  className="pl-9 h-9"
                />
              </div>
            </CardHeader>
            <CardContent>
              {productsLoading ? (
                <div className="py-12 flex justify-center items-center">
                  <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
                </div>
              ) : (
                <div className="overflow-x-auto rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50">
                        <TableHead>Online</TableHead>
                        <TableHead>Product / SKU</TableHead>
                        <TableHead>Supplier / Brand</TableHead>
                        <TableHead>Wholesale Price</TableHead>
                        <TableHead>Online Price</TableHead>
                        <TableHead>Warehouse Stock</TableHead>
                        <TableHead>Buffer</TableHead>
                        <TableHead>Online Visible</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredProducts.map((p) => (
                        <TableRow key={p.id} className={p.isPublished ? "bg-emerald-50/20" : ""}>
                          <TableCell>
                            <Switch
                              checked={p.isPublished}
                              onCheckedChange={(checked) => togglePublish(p, checked)}
                            />
                          </TableCell>
                          <TableCell>
                            <div className="font-semibold text-slate-900">{p.onlineTitle || p.name}</div>
                            <div className="text-xs text-slate-400">{p.sku} &bull; {p.unit}</div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              {p.brand || p.supplier}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-slate-600">
                            LKR {fmt(p.wholesalePrice)}
                          </TableCell>
                          <TableCell className="font-bold text-emerald-700">
                            LKR {fmt(p.onlinePrice)}
                          </TableCell>
                          <TableCell className="text-xs font-medium">
                            <span className={p.warehouseStock <= 0 ? "text-rose-600 font-bold" : "text-slate-700"}>
                              {p.warehouseStock} {p.unit}
                            </span>
                          </TableCell>
                          <TableCell className="text-xs text-slate-500">
                            {p.stockBuffer}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={`text-xs font-semibold ${
                                p.visibleOnlineStock > 0 ? "border-emerald-300 text-emerald-700 bg-emerald-50" : "border-rose-300 text-rose-700 bg-rose-50"
                              }`}
                            >
                              {p.visibleOnlineStock} {p.unit}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 text-xs"
                              onClick={() => {
                                setEditingProduct(p);
                                setEditPrice(p.onlinePrice);
                                setEditBuffer(p.stockBuffer);
                              }}
                            >
                              Edit Settings
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============================================================== */}
        {/* TAB 3: INQUIRIES & MESSAGES                                   */}
        {/* ============================================================== */}
        <TabsContent value="messages" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Customer Inquiries & Backorder Requests</CardTitle>
              <CardDescription>
                Direct questions, quote requests, and out-of-stock product inquiries submitted by visitors.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {inquiriesLoading ? (
                <div className="py-12 flex justify-center items-center">
                  <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
                </div>
              ) : inquiries.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  No inquiries received yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {inquiries.map((inq) => (
                    <div
                      key={inq.id}
                      className="p-4 rounded-xl border bg-white flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900">{inq.customer_name}</span>
                          <span className="text-xs text-slate-400">&bull; {inq.customer_phone}</span>
                          <Badge variant="outline" className="text-[11px] capitalize">
                            {inq.inquiry_type || "General"}
                          </Badge>
                        </div>
                        <p className="text-sm text-slate-700">{inq.message}</p>
                        {inq.products && (
                          <p className="text-xs text-blue-600 font-medium">
                            Product: {inq.products.name} ({inq.products.sku})
                          </p>
                        )}
                        <span className="text-[11px] text-slate-400">
                          {new Date(inq.created_at).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 h-8 text-xs"
                          onClick={() => {
                            const phone = (inq.customer_phone || "").replace(/[^0-9]/g, "");
                            const formatted = phone.startsWith("0") ? `94${phone.slice(1)}` : phone;
                            window.open(
                              `https://wa.me/${formatted}?text=${encodeURIComponent(
                                `Hello ${inq.customer_name}, regarding your inquiry on BK Wiring Kade...`
                              )}`,
                              "_blank"
                            );
                          }}
                        >
                          <Send className="w-3.5 h-3.5" />
                          Reply on WhatsApp
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============================================================== */}
        {/* TAB 4: REORDER BACKLOG                                        */}
        {/* ============================================================== */}
        <TabsContent value="backlog" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Stock Shortage & Reorder Backlog</CardTitle>
              <CardDescription>
                Items running out of stock or requested by online customers, ready to export to Supplier Purchase Estimates.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {backlogLoading ? (
                <div className="py-12 flex justify-center items-center">
                  <Loader2 className="w-8 h-8 animate-spin text-rose-600" />
                </div>
              ) : backlog.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  All items have healthy stock levels. No backlog alerts!
                </div>
              ) : (
                <div className="overflow-x-auto rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50">
                        <TableHead>Product / SKU</TableHead>
                        <TableHead>Supplier</TableHead>
                        <TableHead>Current Warehouse Stock</TableHead>
                        <TableHead>Online Demand</TableHead>
                        <TableHead>Min Stock Deficit</TableHead>
                        <TableHead>Suggested Reorder</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {backlog.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-semibold text-slate-900">
                            <div>{item.name}</div>
                            <div className="text-xs text-slate-400">{item.sku}</div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              {item.supplier || item.brand}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <span className="font-bold text-rose-600">{item.currentStock}</span>
                          </TableCell>
                          <TableCell className="font-bold text-amber-600">
                            {item.onlineDemand} units
                          </TableCell>
                          <TableCell className="text-slate-600 text-xs">
                            Min: {item.minStock}
                          </TableCell>
                          <TableCell className="font-bold text-blue-600">
                            {item.suggestedReorder} units
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 text-xs gap-1 text-slate-700"
                              onClick={() => {
                                // Navigate to existing purchase estimates creator for that supplier
                                const sup = (item.supplier || "").toLowerCase();
                                if (sup.includes("orange")) {
                                  window.open("/dashboard/office/orange/purchase-estimates/create", "_blank");
                                } else if (sup.includes("sierra")) {
                                  window.open("/dashboard/office/sierra/purchase-estimates/create", "_blank");
                                } else if (sup.includes("wireman")) {
                                  window.open("/dashboard/office/wireman/purchase-estimates/create", "_blank");
                                } else {
                                  window.open("/dashboard/office/retail/purchases", "_blank");
                                }
                              }}
                            >
                              <ArrowUpRight className="w-3.5 h-3.5 text-blue-600" />
                              Create Supplier PO
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Product Settings Dialog */}
      <Dialog open={!!editingProduct} onOpenChange={(open) => !open && setEditingProduct(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Online Settings</DialogTitle>
          </DialogHeader>
          {editingProduct && (
            <div className="space-y-4 py-3">
              <div>
                <label className="text-xs font-semibold text-slate-500">Product Name</label>
                <div className="font-bold text-slate-900 text-sm mt-0.5">{editingProduct.name}</div>
                <div className="text-xs text-slate-400">SKU: {editingProduct.sku} &bull; Warehouse Stock: {editingProduct.warehouseStock}</div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-600">Wholesale Price (LKR)</label>
                  <Input disabled value={editingProduct.wholesalePrice} className="mt-1 bg-slate-50 h-9 text-xs" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600">Cost Price (LKR)</label>
                  <Input disabled value={editingProduct.costPrice} className="mt-1 bg-slate-50 h-9 text-xs" />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-800">Online Retail Selling Price (LKR)</label>
                <Input
                  type="number"
                  value={editPrice}
                  onChange={(e) => setEditPrice(parseFloat(e.target.value) || 0)}
                  className="mt-1 font-bold text-emerald-700"
                />
                <p className="text-[11px] text-slate-400 mt-1">This is the price public customers see on BK Wiring Kade.</p>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-800">Safety Stock Buffer (Units)</label>
                <Input
                  type="number"
                  value={editBuffer}
                  onChange={(e) => setEditBuffer(parseInt(e.target.value, 10) || 0)}
                  className="mt-1"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Reserved for in-store walk-in buyers. Online visible stock = {Math.max(0, editingProduct.warehouseStock - editBuffer)}
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingProduct(null)}>
              Cancel
            </Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" disabled={savingProduct} onClick={saveProductSettings}>
              {savingProduct ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dispatch Modal */}
      <Dialog open={!!dispatchOrder} onOpenChange={(open) => !open && setDispatchOrder(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Dispatch Order #{dispatchOrder?.orderNo}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-3">
            <div>
              <label className="text-xs font-bold text-slate-800">Courier / Delivery Vehicle</label>
              <Input
                placeholder="e.g. Delivery Lorry 02 / Pronto Courier"
                value={courierName}
                onChange={(e) => setCourierName(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-800">Tracking Reference / Waybill Number</label>
              <Input
                placeholder="e.g. TRK-98421 / Lorry Driver Note"
                value={trackingNo}
                onChange={(e) => setTrackingNo(e.target.value)}
                className="mt-1"
              />
            </div>
            <p className="text-xs text-slate-500">
              This will update the customer&apos;s live tracking page and show &ldquo;Dispatched&rdquo;.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDispatchOrder(null)}>
              Cancel
            </Button>
            <Button
              className="bg-purple-600 hover:bg-purple-700 text-white"
              disabled={updatingDispatch}
              onClick={handleConfirmDispatch}
            >
              {updatingDispatch ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirm Dispatch"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function StorefrontOperationsPage() {
  return (
    <Suspense
      fallback={
        <div className="h-64 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
        </div>
      }
    >
      <StorefrontOperationsContent />
    </Suspense>
  );
}
