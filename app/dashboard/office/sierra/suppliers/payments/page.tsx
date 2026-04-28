// app/dashboard/office/sierra/suppliers/payments/page.tsx
"use client";

import React, { useState, useMemo } from "react";
import { useCachedFetch } from "@/hooks/useCachedFetch";
import { useRouter } from "next/navigation";
import { DollarSign, Clock, Search, AlertCircle, CreditCard, Banknote, Building2, FileText, Printer } from "lucide-react";
import WriteChequeDialog from "@/components/write-cheque-dialog";
import ReprintChequeDialog, { type ReprintChequeData } from "@/components/reprint-cheque-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { getUserBusinessContext } from "@/app/middleware/businessAuth";
import { BUSINESS_IDS } from "@/app/config/business-constants";

// --- Types ---
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
  company_accounts: {
    id: string;
    account_name: string;
  } | null;
  purchases: {
    id: string;
    purchase_id: string;
    suppliers: {
      name: string;
    } | null;
  } | null;
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("en-LK", {
    style: "currency",
    currency: "LKR",
    minimumFractionDigits: 2,
  }).format(amount);
};

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

export default function SierraSupplierPaymentsPage() {
  const router = useRouter();
  const [currentBusinessId] = useState<string>(() => {
    const user = getUserBusinessContext();
    return user?.businessId ?? BUSINESS_IDS.SIERRA_AGENCY;
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [isActionDialogOpen, setIsActionDialogOpen] = useState(false);
  const [isChequeDialogOpen, setIsChequeDialogOpen] = useState(false);
  const [isReprintDialogOpen, setIsReprintDialogOpen] = useState(false);
  const [reprintData, setReprintData] = useState<ReprintChequeData | null>(null);
  const [selectedPurchase, setSelectedPurchase] = useState<UnpaidPurchase | null>(null);
  const [selectedPayment, setSelectedPayment] = useState<SupplierPayment | null>(null);
  const [actionType, setActionType] = useState<"passed" | "returned" | null>(null);

  const [paymentForm, setPaymentForm] = useState({
    amount: "",
    payment_date: new Date().toISOString().split("T")[0],
    company_account_id: "",
    payment_method: "cash",
    cheque_number: "",
    cheque_date: "",
    notes: "",
  });

  const {
    data: allPurchasesRaw = [],
    loading: l1,
    refetch: refetchPurchases,
  } = useCachedFetch<any[]>(`/api/purchases?businessId=${currentBusinessId}`, []);

  const {
    data: paymentHistory = [],
    loading: l2,
    refetch: refetchPayments,
  } = useCachedFetch<SupplierPayment[]>(
    `/api/suppliers/payments?businessId=${currentBusinessId}`, []
  );

  const {
    data: companyAccounts = [],
    loading: l3,
    refetch: refetchAccounts,
  } = useCachedFetch<CompanyAccount[]>(
    `/api/finance/accounts?businessId=${currentBusinessId}`, []
  );

  const loading = l1 || l2 || l3;

  const unpaidPurchases = useMemo(
    () => allPurchasesRaw.filter((p: any) => p.paymentStatus !== "Paid"),
    [allPurchasesRaw]
  );

  const fetchData = () => {
    refetchPurchases();
    refetchPayments();
    refetchAccounts();
  };

  const openPaymentDialog = (purchase: UnpaidPurchase) => {
    setSelectedPurchase(purchase);
    const balanceDue = purchase.totalAmount - purchase.paidAmount;

    setPaymentForm({
      amount: balanceDue.toString(),
      payment_date: new Date().toISOString().split("T")[0],
      company_account_id: "",
      payment_method: "cash",
      cheque_number: "",
      cheque_date: "",
      notes: `Payment for ${purchase.purchaseId}`,
    });
    setIsPaymentDialogOpen(true);
  };

  const openActionDialog = (
    payment: SupplierPayment,
    action: "passed" | "returned",
  ) => {
    setSelectedPayment(payment);
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
          businessId: currentBusinessId, // Important: Tie payment to business
        }),
      });

      if (!res.ok) throw new Error("Payment failed");

      toast.success("Payment recorded!");
      setIsPaymentDialogOpen(false);
      fetchData();
    } catch (error) {
      toast.error("Error recording payment");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChequeAction = async () => {
    if (!selectedPayment || !actionType) return;
    setIsSubmitting(true);

    try {
      const res = await fetch("/api/suppliers/payments", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentId: selectedPayment.id,
          action: actionType,
        }),
      });

      if (!res.ok) throw new Error("Action failed");

      toast.success(`Cheque ${actionType} successfully!`);
      setIsActionDialogOpen(false);
      fetchData();
    } catch (error) {
      toast.error("Error updating cheque");
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredPurchases = unpaidPurchases.filter(
    (p) =>
      p.purchaseId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.supplierName.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const pendingCheques = paymentHistory.filter(
    (p) => p.cheque_status === "pending",
  );

  const filteredHistory = paymentHistory.filter(
    (p) => p.cheque_status !== "pending",
  );

  const totalBalanceDue = unpaidPurchases.reduce(
    (sum, p) => sum + (p.totalAmount - p.paidAmount),
    0,
  );
  const totalPendingChequeAmount = pendingCheques.reduce(
    (sum, p) => sum + p.amount,
    0,
  );

  // Overdraft Check
  const selectedAccount = companyAccounts.find(
    (a) => a.id === paymentForm.company_account_id,
  );
  const isOverdraft =
    selectedAccount &&
    paymentForm.payment_method !== "cheque" &&
    selectedAccount.current_balance < parseFloat(paymentForm.amount || "0");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-red-900">
            Supplier Payments
          </h1>
          <p className="text-muted-foreground">
            Manage outgoing payments to suppliers
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Total Outstanding
            </CardTitle>
            <DollarSign className="w-4 h-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              {formatCurrency(totalBalanceDue)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {filteredPurchases.length} unpaid bills
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Pending Cheques
            </CardTitle>
            <Clock className="w-4 h-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {formatCurrency(totalPendingChequeAmount)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {pendingCheques.length} cheques issued
            </p>
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
          <TabsTrigger value="unpaid">
            Unpaid Bills ({filteredPurchases.length})
          </TabsTrigger>
          <TabsTrigger value="pending_cheques">
            Pending Cheques ({pendingCheques.length})
          </TabsTrigger>
          <TabsTrigger value="history">
            Payment History ({filteredHistory.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="unpaid" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Outstanding Supplier Bills</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
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
                    <TableRow key={p.id}>
                      <TableCell>
                        {new Date(p.purchaseDate).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <button
                          className="font-mono text-xs bg-red-50 text-red-700 border border-red-100 px-2 py-0.5 rounded hover:bg-red-100 transition-colors"
                          onClick={() => router.push(`/dashboard/office/sierra/purchases/${p.id}`)}
                        >
                          {p.purchaseId}
                        </button>
                      </TableCell>
                      <TableCell>{p.supplierName}</TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(p.totalAmount)}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {formatCurrency(p.paidAmount)}
                      </TableCell>
                      <TableCell className="text-right font-bold text-destructive">
                        {formatCurrency(p.totalAmount - p.paidAmount)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-1 justify-end">
                          <Button
                            size="sm"
                            onClick={() => openPaymentDialog(p)}
                            className="bg-red-600 hover:bg-red-700"
                          >
                            Pay Now
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => { setSelectedPurchase(p); setIsChequeDialogOpen(true); }}
                            className="text-amber-700 border-amber-300 hover:bg-amber-50"
                          >
                            <Printer className="w-3 h-3 mr-1" />
                            Cheque
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

        <TabsContent value="pending_cheques" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Pending Cheques (Outbound)</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
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
                  {pendingCheques.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="text-sm">
                        {new Date(p.payment_date).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <button
                          className="font-mono text-xs bg-red-50 text-red-700 border border-red-100 px-2 py-0.5 rounded hover:bg-red-100 transition-colors"
                          onClick={() => router.push(`/dashboard/office/sierra/purchases/${p.purchases?.id}`)}
                        >
                          {p.purchases?.purchase_id}
                        </button>
                      </TableCell>
                      <TableCell>{p.purchases?.suppliers?.name}</TableCell>
                      <TableCell>
                        <span className="font-mono text-sm font-medium">{p.cheque_number}</span>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {p.cheque_date ? new Date(p.cheque_date).toLocaleDateString() : "-"}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(p.amount)}
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-amber-700 border-amber-300 hover:bg-amber-50"
                          onClick={() => {
                            setReprintData({
                              payeeName:   p.purchases?.suppliers?.name ?? "",
                              amount:      p.amount,
                              chequeDate:  p.cheque_date,
                              chequeNumber: p.cheque_number,
                              accountName: p.company_accounts?.account_name ?? "",
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
                          onClick={() => openActionDialog(p, "passed")}
                        >
                          Pass
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-600"
                          onClick={() => openActionDialog(p, "returned")}
                        >
                          Return
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

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
                  {filteredHistory.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        No payment history found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredHistory.map((p) => {
                      const methodMeta = METHOD_BADGE[p.payment_method] ?? {
                        label: p.payment_method,
                        className: "bg-slate-50 text-slate-700 border-slate-200",
                        icon: <CreditCard className="w-3 h-3" />,
                      };
                      const isCheque = p.payment_method === "cheque";
                      const statusKey = p.cheque_status?.toLowerCase() ?? "";
                      return (
                        <TableRow key={p.id} className="hover:bg-muted/30">
                          <TableCell className="pl-4 text-sm">
                            {new Date(p.payment_date).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            <button
                              className="font-mono text-xs bg-red-50 text-red-700 border border-red-100 px-2 py-0.5 rounded hover:bg-red-100 transition-colors"
                              onClick={() => router.push(`/dashboard/office/sierra/purchases/${p.purchases?.id}`)}
                            >
                              {p.purchases?.purchase_id ?? "-"}
                            </button>
                          </TableCell>
                          <TableCell className="text-sm">
                            {p.purchases?.suppliers?.name ?? "-"}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={`gap-1 text-xs ${methodMeta.className}`}
                            >
                              {methodMeta.icon}
                              {methodMeta.label}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {isCheque && p.cheque_number ? (
                              <span className="font-mono text-sm font-medium text-amber-800">
                                {p.cheque_number}
                              </span>
                            ) : (
                              <span className="text-muted-foreground text-sm">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {isCheque && p.cheque_date
                              ? new Date(p.cheque_date).toLocaleDateString()
                              : "-"}
                          </TableCell>
                          <TableCell>
                            {isCheque && statusKey ? (
                              <Badge
                                variant="outline"
                                className={`text-xs capitalize ${CHEQUE_STATUS_BADGE[statusKey] ?? "bg-slate-50 text-slate-700 border-slate-200"}`}
                              >
                                {p.cheque_status}
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                                Completed
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right pr-4 font-mono font-medium">
                            {formatCurrency(p.amount)}
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

      {/* Payment Dialog */}
      <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Make Payment</DialogTitle>
            <DialogDescription>
              To {selectedPurchase?.supplierName} for{" "}
              {selectedPurchase?.purchaseId}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Amount</Label>
                <Input
                  type="number"
                  value={paymentForm.amount}
                  onChange={(e) =>
                    setPaymentForm({ ...paymentForm, amount: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Date</Label>
                <Input
                  type="date"
                  value={paymentForm.payment_date}
                  onChange={(e) =>
                    setPaymentForm({
                      ...paymentForm,
                      payment_date: e.target.value,
                    })
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Method</Label>
              <Select
                value={paymentForm.payment_method}
                onValueChange={(v) =>
                  setPaymentForm({ ...paymentForm, payment_method: v })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
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
                onValueChange={(v) =>
                  setPaymentForm({ ...paymentForm, company_account_id: v })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select account" />
                </SelectTrigger>
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
                <AlertDescription>
                  This payment exceeds the account balance.
                </AlertDescription>
              </Alert>
            )}
            {paymentForm.payment_method === "cheque" && (
              <div className="grid grid-cols-2 gap-4">
                <Input
                  placeholder="Cheque No"
                  value={paymentForm.cheque_number}
                  onChange={(e) =>
                    setPaymentForm({
                      ...paymentForm,
                      cheque_number: e.target.value,
                    })
                  }
                />
                <Input
                  type="date"
                  value={paymentForm.cheque_date}
                  onChange={(e) =>
                    setPaymentForm({
                      ...paymentForm,
                      cheque_date: e.target.value,
                    })
                  }
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsPaymentDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handlePaymentSubmit}
              disabled={isSubmitting}
              className="bg-red-600 hover:bg-red-700"
            >
              Confirm Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reprint Cheque Dialog */}
      <ReprintChequeDialog
        open={isReprintDialogOpen}
        onClose={() => setIsReprintDialogOpen(false)}
        cheque={reprintData}
      />

      {/* Write Cheque Dialog */}
      <WriteChequeDialog
        open={isChequeDialogOpen}
        onClose={() => setIsChequeDialogOpen(false)}
        purchase={selectedPurchase}
        companyAccounts={companyAccounts}
        businessId={currentBusinessId}
        onSuccess={fetchData}
      />

      {/* Action Dialog */}
      <AlertDialog
        open={isActionDialogOpen}
        onOpenChange={setIsActionDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Action</AlertDialogTitle>
            <AlertDialogDescription>
              Mark cheque {selectedPayment?.cheque_number} as{" "}
              <strong>{actionType}</strong>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleChequeAction}
              className="bg-red-600 hover:bg-red-700"
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
