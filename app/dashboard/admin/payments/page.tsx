"use client";

import React, { useState, useEffect } from "react";
import {
  Plus,
  Search,
  DollarSign,
  Calendar,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  Banknote,
  Check,
  ChevronsUpDown,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  // Updated to allow "savings" (plural) which is standard
  account_type: "savings" | "saving" | "current" | "cash";
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
  order_id: string | null;
  customer_id: string;
  amount: number;
  payment_method: string;
  reference_number: string | null;
  notes: string | null;
  cheque_number: string | null;
  cheque_date: string | null;
  // Updated to include Capitalized statuses (common from API)
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
  customers?: {
    name: string;
  };
  orders?: {
    order_number: string;
    total_amount: number;
    business_name?: string;
  } | null;
  banks?: {
    bank_code: string;
    bank_name: string;
  };
  company_accounts?: {
    account_name: string;
    account_type: string;
  } | null;
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
}

export default function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [unpaidOrders, setUnpaidOrders] = useState<Order[]>([]);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [companyAccounts, setCompanyAccounts] = useState<CompanyAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
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

  // Fetch all necessary data
  const fetchData = async () => {
    try {
      setLoading(true);
      const [paymentsRes, ordersRes, accountsRes, banksRes] = await Promise.all(
        [
          fetch("/api/payments"),
          fetch("/api/orders"),
          fetch("/api/finance/accounts"),
          fetch("/api/finance/bank-codes"),
        ]
      );

      if (!paymentsRes.ok) throw new Error("Failed to fetch payments");
      if (!ordersRes.ok) throw new Error("Failed to fetch orders");
      if (!accountsRes.ok) throw new Error("Failed to fetch accounts");
      if (!banksRes.ok) throw new Error("Failed to fetch bank codes");

      const paymentsData = await paymentsRes.json();
      const ordersData = await ordersRes.json();
      const accountsData = await accountsRes.json();
      const banksData = await banksRes.json();

      setPayments(paymentsData);

      const mappedOrders: Order[] = ordersData
        .filter((o: any) => o.paymentStatus !== "Paid")
        .map((o: any) => ({
          id: o.id,
          order_number: o.invoiceNo !== "N/A" ? o.invoiceNo : o.orderId,
          customer_id: "",
          customer_name: o.customerName,
          order_date: o.date,
          total_amount: o.totalAmount,
          balance: o.totalAmount,
          paid_amount: 0,
          paymentStatus: o.paymentStatus,
        }));
      setUnpaidOrders(mappedOrders);

      // Map Accounts to match UI interface
      const mappedAccounts = accountsData.map((acc: any) => ({
        id: acc.id,
        account_name: acc.account_name,
        // Normalize to 'savings' if API returns it, or handle variations
        account_type: acc.account_type.toLowerCase().includes("cash")
          ? "cash"
          : acc.account_type.toLowerCase(),
        account_number: acc.account_number,
        current_balance: acc.current_balance,
        banks: acc.bank_codes,
      }));
      setCompanyAccounts(mappedAccounts);

      setBanks(banksData);
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Failed to load initial data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Reset page to 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, methodFilter, chequeStatusFilter]);

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

    // Safe lowercase check for cheque status
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

  // Fixed: Check for both Title Case and lowercase
  const pendingCheques = payments.filter(
    (p) => p.cheque_status === "Pending" || p.cheque_status === "pending"
  ).length;

  // Fixed: Check for both Title Case and lowercase
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
      return companyAccounts.filter((acc) => acc.account_type === "cash");
    } else if (formData.method === "bank" || formData.method === "cheque") {
      // Fixed: Check for 'savings' (plural) and 'saving' (singular) to be safe
      return companyAccounts.filter(
        (acc) =>
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
      <div className="flex justify-center items-center h-full min-h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
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
                {/* Fixed: Replaced w-[160px] with w-40 */}
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
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Payment ID</TableHead>
                <TableHead>Bill No</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Deposit Account</TableHead>
                <TableHead>Cheque/Bank Details</TableHead>
                <TableHead className="text-right">Cheque Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedPayments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-10">
                    No payments found
                  </TableCell>
                </TableRow>
              ) : (
                paginatedPayments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell>
                      {new Date(payment.payment_date).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="font-medium">
                      {payment.payment_number}
                    </TableCell>
                    <TableCell>
                      {payment.orders?.order_number || "N/A"}
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">
                          {payment.customers?.name || "N/A"}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {payment.orders?.business_name}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(payment.amount)}
                    </TableCell>
                    <TableCell className="capitalize">
                      {payment.payment_method}
                    </TableCell>
                    <TableCell>
                      {payment.company_accounts ? (
                        <div>
                          <div className="font-medium">
                            {payment.company_accounts.account_name}
                          </div>
                          <div className="text-xs text-muted-foreground capitalize">
                            {payment.company_accounts.account_type}
                          </div>
                        </div>
                      ) : (
                        "N/A"
                      )}
                    </TableCell>
                    <TableCell>
                      {payment.payment_method === "cheque" && (
                        <div className="space-y-1">
                          <div className="text-sm">
                            Cheque: {payment.cheque_number}
                          </div>
                          {payment.banks && (
                            <div className="text-xs text-muted-foreground">
                              {payment.banks.bank_code} -{" "}
                              {payment.banks.bank_name}
                            </div>
                          )}
                          {payment.cheque_date && (
                            <div className="text-xs text-muted-foreground">
                              Date:{" "}
                              {new Date(
                                payment.cheque_date
                              ).toLocaleDateString()}
                            </div>
                          )}
                        </div>
                      )}
                      {payment.payment_method === "bank" && payment.banks && (
                        <div className="text-sm">
                          {payment.banks.bank_code} - {payment.banks.bank_name}
                        </div>
                      )}
                      {payment.payment_method === "cash" && (
                        <span className="text-sm text-muted-foreground">
                          Cash Payment
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {payment.payment_method === "cheque" &&
                        getChequeStatusBadge(
                          payment.cheque_status,
                          payment.cheque_date
                        )}
                    </TableCell>
                  </TableRow>
                ))
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
                    ? "Cash Account *"
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
