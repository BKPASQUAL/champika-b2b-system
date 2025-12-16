// app/dashboard/admin/finance/accounts/page.tsx
"use client";

import React, { useState, useEffect } from "react";
import {
  Plus,
  Landmark,
  Wallet,
  ArrowRightLeft,
  Building2,
  Check,
  ChevronsUpDown,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import Link from "next/link";

// --- Types ---
interface BankCode {
  id: string;
  bank_code: string;
  bank_name: string;
}

interface BankAccount {
  id: string;
  account_name: string;
  account_type: "Savings" | "Current" | "Cash on Hand";
  account_number: string | null;
  current_balance: number;
  allow_overdraft: boolean;
  bank_codes?: {
    bank_code: string;
    bank_name: string;
  };
}

// --- Helper: Currency Formatter ---
const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("en-LK", {
    style: "currency",
    currency: "LKR",
    minimumFractionDigits: 2,
  }).format(amount);
};

export default function FinanceRegistryPage() {
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [bankCodes, setBankCodes] = useState<BankCode[]>([]);
  const [loading, setLoading] = useState(true);

  // Dialog States
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isTransferOpen, setIsTransferOpen] = useState(false);
  const [bankSearchOpen, setBankSearchOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form Data
  const [newAccount, setNewAccount] = useState({
    name: "",
    type: "Cash on Hand",
    bankCodeId: "",
    accountNumber: "",
    initialBalance: "",
  });

  const [transferData, setTransferData] = useState({
    fromId: "",
    toId: "",
    amount: "",
    date: new Date().toISOString().split("T")[0],
    description: "",
  });

  // --- Fetch Data ---
  const fetchData = async () => {
    try {
      setLoading(true);
      const [accRes, bankRes] = await Promise.all([
        fetch("/api/finance/accounts"),
        fetch("/api/finance/bank-codes"),
      ]);

      if (accRes.ok) setAccounts(await accRes.json());
      if (bankRes.ok) setBankCodes(await bankRes.json());
    } catch (error) {
      toast.error("Failed to load finance data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // --- Actions ---
  const handleAddAccount = async () => {
    if (!newAccount.name) {
      toast.error("Account name is required");
      return;
    }
    if (newAccount.type !== "Cash on Hand" && !newAccount.bankCodeId) {
      toast.error("Please select a bank for this account");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/finance/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          account_name: newAccount.name,
          account_type: newAccount.type,
          bank_code_id: newAccount.bankCodeId || null,
          account_number: newAccount.accountNumber,
          current_balance: newAccount.initialBalance || 0,
        }),
      });

      if (!res.ok) throw new Error("Failed to create account");

      toast.success("Account created successfully!");
      setIsAddOpen(false);
      fetchData(); // Refresh list

      // Reset Form
      setNewAccount({
        name: "",
        type: "Cash on Hand",
        bankCodeId: "",
        accountNumber: "",
        initialBalance: "",
      });
    } catch (error) {
      toast.error("Error creating account");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTransfer = async () => {
    if (!transferData.fromId || !transferData.toId || !transferData.amount) {
      toast.error("Please fill all transfer fields");
      return;
    }
    if (transferData.fromId === transferData.toId) {
      toast.error("Cannot transfer to the same account");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/finance/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          from_account_id: transferData.fromId,
          to_account_id: transferData.toId,
          amount: transferData.amount,
          date: transferData.date,
          description: transferData.description,
        }),
      });

      if (!res.ok) throw new Error("Transfer failed");

      toast.success("Transfer successful!");
      setIsTransferOpen(false);
      fetchData(); // Refresh balances
      setTransferData({
        fromId: "",
        toId: "",
        amount: "",
        date: new Date().toISOString().split("T")[0],
        description: "",
      });
    } catch (error) {
      toast.error("Error processing transfer");
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- UI Helpers ---
  const getIcon = (type: string) => {
    if (type === "Cash on Hand")
      return <Wallet className="h-4 w-4 text-green-600" />;
    if (type === "Current")
      return <Building2 className="h-4 w-4 text-blue-600" />;
    return <Landmark className="h-4 w-4 text-purple-600" />;
  };

  const totalLiquid = accounts.reduce(
    (sum, acc) => sum + acc.current_balance,
    0
  );

  if (loading)
    return (
      <div className="p-8 flex justify-center">
        <Loader2 className="animate-spin" />
      </div>
    );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Finance Registry
          </h1>
          <p className="text-muted-foreground">
            Manage company accounts and cash flow
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setIsTransferOpen(true)}>
            <ArrowRightLeft className="mr-2 h-4 w-4" />
            Transfer Funds
          </Button>
          <Button onClick={() => setIsAddOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Account
          </Button>
        </div>
      </div>

      {/* Overview */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="bg-slate-900 text-white border-slate-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-300">
              Net Liquid Position
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(totalLiquid)}
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Total across all accounts
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Accounts Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {accounts.map((account) => (
          <Link
            key={account.id}
            href={`/dashboard/admin/finance/accounts/${account.id}`}
            className="block"
          >
            <Card className="relative overflow-hidden group hover:shadow-md transition-all cursor-pointer h-full">
              <div
                className={cn(
                  "absolute top-0 left-0 w-1 h-full",
                  account.account_type === "Cash on Hand"
                    ? "bg-green-500"
                    : account.account_type === "Current"
                    ? "bg-blue-500"
                    : "bg-purple-500"
                )}
              />
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium line-clamp-1 mr-2">
                  {account.account_name}
                </CardTitle>
                {getIcon(account.account_type)}
              </CardHeader>
              <CardContent>
                <div className="mt-2 space-y-1">
                  <div
                    className={cn(
                      "text-2xl font-bold",
                      account.current_balance < 0
                        ? "text-red-600"
                        : "text-gray-900"
                    )}
                  >
                    {formatCurrency(account.current_balance)}
                  </div>

                  <div className="text-xs text-muted-foreground">
                    {account.account_type === "Cash on Hand" ? (
                      "Office Float / Petty Cash"
                    ) : (
                      <>
                        {account.bank_codes?.bank_name}
                        <br />
                        <span className="font-mono">
                          {account.account_number}
                        </span>
                      </>
                    )}
                  </div>

                  {account.allow_overdraft && (
                    <div className="flex items-center gap-1 text-xs text-amber-600 mt-2 bg-amber-50 p-1 rounded w-fit">
                      <AlertCircle className="h-3 w-3" />
                      <span>Overdraft Enabled</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Add Account Dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Add New Account</DialogTitle>
            <DialogDescription>
              Create a new bank account or cash registry.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Account Name *</Label>
              <Input
                id="name"
                placeholder="e.g. Commercial Bank Operation"
                value={newAccount.name}
                onChange={(e) =>
                  setNewAccount({ ...newAccount, name: e.target.value })
                }
                className="w-full"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="type">Account Type *</Label>
              <Select
                value={newAccount.type}
                onValueChange={(val) =>
                  setNewAccount({ ...newAccount, type: val })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Cash on Hand">Cash on Hand</SelectItem>
                  <SelectItem value="Savings">Savings Account</SelectItem>
                  <SelectItem value="Current">Current Account</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {newAccount.type !== "Cash on Hand" && (
              <>
                <div className="grid gap-2">
                  <Label>Bank *</Label>
                  <Popover
                    open={bankSearchOpen}
                    onOpenChange={setBankSearchOpen}
                  >
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={bankSearchOpen}
                        className="w-full justify-between font-normal"
                      >
                        {newAccount.bankCodeId
                          ? bankCodes.find(
                              (b) => b.id === newAccount.bankCodeId
                            )?.bank_name
                          : "Select bank..."}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[450px] p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Search bank..." />
                        <CommandList>
                          <CommandEmpty>No bank found.</CommandEmpty>
                          <CommandGroup>
                            {bankCodes.map((bank) => (
                              <CommandItem
                                key={bank.id}
                                value={`${bank.bank_code} ${bank.bank_name}`}
                                onSelect={() => {
                                  setNewAccount({
                                    ...newAccount,
                                    bankCodeId: bank.id,
                                  });
                                  setBankSearchOpen(false);
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    newAccount.bankCodeId === bank.id
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

                <div className="grid gap-2">
                  <Label htmlFor="accNum">Account Number</Label>
                  <Input
                    id="accNum"
                    placeholder="Enter account number"
                    value={newAccount.accountNumber}
                    onChange={(e) =>
                      setNewAccount({
                        ...newAccount,
                        accountNumber: e.target.value,
                      })
                    }
                    className="w-full"
                  />
                </div>
              </>
            )}

            <div className="grid gap-2">
              <Label htmlFor="balance">Opening Balance (LKR)</Label>
              <Input
                id="balance"
                type="number"
                placeholder="0.00"
                value={newAccount.initialBalance}
                onChange={(e) =>
                  setNewAccount({
                    ...newAccount,
                    initialBalance: e.target.value,
                  })
                }
                className="w-full"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddAccount} disabled={isSubmitting}>
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "Create Account"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Transfer Dialog */}
      <Dialog open={isTransferOpen} onOpenChange={setIsTransferOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Internal Transfer</DialogTitle>
            <DialogDescription>
              Move money between your accounts.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>From</Label>
              <Select
                value={transferData.fromId}
                onValueChange={(val) =>
                  setTransferData({ ...transferData, fromId: val })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select Source Account" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((acc) => (
                    <SelectItem key={acc.id} value={acc.id}>
                      {acc.account_name} ({formatCurrency(acc.current_balance)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label>To</Label>
              <Select
                value={transferData.toId}
                onValueChange={(val) =>
                  setTransferData({ ...transferData, toId: val })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select Destination Account" />
                </SelectTrigger>
                <SelectContent>
                  {accounts
                    .filter((acc) => acc.id !== transferData.fromId)
                    .map((acc) => (
                      <SelectItem key={acc.id} value={acc.id}>
                        {acc.account_name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label>Amount (LKR)</Label>
              <Input
                type="number"
                value={transferData.amount}
                onChange={(e) =>
                  setTransferData({ ...transferData, amount: e.target.value })
                }
                className="w-full"
              />
            </div>

            <div className="grid gap-2">
              <Label>Description</Label>
              <Input
                value={transferData.description}
                onChange={(e) =>
                  setTransferData({
                    ...transferData,
                    description: e.target.value,
                  })
                }
                placeholder="Reason for transfer..."
                className="w-full"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsTransferOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleTransfer} disabled={isSubmitting}>
              Confirm Transfer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
