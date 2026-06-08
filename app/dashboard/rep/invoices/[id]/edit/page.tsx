"use client";

import React, { useState, useEffect, useRef, use } from "react";
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
  User,
  AlertTriangle,
  UserPlus,
  MapPin,
  Clock,
  Pencil,
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  supplier?: string;
}

interface OrderItem {
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
  supplier?: string;
}

interface UserData {
  id: string;
  name: string;
  email: string;
  role: string;
}

const FIXED_SUPPLIERS = [
  { id: "orange-orel", name: "Orange (Orel Corporation)" },
  { id: "sierra-cables", name: "Sierra Cables" },
  { id: "wireman", name: "Wireman" }
];

const getSupplierCleanName = (name?: string | null) => {
  if (!name) return "General";
  const s = name.toLowerCase();
  if (s.includes("sierra")) return "Sierra Cables";
  if (s.includes("wireman")) return "Wireman";
  if (s.includes("orange")) return "Orange";
  if (s.includes("chint")) return "Chint";
  if (s.includes("kelani")) return "Kelani";
  if (s.includes("acl")) return "ACL";
  return name;
};

const getSupplierColorStyles = (supplier?: string | null) => {
  if (!supplier) {
    return {
      dot: "⚪",
      bgActive: "bg-slate-800 hover:bg-slate-900 text-white border-slate-800 shadow-sm",
      borderInactive: "border-slate-200 text-slate-700 hover:bg-slate-50",
      badge: "bg-slate-100 text-slate-700 border-slate-200",
      borderLeft: "border-l-slate-200 bg-slate-50/10",
    };
  }
  const s = supplier.toLowerCase();
  if (s.includes("sierra")) {
    return {
      dot: "🟣",
      bgActive: "bg-purple-600 hover:bg-purple-700 text-white border-purple-600 shadow-sm",
      borderInactive: "border-purple-200 text-purple-700 hover:bg-purple-50",
      badge: "bg-purple-100 text-purple-700 border-purple-200",
      borderLeft: "border-l-purple-500 bg-purple-50/10",
    };
  }
  if (s.includes("wireman")) {
    return {
      dot: "🔴",
      bgActive: "bg-red-600 hover:bg-red-700 text-white border-red-600 shadow-sm",
      borderInactive: "border-red-200 text-red-700 hover:bg-red-50",
      badge: "bg-red-100 text-red-700 border-red-200",
      borderLeft: "border-l-red-500 bg-red-50/10",
    };
  }
  if (s.includes("orange")) {
    return {
      dot: "🟠",
      bgActive: "bg-orange-500 hover:bg-orange-600 text-white border-orange-500 shadow-sm",
      borderInactive: "border-orange-200 text-orange-700 hover:bg-orange-50",
      badge: "bg-orange-100 text-orange-700 border-orange-200",
      borderLeft: "border-l-orange-500 bg-orange-50/10",
    };
  }
  if (s.includes("chint")) {
    return {
      dot: "🔵",
      bgActive: "bg-blue-600 hover:bg-blue-700 text-white border-blue-600 shadow-sm",
      borderInactive: "border-blue-200 text-blue-700 hover:bg-blue-50",
      badge: "bg-blue-100 text-blue-700 border-blue-200",
      borderLeft: "border-l-blue-500 bg-blue-50/10",
    };
  }
  if (s.includes("kelani")) {
    return {
      dot: "🟢",
      bgActive: "bg-green-600 hover:bg-green-700 text-white border-green-600 shadow-sm",
      borderInactive: "border-green-200 text-green-700 hover:bg-green-50",
      badge: "bg-green-100 text-green-700 border-green-200",
      borderLeft: "border-l-green-500 bg-green-50/10",
    };
  }
  if (s.includes("acl")) {
    return {
      dot: "🟡",
      bgActive: "bg-amber-500 hover:bg-amber-600 text-white border-amber-500 shadow-sm",
      borderInactive: "border-amber-200 text-amber-700 hover:bg-amber-50",
      badge: "bg-amber-100 text-amber-700 border-amber-200",
      borderLeft: "border-l-amber-500 bg-amber-50/10",
    };
  }
  return {
    dot: "⚪",
    bgActive: "bg-slate-800 hover:bg-slate-900 text-white border-slate-800 shadow-sm",
    borderInactive: "border-slate-200 text-slate-700 hover:bg-slate-50",
    badge: "bg-slate-100 text-slate-700 border-slate-200",
    borderLeft: "border-l-slate-500 bg-slate-50/10",
  };
};

export default function EditOrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitStep, setSubmitStep] = useState(0); // 0=idle 1=validating 2=saving 3=done
  const [outOfStockOverride, setOutOfStockOverride] = useState(false);
  const [canCreateCustomer, setCanCreateCustomer] = useState(false);
  const [userBusinessId, setUserBusinessId] = useState<string | null>(null);
  const [invoiceNo, setInvoiceNo] = useState("");
  const [isNotPending, setIsNotPending] = useState(false);

  // New Customer Dialog
  const [newCustomerOpen, setNewCustomerOpen] = useState(false);
  const [creatingCustomer, setCreatingCustomer] = useState(false);
  const [routes, setRoutes] = useState<{ id: string; name: string; phone?: string; ownerName?: string; }[]>([]);
  const [newCustomer, setNewCustomer] = useState({
    shopName: "",
    ownerName: "",
    phone: "",
    email: "",
    address: "",
    route: "",
    creditLimit: 0,
    status: "Active",
  });

  // Data State
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<{ id: string; name: string; phone?: string; ownerName?: string; }[]>([]);

  // User State
  const [currentUser, setCurrentUser] = useState<UserData | null>(null);

  // Form State
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [orderDate, setOrderDate] = useState(
    new Date().toISOString().split("T")[0]
  );

  // Items State
  const [items, setItems] = useState<OrderItem[]>([]);
  const [extraDiscount, setExtraDiscount] = useState<string>("");
  const [editingItemId, setEditingItemId] = useState<string | null>(null);

  // Popover States
  const [customerOpen, setCustomerOpen] = useState(false);
  const [productOpen, setProductOpen] = useState(false);

  const [suppliers, setSuppliers] = useState<{ id: string; name: string }[]>([]);
  const [supplierFilter, setSupplierFilter] = useState("all");

  // Current Item Being Added — string-based inputs like distribution
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
    supplier: "",
  });

  const qtyInputRef = useRef<HTMLInputElement>(null);
  const addProductCardRef = useRef<HTMLDivElement>(null);

  // --- Fetch Data on Mount ---
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // 1. Load Current User from Local Storage
        let userId = "";
        let bizId: string | null = null;

        if (typeof window !== "undefined") {
          const storedUser = localStorage.getItem("currentUser");
          if (storedUser) {
            const parsedUser = JSON.parse(storedUser);
            if (!parsedUser.id) {
              const userRes = await fetch("/api/users");
              const users = await userRes.json();
              const found = users.find((u: any) => u.email === parsedUser.email);
              if (found) parsedUser.id = found.id;
            }
            setCurrentUser(parsedUser);
            userId = parsedUser.id;
            bizId = parsedUser.businessId || null;
            setUserBusinessId(bizId);
          }
        }

        if (!userId) {
          toast.error("User not identified. Please login.");
          setLoading(false);
          return;
        }

        // 2. Fetch Settings, Routes, Suppliers in Parallel
        const [overrideData, customerCreateData, routesData, suppliersData, settingSuppliersData, invoiceRes] = await Promise.all([
          fetch("/api/settings/invoice-override").then((r) => r.json()).catch(() => ({ enabled: false })),
          fetch("/api/settings/rep-customer-creation").then((r) => r.json()).catch(() => ({ enabled: false })),
          fetch("/api/settings/categories?type=route").then((r) => r.json()).catch(() => []),
          fetch("/api/suppliers").then((r) => r.json()).catch(() => []),
          fetch("/api/settings/categories?type=supplier").then((r) => r.json()).catch(() => []),
          fetch(`/api/invoices/${id}`),
        ]);

        if (!invoiceRes.ok) {
          throw new Error("Failed to fetch invoice details");
        }
        const invoiceData = await invoiceRes.json();

        // Check if invoice order status is Pending
        if (invoiceData.orderStatus !== "Pending") {
          setIsNotPending(true);
          setLoading(false);
          return;
        }

        setInvoiceNo(invoiceData.manualInvoiceNo || invoiceData.invoiceNo);
        setCustomerId(invoiceData.customerId);
        setOrderDate(invoiceData.date);
        setExtraDiscount(invoiceData.extraDiscountPercent ? invoiceData.extraDiscountPercent.toString() : "");

        // Map items
        if (invoiceData.items) {
          setItems(
            invoiceData.items.map((item: any) => ({
              id: item.id || Math.random().toString(),
              productId: item.productId,
              sku: item.sku,
              productName: item.productName || item.name,
              quantity: item.quantity,
              freeQuantity: item.freeQuantity || 0,
              unit: item.unit || "unit",
              mrp: item.mrp || 0,
              unitPrice: item.unitPrice || 0,
              discountPercent: item.discountPercent || 0,
              discountAmount: item.discountAmount || 0,
              total: item.total || 0,
              supplier: item.supplier || "",
            }))
          );
        }

        const overrideEnabled = overrideData.enabled ?? false;
        setOutOfStockOverride(overrideEnabled);
        setCanCreateCustomer(customerCreateData.enabled ?? false);
        setRoutes(routesData.filter((r: any) => r.name));
        setSuppliers([...suppliersData, ...settingSuppliersData]);

        // 3. Fetch Products (Specific to Rep's Location)
        const stockUrl = overrideEnabled
          ? `/api/rep/stock?userId=${userId}&includeOutOfStock=true`
          : `/api/rep/stock?userId=${userId}`;
        const productsRes = await fetch(stockUrl);
        if (!productsRes.ok) throw new Error("Failed to load rep stock");
        const productsData = await productsRes.json();

        setProducts(
          productsData
            .filter((p: any) => p.subCategory !== "Retail Exclusive")
            .map((p: any) => ({
              id: p.id,
              sku: p.sku,
              name: p.name,
              selling_price: p.selling_price,
              mrp: p.mrp,
              stock_quantity: p.stock_quantity,
              unit_of_measure: p.unit_of_measure || "unit",
              supplier: p.supplier,
            }))
        );

        // 4. Fetch Customers — filtered to rep's own business
        const customersUrl = bizId
          ? `/api/customers?businessId=${bizId}`
          : "/api/customers";
        const customersRes = await fetch(customersUrl);
        const customersData = await customersRes.json();
        setCustomers(
          customersData.map((c: any) => ({ id: c.id, name: c.shopName, phone: c.phone || "", ownerName: c.ownerName || "" }))
        );
      } catch (error) {
        console.error("Error fetching data:", error);
        toast.error("Failed to load data");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id]);

  // --- Product Selection Handler ---
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
      supplier: product.supplier || "",
    });

    setProductOpen(false);
    setTimeout(() => qtyInputRef.current?.focus({ preventScroll: true }), 100);
  };

  // Enter key to add item quickly
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddItem();
    }
  };

  // --- Add Item to Order ---
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

    if (!outOfStockOverride) {
      const totalReqQty = qty + free;
      if (totalReqQty > currentItem.stockAvailable) {
        toast.error(`Insufficient stock! Available: ${currentItem.stockAvailable}`);
        return;
      }
    }

    const product = products.find((p) => p.id === currentItem.productId);
    if (!product) return;

    const grossTotal = currentItem.unitPrice * qty;
    const discountAmount = (grossTotal * discPerc) / 100;
    const netTotal = grossTotal - discountAmount;

    const newItem: OrderItem = {
      id: editingItemId || Date.now().toString(),
      productId: currentItem.productId,
      sku: product.sku,
      productName: product.name,
      unit: product.unit_of_measure,
      quantity: qty,
      freeQuantity: free,
      mrp: currentItem.mrp,
      unitPrice: currentItem.unitPrice,
      discountPercent: discPerc,
      discountAmount: discountAmount,
      total: netTotal,
      supplier: product.supplier,
    };

    if (editingItemId) {
      setItems(items.map((i) => i.id === editingItemId ? newItem : i));
      setEditingItemId(null);
      toast.success("Item updated");
    } else {
      setItems([...items, newItem]);
    }

    // Reset
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
      supplier: "",
    });
  };

  const handleRemoveItem = (id: string) => {
    setItems(items.filter((item) => item.id !== id));
    if (editingItemId === id) {
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
        supplier: "",
      });
    }
  };

  const handleEditItem = (item: OrderItem) => {
    setEditingItemId(item.id);
    const product = products.find((p) => p.id === item.productId);
    const currentStock = product ? product.stock_quantity : 0;

    setCurrentItem({
      productId: item.productId,
      sku: item.sku,
      quantity: item.quantity.toString(),
      freeQuantity: item.freeQuantity > 0 ? item.freeQuantity.toString() : "",
      unit: item.unit,
      mrp: item.mrp,
      unitPrice: item.unitPrice,
      discountPercent: item.discountPercent > 0 ? item.discountPercent.toString() : "",
      stockAvailable: currentStock + item.quantity + item.freeQuantity,
      supplier: item.supplier || "",
    });

    if (typeof window !== "undefined") {
      addProductCardRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }

    setTimeout(() => qtyInputRef.current?.focus({ preventScroll: true }), 100);
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
      supplier: "",
    });
  };


  // --- Create New Customer ---
  const handleCreateCustomer = async () => {
    if (!newCustomer.phone.trim() || newCustomer.phone.trim().length < 9) {
      toast.error("A valid phone number is required");
      return;
    }
    if (!newCustomer.shopName.trim()) {
      toast.error("Shop name is required");
      return;
    }
    if (!userBusinessId) {
      toast.error("Business ID not found — please re-login");
      return;
    }

    setCreatingCustomer(true);
    try {
      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shopName: newCustomer.shopName.trim(),
          ownerName: newCustomer.ownerName.trim() || undefined,
          phone: newCustomer.phone.trim(),
          email: newCustomer.email.trim() || undefined,
          address: newCustomer.address.trim() || undefined,
          route: newCustomer.route || "General",
          creditLimit: newCustomer.creditLimit || 0,
          businessId: userBusinessId,
          status: newCustomer.status,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create customer");

      const created = { id: data.data.id, name: newCustomer.shopName.trim() };
      setCustomers((prev) => [created, ...prev]);
      setCustomerId(created.id);
      setNewCustomerOpen(false);
      setNewCustomer({ shopName: "", ownerName: "", phone: "", email: "", address: "", route: "", creditLimit: 0, status: "Active" });
      toast.success(`Customer "${created.name}" created and selected`);
    } catch (err: any) {
      toast.error(err.message || "Failed to create customer");
    } finally {
      setCreatingCustomer(false);
    }
  };

  // --- Save Order Updates ---
  const handleSaveOrder = async () => {
    if (!customerId) {
      toast.error("Please select a customer.");
      return;
    }
    if (items.length === 0) {
      toast.error("Please add items to the order.");
      return;
    }
    if (!currentUser?.id) {
      toast.error("User session invalid. Please re-login.");
      return;
    }

    setSubmitting(true);
    setSubmitStep(1);

    const orderData = {
      customerId,
      salesRepId: currentUser.id,
      invoiceDate: orderDate,
      orderStatus: "Pending",
      items,
      subTotal: subtotal,
      extraDiscountPercent: extraDiscPercVal,
      extraDiscountAmount: extraDiscountAmount,
      grandTotal: grandTotal,
      notes: "Updated by sales representative",
      userId: currentUser.id,
      changeReason: "Representative edited pending invoice items",
    };

    try {
      await new Promise((r) => setTimeout(r, 600));
      setSubmitStep(2);

      const res = await fetch(`/api/invoices/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(orderData),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update invoice");

      setSubmitStep(3);
      await new Promise((r) => setTimeout(r, 1200));
      router.push(`/dashboard/rep/invoices/${id}`);
    } catch (error: any) {
      toast.error(error.message || "Failed to update invoice");
      setSubmitting(false);
      setSubmitStep(0);
    }
  };

  // --- Totals ---
  const subtotal = items.reduce((sum, item) => sum + item.total, 0);
  const totalItemDiscount = items.reduce((sum, item) => sum + item.discountAmount, 0);
  const grossTotal = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);

  const extraDiscPercVal = parseFloat(extraDiscount) || 0;
  const extraDiscountAmount = (subtotal * extraDiscPercVal) / 100;
  const grandTotal = Math.max(0, subtotal - extraDiscountAmount);

  const combinedSuppliers = React.useMemo(() => {
    const rawList = [...FIXED_SUPPLIERS, ...suppliers];
    const cleaned: { id: string; name: string }[] = [];
    const seen = new Set<string>();

    rawList.forEach((sup) => {
      const cleanName = getSupplierCleanName(sup.name);
      if (!seen.has(cleanName)) {
        seen.add(cleanName);
        cleaned.push({
          id: sup.id || cleanName,
          name: cleanName
        });
      }
    });
    return cleaned;
  }, [suppliers]);

  const availableProducts = products.filter(
    (p) => !items.some((i) => i.productId === p.id)
  );

  const filteredAvailableProducts = availableProducts.filter((product) => {
    if (supplierFilter === "all") return true;
    return product.supplier && getSupplierCleanName(product.supplier) === supplierFilter;
  });

  if (loading) {
    return (
      <div className="flex justify-center items-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isNotPending) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <AlertTriangle className="h-12 w-12 text-red-500" />
        <h2 className="text-xl font-bold">Access Denied</h2>
        <p className="text-muted-foreground text-sm text-center max-w-md">
          Only invoices with a <strong>Pending</strong> delivery status can be edited by sales representatives.
        </p>
        <Button onClick={() => router.push(`/dashboard/rep/invoices/${id}`)}>
          Go to Invoice Details
        </Button>
      </div>
    );
  }

  const currentTotal =
    (parseFloat(currentItem.quantity) || 0) * currentItem.unitPrice *
    (1 - (parseFloat(currentItem.discountPercent) || 0) / 100);

  return (
    <div className="space-y-4 mx-auto pb-28 lg:pb-6 w-full max-w-full min-w-0 overflow-x-hidden">

      {/* ── Page header ── */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0"
          onClick={() => router.push(`/dashboard/rep/invoices/${id}`)}
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight truncate">
            Edit Sales Order
          </h1>
          <p className="text-muted-foreground text-xs sm:text-sm mt-0.5">
            Modifying Invoice #{invoiceNo}
          </p>
        </div>
        {/* Desktop Save button — hidden on mobile */}
        <Button
          onClick={handleSaveOrder}
          disabled={items.length === 0 || submitting}
          className="hidden lg:flex bg-black hover:bg-gray-800 text-white shrink-0"
        >
          <Save className="w-4 h-4 mr-2" />
          Update Invoice
        </Button>
      </div>

      <div className="grid gap-4 sm:gap-6 lg:grid-cols-3 w-full max-w-full min-w-0">

        {/* ── LEFT COLUMN ── */}
        <div className="lg:col-span-2 space-y-4 sm:space-y-6 w-full min-w-0">

          {/* 1. Customer Details */}
          <Card className="w-full min-w-0 overflow-hidden">
            <CardHeader className="pb-1 sm:pb-2">
              <CardTitle className="text-base sm:text-lg">Customer Details</CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                Select the customer for this order
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 sm:space-y-4">

              {/* Customer + Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs sm:text-sm">Customer</Label>
                    {canCreateCustomer && (
                      <button
                        type="button"
                        onClick={() => setNewCustomerOpen(true)}
                        className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium"
                      >
                        <UserPlus className="h-3.5 w-3.5" />
                        New Customer
                      </button>
                    )}
                  </div>
                  <Popover open={customerOpen} onOpenChange={setCustomerOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={customerOpen}
                        className="w-full justify-between text-sm"
                      >
                        <span className="truncate">
                          {customerId
                            ? customers.find((c) => c.id === customerId)?.name
                            : "Select Customer"}
                        </span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      className="w-[var(--radix-popover-trigger-width)] p-0"
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
                                value={`${customer.name} ${customer.phone || ""} ${customer.ownerName || ""}`}
                                onSelect={() => {
                                  setCustomerId(customer.id);
                                  setCustomerOpen(false);
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4 shrink-0",
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
                  <Label className="text-xs sm:text-sm">Order Date</Label>
                  <Input
                    type="date"
                    value={orderDate}
                    onChange={(e) => setOrderDate(e.target.value)}
                    className="text-sm"
                  />
                </div>
              </div>

              {/* Rep info row */}
              <div className="grid grid-cols-2 gap-3 sm:gap-4 pt-1">
                <div className="flex items-center gap-2 sm:gap-3 p-2 sm:p-3 rounded-md border bg-muted/20">
                  <User className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground shrink-0" />
                  <div className="flex flex-col min-w-0">
                    <span className="text-[10px] sm:text-xs text-muted-foreground uppercase">
                      Sales Rep
                    </span>
                    <span className="font-medium text-xs sm:text-sm truncate">
                      {currentUser ? currentUser.name : "Loading..."}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 sm:gap-3 p-2 sm:p-3 rounded-md border bg-muted/20">
                  <Package className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground shrink-0" />
                  <div className="flex flex-col min-w-0">
                    <span className="text-[10px] sm:text-xs text-muted-foreground uppercase">
                      Status
                    </span>
                    <span className="font-medium text-xs sm:text-sm text-yellow-600 truncate">
                      Pending
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 2. Add Products */}
          <div ref={addProductCardRef} className="scroll-mt-4 w-full">
            <Card className={cn("w-full min-w-0 overflow-hidden transition-all", editingItemId ? "border-blue-500 border-2" : "")}>
              <CardHeader className="pb-1 sm:pb-2">
                <CardTitle className="text-base sm:text-lg">
                  {editingItemId ? "Edit Item" : "Add Products"}
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm">
                  {editingItemId
                    ? "Update item details, then click Update Item"
                    : outOfStockOverride
                    ? "All items available — including out-of-stock products"
                    : "Search and add products to the order"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 sm:space-y-4">

                {/* Product search */}
                <div className="space-y-2">
                  <Label className="text-xs sm:text-sm">Product</Label>

                  {/* Supplier Filter Buttons Row */}
                  {combinedSuppliers.length > 0 && (
                    <div className={cn("flex flex-row flex-nowrap items-center overflow-x-auto gap-2 pb-2 border-b border-slate-100 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]", editingItemId && "opacity-50 pointer-events-none")}>
                      <Button
                        type="button"
                        variant={supplierFilter === "all" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setSupplierFilter("all")}
                        disabled={editingItemId !== null}
                        className={cn(
                          "h-8 text-xs font-semibold rounded-full shrink-0 transition-all duration-200",
                          supplierFilter === "all"
                            ? "bg-slate-900 text-white shadow-sm hover:bg-slate-800"
                            : "border-gray-200 text-gray-700 bg-white hover:bg-gray-50"
                        )}
                      >
                        🌐 All Products
                      </Button>
                      {combinedSuppliers.map((sup) => {
                        const styles = getSupplierColorStyles(sup.name);
                        const isSelected = supplierFilter === sup.name;
                        return (
                          <Button
                            key={sup.id || sup.name}
                            type="button"
                            variant={isSelected ? "default" : "outline"}
                            size="sm"
                            onClick={() => setSupplierFilter(sup.name)}
                            disabled={editingItemId !== null}
                            className={cn(
                              "h-8 text-xs font-semibold rounded-full shrink-0 transition-all duration-200",
                              isSelected ? styles.bgActive : cn("bg-white", styles.borderInactive)
                            )}
                          >
                            {styles.dot} {getSupplierCleanName(sup.name)}
                          </Button>
                        );
                      })}
                    </div>
                  )}

                  <Popover
                    open={productOpen}
                    onOpenChange={(open) => {
                      if (editingItemId) return;
                      setProductOpen(open);
                      if (open && typeof window !== "undefined" && window.innerWidth < 1024) {
                        addProductCardRef.current?.scrollIntoView({
                          behavior: "smooth",
                          block: "start",
                        });
                      }
                    }}
                  >
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={productOpen}
                        disabled={editingItemId !== null}
                        className="w-full justify-between text-sm"
                      >
                        <span className="truncate">
                          {currentItem.productId
                            ? products.find((p) => p.id === currentItem.productId)?.name
                            : "Select Product"}
                        </span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      className="w-[var(--radix-popover-trigger-width)] p-0"
                      align="start"
                    >
                      <Command>
                        <CommandInput placeholder="Search product by name or SKU..." />
                        <CommandList>
                          <CommandEmpty>
                            {filteredAvailableProducts.length === 0
                              ? "No products found for this supplier"
                              : "No product found in your stock."}
                          </CommandEmpty>
                          <CommandGroup>
                            {filteredAvailableProducts.map((product) => {
                              const styles = product.supplier ? getSupplierColorStyles(product.supplier) : null;
                              return (
                                <CommandItem
                                  key={product.id}
                                  value={`${product.name} ${product.sku} ${product.supplier || ""}`}
                                  onSelect={() => handleProductSelect(product.id)}
                                  className={cn(
                                    "flex items-center px-3 py-2 cursor-pointer transition-colors duration-150",
                                    product.supplier && cn("border-l-4", styles?.borderLeft)
                                  )}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4 shrink-0",
                                      currentItem.productId === product.id
                                        ? "opacity-100"
                                        : "opacity-0"
                                    )}
                                  />
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between gap-2">
                                      <span className="font-semibold text-slate-900 truncate">
                                        {product.name}
                                      </span>
                                      {product.supplier && (
                                        <span className={cn(
                                          "text-[9px] font-bold px-2 py-0.5 rounded-full border shrink-0",
                                          styles?.badge
                                        )}>
                                          {getSupplierCleanName(product.supplier)}
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-xs text-muted-foreground flex flex-wrap gap-x-2 gap-y-0.5 mt-0.5 font-sans">
                                      <span className="font-mono">{product.sku}</span>
                                      <span>•</span>
                                      <span>Stock: <strong className={cn(product.stock_quantity === 0 ? "text-red-500 font-bold" : "text-slate-700")}>{product.stock_quantity}</strong></span>
                                      <span>•</span>
                                      <span>LKR {product.selling_price.toLocaleString()}</span>
                                    </div>
                                  </div>
                                </CommandItem>
                              );
                            })}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Qty / Free / Unit / Stock — 2 cols on mobile, 4 on md+ */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs sm:text-sm">Quantity</Label>
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
                      className="text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs sm:text-sm">Free Qty</Label>
                    <Input
                      type="number"
                      min="0"
                      placeholder="0"
                      value={currentItem.freeQuantity}
                      onChange={(e) =>
                        setCurrentItem({ ...currentItem, freeQuantity: e.target.value })
                      }
                      onKeyDown={handleKeyDown}
                      className="text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs sm:text-sm">Unit</Label>
                    <Input
                      value={currentItem.unit || "-"}
                      disabled
                      className="bg-muted text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs sm:text-sm">Stock</Label>
                    <Input
                      value={currentItem.productId ? currentItem.stockAvailable : "-"}
                      disabled
                      className={cn(
                        "text-sm",
                        !outOfStockOverride &&
                        currentItem.stockAvailable > 0 &&
                        currentItem.stockAvailable < 10
                          ? "text-destructive font-bold bg-muted"
                          : "bg-muted"
                      )}
                    />
                  </div>
                </div>

                {/* MRP / Unit Price / Discount / Total — 2 cols on mobile, 4 on md+ */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs sm:text-sm">MRP</Label>
                    <Input
                      type="number"
                      value={currentItem.mrp || ""}
                      onChange={(e) =>
                        setCurrentItem({ ...currentItem, mrp: Number(e.target.value) })
                      }
                      onKeyDown={handleKeyDown}
                      placeholder="0.00"
                      className="text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs sm:text-sm">Unit Price</Label>
                    <Input
                      type="number"
                      value={currentItem.unitPrice || ""}
                      onChange={(e) =>
                        setCurrentItem({ ...currentItem, unitPrice: Number(e.target.value) })
                      }
                      onKeyDown={handleKeyDown}
                      placeholder="0.00"
                      className="text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs sm:text-sm">Disc %</Label>
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
                      className="text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs sm:text-sm">Total</Label>
                    <Input
                      value={currentTotal.toFixed(2)}
                      disabled
                      className="font-bold bg-muted text-sm"
                    />
                  </div>
                </div>

              <div className="flex gap-2">
                {editingItemId && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCancelEdit}
                  >
                    Cancel
                  </Button>
                )}
                <Button
                  onClick={handleAddItem}
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                  disabled={!currentItem.productId}
                >
                  {editingItemId ? (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Update Item
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4 mr-2" />
                      Add to Order
                    </>
                  )}
                </Button>
              </div>
              </CardContent>
            </Card>
          </div>

          {/* 3. Order Items */}
          <Card className="w-full min-w-0 overflow-hidden">
            <CardHeader className="pb-1 sm:pb-2">
              <CardTitle className="text-base sm:text-lg">Order Items</CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                {items.length} item(s) added
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0 sm:p-6 sm:pt-0">

              {/* ── Mobile card list (hidden on sm+) ── */}
              <div className="sm:hidden divide-y">
                {items.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                    <Package className="w-8 h-8 mb-2 opacity-40" />
                    <p className="text-sm">No items added yet</p>
                  </div>
                ) : (
                  items.map((item, idx) => {
                    const styles = item.supplier ? getSupplierColorStyles(item.supplier) : null;
                    return (
                      <div key={item.id} className={cn("flex items-start gap-3 px-4 py-3", item.supplier && cn("border-l-4", styles?.borderLeft))}>
                        <span className="text-xs text-muted-foreground pt-0.5 w-5 shrink-0">
                          {idx + 1}
                        </span>
                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className="font-medium text-sm leading-tight truncate">
                              {item.productName}
                            </p>
                            {item.supplier && (
                              <span className={cn(
                                "text-[8px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider",
                                styles?.badge
                              )}>
                                {getSupplierCleanName(item.supplier)}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">{item.sku}</p>
                          <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                            <span>Qty: <span className="text-foreground font-medium">{item.quantity} {item.unit}</span></span>
                            {item.freeQuantity > 0 && (
                              <span>Free: <span className="text-foreground font-medium">{item.freeQuantity}</span></span>
                            )}
                            <span>Price: <span className="text-foreground font-medium">LKR {item.unitPrice.toLocaleString()}</span></span>
                            {item.discountPercent > 0 && (
                              <span>Disc: <span className="text-foreground font-medium">{item.discountPercent}%</span></span>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <span className="font-bold text-sm">
                            LKR {item.total.toLocaleString()}
                          </span>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              disabled={editingItemId !== null}
                              onClick={() => handleEditItem(item)}
                            >
                              <Pencil className="w-3.5 h-3.5 text-blue-500" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              disabled={editingItemId !== null}
                              onClick={() => handleRemoveItem(item.id)}
                            >
                              <Trash2 className="w-3.5 h-3.5 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* ── Desktop table (hidden on mobile) ── */}
              <div className="hidden sm:block border rounded-md overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">#</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead className="text-center w-20">Qty</TableHead>
                      <TableHead className="text-center w-16">Free</TableHead>
                      <TableHead className="text-right w-24">Unit Price</TableHead>
                      <TableHead className="text-center w-16">Disc%</TableHead>
                      <TableHead className="text-right w-28">Total</TableHead>
                      <TableHead className="w-10"></TableHead>
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
                        const styles = item.supplier ? getSupplierColorStyles(item.supplier) : null;
                        return (
                          <TableRow key={item.id} className={cn(item.supplier && cn("border-l-4", styles?.borderLeft), editingItemId === item.id && "bg-blue-50/50")}>
                            <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                            <TableCell>
                              <div className="flex items-center flex-wrap gap-1.5">
                                <span className="font-medium text-slate-900">{item.productName}</span>
                                {item.supplier && (
                                  <span className={cn(
                                    "text-[9px] font-bold px-2 py-0.5 rounded-full border",
                                    styles?.badge
                                  )}>
                                    {getSupplierCleanName(item.supplier)}
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
                              {item.unitPrice.toLocaleString()}
                            </TableCell>
                            <TableCell className="text-center">
                              {item.discountPercent > 0
                                ? `${item.discountPercent}%`
                                : "-"}
                            </TableCell>
                            <TableCell className="text-right font-bold">
                              {item.total.toLocaleString()}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1 justify-end">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  disabled={editingItemId !== null}
                                  onClick={() => handleEditItem(item)}
                                >
                                  <Pencil className="w-4 h-4 text-blue-500" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  disabled={editingItemId !== null}
                                  onClick={() => handleRemoveItem(item.id)}
                                >
                                  <Trash2 className="w-4 h-4 text-destructive" />
                                </Button>
                              </div>
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

        {/* ── RIGHT COLUMN — Summary (desktop sidebar) ── */}
        <div className="lg:col-span-1 hidden lg:block">
          <Card className="sticky top-6">
            <CardHeader>
              <CardTitle>Order Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Customer:</span>
                  <span className="font-medium truncate ml-2 text-right">
                    {customers.find((c) => c.id === customerId)?.name || "-"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Date:</span>
                  <span className="font-medium">{orderDate}</span>
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
                  <span className="text-2xl font-bold text-primary">
                    LKR {grandTotal.toLocaleString()}
                  </span>
                </div>
              </div>

              <Button
                onClick={handleSaveOrder}
                disabled={items.length === 0 || submitting}
                className="w-full bg-black hover:bg-gray-800 text-white mt-2"
              >
                <Save className="w-4 h-4 mr-2" />
                Update Invoice
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── Mobile / Tablet sticky bottom bar ── */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t shadow-lg px-4 py-3 safe-area-inset-bottom">
        <div className="flex items-center gap-3 max-w-2xl mx-auto">
          {/* Mini totals */}
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-1.5">
              <span className="text-xs text-muted-foreground">Total</span>
              <span className="font-bold text-base text-primary truncate">
                LKR {grandTotal.toLocaleString()}
              </span>
            </div>
            <div className="flex gap-2 text-xs text-muted-foreground">
              <span>{items.length} item{items.length !== 1 ? "s" : ""}</span>
              {extraDiscountAmount > 0 && (
                <span>· Disc: LKR {extraDiscountAmount.toLocaleString()}</span>
              )}
            </div>
          </div>

          {/* Extra discount quick input */}
          <div className="flex items-center gap-1.5 shrink-0">
            <Label className="text-xs text-muted-foreground whitespace-nowrap">
              Extra %
            </Label>
            <Input
              type="number"
              min="0"
              max="100"
              placeholder="0"
              value={extraDiscount}
              onChange={(e) => setExtraDiscount(e.target.value)}
              className="w-16 h-9 text-sm text-center"
            />
          </div>

          {/* Place Order */}
          <Button
            onClick={handleSaveOrder}
            disabled={items.length === 0 || submitting}
            className="bg-black hover:bg-gray-800 text-white shrink-0"
          >
            <Save className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">Update Invoice</span>
          </Button>
        </div>
      </div>

      {/* New Customer Dialog */}
      <Dialog open={newCustomerOpen} onOpenChange={setNewCustomerOpen}>
        <DialogContent className="w-[95vw] max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle>Add New Customer</DialogTitle>
            <DialogDescription>
              Enter new customer information below.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 py-4">
            {/* Shop Name */}
            <div className="sm:col-span-2 space-y-2">
              <Label>Shop Name *</Label>
              <Input
                value={newCustomer.shopName}
                onChange={(e) => setNewCustomer({ ...newCustomer, shopName: e.target.value })}
                placeholder="e.g. Singer Plus - Galle"
              />
            </div>

            {/* Owner / Phone */}
            <div className="space-y-2">
              <Label>Owner / Contact Person</Label>
              <Input
                value={newCustomer.ownerName}
                onChange={(e) => setNewCustomer({ ...newCustomer, ownerName: e.target.value })}
                placeholder="e.g. Mr. Perera"
              />
            </div>
            <div className="space-y-2">
              <Label>Phone Number *</Label>
              <Input
                value={newCustomer.phone}
                onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                placeholder="077xxxxxxx"
              />
            </div>

            {/* Email */}
            <div className="sm:col-span-2 space-y-2">
              <Label>Email (Optional)</Label>
              <Input
                value={newCustomer.email}
                onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })}
                placeholder="email@example.com"
              />
            </div>

            {/* Address */}
            <div className="sm:col-span-2 space-y-2">
              <Label>Address</Label>
              <Input
                value={newCustomer.address}
                onChange={(e) => setNewCustomer({ ...newCustomer, address: e.target.value })}
                placeholder="Full Street address"
              />
            </div>

            {/* Route */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1">
                <MapPin className="w-3 h-3" /> Route / Area *
              </Label>
              <Select
                value={newCustomer.route}
                onValueChange={(v) => setNewCustomer({ ...newCustomer, route: v })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select Route" />
                </SelectTrigger>
                <SelectContent>
                  {routes.length === 0 && (
                    <SelectItem value="General">General (Default)</SelectItem>
                  )}
                  {routes.map((r) => (
                    <SelectItem key={r.id} value={r.name}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Credit Limit */}
            <div className="space-y-2">
              <Label>Credit Limit (LKR)</Label>
              <Input
                type="number"
                min="0"
                value={newCustomer.creditLimit}
                onChange={(e) =>
                  setNewCustomer({
                    ...newCustomer,
                    creditLimit: parseFloat(e.target.value) || 0,
                  })
                }
              />
            </div>

            {/* Status */}
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={newCustomer.status}
                onValueChange={(v) => setNewCustomer({ ...newCustomer, status: v })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Inactive">Inactive</SelectItem>
                  <SelectItem value="Blocked">Blocked</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="flex-row gap-2 sm:flex-row">
            <Button
              variant="outline"
              onClick={() => setNewCustomerOpen(false)}
              disabled={creatingCustomer}
              className="flex-1 sm:flex-none"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateCustomer}
              disabled={creatingCustomer}
              className="flex-1 sm:flex-none bg-black hover:bg-gray-800 text-white"
            >
              {creatingCustomer && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Add Customer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Submitting overlay ── */}
      {submitting && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-sm w-full shadow-2xl flex flex-col items-center text-center space-y-4 animate-in fade-in zoom-in duration-200">
            <div className="h-16 w-16 rounded-full bg-blue-50 flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-slate-900">
                {submitStep === 1
                  ? "Validating stock..."
                  : submitStep === 2
                  ? "Updating invoice..."
                  : "Completed!"}
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                {submitStep === 1
                  ? "Please wait while we check item availability"
                  : submitStep === 2
                  ? "Reverting old stock and saving new invoice data"
                  : "Invoice updated successfully! Redirecting..."}
              </p>
            </div>

            {/* Progress dots indicator */}
            <div className="flex gap-1.5 pt-2">
              {[0, 1, 2].map((i) => {
                const active = submitStep > i;
                return (
                  <div
                    key={i}
                    className={cn(
                      "h-1.5 w-1.5 rounded-full transition-all duration-300",
                      active ? "bg-blue-600 scale-125" : "bg-slate-200"
                    )}
                  />
                );
              })}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
