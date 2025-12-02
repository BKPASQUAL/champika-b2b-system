// FILE PATH: app/dashboard/admin/invoices/[id]/edit/page.tsx
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
import { cn } from "@/lib/utils";
import { toast } from "sonner";

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
  discountPercent: number;
  discountAmount: number;
  total: number;
}

export default function EditInvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();

  // ✅ NEW: Get return URL from query params
  const returnTo = searchParams.get("returnTo");
  const isFromReconciliation = !!returnTo;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Data State
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<{ id: string; name: string }[]>(
    []
  );
  const [reps, setReps] = useState<{ id: string; name: string }[]>([]);

  // Form State
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [invoiceDate, setInvoiceDate] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [salesRepId, setSalesRepId] = useState<string>("");
  const [orderStatus, setOrderStatus] = useState<string>("Delivered");

  // Items State
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [extraDiscount, setExtraDiscount] = useState<number>(0);

  // Editing State
  const [editingItemId, setEditingItemId] = useState<string | null>(null);

  // Popover States
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

  // ✅ NEW: Handle back navigation
  const handleBack = () => {
    if (returnTo) {
      router.push(returnTo);
    } else {
      router.push("/dashboard/admin/invoices");
    }
  };

  // --- Fetch Data on Mount ---
  useEffect(() => {
    const fetchData = async () => {
      try {
        // 1. Fetch Reference Data
        const [prodRes, custRes, usersRes] = await Promise.all([
          fetch("/api/products"),
          fetch("/api/customers"),
          fetch("/api/users"),
        ]);

        const prodData = await prodRes.json();
        const custData = await custRes.json();
        const usersData = await usersRes.json();

        setProducts(
          prodData.map((p: any) => ({
            id: p.id,
            sku: p.sku,
            name: p.name,
            selling_price: p.sellingPrice,
            mrp: p.mrp,
            stock_quantity: p.stock_quantity || 0,
            unit_of_measure: p.unitOfMeasure || "unit",
          }))
        );

        setCustomers(
          custData.map((c: any) => ({ id: c.id, name: c.shopName }))
        );

        const salesReps = usersData
          .filter((u: any) => u.role === "rep")
          .map((u: any) => ({
            id: u.id,
            name: u.fullName,
          }));
        setReps(salesReps);

        // 2. Fetch Invoice Data
        const invRes = await fetch(`/api/invoices/${id}`);
        if (!invRes.ok) throw new Error("Failed to load invoice");
        const invoice = await invRes.json();

        // 3. Pre-fill Form
        setCustomerId(invoice.customerId);
        setSalesRepId(invoice.salesRepId);
        setInvoiceDate(invoice.date);
        setInvoiceNumber(invoice.invoiceNo);
        setOrderStatus(invoice.orderStatus || "Delivered");

        // Map items (Robust mapping to handle potential API differences)
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
          discountPercent: item.discountPercent || 0,
          discountAmount: 0,
          total: item.total,
        }));
        setItems(mappedItems);

        // Calculate extra discount
        const itemsTotal = mappedItems.reduce((sum, i) => sum + i.total, 0);
        const diff = itemsTotal - invoice.grandTotal;
        if (diff > 0 && itemsTotal > 0) {
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

  // --- Product Selection ---
  const handleProductSelect = (productId: string) => {
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

  // --- Edit Mode Handler ---
  const handleEditItem = (item: InvoiceItem) => {
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

  const handleAddOrUpdateItem = () => {
    if (!currentItem.productId) {
      toast.error("Please select a product");
      return;
    }

    const totalQty = currentItem.quantity + currentItem.freeQuantity;
    if (totalQty > currentItem.stockAvailable) {
      toast.error(`Not enough stock. Available: ${currentItem.stockAvailable}`);
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
      toast.success("Item updated");
    } else {
      setItems([...items, newItem]);
      toast.success("Item added");
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
    if (editingItemId === id) {
      handleCancelEdit();
    }
    setItems(items.filter((item) => item.id !== id));
  };

  // --- Live Calculations ---
  const subtotal = items.reduce((sum, item) => sum + item.total, 0);
  const totalItemDiscount = items.reduce(
    (sum, item) => sum + (item.discountAmount || 0),
    0
  );
  const grossTotal = items.reduce(
    (sum, item) => sum + item.unitPrice * item.quantity,
    0
  );

  const extraDiscountAmount = (subtotal * extraDiscount) / 100;
  const grandTotal = subtotal - extraDiscountAmount;

  const availableProducts = products.filter(
    (p) => !items.some((i) => i.productId === p.id && i.id !== editingItemId)
  );

  const currentDiscountAmt =
    (currentItem.unitPrice *
      currentItem.quantity *
      currentItem.discountPercent) /
    100;

  // --- Update Invoice API Call ---
  const handleUpdateInvoice = async () => {
    if (!customerId || !salesRepId || items.length === 0) {
      toast.error("Please fill all required fields");
      return;
    }

    setSaving(true);

    const updateData = {
      customerId,
      salesRepId,
      invoiceDate,
      orderStatus,
      items,
      grandTotal,
    };

    try {
      const res = await fetch(`/api/invoices/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updateData),
      });

      if (!res.ok) throw new Error("Failed to update invoice");

      toast.success("Invoice Updated Successfully!");

      // ✅ NEW: Navigate back appropriately
      handleBack();
    } catch (error: any) {
      toast.error(error.message || "Update failed");
    } finally {
      setSaving(false);
    }
  };

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
      {/* ✅ UPDATED: Header with Conditional Back Button */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={handleBack}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight">Edit Invoice</h1>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-muted-foreground">{invoiceNumber}</p>
            {/* ✅ NEW: Show reconciliation indicator */}
            {isFromReconciliation && (
              <Badge
                variant="outline"
                className="bg-blue-50 text-blue-700 border-blue-300"
              >
                <TruckIcon className="w-3 h-3 mr-1" />
                From Reconciliation
              </Badge>
            )}
          </div>
        </div>
        <Button onClick={handleUpdateInvoice} disabled={saving}>
          {saving ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Save className="w-4 h-4 mr-2" />
          )}
          Update Invoice
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* LEFT COLUMN */}
        <div className="lg:col-span-2 space-y-6">
          {/* 1. Invoice Details */}
          <Card>
            <CardHeader>
              <CardTitle>Invoice Details</CardTitle>
              <CardDescription>
                Customer and billing information
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Customer</Label>
                  <Popover open={customerOpen} onOpenChange={setCustomerOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={customerOpen}
                        className="w-full justify-between"
                      >
                        {customerId
                          ? customers.find((c) => c.id === customerId)?.name
                          : "Select customer..."}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
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
                  <Popover open={salesRepOpen} onOpenChange={setSalesRepOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={salesRepOpen}
                        className="w-full justify-between"
                      >
                        {salesRepId
                          ? reps.find((r) => r.id === salesRepId)?.name
                          : "Select rep..."}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
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
                <Popover open={productOpen} onOpenChange={setProductOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      className="w-full justify-between"
                      disabled={!!editingItemId}
                    >
                      {currentItem.productId
                        ? `${currentItem.sku} - ${
                            products.find((p) => p.id === currentItem.productId)
                              ?.name
                          }`
                        : "Select product..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
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
                    disabled={!currentItem.productId}
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
                    disabled={!currentItem.productId}
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
                    disabled={!currentItem.productId}
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
                    disabled={!currentItem.productId}
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
                            {item.quantity}
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
                                disabled={editingItemId !== null}
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleRemoveItem(item.id)}
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

        {/* RIGHT COLUMN - Summary */}
        <div className="space-y-6">
          <Card className="sticky top-6">
            <CardHeader>
              <CardTitle>Invoice Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Gross Total:</span>
                <span className="font-medium">LKR {grossTotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Item Discounts:</span>
                <span className="text-green-600">
                  - LKR {totalItemDiscount.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal:</span>
                <span className="font-medium">LKR {subtotal.toFixed(2)}</span>
              </div>

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

// ✅ NEW: Add Badge import
import { Badge } from "@/components/ui/badge";
