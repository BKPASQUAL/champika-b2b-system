"use client";

import { useState, useEffect, use, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Printer,
  CheckCircle2,
  User,
  Phone,
  Briefcase,
  Loader2,
  XCircle,
  Edit,
  Save,
  X,
  Trash2,
  AlertTriangle,
  Plus,
  Package,
  Check,
  ChevronsUpDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { BUSINESS_IDS } from "@/app/config/business-constants";

interface Product {
  id: string;
  sku: string;
  name: string;
  selling_price: number;
  mrp: number;
  stock_quantity: number;
  unit_of_measure: string;
}

interface OrderItem {
  id: string;
  productId?: string;
  sku: string;
  name: string;
  unit: string;
  price: number;
  sellingPrice: number;
  qty: number;
  free: number;
  discountPercent: number;
  discountAmount: number;
  total: number;
  isNew?: boolean;
}

export default function ViewOrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const distributionBusinessId = BUSINESS_IDS.CHAMPIKA_DISTRIBUTION;

  const [order, setOrder] = useState<any>(null);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [unpaidInvoices, setUnpaidInvoices] = useState<any[]>([]);
  const [invoicesLoaded, setInvoicesLoaded] = useState(false);

  // Edit Mode
  const [isEditing, setIsEditing] = useState(false);
  const [billingDate, setBillingDate] = useState("");
  const [deletedItemIds, setDeletedItemIds] = useState<Set<string>>(new Set());
  const [editingItemId, setEditingItemId] = useState<string | null>(null);

  // Product Add Form
  const [products, setProducts] = useState<Product[]>([]);
  const [stockLoading, setStockLoading] = useState(false);
  const [outOfStockOverride, setOutOfStockOverride] = useState(false);
  const [productOpen, setProductOpen] = useState(false);
  const [currentItem, setCurrentItem] = useState({
    productId: "",
    sku: "",
    quantity: "",
    freeQuantity: "",
    unit: "",
    mrp: 0,
    unitPrice: 0,
    discountPercent: "",
    stockAvailable: 0,
  });
  const qtyInputRef = useRef<HTMLInputElement>(null);

  // Dialog States
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [showSaveConfirmDialog, setShowSaveConfirmDialog] = useState(false);

  // --- Fetch Order ---
  const fetchOrderDetails = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/orders/${id}`);
      if (!res.ok) throw new Error("Failed to load order");

      const data = await res.json();
      setOrder(data);
      setBillingDate(
        data.date ? new Date(data.date).toISOString().split("T")[0] : ""
      );

      if (data.customerId) {
        const invRes = await fetch(
          `/api/customers/${data.customerId}/invoices?unpaid=true`
        );
        if (invRes.ok) {
          const invData = await invRes.json();
          setUnpaidInvoices(
            invData.filter((inv: any) => inv.invoiceNo !== data.invoiceNo)
          );
        }
      }
      setInvoicesLoaded(true);

      const mappedItems = data.items.map((item: any) => {
        const grossAmount = item.price * item.qty;
        const netAmount = item.total;
        const discountAmount = Math.max(0, grossAmount - netAmount);
        const discountPercent =
          grossAmount > 0 ? (discountAmount / grossAmount) * 100 : 0;
        return {
          ...item,
          sellingPrice: item.sellingPrice ?? item.price,
          discountPercent: parseFloat(discountPercent.toFixed(2)),
          discountAmount,
        };
      });
      setItems(mappedItems);
      setDeletedItemIds(new Set());
    } catch (error) {
      console.error(error);
      toast.error("Could not fetch order details");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrderDetails();
  }, [id]);

  // --- Load Rep Stock When Entering Edit Mode ---
  useEffect(() => {
    if (!isEditing || !order?.salesRepId) return;

    const fetchRepStock = async () => {
      setStockLoading(true);
      try {
        // Fetch override setting alongside stock
        const overrideRes = await fetch("/api/settings/invoice-override").catch(() => null);
        let overrideEnabled = false;
        if (overrideRes?.ok) {
          const od = await overrideRes.json();
          overrideEnabled = od.enabled ?? false;
          setOutOfStockOverride(overrideEnabled);
        }

        const stockUrl = `/api/rep/stock?userId=${order.salesRepId}&businessId=${distributionBusinessId}${overrideEnabled ? "&includeOutOfStock=true" : ""}`;
        const res = await fetch(stockUrl);
        if (!res.ok) throw new Error();
        const data = await res.json();
        setProducts(
          data
            .filter((p: any) => p.subCategory !== "Retail Exclusive" && !p.retail_only)
            .map((p: any) => ({
              id: p.id,
              sku: p.sku || "N/A",
              name: p.name,
              selling_price: p.sellingPrice || p.selling_price || 0,
              mrp: p.mrp || 0,
              stock_quantity: p.stock || p.stock_quantity || 0,
              unit_of_measure: p.unit || p.unit_of_measure || "unit",
            }))
        );
      } catch {
        toast.error("Failed to load product stock");
        setProducts([]);
      } finally {
        setStockLoading(false);
      }
    };

    fetchRepStock();
  }, [isEditing, order?.salesRepId]);

  // --- Product Selection ---
  const handleProductSelect = (productId: string) => {
    const product = products.find((p) => p.id === productId);
    if (!product) return;
    setCurrentItem({
      productId: product.id,
      sku: product.sku,
      quantity: "",
      freeQuantity: "",
      unit: product.unit_of_measure,
      mrp: product.mrp,
      unitPrice: product.selling_price,
      discountPercent: "",
      stockAvailable: product.stock_quantity,
    });
    setProductOpen(false);
    setTimeout(() => qtyInputRef.current?.focus(), 100);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddItem();
    }
  };

  const resetCurrentItem = () => {
    setCurrentItem({
      productId: "",
      sku: "",
      quantity: "",
      freeQuantity: "",
      unit: "",
      mrp: 0,
      unitPrice: 0,
      discountPercent: "",
      stockAvailable: 0,
    });
  };

  const handleEditItem = (item: OrderItem) => {
    setEditingItemId(item.id);
    const product = products.find((p) => p.id === item.productId);
    const currentDbStock = product ? product.stock_quantity : 0;
    setCurrentItem({
      productId: item.productId || "",
      sku: item.sku,
      quantity: String(item.qty),
      freeQuantity: String(item.free),
      unit: item.unit,
      mrp: product?.mrp || 0,
      unitPrice: item.price,
      discountPercent: String(item.discountPercent),
      stockAvailable: currentDbStock + item.qty + item.free,
    });
  };

  const handleCancelEdit = () => {
    setEditingItemId(null);
    resetCurrentItem();
  };

  const handleAddItem = () => {
    const qty = parseFloat(currentItem.quantity);
    const free = parseFloat(currentItem.freeQuantity) || 0;
    const discPerc = parseFloat(currentItem.discountPercent) || 0;

    if (!currentItem.productId) {
      toast.error("Please select a product");
      return;
    }
    if (!qty || qty <= 0) {
      toast.error("Quantity must be greater than 0");
      return;
    }
    if (!outOfStockOverride && qty + free > currentItem.stockAvailable) {
      toast.error(`Insufficient stock! Available: ${currentItem.stockAvailable}`);
      return;
    }

    const product = products.find((p) => p.id === currentItem.productId);
    const grossTotal = currentItem.unitPrice * qty;
    const discountAmount = (grossTotal * discPerc) / 100;
    const total = grossTotal - discountAmount;

    if (editingItemId) {
      // Update existing item
      const original = items.find((i) => i.id === editingItemId);
      setItems((prev) =>
        prev.map((i) =>
          i.id === editingItemId
            ? {
                ...i,
                qty,
                free,
                price: currentItem.unitPrice,
                sellingPrice: product?.selling_price ?? i.sellingPrice,
                discountPercent: discPerc,
                discountAmount,
                total,
                isNew: original?.isNew,
              }
            : i
        )
      );
      setEditingItemId(null);
    } else {
      // Add new item
      const newItem: OrderItem = {
        id: "new-" + Date.now(),
        productId: currentItem.productId,
        sku: currentItem.sku,
        name: product?.name || currentItem.sku,
        unit: currentItem.unit,
        price: currentItem.unitPrice,
        sellingPrice: product?.selling_price || currentItem.unitPrice,
        qty,
        free,
        discountPercent: discPerc,
        discountAmount,
        total,
        isNew: true,
      };
      setItems((prev) => [...prev, newItem]);
    }

    resetCurrentItem();
  };

  const handleRemoveItem = (itemId: string) => {
    const item = items.find((i) => i.id === itemId);
    if (item && !item.isNew) {
      setDeletedItemIds((prev) => new Set([...prev, itemId]));
    }
    if (editingItemId === itemId) {
      setEditingItemId(null);
      resetCurrentItem();
    }
    setItems((prev) => prev.filter((i) => i.id !== itemId));
    toast.info("Item removed. Save changes to apply.");
  };

  // --- Save Changes ---
  const saveChanges = async () => {
    if (!order) return;
    setProcessing(true);

    const existingItems = items.filter((i) => !i.isNew);
    const newItems = items
      .filter((i) => i.isNew)
      .map((i) => ({
        productId: i.productId,
        qty: i.qty,
        free: i.free,
        price: i.price,
        total: i.total,
        discountPercent: i.discountPercent,
        discountAmount: i.discountAmount,
      }));

    const totalAmount = items.reduce((acc, item) => acc + (item.total || 0), 0);

    try {
      const res = await fetch(`/api/orders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_items",
          items: existingItems,
          newItems,
          deletedItemIds: Array.from(deletedItemIds),
          totalAmount,
          orderDate: billingDate,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update order");

      toast.success("Order updated successfully!");
      setIsEditing(false);
      fetchOrderDetails();
    } catch (error: any) {
      toast.error(error.message || "Failed to save changes");
    } finally {
      setProcessing(false);
      setShowSaveConfirmDialog(false);
    }
  };

  // --- Approve / Reject ---
  const executeApprove = async () => {
    setProcessing(true);
    try {
      const res = await fetch(`/api/orders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "Processing" }),
      });
      if (!res.ok) throw new Error("Failed to approve order");
      toast.success("Order Approved! Moved to Processing.");
      router.push("/dashboard/office/distribution/orders/pending");
    } catch (error: any) {
      toast.error(error.message || "Failed to update status");
    } finally {
      setProcessing(false);
      setShowApproveDialog(false);
    }
  };

  const executeReject = async () => {
    setProcessing(true);
    try {
      const res = await fetch(`/api/orders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "Cancelled" }),
      });
      if (!res.ok) throw new Error("Failed to cancel order");
      toast.success("Order Cancelled.");
      router.push("/dashboard/office/distribution/orders/pending");
    } catch (error: any) {
      toast.error(error.message || "Failed to cancel order");
    } finally {
      setProcessing(false);
      setShowRejectDialog(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!order) {
    return <div className="p-10 text-center text-red-500">Order not found</div>;
  }

  const totalItemGross = items.reduce((acc, item) => acc + item.price * item.qty, 0);
  const totalItemDiscounts = items.reduce((acc, item) => acc + item.discountAmount, 0);
  const subtotal = items.reduce((acc, item) => acc + item.total, 0);
  const finalGrandTotal = isEditing ? subtotal : order.totalAmount;
  const extraDiscountAmount = Math.max(0, subtotal - finalGrandTotal);
  const extraDiscountPercent =
    subtotal > 0 ? (extraDiscountAmount / subtotal) * 100 : 0;

  // Products already in the order (exclude from add dropdown)
  const availableProducts = products.filter(
    (p) => !items.some((i) => i.productId === p.id)
  );

  const qtyNum = parseFloat(currentItem.quantity) || 0;
  const discPercNum = parseFloat(currentItem.discountPercent) || 0;
  const currentDiscountAmt = (currentItem.unitPrice * qtyNum * discPercNum) / 100;
  const currentTotal = currentItem.unitPrice * qtyNum - currentDiscountAmt;

  return (
    <div className="space-y-4 mx-auto pb-20">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.back()}
            className="h-9 w-9"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-blue-900">
              {isEditing ? "Edit Order" : "Order Details"}
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-sm text-muted-foreground font-mono">
                Order #{order.orderId}
              </p>
              <Badge
                variant={order.status === "Pending" ? "secondary" : "outline"}
              >
                {order.status}
              </Badge>
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          {isEditing ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsEditing(false);
                  setEditingItemId(null);
                  resetCurrentItem();
                  fetchOrderDetails();
                }}
                disabled={processing}
              >
                <X className="w-4 h-4 mr-2" /> Cancel
              </Button>
              <Button
                size="sm"
                onClick={() => setShowSaveConfirmDialog(true)}
                disabled={processing || items.length === 0}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {processing ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                Save Changes
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.print()}
              >
                <Printer className="w-4 h-4 mr-2" /> Print
              </Button>
              {order.status === "Pending" && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsEditing(true)}
                    className="bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 hover:text-blue-800"
                  >
                    <Edit className="w-4 h-4 mr-2" /> Edit Order
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                    onClick={() => setShowRejectDialog(true)}
                    disabled={processing}
                  >
                    <XCircle className="w-4 h-4 mr-2" /> Reject
                  </Button>
                  <Button
                    size="sm"
                    className="bg-green-600 hover:bg-green-700 text-white"
                    onClick={() => setShowApproveDialog(true)}
                    disabled={processing}
                  >
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Approve
                  </Button>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {isEditing && outOfStockOverride && (
        <div className="flex items-start gap-2 bg-orange-50 border border-orange-300 rounded-lg px-4 py-3 text-sm text-orange-800">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-orange-500" />
          <span>
            <strong>Out-of-stock override is active:</strong> Products with 0 stock are visible and can be added to the order.
          </span>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* LEFT COLUMN */}
        <div className="lg:col-span-2 space-y-6">
          {/* Customer & Invoice Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Customer & Invoice</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-linear-to-r from-blue-50 to-blue-100/50 p-4 rounded-lg border border-blue-200">
                <div className="flex justify-between items-center">
                  <div>
                    <Label className="text-xs text-blue-600 font-semibold uppercase tracking-wide">
                      Invoice Number
                    </Label>
                    <div className="text-2xl font-bold text-blue-900 mt-1 font-mono">
                      {order.invoiceNo || "N/A"}
                    </div>
                  </div>
                  <div className="text-right space-y-1">
                    <div className="text-xs text-muted-foreground">
                      Order ID:{" "}
                      <span className="font-mono font-medium text-foreground">
                        {order.orderId}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Payment:{" "}
                      <Badge
                        variant={
                          order.paymentStatus === "Paid"
                            ? "default"
                            : "destructive"
                        }
                        className="ml-1 text-[10px] h-5"
                      >
                        {order.paymentStatus}
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground font-semibold uppercase">
                    Customer
                  </Label>
                  <div className="p-3 border rounded-lg bg-muted/30">
                    <div className="flex items-start gap-2">
                      <User className="w-4 h-4 text-muted-foreground mt-0.5" />
                      <div>
                        <div className="font-semibold">
                          {order.customer?.shopName || "Unknown"}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {order.customer?.name}
                        </div>
                        <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                          <Phone className="w-3 h-3" />
                          {order.customer?.phone || "N/A"}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground font-semibold uppercase">
                    Sales Rep
                  </Label>
                  <div className="p-3 border rounded-lg bg-muted/30">
                    <div className="flex items-center gap-2">
                      <Briefcase className="w-4 h-4 text-muted-foreground" />
                      <span className="font-medium">{order.salesRep}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Billing Date */}
              <div className="space-y-2">
                <Label>Billing Date</Label>
                {isEditing ? (
                  <Input
                    type="date"
                    value={billingDate}
                    onChange={(e) => setBillingDate(e.target.value)}
                    className="w-1/2"
                  />
                ) : (
                  <div className="text-sm font-medium">
                    {billingDate
                      ? new Date(billingDate).toLocaleDateString()
                      : "—"}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Add / Edit Products (edit mode only) */}
          {isEditing && (
            <Card className={editingItemId ? "border-blue-500 border-2" : ""}>
              <CardHeader>
                <CardTitle>{editingItemId ? "Edit Item" : "Add Products"}</CardTitle>
                <CardDescription>
                  {editingItemId
                    ? "Update the item details below"
                    : "Search and add products to the order"}
                  {stockLoading && (
                    <Loader2 className="inline h-3 w-3 animate-spin ml-2" />
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Product Selector */}
                <div className="col-span-4 space-y-2">
                  <Label>Product</Label>
                  <Popover open={productOpen} onOpenChange={setProductOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={productOpen}
                        className="w-full justify-between"
                        disabled={stockLoading || !!editingItemId}
                      >
                        {currentItem.productId
                          ? products.find((p) => p.id === currentItem.productId)
                              ?.name
                          : stockLoading
                          ? "Loading stock..."
                          : "Select Product"}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Search product..." />
                        <CommandList>
                          <CommandEmpty>No products found in this rep's stock.</CommandEmpty>
                          <CommandGroup>
                            {availableProducts.map((product) => (
                              <CommandItem
                                key={product.id}
                                value={product.name}
                                onSelect={() => handleProductSelect(product.id)}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    currentItem.productId === product.id
                                      ? "opacity-100"
                                      : "opacity-0"
                                  )}
                                />
                                <div className="flex-1">
                                  <div className="font-medium">{product.name}</div>
                                  <div className="text-xs text-muted-foreground">
                                    {product.sku} • Stock: {product.stock_quantity}{" "}
                                    • LKR {product.selling_price}
                                  </div>
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Qty / Free / Unit / Stock */}
                <div className="grid grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label>Quantity</Label>
                    <Input
                      ref={qtyInputRef}
                      type="number"
                      min="1"
                      placeholder="Qty"
                      value={currentItem.quantity}
                      onChange={(e) =>
                        setCurrentItem({ ...currentItem, quantity: e.target.value })
                      }
                      onKeyDown={handleKeyDown}
                      disabled={!currentItem.productId}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Free Qty</Label>
                    <Input
                      type="number"
                      min="0"
                      placeholder="0"
                      value={currentItem.freeQuantity}
                      onChange={(e) =>
                        setCurrentItem({
                          ...currentItem,
                          freeQuantity: e.target.value,
                        })
                      }
                      onKeyDown={handleKeyDown}
                      disabled={!currentItem.productId}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Unit</Label>
                    <Input
                      value={currentItem.unit || "-"}
                      disabled
                      className="bg-muted"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Stock</Label>
                    <Input
                      value={currentItem.stockAvailable || "-"}
                      disabled
                      className={
                        !outOfStockOverride &&
                        currentItem.stockAvailable > 0 &&
                        currentItem.stockAvailable < 10
                          ? "text-destructive font-bold bg-muted"
                          : currentItem.stockAvailable === 0 && outOfStockOverride
                          ? "text-orange-600 font-bold bg-muted"
                          : "bg-muted"
                      }
                    />
                  </div>
                </div>

                {/* MRP / Unit Price / Discount / Total */}
                <div className="grid grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label>MRP</Label>
                    <Input
                      type="number"
                      value={currentItem.mrp || ""}
                      onChange={(e) =>
                        setCurrentItem({
                          ...currentItem,
                          mrp: Number(e.target.value),
                        })
                      }
                      onKeyDown={handleKeyDown}
                      placeholder="0.00"
                      disabled={!currentItem.productId}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Unit Price</Label>
                    <Input
                      type="number"
                      value={currentItem.unitPrice || ""}
                      onChange={(e) =>
                        setCurrentItem({
                          ...currentItem,
                          unitPrice: Number(e.target.value),
                        })
                      }
                      onKeyDown={handleKeyDown}
                      placeholder="0.00"
                      disabled={!currentItem.productId}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Discount %</Label>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      placeholder="0"
                      value={currentItem.discountPercent}
                      onChange={(e) =>
                        setCurrentItem({
                          ...currentItem,
                          discountPercent: e.target.value,
                        })
                      }
                      onKeyDown={handleKeyDown}
                      disabled={!currentItem.productId}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Total</Label>
                    <Input
                      value={currentTotal.toFixed(2)}
                      disabled
                      className="font-bold bg-muted"
                    />
                  </div>
                </div>

                <div className="flex gap-2">
                  {editingItemId && (
                    <Button variant="outline" onClick={handleCancelEdit}>
                      <X className="w-4 h-4 mr-2" /> Cancel Edit
                    </Button>
                  )}
                  <Button
                    onClick={handleAddItem}
                    className="flex-1 bg-blue-600 hover:bg-blue-700"
                    disabled={!currentItem.productId}
                  >
                    {editingItemId ? (
                      <>
                        <Save className="w-4 h-4 mr-2" /> Update Item
                      </>
                    ) : (
                      <>
                        <Plus className="w-4 h-4 mr-2" /> Add to Order
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Order Items Table */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Order Items</CardTitle>
                  <CardDescription className="text-xs mt-1">
                    {isEditing
                      ? "Modify quantities, prices or discounts"
                      : `${items.length} items in this order`}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead className="text-right w-24">Price</TableHead>
                      <TableHead className="text-center w-20">Qty</TableHead>
                      <TableHead className="text-center w-20 text-green-600">
                        Free
                      </TableHead>
                      <TableHead className="text-center w-24">Disc%</TableHead>
                      <TableHead className="text-right w-28">Total</TableHead>
                      {isEditing && (
                        <TableHead className="w-12"></TableHead>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={isEditing ? 8 : 7}
                          className="text-center py-8 text-muted-foreground"
                        >
                          <Package className="w-8 h-8 mx-auto mb-2 opacity-50" />
                          No items in this order
                        </TableCell>
                      </TableRow>
                    ) : (
                      items.map((item, idx) => {
                        const priceChanged = item.price !== item.sellingPrice;
                        const hasDiscount = item.discountPercent > 0;
                        const isModified = priceChanged || hasDiscount;
                        const isBeingEdited = editingItemId === item.id;
                        return (
                          <TableRow
                            key={item.id}
                            className={
                              isBeingEdited
                                ? "bg-blue-50"
                                : item.isNew
                                ? "bg-green-50"
                                : isModified && !isEditing
                                ? "bg-red-50 hover:bg-red-100"
                                : ""
                            }
                          >
                            <TableCell className="text-muted-foreground">
                              {idx + 1}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2 font-medium text-sm">
                                {item.name}
                                {item.isNew && (
                                  <span className="text-[10px] bg-green-100 text-green-700 border border-green-200 rounded px-1 py-0.5 font-semibold">
                                    NEW
                                  </span>
                                )}
                                {isModified && !item.isNew && (
                                  <span className="text-[10px] bg-red-100 text-red-600 border border-red-200 rounded px-1 py-0.5 font-semibold">
                                    Modified
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-muted-foreground font-mono">
                                {item.sku}
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              {priceChanged ? (
                                <div>
                                  <div className="font-semibold text-red-600 text-sm">
                                    {item.price.toLocaleString()}
                                  </div>
                                  <div className="text-xs text-muted-foreground line-through">
                                    {item.sellingPrice.toLocaleString()}
                                  </div>
                                </div>
                              ) : (
                                <span className="text-sm">{item.price.toLocaleString()}</span>
                              )}
                            </TableCell>
                            <TableCell className="text-center font-medium">
                              {item.qty}
                            </TableCell>
                            <TableCell className="text-center text-green-600">
                              {item.free > 0 ? (
                                <span className="font-medium">{item.free}</span>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell className="text-center">
                              {item.discountPercent > 0 ? (
                                <div className="flex flex-col items-center">
                                  <span className="text-xs font-semibold text-red-600">
                                    {item.discountPercent}%
                                  </span>
                                  <span className="text-[10px] text-muted-foreground">
                                    (-{item.discountAmount.toLocaleString()})
                                  </span>
                                </div>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right font-bold text-sm">
                              {item.total.toLocaleString()}
                            </TableCell>
                            {isEditing && (
                              <TableCell>
                                <div className="flex gap-1 justify-end">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                    onClick={() => handleEditItem(item)}
                                    disabled={editingItemId !== null && !isBeingEdited}
                                  >
                                    <Edit className="w-4 h-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                                    onClick={() => handleRemoveItem(item.id)}
                                    disabled={!!editingItemId && !isBeingEdited}
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            )}
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* RIGHT COLUMN */}
        <div className="lg:col-span-1 space-y-6">
          <Card className="sticky top-6">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">Order Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2.5">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total Items</span>
                  <span className="font-medium">{items.length}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total Units</span>
                  <span className="font-medium">
                    {items.reduce(
                      (a, b) => a + (Number(b.qty) || 0) + (Number(b.free) || 0),
                      0
                    )}
                  </span>
                </div>
                <Separator />
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Gross Amount</span>
                  <span className="font-medium">
                    LKR {totalItemGross.toLocaleString()}
                  </span>
                </div>
                {totalItemDiscounts > 0 && (
                  <div className="flex justify-between text-sm text-red-600">
                    <span>Item Discounts</span>
                    <span>- LKR {totalItemDiscounts.toLocaleString()}</span>
                  </div>
                )}
                <Separator className="opacity-50" />
                <div className="flex justify-between text-sm">
                  <span className="text-slate-700 font-medium">Subtotal</span>
                  <span className="font-bold">
                    LKR {subtotal.toLocaleString()}
                  </span>
                </div>
                {extraDiscountAmount > 0 && (
                  <div className="flex justify-between text-sm text-red-600">
                    <span>
                      Extra Discount{" "}
                      <span className="text-xs ml-1 bg-red-50 px-1 rounded">
                        ({extraDiscountPercent.toFixed(1)}%)
                      </span>
                    </span>
                    <span>- LKR {extraDiscountAmount.toLocaleString()}</span>
                  </div>
                )}
                <Separator className="border-t-2" />
                <div className="flex justify-between items-center pt-1">
                  <span className="font-bold text-lg">Grand Total</span>
                  <span className="font-bold text-2xl text-blue-600">
                    LKR {finalGrandTotal.toLocaleString()}
                  </span>
                </div>
              </div>
              {!isEditing && (
                <Button
                  className="w-full mt-4"
                  variant="outline"
                  onClick={() => router.back()}
                >
                  Back to Orders
                </Button>
              )}
            </CardContent>
          </Card>

          {invoicesLoaded && (
            <Card
              className={
                unpaidInvoices.length > 0
                  ? "border-orange-200 bg-orange-50/50"
                  : "border-green-200 bg-green-50/50"
              }
            >
              <CardHeader className="pb-3">
                <CardTitle
                  className={`text-base flex items-center gap-2 ${
                    unpaidInvoices.length > 0
                      ? "text-orange-700"
                      : "text-green-700"
                  }`}
                >
                  <AlertTriangle className="w-4 h-4" />
                  Outstanding Invoices
                </CardTitle>
                {unpaidInvoices.length > 0 && (
                  <CardDescription className="text-xs text-orange-600">
                    {unpaidInvoices.length} unpaid invoice
                    {unpaidInvoices.length > 1 ? "s" : ""} for this customer
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent className="space-y-2 pt-0">
                {unpaidInvoices.length === 0 ? (
                  <p className="text-xs text-green-700 text-center py-2">
                    No unpaid invoices for this customer
                  </p>
                ) : (
                  <>
                    {unpaidInvoices.map((inv) => (
                      <div
                        key={inv.id}
                        className="p-2.5 rounded-md border border-orange-200 bg-white text-sm space-y-1"
                      >
                        <div className="flex justify-between items-center">
                          <span className="font-mono font-semibold text-orange-800 text-xs">
                            {inv.invoiceNo}
                          </span>
                          <Badge
                            variant="outline"
                            className="text-[10px] h-4 border-orange-300 text-orange-700"
                          >
                            {inv.status}
                          </Badge>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">
                            Invoice Date
                          </span>
                          <span className="font-medium">
                            {new Date(inv.date).toLocaleDateString()}{" "}
                            <span className="text-muted-foreground">
                              (
                              {Math.floor(
                                (Date.now() -
                                  new Date(inv.date).getTime()) /
                                  86400000
                              )}{" "}
                              days ago)
                            </span>
                          </span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">
                            Due Amount
                          </span>
                          <span className="font-semibold text-red-600">
                            LKR {(inv.dueAmount ?? inv.amount).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    ))}
                    <div className="flex justify-between text-xs font-semibold pt-1 border-t border-orange-200">
                      <span className="text-orange-700">Total Outstanding</span>
                      <span className="text-red-600">
                        LKR{" "}
                        {unpaidInvoices
                          .reduce(
                            (sum, inv) =>
                              sum + (inv.dueAmount ?? inv.amount),
                            0
                          )
                          .toLocaleString()}
                      </span>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Approve Dialog */}
      <AlertDialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Approve Order</AlertDialogTitle>
            <AlertDialogDescription>
              Confirm approval of order #{order.orderId}? This will move it to{" "}
              <strong>Processing</strong> status.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={executeApprove}
              className="bg-green-600 hover:bg-green-700"
            >
              Approve Order
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reject Dialog */}
      <AlertDialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject Order</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to reject order #{order.orderId}? This will
              mark it as <strong>Cancelled</strong>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={executeReject}
              className="bg-red-600 hover:bg-red-700"
            >
              Reject Order
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Save Confirmation Dialog */}
      <AlertDialog
        open={showSaveConfirmDialog}
        onOpenChange={setShowSaveConfirmDialog}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Save Changes</AlertDialogTitle>
            <AlertDialogDescription>
              Save all changes to this order? Stock levels and the customer
              balance will be updated accordingly.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={saveChanges}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Save Changes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
