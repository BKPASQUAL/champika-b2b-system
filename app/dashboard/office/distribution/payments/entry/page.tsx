"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Check,
  ChevronsUpDown,
  Loader2,
  AlertCircle,
  ReceiptText,
  BanknoteIcon,
  Truck,
  History,
  Download,
  Printer,
  Share2,
  Calendar,
  Clock,
  Zap,
  SlidersHorizontal,
  Undo2,
  Plus,
  Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
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
  StatementInvoice,
} from "@/lib/customer-statement-report";
import { CustomStatementDialog } from "@/components/payments/CustomStatementDialog";
import {
  GoodsSettlementSection,
  GoodsSettlementItem,
} from "@/components/payments/GoodsSettlementSection";

// ─── Helpers ──────────────────────────────────────────────────────────────────
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
interface PendingInvoice {
  id: string;
  invoiceNo: string;
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
      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-white text-xs font-bold flex-shrink-0">{step}</div>
      <span className="text-sm font-medium text-muted-foreground">{label}</span>
    </div>
  );
}

export default function DistributionPaymentEntryPage() {
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
  const [goodsItems, setGoodsItems] = useState<GoodsSettlementItem[]>([]);
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
  const [statementInvoices, setStatementInvoices] = useState<StatementInvoice[]>([]);
  const [isCustomStatementOpen, setIsCustomStatementOpen] = useState(false);
  const [availableReturnCredits, setAvailableReturnCredits] = useState<any[]>([]);
  const [viewingReturnModal, setViewingReturnModal] = useState<any | null>(null);

  useEffect(() => {
    const user = getUserBusinessContext();
    setBusinessId(BUSINESS_IDS.CHAMPIKA_DISTRIBUTION);
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
    };
    run();
  }, [businessId]);

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
            chequeDate: isGoods ? null : (p.cheque_date || null),
            amount: p.amount,
            method: p.payment_method || p.method || "cash",
            receiptNumber: p.receipt_number || p.receiptNumber || null,
            chequeNo: isGoods ? null : (p.cheque_number || p.cheque_no || null),
            chequeStatus: isGoods ? null : (p.cheque_status || null),
            bankName: p.banks?.bank_name || p.bank_codes?.bank_name || null,
            bankCode: p.banks?.bank_code || p.bank_codes?.bank_code || null,
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

        // 1. All delivered customer invoices for the full Customer Statement Report
        const allCustomerInvoices: StatementInvoice[] = invoicesData
          .filter(
            (inv: any) =>
              inv.customerId === customerId &&
              (inv.orderStatus === "Delivered" || inv.orderStatus === "Completed")
          )
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
              status: inv.status,
              payments: history,
            };
          });
        setStatementInvoices(allCustomerInvoices);

        // 2. Unpaid & recent payment invoices for Step 2 settlement table
        const filtered: PendingInvoice[] = allCustomerInvoices.filter((inv) => {
          const isUnpaid = inv.status !== "Paid" && (inv.balance ?? 0) > 0;
          const hasLastPayment = latestCustomerPaymentDate
            ? (inv.payments || []).some((p) => p.paymentDate && p.paymentDate.split("T")[0] === latestCustomerPaymentDate)
            : false;

          return isUnpaid || hasLastPayment;
        });

        setPendingInvoices(filtered);
        const map: Record<string, InvoiceSettlement> = {};
        filtered.forEach((inv) => { map[inv.id] = { invoiceId: inv.id, selected: false, settleAmount: 0 }; });
        setSettlements(map);
      }
    } catch { toast.error("Failed to load invoices"); } finally { setLoadingInvoices(false); }
  }, [businessId]);

  useEffect(() => {
    if (selectedCustomerId) {
      fetchPendingInvoices(selectedCustomerId);
      fetch(
        `/api/inventory/returns?customerId=${selectedCustomerId}&status=Approved,Completed&unsettled=true&returnType=Good&dispatchedOnly=true&all=true`
      )
        .then((r) => (r.ok ? r.json() : { data: [] }))
        .then((d) => {
          const list = Array.isArray(d.data) ? d.data : [];
          setAvailableReturnCredits(list.filter((r: any) => r.return_type === "Good"));
        })
        .catch(() => setAvailableReturnCredits([]));
    } else {
      setPendingInvoices([]);
      setStatementInvoices([]);
      setSettlements({});
      setAvailableReturnCredits([]);
    }
  }, [selectedCustomerId, fetchPendingInvoices]);
  useEffect(() => { setSelectedAccountId(""); }, [paymentMethod]);

  // Recalculate totalAmount whenever goods items change
  useEffect(() => {
    if (paymentMethod === "goods") {
      const sum = goodsItems.reduce((acc, it) => acc + (it.totalValue || 0), 0);
      setTotalAmount(Math.round(sum * 100) / 100);
    }
  }, [goodsItems, paymentMethod]);

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
    setPendingInvoices([]); setSettlements({});
    setAvailableReturnCredits([]);
  };

  const getReturnItemPricing = (ret: any) => {
    let invoiceNo = "-";
    let unitPrice = 0;
    if (ret.reason) {
      const invMatch = ret.reason.match(/\[INV:([^\]]+)\]/);
      if (invMatch) invoiceNo = invMatch[1];
      const priceMatch = ret.reason.match(/\[PRICE:([\d.]+)\]/);
      if (priceMatch) unitPrice = parseFloat(priceMatch[1]) || 0;
    }
    const rate = unitPrice || ret.products?.selling_price || 0;
    const lineTotal = Math.round(Number(ret.quantity || 0) * rate * 100) / 100;
    return { invoiceNo, unitPrice: rate, lineTotal };
  };

  // A payment row that came from a Good Return deduction
  const isReturnPayment = (p: InvoicePaymentRecord) =>
    !!(p.goodsSummary?.includes("Return Note") || p.goodsSummary?.includes("Good Return") || p.chequeNo?.includes("RET-"));

  // Total already deducted from an invoice by earlier return settlements
  const getReturnDeductedAmount = (inv: { payments?: InvoicePaymentRecord[] }) =>
    (inv.payments || []).filter(isReturnPayment).reduce((sum, p) => sum + Number(p.amount || 0), 0);

  // Return notes already used in a past payment — they must only be deducted once
  const deductedReturnNumbers = useMemo(() => {
    const set = new Set<string>();
    statementInvoices.forEach((inv) =>
      (inv.payments || []).forEach((p) => {
        const text = `${p.goodsSummary || ""} ${p.chequeNo || ""} ${p.notes || ""}`;
        for (const m of text.matchAll(/RET-[\w-]+/g)) set.add(m[0]);
      })
    );
    return set;
  }, [statementInvoices]);

  const visibleReturnCredits = useMemo(
    () => availableReturnCredits.filter((r) => !deductedReturnNumbers.has(r.return_number)),
    [availableReturnCredits, deductedReturnNumbers]
  );

  const handleApplyReturnCredit = (ret: any) => {
    const { invoiceNo, unitPrice: rate, lineTotal } = getReturnItemPricing(ret);

    const newGoodsItem: GoodsSettlementItem = {
      id: `return_${ret.id}`,
      type: "own_product",
      isCustomerPurchased: true,
      productId: ret.product_id,
      productName: ret.products?.name || "Return Item",
      sku: ret.products?.sku || "",
      invoiceNo: invoiceNo !== "-" ? invoiceNo : undefined,
      returnType: "Good",
      returnNumber: ret.return_number,
      locationId: ret.location_id || "0b68fd7b-6a40-496f-9279-0a003c26b211",
      locationName: ret.locations?.name || "Main Warehouse",
      quantity: Number(ret.quantity),
      unitPrice: rate,
      totalValue: lineTotal,
    };

    setPaymentMethod("goods");
    setGoodsItems((prev) => {
      if (prev.some((it) => it.id === `return_${ret.id}`)) return prev;
      return [...prev, newGoodsItem];
    });

    // Automatically allocate this Good Return credit to its dedicated bill first!
    setTimeout(() => {
      setSettlements((prev) => {
        let rem = lineTotal;
        const next: Record<string, InvoiceSettlement> = { ...prev };

        // 1. PRIORITY: If return specifies a Bill Ref (e.g. CHD-0021), allocate to THAT bill first!
        if (invoiceNo && invoiceNo !== "-") {
          const targetInv = pendingInvoices.find(
            (pi) => pi.invoiceNo === invoiceNo || pi.id === invoiceNo
          );
          if (targetInv) {
            const currentAlloc = next[targetInv.id]?.selected ? next[targetInv.id].settleAmount : 0;
            const needed = targetInv.balance - currentAlloc;
            if (needed > 0) {
              const add = Math.min(needed, rem);
              next[targetInv.id] = {
                invoiceId: targetInv.id,
                selected: true,
                settleAmount: currentAlloc + add,
              };
              rem -= add;
            }
          }
        }

        // 2. Only if remaining credit exists, allocate remainder to other invoices (oldest first)
        if (rem > 0) {
          const otherInvoices = [...pendingInvoices]
            .filter((pi) => pi.invoiceNo !== invoiceNo && pi.id !== invoiceNo)
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

          for (const inv of otherInvoices) {
            if (rem <= 0) break;
            const currentAlloc = next[inv.id]?.selected ? next[inv.id].settleAmount : 0;
            const needed = inv.balance - currentAlloc;
            if (needed > 0) {
              const add = Math.min(needed, rem);
              next[inv.id] = {
                invoiceId: inv.id,
                selected: true,
                settleAmount: currentAlloc + add,
              };
              rem -= add;
            }
          }
        }

        return next;
      });
    }, 50);

    toast.success(
      `Applied Good Return ${ret.return_number} (LKR ${lineTotal.toLocaleString()})${
        invoiceNo !== "-" ? ` directly to Bill ${invoiceNo}` : ""
      }!`
    );
  };

  const isReceiptOptional = paymentMethod === "bank" || paymentMethod === "goods" || paidOnCustomerBill;
  const isReceiptRequired = !isReceiptOptional;

  const buildGoodsSummary = () => {
    return goodsItems
      .map((item) => {
        const parts = [
          item.returnNumber ? `Return Note: ${item.returnNumber}` : null,
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
      if (goodsItems.length === 0) {
        toast.error("Please add at least one goods/product item to settle this payment");
        return false;
      }
    }
    if (totalAmount <= 0) { toast.error("Please enter a valid amount"); return false; }
    if (paymentMethod === "cheque") {
      if (!chequeNumber.trim()) { toast.error("Please enter cheque number"); return false; }
      if (!chequeDate) { toast.error("Please enter cheque date"); return false; }
      if (!selectedBankId) { toast.error("Please select a bank"); return false; }
    }
    if ((paymentMethod === "cash" || paymentMethod === "bank") && !selectedAccountId) { toast.error("Please select an account"); return false; }
    if (Object.values(settlements).filter((s) => s.selected && s.settleAmount > 0).length === 0) { toast.error("Please select at least one invoice to settle"); return false; }
    if (totalAllocated > totalAmount) { toast.error("Allocated exceeds payment amount"); return false; }
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
            performedByName: getUserBusinessContext()?.name ?? null,
            performedByEmail: getUserBusinessContext()?.email ?? null,
            goodsItems: paymentMethod === "goods" ? goodsItems : undefined,
            goodsSummary: goodsSummaryStr,
            isSecondaryGoodsSettlement: paymentMethod === "goods" && !isFirstGoodsInvoice,
          }),
        });
        if (res.ok) {
          successCount++;
          if (paymentMethod === "goods") isFirstGoodsInvoice = false;
        } else {
          failCount++;
        }
      }
      if (successCount > 0) {
        // Tag any applied return credits as settled with the settled invoice reference
        for (const gItem of goodsItems) {
          if (gItem.id.startsWith("return_")) {
            const retId = gItem.id.replace("return_", "");
            const dedicatedBill = gItem.invoiceNo;
            const settledInvoices = Object.values(settlements)
              .filter((s) => s.selected && s.settleAmount > 0)
              .map((s) => {
                const inv = pendingInvoices.find((pi) => pi.id === s.invoiceId);
                return inv?.invoiceNo || s.invoiceId;
              })
              .join(",");

            const invoiceTag = dedicatedBill || settledInvoices;

            await fetch(`/api/inventory/returns/${retId}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                reason_tag: `[SETTLED_IN_PAYMENT:true] [SETTLED_INVOICE:${invoiceTag}]`,
              }),
            }).catch(() => {});
          }
        }
        toast.success(`Payment recorded successfully!`);
        resetForm();
        invalidatePaymentCaches();
      }
      if (failCount > 0) toast.error(`${failCount} payment(s) failed.`);
    } catch { toast.error("An unexpected error occurred"); } finally { setIsSubmitting(false); }
  };

  const methodLabel: Record<PaymentMethod, string> = {
    cash: "Cash",
    bank: "Bank Transfer",
    cheque: "Cheque",
    goods: "Goods Settlement",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
          <Truck className="h-5 w-5 text-blue-600" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Payment Entry</h1>
          <p className="text-muted-foreground text-sm">Record a customer payment and settle pending invoices</p>
        </div>
      </div>

      {/* Step 1 */}
      <Card>
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
                  <SelectItem value="goods">Goods / Products Exchange</SelectItem>
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
                  <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 border-blue-200">
                    Auto-computed from items
                  </Badge>
                )}
              </div>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={totalAmount || ""}
                readOnly={paymentMethod === "goods"}
                onChange={(e) => setTotalAmount(parseFloat(e.target.value) || 0)}
                className={cn(paymentMethod === "goods" && "bg-blue-50/40 cursor-not-allowed font-semibold")}
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
          </div>

          {/* Goods / Products Settlement Section */}
          {paymentMethod === "goods" && (
            <div className="mt-6 pt-6 border-t border-blue-100">
              <GoodsSettlementSection
                agencyName="Distribution"
                businessId={businessId || BUSINESS_IDS.CHAMPIKA_DISTRIBUTION}
                selectedCustomerId={selectedCustomerId}
                goodsItems={goodsItems}
                setGoodsItems={setGoodsItems}
                formatCurrency={formatCurrency}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Available Return Credits Card (Good Returns Only) */}
      {selectedCustomerId && visibleReturnCredits.length > 0 && (() => {
        const totalCredit = visibleReturnCredits.reduce(
          (sum, r) => sum + getReturnItemPricing(r).lineTotal,
          0
        );

        return (
          <Card className="border-emerald-300 bg-emerald-50/30 shadow-xs">
            <CardHeader className="py-3 px-4 border-b border-emerald-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <CardTitle className="text-sm font-bold text-emerald-950 flex items-center gap-1.5">
                  <Undo2 className="h-4 w-4 text-emerald-600" />
                  Approved Customer Good Return Credits ({visibleReturnCredits.length})
                </CardTitle>
                <CardDescription className="text-xs text-emerald-800">
                  This customer has Good Return notes (rep-approved or created in the office) that can reduce and settle their unpaid invoices.
                </CardDescription>
              </div>
              <Badge className="w-fit bg-emerald-100 text-emerald-800 border-emerald-300 font-mono text-xs font-bold px-2.5 py-1">
                Total Available: LKR {totalCredit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </Badge>
            </CardHeader>
            <CardContent className="p-3 space-y-2">
              {visibleReturnCredits.map((ret) => {
                const { invoiceNo, unitPrice: rate, lineTotal } = getReturnItemPricing(ret);
                const isApplied = goodsItems.some((gi) => gi.id === `return_${ret.id}`);

                return (
                  <div
                    key={ret.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-lg border border-emerald-200/80 bg-white gap-3 shadow-xs"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono font-bold text-xs text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded">
                          {ret.return_number}
                        </span>
                        {invoiceNo !== "-" && (
                          <span className="text-[11px] font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded">
                            Bill Ref: {invoiceNo}
                          </span>
                        )}
                        <Badge
                          variant="outline"
                          className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-300 font-semibold"
                        >
                          Good Return
                        </Badge>
                        {ret.created_at && (
                          <span className="text-[11px] text-muted-foreground">
                            {new Date(ret.created_at).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-800 font-medium truncate">
                        {ret.products?.name} &bull;{" "}
                        <span className="font-mono text-muted-foreground">{ret.products?.sku}</span>
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {ret.quantity} {ret.products?.unit_of_measure || "units"} @ LKR {rate.toLocaleString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2.5 shrink-0 self-end sm:self-center">
                      <span className="font-bold font-mono text-sm text-emerald-700">
                        LKR {lineTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs font-semibold px-2.5 text-slate-700 border-slate-300 hover:bg-slate-100"
                        onClick={() => setViewingReturnModal(ret)}
                        title="View Return Note Details"
                      >
                        <Eye className="w-3.5 h-3.5 mr-1 text-slate-600" /> View Note
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={isApplied ? "outline" : "default"}
                        className={cn(
                          "h-8 text-xs font-semibold px-3",
                          isApplied
                            ? "border-emerald-300 text-emerald-700 bg-emerald-50 cursor-default"
                            : "bg-emerald-600 hover:bg-emerald-700 text-white"
                        )}
                        onClick={() => handleApplyReturnCredit(ret)}
                        disabled={isApplied}
                      >
                        {isApplied ? (
                          <>
                            <Check className="w-3.5 h-3.5 mr-1 text-emerald-600" /> Applied
                          </>
                        ) : (
                          <>
                            <Plus className="w-3.5 h-3.5 mr-1" /> Apply to Settle
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        );
      })()}

      {/* Step 2 */}
      <Card>
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
                  title="Auto-allocate payment to oldest pending invoices"
                  className="text-xs bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100"
                >
                  <Zap className="w-3.5 h-3.5 mr-1 text-blue-600" /> Auto-Allocate
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    downloadCustomerStatement(
                      selectedCustomer?.name || "Customer",
                      statementInvoices.length > 0 ? statementInvoices : pendingInvoices,
                      "CHAMPIKA DISTRIBUTION"
                    )
                  }
                  title="Download Single Customer Outstanding PDF Statement"
                  className="text-xs text-blue-700 border-blue-200 hover:bg-blue-50"
                >
                  <Download className="w-3.5 h-3.5 mr-1 text-blue-600" /> PDF Statement
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    printCustomerStatement(
                      selectedCustomer?.name || "Customer",
                      statementInvoices.length > 0 ? statementInvoices : pendingInvoices,
                      "CHAMPIKA DISTRIBUTION"
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
                      statementInvoices.length > 0 ? statementInvoices : pendingInvoices,
                      "CHAMPIKA DISTRIBUTION"
                    )
                  }
                  title="Share Outstanding Statement via WhatsApp / Link"
                  className="text-xs text-green-700 border-green-200 hover:bg-green-50"
                >
                  <Share2 className="w-3.5 h-3.5 mr-1 text-green-600" /> Share
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsCustomStatementOpen(true)}
                  title="Customize Statement Tables, Cheques, Goods & Options"
                  className="text-xs bg-blue-50 text-blue-700 border-blue-300 hover:bg-blue-100 font-medium shadow-sm"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5 mr-1 text-blue-600" /> Customize Report
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
                        <TableRow key={inv.id} className={cn(isSelected && "bg-blue-50/40")}>
                          <TableCell>
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => toggleInvoice(inv.id, inv)}
                              className="data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                            />
                          </TableCell>
                          <TableCell className="font-medium font-mono text-sm">
                            <div>{inv.invoiceNo}</div>
                            {/* Return Deducted badge for already settled return */}
                            {getReturnDeductedAmount(inv) > 0 && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1 rounded mt-0.5">
                                <Undo2 className="w-2.5 h-2.5" /> Return Deducted ({formatCurrency(getReturnDeductedAmount(inv))})
                              </span>
                            )}
                            {/* Return Deducted badge for currently applied return in this session */}
                            {goodsItems.some((g) => g.invoiceNo === inv.invoiceNo) && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-1 rounded mt-0.5">
                                <Undo2 className="w-2.5 h-2.5" /> Return Deducted ({formatCurrency(
                                  goodsItems
                                    .filter((g) => g.invoiceNo === inv.invoiceNo)
                                    .reduce((sum, g) => sum + (g.totalValue || 0), 0)
                                )})
                              </span>
                            )}
                            {/* Button to deduct return if matching available return credit exists */}
                            {(() => {
                              const matchingReturns = visibleReturnCredits.filter((ret) => {
                                const p = getReturnItemPricing(ret);
                                return p.invoiceNo === inv.invoiceNo;
                              });
                              if (matchingReturns.length === 0) return null;
                              const isAlreadyApplied = matchingReturns.every((r) =>
                                goodsItems.some((g) => g.id === `return_${r.id}`)
                              );
                              if (isAlreadyApplied) return null;

                              const totalAvail = matchingReturns.reduce(
                                (sum, r) => sum + getReturnItemPricing(r).lineTotal,
                                0
                              );

                              return (
                                <button
                                  type="button"
                                  onClick={() => {
                                    matchingReturns.forEach((r) => handleApplyReturnCredit(r));
                                  }}
                                  className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-300 px-1.5 py-0.5 rounded mt-0.5 transition-colors cursor-pointer"
                                  title={`Click to deduct return credit from ${inv.invoiceNo}`}
                                >
                                  <Undo2 className="w-2.5 h-2.5" /> Deduct Return ({formatCurrency(totalAvail)})
                                </button>
                              );
                            })()}
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
                              <div>
                                <span className="text-orange-600">{formatCurrency(inv.balance)}</span>
                                {isSelected && (s?.settleAmount || 0) > 0 && (
                                  <div className="text-[11px] text-muted-foreground font-normal font-mono">
                                    Final: {formatCurrency(Math.max(0, inv.balance - (s?.settleAmount || 0)))}
                                  </div>
                                )}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setHistoryModalInvoice(inv)}
                              className="h-7 px-2 text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-100/50 gap-1"
                              title="View Payment History"
                            >
                              <History className="w-3.5 h-3.5" />
                              {paymentCount > 0 ? (
                                <span className="font-semibold text-blue-700">{paymentCount}</span>
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
                        isSelected ? "border-blue-400 bg-blue-50" : "bg-card"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleInvoice(inv.id, inv)}
                            className="data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                          />
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold font-mono text-sm">{inv.invoiceNo}</span>
                              {renderAgeBadge(ageDays)}
                              {getReturnDeductedAmount(inv) > 0 && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1 rounded">
                                  <Undo2 className="w-2.5 h-2.5" /> Return Deducted ({formatCurrency(getReturnDeductedAmount(inv))})
                                </span>
                              )}
                              {goodsItems.some((g) => g.invoiceNo === inv.invoiceNo) && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-1 rounded">
                                  <Undo2 className="w-2.5 h-2.5" /> Return Deducted
                                </span>
                              )}
                            </div>
                            {/* Matching available return button on mobile */}
                            {(() => {
                              const matchingReturns = visibleReturnCredits.filter((ret) => {
                                const p = getReturnItemPricing(ret);
                                return p.invoiceNo === inv.invoiceNo;
                              });
                              if (matchingReturns.length === 0) return null;
                              const isAlreadyApplied = matchingReturns.every((r) =>
                                goodsItems.some((g) => g.id === `return_${r.id}`)
                              );
                              if (isAlreadyApplied) return null;
                              const totalAvail = matchingReturns.reduce(
                                (sum, r) => sum + getReturnItemPricing(r).lineTotal,
                                0
                              );
                              return (
                                <button
                                  type="button"
                                  onClick={() => matchingReturns.forEach((r) => handleApplyReturnCredit(r))}
                                  className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-300 px-1.5 py-0.5 rounded mt-1 transition-colors cursor-pointer"
                                >
                                  <Undo2 className="w-2.5 h-2.5" /> Deduct Return ({formatCurrency(totalAvail)})
                                </button>
                              );
                            })()}
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
                            className="h-5 w-5 p-0 text-blue-600"
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
        <Card className={cn("border-2", remaining < 0 ? "border-destructive/50 bg-destructive/5" : remaining === 0 ? "border-green-500/50 bg-green-50/50" : "border-primary/20")}>
          <CardHeader className="pb-3"><StepBadge step={3} label="Summary & Submit" /></CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex flex-wrap gap-6">
                <div className="space-y-0.5"><p className="text-xs text-muted-foreground uppercase tracking-wide">{methodLabel[paymentMethod]} Amount</p><p className="text-xl font-bold">{formatCurrency(totalAmount)}</p></div>
                <div className="space-y-0.5"><p className="text-xs text-muted-foreground uppercase tracking-wide">Allocated</p><p className="text-xl font-bold text-primary">{formatCurrency(totalAllocated)}</p></div>
                <div className="space-y-0.5"><p className="text-xs text-muted-foreground uppercase tracking-wide">Remaining</p>
                  <p className={cn("text-xl font-bold", remaining < 0 ? "text-destructive" : remaining === 0 ? "text-green-600" : "text-muted-foreground")}>{formatCurrency(remaining)}</p>
                </div>
              </div>
              <div className="flex gap-2 w-full sm:w-auto">
                <Button variant="outline" onClick={resetForm} disabled={isSubmitting} className="flex-1 sm:flex-none">Clear</Button>
                <Button onClick={handleSubmit} disabled={isSubmitting || remaining < 0 || Object.values(settlements).filter((s) => s.selected && s.settleAmount > 0).length === 0} className="flex-1 sm:flex-none gap-2">
                  {isSubmitting ? <><Loader2 className="h-4 w-4 animate-spin" />Saving…</> : <><BanknoteIcon className="h-4 w-4" />Settle Invoices</>}
                </Button>
              </div>
            </div>
            {remaining < 0 && <p className="mt-3 text-sm text-destructive flex items-center gap-1"><AlertCircle className="h-4 w-4" />Allocated amount exceeds payment amount.</p>}
            {remaining > 0 && totalAllocated > 0 && (
              <div className="mt-3 flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2.5">
                <AlertCircle className="h-4 w-4 text-blue-600 shrink-0" />
                <p className="text-sm text-blue-700"><span className="font-semibold">{formatCurrency(remaining)}</span> will not be applied. Adjust settle amounts or select more invoices.</p>
              </div>
            )}
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
            <DialogTitle className="flex items-center gap-2 text-blue-900">
              <History className="w-5 h-5 text-blue-600" />
              Payment History — {historyModalInvoice?.invoiceNo}
            </DialogTitle>
            <DialogDescription>
              Customer: <span className="font-semibold text-foreground">{selectedCustomer?.name}</span>
            </DialogDescription>
          </DialogHeader>

          {historyModalInvoice && (
            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-3 gap-2 p-3 bg-slate-50 border rounded-lg text-xs">
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
                              Method:{" "}
                              {p.method === "goods" ? (
                                p.goodsSummary?.includes("Return Note") || p.goodsSummary?.includes("Good Return") || p.chequeNo?.includes("RET-") ? (
                                  <span className="font-semibold text-emerald-800 bg-emerald-100 border border-emerald-300 px-1.5 py-0.5 rounded text-[10px] inline-flex items-center gap-1">
                                    <Undo2 className="w-3 h-3 text-emerald-700" />
                                    Good Return Credit
                                  </span>
                                ) : (
                                  <span className="font-semibold text-amber-800 bg-amber-100 border border-amber-300 px-1.5 py-0.5 rounded text-[10px]">
                                    Goods Settlement
                                  </span>
                                )
                              ) : (
                                <span className="capitalize font-semibold text-slate-700">{p.method}</span>
                              )}
                              {(p.receiptNumber || p.receipt_number) && (
                                <span className="font-bold font-mono text-purple-800 bg-purple-100 border border-purple-200 px-1.5 py-0.5 rounded text-[10px]">
                                  Receipt #{p.receiptNumber || p.receipt_number}
                                </span>
                              )}
                              {p.chequeNo && !p.chequeNo.startsWith("Goods:") && ` (Cheque #${p.chequeNo})`}
                              {p.chequeStatus && (
                                <span className={cn("ml-1 font-semibold", isReturned ? "text-red-700 bg-red-100 px-1.5 py-0.5 rounded border border-red-200" : "text-slate-600")}>
                                  • Status: {p.chequeStatus}{isReturned ? " [CHEQUE RETURNED]" : ""}
                                </span>
                              )}
                            </p>
                            {p.goodsSummary && (
                              <div className={cn(
                                "mt-1.5 text-[11px] rounded px-2.5 py-1.5 border",
                                p.goodsSummary?.includes("Return Note") || p.goodsSummary?.includes("Good Return")
                                  ? "bg-emerald-50 text-emerald-950 border-emerald-200"
                                  : "bg-amber-50 text-amber-900 border-amber-200"
                              )}>
                                <span className="font-bold">
                                  {p.goodsSummary?.includes("Return Note") ? "Return Note Details: " : "Settlement Items: "}
                                </span>
                                {p.goodsSummary}
                              </div>
                            )}
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

      {/* ── View Good Return Note Details Dialog Modal ── */}
      <Dialog
        open={!!viewingReturnModal}
        onOpenChange={(open) => !open && setViewingReturnModal(null)}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="flex items-center gap-2 text-emerald-950">
                <Undo2 className="w-5 h-5 text-emerald-600" />
                Good Return Note — {viewingReturnModal?.return_number}
              </DialogTitle>
              <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300">
                Good Return
              </Badge>
            </div>
            <DialogDescription>
              Customer: <span className="font-semibold text-foreground">{selectedCustomer?.name}</span>
            </DialogDescription>
          </DialogHeader>

          {viewingReturnModal && (() => {
            const { invoiceNo, unitPrice, lineTotal } = getReturnItemPricing(viewingReturnModal);
            const isApplied = goodsItems.some((gi) => gi.id === `return_${viewingReturnModal.id}`);

            return (
              <div className="space-y-4 pt-2">
                <div className="grid grid-cols-2 gap-3 p-3 bg-emerald-50/50 border border-emerald-100 rounded-lg text-xs">
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Return Date</span>
                    <span className="font-semibold text-slate-800">
                      {viewingReturnModal.return_date
                        ? new Date(viewingReturnModal.return_date).toLocaleDateString()
                        : viewingReturnModal.created_at
                        ? new Date(viewingReturnModal.created_at).toLocaleDateString()
                        : "—"}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Original Bill Reference</span>
                    <span className="font-mono font-bold text-blue-700">
                      {invoiceNo !== "-" ? invoiceNo : "General Purchase History"}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Returned Quantity</span>
                    <span className="font-bold text-slate-900 text-sm">
                      {viewingReturnModal.quantity} {viewingReturnModal.products?.unit_of_measure || "units"}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Total Return Credit</span>
                    <span className="font-mono font-bold text-emerald-700 text-sm">
                      LKR {lineTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                <div className="space-y-2 border rounded-lg p-3 text-xs bg-slate-50">
                  <div className="flex justify-between items-baseline">
                    <span className="font-semibold text-slate-800">Product:</span>
                    <span className="font-bold text-slate-900 text-right">{viewingReturnModal.products?.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">SKU / Code:</span>
                    <span className="font-mono">{viewingReturnModal.products?.sku || "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Unit Price:</span>
                    <span className="font-mono">
                      LKR {unitPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  {viewingReturnModal.profiles?.full_name && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Filed By:</span>
                      <span className="font-medium text-slate-800">{viewingReturnModal.profiles.full_name}</span>
                    </div>
                  )}
                  {viewingReturnModal.reason && (
                    <div className="border-t pt-2 mt-2">
                      <span className="text-muted-foreground block text-[11px]">Notes / Reason:</span>
                      <p className="text-slate-700 mt-0.5 whitespace-pre-wrap">{viewingReturnModal.reason}</p>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={() => setViewingReturnModal(null)}>
                    Close
                  </Button>
                  <Button
                    onClick={() => {
                      handleApplyReturnCredit(viewingReturnModal);
                      setViewingReturnModal(null);
                    }}
                    disabled={isApplied}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
                  >
                    {isApplied ? (
                      <>
                        <Check className="w-4 h-4" /> Already Applied
                      </>
                    ) : (
                      <>
                        <Plus className="w-4 h-4" /> Apply Credit to Settle Invoice
                      </>
                    )}
                  </Button>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      <CustomStatementDialog
        open={isCustomStatementOpen}
        onOpenChange={setIsCustomStatementOpen}
        customerName={selectedCustomer?.name || "Customer"}
        invoices={statementInvoices.length > 0 ? statementInvoices : pendingInvoices}
        companyName="CHAMPIKA DISTRIBUTION"
        themeColor="blue"
      />
    </div>
  );
}
