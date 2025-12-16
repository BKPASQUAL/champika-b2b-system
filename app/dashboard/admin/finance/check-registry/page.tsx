"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Search,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  Banknote,
  ArrowRightLeft,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

// --- Types ---
interface Cheque {
  id: string;
  payment_number: string;
  cheque_number: string;
  cheque_date: string;
  amount: number;
  status: string;
  customer_name: string;
  invoice_no: string;
  bank_name: string;
  deposit_account_id: string | null;
}

interface Account {
  id: string;
  account_name: string;
  account_type: string;
  account_number: string;
  bank_codes?: { bank_name: string; bank_code: string };
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("en-LK", {
    style: "currency",
    currency: "LKR",
    minimumFractionDigits: 2,
  }).format(amount);
};

export default function CheckRegistryPage() {
  const [activeTab, setActiveTab] = useState("pending");
  const [cheques, setCheques] = useState<Cheque[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [accounts, setAccounts] = useState<Account[]>([]);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Dialog States
  const [depositDialogOpen, setDepositDialogOpen] = useState(false);
  const [returnDialogOpen, setReturnDialogOpen] = useState(false);
  const [selectedCheque, setSelectedCheque] = useState<Cheque | null>(null);

  // Action Form States
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [actionDate, setActionDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [returnReason, setReturnReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch Cheques based on Tab
  const fetchCheques = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/finance/cheques?status=${activeTab}`);
      if (res.ok) {
        setCheques(await res.json());
      } else {
        toast.error("Failed to load data");
      }
    } catch (error) {
      console.error(error);
      toast.error("Failed to fetch cheques");
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  // Fetch Accounts for Deposit
  useEffect(() => {
    fetch("/api/finance/accounts")
      .then((res) => res.json())
      .then((data: Account[]) => {
        const currentAccounts = data.filter(
          (a) => a.account_type === "Current" || a.account_type === "current"
        );
        setAccounts(currentAccounts);
      })
      .catch((err) => console.error("Error fetching accounts", err));
  }, []);

  useEffect(() => {
    fetchCheques();
    setCurrentPage(1); // Reset page when tab changes
  }, [fetchCheques]);

  const handleDeposit = async () => {
    if (!selectedCheque || !selectedAccountId) return;
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/finance/cheques", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentId: selectedCheque.id,
          action: "deposit",
          date: actionDate,
          depositAccountId: selectedAccountId,
        }),
      });

      if (!res.ok) throw new Error("Failed to deposit cheque");

      toast.success("Cheque deposited successfully");
      setDepositDialogOpen(false);
      fetchCheques();
    } catch (error) {
      toast.error("Error depositing cheque");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClear = async (cheque: Cheque) => {
    if (
      !confirm("Are you sure you want to mark this cheque as Cleared/Passed?")
    )
      return;

    try {
      const res = await fetch("/api/finance/cheques", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentId: cheque.id,
          action: "clear",
          date: new Date().toISOString().split("T")[0],
        }),
      });

      if (!res.ok) throw new Error("Failed to clear cheque");

      toast.success("Cheque marked as Passed");
      fetchCheques();
    } catch (error) {
      toast.error("Error clearing cheque");
    }
  };

  const handleReturn = async () => {
    if (!selectedCheque) return;
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/finance/cheques", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentId: selectedCheque.id,
          action: "return",
          date: actionDate,
          reversalNote: returnReason,
        }),
      });

      if (!res.ok) throw new Error("Failed to return cheque");

      toast.success("Cheque marked as Returned");
      setReturnDialogOpen(false);
      fetchCheques();
    } catch (error) {
      toast.error("Error processing return");
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredCheques = cheques.filter(
    (c) =>
      c.cheque_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.amount.toString().includes(searchTerm)
  );

  // Pagination Logic
  const totalItems = filteredCheques.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = currentPage * itemsPerPage;
  const paginatedCheques = filteredCheques.slice(startIndex, endIndex);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Cheque Registry</h1>
        <p className="text-muted-foreground">
          Manage cheque lifecycle: Deposit, Clearance, and Returns.
        </p>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="space-y-4"
      >
        <TabsList>
          <TabsTrigger value="pending" className="flex items-center gap-2">
            <Clock className="w-4 h-4" /> Checks in Hand
          </TabsTrigger>
          <TabsTrigger value="deposited" className="flex items-center gap-2">
            <Banknote className="w-4 h-4" /> Pending Clearance
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <ArrowRightLeft className="w-4 h-4" /> History
          </TabsTrigger>
        </TabsList>

        <div className="flex items-center justify-between">
          <div className="relative w-72">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search cheque no, customer..."
              className="pl-8"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cheque Date</TableHead>
                  <TableHead>Cheque No</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Bank</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto" />
                    </TableCell>
                  </TableRow>
                ) : paginatedCheques.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="h-24 text-center text-muted-foreground"
                    >
                      No cheques found.
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedCheques.map((cheque) => (
                    <TableRow key={cheque.id}>
                      <TableCell>
                        {new Date(cheque.cheque_date).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="font-medium">
                        {cheque.cheque_number}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">
                          {cheque.customer_name}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {cheque.invoice_no}
                        </div>
                      </TableCell>
                      <TableCell>{cheque.bank_name}</TableCell>
                      <TableCell className="text-right font-bold">
                        {formatCurrency(cheque.amount)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            cheque.status.toLowerCase() === "pending"
                              ? "outline"
                              : cheque.status.toLowerCase() === "deposited"
                              ? "secondary"
                              : cheque.status.toLowerCase() === "passed"
                              ? "default"
                              : "destructive"
                          }
                        >
                          {cheque.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {activeTab === "pending" && (
                          <Button
                            size="sm"
                            onClick={() => {
                              setSelectedCheque(cheque);
                              setDepositDialogOpen(true);
                            }}
                          >
                            <Banknote className="w-4 h-4 mr-2" /> Deposit
                          </Button>
                        )}
                        {activeTab === "deposited" && (
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              variant="default"
                              className="bg-green-600 hover:bg-green-700"
                              onClick={() => handleClear(cheque)}
                            >
                              <CheckCircle className="w-4 h-4 mr-2" /> Clear
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => {
                                setSelectedCheque(cheque);
                                setReturnDialogOpen(true);
                              }}
                            >
                              <XCircle className="w-4 h-4 mr-2" /> Return
                            </Button>
                          </div>
                        )}
                        {activeTab === "history" && (
                          <span className="text-sm text-muted-foreground">
                            {cheque.status === "Returned"
                              ? "Reversed"
                              : "Completed"}
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
          <CardFooter className="flex items-center justify-between py-4">
            <div className="text-sm text-muted-foreground">
              Showing {Math.min(startIndex + 1, totalItems)} to{" "}
              {Math.min(endIndex, totalItems)} of {totalItems} entries
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4" /> Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setCurrentPage((p) => Math.min(totalPages, p + 1))
                }
                disabled={currentPage === totalPages || totalPages === 0}
              >
                Next <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </CardFooter>
        </Card>
      </Tabs>

      {/* --- Deposit Dialog --- */}
      <Dialog open={depositDialogOpen} onOpenChange={setDepositDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deposit Cheque</DialogTitle>
            <DialogDescription>
              Select the bank account to deposit Cheque #
              {selectedCheque?.cheque_number}.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Bank Account</Label>
              <Select
                value={selectedAccountId}
                onValueChange={setSelectedAccountId}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select account" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((acc) => (
                    <SelectItem key={acc.id} value={acc.id}>
                      <div className="flex flex-col text-left">
                        <span className="font-medium">
                          {acc.bank_codes?.bank_name || "Bank"} -{" "}
                          {acc.account_name}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {acc.account_type} • {acc.account_number}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Deposit Date</Label>
              <Input
                type="date"
                value={actionDate}
                onChange={(e) => setActionDate(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDepositDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleDeposit} disabled={isSubmitting}>
              {isSubmitting && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}{" "}
              Deposit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* --- Return Dialog --- */}
      <Dialog open={returnDialogOpen} onOpenChange={setReturnDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark Cheque as Returned</DialogTitle>
            <DialogDescription className="text-red-600">
              Warning: This will reverse the payment, increase customer balance,
              and withdraw funds from the bank (if deposited).
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Return Reason</Label>
              <Input
                placeholder="e.g. Insufficient Funds"
                value={returnReason}
                onChange={(e) => setReturnReason(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label>Return Date</Label>
              <Input
                type="date"
                value={actionDate}
                onChange={(e) => setActionDate(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setReturnDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleReturn}
              disabled={isSubmitting}
            >
              {isSubmitting && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}{" "}
              Confirm Return
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
