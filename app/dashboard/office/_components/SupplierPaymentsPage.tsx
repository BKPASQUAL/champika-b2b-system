"use client";

import React, { useState, useMemo } from "react";
import { useCachedFetch } from "@/hooks/useCachedFetch";
import { useRouter } from "next/navigation";
import {
  DollarSign, Clock, Search, AlertCircle, CreditCard, Banknote,
  Building2, FileText, Printer, CheckSquare, CheckCircle2,
} from "lucide-react";
import WriteChequeDialog from "@/components/write-cheque-dialog";
import WriteMultiChequeDialog from "@/components/write-multi-cheque-dialog";
import BulkPaymentDialog from "@/components/bulk-payment-dialog";
import ReprintChequeDialog, { type ReprintChequeData } from "@/components/reprint-cheque-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { getUserBusinessContext } from "@/app/middleware/businessAuth";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface CompanyAccount {
  id: string;
  account_name: string;
  account_type: string;
  current_balance: number;
}

interface UnpaidPurchase {
  id: string;
  purchaseId: string;
  purchaseDate: string;
  arrivalDate: string | null;
  totalAmount: number;
  paidAmount: number;
  paymentStatus: string;
  supplierId: string;
  supplierName: string;
}

interface SupplierPayment {
  id: string;
  payment_date: string;
  amount: number;
  payment_method: string;
  cheque_number: string | null;
  cheque_date: string | null;
  cheque_status: string | null;
  notes: string | null;
  company_account_id: string;
  company_accounts: { id: string; account_name: string } | null;
  purchases: {
    id: string;
    purchase_id: string;
    suppliers: { name: string } | null;
  } | null;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("en-LK", { style: "currency", currency: "LKR", minimumFractionDigits: 2 }).format(amount);

const METHOD_BADGE: Record<string, { label: string; className: string; icon: React.ReactNode }> = {
  cash:          { label: "Cash",          className: "bg-green-50 text-green-700 border-green-200",  icon: <Banknote className="w-3 h-3" /> },
  bank_transfer: { label: "Bank Transfer", className: "bg-blue-50 text-blue-700 border-blue-200",    icon: <Building2 className="w-3 h-3" /> },
  cheque:        { label: "Cheque",        className: "bg-amber-50 text-amber-700 border-amber-200", icon: <FileText className="w-3 h-3" /> },
};

const CHEQUE_STATUS_BADGE: Record<string, string> = {
  pending:  "bg-yellow-50 text-yellow-700 border-yellow-200",
  passed:   "bg-green-50 text-green-700 border-green-200",
  returned: "bg-red-50 text-red-700 border-red-200",
};

type ChequeDateMode = "60" | "75" | "manual";

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

function formatDisplayDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-LK", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

// ─── Props ─────────────────────────────────────────────────────────────────────

export interface SupplierPaymentsPageProps {
  defaultBusinessId: string;
  routePrefix: string;   // e.g. "/dashboard/office/distribution"
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function SupplierPaymentsPage({ defaultBusinessId, routePrefix }: SupplierPaymentsPageProps) {
  const router = useRouter();
  const [currentBusinessId] = useState<string>(() => {
    const user = getUserBusinessContext();
    return user?.businessId ?? defaultBusinessId;
  });

  const [isSubmitting,         setIsSubmitting]         = useState(false);
  const [searchTerm,           setSearchTerm]           = useState("");
  const [chequeDateMode,       setChequeDateMode]       = useState<ChequeDateMode>("60");

  const [isPaymentDialogOpen,     setIsPaymentDialogOpen]     = useState(false);
  const [isActionDialogOpen,      setIsActionDialogOpen]      = useState(false);
  const [isChequeDialogOpen,      setIsChequeDialogOpen]      = useState(false);
  const [isMultiChequeDialogOpen, setIsMultiChequeDialogOpen] = useState(false);
  const [isBulkPayDialogOpen,     setIsBulkPayDialogOpen]     = useState(false);
  const [isReprintDialogOpen,     setIsReprintDialogOpen]     = useState(false);
  const [reprintData,    setReprintData]    = useState<ReprintChequeData | null>(null);
  const [selectedPurchase,  setSelectedPurchase]  = useState<UnpaidPurchase | null>(null);
  const [selectedPayments,  setSelectedPayments]  = useState<SupplierPayment[]>([]);
  const [actionType,        setActionType]        = useState<"passed" | "returned" | null>(null);

  // Selection for unpaid bills tab (for multi-cheque / bulk pay)
  const [selectedBillIds, setSelectedBillIds] = useState<Set<string>>(new Set());

  // Selection for pending cheques tab (for bulk pass / return)
  const [selectedChequeGroupIds, setSelectedChequeGroupIds] = useState<Set<string>>(new Set());

  const [paymentForm, setPaymentForm] = useState({
    amount: "",
    payment_date: new Date().toISOString().split("T")[0],
    company_account_id: "",
    payment_method: "cash",
    cheque_number: "",
    cheque_date: "",
    notes: "",
  });

  const { data: allPurchasesRaw = [], loading: l1, refetch: refetchPurchases } =
    useCachedFetch<any[]>(`/api/purchases?businessId=${currentBusinessId}`, []);

  const { data: paymentHistory = [], loading: l2, refetch: refetchPayments } =
    useCachedFetch<SupplierPayment[]>(`/api/suppliers/payments?businessId=${currentBusinessId}`, []);

  const { data: companyAccounts = [], loading: l3, refetch: refetchAccounts } =
    useCachedFetch<CompanyAccount[]>(`/api/finance/accounts?businessId=${currentBusinessId}`, []);

  const loading = l1 || l2 || l3;

  const unpaidPurchases = useMemo(
    () => allPurchasesRaw.filter((p: any) => p.paymentStatus !== "Paid"),
    [allPurchasesRaw],
  );

  const fetchData = () => { refetchPurchases(); refetchPayments(); refetchAccounts(); };

  // ─── Unpaid bill selection helpers ───────────────────────────────────────────

  const toggleBillSelect = (id: string) =>
    setSelectedBillIds((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const toggleBillSelectAll = (purchases: UnpaidPurchase[]) =>
    setSelectedBillIds((prev) =>
      prev.size === purchases.length ? new Set() : new Set(purchases.map((p) => p.id)),
    );

  // ─── Payment dialog ───────────────────────────────────────────────────────────

  const openPaymentDialog = (purchase: UnpaidPurchase) => {
    setSelectedPurchase(purchase);
    const balanceDue = purchase.totalAmount - purchase.paidAmount;
    setChequeDateMode("60");
    const baseDate = purchase.arrivalDate || purchase.purchaseDate;
    setPaymentForm({
      amount: balanceDue.toString(),
      payment_date: new Date().toISOString().split("T")[0],
      company_account_id: "",
      payment_method: "cash",
      cheque_number: "",
      cheque_date: addDays(baseDate, 60),
      notes: `Payment for ${purchase.purchaseId}`,
    });
    setIsPaymentDialogOpen(true);
  };

  const handleChequeDateMode = (mode: ChequeDateMode) => {
    setChequeDateMode(mode);
    if (mode !== "manual" && selectedPurchase) {
      const baseDate = selectedPurchase.arrivalDate || selectedPurchase.purchaseDate;
      setPaymentForm((f) => ({ ...f, cheque_date: addDays(baseDate, parseInt(mode)) }));
    }
  };

  // ─── Cheque action dialog ─────────────────────────────────────────────────────

  const openActionDialog = (payments: SupplierPayment[], action: "passed" | "returned") => {
    setSelectedPayments(payments);
    setActionType(action);
    setIsActionDialogOpen(true);
  };

  const handlePaymentSubmit = async () => {
    if (!selectedPurchase || !paymentForm.company_account_id) return;
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/suppliers/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          purchaseId: selectedPurchase.id,
          supplierId: selectedPurchase.supplierId,
          accountId: paymentForm.company_account_id,
          amount: parseFloat(paymentForm.amount),
          date: paymentForm.payment_date,
          method: paymentForm.payment_method,
          chequeNumber: paymentForm.cheque_number,
          chequeDate: paymentForm.cheque_date,
          notes: paymentForm.notes,
          businessId: currentBusinessId,
        }),
      });
      if (!res.ok) throw new Error("Payment failed");
      toast.success("Payment recorded!");
      setIsPaymentDialogOpen(false);
      fetchData();
    } catch {
      toast.error("Error recording payment");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChequeAction = async () => {
    if (!selectedPayments.length || !actionType) return;
    setIsSubmitting(true);
    try {
      const results = await Promise.all(
        selectedPayments.map((p) =>
          fetch("/api/suppliers/payments", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ paymentId: p.id, action: actionType }),
          }),
        ),
      );
      if (results.some((r) => !r.ok)) throw new Error("Some actions failed");
      toast.success(`Cheque(s) ${actionType} successfully!`);
      setIsActionDialogOpen(false);
      setSelectedChequeGroupIds(new Set());
      fetchData();
    } catch {
      toast.error("Error updating cheque(s)");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── Derived data ─────────────────────────────────────────────────────────────

  const filteredPurchases = unpaidPurchases.filter(
    (p) =>
      p.purchaseId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.supplierName.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const selectedPurchases   = filteredPurchases.filter((p) => selectedBillIds.has(p.id));
  const multiSupplierIds    = [...new Set(selectedPurchases.map((p) => p.supplierId))];
  const canWriteMultiCheque = selectedBillIds.size >= 2 && multiSupplierIds.length === 1;

  const pendingCheques = paymentHistory.filter((p) => p.cheque_status === "pending");

  const groupedPendingCheques = useMemo(() => {
    const groups: Record<string, SupplierPayment[]> = {};
    const noChequeNumber: SupplierPayment[] = [];
    pendingCheques.forEach((p) => {
      if (p.cheque_number) {
        if (!groups[p.cheque_number]) groups[p.cheque_number] = [];
        groups[p.cheque_number].push(p);
      } else {
        noChequeNumber.push(p);
      }
    });
    const groupedList = Object.entries(groups).map(([cheque_number, payments]) => {
      const first = payments[0];
      return {
        id: first.id,
        payment_date: first.payment_date,
        cheque_number,
        cheque_date: first.cheque_date,
        amount: payments.reduce((s, p) => s + p.amount, 0),
        supplier_name: first.purchases?.suppliers?.name,
        company_account_name: first.company_accounts?.account_name,
        isMultiple: payments.length > 1,
        purchaseIds: payments.map((p) => p.purchases?.purchase_id).filter(Boolean),
        payments,
      };
    });
    return [
      ...groupedList,
      ...noChequeNumber.map((p) => ({
        id: p.id,
        payment_date: p.payment_date,
        cheque_number: p.cheque_number,
        cheque_date: p.cheque_date,
        amount: p.amount,
        supplier_name: p.purchases?.suppliers?.name,
        company_account_name: p.company_accounts?.account_name,
        isMultiple: false,
        purchaseIds: [p.purchases?.purchase_id].filter(Boolean),
        payments: [p],
      })),
    ];
  }, [pendingCheques]);

  const filteredHistory = paymentHistory.filter((p) => p.cheque_status !== "pending");

  const groupedHistory = useMemo(() => {
    const groups: Record<string, SupplierPayment[]> = {};
    const ungrouped: SupplierPayment[] = [];
    filteredHistory.forEach((p) => {
      let key: string | null = null;
      if (p.payment_method === "cheque" && p.cheque_number) {
        key = `cheque_${p.cheque_number}`;
      } else if (p.payment_method !== "cheque") {
        const sn = p.purchases?.suppliers?.name ?? "unknown";
        key = `${p.payment_date}_${p.payment_method}_${sn}_${p.company_account_id}`;
      }
      if (key) {
        if (!groups[key]) groups[key] = [];
        groups[key].push(p);
      } else {
        ungrouped.push(p);
      }
    });
    const groupedList = Object.entries(groups).map(([, payments]) => {
      const first = payments[0];
      return {
        ...first,
        amount: payments.reduce((s, p) => s + p.amount, 0),
        isMultiple: payments.length > 1,
        purchaseIds: payments.map((p) => p.purchases?.purchase_id).filter(Boolean),
        payments,
      };
    });
    return [
      ...groupedList,
      ...ungrouped.map((p) => ({
        ...p,
        isMultiple: false,
        purchaseIds: [p.purchases?.purchase_id].filter(Boolean),
        payments: [p],
      })),
    ].sort((a, b) => new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime());
  }, [filteredHistory]);

  const totalBalanceDue         = unpaidPurchases.reduce((s, p) => s + (p.totalAmount - p.paidAmount), 0);
  const totalPendingChequeAmount = pendingCheques.reduce((s, p) => s + p.amount, 0);

  const selectedAccount = companyAccounts.find((a) => a.id === paymentForm.company_account_id);
  const isOverdraft =
    selectedAccount &&
    paymentForm.payment_method !== "cheque" &&
    selectedAccount.current_balance < parseFloat(paymentForm.amount || "0");

  // ─── Pending cheque selection helpers ────────────────────────────────────────

  const toggleChequeGroup = (id: string) =>
    setSelectedChequeGroupIds((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const toggleAllChequeGroups = () =>
    setSelectedChequeGroupIds((prev) =>
      prev.size === groupedPendingCheques.length
        ? new Set()
        : new Set(groupedPendingCheques.map((g) => g.id)),
    );

  const bulkChequePayments = groupedPendingCheques
    .filter((g) => selectedChequeGroupIds.has(g.id))
    .flatMap((g) => g.payments);

  const bulkChequeTotal = groupedPendingCheques
    .filter((g) => selectedChequeGroupIds.has(g.id))
    .reduce((s, g) => s + g.amount, 0);

  const openBulkChequeAction = (action: "passed" | "returned") => {
    openActionDialog(bulkChequePayments, action);
  };

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-blue-900">Supplier Payments</h1>
          <p className="text-muted-foreground">Manage outgoing payments to suppliers</p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Outstanding</CardTitle>
            <DollarSign className="w-4 h-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{formatCurrency(totalBalanceDue)}</div>
            <p className="text-xs text-muted-foreground mt-1">{filteredPurchases.length} unpaid bills</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Pending Cheques</CardTitle>
            <Clock className="w-4 h-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{formatCurrency(totalPendingChequeAmount)}</div>
            <p className="text-xs text-muted-foreground mt-1">{pendingCheques.length} cheques issued</p>
          </CardContent>
        </Card>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by Purchase ID, Supplier..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9 w-full md:w-[400px]"
        />
      </div>

      <Tabs defaultValue="unpaid">
        <TabsList>
          <TabsTrigger value="unpaid">Unpaid Bills ({filteredPurchases.length})</TabsTrigger>
          <TabsTrigger value="pending_cheques">Pending Cheques ({pendingCheques.length})</TabsTrigger>
          <TabsTrigger value="history">Payment History ({filteredHistory.length})</TabsTrigger>
        </TabsList>

        {/* ── Unpaid Bills ─────────────────────────────────────────────────────── */}
        <TabsContent value="unpaid" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Outstanding Supplier Bills</CardTitle>
                {selectedBillIds.size > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {selectedBillIds.size} invoice(s) selected
                    {selectedBillIds.size >= 2 && multiSupplierIds.length > 1 && (
                      <span className="text-destructive ml-1">— must be same supplier for combined cheque</span>
                    )}
                  </p>
                )}
              </div>
              {canWriteMultiCheque && (
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={() => setIsBulkPayDialogOpen(true)}
                    className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Pay Now ({selectedBillIds.size})
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => setIsMultiChequeDialogOpen(true)}
                    className="bg-amber-600 hover:bg-amber-700 text-white gap-1.5"
                  >
                    <CheckSquare className="w-4 h-4" />
                    Write Cheque ({selectedBillIds.size})
                  </Button>
                </div>
              )}
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={selectedBillIds.size === filteredPurchases.length && filteredPurchases.length > 0}
                        onCheckedChange={() => toggleBillSelectAll(filteredPurchases)}
                        aria-label="Select all"
                      />
                    </TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Purchase ID</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Paid</TableHead>
                    <TableHead className="text-right">Due</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPurchases.map((p) => (
                    <TableRow
                      key={p.id}
                      data-state={selectedBillIds.has(p.id) ? "selected" : undefined}
                      className={selectedBillIds.has(p.id) ? "bg-amber-50/60" : undefined}
                    >
                      <TableCell>
                        <Checkbox
                          checked={selectedBillIds.has(p.id)}
                          onCheckedChange={() => toggleBillSelect(p.id)}
                          aria-label={`Select ${p.purchaseId}`}
                        />
                      </TableCell>
                      <TableCell>{new Date(p.purchaseDate).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <button
                          className="font-mono text-xs bg-blue-50 text-blue-700 border border-blue-100 px-2 py-0.5 rounded hover:bg-blue-100 transition-colors"
                          onClick={() => router.push(`${routePrefix}/purchases/${p.id}`)}
                        >
                          {p.purchaseId}
                        </button>
                      </TableCell>
                      <TableCell>{p.supplierName}</TableCell>
                      <TableCell className="text-right">{formatCurrency(p.totalAmount)}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{formatCurrency(p.paidAmount)}</TableCell>
                      <TableCell className="text-right font-bold text-destructive">
                        {formatCurrency(p.totalAmount - p.paidAmount)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-1 justify-end">
                          <Button size="sm" onClick={() => openPaymentDialog(p)} className="bg-blue-600 hover:bg-blue-700">
                            Record Payment
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => { setSelectedPurchase(p); setIsChequeDialogOpen(true); }}
                            className="text-amber-700 border-amber-300 hover:bg-amber-50"
                          >
                            <Printer className="w-3 h-3 mr-1" />
                            Print Cheque
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Pending Cheques ───────────────────────────────────────────────────── */}
        <TabsContent value="pending_cheques" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Pending Cheques (Outbound)</CardTitle>
                {selectedChequeGroupIds.size > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {selectedChequeGroupIds.size} cheque(s) selected · {formatCurrency(bulkChequeTotal)}
                  </p>
                )}
              </div>
              {selectedChequeGroupIds.size > 0 && (
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={() => openBulkChequeAction("passed")}
                    className="bg-green-600 hover:bg-green-700 text-white gap-1.5"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Pass ({selectedChequeGroupIds.size})
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openBulkChequeAction("returned")}
                    className="text-red-600 border-red-200 hover:bg-red-50 gap-1.5"
                  >
                    Return ({selectedChequeGroupIds.size})
                  </Button>
                </div>
              )}
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={
                          selectedChequeGroupIds.size === groupedPendingCheques.length &&
                          groupedPendingCheques.length > 0
                        }
                        onCheckedChange={toggleAllChequeGroups}
                        aria-label="Select all pending cheques"
                      />
                    </TableHead>
                    <TableHead>Payment Date</TableHead>
                    <TableHead>Bill ID</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead>Cheque No</TableHead>
                    <TableHead>Cheque Date</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {groupedPendingCheques.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        No pending cheques.
                      </TableCell>
                    </TableRow>
                  ) : (
                    groupedPendingCheques.map((group) => (
                      <TableRow
                        key={group.id}
                        data-state={selectedChequeGroupIds.has(group.id) ? "selected" : undefined}
                        className={selectedChequeGroupIds.has(group.id) ? "bg-amber-50/60" : undefined}
                      >
                        <TableCell>
                          <Checkbox
                            checked={selectedChequeGroupIds.has(group.id)}
                            onCheckedChange={() => toggleChequeGroup(group.id)}
                            aria-label={`Select cheque ${group.cheque_number}`}
                          />
                        </TableCell>
                        <TableCell className="text-sm">
                          {new Date(group.payment_date).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          {group.isMultiple ? (
                            <div className="flex flex-wrap gap-1 max-w-[200px]">
                              {group.purchaseIds.map((id, idx) => (
                                <span key={idx} className="font-mono text-[10px] bg-blue-50 text-blue-700 border border-blue-100 px-1.5 py-0.5 rounded">
                                  {id}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="font-mono text-xs bg-blue-50 text-blue-700 border border-blue-100 px-2 py-0.5 rounded">
                              {group.purchaseIds[0] ?? "-"}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>{group.supplier_name}</TableCell>
                        <TableCell>
                          <span className="font-mono text-sm font-medium">{group.cheque_number}</span>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {group.cheque_date ? new Date(group.cheque_date).toLocaleDateString() : "-"}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(group.amount)}
                        </TableCell>
                        <TableCell className="text-right space-x-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-amber-700 border-amber-300 hover:bg-amber-50"
                            onClick={() => {
                              setReprintData({
                                payeeName:    group.supplier_name ?? "",
                                amount:       group.amount,
                                chequeDate:   group.cheque_date,
                                chequeNumber: group.cheque_number,
                                accountName:  group.company_account_name ?? "",
                              });
                              setIsReprintDialogOpen(true);
                            }}
                          >
                            <Printer className="w-3 h-3 mr-1" />
                            Print
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-green-600"
                            onClick={() => openActionDialog(group.payments, "passed")}
                          >
                            Pass
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-red-600"
                            onClick={() => openActionDialog(group.payments, "returned")}
                          >
                            Return
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Payment History ───────────────────────────────────────────────────── */}
        <TabsContent value="history" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Payment History</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/50">
                    <TableHead className="pl-4">Date</TableHead>
                    <TableHead>Bill ID</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Cheque No</TableHead>
                    <TableHead>Cheque Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right pr-4">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {groupedHistory.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        No payment history found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    groupedHistory.map((group) => {
                      const methodMeta = METHOD_BADGE[group.payment_method] ?? {
                        label: group.payment_method,
                        className: "bg-slate-50 text-slate-700 border-slate-200",
                        icon: <CreditCard className="w-3 h-3" />,
                      };
                      const isCheque = group.payment_method === "cheque";
                      const statusKey = group.cheque_status?.toLowerCase() ?? "";
                      return (
                        <TableRow key={group.id} className="hover:bg-muted/30">
                          <TableCell className="pl-4 text-sm">
                            {new Date(group.payment_date).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            {group.isMultiple ? (
                              <div className="flex flex-wrap gap-1 max-w-[200px]">
                                {group.purchaseIds.map((id, idx) => (
                                  <span key={idx} className="font-mono text-[10px] bg-blue-50 text-blue-700 border border-blue-100 px-1.5 py-0.5 rounded">
                                    {id}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <button
                                className="font-mono text-xs bg-blue-50 text-blue-700 border border-blue-100 px-2 py-0.5 rounded hover:bg-blue-100 transition-colors"
                                onClick={() => {
                                  const pid = group.payments[0]?.purchases?.id;
                                  if (pid) router.push(`${routePrefix}/purchases/${pid}`);
                                }}
                              >
                                {group.purchaseIds[0] ?? "-"}
                              </button>
                            )}
                          </TableCell>
                          <TableCell className="text-sm">{group.purchases?.suppliers?.name ?? "-"}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={`gap-1 text-xs ${methodMeta.className}`}>
                              {methodMeta.icon}
                              {methodMeta.label}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {isCheque && group.cheque_number ? (
                              <span className="font-mono text-sm font-medium text-amber-800">{group.cheque_number}</span>
                            ) : (
                              <span className="text-muted-foreground text-sm">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {isCheque && group.cheque_date ? new Date(group.cheque_date).toLocaleDateString() : "-"}
                          </TableCell>
                          <TableCell>
                            {isCheque && statusKey ? (
                              <Badge variant="outline" className={`text-xs capitalize ${CHEQUE_STATUS_BADGE[statusKey] ?? "bg-slate-50 text-slate-700 border-slate-200"}`}>
                                {group.cheque_status}
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                                Completed
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right pr-4 font-mono font-medium">
                            {formatCurrency(group.amount)}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ── Payment Dialog ────────────────────────────────────────────────────── */}
      <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Make Payment</DialogTitle>
            <DialogDescription>
              To {selectedPurchase?.supplierName} for {selectedPurchase?.purchaseId}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Amount</Label>
                <Input
                  type="number"
                  value={paymentForm.amount}
                  onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Date</Label>
                <Input
                  type="date"
                  value={paymentForm.payment_date}
                  onChange={(e) => setPaymentForm({ ...paymentForm, payment_date: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Method</Label>
              <Select
                value={paymentForm.payment_method}
                onValueChange={(v) => setPaymentForm({ ...paymentForm, payment_method: v })}
              >
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  <SelectItem value="cheque">Cheque</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>From Account</Label>
              <Select
                value={paymentForm.company_account_id}
                onValueChange={(v) => setPaymentForm({ ...paymentForm, company_account_id: v })}
              >
                <SelectTrigger className="w-full"><SelectValue placeholder="Select account" /></SelectTrigger>
                <SelectContent>
                  {companyAccounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.account_name} ({formatCurrency(a.current_balance)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {isOverdraft && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Insufficient Funds</AlertTitle>
                <AlertDescription>This payment exceeds the account balance.</AlertDescription>
              </Alert>
            )}
            {paymentForm.payment_method === "cheque" && (
              <div className="space-y-3">
                <Input
                  placeholder="Cheque No"
                  value={paymentForm.cheque_number}
                  onChange={(e) => setPaymentForm({ ...paymentForm, cheque_number: e.target.value })}
                  className="font-mono"
                />
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Cheque Date</Label>
                  <Select value={chequeDateMode} onValueChange={(v) => handleChequeDateMode(v as ChequeDateMode)}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="60">60 days from invoice date</SelectItem>
                      <SelectItem value="75">75 days from invoice date</SelectItem>
                      <SelectItem value="manual">Manual entry</SelectItem>
                    </SelectContent>
                  </Select>
                  {selectedPurchase && (
                    <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Invoice Date</span>
                        <span className="font-medium">{formatDisplayDate(selectedPurchase.purchaseDate)}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Arrival Date</span>
                        <span className="font-medium">
                          {selectedPurchase.arrivalDate
                            ? formatDisplayDate(selectedPurchase.arrivalDate)
                            : <span className="text-slate-400">Not set</span>}
                        </span>
                      </div>
                    </div>
                  )}
                  {chequeDateMode === "manual" ? (
                    <Input
                      type="date"
                      value={paymentForm.cheque_date}
                      onChange={(e) => setPaymentForm({ ...paymentForm, cheque_date: e.target.value })}
                    />
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Arrival date + {chequeDateMode} days
                      <span className="mx-1">→</span>
                      <span className="font-medium text-foreground">
                        {paymentForm.cheque_date ? formatDisplayDate(paymentForm.cheque_date) : "—"}
                      </span>
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPaymentDialogOpen(false)}>Cancel</Button>
            <Button onClick={handlePaymentSubmit} disabled={isSubmitting} className="bg-blue-600 hover:bg-blue-700">
              Confirm Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Reprint / Write Cheque Dialogs ────────────────────────────────────── */}
      <ReprintChequeDialog
        open={isReprintDialogOpen}
        onClose={() => setIsReprintDialogOpen(false)}
        cheque={reprintData}
      />

      <WriteChequeDialog
        open={isChequeDialogOpen}
        onClose={() => setIsChequeDialogOpen(false)}
        purchase={selectedPurchase}
        companyAccounts={companyAccounts}
        businessId={currentBusinessId}
        onSuccess={fetchData}
      />

      <WriteMultiChequeDialog
        open={isMultiChequeDialogOpen}
        onClose={() => { setIsMultiChequeDialogOpen(false); setSelectedBillIds(new Set()); }}
        purchases={selectedPurchases}
        companyAccounts={companyAccounts}
        businessId={currentBusinessId}
        onSuccess={() => { fetchData(); setSelectedBillIds(new Set()); }}
      />

      <BulkPaymentDialog
        open={isBulkPayDialogOpen}
        onClose={() => { setIsBulkPayDialogOpen(false); setSelectedBillIds(new Set()); }}
        purchases={selectedPurchases}
        companyAccounts={companyAccounts}
        businessId={currentBusinessId}
        onSuccess={() => { fetchData(); setSelectedBillIds(new Set()); }}
      />

      {/* ── Pass / Return Confirmation Dialog ────────────────────────────────── */}
      <AlertDialog open={isActionDialogOpen} onOpenChange={setIsActionDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {actionType === "passed" ? "Pass Cheque(s)" : "Return Cheque(s)"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {selectedPayments.length === 1 ? (
                <>Mark cheque <strong>{selectedPayments[0]?.cheque_number}</strong> as <strong>{actionType}</strong>?</>
              ) : (
                <>Mark <strong>{selectedPayments.length} cheques</strong> as <strong>{actionType}</strong>? Total: {formatCurrency(selectedPayments.reduce((s, p) => s + p.amount, 0))}</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleChequeAction}
              className={actionType === "passed" ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"}
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
