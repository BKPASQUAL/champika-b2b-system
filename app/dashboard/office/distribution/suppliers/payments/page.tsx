"use client";

import React, { useState, useEffect } from "react";
import { DollarSign, Clock, Loader2, AlertCircle, Search } from "lucide-react";
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
import { toast } from "sonner";
import { BUSINESS_IDS } from "@/app/config/business-constants";

// --- Types ---
interface CompanyAccount {
  id: string;
  account_name: string;
  account_type: string;
  account_number: string | null;
  current_balance: number;
  business_id: string;
}

interface Purchase {
  id: string;
  purchaseId: string;
  purchaseDate: string;
  totalAmount: number;
  paidAmount: number;
  paymentStatus: string;
  supplierId: string;
  supplierName: string;
  businessId: string;
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
  // removed strict UUID requirement here to match your JSON
  purchase_id?: string;
  company_accounts: {
    id: string;
    account_name: string;
  } | null;
  purchases: {
    purchase_id: string; // Readable ID (e.g. PO-1008)
    business_id?: string;
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

export default function DistributionSupplierPaymentsPage() {
  const CURRENT_BUSINESS_ID = BUSINESS_IDS.CHAMPIKA_DISTRIBUTION;

  const [unpaidPurchases, setUnpaidPurchases] = useState<Purchase[]>([]);
  const [paymentHistory, setPaymentHistory] = useState<SupplierPayment[]>([]);
  const [companyAccounts, setCompanyAccounts] = useState<CompanyAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [isActionDialogOpen, setIsActionDialogOpen] = useState(false);
  const [selectedPurchase, setSelectedPurchase] = useState<Purchase | null>(
    null
  );
  const [selectedPayment, setSelectedPayment] =
    useState<SupplierPayment | null>(null);
  const [actionType, setActionType] = useState<"passed" | "returned" | null>(
    null
  );

  const [paymentForm, setPaymentForm] = useState({
    amount: "",
    payment_date: new Date().toISOString().split("T")[0],
    company_account_id: "",
    payment_method: "cash",
    cheque_number: "",
    cheque_date: "",
    notes: "",
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      // ✅ FIX 1: Pass businessId to the API to get pre-filtered payments
      const [purchasesRes, paymentsRes, accountsRes] = await Promise.all([
        fetch("/api/purchases"),
        fetch(`/api/suppliers/payments?businessId=${CURRENT_BUSINESS_ID}`),
        fetch("/api/finance/accounts"),
      ]);

      // 1. Process Purchases
      if (purchasesRes.ok) {
        const allPurchases: Purchase[] = await purchasesRes.json();
        const distributionPurchases = allPurchases.filter(
          (p) => p.businessId === CURRENT_BUSINESS_ID
        );
        setUnpaidPurchases(
          distributionPurchases.filter((p) => p.paymentStatus !== "Paid")
        );
      }

      // 2. Process Payments
      if (paymentsRes.ok) {
        const allPayments: SupplierPayment[] = await paymentsRes.json();
        // ✅ FIX 2: Removed strict client-side ID filtering.
        // We trust the backend `?businessId=` param or simply show what we received.
        setPaymentHistory(allPayments);
      }

      // 3. Process Accounts
      if (accountsRes.ok) {
        const allAccounts = await accountsRes.json();
        setCompanyAccounts(allAccounts);
      }
    } catch (error) {
      toast.error("Failed to load data");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openPaymentDialog = (purchase: Purchase) => {
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
    action: "passed" | "returned"
  ) => {
    setSelectedPayment(payment);
    setActionType(action);
    setIsActionDialogOpen(true);
  };

  const handlePaymentSubmit = async () => {
    if (!selectedPurchase || !paymentForm.company_account_id) {
      toast.error("Please select an account");
      return;
    }
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

  // --- Filtering & Stats ---
  const filteredPurchases = unpaidPurchases.filter(
    (p) =>
      p.purchaseId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.supplierName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const pendingCheques = paymentHistory.filter(
    (p) => p.cheque_status === "pending"
  );

  const filteredHistory = paymentHistory.filter(
    (p) => p.cheque_status !== "pending"
  );

  const totalBalanceDue = unpaidPurchases.reduce(
    (sum, p) => sum + (p.totalAmount - p.paidAmount),
    0
  );
  const totalPendingChequeAmount = pendingCheques.reduce(
    (sum, p) => sum + p.amount,
    0
  );

  // Overdraft Check
  const selectedAccount = companyAccounts.find(
    (a) => a.id === paymentForm.company_account_id
  );
  const isOverdraft =
    selectedAccount &&
    paymentForm.payment_method !== "cheque" &&
    selectedAccount.current_balance < parseFloat(paymentForm.amount || "0");

  if (loading) {
    return (
      <div className="flex justify-center items-center h-full min-h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Distribution Payments
          </h1>
          <p className="text-muted-foreground">
            Manage outgoing payments to suppliers for distribution
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
                  {filteredPurchases.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-6">
                        No unpaid bills found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredPurchases.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell>
                          {new Date(p.purchaseDate).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="font-medium">
                          {p.purchaseId}
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
                          <Button
                            size="sm"
                            onClick={() => openPaymentDialog(p)}
                          >
                            Pay Now
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

        <TabsContent value="pending_cheques" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Pending Cheques (Outbound)</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cheque Date</TableHead>
                    <TableHead>Purchase</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead>Cheque No</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingCheques.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-6">
                        No pending cheques
                      </TableCell>
                    </TableRow>
                  ) : (
                    pendingCheques.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell>
                          {p.cheque_date
                            ? new Date(p.cheque_date).toLocaleDateString()
                            : "-"}
                        </TableCell>
                        <TableCell>{p.purchases?.purchase_id || "-"}</TableCell>
                        <TableCell>
                          {p.purchases?.suppliers?.name || "-"}
                        </TableCell>
                        <TableCell>{p.cheque_number}</TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(p.amount)}
                        </TableCell>
                        <TableCell className="text-right space-x-2">
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
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <Card>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Purchase</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredHistory.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-6">
                        No payment history
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredHistory.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell>
                          {new Date(p.payment_date).toLocaleDateString()}
                        </TableCell>
                        <TableCell>{p.purchases?.purchase_id || "-"}</TableCell>
                        <TableCell>
                          {p.purchases?.suppliers?.name || "-"}
                        </TableCell>
                        <TableCell className="capitalize">
                          {p.payment_method}
                        </TableCell>
                        <TableCell>{p.cheque_status || "Completed"}</TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(p.amount)}
                        </TableCell>
                      </TableRow>
                    ))
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
                <Label>Amount (LKR)</Label>
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
              <Label>From Account (Distribution)</Label>
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
                      {a.account_name}{" "}
                      {a.account_number ? `- ${a.account_number}` : ""}
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
                <div className="space-y-2">
                  <Label>Cheque No</Label>
                  <Input
                    placeholder="Enter No"
                    value={paymentForm.cheque_number}
                    onChange={(e) =>
                      setPaymentForm({
                        ...paymentForm,
                        cheque_number: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Cheque Date</Label>
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
              </div>
            )}
            <div className="space-y-2">
              <Label>Notes</Label>
              <Input
                placeholder="Optional notes"
                value={paymentForm.notes}
                onChange={(e) =>
                  setPaymentForm({ ...paymentForm, notes: e.target.value })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsPaymentDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={handlePaymentSubmit} disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing
                </>
              ) : (
                "Confirm Payment"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
            <AlertDialogAction onClick={handleChequeAction}>
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
