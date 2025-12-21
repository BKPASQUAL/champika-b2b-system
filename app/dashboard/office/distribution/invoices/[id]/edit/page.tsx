"use client";

import React, { useState, useEffect, use } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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

// --- Interfaces ---
interface InvoiceHistory {
  id: string;
  changedAt: string;
  changedBy: string;
  reason: string;
  previousTotal: number;
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

// Added ReturnRecord interface
interface ReturnRecord {
  id: string;
  quantity: number;
  products: {
    selling_price: number;
  };
}

export default function DistributionEditInvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();

  // ✅ Check for Return URL (Indicates Privileged Edit Mode from Reconciliation)
  const returnTo = searchParams.get("returnTo");
  const isFromReconciliation = !!returnTo;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Data State
  const [products, setProducts] = useState<any[]>([]);
  const [customers, setCustomers] = useState<{ id: string; name: string }[]>(
    []
  );
  const [reps, setReps] = useState<{ id: string; name: string }[]>([]);
  const [historyLogs, setHistoryLogs] = useState<InvoiceHistory[]>([]);
  const [returns, setReturns] = useState<ReturnRecord[]>([]);

  // Form State
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [invoiceDate, setInvoiceDate] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [salesRepId, setSalesRepId] = useState<string>("");
  const [orderStatus, setOrderStatus] = useState<string>("Delivered");
  const [editReason, setEditReason] = useState("");

  // Items State
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [extraDiscount, setExtraDiscount] = useState<number>(0);

  // Editing State
  const [editingItemId, setEditingItemId] = useState<string | null>(null);

  // UI States
  const [customerOpen, setCustomerOpen] = useState(false);
  const [salesRepOpen, setSalesRepOpen] = useState(false);
  const [productOpen, setProductOpen] = useState(false);

  // Current Item Being Added/Edited
  const [currentItem, setCurrentItem] = useState({
    productId: "",
    sku: "",
    quantity: 1,
    freeQuantity: 0,
    unit: "",
    mrp: 0,
    unitPrice: 0,
    discountPercent: 0,
    stockAvailable: 0,
  });

  // ✅ Determine Read-Only State
  const lockedStatuses = [
    "Loading",
    "In Transit",
    "Delivered",
    "Completed",
    "Cancelled",
  ];
  const isStatusLocked = lockedStatuses.includes(orderStatus);

  // Allows editing if status is NOT locked OR if we are coming from reconciliation
  const isReadOnly = isStatusLocked && !isFromReconciliation;

  const handleBack = () => {
    if (returnTo) {
      router.push(returnTo);
    } else {
      // Updated route to Office Distribution Invoices
      router.push("/dashboard/office/distribution/invoices");
    }
  };

  // --- Fetch Data ---
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [prodRes, custRes, usersRes, invRes, retRes] = await Promise.all([
          fetch("/api/products"),
          fetch("/api/customers"),
          fetch("/api/users"),
          fetch(`/api/invoices/${id}`),
          fetch(`/api/invoices/${id}/returns`),
        ]);

        const prodData = await prodRes.json();
        setProducts(
          prodData.map((p: any) => ({
            ...p,
            selling_price: p.sellingPrice,
            stock_quantity: p.stock || 0,
            unit_of_measure: p.unitOfMeasure || "unit",
          }))
        );

        const custData = await custRes.json();
        setCustomers(
          custData.map((c: any) => ({ id: c.id, name: c.shopName }))
        );

        const usersData = await usersRes.json();
        setReps(
          usersData
            .filter((u: any) => u.role === "rep")
            .map((u: any) => ({ id: u.id, name: u.fullName }))
        );

        const retData = await retRes.json();
        setReturns(retData);

        // Calculate total refunded value
        const currentRefunds = retData.reduce(
          (acc: number, r: any) =>
            acc + r.quantity * (r.products?.selling_price || 0),
          0
        );

        const invoice = await invRes.json();
        setCustomerId(invoice.customerId);
        setSalesRepId(invoice.salesRepId);
        setInvoiceDate(invoice.date);
        setInvoiceNumber(invoice.invoiceNo);
        setOrderStatus(invoice.orderStatus || "Delivered");

        const mappedItems = invoice.items.map((item: any) => ({
          id: item.id || Math.random().toString(),
          productId: item.productId || item.product_id,
          sku: item.sku,
          productName: item.productName || item.name,
          unit: item.unit,
          quantity: item.quantity,
          freeQuantity: item.freeQuantity,
          mrp: item.mrp,
          unitPrice: item.unitPrice,
          discountPercent: item.discountPercent || 0,
          discountAmount: 0,
          total: item.total,
        }));
        setItems(mappedItems);

        const itemsTotal = mappedItems.reduce(
          (sum: number, i: any) => sum + i.total,
          0
        );

        // ✅ Correctly calculate initial discount by subtracting Refunds first
        const expectedTotalFromItems = itemsTotal - currentRefunds;
        const diff = expectedTotalFromItems - invoice.grandTotal;

        if (diff > 0.01 && itemsTotal > 0) {
          const percent = (diff / itemsTotal) * 100;
          setExtraDiscount(parseFloat(percent.toFixed(2)));
        }
      } catch (error) {
        console.error(error);
        toast.error("Failed to load data");
        handleBack();
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id]);

  // --- Fetch History ---
  const fetchHistory = async () => {
    setHistoryLoading(true);
    try {
      const res = await fetch(`/api/invoices/${id}/history`);
      if (res.ok) {
        const data = await res.json();
        setHistoryLogs(data);
      }
    } catch (error) {
      console.error("Failed to fetch history");
    } finally {
      setHistoryLoading(false);
    }
  };

  // --- Item Handlers ---
  const handleProductSelect = (productId: string) => {
    if (isReadOnly) return;
    const product = products.find((p) => p.id === productId);
    if (!product) return;

    let additionalStock = 0;
    if (editingItemId) {
      const editingItem = items.find((i) => i.id === editingItemId);
      if (editingItem && editingItem.productId === productId) {
        additionalStock = editingItem.quantity + editingItem.freeQuantity;
      }
    }

    setCurrentItem({
      productId: product.id,
      sku: product.sku,
      quantity: 1,
      freeQuantity: 0,
      unit: product.unit_of_measure,
      mrp: product.mrp,
      unitPrice: product.selling_price,
      discountPercent: 0,
      stockAvailable: product.stock_quantity + additionalStock,
    });
    setProductOpen(false);
  };

  const handleAddOrUpdateItem = () => {
    if (isReadOnly) return;
    if (!currentItem.productId) {
      toast.error("Please select a product");
      return;
    }
    const discountAmt =
      (currentItem.unitPrice *
        currentItem.quantity *
        currentItem.discountPercent) /
      100;
    const total = currentItem.unitPrice * currentItem.quantity - discountAmt;
    const product = products.find((p) => p.id === currentItem.productId);

    const newItem: InvoiceItem = {
      id: editingItemId || Math.random().toString(),
      productId: currentItem.productId,
      sku: currentItem.sku,
      productName: product?.name || "",
      quantity: currentItem.quantity,
      freeQuantity: currentItem.freeQuantity,
      unit: currentItem.unit,
      mrp: currentItem.mrp,
      unitPrice: currentItem.unitPrice,
      discountPercent: currentItem.discountPercent,
      discountAmount: discountAmt,
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
      quantity: 1,
      freeQuantity: 0,
      unit: "",
      mrp: 0,
      unitPrice: 0,
      discountPercent: 0,
      stockAvailable: 0,
    });
  };

  const handleRemoveItem = (id: string) => {
    if (isReadOnly) return;
    setItems(items.filter((item) => item.id !== id));
  };

  const handleEditItem = (item: InvoiceItem) => {
    if (isReadOnly) return;
    setEditingItemId(item.id);
    const product = products.find((p) => p.id === item.productId);
    const currentDbStock = product ? product.stock_quantity : 0;

    setCurrentItem({
      productId: item.productId,
      sku: item.sku,
      quantity: item.quantity,
      freeQuantity: item.freeQuantity,
      unit: item.unit,
      mrp: item.mrp,
      unitPrice: item.unitPrice,
      discountPercent: item.discountPercent,
      stockAvailable: currentDbStock + item.quantity + item.freeQuantity,
    });
  };

  const handleCancelEdit = () => {
    setEditingItemId(null);
    setCurrentItem({
      productId: "",
      sku: "",
      quantity: 1,
      freeQuantity: 0,
      unit: "",
      mrp: 0,
      unitPrice: 0,
      discountPercent: 0,
      stockAvailable: 0,
    });
  };

  // --- Calculations ---
  const subtotal = items.reduce((sum, item) => sum + item.total, 0);

  const refundTotal = returns.reduce(
    (acc, r) => acc + r.quantity * (r.products?.selling_price || 0),
    0
  );

  const extraDiscountAmount = (subtotal * extraDiscount) / 100;
  const grandTotal = subtotal - extraDiscountAmount - refundTotal;

  // --- Save / Update Logic ---
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
      if (userStr) {
        const userData = JSON.parse(userStr);
        userId = userData.id;
      }
    }

    const updateData = {
      customerId,
      salesRepId,
      invoiceDate,
      orderStatus,
      items,
      grandTotal,
      isDraft: asDraft,
      userId: userId,
      changeReason:
        editReason || (asDraft ? "Saved as Draft" : "Updated Invoice"),
    };

    try {
      const res = await fetch(`/api/invoices/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updateData),
      });

      if (!res.ok) throw new Error("Failed to update invoice");

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

  const currentDiscountAmt =
    (currentItem.unitPrice *
      currentItem.quantity *
      currentItem.discountPercent) /
    100;

  if (loading) {
    return (
      <div className="flex justify-center items-center h-full min-h-64">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        <p className="text-lg text-muted-foreground">Loading Invoice...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={handleBack}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Edit Invoice</h1>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-muted-foreground font-mono">{invoiceNumber}</p>
              {isFromReconciliation && (
                <Badge variant="outline" className="bg-blue-50 text-blue-700">
                  <TruckIcon className="w-3 h-3 mr-1" /> From Reconciliation
                </Badge>
              )}
              <Badge
                variant={orderStatus === "Pending" ? "secondary" : "default"}
              >
                {orderStatus}
              </Badge>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* History Sheet Trigger */}
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
                  <div className="flex justify-center">
                    <Loader2 className="animate-spin" />
                  </div>
                ) : historyLogs.length === 0 ? (
                  <p className="text-center text-muted-foreground">
                    No edit history found.
                  </p>
                ) : (
                  <div className="space-y-4 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-300 before:to-transparent">
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
                            <span className="font-bold text-slate-900 text-sm">
                              {log.changedBy}
                            </span>
                            <time className="font-caveat font-medium text-xs text-indigo-500">
                              {new Date(log.changedAt).toLocaleString()}
                            </time>
                          </div>
                          <p className="text-slate-500 text-xs">
                            Reason: {log.reason}
                          </p>
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
                disabled={saving}
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                Update & Finalize
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
              This invoice corresponds to a locked order status. To edit, please
              use the reconciliation page.
            </p>
          </div>
        </div>
      )}

      {/* Reason Input for Tracking */}
      {!isReadOnly && (
        <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-md flex items-center gap-4">
          <Label className="text-yellow-800 whitespace-nowrap">
            Change Reason:
          </Label>
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
          <Card>
            <CardHeader>
              <CardTitle>Invoice Details</CardTitle>
              <CardDescription>
                Customer and billing information
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Details Fields */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Customer</Label>
                  <Popover
                    open={!isReadOnly && customerOpen}
                    onOpenChange={setCustomerOpen}
                  >
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
                          : "Select customer..."}
                        {!isReadOnly && (
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-full p-0">
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
                                    customerId === customer.id
                                      ? "opacity-100"
                                      : "opacity-0"
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
                  <Label>Sales Representative</Label>
                  <Popover
                    open={!isReadOnly && salesRepOpen}
                    onOpenChange={setSalesRepOpen}
                  >
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
                          : "Select rep..."}
                        {!isReadOnly && (
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-full p-0">
                      <Command>
                        <CommandInput placeholder="Search rep..." />
                        <CommandList>
                          <CommandEmpty>No rep found.</CommandEmpty>
                          <CommandGroup>
                            {reps.map((rep) => (
                              <CommandItem
                                key={rep.id}
                                value={rep.name}
                                onSelect={() => {
                                  setSalesRepId(rep.id);
                                  setSalesRepOpen(false);
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    salesRepId === rep.id
                                      ? "opacity-100"
                                      : "opacity-0"
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

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Invoice Date</Label>
                  <Input
                    type="date"
                    value={invoiceDate}
                    onChange={(e) => setInvoiceDate(e.target.value)}
                    disabled={isReadOnly}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Invoice Number</Label>
                  <Input value={invoiceNumber} disabled />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 2. Add/Edit Item Form */}
          <Card className={editingItemId ? "border-blue-500 border-2" : ""}>
            <CardHeader>
              <CardTitle>
                {editingItemId ? "Edit Item" : "Add Product"}
              </CardTitle>
              <CardDescription>
                {editingItemId
                  ? "Update the item details below"
                  : "Select product and enter quantities"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Product Selector */}
              <div className="space-y-2">
                <Label>Product</Label>
                <Popover
                  open={!isReadOnly && productOpen}
                  onOpenChange={setProductOpen}
                >
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      className="w-full justify-between"
                      disabled={!!editingItemId || isReadOnly}
                    >
                      {currentItem.productId
                        ? `${currentItem.sku} - ${
                            products.find((p) => p.id === currentItem.productId)
                              ?.name
                          }`
                        : "Select product..."}
                      {!isReadOnly && (
                        <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0">
                    <Command>
                      <CommandInput placeholder="Search product..." />
                      <CommandList>
                        <CommandEmpty>No product found.</CommandEmpty>
                        <CommandGroup>
                          {availableProducts.map((product) => (
                            <CommandItem
                              key={product.id}
                              value={`${product.sku} ${product.name}`}
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
                              <div className="flex flex-col">
                                <span className="font-medium">
                                  {product.sku} - {product.name}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  Stock: {product.stock_quantity} | MRP:{" "}
                                  {product.mrp} | Price: {product.selling_price}
                                </span>
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              {/* Quantity Inputs */}
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Quantity</Label>
                  <Input
                    type="number"
                    min="1"
                    value={currentItem.quantity}
                    onChange={(e) =>
                      setCurrentItem({
                        ...currentItem,
                        quantity: Math.max(1, parseInt(e.target.value) || 1),
                      })
                    }
                    disabled={!currentItem.productId || isReadOnly}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Free Qty</Label>
                  <Input
                    type="number"
                    min="0"
                    value={currentItem.freeQuantity}
                    onChange={(e) =>
                      setCurrentItem({
                        ...currentItem,
                        freeQuantity: Math.max(
                          0,
                          parseInt(e.target.value) || 0
                        ),
                      })
                    }
                    disabled={!currentItem.productId || isReadOnly}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Unit</Label>
                  <Input value={currentItem.unit} disabled />
                </div>
              </div>

              {/* Price & Discount */}
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Unit Price</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={currentItem.unitPrice}
                    onChange={(e) =>
                      setCurrentItem({
                        ...currentItem,
                        unitPrice: parseFloat(e.target.value) || 0,
                      })
                    }
                    disabled={!currentItem.productId || isReadOnly}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Discount %</Label>
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={currentItem.discountPercent}
                    onChange={(e) =>
                      setCurrentItem({
                        ...currentItem,
                        discountPercent: Math.min(
                          100,
                          Math.max(0, parseFloat(e.target.value) || 0)
                        ),
                      })
                    }
                    disabled={!currentItem.productId || isReadOnly}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Total</Label>
                  <Input
                    value={(
                      currentItem.unitPrice * currentItem.quantity -
                      currentDiscountAmt
                    ).toFixed(2)}
                    disabled
                  />
                </div>
              </div>

              {/* Action Buttons */}
              {!isReadOnly && (
                <div className="flex gap-2">
                  {editingItemId && (
                    <Button variant="outline" onClick={handleCancelEdit}>
                      <X className="w-4 h-4 mr-2" />
                      Cancel
                    </Button>
                  )}
                  <Button
                    onClick={handleAddOrUpdateItem}
                    className="flex-1"
                    variant={editingItemId ? "default" : "default"}
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
                      <TableHead className="text-right w-24">
                        Unit Price
                      </TableHead>
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
                      items.map((item, idx) => (
                        <TableRow
                          key={item.id}
                          className={
                            editingItemId === item.id ? "bg-blue-50" : ""
                          }
                        >
                          <TableCell>{idx + 1}</TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium">{item.productName}</p>
                              <p className="text-xs text-muted-foreground">
                                {item.sku}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            {item.quantity} {item.unit}
                          </TableCell>
                          <TableCell className="text-center">
                            {item.freeQuantity}
                          </TableCell>
                          <TableCell className="text-right">
                            {item.unitPrice.toFixed(2)}
                          </TableCell>
                          <TableCell className="text-center">
                            {item.discountPercent}%
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {item.total.toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex gap-1 justify-end">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleEditItem(item)}
                                disabled={editingItemId !== null || isReadOnly}
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleRemoveItem(item.id)}
                                disabled={isReadOnly}
                              >
                                <Trash2 className="w-4 h-4 text-destructive" />
                              </Button>
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

        {/* RIGHT COLUMN */}
        <div className="space-y-6">
          {/* Summary Card */}
          <Card className="sticky top-6">
            <CardHeader>
              <CardTitle>Invoice Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal:</span>
                <span className="font-medium">LKR {subtotal.toFixed(2)}</span>
              </div>

              {refundTotal > 0 && (
                <div className="flex justify-between text-sm text-orange-600 border-t pt-2">
                  <span className="flex items-center gap-1">
                    <Undo2 className="w-3 h-3" /> Less Returns:
                  </span>
                  <span className="font-medium">
                    - LKR {refundTotal.toFixed(2)}
                  </span>
                </div>
              )}

              <div className="space-y-2 pt-2 border-t">
                <Label>Extra Discount (%)</Label>
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  value={extraDiscount}
                  onChange={(e) =>
                    setExtraDiscount(
                      Math.min(
                        100,
                        Math.max(0, parseFloat(e.target.value) || 0)
                      )
                    )
                  }
                  disabled={isReadOnly}
                />
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Amount:</span>
                  <span className="text-green-600">
                    - LKR {extraDiscountAmount.toFixed(2)}
                  </span>
                </div>
              </div>

              <div className="flex justify-between text-lg font-bold pt-3 border-t">
                <span>Grand Total:</span>
                <span className="text-primary">
                  LKR {grandTotal.toFixed(2)}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
