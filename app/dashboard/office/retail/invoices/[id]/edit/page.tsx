// app/dashboard/office/retail/invoices/[id]/edit/page.tsx
"use client";

import React, { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Save,
  Package,
  Loader2,
  Check,
  ChevronsUpDown,
  Printer,
  Download,
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
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { getUserBusinessContext } from "@/app/middleware/businessAuth";

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

interface Customer {
  id: string;
  name: string;
  shop_name: string;
  owner_name: string;
  business_id: string | null;
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
  stockAvailable?: number; // Added for edit validation
}

interface CurrentItemState {
  productId: string;
  sku: string;
  quantity: number | "";
  freeQuantity: number | "";
  unit: string;
  mrp: number | "";
  unitPrice: number | "";
  discountPercent: number | "";
  stockAvailable: number;
}

export default function EditRetailInvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [stockLoading, setStockLoading] = useState(false);

  // Business Context
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [businessName, setBusinessName] = useState<string>("");
  const [userId, setUserId] = useState<string | null>(null);

  // Data State
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [allCustomers, setAllCustomers] = useState<Customer[]>([]);
  
  // Guest Customer Logic (kept for consistency with Create page)
  const [guestCustomerId, setGuestCustomerId] = useState<string | null>(null);

  // Form State
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [invoiceDate, setInvoiceDate] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [paymentType, setPaymentType] = useState<string>("Cash");
  const [changeReason, setChangeReason] = useState(""); // Audit Log

  // Items State
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [extraDiscount, setExtraDiscount] = useState<number>(0);

  // Popover States
  const [customerOpen, setCustomerOpen] = useState(false);
  const [productOpen, setProductOpen] = useState(false);

  // Current Item Being Added
  const [currentItem, setCurrentItem] = useState<CurrentItemState>({
    productId: "",
    sku: "",
    quantity: "",
    freeQuantity: "",
    unit: "",
    mrp: "",
    unitPrice: "",
    discountPercent: "",
    stockAvailable: 0,
  });

  // --- 1. Fetch Data ---
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        // 1. Check User Context
        const user = getUserBusinessContext();
        if (!user || !user.businessId) {
          toast.error("User context not found");
          router.push("/login");
          return;
        }

        setBusinessId(user.businessId);
        setBusinessName(user.businessName || "Retail Business");
        setUserId(user.id);

        // 2. Fetch Data (Invoice, Customers, Products)
        const [invRes, custRes, prodRes] = await Promise.all([
          fetch(`/api/invoices/${id}`),
          fetch("/api/customers?status=Active"),
          fetch(`/api/rep/stock?userId=${user.id}`), // Fetch user's stock
        ]);

        if (!invRes.ok) throw new Error("Failed to load invoice");

        const invoice = await invRes.json();
        const customersData = await custRes.json();
        const productsData = await prodRes.json();

        // 3. Setup Customers
        const retailCustomers = customersData.filter((c: any) => 
          c.business_id === user.businessId || c.businessId === user.businessId
        );
        
        // Find Guest Customer (Logic from Create Page)
        const guest = retailCustomers.find((c: any) => {
          const nameToCheck = (c.shop_name || c.name || "").toLowerCase();
          return nameToCheck.includes("walk-in") || nameToCheck.includes("guest");
        });
        if (guest) setGuestCustomerId(guest.id);

        setCustomers(retailCustomers.map((c: any) => ({
          id: c.id,
          name: c.shop_name || c.name,
          shop_name: c.shop_name,
          owner_name: c.owner_name,
          business_id: c.business_id,
        })));

        // 4. Setup Products
        if (Array.isArray(productsData)) {
          setProducts(productsData.map((p: any) => ({
            id: p.id,
            sku: p.sku,
            name: p.name,
            selling_price: p.selling_price || 0,
            mrp: p.mrp || 0,
            stock_quantity: p.stock_quantity || 0,
            unit_of_measure: p.unit_of_measure || "unit",
          })));
        }

        // 5. Populate Form with Invoice Data
        setInvoiceNumber(invoice.invoiceNo);
        setInvoiceDate(invoice.date);
        setCustomerId(invoice.customerId);
        setPaymentType(
          invoice.payments && invoice.payments.length > 0
            ? invoice.payments[0].method
            : "Cash"
        );
        setExtraDiscount(invoice.extraDiscountPercent || 0);

        // 6. Populate Items
        setItems(invoice.items.map((item: any) => ({
          id: item.id || `EXISTING-${Math.random()}`,
          productId: item.productId,
          sku: item.sku,
          productName: item.productName || item.name,
          quantity: item.quantity,
          freeQuantity: item.freeQuantity || 0,
          unit: item.unit,
          mrp: item.mrp,
          unitPrice: item.unitPrice, // Make sure this comes from API
          discountPercent: item.discountPercent || 0,
          discountAmount: item.discountAmount || 0,
          total: item.total,
          stockAvailable: item.stockAvailable || 0 // Might come from API or 0
        })));

      } catch (error) {
        console.error("Error loading data:", error);
        toast.error("Failed to load invoice data");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [id, router]);

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
  };

  // --- Add Item ---
  const handleAddItem = () => {
    if (!currentItem.productId) {
      toast.error("Please select a product");
      return;
    }

    const qty = currentItem.quantity === "" ? 0 : currentItem.quantity;
    const freeQty = currentItem.freeQuantity === "" ? 0 : currentItem.freeQuantity;

    if (qty <= 0) {
      toast.error("Quantity must be greater than 0");
      return;
    }

    const product = products.find((p) => p.id === currentItem.productId);
    if (!product) return;

    const unitPrice = currentItem.unitPrice === "" ? 0 : currentItem.unitPrice;
    const mrp = currentItem.mrp === "" ? 0 : currentItem.mrp;
    const discountPercent = currentItem.discountPercent === "" ? 0 : currentItem.discountPercent;

    const grossTotal = unitPrice * qty;
    const discountAmount = (grossTotal * discountPercent) / 100;
    const netTotal = grossTotal - discountAmount;

    const newItem: InvoiceItem = {
      id: `NEW-${Date.now()}`,
      productId: currentItem.productId,
      sku: product.sku,
      productName: product.name,
      unit: product.unit_of_measure,
      quantity: qty,
      freeQuantity: freeQty,
      mrp: mrp,
      unitPrice: unitPrice,
      discountPercent: discountPercent,
      discountAmount: discountAmount,
      total: netTotal,
      stockAvailable: product.stock_quantity
    };

    setItems([...items, newItem]);

    setCurrentItem({
      productId: "",
      sku: "",
      quantity: "",
      freeQuantity: "",
      unit: "",
      mrp: "",
      unitPrice: "",
      discountPercent: "",
      stockAvailable: 0,
    });
  };

  const handleRemoveItem = (id: string) => {
    setItems(items.filter((item) => item.id !== id));
  };

  // --- Update Item (Inline Edit) ---
  const handleUpdateItem = (id: string, field: keyof InvoiceItem, value: number) => {
    setItems(prevItems => prevItems.map(item => {
      if (item.id === id) {
        const updatedItem = { ...item, [field]: value };
        
        // Recalculate totals
        const gross = updatedItem.unitPrice * updatedItem.quantity;
        const discount = (gross * updatedItem.discountPercent) / 100;
        
        updatedItem.discountAmount = discount;
        updatedItem.total = gross - discount;
        
        return updatedItem;
      }
      return item;
    }));
  };

  // --- Save / Update Handler ---
  const handleSaveAction = async (action: "save" | "print" | "download") => {
    if (!customerId) {
      toast.error("Customer is required");
      return;
    }
    if (items.length === 0) {
      toast.error("Invoice must have at least one item");
      return;
    }

    setLoading(true);

    const invoiceData = {
      customerId,
      salesRepId: userId,
      businessId: businessId,
      items,
      invoiceNumber, // Used for logging mostly, backend generates new ones only on create
      invoiceDate,
      subTotal: subtotal,
      extraDiscountPercent: extraDiscount,
      extraDiscountAmount: extraDiscountAmount,
      grandTotal: grandTotal,
      orderStatus: "Delivered", // Standard retail status
      paymentType: paymentType,
      paymentStatus: paymentType === "Cash" ? "Paid" : "Unpaid",
      paidAmount: paymentType === "Cash" ? grandTotal : 0,
      notes: "",
      changeReason: changeReason || "Updated invoice details", // Optional reason
      userId: userId, // For Audit
    };

    try {
      const res = await fetch(`/api/invoices/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(invoiceData),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Update failed");

      toast.success("Invoice Updated Successfully!");

      if (action === "save") {
        router.push("/dashboard/office/retail/invoices");
      } else if (action === "print") {
        router.push(`/dashboard/office/retail/invoices/${id}?print=true`);
      } else if (action === "download") {
        router.push(`/dashboard/office/retail/invoices/${id}?download=true`);
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  // --- Totals Calculation ---
  const subtotal = items.reduce((sum, item) => sum + item.total, 0);
  const totalItemDiscount = items.reduce((sum, item) => sum + item.discountAmount, 0);
  const grossTotal = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);

  const extraDiscountAmount = (subtotal * extraDiscount) / 100;
  const grandTotal = subtotal - extraDiscountAmount;

  const availableProducts = products.filter(
    (p) => !items.some((i) => i.productId === p.id)
  );

  // Helper for current item calculation
  const safeUnitPrice = currentItem.unitPrice === "" ? 0 : currentItem.unitPrice;
  const safeQuantity = currentItem.quantity === "" ? 0 : currentItem.quantity;
  const safeDiscount = currentItem.discountPercent === "" ? 0 : currentItem.discountPercent;
  const currentDiscountAmt = (safeUnitPrice * safeQuantity * safeDiscount) / 100;

  if (loading && items.length === 0) {
    return (
      <div className="flex justify-center items-center h-full min-h-64">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        <p className="text-lg text-muted-foreground">Loading Invoice...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 mx-auto">
      <div className="flex flex-col md:flex-row items-center gap-4">
        <div className="flex items-center gap-4 w-full md:w-auto">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/dashboard/office/retail/invoices")}
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold tracking-tight">Edit Retail Invoice</h1>
            <p className="text-muted-foreground mt-1">
              Modifying: {invoiceNumber}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <Button
            variant="outline"
            onClick={() => handleSaveAction("download")}
            disabled={items.length === 0 || loading}
          >
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
            Save & Download
          </Button>

          <Button
            variant="outline"
            onClick={() => handleSaveAction("print")}
            disabled={items.length === 0 || loading}
          >
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Printer className="w-4 h-4 mr-2" />}
            Save & Print
          </Button>

          <Button
            onClick={() => handleSaveAction("save")}
            disabled={items.length === 0 || loading}
            className="bg-green-600 hover:bg-green-700"
          >
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Update Invoice
          </Button>
        </div>
      </div>

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
                  <div className="flex justify-between items-center">
                    <Label>Customer <span className="text-red-500">*</span></Label>
                    {guestCustomerId && (
                      <Button
                        variant="secondary"
                        size="sm"
                        className="h-6 text-xs bg-blue-100 text-blue-700 hover:bg-blue-200"
                        onClick={() => {
                          setCustomerId(guestCustomerId);
                          setCustomerOpen(false);
                          toast.success("Selected Walk-in Customer");
                        }}
                      >
                        Select Walk-in / Guest
                      </Button>
                    )}
                  </div>

                  <Popover open={customerOpen} onOpenChange={setCustomerOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={customerOpen}
                        className="w-full justify-between"
                      >
                        {customerId
                          ? customers.find((c) => c.id === customerId)?.name || "Unknown Customer"
                          : "Select Customer"}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Search customer..." />
                        <CommandList>
                          <CommandEmpty>No customer found</CommandEmpty>
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
                                  className={cn("mr-2 h-4 w-4", customerId === customer.id ? "opacity-100" : "opacity-0")}
                                />
                                <div className="flex-1">
                                  <div className="font-medium">{customer.name}</div>
                                </div>
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
                  <Input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Invoice No</Label>
                  <Input value={invoiceNumber} disabled className="bg-muted" />
                </div>

                <div className="space-y-2">
                  <Label>Payment Type</Label>
                  <Select value={paymentType} onValueChange={setPaymentType}>
                    <SelectTrigger className="w-full"><SelectValue placeholder="Select Type" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Cash">💵 Cash</SelectItem>
                      <SelectItem value="Credit">📋 Credit</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 2. Add Items */}
          <Card>
            <CardHeader>
              <CardTitle>Add Products</CardTitle>
              <CardDescription>Search and add new products</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Product Search */}
              <div className="space-y-2">
                <Label>Product {stockLoading && <Loader2 className="inline h-3 w-3 animate-spin ml-2" />}</Label>
                <Popover open={productOpen} onOpenChange={setProductOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" aria-expanded={productOpen} className="w-full justify-between" disabled={stockLoading}>
                      {currentItem.productId ? products.find((p) => p.id === currentItem.productId)?.name : "Select Product"}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Search product..." />
                      <CommandList>
                        <CommandEmpty>No products found.</CommandEmpty>
                        <CommandGroup>
                          {availableProducts.map((product) => (
                            <CommandItem key={product.id} value={product.name} onSelect={() => { handleProductSelect(product.id); setProductOpen(false); }}>
                              <Check className={cn("mr-2 h-4 w-4", currentItem.productId === product.id ? "opacity-100" : "opacity-0")} />
                              <div className="flex-1">
                                <div className="font-medium">{product.name}</div>
                                <div className="text-xs text-muted-foreground">{product.sku} • Stock: {product.stock_quantity} • LKR {product.selling_price}</div>
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              {/* Add Form Inputs */}
              <div className="grid grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label>Quantity</Label>
                  <Input type="number" min="1" value={currentItem.quantity} onChange={(e) => setCurrentItem({ ...currentItem, quantity: e.target.value === "" ? "" : Number(e.target.value) })} />
                </div>
                <div className="space-y-2">
                  <Label>Free Qty</Label>
                  <Input type="number" min="0" value={currentItem.freeQuantity} onChange={(e) => setCurrentItem({ ...currentItem, freeQuantity: e.target.value === "" ? "" : Number(e.target.value) })} />
                </div>
                <div className="space-y-2">
                  <Label>Unit Price</Label>
                  <Input type="number" value={currentItem.unitPrice} onChange={(e) => setCurrentItem({ ...currentItem, unitPrice: e.target.value === "" ? "" : Number(e.target.value) })} />
                </div>
                <div className="space-y-2">
                  <Label>Disc %</Label>
                  <Input type="number" value={currentItem.discountPercent} onChange={(e) => setCurrentItem({ ...currentItem, discountPercent: e.target.value === "" ? "" : Number(e.target.value) })} />
                </div>
              </div>

              <div className="space-y-2">
                 <Label>Total Preview</Label>
                 <Input value={(safeUnitPrice * safeQuantity - currentDiscountAmt).toFixed(2)} disabled className="font-bold bg-muted" />
              </div>

              <Button onClick={handleAddItem} className="w-full bg-green-600 hover:bg-green-700" disabled={!currentItem.productId}>
                <Plus className="w-4 h-4 mr-2" /> Add to Invoice
              </Button>
            </CardContent>
          </Card>

          {/* 3. Items Table (Editable) */}
          <Card>
            <CardHeader>
              <CardTitle>Invoice Items (Editable)</CardTitle>
              <CardDescription>{items.length} item(s) added. Adjust values directly below.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead className="w-[250px]">Product</TableHead>
                      <TableHead className="w-20 text-center">Qty</TableHead>
                      <TableHead className="w-20 text-center">Free</TableHead>
                      <TableHead className="w-24 text-right">Price</TableHead>
                      <TableHead className="w-20 text-center">Disc%</TableHead>
                      <TableHead className="w-28 text-right">Total</TableHead>
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                          <Package className="w-8 h-8 mx-auto mb-2 opacity-50" />
                          No items
                        </TableCell>
                      </TableRow>
                    ) : (
                      items.map((item, idx) => (
                        <TableRow key={item.id}>
                          <TableCell>{idx + 1}</TableCell>
                          <TableCell>
                            <div className="font-medium">{item.productName}</div>
                            <div className="text-xs text-muted-foreground">{item.sku}</div>
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              className="h-8 w-20 text-center"
                              value={item.quantity}
                              onChange={(e) => handleUpdateItem(item.id, 'quantity', Number(e.target.value))}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              className="h-8 w-20 text-center"
                              value={item.freeQuantity}
                              onChange={(e) => handleUpdateItem(item.id, 'freeQuantity', Number(e.target.value))}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              className="h-8 w-24 text-right"
                              value={item.unitPrice}
                              onChange={(e) => handleUpdateItem(item.id, 'unitPrice', Number(e.target.value))}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              className="h-8 w-20 text-center"
                              value={item.discountPercent}
                              onChange={(e) => handleUpdateItem(item.id, 'discountPercent', Number(e.target.value))}
                            />
                          </TableCell>
                          <TableCell className="text-right font-bold">
                            {item.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell>
                            <Button variant="ghost" size="icon" onClick={() => handleRemoveItem(item.id)}>
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
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
        <div className="lg:col-span-1 space-y-6">
          <Card className="sticky top-6">
            <CardHeader>
              <CardTitle>Invoice Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Customer:</span>
                  <span className="font-medium">{customers.find((c) => c.id === customerId)?.name || "-"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Date:</span>
                  <span className="font-medium">{invoiceDate}</span>
                </div>
              </div>

              <div className="border-t pt-4 space-y-2">
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

              <div className="border-t pt-4 space-y-3">
                <div className="space-y-2">
                  <Label className="text-xs">Extra Discount %</Label>
                  <Input type="number" min="0" max="100" value={extraDiscount} onChange={(e) => setExtraDiscount(Number(e.target.value))} />
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Extra Discount:</span>
                  <span className="text-destructive">- LKR {extraDiscountAmount.toLocaleString()}</span>
                </div>
              </div>

              <div className="border-t pt-4">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-bold">Grand Total:</span>
                  <span className="text-2xl font-bold text-green-600">LKR {grandTotal.toLocaleString()}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Audit Log (Required by API) */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Audit Log</CardTitle>
            </CardHeader>
            <CardContent>
              <Label className="text-xs text-muted-foreground mb-1 block">Modification Reason (Optional)</Label>
              <Textarea 
                placeholder="Reason for changes..." 
                value={changeReason}
                onChange={(e) => setChangeReason(e.target.value)}
                className="h-20 text-sm resize-none"
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}