"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Check,
  ChevronsUpDown,
  Loader2,
  AlertCircle,
  ReceiptText,
  BanknoteIcon,
  Store,
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

// ─── Helpers ──────────────────────────────────────────────────────────────────
const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("en-LK", { style: "currency", currency: "LKR", minimumFractionDigits: 2 }).format(amount);

interface Customer { id: string; name: string; }
interface Bank { id: string; bank_code: string; bank_name: string; }
interface CompanyAccount { id: string; account_name: string; account_type: string; account_number?: string | null; }
interface PendingInvoice { id: string; invoiceNo: string; date: string; totalAmount: number; paidAmount: number; balance: number; }
interface InvoiceSettlement { invoiceId: string; selected: boolean; settleAmount: number; }
type PaymentMethod = "cash" | "bank" | "cheque";

function StepBadge({ step, label }: { step: number; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600 text-white text-xs font-bold flex-shrink-0">{step}</div>
      <span className="text-sm font-medium text-muted-foreground">{label}</span>
    </div>
  );
}

export default function RetailPaymentEntryPage() {
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
  const [settlements, setSettlements] = useState<Record<string, InvoiceSettlement>>({});

  useEffect(() => {
    const user = getUserBusinessContext();
    setBusinessId(user?.businessId ?? BUSINESS_IDS.CHAMPIKA_RETAIL);
  }, []);

  useEffect(() => {
    if (!businessId) return;
    const run = async () => {
      try {
        const res = await fetch(`/api/invoices?businessId=${businessId}`);
        if (res.ok) {
          const data = await res.json();
          const unpaid = data.filter((inv: any) => inv.status !== "Paid" && (inv.dueAmount ?? 0) > 0);
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
      const res = await fetch(`/api/invoices?businessId=${businessId}`);
      if (res.ok) {
        const data = await res.json();
        const filtered: PendingInvoice[] = data
          .filter((inv: any) => inv.customerId === customerId && inv.status !== "Paid" && (inv.dueAmount ?? 0) > 0)
          .map((inv: any) => ({ id: inv.orderId || inv.id, invoiceNo: inv.invoiceNo, date: inv.date || (inv.createdAt?.split("T")[0] ?? ""), totalAmount: inv.totalAmount ?? 0, paidAmount: inv.paidAmount ?? 0, balance: inv.dueAmount ?? 0 }));
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
    setPendingInvoices([]); setSettlements({});
  };

  const validate = () => {
    if (!selectedCustomerId) { toast.error("Please select a customer"); return false; }
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
    try {
      for (const s of Object.values(settlements).filter((s) => s.selected && s.settleAmount > 0)) {
        const res = await fetch("/api/payments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId: s.invoiceId, amount: s.settleAmount, date: paymentDate, method: paymentMethod, notes: notes || undefined, depositAccountId: paymentMethod !== "cheque" ? selectedAccountId : null, chequeNo: paymentMethod === "cheque" ? chequeNumber : null, chequeDate: paymentMethod === "cheque" ? chequeDate : null, bankId: paymentMethod === "cheque" ? selectedBankId : null, branchCode: paymentMethod === "cheque" ? branchCode : null, performedByName: getUserBusinessContext()?.name ?? null, performedByEmail: getUserBusinessContext()?.email ?? null }),
        });
        if (res.ok) successCount++; else { console.error(await res.json()); failCount++; }
      }
      if (successCount > 0) { toast.success(`${successCount} invoice${successCount > 1 ? "s" : ""} settled!`); resetForm(); }
      if (failCount > 0) toast.error(`${failCount} payment(s) failed.`);
    } catch { toast.error("An unexpected error occurred"); } finally { setIsSubmitting(false); }
  };

  const methodLabel: Record<PaymentMethod, string> = { cash: "Cash", bank: "Bank Transfer", cheque: "Cheque" };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100">
          <Store className="h-5 w-5 text-emerald-600" />
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
              <Label>Payment Method *</Label>
              <Select value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as PaymentMethod)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="bank">Bank Transfer</SelectItem>
                  <SelectItem value="cheque">Cheque</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Payment Date *</Label>
              <Input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label>{methodLabel[paymentMethod]} Amount *</Label>
              <Input type="number" min="0" step="0.01" placeholder="0.00" value={totalAmount || ""} onChange={(e) => setTotalAmount(parseFloat(e.target.value) || 0)} />
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
                  <SelectTrigger>
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
        </CardContent>
      </Card>

      {/* Step 2 */}
      <Card>
        <CardHeader className="pb-3">
          <StepBadge step={2} label="Pending Invoices" />
          <CardDescription>{selectedCustomerId ? "Select invoices to settle with this payment" : "Select a customer above to load their pending invoices"}</CardDescription>
        </CardHeader>
        <CardContent>
          {!selectedCustomerId ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-3"><AlertCircle className="h-8 w-8 opacity-40" /><p className="text-sm">No customer selected</p></div>
          ) : loadingInvoices ? (
            <div className="flex justify-center items-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : pendingInvoices.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-3"><ReceiptText className="h-8 w-8 opacity-40" /><p className="text-sm">No pending invoices for this customer</p></div>
          ) : (
            <>
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader><TableRow><TableHead className="w-10"></TableHead><TableHead>Invoice No</TableHead><TableHead>Date</TableHead><TableHead className="text-right">Total</TableHead><TableHead className="text-right">Paid</TableHead><TableHead className="text-right">Balance</TableHead><TableHead className="text-right w-40">Settle Amount</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {pendingInvoices.map((inv) => {
                      const s = settlements[inv.id]; const isSelected = s?.selected ?? false;
                      return (
                        <TableRow key={inv.id} className={cn(isSelected && "bg-emerald-50")}>
                          <TableCell><Checkbox checked={isSelected} onCheckedChange={() => toggleInvoice(inv.id, inv)} className="data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600" /></TableCell>
                          <TableCell className="font-medium font-mono text-sm">{inv.invoiceNo}</TableCell>
                          <TableCell>{inv.date ? new Date(inv.date).toLocaleDateString() : "—"}</TableCell>
                          <TableCell className="text-right">{formatCurrency(inv.totalAmount)}</TableCell>
                          <TableCell className="text-right text-muted-foreground">{formatCurrency(inv.paidAmount)}</TableCell>
                          <TableCell className="text-right font-semibold text-orange-600">{formatCurrency(inv.balance)}</TableCell>
                          <TableCell className="text-right"><Input type="number" min="0" step="0.01" max={inv.balance} disabled={!isSelected} value={s?.settleAmount || ""} onChange={(e) => updateSettleAmount(inv.id, parseFloat(e.target.value) || 0, inv.balance)} className="w-36 text-right ml-auto" placeholder="0.00" /></TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              <div className="md:hidden space-y-3">
                {pendingInvoices.map((inv) => {
                  const s = settlements[inv.id]; const isSelected = s?.selected ?? false;
                  return (
                    <div key={inv.id} className={cn("border rounded-lg p-4 space-y-3", isSelected ? "border-emerald-400 bg-emerald-50" : "bg-card")}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Checkbox checked={isSelected} onCheckedChange={() => toggleInvoice(inv.id, inv)} className="data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600" />
                          <div><p className="font-semibold font-mono text-sm">{inv.invoiceNo}</p><p className="text-xs text-muted-foreground">{inv.date ? new Date(inv.date).toLocaleDateString() : "—"}</p></div>
                        </div>
                        <span className="font-bold text-orange-600 text-sm">{formatCurrency(inv.balance)}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-1 text-xs border-t pt-2">
                        <span className="text-muted-foreground">Total:</span><span className="text-right">{formatCurrency(inv.totalAmount)}</span>
                        <span className="text-muted-foreground">Paid:</span><span className="text-right">{formatCurrency(inv.paidAmount)}</span>
                      </div>
                      {isSelected && <div className="space-y-1"><Label className="text-xs">Settle Amount</Label><Input type="number" min="0" step="0.01" max={inv.balance} value={s?.settleAmount || ""} onChange={(e) => updateSettleAmount(inv.id, parseFloat(e.target.value) || 0, inv.balance)} placeholder="0.00" className="text-right" /></div>}
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
        <Card className={cn("border-2", remaining < 0 ? "border-destructive/50 bg-destructive/5" : remaining === 0 ? "border-green-500/50 bg-green-50/50" : "border-emerald-200")}>
          <CardHeader className="pb-3"><StepBadge step={3} label="Summary & Submit" /></CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex flex-wrap gap-6">
                <div className="space-y-0.5"><p className="text-xs text-muted-foreground uppercase tracking-wide">{methodLabel[paymentMethod]} Amount</p><p className="text-xl font-bold">{formatCurrency(totalAmount)}</p></div>
                <div className="space-y-0.5"><p className="text-xs text-muted-foreground uppercase tracking-wide">Allocated</p><p className="text-xl font-bold text-emerald-600">{formatCurrency(totalAllocated)}</p></div>
                <div className="space-y-0.5"><p className="text-xs text-muted-foreground uppercase tracking-wide">Remaining</p>
                  <p className={cn("text-xl font-bold", remaining < 0 ? "text-destructive" : remaining === 0 ? "text-green-600" : "text-muted-foreground")}>{formatCurrency(remaining)}</p>
                </div>
              </div>
              <div className="flex gap-2 w-full sm:w-auto">
                <Button variant="outline" onClick={resetForm} disabled={isSubmitting} className="flex-1 sm:flex-none">Clear</Button>
                <Button onClick={handleSubmit} disabled={isSubmitting || remaining < 0 || Object.values(settlements).filter((s) => s.selected && s.settleAmount > 0).length === 0} className="flex-1 sm:flex-none gap-2 bg-emerald-600 hover:bg-emerald-700">
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
    </div>
  );
}
