"use client";

import React, { useState, useEffect, useRef, use } from "react";
import { useRouter } from "next/navigation";
import { invalidatePaymentCaches } from "@/hooks/useCachedFetch";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Save,
  Package,
  Loader2,
  Check,
  ChevronsUpDown,
  History,
  FileText,
  AlertTriangle,
  Undo2,
  Edit,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { getUserBusinessContext } from "@/app/middleware/businessAuth";
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

interface InvoiceItem {
  id: string;
  productId: string;
  sku: string;
  productName: string;
  quantity: number;
  freeQuantity: number;
  unit: string;
  mrp: number;
  unitPrice: number;
  discountPercent: number;
  discountAmount: number;
  total: number;
}

interface InvoiceHistory {
  id: string;
  changedAt: string;
  changedBy: string;
  reason: string;
  previousTotal: number;
}

interface ReturnRecord {
  id: string;
  quantity: number;
  products: { selling_price: number };
}

export default function OrangeEditInvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [stockLoading, setStockLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);

  const qtyInputRef = useRef<HTMLInputElement>(null);

  // Business & User
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<{ id: string; name: string; email: string; role?: string } | null>(null);

  // Edit-specific
  const [salesRepId, setSalesRepId] = useState<string>("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [orderStatus, setOrderStatus] = useState("Delivered");
  const [editReason, setEditReason] = useState("");
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [historyLogs, setHistoryLogs] = useState<InvoiceHistory[]>([]);
  const [returns, setReturns] = useState<ReturnRecord[]>([]);

  // Data
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<{ id: string; name: string }[]>([]);

  // Form
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split("T")[0]);

  // Popover states
  const [customerOpen, setCustomerOpen] = useState(false);
  const [productOpen, setProductOpen] = useState(false);

  // Items
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [extraDiscount, setExtraDiscount] = useState<number>(0);

  const [currentItem, setCurrentItem] = useState({
    productId: "", sku: "", quantity: 1, freeQuantity: 0,
    unit: "", mrp: 0, unitPrice: 0, discountPercent: 0, stockAvailable: 0,
  });

  const lockedStatuses = ["Loading", "In Transit", "Delivered", "Completed", "Cancelled"];
  const isAdmin = currentUser?.role === "admin";
  const isReadOnly = !isAdmin && lockedStatuses.includes(orderStatus);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const user = getUserBusinessContext();
        if (!user) {
          toast.error("Session missing. Please log in again.");
          router.push("/login");
          return;
        }
        setBusinessId(BUSINESS_IDS.ORANGE_AGENCY);
        setCurrentUser({ id: user.id, name: user.name, email: user.email, role: user.role });

        const [invRes, custRes, retRes] = await Promise.all([
          fetch(`/api/invoices/${id}`),
          fetch(`/api/customers?businessId=${BUSINESS_IDS.ORANGE_AGENCY}`),
          fetch(`/api/invoices/${id}/returns`),
        ]);

        const invoice = await invRes.json();
        const custData = await custRes.json();
        const retData = await retRes.json();

        setCustomers(custData.map((c: any) => ({ id: c.id, name: c.shopName })));
        setReturns(retData);

        setCustomerId(invoice.customerId || null);
        setInvoiceDate(invoice.date || new Date().toISOString().split("T")[0]);
        setInvoiceNumber(invoice.invoiceNo || "");
        setOrderStatus(invoice.orderStatus || "Delivered");
        const repId = invoice.salesRepId || user.id;
        setSalesRepId(repId);

        const mappedItems = (invoice.items || []).map((item: any) => ({
          id: item.id || Math.random().toString(),
          productId: item.productId || item.product_id,
          sku: item.sku,
          productName: item.productName || item.name,
          unit: item.unit,
          quantity: item.quantity,
          freeQuantity: item.freeQuantity || 0,
          mrp: item.mrp || 0,
          unitPrice: item.unitPrice,
          discountPercent: item.discountPercent || 0,
          discountAmount: item.discountAmount || 0,
          total: item.total,
        }));
        setItems(mappedItems);

        const itemsTotal = mappedItems.reduce((s: number, i: any) => s + i.total, 0);
        const currentRefunds = retData.reduce(
          (acc: number, r: any) => acc + r.quantity * (r.products?.selling_price || 0), 0
        );
        const diff = itemsTotal - currentRefunds - invoice.grandTotal;
        if (diff > 0.01 && itemsTotal > 0) {
          setExtraDiscount(parseFloat(((diff / itemsTotal) * 100).toFixed(2)));
        }

        setStockLoading(true);
        const stockRes = await fetch(`/api/rep/stock?userId=${repId}`);
        const stockData = await stockRes.json();
        setProducts(
          Array.isArray(stockData)
            ? stockData.map((p: any) => ({
                id: p.id, sku: p.sku, name: p.name,
                selling_price: p.selling_price, mrp: p.mrp,
                stock_quantity: p.stock_quantity,
                unit_of_measure: p.unit_of_measure || "unit",
              }))
            : []
        );
      } catch (error) {
        console.error("Error loading invoice:", error);
        toast.error("Failed to load invoice");
        router.push("/dashboard/office/orange/invoices");
      } finally {
        setLoading(false);
        setStockLoading(false);
      }
    };
    fetchData();
  }, [id]);

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.shiftKey && (e.key === "f" || e.key === "F")) {
        e.preventDefault();
        const triggers = document.querySelectorAll('button[role="combobox"]');
        if (triggers && triggers.length > 1) (triggers[1] as HTMLElement).click();
        else if (triggers && triggers.length > 0) (triggers[0] as HTMLElement).click();
      }
    };
    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, []);

  const fetchHistory = async () => {
    setHistoryLoading(true);
    try {
      const res = await fetch(`/api/invoices/${id}/history`);
      if (res.ok) setHistoryLogs(await res.json());
    } catch { console.error("Failed to fetch history"); }
    finally { setHistoryLoading(false); }
  };

  const handleProductSelect = (productId: string) => {
    if (isReadOnly) return;
    const product = products.find((p) => p.id === productId);
    if (!product) return;

    let additionalStock = 0;
    if (editingItemId) {
      const editingItem = items.find((i) => i.id === editingItemId);
      if (editingItem && editingItem.productId === productId)
        additionalStock = editingItem.quantity + editingItem.freeQuantity;
    }

    setCurrentItem({
      productId: product.id, sku: product.sku,
      quantity: editingItemId ? currentItem.quantity : 1,
      freeQuantity: editingItemId ? currentItem.freeQuantity : 0,
      unit: product.unit_of_measure, mrp: product.mrp,
      unitPrice: product.selling_price, discountPercent: 0,
      stockAvailable: product.stock_quantity + additionalStock,
    });

    setProductOpen(false);
    if (!editingItemId) setTimeout(() => { qtyInputRef.current?.focus(); }, 100);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") { e.preventDefault(); handleAddOrUpdateItem(); }
  };

  const handleAddOrUpdateItem = () => {
    if (isReadOnly) return;
    if (!currentItem.productId) { toast.error("Please select a product"); return; }

    const totalReqQty = currentItem.quantity + currentItem.freeQuantity;
    if (!editingItemId && totalReqQty > currentItem.stockAvailable) {
      toast.error(`Insufficient stock! Available: ${currentItem.stockAvailable}`);
      return;
    }

    const product = products.find((p) => p.id === currentItem.productId);
    const discountAmount = (currentItem.unitPrice * currentItem.quantity * currentItem.discountPercent) / 100;
    const netTotal = currentItem.unitPrice * currentItem.quantity - discountAmount;

    const newItem: InvoiceItem = {
      id: editingItemId || Date.now().toString(),
      productId: currentItem.productId,
      sku: product?.sku || currentItem.sku,
      productName: product?.name || "",
      unit: product?.unit_of_measure || currentItem.unit,
      quantity: currentItem.quantity, freeQuantity: currentItem.freeQuantity,
      mrp: currentItem.mrp, unitPrice: currentItem.unitPrice,
      discountPercent: currentItem.discountPercent, discountAmount, total: netTotal,
    };

    if (editingItemId) {
      setItems(items.map((i) => (i.id === editingItemId ? newItem : i)));
      setEditingItemId(null);
    } else {
      setItems([...items, newItem]);
    }

    setCurrentItem({ productId: "", sku: "", quantity: 1, freeQuantity: 0, unit: "", mrp: 0, unitPrice: 0, discountPercent: 0, stockAvailable: 0 });
  };

  const handleEditItem = (item: InvoiceItem) => {
    if (isReadOnly) return;
    setEditingItemId(item.id);
    const product = products.find((p) => p.id === item.productId);
    setCurrentItem({
      productId: item.productId, sku: item.sku, quantity: item.quantity, freeQuantity: item.freeQuantity,
      unit: item.unit, mrp: item.mrp, unitPrice: item.unitPrice, discountPercent: item.discountPercent,
      stockAvailable: (product?.stock_quantity || 0) + item.quantity + item.freeQuantity,
    });
  };

  const handleCancelEdit = () => {
    setEditingItemId(null);
    setCurrentItem({ productId: "", sku: "", quantity: 1, freeQuantity: 0, unit: "", mrp: 0, unitPrice: 0, discountPercent: 0, stockAvailable: 0 });
  };

  const handleRemoveItem = (itemId: string) => {
    if (isReadOnly) return;
    setItems(items.filter((item) => item.id !== itemId));
  };

  const handleUpdateInvoice = async () => {
    if (isReadOnly) { toast.error("This invoice is locked and cannot be edited."); return; }
    if (!customerId) { toast.error("Please select a customer."); return; }
    if (items.length === 0) { toast.error("Please add items to the invoice."); return; }

    setSaving(true);
    const userId = currentUser?.id || (() => {
      if (typeof window !== "undefined") {
        const str = localStorage.getItem("currentUser");
        return str ? JSON.parse(str).id : "";
      }
      return "";
    })();

    try {
      const res = await fetch(`/api/invoices/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId, salesRepId, invoiceDate, orderStatus, items, grandTotal,
          extraDiscountPercent: extraDiscount, extraDiscountAmount,
          userId, changeReason: editReason || "Updated Invoice",
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update invoice");
      }
      toast.success("Invoice Updated Successfully!");
      invalidatePaymentCaches();
      router.push("/dashboard/office/orange/invoices");
    } catch (error: any) {
      toast.error(error.message || "Failed to update invoice");
    } finally {
      setSaving(false);
    }
  };

  const subtotal = items.reduce((sum, item) => sum + item.total, 0);
  const totalItemDiscount = items.reduce((sum, item) => sum + item.discountAmount, 0);
  const grossTotal = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const refundTotal = returns.reduce((acc, r) => acc + r.quantity * (r.products?.selling_price || 0), 0);
  const extraDiscountAmount = (subtotal * extraDiscount) / 100;
  const grandTotal = subtotal - extraDiscountAmount - refundTotal;

  const availableProducts = editingItemId ? products : products.filter((p) => !items.some((i) => i.productId === p.id));
  const currentDiscountAmt = (currentItem.unitPrice * currentItem.quantity * currentItem.discountPercent) / 100;

  if (loading) {
    return (
      <div className="flex justify-center items-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-orange-600" />
      </div>
    );
  }

  return (
    <div className="space-y-4 mx-auto">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push("/dashboard/office/orange/invoices")}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight">Edit Customer Bill</h1>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-muted-foreground text-sm font-mono">{invoiceNumber}</p>
            <Badge variant={isReadOnly ? "destructive" : "secondary"}>{orderStatus}</Badge>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" onClick={fetchHistory}>
                <History className="w-4 h-4 mr-2" /> History
              </Button>
            </SheetTrigger>
            <SheetContent>
              <SheetHeader><SheetTitle>Edit History</SheetTitle></SheetHeader>
              <div className="mt-6 space-y-4">
                {historyLoading ? (
                  <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-orange-600" /></div>
                ) : historyLogs.length === 0 ? (
                  <p className="text-center text-muted-foreground text-sm">No edit history found.</p>
                ) : (
                  historyLogs.map((log) => (
                    <div key={log.id} className="flex gap-3 items-start">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-orange-500 text-white shrink-0 mt-1">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div className="flex-1 p-3 rounded border border-slate-200 bg-slate-50">
                        <div className="flex justify-between items-center mb-1">
                          <span className="font-bold text-sm">{log.changedBy}</span>
                          <time className="text-xs text-muted-foreground">{new Date(log.changedAt).toLocaleString()}</time>
                        </div>
                        <p className="text-xs text-muted-foreground">Reason: {log.reason}</p>
                        <p className="text-xs font-mono mt-1">Prev Total: LKR {log.previousTotal.toLocaleString()}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </SheetContent>
          </Sheet>
          <Button onClick={handleUpdateInvoice} disabled={items.length === 0 || saving || isReadOnly} className="bg-orange-600 hover:bg-orange-700">
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Update Bill
          </Button>
        </div>
      </div>

      {isReadOnly && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-md flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
          <div>
            <p className="font-bold text-sm">View Only Mode</p>
            <p className="text-xs">This invoice has a locked status and cannot be edited.</p>
          </div>
        </div>
      )}

      {!isReadOnly && (
        <div className="bg-yellow-50 border border-yellow-200 p-3 rounded-md flex items-center gap-4">
          <Label className="text-yellow-800 whitespace-nowrap text-sm">Change Reason:</Label>
          <Input
            placeholder="Why are you editing this invoice? (Optional)"
            value={editReason}
            onChange={(e) => setEditReason(e.target.value)}
            className="bg-white border-yellow-300 h-8 text-sm"
          />
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          {/* 1. Details */}
          <Card>
            <CardHeader><CardTitle>Details</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Customer</Label>
                  <Popover open={!isReadOnly && customerOpen} onOpenChange={setCustomerOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" role="combobox" aria-expanded={customerOpen} className="w-full justify-between" disabled={isReadOnly}>
                        {customerId ? customers.find((c) => c.id === customerId)?.name : "Select Customer"}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Search customer..." />
                        <CommandList>
                          <CommandEmpty>No customer found.</CommandEmpty>
                          <CommandGroup>
                            {customers.map((customer) => (
                              <CommandItem key={customer.id} value={customer.name} onSelect={() => { setCustomerId(customer.id); setCustomerOpen(false); }}>
                                <Check className={cn("mr-2 h-4 w-4", customerId === customer.id ? "opacity-100" : "opacity-0")} />
                                {customer.name}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-2">
                  <Label>Date</Label>
                  <Input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} disabled={isReadOnly} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Sales Rep (Current User)</Label>
                  <Input value={currentUser?.name || ""} disabled className="bg-muted" />
                </div>
                <div className="space-y-2">
                  <Label>Invoice Number</Label>
                  <Input value={invoiceNumber} disabled className="bg-muted font-mono text-sm" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 2. Add / Edit Items */}
          <Card className={editingItemId ? "border-orange-500 border-2" : ""}>
            <CardHeader>
              <CardTitle>{editingItemId ? "Edit Item" : "Add Products"}</CardTitle>
              <CardDescription>
                {editingItemId ? "Update item details, then click Update Item" : "Showing stock for your assigned location"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-4 gap-4">
                <div className="col-span-4 space-y-2">
                  <Label>Product {stockLoading && <Loader2 className="inline h-3 w-3 animate-spin ml-2" />}</Label>
                  <Popover open={!isReadOnly && productOpen} onOpenChange={setProductOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" role="combobox" className="w-full justify-between" disabled={stockLoading || isReadOnly || !!editingItemId}>
                        {currentItem.productId
                          ? products.find((p) => p.id === currentItem.productId)?.name
                          : stockLoading ? "Loading stock..." : "Select Product"}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Search product..." />
                        <CommandList>
                          <CommandEmpty>No products found in stock.</CommandEmpty>
                          <CommandGroup>
                            {availableProducts.map((product) => (
                              <CommandItem key={product.id} value={product.name} onSelect={() => { handleProductSelect(product.id); setProductOpen(false); }}>
                                <Check className={cn("mr-2 h-4 w-4", currentItem.productId === product.id ? "opacity-100" : "opacity-0")} />
                                <div className="flex-1">
                                  <div className="font-medium">{product.name}</div>
                                  <div className="text-xs text-muted-foreground">
                                    {product.sku} • Stock: {product.stock_quantity} • LKR {product.selling_price}
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
              </div>

              <div className="grid grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label>Quantity</Label>
                  <Input ref={qtyInputRef} type="number" min="1" value={currentItem.quantity} onChange={(e) => setCurrentItem({ ...currentItem, quantity: Number(e.target.value) })} onKeyDown={handleKeyDown} disabled={!currentItem.productId || isReadOnly} />
                </div>
                <div className="space-y-2">
                  <Label>Free Qty</Label>
                  <Input type="number" min="0" value={currentItem.freeQuantity} onChange={(e) => setCurrentItem({ ...currentItem, freeQuantity: Number(e.target.value) })} onKeyDown={handleKeyDown} disabled={!currentItem.productId || isReadOnly} />
                </div>
                <div className="space-y-2">
                  <Label>Unit</Label>
                  <Input value={currentItem.unit || "-"} disabled className="bg-muted" />
                </div>
                <div className="space-y-2">
                  <Label>Stock</Label>
                  <Input value={currentItem.stockAvailable || "-"} disabled className={currentItem.stockAvailable > 0 && currentItem.stockAvailable < 10 ? "text-destructive font-bold bg-muted" : "bg-muted"} />
                </div>
              </div>

              <div className="grid grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label>MRP</Label>
                  <Input type="number" value={currentItem.mrp || ""} onChange={(e) => setCurrentItem({ ...currentItem, mrp: Number(e.target.value) })} onKeyDown={handleKeyDown} placeholder="0.00" disabled={!currentItem.productId || isReadOnly} />
                </div>
                <div className="space-y-2">
                  <Label>Unit Price</Label>
                  <Input type="number" value={currentItem.unitPrice || ""} onChange={(e) => setCurrentItem({ ...currentItem, unitPrice: Number(e.target.value) })} onKeyDown={handleKeyDown} placeholder="0.00" disabled={!currentItem.productId || isReadOnly} />
                </div>
                <div className="space-y-2">
                  <Label>Discount %</Label>
                  <Input type="number" min="0" max="100" value={currentItem.discountPercent || ""} onChange={(e) => setCurrentItem({ ...currentItem, discountPercent: Number(e.target.value) })} onKeyDown={handleKeyDown} placeholder="0" disabled={!currentItem.productId || isReadOnly} />
                </div>
                <div className="space-y-2">
                  <Label>Total</Label>
                  <Input value={(currentItem.unitPrice * currentItem.quantity - currentDiscountAmt).toFixed(2)} disabled className="font-bold bg-muted" />
                </div>
              </div>

              {!isReadOnly && (
                <div className="flex gap-2">
                  {editingItemId && (
                    <Button variant="outline" onClick={handleCancelEdit}><X className="w-4 h-4 mr-2" /> Cancel</Button>
                  )}
                  <Button onClick={handleAddOrUpdateItem} className="flex-1 bg-orange-600 hover:bg-orange-700" disabled={!currentItem.productId}>
                    {editingItemId ? <><Save className="w-4 h-4 mr-2" /> Update Item</> : <><Plus className="w-4 h-4 mr-2" /> Add to Bill</>}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 3. Items Table */}
          <Card>
            <CardHeader>
              <CardTitle>Items</CardTitle>
              <CardDescription>{items.length} item(s) added</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead className="text-center w-20">Qty</TableHead>
                      <TableHead className="text-center w-20">Free</TableHead>
                      <TableHead className="text-right w-24">Unit Price</TableHead>
                      <TableHead className="text-center w-20">Disc%</TableHead>
                      <TableHead className="text-right w-28">Total</TableHead>
                      <TableHead className="w-16"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                          <Package className="w-8 h-8 mx-auto mb-2 opacity-50" />
                          No items added yet
                        </TableCell>
                      </TableRow>
                    ) : (
                      items.map((item, idx) => (
                        <TableRow key={item.id} className={editingItemId === item.id ? "bg-orange-50" : ""}>
                          <TableCell>{idx + 1}</TableCell>
                          <TableCell>
                            <div className="font-medium">{item.productName}</div>
                            <div className="text-xs text-muted-foreground">{item.sku}</div>
                          </TableCell>
                          <TableCell className="text-center">{item.quantity} {item.unit}</TableCell>
                          <TableCell className="text-center">{item.freeQuantity || "-"}</TableCell>
                          <TableCell className="text-right">{item.unitPrice.toLocaleString()}</TableCell>
                          <TableCell className="text-center">{item.discountPercent > 0 ? `${item.discountPercent}%` : "-"}</TableCell>
                          <TableCell className="text-right font-bold">{item.total.toLocaleString()}</TableCell>
                          <TableCell>
                            <div className="flex gap-1 justify-end">
                              {!isReadOnly && (
                                <Button variant="ghost" size="icon" onClick={() => handleEditItem(item)} disabled={editingItemId !== null}>
                                  <Edit className="w-4 h-4 text-blue-500" />
                                </Button>
                              )}
                              {!isReadOnly && (
                                <Button variant="ghost" size="icon" onClick={() => handleRemoveItem(item.id)} disabled={editingItemId !== null}>
                                  <Trash2 className="w-4 h-4 text-destructive" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* RIGHT — Summary */}
        <div className="lg:col-span-1">
          <Card className="sticky top-6">
            <CardHeader><CardTitle>Summary</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Customer:</span>
                  <span className="font-medium">{customers.find((c) => c.id === customerId)?.name || "-"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Bill By:</span>
                  <span className="font-medium">{currentUser?.name || "-"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Date:</span>
                  <span className="font-medium">{invoiceDate}</span>
                </div>
              </div>
              <div className="border-t pt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Items:</span>
                  <span>{items.length}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Gross Total:</span>
                  <span>LKR {grossTotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Item Discounts:</span>
                  <span className="text-destructive">- LKR {totalItemDiscount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm font-medium">
                  <span>Subtotal:</span>
                  <span>LKR {subtotal.toLocaleString()}</span>
                </div>
              </div>
              {refundTotal > 0 && (
                <div className="border-t pt-2 flex justify-between text-sm text-orange-600">
                  <span className="flex items-center gap-1"><Undo2 className="w-3 h-3" /> Less Returns:</span>
                  <span>- LKR {refundTotal.toFixed(2)}</span>
                </div>
              )}
              <div className="border-t pt-4 space-y-3">
                <div className="space-y-2">
                  <Label className="text-xs">Extra Discount %</Label>
                  <Input type="number" min="0" max="100" value={extraDiscount} onChange={(e) => setExtraDiscount(Number(e.target.value))} disabled={isReadOnly} />
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Extra Discount:</span>
                  <span className="text-destructive">- LKR {extraDiscountAmount.toLocaleString()}</span>
                </div>
              </div>
              <div className="border-t pt-4">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-bold">Grand Total:</span>
                  <span className="text-2xl font-bold text-orange-700">LKR {grandTotal.toLocaleString()}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
