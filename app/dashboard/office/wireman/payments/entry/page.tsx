"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Check,
  ChevronsUpDown,
  Loader2,
  AlertCircle,
  ReceiptText,
  BanknoteIcon,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getUserBusinessContext } from "@/app/middleware/businessAuth";
import { BUSINESS_IDS } from "@/app/config/business-constants";
import { invalidatePaymentCaches } from "@/hooks/useCachedFetch";

// ─── Local Helpers ────────────────────────────────────────────────────────────

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("en-LK", {
    style: "currency",
    currency: "LKR",
    minimumFractionDigits: 2,
  }).format(amount);
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface Customer {
  id: string;
  name: string;
}

interface Bank {
  id: string;
  bank_code: string;
  bank_name: string;
}

interface CompanyAccount {
  id: string;
  account_name: string;
  account_type: string; // "Cash on Hand" | "Savings" | "Current"
  account_number?: string | null;
}

interface PendingInvoice {
  id: string;         // order/invoice row id
  invoiceNo: string;
  date: string;
  totalAmount: number;
  paidAmount: number;
  balance: number;
  customerName: string;
}

interface InvoiceSettlement {
  invoiceId: string;
  selected: boolean;
  settleAmount: number;
}

type PaymentMethod = "cash" | "bank" | "cheque";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function StepBadge({ step, label }: { step: number; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-red-600 text-white text-xs font-bold flex-shrink-0">
        {step}
      </div>
      <span className="text-sm font-medium text-muted-foreground">{label}</span>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function WiremanPaymentEntryPage() {
  const [businessId, setBusinessId] = useState<string | null>(null);

  // Master data
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [companyAccounts, setCompanyAccounts] = useState<CompanyAccount[]>([]);
  const [pendingInvoices, setPendingInvoices] = useState<PendingInvoice[]>([]);

  // Loading / submitting
  const [loadingCustomers, setLoadingCustomers] = useState(true);
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
  const [branchCode, setBranchCode] = useState("");
  const [selectedAccountId, setSelectedAccountId] = useState("");

  // Invoice settlement map
  const [settlements, setSettlements] = useState<
    Record<string, InvoiceSettlement>
  >({});

  // ── Init business context ──────────────────────────────────────────────────

  useEffect(() => {
    const user = getUserBusinessContext();
    // Office users have their businessId set; admins do not —
    // fall back to this portal's fixed business ID so the page loads for both.
    setBusinessId(BUSINESS_IDS.WIREMAN_AGENCY);
  }, []);

  // ── Data fetching ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (!businessId) return;

    const fetchData = async () => {
      try {
        // Fetch invoices to build unique customer list (filter unpaid)
        const invRes = await fetch(`/api/invoices?businessId=${businessId}`);
        if (invRes.ok) {
          const invData = await invRes.json();
          const unpaid = invData.filter(
            (inv: any) => inv.status !== "Paid" && (inv.dueAmount ?? 0) > 0
          );
          const seen = new Set<string>();
          const unique: Customer[] = [];
          for (const inv of unpaid) {
            if (!seen.has(inv.customerId)) {
              seen.add(inv.customerId);
              unique.push({ id: inv.customerId, name: inv.customerName || "Unknown" });
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

      try {
        const banksRes = await fetch("/api/finance/bank-codes");
        if (banksRes.ok) {
          const banksData = await banksRes.json();
          setBanks(banksData ?? []);
        }
      } catch {
        toast.error("Failed to load banks");
      } finally {
        setLoadingBanks(false);
      }

      try {
        const accRes = await fetch(
          `/api/finance/accounts?businessId=${businessId}`
        );
        if (accRes.ok) {
          const accData = await accRes.json();
          setCompanyAccounts(
            (accData ?? []).filter((a: any) => a.is_active !== false)
          );
        }
      } catch {
        toast.error("Failed to load accounts");
      } finally {
        setLoadingAccounts(false);
      }
    };

    fetchData();
  }, [businessId]);

  // Filter accounts by payment method
  const availableAccounts = companyAccounts.filter((acc) => {
    const t = (acc.account_type || "").toLowerCase();
    if (paymentMethod === "cash")
      return t === "cash" || t === "cash on hand" || t === "wallet";
    if (paymentMethod === "bank")
      return t === "bank" || t === "savings" || t === "current";
    return false;
  });

  // Fetch pending invoices for selected customer
  const fetchPendingInvoices = useCallback(
    async (customerId: string) => {
      if (!customerId || !businessId) return;
      setLoadingInvoices(true);
      setPendingInvoices([]);
      setSettlements({});
      try {
        const res = await fetch(`/api/invoices?businessId=${businessId}`);
        if (res.ok) {
          const data = await res.json();
          const filtered: PendingInvoice[] = data
            .filter(
              (inv: any) =>
                inv.customerId === customerId &&
                inv.status !== "Paid" &&
                (inv.dueAmount ?? 0) > 0
            )
            .map((inv: any) => ({
              id: inv.orderId || inv.id,
              invoiceNo: inv.invoiceNo,
              date: inv.date || (inv.createdAt
                ? inv.createdAt.split("T")[0]
                : new Date().toISOString().split("T")[0]),
              totalAmount: inv.totalAmount ?? 0,
              paidAmount: inv.paidAmount ?? 0,
              balance: inv.dueAmount ?? 0,
              customerName: inv.customerName ?? "",
            }));
          setPendingInvoices(filtered);
          const map: Record<string, InvoiceSettlement> = {};
          filtered.forEach((inv) => {
            map[inv.id] = {
              invoiceId: inv.id,
              selected: false,
              settleAmount: 0,
            };
          });
          setSettlements(map);
        }
      } catch {
        toast.error("Failed to load pending invoices");
      } finally {
        setLoadingInvoices(false);
      }
    },
    [businessId]
  );

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

  // ── Computed ───────────────────────────────────────────────────────────────

  const totalAllocated = Object.values(settlements)
    .filter((s) => s.selected)
    .reduce((sum, s) => sum + (s.settleAmount || 0), 0);

  const remaining = totalAmount - totalAllocated;

  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId);
  const selectedBank = banks.find((b) => b.id === selectedBankId);

  // ── Invoice selection ──────────────────────────────────────────────────────

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

  // ── Reset ──────────────────────────────────────────────────────────────────

  const resetForm = () => {
    setSelectedCustomerId("");
    setPaymentMethod("cash");
    setPaymentDate(new Date().toISOString().split("T")[0]);
    setTotalAmount(0); setNotes(""); setChequeNumber(""); setChequeDate(""); setSelectedBankId(""); setBranchCode(""); setSelectedAccountId("");
    setPendingInvoices([]);
    setSettlements({});
  };

  // ── Validation ─────────────────────────────────────────────────────────────

  const validate = (): boolean => {
    if (!selectedCustomerId) {
      toast.error("Please select a customer");
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

  // ── Submission ─────────────────────────────────────────────────────────────

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
          amount: s.settleAmount,
          date: paymentDate,
          method: paymentMethod,
          notes: notes || null,
          // Cash / Bank: pass the selected account
          depositAccountId:
            paymentMethod !== "cheque" ? selectedAccountId : null,
          // Cheque fields
          chequeNo: paymentMethod === "cheque" ? chequeNumber : null,
          chequeDate: paymentMethod === "cheque" ? chequeDate : null,
          bankId: paymentMethod === "cheque" ? selectedBankId : null,
          branchCode: paymentMethod === "cheque" ? branchCode : null,
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
          const err = await res.json();
          console.error("Payment error:", err);
          failCount++;
        }
      }

      if (successCount > 0) {
        toast.success(
          `${successCount} invoice${successCount > 1 ? "s" : ""} settled successfully!`
        );
        resetForm();
        invalidatePaymentCaches();
        // Re-fetch customer list to reflect updated data
        if (businessId) {
          const invRes = await fetch(`/api/invoices?businessId=${businessId}`);
          if (invRes.ok) {
            const invData = await invRes.json();
            const unpaid = invData.filter(
              (inv: any) => inv.status !== "Paid" && (inv.dueAmount ?? 0) > 0
            );
            const seen = new Set<string>();
            const unique: Customer[] = [];
            for (const inv of unpaid) {
              if (!seen.has(inv.customerId)) {
                seen.add(inv.customerId);
                unique.push({ id: inv.customerId, name: inv.customerName || "Unknown" });
              }
            }
            unique.sort((a, b) => a.name.localeCompare(b.name));
            setCustomers(unique);
          }
        }
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

  // ─────────────────────────────────────────────────────────────────────────
  //  Render
  // ─────────────────────────────────────────────────────────────────────────

  const methodLabel: Record<PaymentMethod, string> = {
    cash: "Cash",
    bank: "Bank Transfer",
    cheque: "Cheque",
  };

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100">
          <Zap className="h-5 w-5 text-red-600" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-red-900">
            Payment Entry
          </h1>
          <p className="text-muted-foreground text-sm">
            Record a customer payment and settle pending invoices
          </p>
        </div>
      </div>

      {/* ── SECTION 1: Payment Details ─────────────────────────────────── */}
      <Card className="border-red-100">
        <CardHeader className="pb-3">
          <StepBadge step={1} label="Payment Details" />
          <CardDescription>
            Select customer, payment method, and enter payment information
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">

            {/* Customer */}
            <div className="space-y-2 sm:col-span-2 lg:col-span-1">
              <Label>Customer *</Label>
              <Popover open={customerOpen} onOpenChange={setCustomerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={customerOpen}
                    className="w-full justify-between font-normal"
                    disabled={loadingCustomers || !businessId}
                  >
                    {loadingCustomers || !businessId ? (
                      <span className="flex items-center gap-2 text-muted-foreground">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Loading…
                      </span>
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
                      <CommandEmpty>No customers with pending invoices found.</CommandEmpty>
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
                            <span className="font-medium">{c.name}</span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
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
                <div className="space-y-2">
                  <Label>Branch Code</Label>
                  <Input placeholder="e.g. 056" value={branchCode} onChange={(e) => setBranchCode(e.target.value)} />
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
      <Card className="border-red-100">
        <CardHeader className="pb-3">
          <StepBadge step={2} label="Pending Invoices" />
          <CardDescription>
            {selectedCustomerId
              ? "Select invoices to settle with this payment"
              : "Select a customer above to load their pending invoices"}
          </CardDescription>
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
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">Paid</TableHead>
                      <TableHead className="text-right">Balance</TableHead>
                      <TableHead className="text-right w-40">
                        Settle Amount
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingInvoices.map((inv) => {
                      const s = settlements[inv.id];
                      const isSelected = s?.selected ?? false;
                      return (
                        <TableRow
                          key={inv.id}
                          className={cn(isSelected && "bg-red-50")}
                        >
                          <TableCell>
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => toggleInvoice(inv.id, inv)}
                              className="data-[state=checked]:bg-red-600 data-[state=checked]:border-red-600"
                            />
                          </TableCell>
                          <TableCell className="font-medium font-mono text-sm">
                            {inv.invoiceNo}
                          </TableCell>
                          <TableCell>
                            {new Date(inv.date).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(inv.totalAmount)}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {formatCurrency(inv.paidAmount)}
                          </TableCell>
                          <TableCell className="text-right font-semibold text-orange-600">
                            {formatCurrency(inv.balance)}
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
                  return (
                    <div
                      key={inv.id}
                      className={cn(
                        "border rounded-lg p-4 space-y-3 transition-colors",
                        isSelected
                          ? "border-red-400 bg-red-50"
                          : "bg-card"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleInvoice(inv.id, inv)}
                            className="data-[state=checked]:bg-red-600 data-[state=checked]:border-red-600"
                          />
                          <div>
                            <p className="font-semibold font-mono text-sm">
                              {inv.invoiceNo}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(inv.date).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <span className="font-bold text-orange-600 text-sm">
                          {formatCurrency(inv.balance)}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-1 text-xs border-t pt-2">
                        <span className="text-muted-foreground">Total:</span>
                        <span className="text-right">
                          {formatCurrency(inv.totalAmount)}
                        </span>
                        <span className="text-muted-foreground">Paid:</span>
                        <span className="text-right">
                          {formatCurrency(inv.paidAmount)}
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

      {/* ── SECTION 3: Summary & Submit ─────────────────────────────────── */}
      {selectedCustomerId && totalAmount > 0 && (
        <Card
          className={cn(
            "border-2",
            remaining < 0
              ? "border-destructive/50 bg-destructive/5"
              : remaining === 0
              ? "border-green-500/50 bg-green-50/50 dark:bg-green-950/20"
              : "border-red-200"
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
                  <p className="text-xl font-bold text-red-600">
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
                  className="flex-1 sm:flex-none gap-2 bg-red-600 hover:bg-red-700"
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
              <div className="mt-3 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 px-4 py-2.5">
                <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  <span className="font-semibold">
                    {formatCurrency(remaining)}
                  </span>{" "}
                  will not be applied. Adjust the settle amounts or select more
                  invoices.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
