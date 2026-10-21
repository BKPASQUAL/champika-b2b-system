"use client";

import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Loader2,
  CreditCard,
  Banknote,
  Building2,
  Package,
  Pencil,
  Trash2,
  Plus,
  Check,
  ChevronsUpDown,
  ReceiptText,
  Boxes,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { invalidatePaymentCaches } from "@/hooks/useCachedFetch";

export interface GoodsSettlementItem {
  id: string;
  type?: "own_product" | "external_goods";
  isCustomerPurchased?: boolean;
  productId: string;
  productName: string;
  sku: string;
  companyCode?: string;
  invoiceNo?: string;
  manualInvoiceNo?: string;
  returnType: "Good" | "Damage";
  locationId: string;
  locationName: string;
  quantity: number;
  unitPrice: number;
  totalValue: number;
}

interface EditPaymentDialogProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  paymentId: string | null;
  onSuccess?: () => void;
  agencyName?: string;
  businessId?: string;
}

const formatCurrency = (amt: number) =>
  `LKR ${amt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function EditPaymentDialog({
  isOpen,
  setIsOpen,
  paymentId,
  onSuccess,
  agencyName = "Agency",
  businessId,
}: EditPaymentDialogProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [paymentData, setPaymentData] = useState<any>(null);

  // Form Fields
  const [amount, setAmount] = useState<number>(0);
  const [method, setMethod] = useState<string>("cash");
  const [paymentDate, setPaymentDate] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [chequeNo, setChequeNo] = useState<string>("");
  const [chequeDate, setChequeDate] = useState<string>("");
  const [chequeStatus, setChequeStatus] = useState<string>("Pending");
  const [depositAccountId, setDepositAccountId] = useState<string>("");
  const [receiptNumber, setReceiptNumber] = useState<string>("");
  const [accounts, setAccounts] = useState<any[]>([]);

  // Goods settlement items state
  const [goodsItems, setGoodsItems] = useState<GoodsSettlementItem[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [catalogProducts, setCatalogProducts] = useState<any[]>([]);
  const [purchasedProducts, setPurchasedProducts] = useState<any[]>([]);
  const [productSource, setProductSource] = useState<"invoiced" | "catalog">("catalog");
  const [productSelectOpen, setProductSelectOpen] = useState(false);

  // Add Item state
  const [addProductId, setAddProductId] = useState("");
  const [addQuantity, setAddQuantity] = useState<number>(1);
  const [addUnitPrice, setAddUnitPrice] = useState<number>(0);
  const [addReturnType, setAddReturnType] = useState<"Good" | "Damage">("Good");
  const [addLocationId, setAddLocationId] = useState<string>("");
  const [addInvoiceNo, setAddInvoiceNo] = useState<string>("");
  const [addManualInvoiceNo, setAddManualInvoiceNo] = useState<string>("");
  const [addIsCustomerPurchased, setAddIsCustomerPurchased] = useState<boolean>(true);

  // Edit Single Item Modal state
  const [editingItem, setEditingItem] = useState<GoodsSettlementItem | null>(null);
  const [editProductId, setEditProductId] = useState("");
  const [editQuantity, setEditQuantity] = useState<number>(1);
  const [editUnitPrice, setEditUnitPrice] = useState<number>(0);
  const [editReturnType, setEditReturnType] = useState<"Good" | "Damage">("Good");
  const [editLocationId, setEditLocationId] = useState<string>("");
  const [editInvoiceNo, setEditInvoiceNo] = useState<string>("");
  const [editManualInvoiceNo, setEditManualInvoiceNo] = useState<string>("");
  const [editIsCustomerPurchased, setEditIsCustomerPurchased] = useState<boolean>(true);
  const [editProductSelectOpen, setEditProductSelectOpen] = useState(false);

  // Fetch Payment Details
  useEffect(() => {
    if (!isOpen || !paymentId) return;

    setLoading(true);
    fetch(`/api/payments/${paymentId}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load payment details");
        return res.json();
      })
      .then((data) => {
        const p = data.payment;
        setPaymentData(p);
        setAmount(Number(p.amount) || 0);
        setMethod(p.method || "cash");
        setPaymentDate(p.payment_date?.split("T")[0] || new Date().toISOString().split("T")[0]);
        setChequeNo(p.cheque_no?.replace(/^Goods:\s*/i, "") || "");
        setChequeDate(p.cheque_date ? p.cheque_date.split("T")[0] : "");
        setChequeStatus(p.cheque_status || "Pending");
        setDepositAccountId(p.deposit_account_id || "");
        setReceiptNumber(p.receipt_number || "");
        setGoodsItems(data.goodsItems || []);
      })
      .catch((err) => {
        toast.error(err.message || "Error loading payment");
        setIsOpen(false);
      })
      .finally(() => setLoading(false));
  }, [isOpen, paymentId, setIsOpen]);

  // Fetch Accounts and Locations
  useEffect(() => {
    if (!isOpen) return;

    // Fetch accounts
    const bId = businessId || paymentData?.invoices?.orders?.business_id;
    const accUrl = bId ? `/api/finance/accounts?businessId=${bId}` : "/api/finance/accounts";
    fetch(accUrl)
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setAccounts((data || []).filter((a: any) => a.is_active)))
      .catch(() => {});

    // Fetch locations
    const locUrl = bId ? `/api/settings/locations?businessId=${bId}` : "/api/settings/locations";
    fetch(locUrl)
      .then((r) => (r.ok ? r.json() : []))
      .then((locs) => {
        if (locs && locs.length > 0) {
          setLocations(locs);
          if (!addLocationId) setAddLocationId(locs[0].id);
        } else {
          const fallback = [{ id: "0b68fd7b-6a40-496f-9279-0a003c26b211", name: "Main Warehouse" }];
          setLocations(fallback);
          if (!addLocationId) setAddLocationId(fallback[0].id);
        }
      })
      .catch(() => {});
  }, [isOpen, businessId, paymentData?.invoices?.orders?.business_id, addLocationId]);

  // Fetch Products (Catalog + Customer Invoiced) when method is goods
  useEffect(() => {
    if (!isOpen || method !== "goods") return;

    const bId = businessId || paymentData?.invoices?.orders?.business_id;
    const prodUrl = bId ? `/api/products?business_id=${bId}&is_active=true` : "/api/products?is_active=true";
    fetch(prodUrl)
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        let filtered = data || [];
        if (agencyName) {
          const agLow = agencyName.toLowerCase();
          filtered = filtered.filter((p: any) => {
            if (p.retailOnly) return false;
            const supplier = (p.supplier || p.supplier_name || "").toLowerCase();
            const brand = (p.brand || "").toLowerCase();
            const name = (p.name || "").toLowerCase();
            return supplier.includes(agLow) || brand.includes(agLow) || name.includes(agLow);
          });
        }
        const mapped = filtered.map((p: any) => ({
          id: p.id,
          name: p.name,
          sku: p.sku || "",
          companyCode: p.companyCode || p.company_code || "",
          stock: p.stock ?? p.stock_quantity ?? 0,
          sellingPrice: Number(p.sellingPrice || p.selling_price || 0),
          costPrice: Number(p.costPrice || p.cost_price || 0),
        }));
        setCatalogProducts(mapped);
      })
      .catch(() => {});

    const custId = paymentData?.customer_id;
    if (custId) {
      const purchasedUrl = bId
        ? `/api/customers/${custId}/purchased-products?businessId=${bId}`
        : `/api/customers/${custId}/purchased-products`;
      fetch(purchasedUrl)
        .then((r) => (r.ok ? r.json() : []))
        .then((data) => {
          let filtered = data || [];
          if (agencyName) {
            const agLow = agencyName.toLowerCase();
            filtered = filtered.filter((p: any) => {
              if (p.retailOnly) return false;
              const supplier = (p.supplier || p.supplier_name || "").toLowerCase();
              const brand = (p.brand || "").toLowerCase();
              const name = (p.name || "").toLowerCase();
              return supplier.includes(agLow) || brand.includes(agLow) || name.includes(agLow);
            });
          }
          const mappedPurchased = filtered.map((p: any) => ({
            ...p,
            costPrice: Number(p.costPrice || p.cost_price || 0),
            sellingPrice: Number(p.sellingPrice || p.selling_price || 0),
          }));
          setPurchasedProducts(mappedPurchased);
          if (mappedPurchased.length > 0) setProductSource("invoiced");
        })
        .catch(() => {});
    }
  }, [isOpen, method, businessId, paymentData, agencyName]);

  // Recalculate amount if method is goods and amount is not yet set
  useEffect(() => {
    if (method === "goods" && amount === 0) {
      const sum = goodsItems.reduce((acc, it) => acc + (it.totalValue || 0), 0);
      if (sum > 0) setAmount(Math.round(sum * 100) / 100);
    }
  }, [goodsItems, method, amount]);

  const handleAddGoodsItem = () => {
    if (!addProductId) {
      toast.error("Please select a product");
      return;
    }
    if (addQuantity <= 0) {
      toast.error("Quantity must be greater than 0");
      return;
    }
    if (addUnitPrice < 0) {
      toast.error("Unit price cannot be negative");
      return;
    }

    const currentList = productSource === "invoiced" ? purchasedProducts : catalogProducts;
    const selectedProd =
      currentList.find((p) => p.id === addProductId) ||
      catalogProducts.find((p) => p.id === addProductId) ||
      purchasedProducts.find((p) => p.id === addProductId);

    const loc = locations.find((l) => l.id === addLocationId) || locations[0];

    const newItem: GoodsSettlementItem = {
      id: `edit_item_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      type: "own_product",
      isCustomerPurchased: addIsCustomerPurchased,
      productId: addProductId,
      productName: selectedProd?.name || `${agencyName} Product`,
      sku: selectedProd?.sku || "",
      companyCode: selectedProd?.companyCode || selectedProd?.company_code || "",
      invoiceNo: addInvoiceNo.trim() || undefined,
      manualInvoiceNo: addManualInvoiceNo.trim() || undefined,
      returnType: addReturnType,
      locationId: loc?.id || "0b68fd7b-6a40-496f-9279-0a003c26b211",
      locationName: loc?.name || "Main Warehouse",
      quantity: addQuantity,
      unitPrice: addUnitPrice,
      totalValue: Math.round(addQuantity * addUnitPrice * 100) / 100,
    };

    setGoodsItems((prev) => [...prev, newItem]);
    toast.success(`Added ${newItem.productName} (${formatCurrency(newItem.totalValue)})`);

    // Reset Add Form
    setAddProductId("");
    setAddQuantity(1);
    setAddUnitPrice(0);
    setAddInvoiceNo("");
    setAddManualInvoiceNo("");
    setAddIsCustomerPurchased(productSource === "invoiced");
  };

  const handleRemoveGoodsItem = (id: string) => {
    setGoodsItems((prev) => prev.filter((it) => it.id !== id));
  };

  const handleOpenEditItem = (item: GoodsSettlementItem) => {
    setEditingItem(item);
    setEditProductId(item.productId);
    setEditQuantity(item.quantity);
    setEditUnitPrice(item.unitPrice);
    setEditReturnType(item.returnType);
    setEditLocationId(item.locationId);
    setEditInvoiceNo(item.invoiceNo || "");
    setEditManualInvoiceNo(item.manualInvoiceNo || "");
    setEditIsCustomerPurchased(item.isCustomerPurchased !== false);
  };

  const handleSaveEditItem = () => {
    if (!editingItem) return;
    if (editQuantity <= 0) {
      toast.error("Quantity must be greater than 0");
      return;
    }
    if (editUnitPrice < 0) {
      toast.error("Unit price cannot be negative");
      return;
    }

    const selectedProd =
      catalogProducts.find((p) => p.id === editProductId) ||
      purchasedProducts.find((p) => p.id === editProductId);

    const loc =
      locations.find((l) => l.id === editLocationId) ||
      locations.find((l) => l.id === editingItem.locationId) ||
      locations[0];

    setGoodsItems((prev) =>
      prev.map((it) => {
        if (it.id !== editingItem.id) return it;
        return {
          ...it,
          productId: editProductId || it.productId,
          productName: selectedProd?.name || it.productName,
          sku: selectedProd?.sku || it.sku,
          companyCode: selectedProd?.companyCode || selectedProd?.company_code || it.companyCode,
          quantity: editQuantity,
          unitPrice: editUnitPrice,
          totalValue: Math.round(editQuantity * editUnitPrice * 100) / 100,
          invoiceNo: editInvoiceNo.trim() || undefined,
          manualInvoiceNo: editManualInvoiceNo.trim() || undefined,
          returnType: editReturnType,
          locationId: loc?.id || editingItem.locationId,
          locationName: loc?.name || editingItem.locationName,
          isCustomerPurchased: editIsCustomerPurchased,
        };
      })
    );

    toast.success("Updated settlement item");
    setEditingItem(null);
  };

  const handleSubmit = async () => {
    if (!amount || amount <= 0) {
      toast.error("Please enter a valid amount greater than 0");
      return;
    }
    if (method === "goods" && goodsItems.length === 0) {
      toast.error("Please add at least one returned product item for goods settlement");
      return;
    }
    if (method === "cheque" && !chequeNo) {
      toast.error("Cheque number is required");
      return;
    }

    setSaving(true);
    try {
      const goodsSummaryStr =
        method === "goods"
          ? goodsItems
              .map((it) => {
                const parts = [
                  it.invoiceNo ? `Bill: ${it.invoiceNo}` : null,
                  it.manualInvoiceNo ? `Manual: ${it.manualInvoiceNo}` : null,
                  it.isCustomerPurchased !== false ? "CustomerBilled" : "OtherAgencyStock",
                ].filter(Boolean).join(", ");
                const total = it.totalValue ?? (it.quantity * it.unitPrice);
                return `${it.quantity}x ${it.productName} (${it.returnType || "Good"}${parts ? ` | ${parts}` : ""}) @ LKR ${Number(total).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
              })
              .join(" ; ")
          : undefined;

      const payload = {
        amount,
        date: paymentDate,
        method,
        notes,
        chequeNo: method === "cheque" ? chequeNo : null,
        chequeDate: method === "cheque" ? chequeDate || null : null,
        chequeStatus: method === "cheque" ? chequeStatus : null,
        depositAccountId: (method === "cash" || method === "bank") ? depositAccountId || null : null,
        receiptNumber: receiptNumber || null,
        goodsItems: method === "goods" ? goodsItems : undefined,
        goodsSummary: goodsSummaryStr,
      };

      const res = await fetch(`/api/payments/${paymentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update payment");

      toast.success("Payment and stock adjustments updated successfully!");
      invalidatePaymentCaches();
      window.dispatchEvent(new CustomEvent("b2b:payment-mutated"));
      if (onSuccess) onSuccess();
      setIsOpen(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to update payment");
    } finally {
      setSaving(false);
    }
  };

  const isGoods = method === "goods";
  const currentAddProductList =
    productSource === "invoiced" && purchasedProducts.length > 0 ? purchasedProducts : catalogProducts;
  const selectedAddProdObj =
    currentAddProductList.find((p) => p.id === addProductId) ||
    catalogProducts.find((p) => p.id === addProductId);

  return (
    <>
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent
          className={cn(
            "w-[96vw] max-w-[96vw] max-h-[92vh] flex flex-col p-0 gap-0 overflow-hidden transition-all duration-200",
            isGoods
              ? "sm:max-w-3xl md:max-w-4xl lg:max-w-5xl xl:max-w-6xl"
              : "sm:max-w-lg"
          )}
        >
          <DialogHeader className="p-4 sm:p-5 pb-3 border-b bg-white shrink-0 pr-12 text-left">
            <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Pencil className="w-4 h-4 sm:w-5 sm:h-5 text-purple-600 shrink-0" />
              <span className="truncate">
                Edit Payment {paymentData?.payment_number ? `(${paymentData.payment_number})` : ""}
              </span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Modify payment details, allocate returned goods items, or update cheque/receipt references.
            </DialogDescription>
          </DialogHeader>

          {loading ? (
            <div className="flex justify-center items-center py-16 flex-1">
              <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
            </div>
          ) : (
            <div className="overflow-y-auto px-4 sm:px-6 py-4 flex-1 space-y-4 min-h-0">
              {/* Top Details Banner */}
              <div className="p-3 bg-purple-50/70 border border-purple-200/80 rounded-lg grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-4 text-xs">
                <div className="min-w-0">
                  <span className="text-muted-foreground block sm:inline">Customer: </span>
                  <span className="font-semibold text-gray-900 break-words">
                    {paymentData?.customers?.shop_name || paymentData?.customers?.name || "Unknown"}
                  </span>
                </div>
                <div className="min-w-0">
                  <span className="text-muted-foreground block sm:inline">Invoice: </span>
                  <span className="font-mono font-semibold text-purple-800 break-words">
                    {paymentData?.invoices?.invoice_no || "N/A"}
                  </span>
                </div>
                <div className="min-w-0 sm:text-right">
                  <span className="text-muted-foreground block sm:inline">Invoice Total: </span>
                  <span className="font-mono font-semibold text-gray-900">
                    {formatCurrency(Number(paymentData?.invoices?.total_amount || 0))}
                  </span>
                </div>
              </div>

              {/* Main Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Method */}
                <div className="space-y-1.5">
                  <Label className="text-xs">Payment Method</Label>
                  <Select value={method} onValueChange={setMethod}>
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">
                        <div className="flex items-center">
                          <Banknote className="w-3.5 h-3.5 mr-2 text-emerald-600" /> Cash
                        </div>
                      </SelectItem>
                      <SelectItem value="bank">
                        <div className="flex items-center">
                          <Building2 className="w-3.5 h-3.5 mr-2 text-blue-600" /> Bank Transfer
                        </div>
                      </SelectItem>
                      <SelectItem value="cheque">
                        <div className="flex items-center">
                          <CreditCard className="w-3.5 h-3.5 mr-2 text-indigo-600" /> Cheque
                        </div>
                      </SelectItem>
                      <SelectItem value="goods">
                        <div className="flex items-center font-medium text-purple-900">
                          <Package className="w-3.5 h-3.5 mr-2 text-purple-600" /> Goods Settlement
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Amount */}
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center justify-between gap-1">
                    <Label className="text-xs">
                      {isGoods ? "Payment on this Invoice (LKR) *" : "Amount (LKR) *"}
                    </Label>
                    {isGoods && goodsItems.length > 0 && (
                      <button
                        type="button"
                        className="text-[10px] text-purple-700 hover:underline font-medium"
                        onClick={() => {
                          const total = goodsItems.reduce((acc, it) => acc + (it.totalValue || 0), 0);
                          setAmount(Math.round(total * 100) / 100);
                        }}
                      >
                        Match Goods Total ({formatCurrency(goodsItems.reduce((acc, it) => acc + (it.totalValue || 0), 0))})
                      </button>
                    )}
                  </div>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    className="h-9 font-mono font-medium"
                    value={amount || ""}
                    onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                  />
                  {isGoods && (
                    <p className="text-[10px] text-muted-foreground">
                      Total goods returned value: {formatCurrency(goodsItems.reduce((acc, it) => acc + (it.totalValue || 0), 0))}.
                    </p>
                  )}
                </div>

                {/* Date */}
                <div className="space-y-1.5">
                  <Label className="text-xs">Payment Date</Label>
                  <Input
                    type="date"
                    className="h-9"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                  />
                </div>
              </div>

              {/* Cheque Specific Fields */}
              {method === "cheque" && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-indigo-50/40 rounded-lg border border-indigo-100 text-xs">
                  <div className="space-y-1">
                    <Label className="text-xs">Cheque No *</Label>
                    <Input
                      className="h-8"
                      value={chequeNo}
                      onChange={(e) => setChequeNo(e.target.value)}
                      placeholder="xxxxxx"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Cheque Date</Label>
                    <Input
                      type="date"
                      className="h-8"
                      value={chequeDate}
                      onChange={(e) => setChequeDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Cheque Status</Label>
                    <Select value={chequeStatus} onValueChange={setChequeStatus}>
                      <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Pending">Pending</SelectItem>
                        <SelectItem value="Deposited">Deposited</SelectItem>
                        <SelectItem value="Cleared">Cleared</SelectItem>
                        <SelectItem value="Returned">Returned</SelectItem>
                        <SelectItem value="Bounced">Bounced</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              {/* Deposit Account Fields */}
              {(method === "cash" || method === "bank") && accounts.length > 0 && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Deposit Account</Label>
                  <Select value={depositAccountId} onValueChange={setDepositAccountId}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="Select account" /></SelectTrigger>
                    <SelectContent>
                      {accounts.map((acc) => (
                        <SelectItem key={acc.id} value={acc.id}>
                          {acc.account_name} ({acc.account_type})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Receipt Number */}
              <div className="space-y-1.5">
                <Label className="text-xs">Receipt Number (Optional)</Label>
                <Input
                  className="h-9 font-mono text-xs"
                  placeholder="e.g. 5201"
                  value={receiptNumber}
                  onChange={(e) => setReceiptNumber(e.target.value)}
                />
              </div>

              {/* Goods Settlement Section */}
              {isGoods && (
                <div className="space-y-3.5 pt-2 border-t border-purple-200">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <div className="flex items-center gap-2">
                      <Package className="w-4 h-4 text-purple-600 shrink-0" />
                      <h4 className="text-xs sm:text-sm font-bold text-purple-950 uppercase tracking-wide">
                        Goods Settlement Returned Items ({goodsItems.length})
                      </h4>
                    </div>
                    {/* Source Switcher */}
                    <div className="flex flex-wrap sm:flex-nowrap items-center gap-1 bg-purple-100/70 p-1 rounded-md text-xs self-start sm:self-auto">
                      <Button
                        type="button"
                        size="sm"
                        variant={productSource === "invoiced" ? "default" : "ghost"}
                        className={cn(
                          "h-6 text-[11px] px-2.5 rounded font-medium",
                          productSource === "invoiced" ? "bg-purple-600 text-white shadow-xs" : "text-purple-800 hover:bg-purple-200/50"
                        )}
                        onClick={() => {
                          setProductSource("invoiced");
                          setAddProductId("");
                          setAddUnitPrice(0);
                          setAddIsCustomerPurchased(true);
                        }}
                      >
                        <ReceiptText className="w-3 h-3 mr-1 shrink-0" /> Customer Invoiced ({purchasedProducts.length})
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={productSource === "catalog" ? "default" : "ghost"}
                        className={cn(
                          "h-6 text-[11px] px-2.5 rounded font-medium",
                          productSource === "catalog" ? "bg-purple-600 text-white shadow-xs" : "text-purple-800 hover:bg-purple-200/50"
                        )}
                        onClick={() => {
                          setProductSource("catalog");
                          setAddProductId("");
                          setAddUnitPrice(0);
                          setAddIsCustomerPurchased(false);
                        }}
                      >
                        <Boxes className="w-3 h-3 mr-1 shrink-0" /> All Agency Catalog ({catalogProducts.length})
                      </Button>
                    </div>
                  </div>

                  {/* Add New Item Form */}
                  <div className="bg-purple-50/40 p-3 sm:p-3.5 rounded-lg border border-purple-200/80 space-y-2.5 text-xs">
                    <span className="font-semibold text-purple-900 block">Add Returned Product:</span>
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                      {/* Product select */}
                      <div className="sm:col-span-12 md:col-span-5 space-y-1">
                        <Label className="text-[11px]">Product *</Label>
                        <Popover open={productSelectOpen} onOpenChange={setProductSelectOpen}>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              role="combobox"
                              className="w-full justify-between font-normal h-8 text-xs bg-white"
                            >
                              {selectedAddProdObj ? (
                                <span className="truncate">{selectedAddProdObj.name}</span>
                              ) : (
                                <span className="text-muted-foreground">Select Product</span>
                              )}
                              <ChevronsUpDown className="ml-1 h-3.5 w-3.5 opacity-50 shrink-0" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[min(92vw,400px)] p-0" align="start">
                            <Command>
                              <CommandInput placeholder="Search product..." className="h-8 text-xs" />
                              <CommandList className="max-h-56">
                                <CommandEmpty>No products found.</CommandEmpty>
                                <CommandGroup heading={productSource === "invoiced" ? "Customer Invoiced Items" : "Catalog Products"}>
                                  {currentAddProductList.map((p) => (
                                    <CommandItem
                                      key={p.id}
                                      value={`${p.name} ${p.sku} ${p.companyCode || ""}`}
                                      onSelect={() => {
                                        setAddProductId(p.id);
                                        const rate = p.latestUnitPrice ?? p.sellingPrice ?? 0;
                                        setAddUnitPrice(rate);
                                        const invRef = p.latestInvoiceNo || p.invoices?.[0]?.invoiceNo || "";
                                        setAddInvoiceNo(invRef);
                                        const manRef = p.latestManualInvoiceNo || p.invoices?.[0]?.manualInvoiceNo || "";
                                        setAddManualInvoiceNo(manRef);
                                        setAddIsCustomerPurchased(productSource === "invoiced");
                                        setProductSelectOpen(false);
                                      }}
                                    >
                                      <Check className={cn("mr-2 h-3.5 w-3.5", addProductId === p.id ? "opacity-100" : "opacity-0")} />
                                      <div className="flex-1 text-xs">
                                        <div className="font-medium">{p.name}</div>
                                        <div className="text-[10px] text-muted-foreground">
                                          {p.sku} &bull; LKR {(p.sellingPrice || p.latestUnitPrice || 0).toLocaleString()}
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

                      {/* Return Qty */}
                      <div className="sm:col-span-4 md:col-span-2 space-y-1">
                        <Label className="text-[11px]">Qty *</Label>
                        <Input
                          type="number"
                          step="any"
                          min="0.01"
                          className="h-8 text-xs bg-white"
                          value={addQuantity || ""}
                          onChange={(e) => setAddQuantity(parseFloat(e.target.value) || 0)}
                        />
                      </div>

                      {/* Credit Rate */}
                      <div className="sm:col-span-8 md:col-span-3 space-y-1">
                        <Label className="text-[11px]">Unit Rate (LKR) *</Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          className="h-8 text-xs bg-white"
                          value={addUnitPrice || ""}
                          onChange={(e) => setAddUnitPrice(parseFloat(e.target.value) || 0)}
                        />
                        {selectedAddProdObj && (
                          <div className="flex flex-wrap items-center gap-1 pt-0.5">
                            {Number(selectedAddProdObj.costPrice) > 0 && (
                              <button
                                type="button"
                                className="text-[9px] text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-1.5 py-0.5 rounded font-medium transition-colors"
                                onClick={() => setAddUnitPrice(Number(selectedAddProdObj.costPrice))}
                              >
                                Cost: {formatCurrency(Number(selectedAddProdObj.costPrice))}
                              </button>
                            )}
                            {Number(selectedAddProdObj.sellingPrice) > 0 && (
                              <button
                                type="button"
                                className="text-[9px] text-purple-800 bg-purple-50 hover:bg-purple-100 border border-purple-200 px-1.5 py-0.5 rounded font-medium transition-colors"
                                onClick={() => setAddUnitPrice(Number(selectedAddProdObj.sellingPrice))}
                              >
                                Selling: {formatCurrency(Number(selectedAddProdObj.sellingPrice))}
                              </button>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Add Button */}
                      <div className="sm:col-span-12 md:col-span-2 flex items-end">
                        <Button
                          type="button"
                          size="sm"
                          className="h-8 w-full bg-purple-600 hover:bg-purple-700 text-white text-xs font-medium"
                          onClick={handleAddGoodsItem}
                        >
                          <Plus className="w-3.5 h-3.5 mr-1 shrink-0" /> Add Item
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Items Table */}
                  <div className="rounded-lg border border-purple-200 overflow-hidden bg-white shadow-xs">
                    <div className="overflow-x-auto">
                      {goodsItems.length === 0 ? (
                        <div className="p-6 text-center text-xs text-muted-foreground italic">
                          No returned items in this settlement yet. Add products using the form above.
                        </div>
                      ) : (
                        <Table className="min-w-[680px] w-full">
                          <TableHeader className="bg-purple-50/60 sticky top-0 z-10">
                            <TableRow>
                              <TableHead className="text-xs font-semibold min-w-[200px]">Product</TableHead>
                              <TableHead className="text-xs font-semibold min-w-[110px]">Bill Ref</TableHead>
                              <TableHead className="text-xs font-semibold text-right min-w-[70px]">Quantity</TableHead>
                              <TableHead className="text-xs font-semibold text-right min-w-[100px]">Rate (LKR)</TableHead>
                              <TableHead className="text-xs font-semibold text-right min-w-[110px]">Credit Total</TableHead>
                              <TableHead className="text-xs font-semibold min-w-[90px]">Condition</TableHead>
                              <TableHead className="text-xs font-semibold text-center w-20 min-w-[70px]">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {goodsItems.map((item) => (
                              <TableRow key={item.id} className="hover:bg-purple-50/20 text-xs">
                                <TableCell className="py-2.5">
                                  <div className="font-semibold text-gray-900 leading-snug">{item.productName}</div>
                                  {item.sku && <div className="text-[10px] text-muted-foreground font-mono mt-0.5">{item.sku}</div>}
                                </TableCell>
                                <TableCell className="py-2.5">
                                  {item.invoiceNo || item.manualInvoiceNo ? (
                                    <div className="flex flex-col text-[11px] leading-tight">
                                      {item.invoiceNo && <span className="font-medium text-emerald-700">{item.invoiceNo}</span>}
                                      {item.manualInvoiceNo && <span className="text-muted-foreground">Man: {item.manualInvoiceNo}</span>}
                                    </div>
                                  ) : (
                                    <span className="text-muted-foreground">—</span>
                                  )}
                                </TableCell>
                                <TableCell className="py-2.5 text-right font-medium">
                                  {item.quantity}
                                </TableCell>
                                <TableCell className="py-2.5 text-right font-mono">
                                  {formatCurrency(item.unitPrice)}
                                </TableCell>
                                <TableCell className="py-2.5 text-right font-bold text-purple-900 font-mono">
                                  {formatCurrency(item.totalValue)}
                                </TableCell>
                                <TableCell className="py-2.5">
                                  <Badge
                                    variant="outline"
                                    className={cn(
                                      "text-[10px] px-1.5 py-0 whitespace-nowrap",
                                      item.returnType === "Damage" ? "border-red-300 text-red-700 bg-red-50" : "border-emerald-300 text-emerald-700 bg-emerald-50"
                                    )}
                                  >
                                    {item.returnType} Stock
                                  </Badge>
                                </TableCell>
                                <TableCell className="py-2.5 text-center">
                                  <div className="flex items-center justify-center gap-1">
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      title="Edit Return Item Details"
                                      className="h-7 w-7 text-purple-600 hover:text-purple-800 hover:bg-purple-50"
                                      onClick={() => handleOpenEditItem(item)}
                                    >
                                      <Pencil className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      title="Delete Item"
                                      className="h-7 w-7 text-red-500 hover:text-red-700 hover:bg-red-50"
                                      onClick={() => handleRemoveGoodsItem(item.id)}
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="p-3 sm:p-4 border-t bg-gray-50/90 shrink-0 flex flex-row items-center justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={saving || loading}
              className="bg-purple-600 hover:bg-purple-700 text-white font-medium shadow-xs"
              onClick={handleSubmit}
            >
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mini Edit Single Settlement Item Dialog */}
      <Dialog open={!!editingItem} onOpenChange={(open) => !open && setEditingItem(null)}>
        <DialogContent className="w-[95vw] sm:max-w-lg max-h-[90vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-sm sm:text-base font-bold flex items-center gap-2">
              <Pencil className="w-4 h-4 text-purple-600 shrink-0" />
              <span className="truncate">Edit {editingItem?.productName}</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Change product, returned quantity, unit credit rate, bill reference, or condition.
            </DialogDescription>
          </DialogHeader>

          {editingItem && (
            <div className="space-y-3.5 py-2 text-xs">
              {/* Product selector in edit dialog */}
              <div className="space-y-1">
                <Label className="text-xs">Product</Label>
                <Popover open={editProductSelectOpen} onOpenChange={setEditProductSelectOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" className="w-full justify-between h-9 text-xs bg-white">
                      <span className="truncate">
                        {catalogProducts.find((p) => p.id === editProductId)?.name ||
                          purchasedProducts.find((p) => p.id === editProductId)?.name ||
                          editingItem.productName}
                      </span>
                      <ChevronsUpDown className="ml-1 h-3.5 w-3.5 opacity-50 shrink-0" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[min(90vw,360px)] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Change product..." className="h-8 text-xs" />
                      <CommandList className="max-h-52">
                        <CommandGroup heading="Available Products">
                          {catalogProducts.map((p) => (
                            <CommandItem
                              key={p.id}
                              value={`${p.name} ${p.sku}`}
                              onSelect={() => {
                                setEditProductId(p.id);
                                if (editUnitPrice <= 0 && p.sellingPrice) {
                                  setEditUnitPrice(p.sellingPrice);
                                }
                                setEditProductSelectOpen(false);
                              }}
                            >
                              <Check className={cn("mr-2 h-3.5 w-3.5", editProductId === p.id ? "opacity-100" : "opacity-0")} />
                              <div className="flex-1 text-xs">
                                <div className="font-medium">{p.name}</div>
                                <div className="text-[10px] text-muted-foreground">{p.sku}</div>
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Return Quantity</Label>
                  <Input
                    type="number"
                    min="0.01"
                    step="any"
                    value={editQuantity}
                    onChange={(e) => setEditQuantity(parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Credit Unit Rate (LKR)</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={editUnitPrice}
                    onChange={(e) => setEditUnitPrice(parseFloat(e.target.value) || 0)}
                  />
                  {(() => {
                    const prod =
                      catalogProducts.find((p) => p.id === editProductId) ||
                      purchasedProducts.find((p) => p.id === editProductId);
                    if (!prod) return null;
                    return (
                      <div className="flex flex-wrap items-center gap-1 pt-0.5">
                        {Number(prod.costPrice) > 0 && (
                          <button
                            type="button"
                            className="text-[10px] text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-1.5 py-0.5 rounded font-medium transition-colors"
                            onClick={() => setEditUnitPrice(Number(prod.costPrice))}
                          >
                            Cost: {formatCurrency(Number(prod.costPrice))}
                          </button>
                        )}
                        {Number(prod.sellingPrice) > 0 && (
                          <button
                            type="button"
                            className="text-[10px] text-purple-800 bg-purple-50 hover:bg-purple-100 border border-purple-200 px-1.5 py-0.5 rounded font-medium transition-colors"
                            onClick={() => setEditUnitPrice(Number(prod.sellingPrice))}
                          >
                            Selling: {formatCurrency(Number(prod.sellingPrice))}
                          </button>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Invoice No (System Ref)</Label>
                  <Input
                    placeholder="e.g. SI-0102"
                    value={editInvoiceNo}
                    onChange={(e) => setEditInvoiceNo(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Manual Bill Ref</Label>
                  <Input
                    placeholder="e.g. 1042 / MB-09"
                    value={editManualInvoiceNo}
                    onChange={(e) => setEditManualInvoiceNo(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Stock Condition</Label>
                  <Select
                    value={editReturnType}
                    onValueChange={(v) => setEditReturnType(v as "Good" | "Damage")}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Good">Good (Sellable Stock)</SelectItem>
                      <SelectItem value="Damage">Damaged Stock</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Receiving Location</Label>
                  <Select value={editLocationId} onValueChange={setEditLocationId}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {locations.map((loc) => (
                        <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 pt-3 border-t">
                <div className="text-xs text-muted-foreground">
                  New Total: <span className="font-bold text-gray-900">{formatCurrency(editQuantity * editUnitPrice)}</span>
                </div>
                <div className="flex gap-2 w-full sm:w-auto justify-end">
                  <Button type="button" variant="outline" size="sm" onClick={() => setEditingItem(null)}>
                    Cancel
                  </Button>
                  <Button type="button" size="sm" className="bg-purple-600 hover:bg-purple-700 text-white" onClick={handleSaveEditItem}>
                    Save Item Changes
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
