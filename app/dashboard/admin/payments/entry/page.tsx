"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Check,
  ChevronsUpDown,
  Loader2,
  AlertCircle,
  ReceiptText,
  BanknoteIcon,
  ClipboardCheck,
  History,
  Download,
  Printer,
  Share2,
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
import { BUSINESS_IDS, BUSINESS_NAMES } from "@/app/config/business-constants";
import { invalidatePaymentCaches } from "@/hooks/useCachedFetch";
import { ReceiptNumberInput } from "@/components/receipt-books/ReceiptNumberInput";
import {
  downloadCustomerStatement,
  printCustomerStatement,
  shareCustomerStatement,
  InvoicePaymentRecord,
} from "@/lib/customer-statement-report";

// ─── Business options for admin selector ───────────────────────────────────────
const BUSINESS_OPTIONS = Object.entries(BUSINESS_NAMES).map(([id, name]) => ({
  id,
  name,
}));

// ─── Local Helpers ─────────────────────────────────────────────────────────────

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("en-LK", {
    style: "currency",
    currency: "LKR",
    minimumFractionDigits: 2,
  }).format(amount);
};

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

// ─── Types ─────────────────────────────────────────────────────────────────────

interface Customer {
  id: string;
  name: string;
  shopName?: string;
  phone?: string;
  ownerName?: string;
}

interface Bank {
  id: string;
  bank_code: string;
  bank_name: string;
}

interface CompanyAccount {
  id: string;
  account_name: string;
  account_type: string;
  account_number: string | null;
}

interface PendingInvoice {
  id: string;
  orderNumber: string;
  invoiceNo?: string;
  date: string;
  totalAmount: number;
  paidAmount: number;
  balance: number;
  payments?: InvoicePaymentRecord[];
}

interface InvoiceSettlement {
  invoiceId: string;
  selected: boolean;
  settleAmount: number;
}

type PaymentMethod = "cash" | "bank" | "cheque";

// ─── Helpers ───────────────────────────────────────────────────────────────────

function StepBadge({ step, label }: { step: number; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold flex-shrink-0">
        {step}
      </div>
      <span className="text-sm font-medium text-muted-foreground">{label}</span>
    </div>
  );
}

// ─── Component ─────────────────────────────────────────────────────────────────

export default function AdminPaymentEntryPage() {
  // Business filter (admin-only selector)
  const [selectedBusinessId, setSelectedBusinessId] = useState<string>("");

  // Master data
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [companyAccounts, setCompanyAccounts] = useState<CompanyAccount[]>([]);
  const [pendingInvoices, setPendingInvoices] = useState<PendingInvoice[]>([]);

  // Loading / submitting
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [loadingBanks, setLoadingBanks] = useState(true);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Popover control
  const [customerOpen, setCustomerOpen] = useState(false);
  const [bankOpen, setBankOpen] = useState(false);

  // Form – header
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [paymentDate, setPaymentDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [totalAmount, setTotalAmount] = useState<number>(0);
  const [notes, setNotes] = useState("");

  // Cheque-only fields
  const [chequeNumber, setChequeNumber] = useState("");
  const [chequeDate, setChequeDate] = useState("");
  const [selectedBankId, setSelectedBankId] = useState("");

  // Cash / Bank-only field
  const [selectedAccountId, setSelectedAccountId] = useState("");

  // Receipt details
  const [receiptNumber, setReceiptNumber] = useState("");
  const [receiptBookId, setReceiptBookId] = useState<string | undefined>(undefined);
  const [paidOnCustomerBill, setPaidOnCustomerBill] = useState(false);

  // Invoice settlement map
  const [settlements, setSettlements] = useState<
    Record<string, InvoiceSettlement>
  >({});
  const [historyModalInvoice, setHistoryModalInvoice] = useState<PendingInvoice | null>(null);

  // ── Data fetching ─────────────────────────────────────────────────────────────

  // Re-fetch customers whenever the selected business changes
  useEffect(() => {
    if (!selectedBusinessId) {
      setCustomers([]);
      setSelectedCustomerId("");
      setPendingInvoices([]);
      setSettlements({});
      return;
    }

    const fetchCustomers = async () => {
      setLoadingCustomers(true);
      setCustomers([]);
      setSelectedCustomerId("");
      setPendingInvoices([]);
      setSettlements({});
      try {
        const res = await fetch(`/api/orders?businessId=${selectedBusinessId}`);
        const data = await res.json();
        if (res.ok) {
          const orders: any[] = Array.isArray(data) ? data : [];
          const unpaid = orders.filter(
            (o) =>
              o.paymentStatus !== "Paid" &&
              o.status !== "Cancelled" &&
              (o.status === "Delivered" ||
                o.status === "Completed" ||
                o.paymentStatus === "Unpaid" ||
                o.paymentStatus === "Partial")
          );
          const seen = new Set<string>();
          const unique: Customer[] = [];
          for (const o of unpaid) {
            const cid = o.customerId || o.customer_id;
            const cname = o.customerName || o.customer_name || "Unknown";
            if (cid && !seen.has(cid)) {
              seen.add(cid);
              unique.push({ id: cid, name: cname });
            }
          }
          unique.sort((a, b) => a.name.localeCompare(b.name));
          setCustomers(unique);
        }
      } catch {
        toast.error("Failed to load customers");
      } finally {
        setLoadingCustomers(false);
      }
    };

    fetchCustomers();
  }, [selectedBusinessId]);

  useEffect(() => {
    const fetchBanks = async () => {
      try {
        const res = await fetch("/api/finance/bank-codes");
        const data = await res.json();
        if (res.ok) setBanks(data ?? []);
      } catch {
        toast.error("Failed to load banks");
      } finally {
        setLoadingBanks(false);
      }
    };

    const fetchAccounts = async () => {
      try {
        const res = await fetch("/api/finance/accounts");
        const data = await res.json();
        if (res.ok) {
          const accounts: CompanyAccount[] = (data ?? []).map((acc: any) => ({
            id: acc.id,
            account_name: acc.account_name,
            account_type: acc.account_type?.toLowerCase() ?? "",
            account_number: acc.account_number ?? null,
          }));
          setCompanyAccounts(accounts);
        }
      } catch {
        toast.error("Failed to load accounts");
      } finally {
        setLoadingAccounts(false);
      }
    };

    fetchBanks();
    fetchAccounts();
  }, []);

  // Filter accounts by method
  const availableAccounts = companyAccounts.filter((acc) => {
    const t = acc.account_type;
    if (paymentMethod === "cash")
      return t === "cash" || t === "cash on hand";
    if (paymentMethod === "bank")
      return t === "savings" || t === "saving" || t === "current";
    return false;
  });

  // Fetch pending invoices for selected customer
  const fetchPendingInvoices = useCallback(async (customerId: string) => {
    if (!customerId) return;
    setLoadingInvoices(true);
    setPendingInvoices([]);
    setSettlements({});
    try {
      const payQs = new URLSearchParams();
      if (selectedBusinessId) payQs.set("businessId", selectedBusinessId);
      const [res, payRes] = await Promise.all([
        fetch(`/api/orders/unpaid/by-customer?customer_id=${customerId}`),
        fetch(`/api/payments?${payQs.toString()}`),
      ]);

      const paymentsData = payRes.ok ? await payRes.json() : [];
      const paymentMap: Record<string, InvoicePaymentRecord[]> = {};
      (paymentsData || []).forEach((p: any) => {
        if (p.is_cancelled) return;
        const invId = p.invoice_id || p.invoices?.id;
        const orderId = p.order_id || p.orders?.id;
        const invNo = p.invoices?.invoice_no || p.orders?.order_number;
        const keys = [invId, orderId, invNo].filter(Boolean);
        keys.forEach((key) => {
          if (!paymentMap[key]) paymentMap[key] = [];
          // Avoid duplicate push if key appears multiple times
          if (!paymentMap[key].some((exist) => exist.id === p.id)) {
            paymentMap[key].push({
              id: p.id,
              paymentDate: p.payment_date,
              amount: p.amount,
              method: p.payment_method || p.method || "cash",
              receiptNumber: p.receipt_number || p.receiptNumber || null,
              chequeNo: p.cheque_number || p.cheque_no || null,
              chequeStatus: p.cheque_status || null,
            });
          }
        });
      });

      if (res.ok) {
        const data = await res.json();
        const orders: any[] = data.orders ?? [];
        const invoices: PendingInvoice[] = orders.map((o) => {
          const key = o.id || o.order_number;
          const history = paymentMap[key] || paymentMap[o.id] || paymentMap[o.order_number] || [];
          return {
            id: o.id,
            orderNumber: o.order_number,
            invoiceNo: o.order_number,
            date: o.order_date ?? o.date ?? "",
            totalAmount: o.total_amount ?? 0,
            paidAmount: o.paid_amount ?? 0,
            balance: o.balance ?? 0,
            payments: history,
          };
        });
        setPendingInvoices(invoices);
        const map: Record<string, InvoiceSettlement> = {};
        invoices.forEach((inv) => {
          map[inv.id] = {
            invoiceId: inv.id,
            selected: false,
            settleAmount: 0,
          };
        });
        setSettlements(map);
      } else {
        // Fallback: fetch orders filtered by business and customer
        const qs = new URLSearchParams();
        if (selectedBusinessId) qs.set("businessId", selectedBusinessId);
        const fallbackRes = await fetch(`/api/orders?${qs.toString()}`);
        if (fallbackRes.ok) {
          const allOrders = await fallbackRes.json();
          const filtered = allOrders.filter(
            (o: any) =>
              (o.customerId === customerId || o.customer_id === customerId) &&
              o.paymentStatus !== "Paid" &&
              o.status !== "Cancelled" &&
              (o.status === "Delivered" || o.status === "Completed" || o.paymentStatus === "Unpaid" || o.paymentStatus === "Partial")
          );
          const invoices: PendingInvoice[] = filtered.map((o: any) => {
            const key = o.id || o.invoiceNo || o.orderId;
            const history = paymentMap[key] || paymentMap[o.id] || [];
            return {
              id: o.id,
              orderNumber: o.invoiceNo || o.orderId || o.order_number || o.id,
              invoiceNo: o.invoiceNo || o.orderId || o.order_number || o.id,
              date: o.date || o.order_date || o.createdAt?.split("T")[0] || "",
              totalAmount: o.totalAmount ?? 0,
              paidAmount: o.paidAmount ?? 0,
              balance: o.dueAmount ?? (o.totalAmount - (o.paidAmount ?? 0)),
              payments: history,
            };
          });
          setPendingInvoices(invoices);
          const map: Record<string, InvoiceSettlement> = {};
          invoices.forEach((inv) => {
            map[inv.id] = {
              invoiceId: inv.id,
              selected: false,
              settleAmount: 0,
            };
          });
          setSettlements(map);
        }
      }
    } catch {
      toast.error("Failed to load pending invoices");
    } finally {
      setLoadingInvoices(false);
    }
  }, [selectedBusinessId]);

  useEffect(() => {
    if (selectedCustomerId) {
      fetchPendingInvoices(selectedCustomerId);
    } else {
      setPendingInvoices([]);
      setSettlements({});
    }
  }, [selectedCustomerId, fetchPendingInvoices]);

  // Reset account when method changes
  useEffect(() => {
    setSelectedAccountId("");
  }, [paymentMethod]);

  // ── Computed ──────────────────────────────────────────────────────────────────

  const totalAllocated = Object.values(settlements)
    .filter((s) => s.selected)
    .reduce((sum, s) => sum + (s.settleAmount || 0), 0);

  const remaining = totalAmount - totalAllocated;

  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId);
  const selectedBank = banks.find((b) => b.id === selectedBankId);

  // ── Invoice selection ─────────────────────────────────────────────────────────

  const toggleInvoice = (invoiceId: string, invoice: PendingInvoice) => {
    setSettlements((prev) => {
      const current = prev[invoiceId];
      const nowSelected = !current.selected;
      let autoAmount = 0;
      if (nowSelected) {
        const alreadyAllocated = Object.values(prev)
          .filter((s) => s.selected && s.invoiceId !== invoiceId)
          .reduce((sum, s) => sum + s.settleAmount, 0);
        const currentRemaining = totalAmount - alreadyAllocated;
        autoAmount = Math.min(invoice.balance, Math.max(0, currentRemaining));
      }
      return {
        ...prev,
        [invoiceId]: {
          ...current,
          selected: nowSelected,
          settleAmount: nowSelected ? autoAmount : 0,
        },
      };
    });
  };

  const updateSettleAmount = (
    invoiceId: string,
    value: number,
    maxBalance: number
  ) => {
    const capped = Math.min(Math.max(0, value), maxBalance);
    setSettlements((prev) => ({
      ...prev,
      [invoiceId]: { ...prev[invoiceId], settleAmount: capped },
    }));
  };

  // ── Reset ─────────────────────────────────────────────────────────────────────

  const resetForm = () => {
    setSelectedCustomerId("");
    setPaymentMethod("cash");
    setPaymentDate(new Date().toISOString().split("T")[0]);
    setTotalAmount(0); setNotes(""); setChequeNumber(""); setChequeDate(""); setSelectedBankId(""); setSelectedAccountId("");
    setReceiptNumber(""); setReceiptBookId(undefined);
    setPendingInvoices([]);
    setSettlements({});
  };

  const isReceiptOptional = paymentMethod === "bank" || paidOnCustomerBill;
  const isReceiptRequired = !isReceiptOptional;

  const validate = () => {
    if (!selectedCustomerId) {
      toast.error("Please select a customer");
      return false;
    }
    if (isReceiptRequired && !receiptNumber.trim()) {
      toast.error("Please enter receipt number");
      return false;
    }
    if (totalAmount <= 0) {
      toast.error("Please enter a valid payment amount");
      return false;
    }
    if (paymentMethod === "cheque") {
      if (!chequeNumber.trim()) {
        toast.error("Please enter a cheque number");
        return false;
      }
      if (!chequeDate) {
        toast.error("Please enter the cheque date");
        return false;
      }
      if (!selectedBankId) {
        toast.error("Please select a bank");
        return false;
      }
    }
    if (
      (paymentMethod === "cash" || paymentMethod === "bank") &&
      !selectedAccountId
    ) {
      toast.error(
        `Please select a ${paymentMethod === "cash" ? "cash" : "bank"} account`
      );
      return false;
    }
    const selected = Object.values(settlements).filter(
      (s) => s.selected && s.settleAmount > 0
    );
    if (selected.length === 0) {
      toast.error("Please select at least one invoice to settle");
      return false;
    }
    if (totalAllocated > totalAmount) {
      toast.error("Allocated amount exceeds payment amount");
      return false;
    }
    return true;
  };

  // ── Submission ────────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (!validate()) return;

    const selectedSettlements = Object.values(settlements).filter(
      (s) => s.selected && s.settleAmount > 0
    );

    setIsSubmitting(true);
    let successCount = 0;
    let failCount = 0;

    try {
      for (const s of selectedSettlements) {
        const payload = {
          orderId: s.invoiceId,
          customerId: selectedCustomerId,
          amount: s.settleAmount,
          date: paymentDate,
          method: paymentMethod,
          notes: notes || undefined,
          depositAccountId:
            paymentMethod === "cash" || paymentMethod === "bank"
              ? selectedAccountId
              : null,
          chequeNo: paymentMethod === "cheque" ? chequeNumber : null,
          chequeDate: paymentMethod === "cheque" ? chequeDate : null,
          bankId: paymentMethod === "cheque" ? selectedBankId : null,
          receiptNumber: receiptNumber || undefined,
          receiptBookId: receiptBookId || undefined,
          performedByName: getUserBusinessContext()?.name ?? null,
          performedByEmail: getUserBusinessContext()?.email ?? null,
        };

        const res = await fetch("/api/payments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (res.ok) {
          successCount++;
        } else {
          failCount++;
        }
      }

      // Save overpayment as credit balance
      const overpayment = parseFloat(remaining.toFixed(2));
      if (overpayment > 0 && successCount > 0) {
        const creditPaymentNumber = `CREDIT-${Date.now()}`;
        await fetch("/api/payments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            payment_number: creditPaymentNumber,
            order_id: null,
            customer_id: selectedCustomerId,
            payment_date: paymentDate,
            amount: overpayment,
            payment_method: "credit_balance",
            notes: `Overpayment credit — ${paymentDate}`,
          }),
        });
        toast.info(`${formatCurrency(overpayment)} saved as customer credit balance`);
      }

      if (successCount > 0) {
        toast.success(
          `${successCount} invoice${successCount > 1 ? "s" : ""} settled successfully!`
        );
        resetForm();
      }
      if (failCount > 0) {
        toast.error(`${failCount} payment(s) failed. Please check and retry.`);
      }
    } catch (err) {
      console.error("Submission error:", err);
      toast.error("An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ───────────────────────────────────────────────────────────────────────────────
  //  Render
  // ───────────────────────────────────────────────────────────────────────────────

  const methodLabel: Record<PaymentMethod, string> = {
    cash: "Cash",
    bank: "Bank Transfer",
    cheque: "Cheque",
  };

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
          <ClipboardCheck className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Payment Entry</h1>
          <p className="text-muted-foreground text-sm">
            Record a customer payment and settle pending invoices
          </p>
        </div>
      </div>

      {/* ── Business Selector ──────────────────────────────────────────── */}
      <Card>
        <CardContent className="pt-5 pb-4">
          <div className="flex items-center gap-4">
            <div className="space-y-1 flex-1 max-w-xs">
              <Label>Business *</Label>
              <Select value={selectedBusinessId} onValueChange={setSelectedBusinessId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a business…" />
                </SelectTrigger>
                <SelectContent>
                  {BUSINESS_OPTIONS.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedBusinessId && (
              <p className="text-xs text-muted-foreground mt-5">
                Showing customers &amp; invoices for this business only
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── SECTION 1: Payment Details ──────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <StepBadge step={1} label="Payment Details" />
          <CardDescription>
            Select customer, payment method, and enter payment information
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">

            {/* Customer — filtered by selected business */}
            <div className="space-y-2 sm:col-span-2 lg:col-span-1">
              <Label>Customer *</Label>
              <Popover open={customerOpen} onOpenChange={setCustomerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={customerOpen}
                    className="w-full justify-between font-normal"
                    disabled={loadingCustomers || !selectedBusinessId}
                  >
                    {loadingCustomers ? (
                      <span className="flex items-center gap-2 text-muted-foreground">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Loading…
                      </span>
                    ) : !selectedBusinessId ? (
                      <span className="text-muted-foreground">Select a business first…</span>
                    ) : selectedCustomer ? (
                      <span className="truncate">{selectedCustomer.name}</span>
                    ) : (
                      <span className="text-muted-foreground">
                        Select customer…
                      </span>
                    )}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  className="p-0"
                  style={{ width: "var(--radix-popover-trigger-width)" }}
                >
                  <Command>
                    <CommandInput placeholder="Search customers…" />
                    <CommandList>
                      <CommandEmpty>No customers found.</CommandEmpty>
                      <CommandGroup>
                        {customers.map((c) => (
                          <CommandItem
                            key={c.id}
                            value={c.name}
                            onSelect={() => {
                              setSelectedCustomerId(c.id);
                              setCustomerOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                selectedCustomerId === c.id
                                  ? "opacity-100"
                                  : "opacity-0"
                              )}
                            />
                            <div>
                              <div className="font-medium">{c.name}</div>
                              {c.shopName && c.shopName !== c.name && (
                                <div className="text-xs text-muted-foreground">
                                  {c.shopName}
                                </div>
                              )}
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
                businessId={selectedBusinessId || undefined}
                required={isReceiptRequired}
                hideLabel={true}
                placeholder={isReceiptOptional ? "Optional (No paper receipt)" : "e.g. 1001"}
              />
            </div>

            {/* Payment Method */}
            <div className="space-y-2">
              <Label>Payment Method *</Label>
              <Select
                value={paymentMethod}
                onValueChange={(v) => setPaymentMethod(v as PaymentMethod)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="bank">Bank Transfer</SelectItem>
                  <SelectItem value="cheque">Cheque</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Payment Date */}
            <div className="space-y-2">
              <Label htmlFor="paymentDate">Payment Date *</Label>
              <Input
                id="paymentDate"
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
              />
            </div>

            {/* Total Amount */}
            <div className="space-y-2">
              <Label htmlFor="totalAmount">
                {methodLabel[paymentMethod]} Amount *
              </Label>
              <Input
                id="totalAmount"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={totalAmount || ""}
                onChange={(e) =>
                  setTotalAmount(parseFloat(e.target.value) || 0)
                }
              />
            </div>

            {/* ── CHEQUE FIELDS ── */}
            {paymentMethod === "cheque" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="chequeNumber">Cheque Number *</Label>
                  <Input
                    id="chequeNumber"
                    placeholder="e.g. 000123"
                    value={chequeNumber}
                    onChange={(e) => setChequeNumber(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="chequeDate">Cheque Date *</Label>
                  <Input
                    id="chequeDate"
                    type="date"
                    value={chequeDate}
                    onChange={(e) => setChequeDate(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Bank *</Label>
                  <Popover open={bankOpen} onOpenChange={setBankOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        className="w-full justify-between font-normal"
                        disabled={loadingBanks}
                      >
                        {loadingBanks ? (
                          <span className="flex items-center gap-2 text-muted-foreground">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            Loading…
                          </span>
                        ) : selectedBank ? (
                          <span className="truncate">
                            {selectedBank.bank_code} – {selectedBank.bank_name}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">
                            Select bank…
                          </span>
                        )}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      className="p-0"
                      style={{ width: "var(--radix-popover-trigger-width)" }}
                    >
                      <Command>
                        <CommandInput placeholder="Search banks…" />
                        <CommandList>
                          <CommandEmpty>No banks found.</CommandEmpty>
                          <CommandGroup>
                            {banks.map((b) => (
                              <CommandItem
                                key={b.id}
                                value={`${b.bank_code} ${b.bank_name}`}
                                onSelect={() => {
                                  setSelectedBankId(b.id);
                                  setBankOpen(false);
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    selectedBankId === b.id
                                      ? "opacity-100"
                                      : "opacity-0"
                                  )}
                                />
                                <div>
                                  <div className="font-medium">{b.bank_code}</div>
                                  <div className="text-xs text-muted-foreground">
                                    {b.bank_name}
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
              </>
            )}

            {/* ── CASH / BANK TRANSFER ACCOUNT ── */}
            {(paymentMethod === "cash" || paymentMethod === "bank") && (
              <div className="space-y-2">
                <Label>
                  {paymentMethod === "cash" ? "Cash Account" : "Bank Account"} *
                </Label>
                <Select
                  value={selectedAccountId}
                  onValueChange={setSelectedAccountId}
                  disabled={loadingAccounts}
                >
                  <SelectTrigger className="w-full">
                    {loadingAccounts ? (
                      <span className="flex items-center gap-2 text-muted-foreground">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Loading…
                      </span>
                    ) : (
                      <SelectValue placeholder="Select account…" />
                    )}
                  </SelectTrigger>
                  <SelectContent>
                    {availableAccounts.length === 0 ? (
                      <SelectItem value="none" disabled>
                        No accounts available
                      </SelectItem>
                    ) : (
                      availableAccounts.map((acc) => (
                        <SelectItem key={acc.id} value={acc.id}>
                          {acc.account_name}
                          {acc.account_number ? ` — ${acc.account_number}` : ""}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Notes */}
            <div className="space-y-2 sm:col-span-2 lg:col-span-3">
              <Label htmlFor="notes">Notes (optional)</Label>
              <Input
                id="notes"
                placeholder="Any additional notes…"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── SECTION 2: Pending Invoices ─────────────────────────────────── */}
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
                  onClick={() =>
                    downloadCustomerStatement(
                      selectedCustomer?.name || "Customer",
                      pendingInvoices.map((inv) => ({
                        id: inv.id,
                        invoiceNo: inv.orderNumber || inv.invoiceNo || inv.id,
                        date: inv.date,
                        totalAmount: inv.totalAmount,
                        paidAmount: inv.paidAmount,
                        balance: inv.balance,
                        payments: inv.payments,
                      })),
                      selectedBusinessId
                        ? BUSINESS_NAMES[selectedBusinessId as keyof typeof BUSINESS_NAMES]
                        : "CHAMPIKA HARDWARE & DISTRIBUTION"
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
                      pendingInvoices.map((inv) => ({
                        id: inv.id,
                        invoiceNo: inv.orderNumber || inv.invoiceNo || inv.id,
                        date: inv.date,
                        totalAmount: inv.totalAmount,
                        paidAmount: inv.paidAmount,
                        balance: inv.balance,
                        payments: inv.payments,
                      })),
                      selectedBusinessId
                        ? BUSINESS_NAMES[selectedBusinessId as keyof typeof BUSINESS_NAMES]
                        : "CHAMPIKA HARDWARE & DISTRIBUTION"
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
                      pendingInvoices.map((inv) => ({
                        id: inv.id,
                        invoiceNo: inv.orderNumber || inv.invoiceNo || inv.id,
                        date: inv.date,
                        totalAmount: inv.totalAmount,
                        paidAmount: inv.paidAmount,
                        balance: inv.balance,
                        payments: inv.payments,
                      })),
                      selectedBusinessId
                        ? BUSINESS_NAMES[selectedBusinessId as keyof typeof BUSINESS_NAMES]
                        : "CHAMPIKA HARDWARE & DISTRIBUTION"
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
              {/* Desktop table */}
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
                      <TableHead className="text-right w-40">
                        Settle Amount
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingInvoices.map((inv) => {
                      const s = settlements[inv.id];
                      const isSelected = s?.selected ?? false;
                      const ageDays = getInvoiceAgeDays(inv.date);
                      const paymentCount = inv.payments?.length || 0;

                      return (
                        <TableRow
                          key={inv.id}
                          className={cn(isSelected && "bg-primary/5")}
                        >
                          <TableCell>
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => toggleInvoice(inv.id, inv)}
                            />
                          </TableCell>
                          <TableCell className="font-medium font-mono text-sm">
                            {inv.orderNumber}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                            {inv.date
                              ? new Date(inv.date).toLocaleDateString()
                              : "—"}
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
                                updateSettleAmount(
                                  inv.id,
                                  parseFloat(e.target.value) || 0,
                                  inv.balance
                                )
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

              {/* Mobile cards */}
              <div className="md:hidden space-y-3">
                {pendingInvoices.map((inv) => {
                  const s = settlements[inv.id];
                  const isSelected = s?.selected ?? false;
                  const ageDays = getInvoiceAgeDays(inv.date);

                  return (
                    <div
                      key={inv.id}
                      className={cn(
                        "border rounded-lg p-4 space-y-3 transition-colors",
                        isSelected
                          ? "border-primary bg-primary/5"
                          : "bg-card"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleInvoice(inv.id, inv)}
                          />
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold font-mono text-sm">{inv.orderNumber}</span>
                              {renderAgeBadge(ageDays)}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {inv.date
                                ? new Date(inv.date).toLocaleDateString()
                                : "—"}
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
                        <span className="text-right">
                          {formatCurrency(inv.totalAmount)}
                        </span>
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
                              updateSettleAmount(
                                inv.id,
                                parseFloat(e.target.value) || 0,
                                inv.balance
                              )
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

      {/* ── Payment History Dialog Modal ── */}
      <Dialog
        open={!!historyModalInvoice}
        onOpenChange={(open) => !open && setHistoryModalInvoice(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-blue-900">
              <History className="w-5 h-5 text-blue-600" />
              Payment History — {historyModalInvoice?.orderNumber || historyModalInvoice?.invoiceNo}
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
                              Method: <span className="capitalize font-semibold text-slate-700">{p.method}</span>
                              {(p.receiptNumber || p.receipt_number) && (
                                <span className="font-bold font-mono text-purple-800 bg-purple-100 border border-purple-200 px-1.5 py-0.5 rounded text-[10px]">
                                  Receipt #{p.receiptNumber || p.receipt_number}
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

      {/* ── SECTION 3: Summary & Submit ─────────────────────────────────── */}
      {selectedCustomerId && totalAmount > 0 && (
        <Card
          className={cn(
            "border-2",
            remaining < 0
              ? "border-destructive/50 bg-destructive/5"
              : remaining === 0
              ? "border-green-500/50 bg-green-50/50 dark:bg-green-950/20"
              : "border-primary/20"
          )}
        >
          <CardHeader className="pb-3">
            <StepBadge step={3} label="Summary & Submit" />
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex flex-wrap gap-6">
                <div className="space-y-0.5">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">
                    {methodLabel[paymentMethod]} Amount
                  </p>
                  <p className="text-xl font-bold">
                    {formatCurrency(totalAmount)}
                  </p>
                </div>
                <div className="space-y-0.5">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">
                    Allocated
                  </p>
                  <p className="text-xl font-bold text-primary">
                    {formatCurrency(totalAllocated)}
                  </p>
                </div>
                <div className="space-y-0.5">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">
                    Remaining
                  </p>
                  <p
                    className={cn(
                      "text-xl font-bold",
                      remaining < 0
                        ? "text-destructive"
                        : remaining === 0
                        ? "text-green-600"
                        : "text-muted-foreground"
                    )}
                  >
                    {formatCurrency(remaining)}
                  </p>
                </div>
              </div>

              <div className="flex gap-2 w-full sm:w-auto">
                <Button
                  variant="outline"
                  onClick={resetForm}
                  disabled={isSubmitting}
                  className="flex-1 sm:flex-none"
                >
                  Clear
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={
                    isSubmitting ||
                    remaining < 0 ||
                    Object.values(settlements).filter(
                      (s) => s.selected && s.settleAmount > 0
                    ).length === 0
                  }
                  className="flex-1 sm:flex-none gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Saving…
                    </>
                  ) : (
                    <>
                      <BanknoteIcon className="h-4 w-4" />
                      Settle Invoices
                    </>
                  )}
                </Button>
              </div>
            </div>

            {remaining < 0 && (
              <p className="mt-3 text-sm text-destructive flex items-center gap-1">
                <AlertCircle className="h-4 w-4" />
                Allocated amount exceeds payment amount. Please adjust.
              </p>
            )}
            {remaining > 0 && totalAllocated > 0 && (
              <div className="mt-3 flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30 px-4 py-2.5">
                <AlertCircle className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  <span className="font-semibold">
                    {formatCurrency(remaining)}
                  </span>{" "}
                  will be saved as a credit balance for this customer and can be
                  used to settle future invoices.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

    </div>
  );
}
