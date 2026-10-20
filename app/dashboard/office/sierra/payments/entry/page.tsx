"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Check,
  ChevronsUpDown,
  Loader2,
  AlertCircle,
  ReceiptText,
  BanknoteIcon,
  Mountain,
  History,
  Download,
  Printer,
  Share2,
  Package,
  Plus,
  Trash2,
  Sparkles,
  Boxes,
  Pencil,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardDescription,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getUserBusinessContext } from "@/app/middleware/businessAuth";
import { BUSINESS_IDS } from "@/app/config/business-constants";
import { invalidatePaymentCaches } from "@/hooks/useCachedFetch";
import { ReceiptNumberInput } from "@/components/receipt-books/ReceiptNumberInput";
import {
  downloadCustomerStatement,
  printCustomerStatement,
  shareCustomerStatement,
  InvoicePaymentRecord,
} from "@/lib/customer-statement-report";

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("en-LK", { style: "currency", currency: "LKR", minimumFractionDigits: 2 }).format(amount);

const getInvoiceAgeDays = (dateStr: string): number => {
  if (!dateStr) return 0;
  const invDate = new Date(dateStr);
  const today = new Date();
  const diffTime = today.getTime() - invDate.getTime();
  return Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
};

const renderAgeBadge = (days: number) => {
  let badgeStyle = "bg-green-50 text-green-700 border-green-200";
  if (days >= 90) {
    badgeStyle = "bg-red-100 text-red-700 border-red-200 font-semibold";
  } else if (days >= 60) {
    badgeStyle = "bg-orange-100 text-orange-700 border-orange-200";
  } else if (days >= 30) {
    badgeStyle = "bg-yellow-50 text-yellow-800 border-yellow-200";
  }
  return (
    <Badge variant="outline" className={`${badgeStyle} text-[11px] whitespace-nowrap`}>
      {days} {days === 1 ? "day" : "days"}
    </Badge>
  );
};

interface Customer { id: string; name: string; phone?: string; ownerName?: string; }
interface Bank { id: string; bank_code: string; bank_name: string; }
interface CompanyAccount { id: string; account_name: string; account_type: string; account_number?: string | null; }
interface Location { id: string; name: string; }
const isSierraProduct = (p: any): boolean => {
  if (!p) return false;
  if (p.retailOnly) return false;
  const supplier = (p.supplier || p.supplier_name || "").toLowerCase();
  const brand = (p.brand || "").toLowerCase();
  const name = (p.name || "").toLowerCase();
  return (
    supplier.includes("sierra") ||
    brand.includes("sierra") ||
    name.includes("sierra")
  );
};

interface PurchasedProduct {
  id: string;
  sku: string;
  name: string;
  companyCode?: string;
  stock?: number;
  currentStock?: number;
  supplier?: string;
  brand?: string;
  retailOnly?: boolean;
  totalPurchasedQty?: number;
  latestUnitPrice?: number;
  latestInvoiceNo?: string;
  latestManualInvoiceNo?: string;
  sellingPrice?: number;
  invoices?: Array<{ invoiceNo: string; manualInvoiceNo?: string; unitPrice: number; quantity: number }>;
  history?: Array<{ invoiceNo: string; manualInvoiceNo?: string; unitPrice: number; quantity: number }>;
}
interface CatalogProduct {
  id: string;
  sku: string;
  name: string;
  companyCode?: string;
  stock?: number;
  sellingPrice?: number;
  supplier?: string;
  brand?: string;
  retailOnly?: boolean;
}
export interface GoodsSettlementItem {
  id: string;
  type: "own_product";
  isCustomerPurchased: boolean;
  productId: string;
  productName: string;
  sku: string;
  invoiceNo?: string;
  manualInvoiceNo?: string;
  returnType: "Good" | "Damage";
  locationId: string;
  locationName: string;
  quantity: number;
  unitPrice: number;
  totalValue: number;
}
interface PendingInvoice {
  id: string;
  invoiceNo: string;
  manualInvoiceNo?: string;
  date: string;
  totalAmount: number;
  paidAmount: number;
  balance: number;
  payments?: InvoicePaymentRecord[];
}
interface InvoiceSettlement { invoiceId: string; selected: boolean; settleAmount: number; }
type PaymentMethod = "cash" | "bank" | "cheque" | "goods";

function StepBadge({ step, label }: { step: number; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-purple-600 text-white text-xs font-bold flex-shrink-0">{step}</div>
      <span className="text-sm font-medium text-muted-foreground">{label}</span>
    </div>
  );
}

export default function SierraPaymentEntryPage() {
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [companyAccounts, setCompanyAccounts] = useState<CompanyAccount[]>([]);
  const [pendingInvoices, setPendingInvoices] = useState<PendingInvoice[]>([]);
  const [loadingCustomers, setLoadingCustomers] = useState(true);
  const [loadingBanks, setLoadingBanks] = useState(true);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [customerOpen, setCustomerOpen] = useState(false);
  const [bankOpen, setBankOpen] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split("T")[0]);
  const [totalAmount, setTotalAmount] = useState<number>(0);
  const [notes, setNotes] = useState("");
  const [chequeNumber, setChequeNumber] = useState("");
  const [chequeDate, setChequeDate] = useState("");
  const [selectedBankId, setSelectedBankId] = useState("");
  const [branchCode, setBranchCode] = useState("");
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [receiptNumber, setReceiptNumber] = useState("");
  const [receiptBookId, setReceiptBookId] = useState<string | undefined>(undefined);
  const [paidOnCustomerBill, setPaidOnCustomerBill] = useState(false);
  const [settlements, setSettlements] = useState<Record<string, InvoiceSettlement>>({});
  const [historyModalInvoice, setHistoryModalInvoice] = useState<PendingInvoice | null>(null);

  // --- Sierra Products Settlement State ---
  const [locations, setLocations] = useState<Location[]>([]);
  const [purchasedProducts, setPurchasedProducts] = useState<PurchasedProduct[]>([]);
  const [catalogProducts, setCatalogProducts] = useState<CatalogProduct[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [goodsItems, setGoodsItems] = useState<GoodsSettlementItem[]>([]);
  const [productSource, setProductSource] = useState<"invoiced" | "catalog">("catalog");
  const [productSelectOpen, setProductSelectOpen] = useState(false);

  // Sierra product return form state
  const [ownProductId, setOwnProductId] = useState("");
  const [ownQuantity, setOwnQuantity] = useState<number>(1);
  const [ownUnitPrice, setOwnUnitPrice] = useState<number>(0);
  const [ownReturnType, setOwnReturnType] = useState<"Good" | "Damage">("Good");
  const [ownLocationId, setOwnLocationId] = useState<string>("");
  const [ownInvoiceNo, setOwnInvoiceNo] = useState<string>("");
  const [ownManualInvoiceNo, setOwnManualInvoiceNo] = useState<string>("");
  const [ownIsCustomerPurchased, setOwnIsCustomerPurchased] = useState<boolean>(true);

  // Edit goods item dialog state
  const [editingItem, setEditingItem] = useState<GoodsSettlementItem | null>(null);
  const [editQuantity, setEditQuantity] = useState<number>(1);
  const [editUnitPrice, setEditUnitPrice] = useState<number>(0);
  const [editInvoiceNo, setEditInvoiceNo] = useState<string>("");
  const [editManualInvoiceNo, setEditManualInvoiceNo] = useState<string>("");
  const [editReturnType, setEditReturnType] = useState<"Good" | "Damage">("Good");
  const [editLocationId, setEditLocationId] = useState<string>("");
  const [editIsCustomerPurchased, setEditIsCustomerPurchased] = useState<boolean>(true);

  useEffect(() => {
    const user = getUserBusinessContext();
    setBusinessId(BUSINESS_IDS.SIERRA_AGENCY);
  }, []);

  useEffect(() => {
    if (!businessId) return;
    const run = async () => {
      try {
        const res = await fetch(`/api/invoices?businessId=${businessId}`);
        if (res.ok) {
          const data = await res.json();
          const unpaid = data.filter((inv: any) => inv.orderStatus === "Delivered" && inv.status !== "Paid" && (inv.dueAmount ?? 0) > 0);
          const seen = new Set<string>(); const unique: Customer[] = [];
          for (const inv of unpaid) {
            if (!seen.has(inv.customerId)) { seen.add(inv.customerId); unique.push({ id: inv.customerId, name: inv.customerName || "Unknown" }); }
          }
          unique.sort((a, b) => a.name.localeCompare(b.name));
          setCustomers(unique);
        }
      } catch { toast.error("Failed to load customers"); } finally { setLoadingCustomers(false); }

      try {
        const res = await fetch("/api/finance/bank-codes");
        if (res.ok) setBanks((await res.json()) ?? []);
      } catch { toast.error("Failed to load banks"); } finally { setLoadingBanks(false); }

      try {
        const res = await fetch(`/api/finance/accounts?businessId=${businessId}`);
        if (res.ok) setCompanyAccounts(((await res.json()) ?? []).filter((a: any) => a.is_active !== false));
      } catch { toast.error("Failed to load accounts"); } finally { setLoadingAccounts(false); }

      try {
        const res = await fetch(`/api/settings/locations?businessId=${businessId}`);
        if (res.ok) {
          const locs = await res.json();
          if (locs && locs.length > 0) {
            setLocations(locs);
            setOwnLocationId(locs[0].id);
          } else {
            const def = [{ id: "0b68fd7b-6a40-496f-9279-0a003c26b211", name: "Main Warehouse" }];
            setLocations(def);
            setOwnLocationId(def[0].id);
          }
        }
      } catch {
        const def = [{ id: "0b68fd7b-6a40-496f-9279-0a003c26b211", name: "Main Warehouse" }];
        setLocations(def);
        setOwnLocationId(def[0].id);
      }

      try {
        const res = await fetch("/api/products?active=true");
        if (res.ok) {
          const pData = await res.json();
          const sierraCatalog = (pData || [])
            .filter(isSierraProduct)
            .map((p: any) => ({
              id: p.id,
              name: p.name,
              sku: p.sku || "",
              companyCode: p.companyCode || p.company_code || "",
              stock: p.stock ?? p.stock_quantity ?? 0,
              sellingPrice: p.sellingPrice || p.selling_price || 0,
              supplier: p.supplier || p.supplier_name || "",
              brand: p.brand || "",
              retailOnly: p.retailOnly || false,
            }));
          setCatalogProducts(sierraCatalog);
        }
      } catch {}
    };
    run();
  }, [businessId]);

  // Load customer's past purchased Sierra products whenever customer changes
  useEffect(() => {
    if (!selectedCustomerId) {
      setPurchasedProducts([]);
      return;
    }
    setLoadingProducts(true);
    fetch(`/api/customers/${selectedCustomerId}/purchased-products?businessId=${BUSINESS_IDS.SIERRA_AGENCY}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data: any[]) => {
        const sierraPurchased = (data || []).filter(isSierraProduct).map((p: any) => ({
          ...p,
          companyCode: p.companyCode || p.company_code || "",
          stock: p.currentStock ?? p.stock ?? p.stock_quantity ?? 0,
        }));
        setPurchasedProducts(sierraPurchased);
        if (sierraPurchased.length > 0) {
          setProductSource("invoiced");
        } else {
          setProductSource("catalog");
        }
      })
      .catch(() => setPurchasedProducts([]))
      .finally(() => setLoadingProducts(false));
  }, [selectedCustomerId]);

  // Auto-sync total payment amount when goods items change
  useEffect(() => {
    if (paymentMethod === "goods") {
      const sum = goodsItems.reduce((acc, it) => acc + (it.totalValue || 0), 0);
      setTotalAmount(Math.round(sum * 100) / 100);
    }
  }, [goodsItems, paymentMethod]);

  const availableAccounts = companyAccounts.filter((acc) => {
    const t = (acc.account_type || "").toLowerCase();
    if (paymentMethod === "cash")
      return t === "cash" || t === "cash on hand" || t === "wallet";
    if (paymentMethod === "bank")
      return t === "bank" || t === "savings" || t === "current";
    return false;
  });

  const fetchPendingInvoices = useCallback(async (customerId: string) => {
    if (!customerId || !businessId) return;
    setLoadingInvoices(true); setPendingInvoices([]); setSettlements({});
    try {
      const [invRes, payRes] = await Promise.all([
        fetch(`/api/invoices?businessId=${businessId}`),
        fetch(`/api/payments?businessId=${businessId}`),
      ]);

      if (invRes.ok) {
        const invoicesData = await invRes.json();
        const paymentsData = payRes.ok ? await payRes.json() : [];

        // Build payment history map per invoice ID
        const paymentMap: Record<string, InvoicePaymentRecord[]> = {};
        (paymentsData || []).forEach((p: any) => {
          if (p.is_cancelled) return;
          const invId = p.invoice_id || p.invoices?.id;
          const invNo = p.invoices?.invoice_no || p.orders?.order_number;
          const key = invId || invNo;
          if (!key) return;
          if (!paymentMap[key]) paymentMap[key] = [];
          const isGoods = (p.payment_method || p.method) === "goods";
          paymentMap[key].push({
            id: p.id,
            paymentDate: p.payment_date,
            amount: p.amount,
            method: p.payment_method || p.method || "cash",
            receiptNumber: p.receipt_number || p.receiptNumber || null,
            chequeNo: isGoods ? null : (p.cheque_number || p.cheque_no || null),
            chequeStatus: isGoods ? null : (p.cheque_status || null),
            goodsSummary: isGoods ? (p.cheque_number || p.cheque_no || p.notes || "Goods Settlement") : null,
            notes: p.notes || null,
          });
        });

        // Find latest payment date for selected customer
        let latestCustomerPaymentDate: string | null = null;
        (paymentsData || []).forEach((p: any) => {
          if (p.is_cancelled) return;
          const pCustId = p.customer_id || p.customerId || p.orders?.customer_id;
          if (pCustId && pCustId === customerId) {
            const pDate = p.payment_date || p.date;
            if (pDate) {
              const dStr = pDate.split("T")[0];
              if (!latestCustomerPaymentDate || dStr > latestCustomerPaymentDate) {
                latestCustomerPaymentDate = dStr;
              }
            }
          }
        });

        const filtered: PendingInvoice[] = invoicesData
          .filter((inv: any) => {
            if (inv.customerId !== customerId || inv.orderStatus !== "Delivered") return false;
            const isUnpaid = inv.status !== "Paid" && (inv.dueAmount ?? 0) > 0;
            const invKey = inv.orderId || inv.id;
            const history = paymentMap[invKey] || paymentMap[inv.id] || paymentMap[inv.invoiceNo] || [];
            const hasLastPayment = latestCustomerPaymentDate
              ? history.some((p) => p.paymentDate && p.paymentDate.split("T")[0] === latestCustomerPaymentDate)
              : false;

            return isUnpaid || hasLastPayment;
          })
          .map((inv: any) => {
            const invKey = inv.orderId || inv.id;
            const history = paymentMap[invKey] || paymentMap[inv.id] || paymentMap[inv.invoiceNo] || [];
            return {
              id: invKey,
              invoiceNo: inv.invoiceNo,
              manualInvoiceNo: inv.manualInvoiceNo || undefined,
              date: inv.date || (inv.createdAt?.split("T")[0] ?? ""),
              totalAmount: inv.totalAmount ?? 0,
              paidAmount: inv.paidAmount ?? 0,
              balance: inv.dueAmount ?? 0,
              payments: history,
            };
          });

        setPendingInvoices(filtered);
        const map: Record<string, InvoiceSettlement> = {};
        filtered.forEach((inv) => { map[inv.id] = { invoiceId: inv.id, selected: false, settleAmount: 0 }; });
        setSettlements(map);
      }
    } catch { toast.error("Failed to load invoices"); } finally { setLoadingInvoices(false); }
  }, [businessId]);

  useEffect(() => { if (selectedCustomerId) fetchPendingInvoices(selectedCustomerId); else { setPendingInvoices([]); setSettlements({}); } }, [selectedCustomerId, fetchPendingInvoices]);
  useEffect(() => { setSelectedAccountId(""); }, [paymentMethod]);

  const totalAllocated = Object.values(settlements).filter((s) => s.selected).reduce((sum, s) => sum + (s.settleAmount || 0), 0);
  const remaining = totalAmount - totalAllocated;
  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId);
  const selectedBank = banks.find((b) => b.id === selectedBankId);

  const toggleInvoice = (invoiceId: string, invoice: PendingInvoice) => {
    setSettlements((prev) => {
      const nowSelected = !prev[invoiceId].selected;
      const alreadyAllocated = Object.values(prev).filter((s) => s.selected && s.invoiceId !== invoiceId).reduce((sum, s) => sum + s.settleAmount, 0);
      const autoAmount = nowSelected ? Math.min(invoice.balance, Math.max(0, totalAmount - alreadyAllocated)) : 0;
      return { ...prev, [invoiceId]: { ...prev[invoiceId], selected: nowSelected, settleAmount: autoAmount } };
    });
  };

  const updateSettleAmount = (invoiceId: string, value: number, max: number) =>
    setSettlements((prev) => ({ ...prev, [invoiceId]: { ...prev[invoiceId], settleAmount: Math.min(Math.max(0, value), max) } }));

  const resetForm = () => {
    setSelectedCustomerId(""); setPaymentMethod("cash"); setPaymentDate(new Date().toISOString().split("T")[0]);
    setTotalAmount(0); setNotes(""); setChequeNumber(""); setChequeDate(""); setSelectedBankId(""); setBranchCode(""); setSelectedAccountId("");
    setReceiptNumber(""); setReceiptBookId(undefined);
    setGoodsItems([]);
    setOwnProductId("");
    setOwnQuantity(1);
    setOwnUnitPrice(0);
    setOwnInvoiceNo("");
    setOwnManualInvoiceNo("");
    setOwnIsCustomerPurchased(true);
    setEditingItem(null);
    setProductSource("invoiced");
    setPendingInvoices([]); setSettlements({});
  };

  const isReceiptOptional = paymentMethod === "bank" || paymentMethod === "goods" || paidOnCustomerBill;
  const isReceiptRequired = !isReceiptOptional;

  const handleAddOwnProduct = () => {
    if (!ownProductId) {
      toast.error("Please select a Sierra product");
      return;
    }
    if (ownQuantity <= 0) {
      toast.error("Quantity must be greater than 0");
      return;
    }
    if (ownUnitPrice < 0) {
      toast.error("Unit price cannot be negative");
      return;
    }

    const currentList = productSource === "invoiced" ? purchasedProducts : catalogProducts;
    const selectedProd =
      currentList.find((p) => p.id === ownProductId) ||
      catalogProducts.find((p) => p.id === ownProductId) ||
      purchasedProducts.find((p) => p.id === ownProductId);

    const loc = locations.find((l) => l.id === ownLocationId) || locations[0];

    const newItem: GoodsSettlementItem = {
      id: `sierra_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      type: "own_product",
      isCustomerPurchased: ownIsCustomerPurchased,
      productId: ownProductId,
      productName: selectedProd?.name || "Sierra Product",
      sku: selectedProd?.sku || "",
      invoiceNo: ownInvoiceNo.trim() || undefined,
      manualInvoiceNo: ownManualInvoiceNo.trim() || undefined,
      returnType: ownReturnType,
      locationId: loc?.id || "0b68fd7b-6a40-496f-9279-0a003c26b211",
      locationName: loc?.name || "Main Warehouse",
      quantity: ownQuantity,
      unitPrice: ownUnitPrice,
      totalValue: Math.round(ownQuantity * ownUnitPrice * 100) / 100,
    };

    setGoodsItems((prev) => [...prev, newItem]);
    toast.success(`Added ${newItem.productName} (LKR ${newItem.totalValue.toLocaleString()})`);

    setOwnProductId("");
    setOwnQuantity(1);
    setOwnUnitPrice(0);
    setOwnInvoiceNo("");
    setOwnManualInvoiceNo("");
    setOwnIsCustomerPurchased(productSource === "invoiced");
  };

  const handleRemoveGoodsItem = (id: string) => {
    setGoodsItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleOpenEdit = (item: GoodsSettlementItem) => {
    setEditingItem(item);
    setEditQuantity(item.quantity);
    setEditUnitPrice(item.unitPrice);
    setEditInvoiceNo(item.invoiceNo || "");
    setEditManualInvoiceNo(item.manualInvoiceNo || "");
    setEditReturnType(item.returnType);
    setEditLocationId(item.locationId);
    setEditIsCustomerPurchased(item.isCustomerPurchased !== false);
  };

  const handleSaveEdit = () => {
    if (!editingItem) return;
    if (editQuantity <= 0) {
      toast.error("Quantity must be greater than 0");
      return;
    }
    if (editUnitPrice < 0) {
      toast.error("Unit price cannot be negative");
      return;
    }

    const loc =
      locations.find((l) => l.id === editLocationId) ||
      locations.find((l) => l.id === editingItem.locationId) ||
      locations[0];

    setGoodsItems((prev) =>
      prev.map((it) => {
        if (it.id !== editingItem.id) return it;
        return {
          ...it,
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

    toast.success(`Updated ${editingItem.productName}`);
    setEditingItem(null);
  };

  const buildGoodsSummary = () => {
    return goodsItems
      .map((item) => {
        const parts = [
          item.invoiceNo ? `Bill: ${item.invoiceNo}` : null,
          item.manualInvoiceNo ? `Manual: ${item.manualInvoiceNo}` : null,
          item.isCustomerPurchased !== false ? "CustomerBilled" : "OtherAgencyStock",
        ].filter(Boolean).join(", ");
        const total = item.totalValue ?? (item.quantity * item.unitPrice);
        return `${item.quantity}x ${item.productName} (${item.returnType}${parts ? ` | ${parts}` : ""}) @ LKR ${total.toLocaleString()}`;
      })
      .join(" ; ");
  };

  const autoAllocateOldest = () => {
    if (totalAmount <= 0) {
      toast.error("Please enter or calculate an amount first");
      return;
    }
    let rem = totalAmount;
    const newSettlements: Record<string, InvoiceSettlement> = {};
    const sorted = [...pendingInvoices].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    for (const inv of sorted) {
      if (rem <= 0) {
        newSettlements[inv.id] = { invoiceId: inv.id, selected: false, settleAmount: 0 };
      } else {
        const alloc = Math.min(inv.balance, rem);
        newSettlements[inv.id] = { invoiceId: inv.id, selected: true, settleAmount: alloc };
        rem -= alloc;
      }
    }
    setSettlements(newSettlements);
    toast.success(`Auto-allocated LKR ${(totalAmount - rem).toLocaleString()} across pending invoices`);
  };

  const validate = () => {
    if (!selectedCustomerId) { toast.error("Please select a customer"); return false; }
    if (isReceiptRequired && !receiptNumber.trim()) { toast.error("Please enter receipt number"); return false; }
    if (paymentMethod === "goods") {
      if (goodsItems.length === 0) { toast.error("Please add at least one goods/product item to settle this payment"); return false; }
    }
    if (totalAmount <= 0) { toast.error("Please enter a valid amount"); return false; }
    if (paymentMethod === "cheque") {
      if (!chequeNumber.trim()) { toast.error("Please enter cheque number"); return false; }
      if (!chequeDate) { toast.error("Please enter cheque date"); return false; }
      if (!selectedBankId) { toast.error("Please select a bank"); return false; }
    }
    if ((paymentMethod === "cash" || paymentMethod === "bank") && !selectedAccountId) { toast.error("Please select an account"); return false; }
    if (Object.values(settlements).filter((s) => s.selected && s.settleAmount > 0).length === 0) { toast.error("Please select at least one invoice to settle"); return false; }
    if (totalAllocated > totalAmount) { toast.error("Allocated exceeds payment"); return false; }
    return true;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setIsSubmitting(true);
    let successCount = 0, failCount = 0;
    const goodsSummaryStr = paymentMethod === "goods" ? buildGoodsSummary() : undefined;
    let isFirstGoodsInvoice = true;

    try {
      for (const s of Object.values(settlements).filter((s) => s.selected && s.settleAmount > 0)) {
        const res = await fetch("/api/payments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            orderId: s.invoiceId,
            customerId: selectedCustomerId,
            amount: s.settleAmount,
            date: paymentDate,
            method: paymentMethod,
            notes: notes || undefined,
            depositAccountId: paymentMethod !== "cheque" && paymentMethod !== "goods" ? selectedAccountId : null,
            chequeNo: paymentMethod === "cheque" ? chequeNumber : null,
            chequeDate: paymentMethod === "cheque" ? chequeDate : null,
            bankId: paymentMethod === "cheque" ? selectedBankId : null,
            branchCode: paymentMethod === "cheque" ? branchCode : null,
            receiptNumber: receiptNumber || undefined,
            receiptBookId: receiptBookId || undefined,
            performedById: getUserBusinessContext()?.id ?? null,
            performedByName: getUserBusinessContext()?.name ?? null,
            performedByEmail: getUserBusinessContext()?.email ?? null,
            goodsItems: paymentMethod === "goods" ? goodsItems : undefined,
            goodsSummary: goodsSummaryStr,
            isSecondaryGoodsSettlement: paymentMethod === "goods" && !isFirstGoodsInvoice,
          }),
        });
        if (res.ok) {
          successCount++;
          isFirstGoodsInvoice = false;
        } else {
          failCount++;
        }
      }
      if (successCount > 0) {
        toast.success(`Payment recorded successfully!`);
        const currentCustId = selectedCustomerId;
        resetForm();
        invalidatePaymentCaches();
        if (currentCustId) {
          setSelectedCustomerId(currentCustId);
          fetchPendingInvoices(currentCustId);
        }
      }
      if (failCount > 0) toast.error(`${failCount} payment(s) failed.`);
    } catch {
      toast.error("An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  const soldToCustomerItems = goodsItems.filter((it) => it.isCustomerPurchased !== false);
  const notSoldToCustomerItems = goodsItems.filter((it) => it.isCustomerPurchased === false);
  const soldSubtotal = soldToCustomerItems.reduce((acc, it) => acc + (it.totalValue || 0), 0);
  const notSoldSubtotal = notSoldToCustomerItems.reduce((acc, it) => acc + (it.totalValue || 0), 0);

  const methodLabel: Record<PaymentMethod, string> = {
    cash: "Cash",
    bank: "Bank Transfer",
    cheque: "Cheque",
    goods: "Goods Settlement",
  };

  const selectedProductObj =
    (productSource === "catalog" ? catalogProducts : purchasedProducts).find((p) => p.id === ownProductId) ||
    catalogProducts.find((p) => p.id === ownProductId) ||
    purchasedProducts.find((p) => p.id === ownProductId);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100">
          <Mountain className="h-5 w-5 text-purple-600" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-purple-900">Payment Entry</h1>
          <p className="text-muted-foreground text-sm">Record a customer payment and settle pending invoices</p>
        </div>
      </div>

      {/* Step 1 */}
      <Card className="border-purple-100">
        <CardHeader className="pb-3">
          <StepBadge step={1} label="Payment Details" />
          <CardDescription>Select customer, payment method, and enter payment information</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2 sm:col-span-2 lg:col-span-1">
              <Label>Customer *</Label>
              <Popover open={customerOpen} onOpenChange={setCustomerOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" className="w-full justify-between font-normal" disabled={loadingCustomers || !businessId}>
                    {loadingCustomers || !businessId ? <span className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" />Loading…</span>
                      : selectedCustomer ? <span className="truncate">{selectedCustomer.name}</span>
                      : <span className="text-muted-foreground">Select customer…</span>}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="p-0" style={{ width: "var(--radix-popover-trigger-width)" }}>
                  <Command>
                    <CommandInput placeholder="Search customers…" />
                    <CommandList>
                      <CommandEmpty>No customers with pending invoices.</CommandEmpty>
                      <CommandGroup>
                        {customers.map((c) => (
                          <CommandItem key={c.id} value={c.name} onSelect={() => { setSelectedCustomerId(c.id); setCustomerOpen(false); }}>
                            <Check className={cn("mr-2 h-4 w-4", selectedCustomerId === c.id ? "opacity-100" : "opacity-0")} />
                            <span className="font-medium">{c.name}</span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>
                  Receipt Number {isReceiptRequired ? <span className="text-red-500">*</span> : <span className="text-muted-foreground font-normal text-xs">(Optional)</span>}
                </Label>
                <div className="flex items-center space-x-1.5 cursor-pointer">
                  <Checkbox
                    id="paidOnCustomerBill"
                    checked={paidOnCustomerBill}
                    onCheckedChange={(c) => setPaidOnCustomerBill(!!c)}
                  />
                  <label htmlFor="paidOnCustomerBill" className="text-xs text-muted-foreground cursor-pointer font-medium hover:text-foreground">
                    Paid on Customer Bill
                  </label>
                </div>
              </div>
              <ReceiptNumberInput
                value={receiptNumber}
                onChange={(val, bookId) => {
                  setReceiptNumber(val);
                  setReceiptBookId(bookId);
                }}
                businessId={businessId || undefined}
                required={isReceiptRequired}
                hideLabel={true}
                placeholder={isReceiptOptional ? "Optional (No paper receipt)" : "e.g. 1001"}
              />
            </div>

            <div className="space-y-2">
              <Label>Payment Method *</Label>
              <Select value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as PaymentMethod)}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="bank">Bank Transfer</SelectItem>
                  <SelectItem value="cheque">Cheque</SelectItem>
                  <SelectItem value="goods">Goods / Products Settlement</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Payment Date *</Label>
              <Input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>{methodLabel[paymentMethod]} Amount *</Label>
                {paymentMethod === "goods" && (
                  <span className="text-[11px] text-purple-700 font-medium">Auto-computed from items</span>
                )}
              </div>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={totalAmount || ""}
                onChange={(e) => setTotalAmount(parseFloat(e.target.value) || 0)}
                readOnly={paymentMethod === "goods"}
                className={paymentMethod === "goods" ? "bg-purple-50/70 font-bold text-purple-900 border-purple-300" : ""}
              />
            </div>

            {paymentMethod === "cheque" && (
              <>
                <div className="space-y-2"><Label>Cheque Number *</Label><Input placeholder="e.g. 000123" value={chequeNumber} onChange={(e) => setChequeNumber(e.target.value)} /></div>
                <div className="space-y-2"><Label>Cheque Date *</Label><Input type="date" value={chequeDate} onChange={(e) => setChequeDate(e.target.value)} /></div>
                <div className="space-y-2">
                  <Label>Bank *</Label>
                  <Popover open={bankOpen} onOpenChange={setBankOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" role="combobox" className="w-full justify-between font-normal" disabled={loadingBanks}>
                        {loadingBanks ? <span className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" />Loading…</span>
                          : selectedBank ? <span className="truncate">{selectedBank.bank_code} – {selectedBank.bank_name}</span>
                          : <span className="text-muted-foreground">Select bank…</span>}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="p-0" style={{ width: "var(--radix-popover-trigger-width)" }}>
                      <Command><CommandInput placeholder="Search banks…" /><CommandList><CommandEmpty>No banks found.</CommandEmpty>
                        <CommandGroup>
                          {banks.map((b) => (
                            <CommandItem key={b.id} value={`${b.bank_code} ${b.bank_name}`} onSelect={() => { setSelectedBankId(b.id); setBankOpen(false); }}>
                              <Check className={cn("mr-2 h-4 w-4", selectedBankId === b.id ? "opacity-100" : "opacity-0")} />
                              <div><div className="font-medium">{b.bank_code}</div><div className="text-xs text-muted-foreground">{b.bank_name}</div></div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList></Command>
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-2">
                  <Label>Branch Code</Label>
                  <Input placeholder="e.g. 056" value={branchCode} onChange={(e) => setBranchCode(e.target.value)} />
                </div>
              </>
            )}

            {(paymentMethod === "cash" || paymentMethod === "bank") && (
              <div className="space-y-2">
                <Label>{paymentMethod === "cash" ? "Cash Account" : "Bank Account"} *</Label>
                <Select value={selectedAccountId} onValueChange={setSelectedAccountId} disabled={loadingAccounts}>
                  <SelectTrigger className="w-full">
                    {loadingAccounts ? <span className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" />Loading…</span> : <SelectValue placeholder="Select account…" />}
                  </SelectTrigger>
                  <SelectContent>
                    {availableAccounts.length === 0 ? <SelectItem value="none" disabled>No accounts available</SelectItem>
                      : availableAccounts.map((acc) => <SelectItem key={acc.id} value={acc.id}>{acc.account_name}{acc.account_number ? ` — ${acc.account_number}` : ""}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2 sm:col-span-2 lg:col-span-3">
              <Label>Notes (optional)</Label>
              <Input placeholder="Any additional notes…" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>

            {/* Sierra Products Settlement Line Items Section */}
            {paymentMethod === "goods" && (
              <div className="sm:col-span-2 lg:col-span-3 rounded-xl border border-purple-200 bg-gradient-to-b from-purple-50/40 via-white to-purple-50/20 p-4 space-y-4 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-purple-100 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-600 text-white shadow-sm">
                      <Package className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-purple-950">Sierra Products Settlement Breakdown</h3>
                      <p className="text-xs text-muted-foreground">Record returned Sierra products from customer bills or agency stock to credit their pending invoices</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 rounded-lg bg-purple-100/70 p-1 self-start sm:self-auto">
                    <Button
                      type="button"
                      size="sm"
                      variant={productSource === "invoiced" ? "default" : "ghost"}
                      className={cn(
                        "h-7 text-xs font-medium rounded-md px-3",
                        productSource === "invoiced" ? "bg-purple-600 text-white shadow-sm" : "text-purple-800 hover:text-purple-950 hover:bg-purple-200/50"
                      )}
                      onClick={() => {
                        setProductSource("invoiced");
                        setOwnProductId("");
                        setOwnUnitPrice(0);
                        setOwnInvoiceNo("");
                        setOwnManualInvoiceNo("");
                        setOwnIsCustomerPurchased(true);
                      }}
                    >
                      <ReceiptText className="w-3.5 h-3.5 mr-1.5" /> Customer Invoiced Sierra Items ({purchasedProducts.length})
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={productSource === "catalog" ? "default" : "ghost"}
                      className={cn(
                        "h-7 text-xs font-medium rounded-md px-3",
                        productSource === "catalog" ? "bg-purple-600 text-white shadow-sm" : "text-purple-800 hover:text-purple-950 hover:bg-purple-200/50"
                      )}
                      onClick={() => {
                        setProductSource("catalog");
                        setOwnProductId("");
                        setOwnUnitPrice(0);
                        setOwnInvoiceNo("");
                        setOwnManualInvoiceNo("");
                        setOwnIsCustomerPurchased(false);
                      }}
                    >
                      <Boxes className="w-3.5 h-3.5 mr-1.5" /> All Sierra Products Catalog ({catalogProducts.length})
                    </Button>
                  </div>
                </div>

                {/* Sierra Product Return Form */}
                <div className="bg-white/90 backdrop-blur rounded-lg border border-purple-100 p-3.5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-purple-900 uppercase tracking-wide flex items-center gap-1.5">
                      <Package className="w-3.5 h-3.5 text-purple-600" />
                      {productSource === "invoiced" ? "Return Customer's Invoiced Sierra Product" : "Select Any Sierra Agency Catalog Product"}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {productSource === "invoiced"
                        ? "Pre-fills invoiced unit rate & bill ref"
                        : "Pre-fills standard Sierra selling price"}
                    </span>
                  </div>

                  {productSource === "invoiced" && purchasedProducts.length === 0 && !loadingProducts && (
                    <div className="rounded-md bg-amber-50 border border-amber-200 p-2.5 text-xs text-amber-800 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
                      <span>
                        {!selectedCustomerId
                          ? "Please select a customer in Step 1 to view their previous Sierra invoices, or switch to 'All Sierra Products Catalog' above."
                          : "No previous Sierra invoice items found for this customer. Switch to 'All Sierra Products Catalog' above to select any Sierra product."}
                      </span>
                    </div>
                  )}

                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label className="text-xs">Product *</Label>
                      <Popover open={productSelectOpen} onOpenChange={setProductSelectOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={productSelectOpen}
                            className="w-full justify-between font-normal h-9"
                          >
                            {selectedProductObj ? (
                              <span className="truncate">{selectedProductObj.name}</span>
                            ) : (
                              <span className="text-muted-foreground">Select Product</span>
                            )}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent
                          className="w-[var(--radix-popover-trigger-width)] p-0"
                          style={{ width: "var(--radix-popover-trigger-width)" }}
                          align="start"
                        >
                          <Command>
                            <CommandInput placeholder="Search product..." />
                            <CommandList className="max-h-60">
                              <CommandEmpty>No products found.</CommandEmpty>
                              <CommandGroup heading={productSource === "invoiced" ? "Customer Invoiced Sierra Items" : "All Sierra Agency Products"}>
                                {(productSource === "invoiced" && purchasedProducts.length > 0 ? purchasedProducts : catalogProducts).map((p: any) => (
                                  <CommandItem
                                    key={p.id}
                                    value={`${p.name} ${p.sku} ${p.companyCode || ""}`}
                                    onSelect={() => {
                                      setOwnProductId(p.id);
                                      const unitRate = productSource === "invoiced" ? (p.latestUnitPrice ?? p.sellingPrice ?? 0) : (p.sellingPrice ?? 0);
                                      setOwnUnitPrice(unitRate);
                                      const invRef = p.latestInvoiceNo || p.invoices?.[0]?.invoiceNo || p.history?.[0]?.invoiceNo || "";
                                      setOwnInvoiceNo(invRef);
                                      const manRef = p.latestManualInvoiceNo || p.invoices?.[0]?.manualInvoiceNo || p.history?.[0]?.manualInvoiceNo || "";
                                      setOwnManualInvoiceNo(manRef);
                                      setOwnIsCustomerPurchased(productSource === "invoiced");
                                      setProductSelectOpen(false);
                                    }}
                                  >
                                    <Check
                                      className={cn(
                                        "mr-2 h-4 w-4",
                                        ownProductId === p.id ? "opacity-100" : "opacity-0"
                                      )}
                                    />
                                    <div className="flex-1">
                                      <div className="font-medium">{p.name}</div>
                                      <div className="text-xs text-muted-foreground">
                                        {p.companyCode ? `${p.companyCode} • ` : ""}
                                        {p.sku} • Stock: {p.stock ?? p.currentStock ?? 0} • LKR {(p.sellingPrice || p.latestUnitPrice || 0).toLocaleString()}
                                        {productSource === "invoiced" && p.totalPurchasedQty !== undefined && ` • Billed: ${p.totalPurchasedQty}`}
                                      </div>
                                    </div>
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                              {productSource === "invoiced" && purchasedProducts.length > 0 && (
                                <CommandGroup heading="Other Sierra Catalog Products">
                                  {catalogProducts
                                    .filter((cp) => !purchasedProducts.some((pp) => pp.id === cp.id))
                                    .map((p: any) => (
                                      <CommandItem
                                        key={p.id}
                                        value={`${p.name} ${p.sku} ${p.companyCode || ""}`}
                                        onSelect={() => {
                                          setOwnProductId(p.id);
                                          setOwnUnitPrice(p.sellingPrice ?? 0);
                                          setOwnInvoiceNo("");
                                          setOwnManualInvoiceNo("");
                                          setOwnIsCustomerPurchased(false);
                                          setProductSelectOpen(false);
                                        }}
                                      >
                                        <Check
                                          className={cn(
                                            "mr-2 h-4 w-4",
                                            ownProductId === p.id ? "opacity-100" : "opacity-0"
                                          )}
                                        />
                                        <div className="flex-1">
                                          <div className="font-medium">{p.name}</div>
                                          <div className="text-xs text-muted-foreground">
                                            {p.companyCode ? `${p.companyCode} • ` : ""}
                                            {p.sku} • Stock: {p.stock ?? 0} • LKR {(p.sellingPrice || 0).toLocaleString()}
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

                    <div className="space-y-1.5">
                      <Label className="text-xs">Return Qty *</Label>
                      <Input
                        type="number"
                        min="0.01"
                        step="any"
                        className="h-9"
                        placeholder="1"
                        value={ownQuantity || ""}
                        onChange={(e) => setOwnQuantity(parseFloat(e.target.value) || 0)}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs">Credit Unit Rate (LKR) *</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        className="h-9"
                        placeholder="0.00"
                        value={ownUnitPrice || ""}
                        onChange={(e) => setOwnUnitPrice(parseFloat(e.target.value) || 0)}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs">Invoice No (System Ref)</Label>
                      <Input
                        className="h-9"
                        placeholder="e.g. SI-0252"
                        value={ownInvoiceNo}
                        onChange={(e) => setOwnInvoiceNo(e.target.value)}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs">Manual Bill Ref</Label>
                      <Input
                        className="h-9"
                        placeholder="e.g. 1042 / MB-09"
                        value={ownManualInvoiceNo}
                        onChange={(e) => setOwnManualInvoiceNo(e.target.value)}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs">Stock Condition *</Label>
                      <Select value={ownReturnType} onValueChange={(v) => setOwnReturnType(v as "Good" | "Damage")}>
                        <SelectTrigger className="h-9 w-full"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Good">Good (Restores Sellable Stock)</SelectItem>
                          <SelectItem value="Damage">Damaged (Sends to Damaged Stock)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs">Receiving Location</Label>
                      <Select value={ownLocationId} onValueChange={setOwnLocationId}>
                        <SelectTrigger className="h-9 w-full"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {locations.map((loc) => (
                            <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="sm:col-span-2 lg:col-span-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                      <div className="flex items-center space-x-2 bg-purple-50/70 border border-purple-200/80 px-3 py-2 rounded-lg">
                        <Checkbox
                          id="own-is-purchased"
                          checked={ownIsCustomerPurchased}
                          onCheckedChange={(checked) => setOwnIsCustomerPurchased(!!checked)}
                        />
                        <Label htmlFor="own-is-purchased" className="text-xs font-medium cursor-pointer text-purple-950">
                          Sold to customer on bill (Check if this item was billed to this customer; Uncheck for other Sierra items)
                        </Label>
                      </div>

                      <Button
                        type="button"
                        className="h-9 px-6 bg-purple-700 hover:bg-purple-800 text-white font-medium shrink-0"
                        onClick={handleAddOwnProduct}
                      >
                        <Plus className="w-4 h-4 mr-1.5" /> Add Sierra Return Item
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Tables of Added Goods Items (Separated: Customer Bill Returns vs Other Sierra Items) */}
                {goodsItems.length > 0 ? (
                  <div className="space-y-4">
                    {/* Section 1: Returns from Customer Bills */}
                    <div className="rounded-lg border border-emerald-200 overflow-hidden bg-white shadow-sm">
                      <div className="bg-emerald-50/80 px-4 py-2.5 flex items-center justify-between border-b border-emerald-200">
                        <div className="flex items-center gap-2">
                          <Badge className="bg-emerald-700 text-white hover:bg-emerald-800 text-xs font-semibold">
                            Customer Bill Items
                          </Badge>
                          <span className="text-xs font-semibold text-emerald-950">
                            Items Sold to Customer on Past Bills ({soldToCustomerItems.length})
                          </span>
                        </div>
                        <div className="text-xs font-bold text-emerald-900">
                          Subtotal: {formatCurrency(soldSubtotal)}
                        </div>
                      </div>

                      {soldToCustomerItems.length > 0 ? (
                        <Table>
                          <TableHeader className="bg-emerald-50/30">
                            <TableRow>
                              <TableHead className="text-xs font-semibold">Sierra Product</TableHead>
                              <TableHead className="text-xs font-semibold">Bill &amp; Manual Ref</TableHead>
                              <TableHead className="text-xs font-semibold text-right">Quantity</TableHead>
                              <TableHead className="text-xs font-semibold text-right">Credit Rate (LKR)</TableHead>
                              <TableHead className="text-xs font-semibold text-right">Total Credit (LKR)</TableHead>
                              <TableHead className="text-xs font-semibold">Stock Destination</TableHead>
                              <TableHead className="text-xs font-semibold text-center w-20">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {soldToCustomerItems.map((item) => (
                              <TableRow key={item.id} className="hover:bg-emerald-50/20">
                                <TableCell className="py-2.5">
                                  <div className="font-semibold text-xs text-gray-900">
                                    {item.productName}
                                  </div>
                                  <div className="text-[11px] text-muted-foreground mt-0.5">
                                    {item.sku && <span>SKU: {item.sku}</span>}
                                  </div>
                                </TableCell>
                                <TableCell className="py-2.5 text-xs">
                                  <div className="flex flex-col gap-0.5">
                                    {item.invoiceNo ? (
                                      <span className="font-medium text-emerald-800 flex items-center gap-1">
                                        <ReceiptText className="w-3 h-3 text-emerald-600" />
                                        {item.invoiceNo}
                                      </span>
                                    ) : (
                                      <span className="text-muted-foreground">—</span>
                                    )}
                                    {item.manualInvoiceNo && (
                                      <span className="text-[11px] text-purple-700 font-medium">
                                        Manual: {item.manualInvoiceNo}
                                      </span>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell className="py-2.5 text-right font-medium text-xs">
                                  {item.quantity} units
                                </TableCell>
                                <TableCell className="py-2.5 text-right text-xs">
                                  LKR {item.unitPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </TableCell>
                                <TableCell className="py-2.5 text-right font-bold text-xs text-emerald-950">
                                  LKR {item.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </TableCell>
                                <TableCell className="py-2.5 text-xs text-muted-foreground">
                                  <span className="inline-flex items-center gap-1.5">
                                    <span className={cn("inline-block w-2 h-2 rounded-full", item.returnType === "Damage" ? "bg-red-500" : "bg-emerald-500")} />
                                    <span className="font-medium text-gray-700">{item.returnType} Stock</span> &bull; {item.locationName}
                                  </span>
                                </TableCell>
                                <TableCell className="py-2.5 text-center">
                                  <div className="flex items-center justify-center gap-1">
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      title="Edit Item & Bill Details"
                                      className="h-7 w-7 text-purple-600 hover:text-purple-800 hover:bg-purple-50"
                                      onClick={() => handleOpenEdit(item)}
                                    >
                                      <Pencil className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      title="Remove Item"
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
                      ) : (
                        <div className="p-3 text-center text-xs text-muted-foreground italic">
                          No items returned from customer bills in this settlement.
                        </div>
                      )}
                    </div>

                    {/* Section 2: Other Sierra Products Received (Not Sold to this Customer) */}
                    <div className="rounded-lg border border-amber-200 overflow-hidden bg-white shadow-sm">
                      <div className="bg-amber-50/80 px-4 py-2.5 flex items-center justify-between border-b border-amber-200">
                        <div className="flex items-center gap-2">
                          <Badge className="bg-amber-600 text-white hover:bg-amber-700 text-xs font-semibold">
                            Other Sierra Stock
                          </Badge>
                          <span className="text-xs font-semibold text-amber-950">
                            Sierra Products Not Sold to this Customer ({notSoldToCustomerItems.length})
                          </span>
                        </div>
                        <div className="text-xs font-bold text-amber-900">
                          Subtotal: {formatCurrency(notSoldSubtotal)}
                        </div>
                      </div>

                      {notSoldToCustomerItems.length > 0 ? (
                        <Table>
                          <TableHeader className="bg-amber-50/30">
                            <TableRow>
                              <TableHead className="text-xs font-semibold">Sierra Product</TableHead>
                              <TableHead className="text-xs font-semibold">Reference / Notes</TableHead>
                              <TableHead className="text-xs font-semibold text-right">Quantity</TableHead>
                              <TableHead className="text-xs font-semibold text-right">Credit Rate (LKR)</TableHead>
                              <TableHead className="text-xs font-semibold text-right">Total Credit (LKR)</TableHead>
                              <TableHead className="text-xs font-semibold">Stock Destination</TableHead>
                              <TableHead className="text-xs font-semibold text-center w-20">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {notSoldToCustomerItems.map((item) => (
                              <TableRow key={item.id} className="hover:bg-amber-50/20">
                                <TableCell className="py-2.5">
                                  <div className="font-semibold text-xs text-gray-900">
                                    {item.productName}
                                  </div>
                                  <div className="text-[11px] text-muted-foreground mt-0.5">
                                    {item.sku && <span>SKU: {item.sku}</span>}
                                  </div>
                                </TableCell>
                                <TableCell className="py-2.5 text-xs">
                                  <div className="flex flex-col gap-0.5">
                                    {item.invoiceNo || item.manualInvoiceNo ? (
                                      <>
                                        {item.invoiceNo && (
                                          <span className="font-medium text-amber-800">Ref: {item.invoiceNo}</span>
                                        )}
                                        {item.manualInvoiceNo && (
                                          <span className="text-[11px] text-gray-600">Manual: {item.manualInvoiceNo}</span>
                                        )}
                                      </>
                                    ) : (
                                      <span className="text-xs text-amber-800/80 bg-amber-50 px-2 py-0.5 rounded border border-amber-200/50 inline-block w-fit">
                                        General Stock Settlement
                                      </span>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell className="py-2.5 text-right font-medium text-xs">
                                  {item.quantity} units
                                </TableCell>
                                <TableCell className="py-2.5 text-right text-xs">
                                  LKR {item.unitPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </TableCell>
                                <TableCell className="py-2.5 text-right font-bold text-xs text-amber-950">
                                  LKR {item.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </TableCell>
                                <TableCell className="py-2.5 text-xs text-muted-foreground">
                                  <span className="inline-flex items-center gap-1.5">
                                    <span className={cn("inline-block w-2 h-2 rounded-full", item.returnType === "Damage" ? "bg-red-500" : "bg-amber-500")} />
                                    <span className="font-medium text-gray-700">{item.returnType} Stock</span> &bull; {item.locationName}
                                  </span>
                                </TableCell>
                                <TableCell className="py-2.5 text-center">
                                  <div className="flex items-center justify-center gap-1">
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      title="Edit Item Details"
                                      className="h-7 w-7 text-purple-600 hover:text-purple-800 hover:bg-purple-50"
                                      onClick={() => handleOpenEdit(item)}
                                    >
                                      <Pencil className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      title="Remove Item"
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
                      ) : (
                        <div className="p-3 text-center text-xs text-muted-foreground italic">
                          No other Sierra items added in this settlement.
                        </div>
                      )}
                    </div>

                    {/* Combined Bottom Summary Bar */}
                    <div className="rounded-lg bg-purple-100/70 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border border-purple-200">
                      <div className="text-xs text-purple-950 font-medium">
                        Total {goodsItems.length} Sierra return item{goodsItems.length === 1 ? "" : "s"} (
                        <span className="font-semibold text-emerald-800">{soldToCustomerItems.length} from customer bills</span>,{" "}
                        <span className="font-semibold text-amber-800">{notSoldToCustomerItems.length} other Sierra items</span>
                        )
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-bold text-purple-950 uppercase tracking-wide">
                          Total Settlement Credit:
                        </span>
                        <span className="text-lg font-extrabold text-purple-900">
                          {formatCurrency(totalAmount)}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-purple-200 bg-white/50 p-6 text-center text-xs text-muted-foreground">
                    <Package className="w-8 h-8 text-purple-300 mx-auto mb-2" />
                    No Sierra return items added yet. Choose from the customer&apos;s invoiced Sierra items or the Sierra catalog above to credit their bill.
                  </div>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Step 2 */}
      <Card className="border-purple-100">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <StepBadge step={2} label="Pending Invoices" />
              <CardDescription className="mt-1">
                {selectedCustomerId
                  ? `Select invoices to settle (${pendingInvoices.length} outstanding)`
                  : "Select a customer above to load their pending invoices"}
              </CardDescription>
            </div>
            {selectedCustomerId && pendingInvoices.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={autoAllocateOldest}
                  title="Automatically allocate payment amount across oldest outstanding invoices"
                  className="text-xs text-purple-700 border-purple-200 hover:bg-purple-50 font-medium"
                >
                  <Sparkles className="w-3.5 h-3.5 mr-1 text-purple-600" /> Auto-Allocate
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    downloadCustomerStatement(
                      selectedCustomer?.name || "Customer",
                      pendingInvoices,
                      "CHAMPIKA SIERRA"
                    )
                  }
                  title="Download Single Customer Outstanding PDF Statement"
                  className="text-xs text-purple-700 border-purple-200 hover:bg-purple-50"
                >
                  <Download className="w-3.5 h-3.5 mr-1 text-purple-600" /> PDF Statement
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    printCustomerStatement(
                      selectedCustomer?.name || "Customer",
                      pendingInvoices,
                      "CHAMPIKA SIERRA"
                    )
                  }
                  title="Print Single Customer Outstanding Statement"
                  className="text-xs"
                >
                  <Printer className="w-3.5 h-3.5 mr-1 text-gray-600" /> Print
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    shareCustomerStatement(
                      selectedCustomer?.name || "Customer",
                      pendingInvoices,
                      "CHAMPIKA SIERRA"
                    )
                  }
                  title="Share Outstanding Statement via WhatsApp / Link"
                  className="text-xs text-green-700 border-green-200 hover:bg-green-50"
                >
                  <Share2 className="w-3.5 h-3.5 mr-1 text-green-600" /> Share
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {!selectedCustomerId ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-3">
              <AlertCircle className="h-8 w-8 opacity-40" />
              <p className="text-sm">No customer selected</p>
            </div>
          ) : loadingInvoices ? (
            <div className="flex justify-center items-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : pendingInvoices.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-3">
              <ReceiptText className="h-8 w-8 opacity-40" />
              <p className="text-sm">No pending invoices for this customer</p>
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10"></TableHead>
                      <TableHead>Invoice No</TableHead>
                      <TableHead>Manual Ref</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-center">Age (Days)</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">Paid</TableHead>
                      <TableHead className="text-right">Balance</TableHead>
                      <TableHead className="text-center">History</TableHead>
                      <TableHead className="text-right w-40">Settle Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingInvoices.map((inv) => {
                      const s = settlements[inv.id];
                      const isSelected = s?.selected ?? false;
                      const ageDays = getInvoiceAgeDays(inv.date);
                      const paymentCount = inv.payments?.length || 0;

                      return (
                        <TableRow key={inv.id} className={cn(isSelected && "bg-purple-50/40")}>
                          <TableCell>
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => toggleInvoice(inv.id, inv)}
                              className="data-[state=checked]:bg-purple-600 data-[state=checked]:border-purple-600"
                            />
                          </TableCell>
                          <TableCell className="font-medium font-mono text-sm">
                            {inv.invoiceNo}
                          </TableCell>
                          <TableCell className="font-mono text-sm text-muted-foreground">
                            {inv.manualInvoiceNo || "—"}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                            {inv.date ? new Date(inv.date).toLocaleDateString() : "—"}
                          </TableCell>
                          <TableCell className="text-center">
                            {renderAgeBadge(ageDays)}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(inv.totalAmount)}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {formatCurrency(inv.paidAmount)}
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            {inv.balance <= 0 ? (
                              <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300 font-semibold gap-1 inline-flex items-center">
                                <Check className="w-3.5 h-3.5 text-emerald-600" /> PAID
                              </Badge>
                            ) : (
                              <span className="text-orange-600">{formatCurrency(inv.balance)}</span>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setHistoryModalInvoice(inv)}
                              className="h-7 px-2 text-xs text-purple-600 hover:text-purple-800 hover:bg-purple-100/50 gap-1"
                              title="View Payment History"
                            >
                              <History className="w-3.5 h-3.5" />
                              {paymentCount > 0 ? (
                                <span className="font-semibold text-purple-700">{paymentCount}</span>
                              ) : (
                                <span>0</span>
                              )}
                            </Button>
                          </TableCell>
                          <TableCell className="text-right">
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              max={inv.balance}
                              disabled={!isSelected}
                              value={s?.settleAmount || ""}
                              onChange={(e) =>
                                updateSettleAmount(inv.id, parseFloat(e.target.value) || 0, inv.balance)
                              }
                              className="w-36 text-right ml-auto"
                              placeholder="0.00"
                            />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile Card List */}
              <div className="md:hidden space-y-3">
                {pendingInvoices.map((inv) => {
                  const s = settlements[inv.id];
                  const isSelected = s?.selected ?? false;
                  const ageDays = getInvoiceAgeDays(inv.date);
                  const paymentCount = inv.payments?.length || 0;

                  return (
                    <div
                      key={inv.id}
                      className={cn(
                        "border rounded-lg p-4 space-y-3",
                        isSelected ? "border-purple-400 bg-purple-50" : "bg-card"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleInvoice(inv.id, inv)}
                            className="data-[state=checked]:bg-purple-600 data-[state=checked]:border-purple-600"
                          />
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold font-mono text-sm">{inv.invoiceNo}</span>
                              {renderAgeBadge(ageDays)}
                            </div>
                            {inv.manualInvoiceNo && (
                              <p className="text-xs font-mono text-muted-foreground">{inv.manualInvoiceNo}</p>
                            )}
                            <p className="text-xs text-muted-foreground">
                              {inv.date ? new Date(inv.date).toLocaleDateString() : "—"}
                            </p>
                          </div>
                        </div>
                        {inv.balance <= 0 ? (
                          <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300 font-semibold gap-1 inline-flex items-center text-xs">
                            <Check className="w-3.5 h-3.5 text-emerald-600" /> PAID
                          </Badge>
                        ) : (
                          <span className="font-bold text-orange-600 text-sm">
                            {formatCurrency(inv.balance)}
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-1 text-xs border-t pt-2">
                        <span className="text-muted-foreground">Total:</span>
                        <span className="text-right">{formatCurrency(inv.totalAmount)}</span>
                        <span className="text-muted-foreground">Paid:</span>
                        <span className="text-right flex items-center justify-end gap-1">
                          {formatCurrency(inv.paidAmount)}
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => setHistoryModalInvoice(inv)}
                            className="h-5 w-5 p-0 text-purple-600"
                            title="History"
                          >
                            <History className="w-3 h-3" />
                          </Button>
                        </span>
                      </div>

                      {isSelected && (
                        <div className="space-y-1">
                          <Label className="text-xs">Settle Amount</Label>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            max={inv.balance}
                            value={s?.settleAmount || ""}
                            onChange={(e) =>
                              updateSettleAmount(inv.id, parseFloat(e.target.value) || 0, inv.balance)
                            }
                            placeholder="0.00"
                            className="text-right"
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Step 3 */}
      {selectedCustomerId && totalAmount > 0 && (
        <Card className={cn("border-2", remaining < 0 ? "border-destructive/50 bg-destructive/5" : remaining === 0 ? "border-green-500/50 bg-green-50/50" : "border-purple-200")}>
          <CardHeader className="pb-3"><StepBadge step={3} label="Summary & Submit" /></CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex flex-wrap gap-6">
                <div className="space-y-0.5"><p className="text-xs text-muted-foreground uppercase tracking-wide">{methodLabel[paymentMethod]} Amount</p><p className="text-xl font-bold">{formatCurrency(totalAmount)}</p></div>
                <div className="space-y-0.5"><p className="text-xs text-muted-foreground uppercase tracking-wide">Allocated</p><p className="text-xl font-bold text-purple-600">{formatCurrency(totalAllocated)}</p></div>
                <div className="space-y-0.5"><p className="text-xs text-muted-foreground uppercase tracking-wide">Remaining</p>
                  <p className={cn("text-xl font-bold", remaining < 0 ? "text-destructive" : remaining === 0 ? "text-green-600" : "text-muted-foreground")}>{formatCurrency(remaining)}</p>
                </div>
              </div>
              <div className="flex gap-2 w-full sm:w-auto">
                <Button variant="outline" onClick={resetForm} disabled={isSubmitting} className="flex-1 sm:flex-none">Clear</Button>
                <Button onClick={handleSubmit} disabled={isSubmitting || remaining < 0 || Object.values(settlements).filter((s) => s.selected && s.settleAmount > 0).length === 0} className="flex-1 sm:flex-none gap-2 bg-purple-600 hover:bg-purple-700">
                  {isSubmitting ? <><Loader2 className="h-4 w-4 animate-spin" />Saving…</> : <><BanknoteIcon className="h-4 w-4" />Settle Invoices</>}
                </Button>
              </div>
            </div>
            {remaining < 0 && <p className="mt-3 text-sm text-destructive flex items-center gap-1"><AlertCircle className="h-4 w-4" />Allocated exceeds payment amount.</p>}
          </CardContent>
        </Card>
      )}

      {/* ── Payment History Dialog Modal ── */}
      <Dialog
        open={!!historyModalInvoice}
        onOpenChange={(open) => !open && setHistoryModalInvoice(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-purple-900">
              <History className="w-5 h-5 text-purple-600" />
              Payment History — {historyModalInvoice?.invoiceNo}
            </DialogTitle>
            <DialogDescription>
              Customer: <span className="font-semibold text-foreground">{selectedCustomer?.name}</span>
            </DialogDescription>
          </DialogHeader>

          {historyModalInvoice && (
            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-3 gap-2 p-3 bg-purple-50/50 border border-purple-100 rounded-lg text-xs">
                <div>
                  <p className="text-muted-foreground">Invoice Total</p>
                  <p className="font-semibold text-sm">{formatCurrency(historyModalInvoice.totalAmount)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Total Paid</p>
                  <p className="font-semibold text-sm text-green-700">{formatCurrency(historyModalInvoice.paidAmount)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Balance Due</p>
                  <p className="font-semibold text-sm text-orange-600">{formatCurrency(historyModalInvoice.balance)}</p>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Previous Payments ({historyModalInvoice.payments?.length || 0})
                </p>
                {!historyModalInvoice.payments || historyModalInvoice.payments.length === 0 ? (
                  <div className="py-6 text-center text-xs text-muted-foreground border rounded-md bg-muted/20">
                    No previous partial payments recorded for this invoice yet.
                  </div>
                ) : (
                  <div className="border rounded-md divide-y max-h-60 overflow-y-auto">
                    {historyModalInvoice.payments.map((p, idx) => {
                      const isReturned = p.chequeStatus && ["returned", "bounced"].includes(p.chequeStatus.toLowerCase());
                      return (
                        <div key={p.id || idx} className={cn("p-2.5 text-xs flex items-center justify-between hover:bg-slate-50", isReturned && "bg-red-50/60 border-l-2 border-l-red-500")}>
                          <div>
                            <p className="font-medium">
                              {p.paymentDate ? new Date(p.paymentDate).toLocaleDateString("en-GB") : "—"}
                            </p>
                            <p className="text-muted-foreground text-[11px] mt-0.5 flex flex-wrap items-center gap-1">
                              Method: <span className="capitalize font-semibold text-slate-700">{p.method === "goods" ? "Goods Settlement" : p.method}</span>
                              {p.method?.toLowerCase() === "goods" ? (
                                <span className="font-bold text-purple-800 bg-purple-100 border border-purple-200 px-1.5 py-0.5 rounded text-[10px]">
                                  Goods Settlement
                                </span>
                              ) : (p.receiptNumber || p.receipt_number) ? (
                                <span className="font-bold font-mono text-purple-800 bg-purple-100 border border-purple-200 px-1.5 py-0.5 rounded text-[10px]">
                                  Receipt #{p.receiptNumber || p.receipt_number}
                                </span>
                              ) : (
                                <span className="font-sans font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded text-[10px]">
                                  {p.method?.toLowerCase() === "bank" ? "Online Bank Transfer" : "Paid on Customer Bill"}
                                </span>
                              )}
                              {p.goodsSummary && (
                                <span className="text-[10px] text-purple-900 bg-purple-50 border border-purple-200 px-1.5 py-0.5 rounded font-medium">
                                  {p.goodsSummary}
                                </span>
                              )}
                              {p.chequeNo && ` (Cheque #${p.chequeNo})`}
                              {p.chequeStatus && (
                                <span className={cn("ml-1 font-semibold", isReturned ? "text-red-700 bg-red-100 px-1.5 py-0.5 rounded border border-red-200" : "text-slate-600")}>
                                  • Status: {p.chequeStatus}{isReturned ? " [CHEQUE RETURNED]" : ""}
                                </span>
                              )}
                            </p>
                          </div>
                          <span className={cn("font-bold text-sm", isReturned ? "text-red-600 line-through" : "text-green-700")}>
                            {formatCurrency(p.amount)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Edit Goods Settlement Item Dialog Modal ── */}
      <Dialog
        open={!!editingItem}
        onOpenChange={(open) => !open && setEditingItem(null)}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-purple-900">
              <Pencil className="w-5 h-5 text-purple-600" />
              Edit Sierra Settlement Item
            </DialogTitle>
            <DialogDescription>
              Update return quantity, credit rate, bill invoice numbers, condition, or category for{" "}
              <span className="font-semibold text-foreground">{editingItem?.productName}</span>.
            </DialogDescription>
          </DialogHeader>

          {editingItem && (
            <div className="space-y-3.5 py-2">
              <div className="flex items-center space-x-2 p-2.5 bg-purple-50/70 rounded-lg border border-purple-200">
                <Checkbox
                  id="edit-is-purchased"
                  checked={editIsCustomerPurchased}
                  onCheckedChange={(checked) => setEditIsCustomerPurchased(!!checked)}
                />
                <Label htmlFor="edit-is-purchased" className="text-xs font-medium cursor-pointer text-purple-950">
                  Item was sold to customer on past Sierra bill (Customer Bill Return)
                </Label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Invoice No (System Ref)</Label>
                  <Input
                    className="h-9"
                    placeholder="e.g. SI-0252"
                    value={editInvoiceNo}
                    onChange={(e) => setEditInvoiceNo(e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Manual Bill Ref</Label>
                  <Input
                    className="h-9"
                    placeholder="e.g. 1042 / MB-09"
                    value={editManualInvoiceNo}
                    onChange={(e) => setEditManualInvoiceNo(e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Return Qty *</Label>
                  <Input
                    type="number"
                    min="0.01"
                    step="any"
                    className="h-9"
                    value={editQuantity || ""}
                    onChange={(e) => setEditQuantity(parseFloat(e.target.value) || 0)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Credit Unit Rate (LKR) *</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    className="h-9"
                    value={editUnitPrice || ""}
                    onChange={(e) => setEditUnitPrice(parseFloat(e.target.value) || 0)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Stock Condition *</Label>
                  <Select value={editReturnType} onValueChange={(v) => setEditReturnType(v as "Good" | "Damage")}>
                    <SelectTrigger className="h-9 w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Good">Good (Restores Sellable Stock)</SelectItem>
                      <SelectItem value="Damage">Damaged (Sends to Damaged Stock)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Receiving Location</Label>
                  <Select value={editLocationId} onValueChange={setEditLocationId}>
                    <SelectTrigger className="h-9 w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {locations.map((loc) => (
                        <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="p-3 bg-purple-100/60 rounded-lg flex items-center justify-between text-xs border border-purple-200">
                <span className="text-purple-950 font-medium">Updated Total Credit:</span>
                <span className="text-sm font-extrabold text-purple-900">
                  {formatCurrency(editQuantity * editUnitPrice)}
                </span>
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2 border-t">
            <Button type="button" variant="outline" size="sm" onClick={() => setEditingItem(null)}>
              Cancel
            </Button>
            <Button type="button" size="sm" className="bg-purple-700 hover:bg-purple-800 text-white" onClick={handleSaveEdit}>
              Save Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

