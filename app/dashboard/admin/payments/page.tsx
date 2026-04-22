"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useCachedFetch } from "@/hooks/useCachedFetch";
import {
  Plus,
  Search,
  DollarSign,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  Banknote,
  Check,
  ChevronsUpDown,
  MoreHorizontal,
  Eye,
  FileText,
  RefreshCw,
  CreditCard,
  Building2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
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
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { cn } from "@/lib/utils";
import { BUSINESS_NAMES } from "@/app/config/business-constants";

const BUSINESS_OPTIONS = Object.entries(BUSINESS_NAMES).map(([id, name]) => ({ id, name }));
import { toast } from "sonner";

// --- Utility Helper ---
const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("en-LK", {
    style: "currency",
    currency: "LKR",
    minimumFractionDigits: 2,
  }).format(amount);
};

// --- Types ---
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
  current_balance: number;
  banks?: {
    bank_code: string;
    bank_name: string;
  } | null;
}

interface Payment {
  id: string;
  payment_number: string;
  payment_date: string;
  invoice_id: string | null;
  order_id: string | null;
  customer_id: string;
  amount: number;
  payment_method: string;
  reference_number: string | null;
  notes: string | null;
  cheque_number: string | null;
  cheque_date: string | null;
  cheque_status:
    | "Pending"
    | "Deposited"
    | "Passed"
    | "Returned"
    | "pending"
    | "deposited"
    | "passed"
    | "returned"
    | null;
  bank_id: string | null;
  deposit_account_id: string | null;
  customers?: { name: string };
  orders?: { order_number: string; total_amount: number; business_name?: string } | null;
  banks?: { bank_code: string; bank_name: string };
  company_accounts?: { account_name: string; account_type: string } | null;
}

interface Order {
  id: string;
  order_number: string;
  customer_id: string;
  customer_name: string;
  order_date: string;
  total_amount: number;
  paid_amount: number;
  balance: number;
  paymentStatus: string;
  status: string; // Added status field
}

function AdminStatusForm({
  payment,
  onSuccess,
  onCancel,
}: {
  payment: Payment;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [status, setStatus] = useState<string>(payment.cheque_status?.toLowerCase() === "pending" ? "Pending" : payment.cheque_status || "Pending");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/payments/${payment.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chequeStatus: status }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update status");
      }
      toast.success("Cheque status updated");
      onSuccess();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div className="space-y-4 py-2">
        <div className="space-y-2">
          <Label>New Cheque Status</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Pending">Pending</SelectItem>
              <SelectItem value="Deposited">Deposited</SelectItem>
              <SelectItem value="Passed">Passed</SelectItem>
              <SelectItem value="Returned">Returned</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onCancel} disabled={isSubmitting}>Cancel</Button>
        <Button onClick={handleSubmit} disabled={isSubmitting}>
          {isSubmitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Updating...</> : "Update Status"}
        </Button>
      </DialogFooter>
    </>
  );
}

export default function PaymentsPage() {
  const [selectedBusinessId, setSelectedBusinessId] = useState<string>("");

  const bizParam = selectedBusinessId ? `?businessId=${selectedBusinessId}` : "";
  const { data: payments = [], loading: l1, refetch: refetchPayments } =
    useCachedFetch<Payment[]>(`/api/payments${bizParam}`, [], () => toast.error("Failed to load payments"));
  const { data: ordersRaw = [], loading: l2, refetch: refetchOrders } =
    useCachedFetch<any[]>(`/api/orders${bizParam}`, [], () => toast.error("Failed to load orders"));
  const { data: accountsRaw = [], loading: l3, refetch: refetchAccounts } =
    useCachedFetch<any[]>("/api/finance/accounts", [], () => toast.error("Failed to load accounts"));
  const { data: banks = [], loading: l4, refetch: refetchBanks } =
    useCachedFetch<Bank[]>("/api/finance/bank-codes", [], () => toast.error("Failed to load banks"));

  const loading = l1 || l2 || l3 || l4;

  const unpaidOrders = useMemo<Order[]>(
    () =>
      ordersRaw
        .filter(
          (o: any) =>
            o.paymentStatus !== "Paid" &&
            (o.status === "Delivered" || o.status === "Completed")
        )
        .map((o: any) => ({
          id: o.id,
          order_number: o.invoiceNo !== "N/A" ? o.invoiceNo : o.orderId,
          customer_id: o.customerId ?? "",
          customer_name: o.customerName,
          order_date: o.date,
          total_amount: o.totalAmount,
          balance: o.dueAmount ?? o.totalAmount,
          paid_amount: o.paidAmount ?? 0,
          paymentStatus: o.paymentStatus,
          status: o.status,
        })),
    [ordersRaw]
  );

  const companyAccounts = useMemo<CompanyAccount[]>(
    () =>
      accountsRaw.map((acc: any) => ({
        id: acc.id,
        account_name: acc.account_name,
        account_type: (acc.account_type || "").toLowerCase(),
        account_number: acc.account_number,
        current_balance: acc.current_balance,
        banks: acc.bank_codes,
      })),
    [accountsRaw]
  );

  const fetchData = () => { refetchPayments(); refetchOrders(); refetchAccounts(); refetchBanks(); };

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isStatusDialogOpen, setIsStatusDialogOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [customerFilter, setCustomerFilter] = useState("all");
  const [methodFilter, setMethodFilter] = useState("all");
  const [chequeStatusFilter, setChequeStatusFilter] = useState("all");
  const [bankSearchOpen, setBankSearchOpen] = useState(false);
  const [accountSearchOpen, setAccountSearchOpen] = useState(false);
  const [orderSearchOpen, setOrderSearchOpen] = useState(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const [formData, setFormData] = useState({
    orderId: "",
    amount: 0,
    date: new Date().toISOString().split("T")[0],
    method: "cash",
    bankId: "",
    depositAccountId: "",
    chequeNo: "",
    chequeDate: "",
    notes: "",
  });

  // Reset page to 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, methodFilter, chequeStatusFilter, selectedBusinessId]);

  const filteredPayments = payments.filter((payment) => {
    const matchesSearch =
      payment.payment_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payment.customers?.name
        ?.toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      payment.orders?.order_number
        ?.toLowerCase()
        .includes(searchTerm.toLowerCase());

    const matchesCustomer =
      customerFilter === "all" || payment.customers?.name === customerFilter;

    const matchesMethod =
      methodFilter === "all" ||
      payment.payment_method.toLowerCase() === methodFilter.toLowerCase();

    const matchesChequeStatus =
      chequeStatusFilter === "all" ||
      (chequeStatusFilter === "cheque" &&
        payment.payment_method.toLowerCase() === "cheque") ||
      payment.cheque_status?.toLowerCase() === chequeStatusFilter.toLowerCase();

    return (
      matchesSearch && matchesCustomer && matchesMethod && matchesChequeStatus
    );
  });

  // Calculate stats
  const totalPayments = payments.length;
  const totalReceived = payments.reduce((sum, p) => sum + p.amount, 0);

  const pendingCheques = payments.filter(
    (p) => p.cheque_status === "Pending" || p.cheque_status === "pending"
  ).length;

  const returnedCheques = payments.filter(
    (p) => p.cheque_status === "Returned" || p.cheque_status === "returned"
  ).length;

  // Pagination logic
  const totalItems = filteredPayments.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = currentPage * itemsPerPage;
  const paginatedPayments = filteredPayments.slice(startIndex, endIndex);

  const handleNextPage = () => {
    setCurrentPage((prev) => Math.min(prev + 1, totalPages));
  };

  const handlePreviousPage = () => {
    setCurrentPage((prev) => Math.max(prev - 1, 1));
  };

  // Get available accounts based on payment method
  const getAvailableAccounts = () => {
    if (formData.method === "cash") {
      // Cash payments → Cash or Cash on Hand accounts
      return companyAccounts.filter(
        (acc) =>
          acc.account_type === "cash" ||
          acc.account_type === "cash on hand" ||
          acc.account_type === "wallet"
      );
    } else if (formData.method === "bank") {
      // Bank transfers → Bank, Savings, or Current accounts
      return companyAccounts.filter(
        (acc) =>
          acc.account_type === "bank" ||
          acc.account_type === "savings" ||
          acc.account_type === "saving" ||
          acc.account_type === "current"
      );
    }
    return [];
  };

  const handleAddPayment = async () => {
    if (!formData.orderId || formData.amount <= 0) {
      toast.error("Please select an order and enter valid amount");
      return;
    }

    if (
      (formData.method === "bank" || formData.method === "cash") &&
      !formData.depositAccountId
    ) {
      const accountType =
        formData.method === "cash" ? "cash account" : "bank account";
      toast.error(`Please select a ${accountType} for deposit`);
      return;
    }

    if (
      formData.method === "cheque" &&
      (!formData.chequeNo || !formData.chequeDate || !formData.bankId)
    ) {
      toast.error(
        "Please provide cheque number, date, and bank for cheque payments"
      );
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = {
        orderId: formData.orderId,
        amount: formData.amount,
        date: formData.date,
        method: formData.method,
        notes: formData.notes,
        chequeNo: formData.method === "cheque" ? formData.chequeNo : undefined,
        chequeDate:
          formData.method === "cheque" ? formData.chequeDate : undefined,
        bankId: formData.method === "cheque" ? formData.bankId : undefined,
        depositAccountId:
          formData.method === "cash" || formData.method === "bank"
            ? formData.depositAccountId
            : undefined,
      };

      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to record payment");
      }

      toast.success("Payment recorded successfully!");
      setIsAddDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      orderId: "",
      amount: 0,
      date: new Date().toISOString().split("T")[0],
      method: "cash",
      bankId: "",
      depositAccountId: "",
      chequeNo: "",
      chequeDate: "",
      notes: "",
    });
  };

  const getChequeStatusBadge = (
    status: string | null | undefined,
    chequeDate: string | null
  ) => {
    if (!status) return null;
    const lowerStatus = status.toLowerCase();

    const today = new Date();
    const chequeDateObj = chequeDate ? new Date(chequeDate) : null;
    const isOverdue =
      chequeDateObj && lowerStatus === "pending" && chequeDateObj < today;

    const statusConfig: any = {
      pending: {
        color: isOverdue ? "text-orange-600" : "text-yellow-600",
        bg: isOverdue ? "bg-orange-50" : "bg-yellow-50",
        icon: Clock,
        label: isOverdue ? "Overdue" : "Pending",
      },
      deposited: {
        color: "text-blue-600",
        bg: "bg-blue-50",
        icon: Banknote,
        label: "Deposited",
      },
      passed: {
        color: "text-green-600",
        bg: "bg-green-50",
        icon: CheckCircle,
        label: "Passed",
      },
      returned: {
        color: "text-red-600",
        bg: "bg-red-50",
        icon: XCircle,
        label: "Returned",
      },
    };

    const config = statusConfig[lowerStatus];

    if (!config) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-gray-50 text-gray-600">
          <Clock className="w-3 h-3" />
          {status}
        </span>
      );
    }

    const Icon = config.icon;

    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium ${config.bg} ${config.color}`}
      >
        <Icon className="w-3 h-3" />
        {config.label}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Payments</h1>
          <p className="text-muted-foreground">
            Manage customer payments and cheques
          </p>
        </div>
        <Button onClick={() => setIsAddDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Payment
        </Button>
      </div>

      {/* Business Filter */}
      <div className="flex items-center gap-3">
        <div className="w-64 space-y-1">
          <Select
            value={selectedBusinessId || "all"}
            onValueChange={(v) => setSelectedBusinessId(v === "all" ? "" : v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="All businesses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All businesses</SelectItem>
              {BUSINESS_OPTIONS.map((b) => (
                <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {selectedBusinessId && (
          <Button variant="ghost" size="sm" onClick={() => setSelectedBusinessId("")}>
            Clear filter
          </Button>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Total Payments
            </CardTitle>
            <DollarSign className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalPayments}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Total Received
            </CardTitle>
            <DollarSign className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(totalReceived)}
            </div>
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
            <div className="text-2xl font-bold">{pendingCheques}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Returned Cheques
            </CardTitle>
            <XCircle className="w-4 h-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{returnedCheques}</div>
          </CardContent>
        </Card>
      </div>

      {/* Payments Table */}
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <CardTitle>Payment History</CardTitle>
            <div className="flex items-center gap-4 flex-wrap">
              <div className="relative flex-1 md:w-[300px]">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search payments..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={methodFilter} onValueChange={setMethodFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Payment method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Methods</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="bank">Bank Transfer</SelectItem>
                  <SelectItem value="credit">Credit</SelectItem>
                  <SelectItem value="cheque">Cheque</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={chequeStatusFilter}
                onValueChange={setChequeStatusFilter}
              >
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Cheque status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Cheques</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="deposited">Deposited</SelectItem>
                  <SelectItem value="passed">Passed</SelectItem>
                  <SelectItem value="returned">Returned</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50 hover:bg-gray-50">
                <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wide py-3 px-4 whitespace-nowrap">Date</TableHead>
                <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wide py-3 px-4">Payment ID</TableHead>
                <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wide py-3 px-4">Bill No</TableHead>
                <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wide py-3 px-4">Customer</TableHead>
                <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wide py-3 px-4 text-right">Amount</TableHead>
                <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wide py-3 px-4">Method</TableHead>
                <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wide py-3 px-4">Deposit Account</TableHead>
                <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wide py-3 px-4">Cheque / Bank Details</TableHead>
                <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wide py-3 px-4">Cheque Status</TableHead>
                <TableHead className="w-12 py-3 px-4" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedPayments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-16 text-muted-foreground">No payments found</TableCell>
                </TableRow>
              ) : (
                paginatedPayments.map((payment) => {
                  const isCheque = payment.payment_method?.toLowerCase() === "cheque";
                  return (
                    <TableRow key={payment.id} className="hover:bg-gray-50/50 transition-colors border-b border-gray-100 last:border-0">
                      <TableCell className="py-3 px-4 text-sm text-gray-600 whitespace-nowrap">{new Date(payment.payment_date).toLocaleDateString()}</TableCell>
                      <TableCell className="py-3 px-4">
                        <span className="font-mono text-xs text-gray-500 bg-gray-100 rounded px-1.5 py-0.5">{payment.payment_number}</span>
                      </TableCell>
                      <TableCell className="py-3 px-4">
                        <span className="text-sm font-semibold text-gray-800">{payment.orders?.order_number || "N/A"}</span>
                      </TableCell>
                      <TableCell className="py-3 px-4">
                        <p className="text-sm font-medium text-gray-800">{payment.customers?.name || "N/A"}</p>
                        {payment.orders?.business_name && <p className="text-xs text-muted-foreground">{payment.orders.business_name}</p>}
                      </TableCell>
                      <TableCell className="py-3 px-4 text-right">
                        <span className="text-sm font-bold text-gray-800">{formatCurrency(payment.amount)}</span>
                      </TableCell>
                      <TableCell className="py-3 px-4">
                        {isCheque ? (
                          <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 text-xs font-medium"><CreditCard className="w-3 h-3" /> Cheque</span>
                        ) : payment.payment_method?.toLowerCase() === "bank" ? (
                          <span className="inline-flex items-center gap-1 rounded-md bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 text-xs font-medium"><Building2 className="w-3 h-3" /> Bank</span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-md bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 text-xs font-medium"><Banknote className="w-3 h-3" /> Cash</span>
                        )}
                      </TableCell>
                      <TableCell className="py-3 px-4">
                        {payment.company_accounts ? (
                          <div className="flex flex-col">
                            <span className="text-sm font-semibold text-gray-800">{payment.company_accounts.account_name}</span>
                            <span className="text-xs text-muted-foreground capitalize">{payment.company_accounts.account_type}</span>
                          </div>
                        ) : <span className="text-xs text-muted-foreground">N/A</span>}
                      </TableCell>
                      <TableCell className="py-3 px-4">
                        {isCheque ? (
                          <div className="flex flex-col gap-0.5">
                            <span className="text-sm font-medium text-gray-800">Cheque: {payment.cheque_number || "—"}</span>
                            {payment.banks && <span className="text-xs text-muted-foreground">{payment.banks.bank_code} - {payment.banks.bank_name}</span>}
                            {payment.cheque_date && <span className="text-xs text-muted-foreground">Date: {new Date(payment.cheque_date).toLocaleDateString()}</span>}
                          </div>
                        ) : payment.payment_method?.toLowerCase() === "bank" && payment.banks ? (
                          <span className="text-sm text-muted-foreground">{payment.banks.bank_code} - {payment.banks.bank_name}</span>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">Cash Payment</span>
                        )}
                      </TableCell>
                      <TableCell className="py-3 px-4">
                        {isCheque ? getChequeStatusBadge(payment.cheque_status, payment.cheque_date) : <span className="text-xs text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="py-3 px-4">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0 hover:bg-gray-100">
                              <span className="sr-only">Open menu</span>
                              <MoreHorizontal className="h-4 w-4 text-gray-500" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44">
                            <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">Actions</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="cursor-pointer" onClick={() => { setSelectedPayment(payment); setIsViewDialogOpen(true); }}>
                              <Eye className="mr-2 h-4 w-4" /> View Details
                            </DropdownMenuItem>
                            {payment.invoice_id && (
                              <DropdownMenuItem className="cursor-pointer" onClick={() => window.open(`/dashboard/admin/invoices/${payment.invoice_id}`, "_blank")}>
                                <FileText className="mr-2 h-4 w-4" /> View Invoice
                              </DropdownMenuItem>
                            )}
                            {isCheque && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem className="cursor-pointer" onClick={() => { setSelectedPayment(payment); setIsStatusDialogOpen(true); }}>
                                  <RefreshCw className="mr-2 h-4 w-4" /> Update Status
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>

        {/* Pagination Controls */}
        <CardFooter className="flex items-center justify-between py-4">
          <div className="text-sm text-muted-foreground">
            Showing {Math.min(startIndex + 1, totalItems)} to{" "}
            {Math.min(endIndex, totalItems)} of {totalItems} entries
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePreviousPage}
              disabled={currentPage === 1}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleNextPage}
              disabled={currentPage === totalPages || totalPages === 0}
            >
              Next
            </Button>
          </div>
        </CardFooter>
      </Card>

      {/* View Payment Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>Payment Details</DialogTitle>
            <DialogDescription>Full information for this payment record.</DialogDescription>
          </DialogHeader>
          {selectedPayment && (
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Customer</span>
                <span className="font-medium">{selectedPayment.customers?.name || "N/A"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Amount</span>
                <span className="font-bold text-green-700">{formatCurrency(selectedPayment.amount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Payment Date</span>
                <span>{new Date(selectedPayment.payment_date).toLocaleDateString()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Method</span>
                {selectedPayment.payment_method?.toLowerCase() === "cheque" ? (
                  <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 text-xs font-medium"><CreditCard className="w-3 h-3" /> Cheque</span>
                ) : selectedPayment.payment_method?.toLowerCase() === "bank" ? (
                  <span className="inline-flex items-center gap-1 rounded-md bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 text-xs font-medium"><Building2 className="w-3 h-3" /> Bank Transfer</span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-md bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 text-xs font-medium"><Banknote className="w-3 h-3" /> Cash</span>
                )}
              </div>
              {selectedPayment.company_accounts && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Deposit Account</span>
                  <span className="font-medium">{selectedPayment.company_accounts.account_name}</span>
                </div>
              )}
              {selectedPayment.payment_method?.toLowerCase() === "cheque" && (
                <div className="rounded-md bg-gray-50 border border-gray-200 p-3 space-y-2 mt-1">
                  <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Cheque Details</p>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground text-xs">Cheque No</span>
                    <span className="font-mono text-xs font-semibold">{selectedPayment.cheque_number || "—"}</span>
                  </div>
                  {selectedPayment.cheque_date && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground text-xs">Cheque Date</span>
                      <span className="text-xs">{new Date(selectedPayment.cheque_date).toLocaleDateString()}</span>
                    </div>
                  )}
                  {selectedPayment.banks && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground text-xs">Bank</span>
                      <span className="text-xs">{selectedPayment.banks.bank_code} — {selectedPayment.banks.bank_name}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground text-xs">Status</span>
                    {getChequeStatusBadge(selectedPayment.cheque_status, selectedPayment.cheque_date)}
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsViewDialogOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Update Cheque Status Dialog */}
      {selectedPayment && (
        <Dialog open={isStatusDialogOpen} onOpenChange={setIsStatusDialogOpen}>
          <DialogContent className="sm:max-w-[400px]">
            <DialogHeader>
              <DialogTitle>Update Cheque Status</DialogTitle>
              <DialogDescription>
                Cheque #{selectedPayment.cheque_number} — {selectedPayment.customers?.name}
              </DialogDescription>
            </DialogHeader>
            <AdminStatusForm
              payment={selectedPayment}
              onSuccess={() => { setIsStatusDialogOpen(false); fetchData(); }}
              onCancel={() => setIsStatusDialogOpen(false)}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Add Payment Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add Payment</DialogTitle>
            <DialogDescription>
              Record a new payment from customer
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            {/* Select Order */}
            <div className="col-span-2 space-y-2">
              <Label htmlFor="order">Select Order *</Label>
              <Popover open={orderSearchOpen} onOpenChange={setOrderSearchOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={orderSearchOpen}
                    className="w-full justify-between h-10"
                  >
                    <span className="truncate">
                      {formData.orderId
                        ? (() => {
                            const order = unpaidOrders.find(
                              (o) => o.id === formData.orderId
                            );
                            return order
                              ? `${order.order_number} - ${order.customer_name}`
                              : "Select an order...";
                          })()
                        : "Select an order..."}
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[500px] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Search by order, customer..." />
                    <CommandList>
                      <CommandEmpty>No unpaid orders found.</CommandEmpty>
                      <CommandGroup>
                        {unpaidOrders.map((order) => (
                          <CommandItem
                            key={order.id}
                            value={`${order.order_number} ${order.customer_name}`}
                            onSelect={() => {
                              setFormData({
                                ...formData,
                                orderId: order.id,
                                amount: order.balance, // Default to full balance
                              });
                              setOrderSearchOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                formData.orderId === order.id
                                  ? "opacity-100"
                                  : "opacity-0"
                              )}
                            />
                            <div className="flex justify-between w-full">
                              <div className="flex flex-col">
                                <span className="font-medium">
                                  {order.order_number} - {order.customer_name}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  Date:{" "}
                                  {new Date(
                                    order.order_date
                                  ).toLocaleDateString()}
                                </span>
                                <span className="text-xs text-muted-foreground capitalize">
                                  Status: {order.status}
                                </span>
                              </div>
                              <span className="font-medium">
                                {formatCurrency(order.balance)}
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

            <div className="space-y-2">
              <Label htmlFor="amount">Payment Amount (LKR) *</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                placeholder="Enter amount"
                value={formData.amount}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    amount: parseFloat(e.target.value) || 0,
                  })
                }
                className="w-full h-10"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="date">Payment Date *</Label>
              <Input
                id="date"
                type="date"
                value={formData.date}
                onChange={(e) =>
                  setFormData({ ...formData, date: e.target.value })
                }
                className="w-full h-10"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="method">Payment Method *</Label>
              <Select
                value={formData.method}
                onValueChange={(value) =>
                  setFormData({
                    ...formData,
                    method: value,
                    depositAccountId: "",
                    bankId: "",
                    chequeNo: "",
                    chequeDate: "",
                  })
                }
              >
                <SelectTrigger className="w-full h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="bank">Bank Transfer</SelectItem>
                  <SelectItem value="cheque">Cheque</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Deposit Account Selection */}
            {(formData.method === "cash" || formData.method === "bank") && (
              <div className="space-y-2">
                <Label>
                  {formData.method === "cash"
                    ? "Select Cash / Wallet Account *"
                    : "Deposit to Bank Account *"}
                </Label>
                <Popover
                  open={accountSearchOpen}
                  onOpenChange={setAccountSearchOpen}
                >
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={accountSearchOpen}
                      className="w-full justify-between h-10"
                    >
                      <span className="truncate">
                        {formData.depositAccountId
                          ? (() => {
                              const account = companyAccounts.find(
                                (a) => a.id === formData.depositAccountId
                              );
                              return account ? (
                                <span>
                                  {account.account_name}
                                  {account.banks && (
                                    <span className="text-muted-foreground ml-2">
                                      ({account.banks.bank_code})
                                    </span>
                                  )}
                                </span>
                              ) : (
                                "Select account..."
                              );
                            })()
                          : "Select account..."}
                      </span>
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0">
                    <Command>
                      <CommandInput placeholder="Search account..." />
                      <CommandList>
                        <CommandEmpty>No account found.</CommandEmpty>
                        <CommandGroup>
                          {getAvailableAccounts().map((account) => (
                            <CommandItem
                              key={account.id}
                              value={`${account.account_name} ${
                                account.banks?.bank_name || ""
                              }`}
                              onSelect={() => {
                                setFormData({
                                  ...formData,
                                  depositAccountId: account.id,
                                });
                                setAccountSearchOpen(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  formData.depositAccountId === account.id
                                    ? "opacity-100"
                                    : "opacity-0"
                                )}
                              />
                              <div className="flex flex-col">
                                <span className="font-medium">
                                  {account.account_name}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {account.banks
                                    ? `${account.banks.bank_code} - ${account.banks.bank_name}`
                                    : "Cash on Hand"}{" "}
                                  | Balance:{" "}
                                  {formatCurrency(account.current_balance)}
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
            )}

            {/* Cheque specific fields */}
            {formData.method === "cheque" && (
              <>
                <div className="space-y-2">
                  <Label>Cheque Bank *</Label>
                  <Popover
                    open={bankSearchOpen}
                    onOpenChange={setBankSearchOpen}
                  >
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={bankSearchOpen}
                        className="w-full justify-between h-10"
                      >
                        <span className="truncate">
                          {formData.bankId
                            ? (() => {
                                const bank = banks.find(
                                  (b) => b.id === formData.bankId
                                );
                                return bank
                                  ? `${bank.bank_code} - ${bank.bank_name}`
                                  : "Select bank...";
                              })()
                            : "Select bank..."}
                        </span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-full p-0">
                      <Command>
                        <CommandInput placeholder="Search bank..." />
                        <CommandList>
                          <CommandEmpty>No bank found.</CommandEmpty>
                          <CommandGroup>
                            {banks.map((bank) => (
                              <CommandItem
                                key={bank.id}
                                value={`${bank.bank_code} ${bank.bank_name}`}
                                onSelect={() => {
                                  setFormData({
                                    ...formData,
                                    bankId: bank.id,
                                  });
                                  setBankSearchOpen(false);
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    formData.bankId === bank.id
                                      ? "opacity-100"
                                      : "opacity-0"
                                  )}
                                />
                                {bank.bank_code} - {bank.bank_name}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="chequeNo">Cheque Number *</Label>
                  <Input
                    id="chequeNo"
                    placeholder="Enter cheque number"
                    value={formData.chequeNo}
                    onChange={(e) =>
                      setFormData({ ...formData, chequeNo: e.target.value })
                    }
                    className="w-full h-10"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="chequeDate">Cheque Date *</Label>
                  <Input
                    id="chequeDate"
                    type="date"
                    value={formData.chequeDate}
                    onChange={(e) =>
                      setFormData({ ...formData, chequeDate: e.target.value })
                    }
                    className="w-full h-10"
                  />
                </div>
              </>
            )}
            <div className="col-span-2 space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Input
                id="notes"
                placeholder="Additional notes..."
                value={formData.notes}
                onChange={(e) =>
                  setFormData({ ...formData, notes: e.target.value })
                }
                className="w-full h-10"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsAddDialogOpen(false);
                resetForm();
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddPayment}
              disabled={unpaidOrders.length === 0 || isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                "Add Payment"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
