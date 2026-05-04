"use client";

import { useState, useEffect, use, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
  Edit,
  X,
  TruckIcon,
  History,
  FileText,
  AlertTriangle,
  Undo2,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

// --- Types ---
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
  originalPrice: number;
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

export default function DistributionEditInvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const distributionBusinessId = BUSINESS_IDS.CHAMPIKA_DISTRIBUTION;

  const returnTo = searchParams.get("returnTo");
  const isFromReconciliation = !!returnTo;

  const [loading, setLoading] = useState(true);
  const [stockLoading, setStockLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);

  // Data State
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<{ id: string; name: string }[]>([]);
  const [reps, setReps] = useState<{ id: string; name: string }[]>([]);
  const [historyLogs, setHistoryLogs] = useState<InvoiceHistory[]>([]);
  const [returns, setReturns] = useState<ReturnRecord[]>([]);

  // Form State
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [invoiceDate, setInvoiceDate] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [salesRepId, setSalesRepId] = useState<string>("");
  const [orderStatus, setOrderStatus] = useState<string>("Pending");
  const [editReason, setEditReason] = useState("");

  // Items State
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [extraDiscount, setExtraDiscount] = useState<string>("");
  const [editingItemId, setEditingItemId] = useState<string | null>(null);

  // Popover States
  const [customerOpen, setCustomerOpen] = useState(false);
  const [salesRepOpen, setSalesRepOpen] = useState(false);
  const [productOpen, setProductOpen] = useState(false);

  // Current Item Being Added/Edited
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

  // Read-only logic
  const lockedStatuses = ["Loading", "In Transit", "Delivered", "Completed", "Cancelled"];
  const isStatusLocked = lockedStatuses.includes(orderStatus);
  const isAdmin = currentUserRole === "admin";
  const isReadOnly = isStatusLocked && !isFromReconciliation && !isAdmin;

  const handleBack = () => {
    if (returnTo) {
      router.push(returnTo);
    } else {
      router.push("/dashboard/office/distribution/invoices");
    }
  };

  // --- 1. Fetch Invoice & Reference Data ---
  useEffect(() => {
    const fetchInitialData = async () => {
      setLoading(true);
      try {
        const user = getUserBusinessContext();
        if (user) setCurrentUserRole(user.role);

        const [custRes, usersRes, invRes, retRes] = await Promise.all([
          fetch(`/api/customers?businessId=${distributionBusinessId}`),
          fetch("/api/users"),
          fetch(`/api/invoices/${id}`),
          fetch(`/api/invoices/${id}/returns`),
        ]);

        const custData = await custRes.json();
        setCustomers(custData.map((c: any) => ({ id: c.id, name: c.shopName })));

        const usersData = await usersRes.json();
        setReps(
          usersData
            .filter((u: any) => u.role === "rep")
            .map((u: any) => ({ id: u.id, name: u.fullName }))
        );

        const retData = await retRes.json();
        setReturns(retData);

        const invoice = await invRes.json();
        setCustomerId(invoice.customerId);
        setSalesRepId(invoice.salesRepId);
        setInvoiceDate(invoice.date);
        setInvoiceNumber(invoice.invoiceNo);
        setOrderStatus(invoice.orderStatus || "Pending");

        const mappedItems: InvoiceItem[] = invoice.items.map((item: any) => ({
          id: item.id || Math.random().toString(),
          productId: item.productId || item.product_id,
          sku: item.sku,
          productName: item.productName || item.name,
          unit: item.unit,
          quantity: item.quantity,
          freeQuantity: item.freeQuantity,
          mrp: item.mrp,
          unitPrice: item.unitPrice,
          originalPrice: item.unitPrice,
          discountPercent: item.discountPercent || 0,
          discountAmount: item.discountAmount || 0,
          total: item.total,
        }));
        setItems(mappedItems);

        const extraDiscPercent = invoice.extraDiscountPercent || 0;
        setExtraDiscount(extraDiscPercent > 0 ? String(extraDiscPercent) : "");
      } catch (error) {
        console.error(error);
        toast.error("Failed to load invoice data");
        handleBack();
      } finally {
        setLoading(false);
      }
    };

    fetchInitialData();
  }, [id]);

  // --- 2. Fetch Rep Stock When Rep Changes ---
  useEffect(() => {
    const fetchRepStock = async () => {
      if (!salesRepId) {
        setProducts([]);
        return;
      }

      setStockLoading(true);
      try {
        const res = await fetch(
          `/api/rep/stock?userId=${salesRepId}&businessId=${distributionBusinessId}`
        );
        if (!res.ok) throw new Error("Failed to load stock");

        const productsData = await res.json();
        setProducts(
          productsData.map((p: any) => ({
            id: p.id,
            sku: p.sku || "N/A",
            name: p.name,
            selling_price: p.sellingPrice || p.selling_price || 0,
            mrp: p.mrp || 0,
            stock_quantity: p.stock || p.stock_quantity || 0,
            unit_of_measure: p.unit || p.unit_of_measure || "unit",
          }))
        );
      } catch (error) {
        console.error("Error fetching stock:", error);
        toast.error("Failed to load products for this representative");
        setProducts([]);
      } finally {
        setStockLoading(false);
      }
    };

    fetchRepStock();
  }, [salesRepId, distributionBusinessId]);

  // --- Product Selection ---
  const handleProductSelect = (productId: string) => {
    if (isReadOnly) return;
    const product = products.find((p) => p.id === productId);
    if (!product) return;

    // When editing, add back the current item's qty to available stock
    let bonusStock = 0;
    if (editingItemId) {
      const editingItem = items.find((i) => i.id === editingItemId);
      if (editingItem && editingItem.productId === productId) {
        bonusStock = editingItem.quantity + editingItem.freeQuantity;
      }
    }

    setCurrentItem({
      productId: product.id,
      sku: product.sku,
      quantity: "",
      freeQuantity: "",
      unit: product.unit_of_measure,
      mrp: product.mrp,
      unitPrice: product.selling_price,
      discountPercent: "",
      stockAvailable: product.stock_quantity + bonusStock,
    });

    setProductOpen(false);
    setTimeout(() => qtyInputRef.current?.focus(), 100);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddOrUpdateItem();
    }
  };

  // --- Add / Update Item ---
  const handleAddOrUpdateItem = () => {
    if (isReadOnly) return;

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
    if (qty + free > currentItem.stockAvailable) {
      toast.error(`Insufficient stock! Available: ${currentItem.stockAvailable}`);
      return;
    }

    const product = products.find((p) => p.id === currentItem.productId);
    const grossTotal = currentItem.unitPrice * qty;
    const discountAmount = (grossTotal * discPerc) / 100;
    const total = grossTotal - discountAmount;

    const newItem: InvoiceItem = {
      id: editingItemId || Date.now().toString(),
      productId: currentItem.productId,
      sku: currentItem.sku,
      productName: product?.name || currentItem.sku,
      unit: currentItem.unit,
      quantity: qty,
      freeQuantity: free,
      mrp: currentItem.mrp,
      unitPrice: currentItem.unitPrice,
      originalPrice: product?.selling_price || currentItem.unitPrice,
      discountPercent: discPerc,
      discountAmount,
      total,
    };

    if (editingItemId) {
      setItems(items.map((i) => (i.id === editingItemId ? newItem : i)));
      setEditingItemId(null);
    } else {
      setItems([...items, newItem]);
    }

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

  const handleEditItem = (item: InvoiceItem) => {
    if (isReadOnly) return;
    setEditingItemId(item.id);
    const product = products.find((p) => p.id === item.productId);
    const currentDbStock = product ? product.stock_quantity : 0;

    setCurrentItem({
      productId: item.productId,
      sku: item.sku,
      quantity: String(item.quantity),
      freeQuantity: String(item.freeQuantity),
      unit: item.unit,
      mrp: item.mrp,
      unitPrice: item.unitPrice,
      discountPercent: String(item.discountPercent),
      stockAvailable: currentDbStock + item.quantity + item.freeQuantity,
    });
  };

  const handleCancelEdit = () => {
    setEditingItemId(null);
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

  const handleRemoveItem = (itemId: string) => {
    if (isReadOnly) return;
    setItems(items.filter((i) => i.id !== itemId));
  };

  // --- History ---
  const fetchHistory = async () => {
    setHistoryLoading(true);
    try {
      const res = await fetch(`/api/invoices/${id}/history`);
      if (res.ok) setHistoryLogs(await res.json());
    } catch {
      console.error("Failed to fetch history");
    } finally {
      setHistoryLoading(false);
    }
  };

  // --- Calculations ---
  const subtotal = items.reduce((sum, item) => sum + item.total, 0);
  const totalItemDiscount = items.reduce((sum, item) => sum + item.discountAmount, 0);
  const grossTotal = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const refundTotal = returns.reduce(
    (acc, r) => acc + r.quantity * (r.products?.selling_price || 0),
    0
  );
  const extraDiscPercVal = parseFloat(extraDiscount) || 0;
  const extraDiscountAmount = (subtotal * extraDiscPercVal) / 100;
  const grandTotal = Math.max(0, subtotal - extraDiscountAmount - refundTotal);

  // Current item preview totals
  const qtyNum = parseFloat(currentItem.quantity) || 0;
  const discPercNum = parseFloat(currentItem.discountPercent) || 0;
  const currentDiscountAmt = (currentItem.unitPrice * qtyNum * discPercNum) / 100;
  const currentTotal = currentItem.unitPrice * qtyNum - currentDiscountAmt;

  // --- Save ---
  const handleUpdateInvoice = async (asDraft = false) => {
    if (isReadOnly) {
      toast.error("This invoice is locked and cannot be edited.");
      return;
    }
    if (!customerId || !salesRepId || items.length === 0) {
      toast.error("Please fill all required fields");
      return;
    }

    setSaving(true);

    let userId = "";
    if (typeof window !== "undefined") {
      const userStr = localStorage.getItem("currentUser");
      if (userStr) userId = JSON.parse(userStr).id;
    }

    const updateData = {
      customerId,
      salesRepId,
      invoiceDate,
      orderStatus: asDraft ? "Pending" : orderStatus,
      items,
      grandTotal,
      extraDiscountPercent: extraDiscPercVal,
      extraDiscountAmount,
      isDraft: asDraft,
      userId,
      changeReason: editReason || (asDraft ? "Saved as Draft" : "Updated Invoice"),
    };

    try {
      const res = await fetch(`/api/invoices/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updateData),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to update invoice");
      }

      invalidatePaymentCaches();
      toast.success(asDraft ? "Draft Saved!" : "Invoice Updated!");
      if (!asDraft) handleBack();
    } catch (error: any) {
      toast.error(error.message || "Update failed");
    } finally {
      setSaving(false);
    }
  };

  const availableProducts = products.filter(
    (p) => !items.some((i) => i.productId === p.id && i.id !== editingItemId)
  );

  if (loading) {
    return (
      <div className="flex justify-center items-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4 mx-auto pb-20">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={handleBack}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-blue-900">
              Edit Distribution Invoice
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-muted-foreground font-mono">{invoiceNumber}</p>
              {isFromReconciliation && (
                <Badge variant="outline" className="bg-blue-50 text-blue-700">
                  <TruckIcon className="w-3 h-3 mr-1" /> From Reconciliation
                </Badge>
              )}
              <Badge variant={orderStatus === "Pending" ? "secondary" : "default"}>
                {orderStatus}
              </Badge>
            </div>
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
              <SheetHeader>
                <SheetTitle>Edit History</SheetTitle>
              </SheetHeader>
              <div className="mt-6 space-y-6">
                {historyLoading ? (
                  <div className="flex justify-center items-center py-16">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : historyLogs.length === 0 ? (
                  <p className="text-center text-muted-foreground">No edit history found.</p>
                ) : (
                  <div className="space-y-4 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-linear-to-b before:from-transparent before:via-slate-300 before:to-transparent">
                    {historyLogs.map((log) => (
                      <div
                        key={log.id}
                        className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active"
                      >
                        <div className="flex items-center justify-center w-10 h-10 rounded-full border border-white bg-slate-300 group-[.is-active]:bg-blue-500 text-slate-500 group-[.is-active]:text-emerald-50 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2">
                          <FileText className="w-5 h-5" />
                        </div>
                        <div className="w-full p-4 rounded border border-slate-200 bg-slate-50 shadow-sm">
                          <div className="flex justify-between items-center mb-1">
                            <span className="font-bold text-slate-900 text-sm">{log.changedBy}</span>
                            <time className="font-caveat font-medium text-xs text-indigo-500">
                              {new Date(log.changedAt).toLocaleString()}
                            </time>
                          </div>
                          <p className="text-slate-500 text-xs">Reason: {log.reason}</p>
                          <div className="mt-2 text-xs font-mono bg-white p-1 rounded border">
                            Prev Total: LKR {log.previousTotal.toLocaleString()}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </SheetContent>
          </Sheet>

          {!isReadOnly && (
            <>
              <Button
                variant="secondary"
                onClick={() => handleUpdateInvoice(true)}
                disabled={saving}
              >
                Save as Draft
              </Button>
              <Button
                onClick={() => handleUpdateInvoice(false)}
                disabled={items.length === 0 || saving}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                Update Invoice
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Read Only Warning */}
      {isReadOnly && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-md flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600" />
          <div>
            <p className="font-bold text-sm">View Only Mode</p>
            <p className="text-xs">
              This invoice is locked. To edit, use the reconciliation page.
            </p>
          </div>
        </div>
      )}

      {/* Change Reason */}
      {!isReadOnly && (
        <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-md flex items-center gap-4">
          <Label className="text-yellow-800 whitespace-nowrap">Change Reason:</Label>
          <Input
            placeholder="Why are you editing this invoice? (Optional)"
            value={editReason}
            onChange={(e) => setEditReason(e.target.value)}
            className="bg-white border-yellow-300"
          />
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* LEFT COLUMN */}
        <div className="lg:col-span-2 space-y-6">
          {/* 1. Invoice Details */}
          <Card>
            <CardHeader>
              <CardTitle>Invoice Details</CardTitle>
              <CardDescription>Customer and billing information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Customer</Label>
                  <Popover open={!isReadOnly && customerOpen} onOpenChange={setCustomerOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={customerOpen}
                        className="w-full justify-between"
                        disabled={isReadOnly}
                      >
                        {customerId
                          ? customers.find((c) => c.id === customerId)?.name
                          : "Select Customer"}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      className="w-(--radix-popover-trigger-width) p-0"
                      align="start"
                    >
                      <Command>
                        <CommandInput placeholder="Search customer..." />
                        <CommandList>
                          <CommandEmpty>No customer found.</CommandEmpty>
                          <CommandGroup>
                            {customers.map((customer) => (
                              <CommandItem
                                key={customer.id}
                                value={customer.name}
                                onSelect={() => {
                                  setCustomerId(customer.id);
                                  setCustomerOpen(false);
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    customerId === customer.id ? "opacity-100" : "opacity-0"
                                  )}
                                />
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
                  <Label>Invoice Date</Label>
                  <Input
                    type="date"
                    value={invoiceDate}
                    onChange={(e) => setInvoiceDate(e.target.value)}
                    disabled={isReadOnly}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Invoice No</Label>
                  <Input value={invoiceNumber} disabled className="bg-muted" />
                </div>
                <div className="space-y-2">
                  <Label>
                    Sales Representative <span className="text-red-500">*</span>
                  </Label>
                  <Popover open={!isReadOnly && salesRepOpen} onOpenChange={setSalesRepOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={salesRepOpen}
                        className="w-full justify-between"
                        disabled={isReadOnly}
                      >
                        {salesRepId
                          ? reps.find((r) => r.id === salesRepId)?.name
                          : "Select Representative"}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      className="w-(--radix-popover-trigger-width) p-0"
                      align="start"
                    >
                      <Command>
                        <CommandInput placeholder="Search representative..." />
                        <CommandList>
                          <CommandEmpty>No representative found.</CommandEmpty>
                          <CommandGroup>
                            {reps.map((rep) => (
                              <CommandItem
                                key={rep.id}
                                value={rep.name}
                                onSelect={() => {
                                  if (items.length > 0 && rep.id !== salesRepId) {
                                    if (
                                      !confirm(
                                        "Changing rep will reload stock. Continue?"
                                      )
                                    ) {
                                      setSalesRepOpen(false);
                                      return;
                                    }
                                  }
                                  setSalesRepId(rep.id);
                                  setSalesRepOpen(false);
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    salesRepId === rep.id ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                {rep.name}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Order Status</Label>
                <Select
                  value={orderStatus}
                  onValueChange={setOrderStatus}
                  disabled={isReadOnly}
                >
                  <SelectTrigger className="w-1/2">
                    <SelectValue placeholder="Select Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Pending">Pending</SelectItem>
                    <SelectItem value="Processing">Processing</SelectItem>
                    <SelectItem value="Checking">Checking</SelectItem>
                    <SelectItem value="Loading">Loading</SelectItem>
                    <SelectItem value="Delivered">Delivered</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* 2. Add / Edit Products */}
          <Card className={editingItemId ? "border-blue-500 border-2" : ""}>
            <CardHeader>
              <CardTitle>{editingItemId ? "Edit Item" : "Add Products"}</CardTitle>
              <CardDescription>
                {editingItemId
                  ? "Update the item details below"
                  : "Search and add products to the invoice"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Product Selector */}
              <div className="grid grid-cols-4 gap-4">
                <div className="col-span-4 space-y-2">
                  <Label>
                    Product{" "}
                    {stockLoading && (
                      <Loader2 className="inline h-3 w-3 animate-spin ml-2" />
                    )}
                  </Label>
                  <Popover open={!isReadOnly && productOpen} onOpenChange={setProductOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={productOpen}
                        className="w-full justify-between"
                        disabled={!salesRepId || stockLoading || isReadOnly || !!editingItemId}
                      >
                        {currentItem.productId
                          ? products.find((p) => p.id === currentItem.productId)?.name
                          : salesRepId
                          ? stockLoading
                            ? "Loading stock..."
                            : "Select Product"
                          : "Select Representative First"}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      className="w-(--radix-popover-trigger-width) p-0"
                      align="start"
                    >
                      <Command>
                        <CommandInput placeholder="Search product..." />
                        <CommandList>
                          <CommandEmpty>
                            {salesRepId
                              ? "No products found in this rep's stock."
                              : "Please select a representative."}
                          </CommandEmpty>
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
                                    {product.sku} • Stock: {product.stock_quantity} • LKR{" "}
                                    {product.selling_price}
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
                    disabled={!currentItem.productId || isReadOnly}
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
                      setCurrentItem({ ...currentItem, freeQuantity: e.target.value })
                    }
                    onKeyDown={handleKeyDown}
                    disabled={!currentItem.productId || isReadOnly}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Unit</Label>
                  <Input value={currentItem.unit || "-"} disabled className="bg-muted" />
                </div>
                <div className="space-y-2">
                  <Label>Stock</Label>
                  <Input
                    value={currentItem.stockAvailable || "-"}
                    disabled
                    className={
                      currentItem.stockAvailable > 0 && currentItem.stockAvailable < 10
                        ? "text-destructive font-bold bg-muted"
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
                      setCurrentItem({ ...currentItem, mrp: Number(e.target.value) })
                    }
                    onKeyDown={handleKeyDown}
                    placeholder="0.00"
                    disabled={!currentItem.productId || isReadOnly}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Unit Price</Label>
                  <Input
                    type="number"
                    value={currentItem.unitPrice || ""}
                    onChange={(e) =>
                      setCurrentItem({ ...currentItem, unitPrice: Number(e.target.value) })
                    }
                    onKeyDown={handleKeyDown}
                    placeholder="0.00"
                    disabled={!currentItem.productId || isReadOnly}
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
                      setCurrentItem({ ...currentItem, discountPercent: e.target.value })
                    }
                    onKeyDown={handleKeyDown}
                    disabled={!currentItem.productId || isReadOnly}
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

              {/* Action Buttons */}
              {!isReadOnly && (
                <div className="flex gap-2">
                  {editingItemId && (
                    <Button variant="outline" onClick={handleCancelEdit}>
                      <X className="w-4 h-4 mr-2" /> Cancel Edit
                    </Button>
                  )}
                  <Button
                    onClick={handleAddOrUpdateItem}
                    className="flex-1 bg-blue-600 hover:bg-blue-700"
                    disabled={!currentItem.productId}
                  >
                    {editingItemId ? (
                      <>
                        <Save className="w-4 h-4 mr-2" /> Update Item
                      </>
                    ) : (
                      <>
                        <Plus className="w-4 h-4 mr-2" /> Add to Invoice
                      </>
                    )}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 3. Items Table */}
          <Card>
            <CardHeader>
              <CardTitle>Invoice Items</CardTitle>
              <CardDescription>{items.length} item(s)</CardDescription>
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
                      <TableHead className="w-24 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={8}
                          className="text-center text-muted-foreground py-8"
                        >
                          <Package className="w-8 h-8 mx-auto mb-2 opacity-50" />
                          No items added yet
                        </TableCell>
                      </TableRow>
                    ) : (
                      items.map((item, idx) => {
                        const priceChanged = item.unitPrice !== item.originalPrice;
                        const hasDiscount = item.discountPercent > 0;
                        const isModified = priceChanged || hasDiscount;
                        return (
                          <TableRow
                            key={item.id}
                            className={
                              editingItemId === item.id
                                ? "bg-blue-50"
                                : isModified
                                ? "bg-red-50 hover:bg-red-100"
                                : ""
                            }
                          >
                            <TableCell>{idx + 1}</TableCell>
                            <TableCell>
                              <div className="font-medium flex items-center gap-2">
                                {item.productName}
                                {isModified && (
                                  <span className="text-[10px] bg-red-100 text-red-600 border border-red-200 rounded px-1 py-0.5 font-semibold">
                                    Modified
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-muted-foreground">{item.sku}</div>
                            </TableCell>
                            <TableCell className="text-center">
                              {item.quantity} {item.unit}
                            </TableCell>
                            <TableCell className="text-center">
                              {item.freeQuantity || "-"}
                            </TableCell>
                            <TableCell className="text-right">
                              {priceChanged ? (
                                <div>
                                  <div className="font-semibold text-red-600">
                                    {item.unitPrice.toLocaleString()}
                                  </div>
                                  <div className="text-xs text-muted-foreground line-through">
                                    {item.originalPrice.toLocaleString()}
                                  </div>
                                </div>
                              ) : (
                                item.unitPrice.toLocaleString()
                              )}
                            </TableCell>
                            <TableCell className="text-center">
                              {hasDiscount ? (
                                <span className="font-semibold text-red-600">
                                  {item.discountPercent}%
                                </span>
                              ) : (
                                "-"
                              )}
                            </TableCell>
                            <TableCell className="text-right font-bold">
                              {item.total.toLocaleString()}
                            </TableCell>
                            <TableCell className="text-right">
                              {!isReadOnly && (
                                <div className="flex gap-1 justify-end">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleEditItem(item)}
                                    disabled={editingItemId !== null}
                                  >
                                    <Edit className="w-4 h-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleRemoveItem(item.id)}
                                    disabled={editingItemId !== null}
                                  >
                                    <Trash2 className="w-4 h-4 text-destructive" />
                                  </Button>
                                </div>
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
        </div>

        {/* RIGHT COLUMN */}
        <div className="lg:col-span-1">
          <Card className="sticky top-6">
            <CardHeader>
              <CardTitle>Invoice Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Customer:</span>
                  <span className="font-medium">
                    {customers.find((c) => c.id === customerId)?.name || "-"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Sales Rep:</span>
                  <span className="font-medium">
                    {reps.find((r) => r.id === salesRepId)?.name || "-"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Invoice Date:</span>
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
                  <span className="text-destructive">
                    - LKR {totalItemDiscount.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between text-sm font-medium">
                  <span>Subtotal:</span>
                  <span>LKR {subtotal.toLocaleString()}</span>
                </div>
              </div>

              {refundTotal > 0 && (
                <div className="border-t pt-2">
                  <div className="flex justify-between text-sm text-orange-600">
                    <span className="flex items-center gap-1">
                      <Undo2 className="w-3 h-3" /> Less Returns:
                    </span>
                    <span>- LKR {refundTotal.toFixed(2)}</span>
                  </div>
                </div>
              )}

              <div className="border-t pt-4 space-y-3">
                <div className="space-y-2">
                  <Label className="text-xs">Extra Discount %</Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    placeholder="0%"
                    value={extraDiscount}
                    onChange={(e) => setExtraDiscount(e.target.value)}
                    disabled={isReadOnly}
                  />
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Extra Discount:</span>
                  <span className="text-destructive">
                    - LKR {extraDiscountAmount.toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="border-t pt-4">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-bold">Grand Total:</span>
                  <span className="text-2xl font-bold text-blue-600">
                    LKR {grandTotal.toLocaleString()}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
