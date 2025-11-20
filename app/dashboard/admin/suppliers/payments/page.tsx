"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  DollarSign,
  Check,
  ChevronsUpDown,
  Search,
  History,
  Building2,
  TrendingDown,
  AlertCircle,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  Banknote,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { cn } from "@/lib/utils";

// --- Utility Helper ---
const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("en-LK", {
    style: "currency",
    currency: "LKR",
    minimumFractionDigits: 2,
  }).format(amount);
};

// --- Types ---
interface CompanyAccount {
  id: string;
  account_name: string;
  account_type: "saving" | "current" | "cash";
  current_balance: number;
  banks?: {
    bank_code: string;
    bank_name: string;
  } | null;
}

interface UnpaidPurchase {
  id: string;
  purchase_id: string; // e.g., PO-001
  purchase_date: string;
  total_amount: number;
  amount_paid: number;
  balance_due: number;
  payment_status: "unpaid" | "partial" | "paid";
  suppliers: {
    id: string;
    name: string;
  };
}

interface SupplierPayment {
  id: string;
  payment_date: string;
  amount: number;
  payment_method: string;
  cheque_number: string | null;
  cheque_date: string | null;
  cheque_status: "pending" | "passed" | "returned" | null;
  notes: string | null;
  company_account_id: string;
  company_accounts: {
    id: string;
    account_name: string;
  } | null;
  purchases: {
    purchase_id: string;
    suppliers: {
      name: string;
    } | null;
  } | null;
}

// --- Mock Data ---
const MOCK_ACCOUNTS: CompanyAccount[] = [
  {
    id: "ACC1",
    account_name: "Main Cash",
    account_type: "cash",
    current_balance: 150000,
    banks: null,
  },
  {
    id: "ACC2",
    account_name: "ComBank Current",
    account_type: "current",
    current_balance: 2500000,
    banks: { bank_code: "7010", bank_name: "Commercial Bank" },
  },
];

const MOCK_UNPAID_PURCHASES: UnpaidPurchase[] = [
  {
    id: "PUR-001",
    purchase_id: "PO-2025-001",
    purchase_date: "2025-02-15",
    total_amount: 450000,
    amount_paid: 0,
    balance_due: 450000,
    payment_status: "unpaid",
    suppliers: { id: "S1", name: "Sierra Cables Ltd" },
  },
  {
    id: "PUR-002",
    purchase_id: "PO-2025-002",
    purchase_date: "2025-02-10",
    total_amount: 120000,
    amount_paid: 50000,
    balance_due: 70000,
    payment_status: "partial",
    suppliers: { id: "S2", name: "Lanka Builders Pvt Ltd" },
  },
];

const MOCK_PAYMENTS: SupplierPayment[] = [
  {
    id: "SP-001",
    payment_date: "2025-02-12",
    amount: 50000,
    payment_method: "bank_transfer",
    cheque_number: null,
    cheque_date: null,
    cheque_status: null,
    notes: "Advance payment",
    company_account_id: "ACC2",
    company_accounts: { id: "ACC2", account_name: "ComBank Current" },
    purchases: {
      purchase_id: "PO-2025-002",
      suppliers: { name: "Lanka Builders Pvt Ltd" },
    },
  },
  {
    id: "SP-002",
    payment_date: "2025-02-18",
    amount: 25000,
    payment_method: "cheque",
    cheque_number: "882911",
    cheque_date: "2025-02-25",
    cheque_status: "pending",
    notes: "Post dated cheque",
    company_account_id: "ACC2",
    company_accounts: { id: "ACC2", account_name: "ComBank Current" },
    purchases: {
      purchase_id: "PO-2025-001",
      suppliers: { name: "Sierra Cables Ltd" },
    },
  },
];

export default function SupplierPaymentsPage() {
  const [unpaidPurchases, setUnpaidPurchases] = useState<UnpaidPurchase[]>([]);
  const [paymentHistory, setPaymentHistory] = useState<SupplierPayment[]>([]);
  const [companyAccounts, setCompanyAccounts] = useState<CompanyAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  // Dialog states
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [isActionDialogOpen, setIsActionDialogOpen] = useState(false);
  const [selectedPurchase, setSelectedPurchase] =
    useState<UnpaidPurchase | null>(null);
  const [selectedPayment, setSelectedPayment] =
    useState<SupplierPayment | null>(null);
  const [actionType, setActionType] = useState<"passed" | "returned" | null>(
    null
  );
  const [accountSearchOpen, setAccountSearchOpen] = useState(false);

  // Overdraft check
  const [overdraftDetails, setOverdraftDetails] = useState<{
    currentBalance: number;
    newBalance: number;
  } | null>(null);

  // Form state
  const [paymentForm, setPaymentForm] = useState({
    amount: "",
    payment_date: new Date().toISOString().split("T")[0],
    company_account_id: "",
    payment_method: "cash",
    cheque_number: "",
    cheque_date: "",
    notes: "",
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    // Simulate API Fetch
    setTimeout(() => {
      setUnpaidPurchases(MOCK_UNPAID_PURCHASES);
      setPaymentHistory(MOCK_PAYMENTS);
      setCompanyAccounts(MOCK_ACCOUNTS);
      setLoading(false);
    }, 500);
  };

  const openPaymentDialog = (purchase: UnpaidPurchase) => {
    setSelectedPurchase(purchase);
    setPaymentForm({
      amount: purchase.balance_due.toString(),
      payment_date: new Date().toISOString().split("T")[0],
      company_account_id: "",
      payment_method: "cash",
      cheque_number: "",
      cheque_date: "",
      notes: `Payment for ${purchase.purchase_id}`,
    });
    setIsPaymentDialogOpen(true);
  };

  const openActionDialog = (
    payment: SupplierPayment,
    action: "passed" | "returned"
  ) => {
    setSelectedPayment(payment);
    setActionType(action);
    setOverdraftDetails(null);

    if (action === "passed") {
      const account = companyAccounts.find(
        (acc) => acc.id === payment.company_account_id
      );

      if (account && account.current_balance < payment.amount) {
        setOverdraftDetails({
          currentBalance: account.current_balance,
          newBalance: account.current_balance - payment.amount,
        });
      }
    }
    setIsActionDialogOpen(true);
  };

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPurchase || !paymentForm.company_account_id) {
      toast.error("Please select a payment account.");
      return;
    }

    const amount = parseFloat(paymentForm.amount);
    if (amount <= 0 || isNaN(amount)) {
      toast.error("Please enter a valid amount.");
      return;
    }

    if (amount > selectedPurchase.balance_due) {
      toast.error(
        `Amount cannot exceed balance due of ${formatCurrency(
          selectedPurchase.balance_due
        )}.`
      );
      return;
    }

    if (
      paymentForm.payment_method === "cheque" &&
      (!paymentForm.cheque_number || !paymentForm.cheque_date)
    ) {
      toast.error("Cheque number and date are required.");
      return;
    }

    setIsSubmitting(true);

    // Simulate API POST
    setTimeout(() => {
      const account = companyAccounts.find(
        (a) => a.id === paymentForm.company_account_id
      );

      const newPayment: SupplierPayment = {
        id: `SP-${Date.now()}`,
        payment_date: paymentForm.payment_date,
        amount: amount,
        payment_method: paymentForm.payment_method,
        cheque_number:
          paymentForm.payment_method === "cheque"
            ? paymentForm.cheque_number
            : null,
        cheque_date:
          paymentForm.payment_method === "cheque"
            ? paymentForm.cheque_date
            : null,
        cheque_status:
          paymentForm.payment_method === "cheque" ? "pending" : null,
        notes: paymentForm.notes,
        company_account_id: paymentForm.company_account_id,
        company_accounts: account
          ? { id: account.id, account_name: account.account_name }
          : null,
        purchases: {
          purchase_id: selectedPurchase.purchase_id,
          suppliers: { name: selectedPurchase.suppliers.name },
        },
      };

      // Update Lists
      setPaymentHistory([newPayment, ...paymentHistory]);

      // Update Purchase Balance
      const updatedPurchases = unpaidPurchases.map((p) => {
        if (p.id === selectedPurchase.id) {
          const newPaid = p.amount_paid + amount;
          const newBalance = p.total_amount - newPaid;
          return {
            ...p,
            amount_paid: newPaid,
            balance_due: newBalance,
            payment_status: newBalance <= 0 ? "paid" : "partial",
          } as UnpaidPurchase;
        }
        return p;
      });

      setUnpaidPurchases(
        updatedPurchases.filter((p) => p.payment_status !== "paid")
      );

      toast.success("Payment recorded successfully!");
      setIsPaymentDialogOpen(false);
      setIsSubmitting(false);
    }, 1000);
  };

  const handleChequeAction = async () => {
    if (!selectedPayment || !actionType) return;

    setIsSubmitting(true);

    // Simulate API PATCH
    setTimeout(() => {
      const updatedHistory = paymentHistory.map((p) =>
        p.id === selectedPayment.id ? { ...p, cheque_status: actionType } : p
      );

      setPaymentHistory(updatedHistory);
      toast.success(`Cheque marked as ${actionType} successfully!`);
      setIsActionDialogOpen(false);
      setOverdraftDetails(null);
      setIsSubmitting(false);
    }, 1000);
  };

  // --- Filters & Calculations ---
  const filteredPurchases = useMemo(() => {
    return unpaidPurchases.filter(
      (p) =>
        p.purchase_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.suppliers.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [unpaidPurchases, searchTerm]);

  const pendingCheques = useMemo(() => {
    return paymentHistory.filter(
      (p) =>
        p.payment_method === "cheque" &&
        p.cheque_status === "pending" &&
        (p.purchases?.purchase_id
          .toLowerCase()
          .includes(searchTerm.toLowerCase()) ||
          p.purchases?.suppliers?.name
            ?.toLowerCase()
            .includes(searchTerm.toLowerCase()) ||
          p.cheque_number?.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [paymentHistory, searchTerm]);

  const filteredHistory = useMemo(() => {
    return paymentHistory.filter(
      (p) =>
        !(p.payment_method === "cheque" && p.cheque_status === "pending") &&
        (p.purchases?.purchase_id
          .toLowerCase()
          .includes(searchTerm.toLowerCase()) ||
          p.purchases?.suppliers?.name
            ?.toLowerCase()
            .includes(searchTerm.toLowerCase()) ||
          p.cheque_number?.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [paymentHistory, searchTerm]);

  const totalBalanceDue = useMemo(
    () => unpaidPurchases.reduce((sum, p) => sum + p.balance_due, 0),
    [unpaidPurchases]
  );

  const totalPendingChequeAmount = useMemo(
    () => pendingCheques.reduce((sum, p) => sum + p.amount, 0),
    [pendingCheques]
  );

  // Overdraft Warning Logic
  const selectedAccount = companyAccounts.find(
    (a) => a.id === paymentForm.company_account_id
  );
  const paymentAmount = parseFloat(paymentForm.amount) || 0;
  const isOverdraft =
    selectedAccount &&
    selectedAccount.current_balance < paymentAmount &&
    paymentForm.payment_method !== "cheque";
  const newBalance =
    selectedAccount && isOverdraft
      ? selectedAccount.current_balance - paymentAmount
      : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Supplier Payments
          </h1>
          <p className="text-muted-foreground">
            Manage outgoing payments to suppliers
          </p>
        </div>
      </div>

      {/* Stats Cards */}
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
          placeholder="Search by Purchase ID, Supplier, or Cheque No..."
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

        {/* 1. Unpaid Purchases Tab */}
        <TabsContent value="unpaid" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Outstanding Supplier Bills</CardTitle>
              <CardDescription>Purchases that require payment.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Purchase ID</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead className="text-right">Total Amount</TableHead>
                    <TableHead className="text-right">Paid</TableHead>
                    <TableHead className="text-right">Balance Due</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-10">
                        <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                      </TableCell>
                    </TableRow>
                  ) : filteredPurchases.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-10">
                        No outstanding bills found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredPurchases.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell>{p.purchase_date}</TableCell>
                        <TableCell className="font-mono font-medium">
                          {p.purchase_id}
                        </TableCell>
                        <TableCell>{p.suppliers.name}</TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(p.total_amount)}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {formatCurrency(p.amount_paid)}
                        </TableCell>
                        <TableCell className="text-right font-bold text-destructive">
                          {formatCurrency(p.balance_due)}
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

        {/* 2. Pending Cheques Tab */}
        <TabsContent value="pending_cheques" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Pending Cheques</CardTitle>
              <CardDescription>
                Cheques issued but not yet cleared.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cheque Date</TableHead>
                    <TableHead>Purchase ID</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead>Cheque No.</TableHead>
                    <TableHead>Paid From</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingCheques.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-10">
                        No pending cheques found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    pendingCheques.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell>{p.cheque_date}</TableCell>
                        <TableCell>{p.purchases?.purchase_id}</TableCell>
                        <TableCell>{p.purchases?.suppliers?.name}</TableCell>
                        <TableCell className="font-mono font-medium">
                          {p.cheque_number}
                        </TableCell>
                        <TableCell>
                          {p.company_accounts?.account_name}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(p.amount)}
                        </TableCell>
                        <TableCell className="text-right space-x-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-green-600 hover:text-green-700 hover:bg-green-50"
                            onClick={() => openActionDialog(p, "passed")}
                          >
                            Pass
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
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

        {/* 3. History Tab */}
        <TabsContent value="history" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Payment History</CardTitle>
              <CardDescription>Past payments made.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Payment Date</TableHead>
                    <TableHead>Purchase ID</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead>Account</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredHistory.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-10">
                        No payment history found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredHistory.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell>{p.payment_date}</TableCell>
                        <TableCell>{p.purchases?.purchase_id}</TableCell>
                        <TableCell>{p.purchases?.suppliers?.name}</TableCell>
                        <TableCell>
                          {p.company_accounts?.account_name}
                        </TableCell>
                        <TableCell className="capitalize">
                          {p.payment_method.replace("_", " ")}
                        </TableCell>
                        <TableCell>
                          <span
                            className={cn(
                              "inline-flex items-center px-2 py-1 rounded-full text-xs font-medium",
                              p.cheque_status === "passed"
                                ? "bg-green-100 text-green-700"
                                : p.cheque_status === "returned"
                                ? "bg-red-100 text-red-700"
                                : "bg-gray-100 text-gray-700"
                            )}
                          >
                            {p.cheque_status || "Completed"}
                          </span>
                        </TableCell>
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
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Record Supplier Payment</DialogTitle>
            <DialogDescription>
              Paying <strong>{selectedPurchase?.suppliers.name}</strong> for{" "}
              <strong>{selectedPurchase?.purchase_id}</strong>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <Label className="text-blue-900">Balance Due</Label>
              <div className="text-3xl font-bold text-blue-700">
                {formatCurrency(selectedPurchase?.balance_due || 0)}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Amount *</Label>
                <Input
                  type="number"
                  value={paymentForm.amount}
                  onChange={(e) =>
                    setPaymentForm({ ...paymentForm, amount: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Date *</Label>
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
              <Label>Payment Method *</Label>
              <Select
                value={paymentForm.payment_method}
                onValueChange={(val) =>
                  setPaymentForm({ ...paymentForm, payment_method: val })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  <SelectItem value="cheque">Cheque</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Account Selection (Popover) */}
            <div className="space-y-2">
              <Label>Pay From Account *</Label>
              <Popover
                open={accountSearchOpen}
                onOpenChange={setAccountSearchOpen}
              >
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={accountSearchOpen}
                    className="w-full justify-between font-normal"
                  >
                    {paymentForm.company_account_id
                      ? companyAccounts.find(
                          (a) => a.id === paymentForm.company_account_id
                        )?.account_name
                      : "Select account..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                  <Command>
                    <CommandInput placeholder="Search account..." />
                    <CommandList>
                      <CommandEmpty>No account found.</CommandEmpty>
                      <CommandGroup>
                        {companyAccounts.map((account) => (
                          <CommandItem
                            key={account.id}
                            value={account.account_name}
                            onSelect={() => {
                              setPaymentForm({
                                ...paymentForm,
                                company_account_id: account.id,
                              });
                              setAccountSearchOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                paymentForm.company_account_id === account.id
                                  ? "opacity-100"
                                  : "opacity-0"
                              )}
                            />
                            <div className="flex flex-col">
                              <span>{account.account_name}</span>
                              <span className="text-xs text-muted-foreground">
                                Bal: {formatCurrency(account.current_balance)}
                              </span>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* Overdraft Warning */}
            {isOverdraft && (
              <Alert variant="destructive" className="py-2">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle className="text-sm font-bold">
                  Insufficient Funds
                </AlertTitle>
                <AlertDescription className="text-xs">
                  Paying this will result in a negative balance of{" "}
                  {formatCurrency(newBalance)}.
                </AlertDescription>
              </Alert>
            )}

            {/* Cheque Fields */}
            {paymentForm.payment_method === "cheque" && (
              <div className="grid grid-cols-2 gap-4 p-3 border rounded-md bg-muted/20">
                <div className="space-y-2">
                  <Label>Cheque No</Label>
                  <Input
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
              {isSubmitting && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Confirm Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Action Confirmation Dialog (Pass/Return) */}
      <AlertDialog
        open={isActionDialogOpen}
        onOpenChange={setIsActionDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Action</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                Are you sure you want to mark cheque{" "}
                <strong>{selectedPayment?.cheque_number}</strong> as{" "}
                <strong>{actionType}</strong>?
                {actionType === "passed" && overdraftDetails && (
                  <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-800 text-sm">
                    <strong>Warning:</strong> This account has insufficient
                    funds.
                    <br />
                    Current: {formatCurrency(overdraftDetails.currentBalance)}
                    <br />
                    After: {formatCurrency(overdraftDetails.newBalance)}
                  </div>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleChequeAction}
              className={cn(
                actionType === "returned" &&
                  "bg-destructive hover:bg-destructive/90"
              )}
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
