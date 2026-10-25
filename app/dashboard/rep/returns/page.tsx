"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Undo2,
  ArrowLeft,
  Check,
  ChevronsUpDown,
  Search,
  Plus,
  Trash2,
  Pencil,
  Clock,
  CheckCircle2,
  XCircle,
  Save,
  Package,
  Store,
  RefreshCw,
  AlertTriangle,
  History,
  Receipt,
  User,
  CalendarDays,
  Repeat,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getUserBusinessContext } from "@/app/middleware/businessAuth";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Customer {
  id: string;
  name: string;
  phone?: string;
  ownerName?: string;
  route?: string;
}

interface PurchasedProduct {
  productId: string;
  productName: string;
  sku: string;
  category?: string;
  unitOfMeasure?: string;
  unitPrice: number;
  purchasedQuantity: number;
  invoiceNo: string;
  manualInvoiceNo?: string | null;
  invoiceId?: string;
  orderId?: string;
  invoiceTotal?: number;
  lastPurchasedDate?: string;
}

interface ReturnItem {
  id: string;
  productId: string;
  sku: string;
  productName: string;
  quantity: number;
  returnType: "Good" | "Damage" | "Exchange";
  unit: string;
  price: number;
  totalValue: number;
  invoiceNo?: string;
  reason?: string;
  purchasedQuantity?: number;
}

interface ReturnHistoryNote {
  id: string;
  return_number: string;
  return_batch_id: string | null;
  return_date: string | null;
  created_at: string;
  return_type: "Good" | "Damage" | "Exchange" | string;
  quantity: number;
  reason: string | null;
  status: "Pending" | "Approved" | "Completed" | "Rejected" | string;
  customer_id: string | null;
  customers?: {
    id: string;
    shop_name: string;
    owner_name?: string;
    route?: string;
  } | null;
  products?: {
    id: string;
    name: string;
    sku: string;
    unit_of_measure?: string;
    selling_price?: number;
  } | null;
}

// ── Past returns list helpers ─────────────────────────────────────────────────
const fmtLkr = (n: number) =>
  `LKR ${(Number(n) || 0).toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtHistoryDate = (iso?: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
    : "-";

// Coloured left stripe per office status
const statusStyle = (status?: string) =>
  status === "Pending"
    ? { accent: "border-l-amber-400" }
    : status === "Rejected"
    ? { accent: "border-l-red-400" }
    : { accent: "border-l-emerald-400" };

function StatusPill({ status }: { status?: string }) {
  if (status === "Pending")
    return (
      <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
        <Clock className="h-3 w-3" /> Pending
      </span>
    );
  if (status === "Rejected")
    return (
      <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700">
        <XCircle className="h-3 w-3" /> Rejected
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
      <CheckCircle2 className="h-3 w-3" /> Approved
    </span>
  );
}

function ConditionPill({ type }: { type?: string }) {
  const cfg =
    type === "Good"
      ? { cls: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: <Undo2 className="h-3 w-3" />, label: "Good" }
      : type === "Damage"
      ? { cls: "bg-red-50 text-red-700 border-red-200", icon: <AlertTriangle className="h-3 w-3" />, label: "Damage" }
      : { cls: "bg-blue-50 text-blue-700 border-blue-200", icon: <Repeat className="h-3 w-3" />, label: "Exchange" };
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-md border px-1.5 py-0.5 text-[10px] font-semibold", cfg.cls)}>
      {cfg.icon} {cfg.label}
    </span>
  );
}

export default function RepReturnsPage() {
  const router = useRouter();

  // Mode: "create" (default, direct New Return Note) or "history" (Past notes)
  const [viewMode, setViewMode] = useState<"create" | "history">("create");

  // User and Business Context
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [userBusinessId, setUserBusinessId] = useState<string | null>(null);

  // Customer Selection
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerId, setCustomerId] = useState<string>("");
  const [customerOpen, setCustomerOpen] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");
  const [returnDate, setReturnDate] = useState<string>(() => {
    return new Date().toISOString().split("T")[0];
  });

  // Customer Purchased Products (Strict Restriction)
  const [customerPurchasedProducts, setCustomerPurchasedProducts] = useState<PurchasedProduct[]>([]);
  const [loadingPurchased, setLoadingPurchased] = useState(false);
  const [selectedBillFilter, setSelectedBillFilter] = useState<string>("all");
  const [billSelectorOpen, setBillSelectorOpen] = useState(false);

  // Return Item Input State
  const [returnItems, setReturnItems] = useState<ReturnItem[]>([]);
  const [editingReturnId, setEditingReturnId] = useState<string | null>(null);
  const [returnProductOpen, setReturnProductOpen] = useState(false);
  const returnQtyInputRef = useRef<HTMLInputElement>(null);

  // Top-level Return Method selection: Only "Good" (Good Return) or "Exchange" (Exchange) allowed per Return Note
  const [noteReturnType, setNoteReturnType] = useState<"Good" | "Exchange">("Good");

  const [currentReturnItem, setCurrentReturnItem] = useState({
    productId: "",
    sku: "",
    productName: "",
    quantity: "",
    returnType: "Good" as "Good" | "Exchange",
    unit: "",
    price: 0,
    invoiceNo: "",
    reason: "",
    maxPurchasedQty: 0,
  });

  const [submitting, setSubmitting] = useState(false);

  // History State
  const [historyNotes, setHistoryNotes] = useState<ReturnHistoryNote[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historySearch, setHistorySearch] = useState("");
  const [historyStatusFilter, setHistoryStatusFilter] = useState<string>("all");

  // Initial Load: User & Customers
  useEffect(() => {
    const user = getUserBusinessContext();
    if (user) {
      setCurrentUser(user);
      setUserBusinessId(user.businessId || null);
    }

    const fetchCustomers = async () => {
      try {
        const url = user?.businessId
          ? `/api/customers?businessId=${user.businessId}`
          : "/api/customers";
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          const list = Array.isArray(data) ? data : [];
          setCustomers(
            list.map((c: any) => ({
              id: c.id,
              name: c.shopName || c.name || "Unknown",
              phone: c.phone || "",
              ownerName: c.ownerName || "",
              route: c.route || "",
            }))
          );
        }
      } catch (err) {
        console.error("Failed to load customers:", err);
      }
    };

    fetchCustomers();
  }, []);

  // When Customer Changes: Fetch Customer's Purchased Products
  useEffect(() => {
    if (!customerId) {
      setCustomerPurchasedProducts([]);
      setCurrentReturnItem({
        productId: "",
        sku: "",
        productName: "",
        quantity: "",
        returnType: noteReturnType,
        unit: "",
        price: 0,
        invoiceNo: "",
        reason: "",
        maxPurchasedQty: 0,
      });
      return;
    }

    const fetchPurchased = async () => {
      setLoadingPurchased(true);
      try {
        const res = await fetch(`/api/customers/${customerId}/purchased-products`);
        if (res.ok) {
          const rawData = await res.json();
          const list = Array.isArray(rawData) ? rawData : [];
          const normalized: PurchasedProduct[] = [];

          list.forEach((p: any) => {
            if (Array.isArray(p.history) && p.history.length > 0) {
              p.history.forEach((h: any) => {
                normalized.push({
                  productId: p.id || p.productId,
                  productName: p.name || p.productName || "Unknown Product",
                  sku: p.sku || "",
                  unitOfMeasure: p.unit || p.unitOfMeasure || "unit",
                  unitPrice: Number(h.unitPrice) || Number(p.latestUnitPrice) || Number(p.unitPrice) || 0,
                  purchasedQuantity: Number(h.quantity) || Number(h.totalQuantity) || Number(p.totalPurchasedQty) || 0,
                  invoiceNo: h.invoiceNo || p.latestInvoiceNo || p.invoiceNo || "-",
                  manualInvoiceNo: h.manualInvoiceNo || p.latestManualInvoiceNo || null,
                  invoiceId: h.invoiceId || null,
                  orderId: h.orderId || null,
                  invoiceTotal: Number(h.invoiceTotal) || Number(p.latestInvoiceTotal) || Number(h.totalPrice) || 0,
                  lastPurchasedDate: h.date || p.lastPurchasedDate || undefined,
                });
              });
            } else {
              normalized.push({
                productId: p.id || p.productId,
                productName: p.name || p.productName || "Unknown Product",
                sku: p.sku || "",
                unitOfMeasure: p.unit || p.unitOfMeasure || "unit",
                unitPrice: Number(p.latestUnitPrice ?? p.unitPrice ?? 0),
                purchasedQuantity: Number(p.totalPurchasedQty ?? p.purchasedQuantity ?? 0),
                invoiceNo: p.latestInvoiceNo || p.invoiceNo || "-",
                manualInvoiceNo: p.latestManualInvoiceNo || null,
                invoiceTotal: Number(p.latestInvoiceTotal) || Number(p.totalSpent) || 0,
                lastPurchasedDate: p.lastPurchasedDate || undefined,
              });
            }
          });

          setCustomerPurchasedProducts(normalized);
        } else {
          setCustomerPurchasedProducts([]);
        }
      } catch (err) {
        console.error(err);
        setCustomerPurchasedProducts([]);
      } finally {
        setLoadingPurchased(false);
      }
    };

    fetchPurchased();
    setSelectedBillFilter("all");
    setEditingReturnId(null);
  }, [customerId]);

  // Unique past bills for bill selector dropdown with invoice value
  const customerBillsList = useMemo(() => {
    const map: Record<
      string,
      { invoiceNo: string; date?: string; itemCount: number; invoiceTotal: number; calculatedSum: number }
    > = {};
    customerPurchasedProducts.forEach((p) => {
      const inv = p.invoiceNo && p.invoiceNo !== "-" ? p.invoiceNo : null;
      if (inv) {
        if (!map[inv]) {
          map[inv] = {
            invoiceNo: inv,
            date: p.lastPurchasedDate ? p.lastPurchasedDate.split("T")[0] : undefined,
            itemCount: 0,
            invoiceTotal: p.invoiceTotal || 0,
            calculatedSum: 0,
          };
        }
        map[inv].itemCount += 1;
        map[inv].calculatedSum += (p.unitPrice || 0) * (p.purchasedQuantity || 1);
        if ((!map[inv].invoiceTotal || map[inv].invoiceTotal === 0) && p.invoiceTotal) {
          map[inv].invoiceTotal = p.invoiceTotal;
        }
      }
    });

    return Object.values(map)
      .map((b) => ({
        ...b,
        invoiceTotal: b.invoiceTotal > 0 ? b.invoiceTotal : b.calculatedSum,
      }))
      .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  }, [customerPurchasedProducts]);

  // Filtered available returnable items (if bill selected, filter by that bill; otherwise show all items)
  const availablePurchasedProducts = useMemo(() => {
    if (selectedBillFilter === "all" || !selectedBillFilter) return customerPurchasedProducts;
    return customerPurchasedProducts.filter((p) => p.invoiceNo === selectedBillFilter);
  }, [customerPurchasedProducts, selectedBillFilter]);

  // Handle top-level Return Method change (strictly Good Return or Exchange)
  const handleNoteReturnTypeChange = (val: "Good" | "Exchange") => {
    setNoteReturnType(val);
    setCurrentReturnItem((prev) => ({ ...prev, returnType: val }));
    if (returnItems.length > 0) {
      setReturnItems((prev) =>
        prev.map((item) => ({
          ...item,
          returnType: val,
        }))
      );
      toast.info(`Updated all return items to ${val === "Good" ? "Good Return" : "Exchange"}`);
    }
  };

  // Select a product to return
  const handleReturnProductSelect = (item: PurchasedProduct) => {
    setCurrentReturnItem({
      productId: item.productId,
      sku: item.sku,
      productName: item.productName,
      quantity: "",
      returnType: noteReturnType,
      unit: item.unitOfMeasure || "unit",
      price: item.unitPrice || 0,
      invoiceNo: item.invoiceNo || "-",
      reason: "",
      maxPurchasedQty: item.purchasedQuantity || 0,
    });
    setReturnProductOpen(false);
    setTimeout(() => returnQtyInputRef.current?.focus({ preventScroll: true }), 100);
  };

  // Add / Update Return Item
  const handleAddReturnItem = () => {
    const qty = parseFloat(currentReturnItem.quantity);
    if (!currentReturnItem.productId) {
      toast.error("Please select a product to return");
      return;
    }
    if (!qty || qty <= 0) {
      toast.error("Quantity must be greater than 0");
      return;
    }

    if (
      currentReturnItem.maxPurchasedQty > 0 &&
      qty > currentReturnItem.maxPurchasedQty
    ) {
      toast.error(
        `Quantity (${qty}) exceeds customer's purchased quantity (${currentReturnItem.maxPurchasedQty}) on bill ${currentReturnItem.invoiceNo}`
      );
      return;
    }

    const rate = currentReturnItem.price || 0;
    const totalVal = Math.round(qty * rate * 100) / 100;

    const newReturn: ReturnItem = {
      id: editingReturnId || `ret_${Date.now()}`,
      productId: currentReturnItem.productId,
      sku: currentReturnItem.sku,
      productName: currentReturnItem.productName,
      quantity: qty,
      returnType: noteReturnType,
      unit: currentReturnItem.unit,
      price: rate,
      totalValue: totalVal,
      invoiceNo: currentReturnItem.invoiceNo,
      reason: currentReturnItem.reason,
      purchasedQuantity: currentReturnItem.maxPurchasedQty,
    };

    if (editingReturnId) {
      setReturnItems((prev) => prev.map((ri) => (ri.id === editingReturnId ? newReturn : ri)));
      setEditingReturnId(null);
      toast.success("Return item updated");
    } else {
      setReturnItems((prev) => [...prev, newReturn]);
      toast.success("Return item added");
    }

    // Reset inputs
    setCurrentReturnItem({
      productId: "",
      sku: "",
      productName: "",
      quantity: "",
      returnType: noteReturnType,
      unit: "",
      price: 0,
      invoiceNo: "",
      reason: "",
      maxPurchasedQty: 0,
    });
  };

  const handleEditReturnItem = (item: ReturnItem) => {
    setEditingReturnId(item.id);
    setCurrentReturnItem({
      productId: item.productId,
      sku: item.sku,
      productName: item.productName,
      quantity: item.quantity.toString(),
      returnType: noteReturnType,
      unit: item.unit,
      price: item.price,
      invoiceNo: item.invoiceNo || "",
      reason: item.reason || "",
      maxPurchasedQty: item.purchasedQuantity || 0,
    });
    setTimeout(() => returnQtyInputRef.current?.focus({ preventScroll: true }), 100);
  };

  const handleRemoveReturnItem = (id: string) => {
    setReturnItems((prev) => prev.filter((ri) => ri.id !== id));
    if (editingReturnId === id) {
      setEditingReturnId(null);
      setCurrentReturnItem({
        productId: "",
        sku: "",
        productName: "",
        quantity: "",
        returnType: noteReturnType,
        unit: "",
        price: 0,
        invoiceNo: "",
        reason: "",
        maxPurchasedQty: 0,
      });
    }
  };

  const handleCancelReturnEdit = () => {
    setEditingReturnId(null);
    setCurrentReturnItem({
      productId: "",
      sku: "",
      productName: "",
      quantity: "",
      returnType: noteReturnType,
      unit: "",
      price: 0,
      invoiceNo: "",
      reason: "",
      maxPurchasedQty: 0,
    });
  };

  // Submit Return Note
  const handleSubmitReturnNote = async () => {
    if (!customerId) {
      toast.error("Please select a customer.");
      return;
    }
    if (returnItems.length === 0) {
      toast.error("Please add at least one return item.");
      return;
    }
    if (!currentUser?.id) {
      toast.error("User session invalid. Please re-login.");
      return;
    }

    setSubmitting(true);
    const noteCode = Math.floor(100000 + Math.random() * 900000).toString();
    const nowIso = new Date().toISOString();

    try {
      let successCount = 0;
      let lastReturnNo = "";

      for (let idx = 0; idx < returnItems.length; idx++) {
        const it = returnItems[idx];
        const itemReturnNo = `RET-${noteCode}-${idx + 1}`;
        const invTag = it.invoiceNo && it.invoiceNo !== "-" ? `[INV:${it.invoiceNo}]` : "";
        const priceTag = `[PRICE:${it.price}]`;
        const noteTag = `[NOTE:${noteCode}]`;
        const combinedReason = `${invTag} ${priceTag} ${noteTag} ${it.reason || "Customer return"}`.trim();

        const res = await fetch("/api/inventory/returns", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            return_number: itemReturnNo,
            product_id: it.productId,
            location_id: "0b68fd7b-6a40-496f-9279-0a003c26b211", // Main Warehouse
            business_id: userBusinessId || "e770d62c-d4bd-4bbc-ba9e-ccb07d7aa9bb",
            customer_id: customerId,
            quantity: it.quantity,
            return_type: it.returnType,
            reason: combinedReason,
            status: "Pending", // Awaiting office approval
            return_date: returnDate || nowIso,
            returned_by: currentUser.id,
            invoice_no: it.invoiceNo && it.invoiceNo !== "-" ? it.invoiceNo : undefined,
          }),
        });

        if (res.ok) {
          const retData = await res.json();
          lastReturnNo = retData.return_number || itemReturnNo;
          successCount++;
        } else {
          const errData = await res.json().catch(() => ({}));
          console.error("Return item save error:", errData);
        }
      }

      if (successCount === returnItems.length) {
        toast.success(
          `Return Note submitted successfully (${returnItems.length} item${returnItems.length !== 1 ? "s" : ""}, Note: RET-${noteCode}). Status: Pending Office Approval.`
        );
        // Reset form
        setReturnItems([]);
        setCustomerId("");
        setNoteReturnType("Good");
        // Switch to history tab to see status
        fetchHistory(currentUser.id);
        setViewMode("history");
      } else {
        toast.warning(`Submitted ${successCount} of ${returnItems.length} return items.`);
        setViewMode("history");
      }
    } catch (err: any) {
      console.error(err);
      toast.error("An error occurred while saving the return note");
    } finally {
      setSubmitting(false);
    }
  };

  // Fetch History
  const fetchHistory = useCallback(async (repId?: string) => {
    setHistoryLoading(true);
    try {
      const url = repId
        ? `/api/inventory/returns?salesRepId=${repId}&limit=all`
        : `/api/inventory/returns?limit=all`;
      const res = await fetch(url);
      if (res.ok) {
        const json = await res.json();
        setHistoryNotes(json.data || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    if (currentUser?.id) {
      fetchHistory(currentUser.id);
    }
  }, [currentUser, fetchHistory]);

  // Breakdown calculations for Return Summary
  const goodReturnsTotal = returnItems
    .filter((ri) => ri.returnType === "Good")
    .reduce((sum, ri) => sum + ri.totalValue, 0);

  const damageReturnsTotal = returnItems
    .filter((ri) => ri.returnType === "Damage")
    .reduce((sum, ri) => sum + ri.totalValue, 0);

  const exchangeReturnsTotal = returnItems
    .filter((ri) => ri.returnType === "Exchange")
    .reduce((sum, ri) => sum + ri.totalValue, 0);

  const grandTotalReturn = returnItems.reduce((sum, ri) => sum + ri.totalValue, 0);

  const selectedCustomerObj = customers.find((c) => c.id === customerId);

  // Parse History Note metadata
  const parseHistoryMetadata = (reason?: string | null, defaultPrice?: number) => {
    let invoiceNo = "-";
    let unitPrice = defaultPrice || 0;
    if (reason) {
      const invMatch = reason.match(/\[INV:([^\]]+)\]/);
      if (invMatch) invoiceNo = invMatch[1];
      const priceMatch = reason.match(/\[PRICE:([\d.]+)\]/);
      if (priceMatch) unitPrice = parseFloat(priceMatch[1]) || unitPrice;
      const bracketMatch = reason.match(/\[([A-Z0-9_-]+)\]/);
      if (invoiceNo === "-" && bracketMatch && !bracketMatch[1].startsWith("PRICE:")) {
        invoiceNo = bracketMatch[1];
      }
    }
    return { invoiceNo, unitPrice };
  };

  const pendingCount = historyNotes.filter((r) => r.status === "Pending").length;
  const approvedCount = historyNotes.filter(
    (r) => r.status === "Approved" || r.status === "Completed"
  ).length;

  const filteredHistory = useMemo(() => {
    return historyNotes.filter((r) => {
      if (historyStatusFilter === "pending" && r.status !== "Pending") return false;
      if (
        historyStatusFilter === "approved" &&
        r.status !== "Approved" &&
        r.status !== "Completed"
      )
        return false;
      if (historyStatusFilter === "rejected" && r.status !== "Rejected") return false;

      if (!historySearch) return true;
      const term = historySearch.toLowerCase();
      const shop = r.customers?.shop_name?.toLowerCase() || "";
      const retNo = r.return_number?.toLowerCase() || "";
      const pName = r.products?.name?.toLowerCase() || "";
      return shop.includes(term) || retNo.includes(term) || pName.includes(term);
    });
  }, [historyNotes, historyStatusFilter, historySearch]);

  // Value of the notes in the current filter, split by return method
  const historyTotals = useMemo(() => {
    const t = { good: 0, exchange: 0, damage: 0 };
    filteredHistory.forEach((r) => {
      const { unitPrice } = parseHistoryMetadata(r.reason, r.products?.selling_price);
      const v = Number(r.quantity || 0) * unitPrice;
      if (r.return_type === "Good") t.good += v;
      else if (r.return_type === "Damage") t.damage += v;
      else t.exchange += v;
    });
    return t;
  }, [filteredHistory]);

  return (
    <div className="space-y-4 mx-auto pb-28 lg:pb-6 w-full max-w-full min-w-0 overflow-x-hidden">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-3">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0"
            onClick={() => router.push("/dashboard/rep")}
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight truncate flex items-center gap-2">
              <Undo2 className="h-6 w-6 text-green-700" />
              New Return Note
            </h1>
            <p className="text-muted-foreground text-xs sm:text-sm mt-0.5">
              Create and file a customer return note directly for office approval
            </p>
          </div>
        </div>

        {/* View Switcher: New Note vs History */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-gray-100 p-1 rounded-lg">
            <Button
              size="sm"
              variant={viewMode === "create" ? "default" : "ghost"}
              className={cn(
                "h-8 text-xs font-semibold gap-1.5",
                viewMode === "create"
                  ? "bg-black hover:bg-gray-800 text-white shadow-xs"
                  : "text-gray-600 hover:text-gray-900"
              )}
              onClick={() => setViewMode("create")}
            >
              <Plus className="w-3.5 h-3.5" />
              New Return Note
            </Button>
            <Button
              size="sm"
              variant={viewMode === "history" ? "default" : "ghost"}
              className={cn(
                "h-8 text-xs font-semibold gap-1.5",
                viewMode === "history"
                  ? "bg-black hover:bg-gray-800 text-white shadow-xs"
                  : "text-gray-600 hover:text-gray-900"
              )}
              onClick={() => {
                setViewMode("history");
                if (currentUser?.id) fetchHistory(currentUser.id);
              }}
            >
              <History className="w-3.5 h-3.5" />
              Past Returns
              {pendingCount > 0 && (
                <span className="ml-1 px-1.5 py-0.2 bg-amber-500 text-white rounded-full text-[10px] font-bold">
                  {pendingCount}
                </span>
              )}
            </Button>
          </div>

          {/* Top Desktop Action Button */}
          {viewMode === "create" && (
            <Button
              onClick={handleSubmitReturnNote}
              disabled={returnItems.length === 0 || submitting}
              className="hidden lg:flex bg-[#f97316] hover:bg-[#ea580c] text-white shrink-0 font-semibold text-xs h-9"
            >
              <Save className="w-4 h-4 mr-1.5" />
              Submit Return Note
            </Button>
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* ── MODE 1: CREATE RETURN NOTE (Identical layout to New Sales Order) ── */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {viewMode === "create" && (
        <div className="grid gap-4 sm:gap-6 lg:grid-cols-3 w-full max-w-full min-w-0">
          {/* ── LEFT COLUMN (Main Content, 2 Cols) ── */}
          <div className="lg:col-span-2 space-y-4 sm:space-y-6 w-full min-w-0">
            {/* 1. Customer Details */}
            <Card className="w-full min-w-0 overflow-hidden">
              <CardHeader className="pb-1 sm:pb-2">
                <CardTitle className="text-base sm:text-lg">Customer Details</CardTitle>
                <CardDescription className="text-xs sm:text-sm">
                  Select the customer for this return note
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 sm:space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
                  {/* Customer Selector */}
                  <div className="space-y-2">
                    <Label className="text-xs sm:text-sm font-semibold">Customer *</Label>
                    <Popover open={customerOpen} onOpenChange={setCustomerOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={customerOpen}
                          className="w-full justify-between text-sm h-10 bg-white"
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
                        className="w-[var(--radix-popover-trigger-width)] min-w-[320px] p-0"
                        align="start"
                      >
                        <Command>
                          <CommandInput
                            placeholder="Type shop name, phone or route..."
                            value={customerSearch}
                            onValueChange={setCustomerSearch}
                          />
                          <CommandList>
                            <CommandEmpty>No customer found.</CommandEmpty>
                            <CommandGroup className="max-h-64 overflow-y-auto">
                              {customers.map((c) => (
                                <CommandItem
                                  key={c.id}
                                  value={`${c.name} ${c.phone} ${c.route}`}
                                  onSelect={() => {
                                    setCustomerId(c.id);
                                    setCustomerOpen(false);
                                  }}
                                  className="cursor-pointer text-xs sm:text-sm py-2"
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      customerId === c.id
                                        ? "opacity-100 text-green-600"
                                        : "opacity-0"
                                    )}
                                  />
                                  <div className="flex-1 truncate">
                                    <p className="font-semibold text-slate-900">{c.name}</p>
                                    <p className="text-[11px] text-muted-foreground">
                                      {c.route ? `${c.route} • ` : ""}
                                      {c.phone || "No phone"}
                                    </p>
                                  </div>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>

                  {/* Return Date */}
                  <div className="space-y-2">
                    <Label className="text-xs sm:text-sm font-semibold">Return Date</Label>
                    <Input
                      type="date"
                      value={returnDate}
                      onChange={(e) => setReturnDate(e.target.value)}
                      className="text-sm h-10 bg-white"
                    />
                  </div>

                  {/* Return Method (Good Return or Exchange Only) */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs sm:text-sm font-semibold">Return Method *</Label>
                      <span className="text-[10px] text-muted-foreground font-medium">Applied to whole note</span>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5 h-10 p-1 bg-slate-100/90 rounded-lg border border-slate-200">
                      <button
                        type="button"
                        onClick={() => handleNoteReturnTypeChange("Good")}
                        className={cn(
                          "flex items-center justify-center gap-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer",
                          noteReturnType === "Good"
                            ? "bg-white text-emerald-800 shadow-sm border border-emerald-300 font-bold"
                            : "text-slate-600 hover:text-slate-900"
                        )}
                      >
                        <span
                          className={cn(
                            "w-2 h-2 rounded-full",
                            noteReturnType === "Good" ? "bg-emerald-600 ring-2 ring-emerald-200" : "bg-slate-300"
                          )}
                        />
                        Good Return
                      </button>
                      <button
                        type="button"
                        onClick={() => handleNoteReturnTypeChange("Exchange")}
                        className={cn(
                          "flex items-center justify-center gap-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer",
                          noteReturnType === "Exchange"
                            ? "bg-white text-blue-800 shadow-sm border border-blue-300 font-bold"
                            : "text-slate-600 hover:text-slate-900"
                        )}
                      >
                        <span
                          className={cn(
                            "w-2 h-2 rounded-full",
                            noteReturnType === "Exchange" ? "bg-blue-600 ring-2 ring-blue-200" : "bg-slate-300"
                          )}
                        />
                        Exchange
                      </button>
                    </div>
                  </div>
                </div>

                {/* Sales Rep display */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 pt-1 border-t">
                  <div className="flex items-center gap-2 p-2.5 rounded-lg bg-gray-50 border text-xs">
                    <User className="w-4 h-4 text-gray-500 shrink-0" />
                    <div>
                      <span className="text-[10px] text-gray-500 uppercase tracking-wide font-bold block">
                        Sales Rep
                      </span>
                      <span className="font-semibold text-gray-800">
                        {currentUser?.name || "Ajith Bandara"}
                      </span>
                    </div>
                  </div>

                  {selectedCustomerObj && (
                    <div className="flex items-center justify-between p-2.5 rounded-lg bg-green-50/50 border border-green-100 text-xs">
                      <div>
                        <span className="text-[10px] text-green-700 uppercase tracking-wide font-bold block">
                          Route &bull; Customer Verified
                        </span>
                        <span className="font-semibold text-green-950">
                          {selectedCustomerObj.route || "General Route"}
                        </span>
                      </div>
                      <Badge className="bg-emerald-100 text-emerald-800 border-none text-[10px]">
                        {loadingPurchased
                          ? "Loading Bills..."
                          : `${customerPurchasedProducts.length} Purchases Found`}
                      </Badge>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* 2. Add Customer Returns Card (Warm Orange Theme matching Screenshot 2) */}
            <Card
              className={cn(
                "w-full min-w-0 overflow-hidden transition-all border-orange-200 bg-white shadow-xs rounded-xl",
                editingReturnId ? "border-orange-500 border-2" : ""
              )}
            >
              <CardHeader className="pb-3 border-b border-orange-100 bg-orange-50/30">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <CardTitle className="text-base flex items-center gap-1.5 text-orange-950 font-bold">
                      <Undo2 className="w-5 h-5 text-orange-600" />
                      {editingReturnId ? "Edit Return Item" : "Add Customer Returns"}
                    </CardTitle>
                    <CardDescription className="text-xs text-orange-600/90 font-medium">
                      Select items being returned by the customer (strictly restricted to items customer bought)
                    </CardDescription>
                  </div>
                  <Badge
                    variant="outline"
                    className={cn(
                      "w-fit text-xs font-semibold px-2.5 py-1",
                      noteReturnType === "Good"
                        ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                        : "bg-blue-50 text-blue-800 border-blue-300"
                    )}
                  >
                    Method: {noteReturnType === "Good" ? "Good Return" : "Exchange"}
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="p-4 sm:p-6 space-y-4">
                {/* 1. Bill / Invoice Selector (Optional Filter - Directly BEFORE Product) */}
                <div className="space-y-1.5 p-3 rounded-lg bg-orange-50/40 border border-orange-100">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs sm:text-sm font-bold text-slate-800 flex items-center gap-1.5">
                      <span>1. Select Bill / Invoice</span>
                      <Badge variant="outline" className="text-[10px] bg-white text-orange-700 border-orange-300 font-medium">
                        Optional Filter
                      </Badge>
                    </Label>
                    {selectedBillFilter !== "all" && (
                      <button
                        type="button"
                        onClick={() => setSelectedBillFilter("all")}
                        className="text-xs text-orange-600 hover:text-orange-800 hover:underline font-semibold"
                      >
                        Reset to Show All Bills
                      </button>
                    )}
                  </div>
                  <Popover open={billSelectorOpen} onOpenChange={setBillSelectorOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={billSelectorOpen}
                        className="w-full justify-between bg-white text-left font-normal h-10 text-xs sm:text-sm border-orange-200 hover:bg-orange-50/40"
                        disabled={!customerId || customerPurchasedProducts.length === 0}
                      >
                        <span className="truncate">
                          {selectedBillFilter === "all" || !selectedBillFilter ? (
                            `All Bills (Show all ${customerPurchasedProducts.length} items purchased by customer)`
                          ) : (
                            (() => {
                              const b = customerBillsList.find((item) => item.invoiceNo === selectedBillFilter);
                              if (!b) return `Bill: ${selectedBillFilter}`;
                              return `Bill: ${b.invoiceNo} ${b.date ? `(${b.date})` : ""} • ${b.invoiceTotal > 0 ? `LKR ${b.invoiceTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} • ` : ""}${b.itemCount} item(s)`;
                            })()
                          )}
                        </span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50 text-orange-500" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      className="w-[var(--radix-popover-trigger-width)] min-w-[340px] p-0"
                      align="start"
                    >
                      <Command>
                        <CommandInput placeholder="Search bill # (e.g. 5212), date, or amount..." />
                        <CommandList>
                          <CommandEmpty>No matching bill found.</CommandEmpty>
                          <CommandGroup className="max-h-64 overflow-y-auto">
                            {/* Option to show all bills */}
                            <CommandItem
                              value="all show all bills all items"
                              onSelect={() => {
                                setSelectedBillFilter("all");
                                setBillSelectorOpen(false);
                              }}
                              className="cursor-pointer py-2 text-xs sm:text-sm font-semibold text-orange-950"
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4 shrink-0 text-orange-600",
                                  selectedBillFilter === "all" ? "opacity-100" : "opacity-0"
                                )}
                              />
                              <div className="flex-1 truncate">
                                <span>All Bills (Show all {customerPurchasedProducts.length} items)</span>
                              </div>
                            </CommandItem>

                            {/* List of bills */}
                            {customerBillsList.map((b) => (
                              <CommandItem
                                key={b.invoiceNo}
                                value={`${b.invoiceNo} ${b.date || ""} ${b.invoiceTotal || ""}`}
                                onSelect={() => {
                                  const val = b.invoiceNo;
                                  setSelectedBillFilter(val);
                                  if (currentReturnItem.productId) {
                                    const inBill = customerPurchasedProducts.some(
                                      (p) => p.invoiceNo === val && p.productId === currentReturnItem.productId
                                    );
                                    if (!inBill) {
                                      setCurrentReturnItem((prev) => ({
                                        ...prev,
                                        productId: "",
                                        sku: "",
                                        productName: "",
                                        quantity: "",
                                        price: 0,
                                        invoiceNo: "",
                                        maxPurchasedQty: 0,
                                      }));
                                    }
                                  }
                                  setBillSelectorOpen(false);
                                }}
                                className="cursor-pointer py-2 text-xs sm:text-sm"
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4 shrink-0 text-orange-600",
                                    selectedBillFilter === b.invoiceNo ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                <div className="flex flex-col flex-1 truncate">
                                  <div className="flex items-center justify-between">
                                    <span className="font-semibold text-slate-900 font-mono">
                                      Bill: {b.invoiceNo}
                                    </span>
                                    {b.invoiceTotal > 0 && (
                                      <span className="text-xs font-mono font-bold text-emerald-700 ml-2">
                                        LKR {b.invoiceTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2 text-[10px] sm:text-xs text-muted-foreground mt-0.5">
                                    {b.date && (
                                      <>
                                        <span>{b.date}</span>
                                        <span>&bull;</span>
                                      </>
                                    )}
                                    <span>{b.itemCount} item{b.itemCount !== 1 ? "s" : ""} available to return</span>
                                  </div>
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  <p className="text-[11px] text-muted-foreground">
                    If you select a bill, only items from that bill are shown below. If you don&apos;t select a bill, you can pick any item from all past purchases.
                  </p>
                </div>

                {/* 2. Return Product Row (Directly after Bill Selector) */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs sm:text-sm font-bold text-slate-800">
                      2. Return Product (From Customer Purchase History) *
                    </Label>
                    {selectedBillFilter !== "all" && (
                      <Badge className="bg-blue-50 text-blue-700 border border-blue-200 text-[11px] font-mono">
                        Filtered: Bill {selectedBillFilter}
                        {(() => {
                          const matchedBill = customerBillsList.find((b) => b.invoiceNo === selectedBillFilter);
                          return matchedBill && matchedBill.invoiceTotal > 0
                            ? ` (LKR ${matchedBill.invoiceTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`
                            : "";
                        })()}
                        {" "}&bull; {availablePurchasedProducts.length} item{availablePurchasedProducts.length !== 1 ? "s" : ""}
                      </Badge>
                    )}
                  </div>
                  <Popover open={returnProductOpen} onOpenChange={setReturnProductOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={returnProductOpen}
                        className="w-full justify-between bg-white text-left font-normal h-10 text-sm border-orange-200/80 hover:bg-orange-50/40"
                        disabled={!customerId || customerPurchasedProducts.length === 0}
                      >
                        <span className="truncate">
                          {currentReturnItem.productId ? (
                            <>
                              <span className="font-semibold text-slate-900">
                                {currentReturnItem.productName}
                              </span>
                              {currentReturnItem.invoiceNo && currentReturnItem.invoiceNo !== "-" && (
                                <span className="ml-2 font-mono text-xs text-blue-600 font-bold">
                                  [Bill: {currentReturnItem.invoiceNo}]
                                </span>
                              )}
                            </>
                          ) : selectedBillFilter !== "all" ? (
                            `Select Item from Bill ${selectedBillFilter}`
                          ) : (
                            "Select Product Previously Sold to Customer"
                          )}
                        </span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50 text-orange-500" />
                      </Button>
                    </PopoverTrigger>
                      <PopoverContent
                        className="w-[var(--radix-popover-trigger-width)] min-w-[340px] p-0"
                        align="start"
                      >
                        <Command>
                          <CommandInput placeholder="Search customer's purchased products or bill #..." />
                          <CommandList>
                            {!customerId ? (
                              <div className="p-3 text-xs text-amber-700 bg-amber-50">
                                Please select a customer above first. Only products previously sold to the customer can be returned.
                              </div>
                            ) : loadingPurchased ? (
                              <div className="p-4 text-xs text-gray-500 text-center">
                                <RefreshCw className="w-4 h-4 animate-spin mx-auto mb-1 text-orange-500" />
                                Loading customer purchase history...
                              </div>
                            ) : availablePurchasedProducts.length === 0 ? (
                              <CommandEmpty>
                                No purchase history found for this selection.
                              </CommandEmpty>
                            ) : (
                              <CommandGroup className="max-h-72 overflow-y-auto">
                                {availablePurchasedProducts.map((p, idx) => (
                                  <CommandItem
                                    key={`${p.productId}_${p.invoiceNo}_${idx}`}
                                    value={`${p.productName} ${p.sku} ${p.invoiceNo}`}
                                    onSelect={() => handleReturnProductSelect(p)}
                                    className="cursor-pointer text-xs sm:text-sm py-2"
                                  >
                                    <Check
                                      className={cn(
                                        "mr-2 h-4 w-4 shrink-0 text-orange-600",
                                        currentReturnItem.productId === p.productId &&
                                          currentReturnItem.invoiceNo === p.invoiceNo
                                          ? "opacity-100"
                                          : "opacity-0"
                                      )}
                                    />
                                    <div className="flex flex-col flex-1 truncate">
                                      <div className="flex items-center justify-between">
                                        <span className="font-semibold text-slate-900 truncate">
                                          {p.productName}
                                        </span>
                                        <span className="text-xs font-mono font-bold text-emerald-700 ml-2">
                                          LKR {p.unitPrice?.toLocaleString()}
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-2 text-[10px] sm:text-xs text-muted-foreground mt-0.5">
                                        <span className="font-mono">{p.sku}</span>
                                        <span>&bull;</span>
                                        <span>Purchased: {p.purchasedQuantity} {p.unitOfMeasure || "units"}</span>
                                        <span className="text-blue-600 font-semibold font-mono">Bill: {p.invoiceNo}</span>
                                        {p.invoiceTotal && p.invoiceTotal > 0 ? (
                                          <>
                                            <span>&bull;</span>
                                            <span className="text-emerald-700 font-semibold font-mono">
                                              Bill Total: LKR {p.invoiceTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </span>
                                          </>
                                        ) : null}
                                      </div>
                                    </div>
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            )}
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>

                {/* Quantity, Value (LKR), Total Return (Method chosen at the top: Good Return or Exchange) */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Quantity */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-800">
                      Quantity {currentReturnItem.maxPurchasedQty > 0 && `(Max: ${currentReturnItem.maxPurchasedQty})`}
                    </Label>
                    <Input
                      ref={returnQtyInputRef}
                      type="number"
                      min="1"
                      max={currentReturnItem.maxPurchasedQty || undefined}
                      placeholder="Qty"
                      value={currentReturnItem.quantity}
                      onChange={(e) =>
                        setCurrentReturnItem({ ...currentReturnItem, quantity: e.target.value })
                      }
                      disabled={!currentReturnItem.productId}
                      className="h-10 text-xs border-orange-200/80 bg-white"
                    />
                  </div>

                  {/* Return Price / Value */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-800">Value (LKR)</Label>
                    <Input
                      type="number"
                      placeholder="Price"
                      value={currentReturnItem.price || ""}
                      onChange={(e) =>
                        setCurrentReturnItem({ ...currentReturnItem, price: Number(e.target.value) })
                      }
                      disabled={!currentReturnItem.productId}
                      className="h-10 text-xs border-orange-200/80 bg-white font-mono"
                    />
                  </div>

                  {/* Total Value Preview */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-800">Total Return</Label>
                    <Input
                      readOnly
                      value={((parseFloat(currentReturnItem.quantity) || 0) * currentReturnItem.price).toFixed(2)}
                      className="h-10 text-xs border-orange-200/80 bg-slate-50 font-bold text-slate-900 font-mono"
                    />
                  </div>
                </div>

                {/* Defect / Return Reason */}
                {currentReturnItem.productId && (
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-700">Reason / Defect Description</Label>
                    <Input
                      placeholder="e.g., Damaged item exchange requested, broken pin, customer returning excess good stock..."
                      value={currentReturnItem.reason}
                      onChange={(e) =>
                        setCurrentReturnItem({ ...currentReturnItem, reason: e.target.value })
                      }
                      className="h-9 text-xs bg-white"
                    />
                  </div>
                )}

                {/* Button Row */}
                <div className="flex gap-2 pt-1">
                  {editingReturnId && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleCancelReturnEdit}
                      className="border-orange-200 text-orange-700 hover:bg-orange-50 h-10 px-4 text-xs font-semibold"
                    >
                      Cancel
                    </Button>
                  )}
                  <Button
                    onClick={handleAddReturnItem}
                    className="w-full bg-[#f97316] hover:bg-[#ea580c] text-white font-semibold h-10 rounded-lg flex items-center justify-center gap-2 text-sm shadow-xs transition-colors"
                    disabled={!currentReturnItem.productId}
                  >
                    {editingReturnId ? (
                      <>
                        <Save className="w-4 h-4 mr-2" /> Update Return
                      </>
                    ) : (
                      <>
                        <Plus className="w-4 h-4 mr-2" /> Add Return Item
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* 3. Customer Returned Goods Table (Matching Screenshot 2) */}
            <Card className="w-full min-w-0 overflow-hidden border-orange-200 bg-orange-50/5">
              <CardHeader className="pb-1 sm:pb-2">
                <CardTitle className="text-base sm:text-lg font-bold text-orange-800 flex items-center gap-2">
                  <Undo2 className="w-5 h-5 text-orange-600" />
                  Customer Returned Goods
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm text-orange-600/80">
                  {returnItems.length} item(s) being returned/exchanged
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0 sm:p-6 sm:pt-0">
                {/* ── Mobile card list (hidden on sm+) ── */}
                <div className="sm:hidden divide-y">
                  {returnItems.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                      <Undo2 className="w-8 h-8 mb-2 opacity-30 text-orange-400" />
                      <p className="text-sm">No returned items added yet</p>
                    </div>
                  ) : (
                    returnItems.map((item, idx) => (
                      <div key={item.id} className="flex items-start gap-3 px-4 py-3">
                        <span className="text-xs text-muted-foreground pt-0.5 w-5 shrink-0">
                          {idx + 1}
                        </span>
                        <div className="flex-1 min-w-0 space-y-1">
                          <p className="font-medium text-sm leading-tight truncate text-slate-900">
                            {item.productName}
                          </p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span className="font-mono">{item.sku}</span>
                            {item.invoiceNo && (
                              <span className="text-blue-600 font-mono font-semibold">
                                Bill: {item.invoiceNo}
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs">
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[10px] font-semibold",
                                item.returnType === "Good"
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                  : "bg-blue-50 text-blue-700 border-blue-200"
                              )}
                            >
                              {item.returnType === "Good" ? "Good Return" : "Exchange"}
                            </Badge>
                            <span>Qty: <strong>{item.quantity} {item.unit}</strong></span>
                            <span>Rate: LKR {item.price.toLocaleString()}</span>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <span className="font-bold text-sm text-orange-600">
                            LKR {item.totalValue.toLocaleString()}
                          </span>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-orange-600"
                              onClick={() => handleEditReturnItem(item)}
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive"
                              onClick={() => handleRemoveReturnItem(item.id)}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* ── Desktop table (hidden on mobile) ── */}
                <div className="hidden sm:block border rounded-md overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-orange-50/20">
                        <TableHead className="w-10">#</TableHead>
                        <TableHead>Product</TableHead>
                        <TableHead className="text-center w-28">Return Method</TableHead>
                        <TableHead className="text-center w-24">Qty</TableHead>
                        <TableHead className="text-right w-32">Return Value</TableHead>
                        <TableHead className="text-right w-32">Total Worth</TableHead>
                        <TableHead className="w-16 text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {returnItems.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={7}
                            className="text-center text-muted-foreground py-10"
                          >
                            <Undo2 className="w-8 h-8 mx-auto mb-2 opacity-30 text-orange-400" />
                            No returned items added yet
                          </TableCell>
                        </TableRow>
                      ) : (
                        returnItems.map((item, idx) => (
                          <TableRow
                            key={item.id}
                            className={cn(editingReturnId === item.id && "bg-orange-50/40")}
                          >
                            <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                            <TableCell>
                              <div className="font-medium text-slate-900">{item.productName}</div>
                              <div className="text-xs text-muted-foreground flex items-center gap-2">
                                <span className="font-mono">{item.sku}</span>
                                {item.invoiceNo && (
                                  <span className="font-mono font-semibold text-blue-600 bg-blue-50 px-1 rounded text-[10px]">
                                    Bill: {item.invoiceNo}
                                  </span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              <span
                                className={cn(
                                  "text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider",
                                  item.returnType === "Good"
                                    ? "bg-green-50 text-green-700 border-green-200"
                                    : "bg-blue-50 text-blue-700 border-blue-200"
                                )}
                              >
                                {item.returnType === "Good" ? "Good Return" : "Exchange"}
                              </span>
                            </TableCell>
                            <TableCell className="text-center font-medium">
                              {item.quantity} {item.unit}
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              LKR {item.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </TableCell>
                            <TableCell className="text-right font-bold text-orange-600 font-mono">
                              LKR {item.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1 justify-end">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-orange-600 hover:bg-orange-50"
                                  disabled={editingReturnId !== null}
                                  onClick={() => handleEditReturnItem(item)}
                                >
                                  <Pencil className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 hover:bg-red-50 text-red-600"
                                  disabled={editingReturnId !== null}
                                  onClick={() => handleRemoveReturnItem(item.id)}
                                >
                                  <Trash2 className="w-4 h-4" />
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

          {/* ── RIGHT COLUMN (Order/Return Summary Desktop Sidebar) ── */}
          <div className="lg:col-span-1 hidden lg:block">
            <Card className="sticky top-6 shadow-sm">
              <CardHeader className="pb-3 border-b">
                <CardTitle className="text-lg">Return Summary</CardTitle>
                <CardDescription className="text-xs">
                  Summary of return note ready for office review
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 pt-4">
                <div className="space-y-2.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Customer:</span>
                    <span className="font-medium truncate ml-2 text-right">
                      {selectedCustomerObj?.name || "-"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Date:</span>
                    <span className="font-medium font-mono text-xs">{returnDate}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Return Method:</span>
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[11px] font-semibold",
                        noteReturnType === "Good"
                          ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                          : "bg-blue-50 text-blue-800 border-blue-300"
                      )}
                    >
                      {noteReturnType === "Good" ? "Good Return" : "Exchange"}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Items:</span>
                    <span className="font-bold">{returnItems.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Worth:</span>
                    <span
                      className={cn(
                        "font-mono font-semibold",
                        noteReturnType === "Good" ? "text-emerald-700" : "text-blue-700"
                      )}
                    >
                      LKR {grandTotalReturn.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                <div className="border-t pt-3 space-y-2">
                  <div className="flex justify-between items-baseline">
                    <span className="text-base font-bold text-slate-900">Grand Total Return:</span>
                    <span className="text-xl font-bold font-mono text-orange-600">
                      LKR {grandTotalReturn.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-500">
                    Will be sent to Distribution Office for review and credit note allocation.
                  </p>
                </div>

                <Button
                  onClick={handleSubmitReturnNote}
                  disabled={returnItems.length === 0 || !customerId || submitting}
                  className="w-full bg-[#f97316] hover:bg-[#ea580c] text-white font-semibold h-11 text-sm shadow-xs transition-colors"
                >
                  {submitting ? (
                    <>
                      <Clock className="w-4 h-4 animate-spin mr-2" /> Submitting...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" /> Submit Return Note
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* ── MODE 2: PAST RETURNS HISTORY & APPROVAL STATUS ─────────────── */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {viewMode === "history" && (
        <div className="space-y-4">
          <Card className="shadow-sm overflow-hidden">
            <CardHeader className="pb-3 border-b space-y-3">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                {/* Tabs scroll sideways on small screens instead of squashing */}
                <div className="-mx-1 px-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  <Tabs value={historyStatusFilter} onValueChange={setHistoryStatusFilter}>
                    <TabsList className="bg-gray-100 w-max">
                      <TabsTrigger value="all" className="text-xs sm:text-sm px-3">
                        All <span className="ml-1.5 rounded-full bg-white/80 px-1.5 text-[10px] font-semibold text-gray-600">{historyNotes.length}</span>
                      </TabsTrigger>
                      <TabsTrigger value="pending" className="text-xs sm:text-sm px-3">
                        Pending <span className="ml-1.5 rounded-full bg-amber-100 px-1.5 text-[10px] font-semibold text-amber-700">{pendingCount}</span>
                      </TabsTrigger>
                      <TabsTrigger value="approved" className="text-xs sm:text-sm px-3">
                        Approved <span className="ml-1.5 rounded-full bg-emerald-100 px-1.5 text-[10px] font-semibold text-emerald-700">{approvedCount}</span>
                      </TabsTrigger>
                      <TabsTrigger value="rejected" className="text-xs sm:text-sm px-3">
                        Rejected <span className="ml-1.5 rounded-full bg-red-100 px-1.5 text-[10px] font-semibold text-red-700">{historyNotes.filter((r) => r.status === "Rejected").length}</span>
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>

                <div className="relative w-full md:w-72">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search shop, return #, product..."
                    value={historySearch}
                    onChange={(e) => setHistorySearch(e.target.value)}
                    className="pl-9 h-9 text-xs sm:text-sm bg-white"
                  />
                </div>
              </div>

              {/* Quick totals for the current filter */}
              {!historyLoading && filteredHistory.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { label: "Notes", value: String(filteredHistory.length), cls: "text-gray-900" },
                    {
                      label: "Good",
                      value: fmtLkr(historyTotals.good),
                      cls: "text-emerald-700",
                    },
                    {
                      label: "Exchange",
                      value: fmtLkr(historyTotals.exchange),
                      cls: "text-blue-700",
                    },
                    {
                      label: "Damage",
                      value: fmtLkr(historyTotals.damage),
                      cls: "text-red-700",
                    },
                  ].map((s) => (
                    <div key={s.label} className="rounded-lg border bg-gray-50/60 px-3 py-2 min-w-0">
                      <p className="text-[10px] uppercase tracking-wide text-gray-500 font-medium">{s.label}</p>
                      <p className={cn("text-sm sm:text-base font-bold font-mono truncate", s.cls)}>{s.value}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardHeader>

            <CardContent className="p-0">
              {historyLoading ? (
                <div className="py-16 text-center text-gray-500">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-green-600" />
                  <p className="text-sm">Loading past return notes...</p>
                </div>
              ) : filteredHistory.length === 0 ? (
                <div className="py-16 text-center text-gray-400">
                  <Undo2 className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                  <p className="text-base font-medium text-gray-600">No return notes found</p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setViewMode("create")}
                    className="mt-4 gap-1.5"
                  >
                    <Plus className="w-4 h-4" />
                    Create New Return Note
                  </Button>
                </div>
              ) : (
                <>
                  {/* ── Phone & tablet: cards (1 column on phone, 2 on tablet) ── */}
                  <div className="lg:hidden grid grid-cols-1 md:grid-cols-2 gap-3 p-3 sm:p-4 bg-gray-50/40">
                    {filteredHistory.map((r) => {
                      const { invoiceNo, unitPrice } = parseHistoryMetadata(r.reason, r.products?.selling_price);
                      const totalVal = Math.round(Number(r.quantity || 0) * unitPrice * 100) / 100;
                      const s = statusStyle(r.status);
                      return (
                        <div
                          key={r.id}
                          className={cn(
                            "rounded-xl border bg-white shadow-sm border-l-4 p-3.5 space-y-3 min-w-0",
                            s.accent
                          )}
                        >
                          {/* Return # + status */}
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="font-mono font-bold text-sm text-gray-900 truncate">{r.return_number}</p>
                              <p className="flex items-center gap-1 text-[11px] text-gray-500 mt-0.5">
                                <CalendarDays className="w-3 h-3" />
                                {fmtHistoryDate(r.return_date || r.created_at)}
                              </p>
                            </div>
                            <StatusPill status={r.status} />
                          </div>

                          {/* Customer + bill */}
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <Store className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                              <span className="text-sm font-semibold text-gray-900 truncate">
                                {r.customers?.shop_name || "Unknown Customer"}
                              </span>
                            </div>
                            {invoiceNo !== "-" && (
                              <span className="shrink-0 font-mono text-[11px] font-semibold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                                {invoiceNo}
                              </span>
                            )}
                          </div>

                          {/* Product */}
                          <div className="rounded-lg bg-gray-50 border px-2.5 py-2 flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-xs font-medium text-gray-900 line-clamp-2">{r.products?.name || "Product"}</p>
                              {r.products?.sku && (
                                <p className="text-[10px] font-mono text-gray-400 mt-0.5">{r.products.sku}</p>
                              )}
                            </div>
                            <ConditionPill type={r.return_type} />
                          </div>

                          {/* Qty × rate = total */}
                          <div className="flex items-end justify-between gap-2 pt-0.5">
                            <p className="text-[11px] text-gray-500">
                              <span className="font-semibold text-gray-800">
                                {r.quantity} {r.products?.unit_of_measure || "Pcs"}
                              </span>{" "}
                              × {fmtLkr(unitPrice)}
                            </p>
                            <p className={cn("font-mono font-bold text-base", r.return_type === "Exchange" ? "text-blue-700" : "text-emerald-700")}>
                              {fmtLkr(totalVal)}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* ── Desktop: table ── */}
                  <div className="hidden lg:block overflow-x-auto">
                    <Table>
                      <TableHeader className="sticky top-0 z-10">
                        <TableRow className="bg-gray-50/90 backdrop-blur hover:bg-gray-50/90">
                          {[
                            ["Return Note", "pl-5"],
                            ["Customer", ""],
                            ["Product", ""],
                            ["Condition", "text-center"],
                            ["Qty", "text-right"],
                            ["Amount", "text-right"],
                            ["Status", "text-center pr-5"],
                          ].map(([label, cls]) => (
                            <TableHead
                              key={label}
                              className={cn("text-[11px] uppercase tracking-wider text-gray-500 font-semibold h-10", cls)}
                            >
                              {label}
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredHistory.map((r) => {
                          const { invoiceNo, unitPrice } = parseHistoryMetadata(r.reason, r.products?.selling_price);
                          const totalVal = Math.round(Number(r.quantity || 0) * unitPrice * 100) / 100;
                          const s = statusStyle(r.status);
                          return (
                            <TableRow key={r.id} className="group hover:bg-gray-50/70">
                              <TableCell className={cn("pl-4 border-l-4 py-3", s.accent)}>
                                <p className="font-mono font-bold text-[13px] text-gray-900">{r.return_number}</p>
                                <p className="flex items-center gap-1 text-[11px] text-gray-500 mt-0.5">
                                  <CalendarDays className="w-3 h-3" />
                                  {fmtHistoryDate(r.return_date || r.created_at)}
                                </p>
                              </TableCell>
                              <TableCell className="py-3 max-w-[220px]">
                                <p className="font-semibold text-sm text-gray-900 truncate">
                                  {r.customers?.shop_name || "Unknown Customer"}
                                </p>
                                {invoiceNo !== "-" ? (
                                  <span className="inline-flex items-center gap-1 mt-1 font-mono text-[11px] font-semibold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                                    <Receipt className="w-3 h-3" /> {invoiceNo}
                                  </span>
                                ) : (
                                  r.customers?.route && <p className="text-[11px] text-gray-500">{r.customers.route}</p>
                                )}
                              </TableCell>
                              <TableCell className="py-3 max-w-[300px]">
                                <p className="text-sm font-medium text-gray-900 truncate" title={r.products?.name}>
                                  {r.products?.name || "Product"}
                                </p>
                                <p className="text-[11px] font-mono text-gray-400">{r.products?.sku || ""}</p>
                              </TableCell>
                              <TableCell className="py-3 text-center">
                                <ConditionPill type={r.return_type} />
                              </TableCell>
                              <TableCell className="py-3 text-right whitespace-nowrap">
                                <span className="font-semibold text-sm text-gray-900">{r.quantity}</span>{" "}
                                <span className="text-[11px] text-gray-500">{r.products?.unit_of_measure || "Pcs"}</span>
                              </TableCell>
                              <TableCell className="py-3 text-right whitespace-nowrap">
                                <p className={cn("font-mono font-bold text-sm", r.return_type === "Exchange" ? "text-blue-700" : "text-emerald-700")}>
                                  {fmtLkr(totalVal)}
                                </p>
                                <p className="text-[11px] font-mono text-gray-400">@ {fmtLkr(unitPrice)}</p>
                              </TableCell>
                              <TableCell className="py-3 text-center pr-5">
                                <StatusPill status={r.status} />
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
