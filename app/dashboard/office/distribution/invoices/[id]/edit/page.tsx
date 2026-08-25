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
  KeyRound,
  Lock,
  Unlock,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Send,
  QrCode,
  Smartphone,
  Copy,
  ExternalLink,
} from "lucide-react";
import QRCode from "qrcode";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  retail_price?: number | null;
  retailOnly?: boolean;
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
  retailOnly?: boolean;
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
  return_type?: "Good" | "Damage" | "Exchange";
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
  const [outOfStockOverride, setOutOfStockOverride] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);

  // Data State
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<{ id: string; name: string; phone?: string; ownerName?: string; }[]>([]);
  const [reps, setReps] = useState<{ id: string; name: string; phone?: string; ownerName?: string; }[]>([]);
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
  const [paymentMethod, setPaymentMethod] = useState<string>("");
  const [cashDiscount, setCashDiscount] = useState<string>("");
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

  // Unlock state
  const [unlockedToken, setUnlockedToken] = useState<string | null>(null);
  const [unlockModalOpen, setUnlockModalOpen] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [unlockReason, setUnlockReason] = useState("");
  const [unlocking, setUnlocking] = useState(false);
  const [pendingRequestId, setPendingRequestId] = useState<string | null>(null);
  const [requestStatus, setRequestStatus] = useState<"none" | "pending" | "approved" | "rejected">("none");
  const [activeTab, setActiveTab] = useState<"pin" | "request" | "qr">("pin");

  // Option 3: Mobile QR states
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [qrUnlockUrl, setQrUnlockUrl] = useState<string>("");
  const [generatingQr, setGeneratingQr] = useState(false);

  // Read-only logic
  const lockedStatuses = ["Loading", "In Transit", "Delivered", "Completed", "Cancelled"];
  const isStatusLocked = lockedStatuses.includes(orderStatus);
  const isAdmin = currentUserRole === "admin";
  const isUnlockedByToken = !!unlockedToken;
  const isReadOnly = isStatusLocked && !isFromReconciliation && !isAdmin && !isUnlockedByToken;

  const handleBack = () => {
    if (returnTo) {
      router.push(returnTo);
    } else {
      router.push("/dashboard/office/distribution/invoices");
    }
  };

  // Auto-poll approval request if pending
  useEffect(() => {
    if (!pendingRequestId || requestStatus !== "pending") return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/invoices/${id}/unlock?requestId=${pendingRequestId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.status === "approved" && data.unlockToken) {
            setUnlockedToken(data.unlockToken);
            setRequestStatus("approved");
            setUnlockModalOpen(false);
            toast.success("Admin approved your unlock request! Invoice is now editable.");
          } else if (data.status === "rejected") {
            setRequestStatus("rejected");
            toast.error("Admin rejected your unlock request.");
          }
        }
      } catch (err) {
        console.error("Polling error:", err);
      }
    }, 4000);
    return () => clearInterval(interval);
  }, [pendingRequestId, requestStatus, id]);

  // Handle Instant PIN verification
  const handleVerifyPin = async () => {
    if (!pinInput.trim()) {
      toast.error("Please enter the Admin Passcode / PIN");
      return;
    }
    if (!unlockReason.trim()) {
      toast.error("Please provide a reason for editing");
      return;
    }

    setUnlocking(true);
    try {
      let userId = "";
      let userName = "";
      if (typeof window !== "undefined") {
        const userStr = localStorage.getItem("currentUser");
        if (userStr) {
          const parsed = JSON.parse(userStr);
          userId = parsed.id;
          userName = parsed.fullName || parsed.name || "";
        }
      }

      const res = await fetch(`/api/invoices/${id}/unlock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "verify_pin",
          pin: pinInput,
          reason: unlockReason,
          userId,
          userName,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to verify PIN");

      setUnlockedToken(data.unlockToken);
      setUnlockModalOpen(false);
      setPinInput("");
      if (!editReason) setEditReason(unlockReason);
      toast.success("One-Time Edit Access Granted!");
    } catch (error: any) {
      toast.error(error.message || "Failed to unlock invoice");
    } finally {
      setUnlocking(false);
    }
  };

  // Handle Request Admin Approval
  const handleSendUnlockRequest = async () => {
    if (!unlockReason.trim()) {
      toast.error("Please enter a reason for requesting edit access");
      return;
    }

    setUnlocking(true);
    try {
      let userId = "";
      let userName = "";
      if (typeof window !== "undefined") {
        const userStr = localStorage.getItem("currentUser");
        if (userStr) {
          const parsed = JSON.parse(userStr);
          userId = parsed.id;
          userName = parsed.fullName || parsed.name || "";
        }
      }

      const res = await fetch(`/api/invoices/${id}/unlock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "request_approval",
          reason: unlockReason,
          userId,
          userName,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to submit request");

      setPendingRequestId(data.requestId);
      setRequestStatus("pending");
      if (!editReason) setEditReason(unlockReason);
      toast.success("Unlock request sent to Admin! Auto-checking approval status...");
    } catch (error: any) {
      toast.error(error.message || "Failed to submit request");
    } finally {
      setUnlocking(false);
    }
  };

  // Option 3: Generate Mobile QR Code
  const handleGenerateQrCode = async () => {
    if (!unlockReason.trim()) {
      toast.error("Please enter a reason for editing before generating QR Code");
      return;
    }

    setGeneratingQr(true);
    try {
      let userId = "";
      let userName = "";
      if (typeof window !== "undefined") {
        const userStr = localStorage.getItem("currentUser");
        if (userStr) {
          const parsed = JSON.parse(userStr);
          userId = parsed.id;
          userName = parsed.fullName || parsed.name || "";
        }
      }

      const res = await fetch(`/api/invoices/${id}/unlock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "request_approval",
          reason: unlockReason.trim(),
          userId,
          userName,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create QR session");

      const unlockUrl = `${window.location.origin}/unlock-invoice/${data.requestId}`;
      const qrData = await QRCode.toDataURL(unlockUrl, { margin: 1, width: 220 });

      setQrUnlockUrl(unlockUrl);
      setQrDataUrl(qrData);
      setPendingRequestId(data.requestId);
      setRequestStatus("pending");
      if (!editReason) setEditReason(unlockReason);
      toast.success("QR Code generated! Scan with phone camera to authorize.");
    } catch (err: any) {
      toast.error(err.message || "Failed to generate QR Code");
    } finally {
      setGeneratingQr(false);
    }
  };

  // --- 1. Fetch Invoice & Reference Data ---
  useEffect(() => {
    const fetchInitialData = async () => {
      setLoading(true);
      try {
        const user = getUserBusinessContext();
        if (user) setCurrentUserRole(user.role);

        const [custRes, usersRes, invRes, retRes, overrideRes] = await Promise.all([
          fetch(`/api/customers?businessId=${distributionBusinessId}`),
          fetch("/api/users"),
          fetch(`/api/invoices/${id}`),
          fetch(`/api/invoices/${id}/returns`),
          fetch("/api/settings/portal-stock-override").catch(() => null),
        ]);

        if (overrideRes?.ok) {
          const overrideData = await overrideRes.json();
          setOutOfStockOverride(overrideData.distribution ?? false);
        }

        const custData = await custRes.json();
        setCustomers(custData.map((c: any) => ({ id: c.id, name: c.shopName, phone: c.phone || "", ownerName: c.ownerName || "" })));

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
          retailOnly: item.retailOnly || item.retail_only || false,
        }));
        setItems(mappedItems);

        const extraDiscPercent = invoice.extraDiscountPercent || 0;
        setExtraDiscount(extraDiscPercent > 0 ? String(extraDiscPercent) : "");

        const rawNotes = invoice.notes || "";
        let pm = "";
        let cdPerc = "";
        const pmMatch = rawNotes.match(/\[PAYMENT_METHOD:([^\]]+)\]/);
        if (pmMatch) pm = pmMatch[1];
        const cdMatch = rawNotes.match(/\[CASH_DISCOUNT_PERCENT:([\d.]+)\]/);
        if (cdMatch) cdPerc = cdMatch[1];

        setPaymentMethod(pm || invoice.paymentMethod || "");
        setCashDiscount(cdPerc || (invoice.cashDiscountPercent ? String(invoice.cashDiscountPercent) : ""));
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

  // --- 2. Fetch Products: all items when override ON, rep stock when override OFF ---
  useEffect(() => {
    const fetchProducts = async () => {
      const allowRetailRes = await fetch("/api/settings/distribution-retail-items").catch(() => null);
      let allowRetail = false;
      if (allowRetailRes?.ok) {
        const rd = await allowRetailRes.json();
        allowRetail = rd.enabled ?? false;
      }

      if (outOfStockOverride) {
        setStockLoading(true);
        try {
          const res = await fetch("/api/products?active=true");
          if (!res.ok) throw new Error("Failed to load products");
          const data = await res.json();
          setProducts(
            data
              .filter((p: any) => allowRetail || (p.subCategory !== "Retail Exclusive" && !p.retailOnly && !p.retail_only))
              .map((p: any) => ({
                id: p.id,
                sku: p.sku || "N/A",
                name: p.name,
                selling_price: p.sellingPrice || 0,
                retail_price: p.retailPrice ?? p.retail_price ?? null,
                retailOnly: p.retailOnly ?? p.retail_only ?? (p.subCategory === "Retail Exclusive"),
                mrp: p.mrp || 0,
                stock_quantity: p.stock || 0,
                unit_of_measure: p.unitOfMeasure || "unit",
              }))
          );
        } catch (error) {
          toast.error("Failed to load products");
          setProducts([]);
        } finally {
          setStockLoading(false);
        }
        return;
      }

      if (!salesRepId) {
        setProducts([]);
        return;
      }

      setStockLoading(true);
      try {
        const res = await fetch(`/api/rep/stock?userId=${salesRepId}&businessId=${distributionBusinessId}`);
        if (!res.ok) throw new Error("Failed to load stock");
        const data = await res.json();
        setProducts(
          data
            .filter((p: any) => allowRetail || (p.subCategory !== "Retail Exclusive" && !p.retailOnly && !p.retail_only))
            .map((p: any) => ({
              id: p.id,
              sku: p.sku || "N/A",
              name: p.name,
              selling_price: p.sellingPrice || p.selling_price || 0,
              retail_price: p.retailPrice ?? p.retail_price ?? null,
              retailOnly: p.retailOnly ?? p.retail_only ?? (p.subCategory === "Retail Exclusive"),
              mrp: p.mrp || 0,
              stock_quantity: p.stock || p.stock_quantity || 0,
              unit_of_measure: p.unit || p.unit_of_measure || "unit",
            }))
        );
      } catch (error) {
        toast.error("Failed to load products for this representative");
        setProducts([]);
      } finally {
        setStockLoading(false);
      }
    };

    fetchProducts();
  }, [salesRepId, outOfStockOverride, distributionBusinessId]);

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

    const defaultUnitPrice = (product.retailOnly || product.retail_price)
      ? (product.retail_price || product.selling_price)
      : product.selling_price;

    setCurrentItem({
      productId: product.id,
      sku: product.sku,
      quantity: "",
      freeQuantity: "",
      unit: product.unit_of_measure,
      mrp: product.mrp,
      unitPrice: defaultUnitPrice,
      discountPercent: "",
      stockAvailable: product.stock_quantity + bonusStock,
    });

    setProductOpen(false);
    setTimeout(() => qtyInputRef.current?.focus({ preventScroll: true }), 100);
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
    if (!outOfStockOverride && qty + free > currentItem.stockAvailable) {
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
      retailOnly: product?.retailOnly,
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
  const refundTotal = returns.reduce((acc, r) => {
    if ((r.return_type || "Exchange") === "Exchange") return acc;
    return acc + r.quantity * (r.products?.selling_price || 0);
  }, 0);
  const cashDiscountAmount = paymentMethod === "Cash & Discount" ? (subtotal * (parseFloat(cashDiscount) || 0)) / 100 : 0;
  const totalDiff = (subtotal * (parseFloat(extraDiscount) || 0)) / 100;
  const extraDiscountAmount = Math.max(0, totalDiff - cashDiscountAmount);
  const extraDiscPercVal = subtotal > 0 ? (extraDiscountAmount / subtotal) * 100 : 0;
  const grandTotal = Math.max(0, subtotal - (cashDiscountAmount + extraDiscountAmount) - refundTotal);

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
    if (!paymentMethod) {
      toast.error("Please select a payment method / payment terms.");
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
      paymentMethod,
      cashDiscountPercent: paymentMethod === "Cash & Discount" ? (parseFloat(cashDiscount) || 0) : 0,
      cashDiscountAmount: paymentMethod === "Cash & Discount" ? cashDiscountAmount : 0,
      items,
      grandTotal,
      extraDiscountPercent: extraDiscPercVal,
      extraDiscountAmount,
      isDraft: asDraft,
      userId,
      changeReason: editReason || (asDraft ? "Saved as Draft" : "Updated Invoice"),
      unlockToken: unlockedToken || undefined,
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
              {isUnlockedByToken && (
                <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1 shadow-sm">
                  <ShieldCheck className="w-3.5 h-3.5" /> One-Time Edit Access Active
                </Badge>
              )}
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

      {/* Out-of-stock override banner */}
      {outOfStockOverride && !isReadOnly && (
        <div className="flex items-start gap-2 bg-orange-50 border border-orange-300 rounded-lg px-4 py-3 text-sm text-orange-800">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-orange-500" />
          <span>
            <strong>Out-of-stock override is active:</strong> Products with 0 stock are visible and can be added to the invoice.
          </span>
        </div>
      )}

      {/* Read Only Warning & One-Time Unlock Option */}
      {isReadOnly && (
        <div className="bg-amber-50 border border-amber-300 text-amber-900 p-4 rounded-lg flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="bg-amber-200/80 p-2 rounded-full text-amber-800 shrink-0">
              <Lock className="h-5 w-5" />
            </div>
            <div>
              <p className="font-bold text-sm text-amber-950 flex items-center gap-1.5">
                Invoice Locked ({orderStatus})
              </p>
              <p className="text-xs text-amber-800">
                This invoice is in {orderStatus} status and cannot be edited directly. Authorize a one-time edit using Admin Passcode or Request Admin Approval.
              </p>
            </div>
          </div>
          <Button
            onClick={() => setUnlockModalOpen(true)}
            className="bg-amber-700 hover:bg-amber-800 text-white font-medium shrink-0 flex items-center gap-2 shadow-xs"
          >
            <KeyRound className="w-4 h-4" />
            Unlock for One-Time Edit
          </Button>
        </div>
      )}

      {/* Active One-Time Edit Banner */}
      {isUnlockedByToken && (
        <div className="bg-emerald-50 border border-emerald-300 text-emerald-900 p-3.5 rounded-lg flex items-center gap-3 shadow-xs">
          <ShieldCheck className="h-5 w-5 text-emerald-600 shrink-0" />
          <div className="text-xs">
            <strong className="text-emerald-950">One-Time Edit Mode Granted:</strong> You have temporary edit permission for this session. Changes will be locked again upon saving.
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
                                value={`${customer.name} ${customer.phone || ""} ${customer.ownerName || ""}`}
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

              {/* Order Status & Payment Terms (Same Line) */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Order Status</Label>
                  <Select
                    value={orderStatus}
                    onValueChange={setOrderStatus}
                    disabled={isReadOnly}
                  >
                    <SelectTrigger className="w-full">
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

                <div className="space-y-2">
                  <Label>Payment Method / Credit Terms</Label>
                  <Select
                    value={paymentMethod}
                    onValueChange={(val) => {
                      setPaymentMethod(val);
                      if (val !== "Cash & Discount") setCashDiscount("");
                    }}
                    disabled={isReadOnly}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select Payment Terms" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Cash Only">Cash Only</SelectItem>
                      <SelectItem value="Cash & Discount">Cash & Discount</SelectItem>
                      <SelectItem value="15 Days Credit">15 Days Credit</SelectItem>
                      <SelectItem value="30 Days Credit">30 Days Credit</SelectItem>
                      <SelectItem value="45 Days Credit">45 Days Credit</SelectItem>
                      <SelectItem value="60 Days Credit">60 Days Credit</SelectItem>
                      <SelectItem value="Cheque">Cheque</SelectItem>
                      <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
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
                        disabled={(!salesRepId && !outOfStockOverride) || stockLoading || isReadOnly || !!editingItemId}
                      >
                        {currentItem.productId
                          ? products.find((p) => p.id === currentItem.productId)?.name
                          : stockLoading
                          ? "Loading products..."
                          : (!salesRepId && !outOfStockOverride)
                          ? "Select Representative First"
                          : "Select Product"}
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
                            {(!salesRepId && !outOfStockOverride)
                              ? "Please select a representative."
                              : "No products found."}
                          </CommandEmpty>
                          <CommandGroup>
                            {availableProducts.map((product) => (
                              <CommandItem
                                key={product.id}
                                value={`${product.name} ${product.sku}`}
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
                                  <div className="font-medium flex items-center gap-1.5">
                                    {product.name}
                                    {product.retailOnly && (
                                      <span className="text-[10px] bg-amber-100 text-amber-800 border border-amber-300 rounded px-1 font-semibold">
                                        Retail
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    {product.sku} • Stock: {product.stock_quantity} • LKR{" "}
                                    {(product.retail_price ?? product.selling_price).toLocaleString()}
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
                                {item.retailOnly && (
                                  <span className="text-[10px] bg-amber-100 text-amber-800 border border-amber-300 rounded px-1 py-0.5 font-semibold">
                                    Retail
                                  </span>
                                )}
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
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Terms:</span>
                  <span className="font-semibold text-blue-700">{paymentMethod || "Unselected"}</span>
                </div>
                <div className={cn("grid gap-2", paymentMethod === "Cash & Discount" ? "grid-cols-2" : "grid-cols-1")}>
                  <div className="space-y-1">
                    <Label className="text-xs">Extra Disc %</Label>
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
                  {paymentMethod === "Cash & Discount" && (
                    <div className="space-y-1">
                      <Label className="text-xs text-emerald-700 font-semibold">Cash Disc %</Label>
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        placeholder="0%"
                        value={cashDiscount}
                        onChange={(e) => setCashDiscount(e.target.value)}
                        disabled={isReadOnly}
                        className="border-emerald-300 focus:border-emerald-500"
                      />
                    </div>
                  )}
                </div>

                {extraDiscountAmount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Extra Discount:</span>
                    <span className="text-destructive">
                      - LKR {extraDiscountAmount.toLocaleString()}
                    </span>
                  </div>
                )}

                {cashDiscountAmount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Cash Discount:</span>
                    <span className="text-emerald-600 font-medium">
                      - LKR {cashDiscountAmount.toLocaleString()}
                    </span>
                  </div>
                )}
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

      {/* One-Time Invoice Unlock Modal (Hybrid Option 1 + Option 2) */}
      <Dialog open={unlockModalOpen} onOpenChange={setUnlockModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-bold text-slate-900">
              <KeyRound className="w-5 h-5 text-amber-600" />
              One-Time Invoice Edit Authorization
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              This invoice is currently locked in <strong className="text-slate-700">{orderStatus}</strong> status. Choose a method below to authorize a one-time edit session.
            </DialogDescription>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "pin" | "request" | "qr")} className="w-full mt-2">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="pin" className="flex items-center gap-1 text-[11px] px-1">
                <KeyRound className="w-3 h-3" /> Instant PIN
              </TabsTrigger>
              <TabsTrigger value="request" className="flex items-center gap-1 text-[11px] px-1">
                <Send className="w-3 h-3" /> Request
              </TabsTrigger>
              <TabsTrigger value="qr" className="flex items-center gap-1 text-[11px] px-1">
                <QrCode className="w-3 h-3" /> Scan QR
              </TabsTrigger>
            </TabsList>

            {/* TAB 1: INSTANT ADMIN PASSCODE / OTP */}
            <TabsContent value="pin" className="space-y-4 pt-3">
              <div className="space-y-2">
                <Label className="text-xs font-semibold">Admin Passcode / OTP Code</Label>
                <Input
                  type="password"
                  placeholder="Enter 6-digit Admin Passcode (e.g. 889900)"
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value)}
                  className="font-mono text-center tracking-widest text-lg"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-semibold">Reason for Editing <span className="text-red-500">*</span></Label>
                <Input
                  placeholder="e.g. Returned 2 damaged items during delivery"
                  value={unlockReason}
                  onChange={(e) => setUnlockReason(e.target.value)}
                />
              </div>

              <DialogFooter className="pt-2">
                <Button
                  variant="outline"
                  onClick={() => setUnlockModalOpen(false)}
                  disabled={unlocking}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleVerifyPin}
                  disabled={unlocking || !pinInput || !unlockReason}
                  className="bg-amber-600 hover:bg-amber-700 text-white"
                >
                  {unlocking ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <ShieldCheck className="w-4 h-4 mr-1" />}
                  Verify & Unlock
                </Button>
              </DialogFooter>
            </TabsContent>

            {/* TAB 2: REQUEST ADMIN APPROVAL */}
            <TabsContent value="request" className="space-y-4 pt-3">
              {requestStatus === "pending" ? (
                <div className="bg-amber-50 border border-amber-200 text-amber-900 p-4 rounded-lg text-center space-y-3">
                  <div className="flex justify-center">
                    <Loader2 className="w-8 h-8 animate-spin text-amber-600" />
                  </div>
                  <div>
                    <p className="font-bold text-sm">Request Pending Approval</p>
                    <p className="text-xs text-amber-700 mt-1">
                      Your unlock request has been submitted to the Admin dashboard. The page is auto-checking approval status...
                    </p>
                  </div>
                  <Badge variant="outline" className="bg-white text-amber-800 border-amber-300">
                    <Clock className="w-3 h-3 mr-1" /> Checking status...
                  </Badge>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold">Reason for Request <span className="text-red-500">*</span></Label>
                    <Input
                      placeholder="e.g. Rep needs quantity adjustment post-delivery"
                      value={unlockReason}
                      onChange={(e) => setUnlockReason(e.target.value)}
                    />
                  </div>

                  <p className="text-xs text-muted-foreground bg-slate-50 p-2.5 rounded border">
                    💡 Submitting this request sends a notification to Admin. Once approved by Admin, this invoice will automatically unlock for editing.
                  </p>

                  <DialogFooter className="pt-2">
                    <Button
                      variant="outline"
                      onClick={() => setUnlockModalOpen(false)}
                      disabled={unlocking}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleSendUnlockRequest}
                      disabled={unlocking || !unlockReason}
                      className="bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      {unlocking ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Send className="w-4 h-4 mr-1" />}
                      Send Request to Admin
                    </Button>
                  </DialogFooter>
                </>
              )}
            </TabsContent>

            {/* TAB 3: OPTION 3 – SCAN QR CODE (MOBILE UNLOCK) */}
            <TabsContent value="qr" className="space-y-4 pt-3">
              <div className="space-y-2">
                <Label className="text-xs font-semibold">Reason for Edit <span className="text-red-500">*</span></Label>
                <Input
                  placeholder="e.g. Driver adjusting quantity on phone at shop"
                  value={unlockReason}
                  onChange={(e) => setUnlockReason(e.target.value)}
                  disabled={!!qrDataUrl}
                />
              </div>

              {!qrDataUrl ? (
                <div className="text-center py-4 space-y-3">
                  <div className="mx-auto w-12 h-12 bg-purple-50 text-purple-600 rounded-full flex items-center justify-center">
                    <Smartphone className="w-6 h-6" />
                  </div>
                  <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                    Generate a QR code. Scan with Admin's mobile phone camera, enter Admin PIN on mobile, and this screen will auto-unlock!
                  </p>
                  <Button
                    onClick={handleGenerateQrCode}
                    disabled={generatingQr || !unlockReason}
                    className="bg-purple-600 hover:bg-purple-700 text-white gap-2"
                  >
                    {generatingQr ? <Loader2 className="w-4 h-4 animate-spin" /> : <QrCode className="w-4 h-4" />}
                    Generate Mobile QR Code
                  </Button>
                </div>
              ) : (
                <div className="text-center space-y-3 pt-1">
                  <div className="bg-slate-900 p-3 rounded-xl inline-block shadow-md border border-slate-800">
                    <img
                      src={qrDataUrl}
                      alt="Unlock Invoice QR Code"
                      className="w-44 h-44 mx-auto rounded bg-white p-1"
                    />
                  </div>

                  <div className="space-y-1">
                    <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-300 animate-pulse text-xs">
                      <Clock className="w-3 h-3 mr-1" /> Waiting for Mobile Phone Scan & PIN...
                    </Badge>
                    <p className="text-[11px] text-muted-foreground">
                      Scan QR code with Admin phone camera to approve.
                    </p>
                  </div>

                  <div className="flex justify-center items-center gap-2 pt-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs gap-1 h-8"
                      onClick={() => {
                        navigator.clipboard.writeText(qrUnlockUrl);
                        toast.success("Mobile Link copied to clipboard!");
                      }}
                    >
                      <Copy className="w-3 h-3" /> Copy Mobile Link
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs gap-1 h-8 text-purple-600"
                      onClick={() => window.open(qrUnlockUrl, "_blank")}
                    >
                      <ExternalLink className="w-3 h-3" /> Open Link
                    </Button>
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>
  );
}
